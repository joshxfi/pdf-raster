#![deny(clippy::all)]

use image::imageops;
use image::{DynamicImage, ImageFormat, RgbaImage};
use napi::bindgen_prelude::Buffer;
use napi::{Error, Result, Status};
use napi_derive::napi;
use pdfium_render::prelude::*;
use std::io::Cursor;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, sync_channel};
use std::sync::{Arc, Condvar, Mutex, MutexGuard};

// Matches the `image` crate JPEG default this replaces.
const JPEG_QUALITY: u8 = 75;

static PDFIUM: Mutex<Option<Pdfium>> = Mutex::new(None);

#[derive(Debug)]
#[napi(object)]
pub struct NativeCrop {
  pub x: u32,
  pub y: u32,
  pub width: u32,
  pub height: u32,
}

#[derive(Debug)]
#[napi(object)]
pub struct NativeConvertOptions {
  pub pages: Option<Vec<u32>>,
  pub dpi: Option<u32>,
  pub output_format: Option<String>,
  pub password: Option<String>,
  pub crop: Option<NativeCrop>,
  pub render_annotations: Option<bool>,
  pub max_pixels: Option<u32>,
}

#[napi(object)]
pub struct NativeConvertedPage {
  pub page_index: u32,
  pub data: Buffer,
  pub mime_type: String,
  pub width: u32,
  pub height: u32,
  pub dpi: u32,
}

#[derive(Debug)]
enum InputSource {
  Path(String),
  Bytes(Vec<u8>),
}

#[derive(Debug)]
struct ConvertRequest {
  input: InputSource,
  options: NativeConvertOptions,
  pdfium_library_path: Option<String>,
}

#[derive(Debug)]
struct ResolvedConvertOptions {
  pages: Option<Vec<u32>>,
  dpi: u32,
  output_format: OutputFormat,
  password: Option<String>,
  crop: Option<NativeCrop>,
  render_annotations: bool,
  max_pixels: Option<u32>,
}

#[derive(Clone, Copy, Debug)]
enum OutputFormat {
  Jpeg,
  Png,
  Webp,
}

impl OutputFormat {
  fn from_option(value: Option<&str>) -> std::result::Result<Self, ConvertError> {
    match value.unwrap_or("png") {
      "jpeg" => Ok(Self::Jpeg),
      "png" => Ok(Self::Png),
      "webp" => Ok(Self::Webp),
      _ => Err(ConvertError::new(
        ErrorCode::InvalidOptions,
        "Supported output formats are png, jpeg, and webp.",
      )),
    }
  }

  fn as_str(self) -> &'static str {
    match self {
      Self::Jpeg => "jpeg",
      Self::Png => "png",
      Self::Webp => "webp",
    }
  }

  fn image_format(self) -> ImageFormat {
    match self {
      Self::Jpeg => ImageFormat::Jpeg,
      Self::Png => ImageFormat::Png,
      Self::Webp => ImageFormat::WebP,
    }
  }

  fn mime_type(self) -> &'static str {
    match self {
      Self::Jpeg => "image/jpeg",
      Self::Png => "image/png",
      Self::Webp => "image/webp",
    }
  }
}

#[derive(Debug, Clone, Copy)]
enum ErrorCode {
  InvalidOptions,
  InvalidPageIndex,
  InvalidCrop,
  PasswordError,
  MalformedPdf,
  PdfiumUnavailable,
  RenderError,
}

impl ErrorCode {
  fn as_str(self) -> &'static str {
    match self {
      ErrorCode::InvalidOptions => "INVALID_OPTIONS",
      ErrorCode::InvalidPageIndex => "INVALID_PAGE_INDEX",
      ErrorCode::InvalidCrop => "INVALID_CROP",
      ErrorCode::PasswordError => "PASSWORD_ERROR",
      ErrorCode::MalformedPdf => "MALFORMED_PDF",
      ErrorCode::PdfiumUnavailable => "PDFIUM_UNAVAILABLE",
      ErrorCode::RenderError => "RENDER_ERROR",
    }
  }
}

#[derive(Debug)]
struct ConvertError {
  code: ErrorCode,
  message: String,
}

impl ConvertError {
  fn new(code: ErrorCode, message: impl Into<String>) -> Self {
    Self {
      code,
      message: message.into(),
    }
  }
}

impl From<ConvertError> for Error {
  fn from(error: ConvertError) -> Self {
    let status = match error.code {
      ErrorCode::InvalidOptions
      | ErrorCode::InvalidPageIndex
      | ErrorCode::InvalidCrop => Status::InvalidArg,
      _ => Status::GenericFailure,
    };

    Error::new(status, format!("{}: {}", error.code.as_str(), error.message))
  }
}

fn lock_pdfium(pdfium_library_path: Option<&str>) -> std::result::Result<MutexGuard<'static, Option<Pdfium>>, ConvertError> {
  let mut guard = PDFIUM.lock().map_err(|_| {
    ConvertError::new(
      ErrorCode::RenderError,
      "The PDFium renderer lock was poisoned by a prior panic.",
    )
  })?;

  if guard.is_none() {
    let bindings = bind_pdfium(pdfium_library_path).map_err(|error| {
      ConvertError::new(
        ErrorCode::PdfiumUnavailable,
        format!("Unable to initialize PDFium: {error}"),
      )
    })?;
    *guard = Some(Pdfium::new(bindings));
  }

  Ok(guard)
}

fn bind_pdfium(pdfium_library_path: Option<&str>) -> std::result::Result<Box<dyn PdfiumLibraryBindings>, PdfiumError> {
  let resolved_path = pdfium_library_path
    .map(ToOwned::to_owned)
    .or_else(|| std::env::var("PDFIUM_LIB_PATH").ok());

  if let Some(path) = resolved_path {
    let path = PathBuf::from(path);

    if path.is_dir() {
      return Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path(&path));
    }

    return Pdfium::bind_to_library(path);
  }

  Pdfium::bind_to_system_library()
}

fn normalize_options(options: NativeConvertOptions) -> std::result::Result<ResolvedConvertOptions, ConvertError> {
  let output_format = OutputFormat::from_option(options.output_format.as_deref())?;

  if let Some(dpi) = options.dpi {
    if dpi == 0 {
      return Err(ConvertError::new(
        ErrorCode::InvalidOptions,
        "DPI must be greater than zero.",
      ));
    }
  }

  if options.max_pixels == Some(0) {
    return Err(ConvertError::new(
      ErrorCode::InvalidOptions,
      "maxPixels must be greater than zero.",
    ));
  }

  Ok(ResolvedConvertOptions {
    pages: options.pages,
    dpi: options.dpi.unwrap_or(300),
    output_format,
    password: options.password,
    crop: options.crop,
    render_annotations: options.render_annotations.unwrap_or(true),
    max_pixels: options.max_pixels,
  })
}

fn default_native_options() -> NativeConvertOptions {
  NativeConvertOptions {
    pages: None,
    dpi: None,
    output_format: None,
    password: None,
    crop: None,
    render_annotations: None,
    max_pixels: None,
  }
}

fn resolve_page_indices(page_count: usize, pages: Option<Vec<u32>>) -> std::result::Result<Vec<usize>, ConvertError> {
  match pages {
    Some(pages) => {
      let mut resolved = Vec::with_capacity(pages.len());

      for page in pages {
        let page_index = usize::try_from(page).map_err(|_| {
          ConvertError::new(
            ErrorCode::InvalidPageIndex,
            format!("Page index {page} could not be represented on this platform."),
          )
        })?;

        if page_index >= page_count {
          return Err(ConvertError::new(
            ErrorCode::InvalidPageIndex,
            format!("Page index {page} is out of range for a document with {page_count} page(s)."),
          ));
        }

        resolved.push(page_index);
      }

      Ok(resolved)
    }
    None => Ok((0..page_count).collect()),
  }
}

fn encode_jpeg(rgba: &RgbaImage) -> std::result::Result<Vec<u8>, ConvertError> {
  let width = u16::try_from(rgba.width()).map_err(|_| jpeg_dimension_error())?;
  let height = u16::try_from(rgba.height()).map_err(|_| jpeg_dimension_error())?;
  let mut bytes = Vec::new();
  let mut encoder = jpeg_encoder::Encoder::new(&mut bytes, JPEG_QUALITY);
  // Match the previous `image` encoder: no chroma subsampling (4:4:4).
  encoder.set_sampling_factor(jpeg_encoder::SamplingFactor::F_1_1);
  encoder
    .encode(rgba.as_raw(), width, height, jpeg_encoder::ColorType::Rgba)
    .map_err(|error| {
      ConvertError::new(
        ErrorCode::RenderError,
        format!("Failed to encode jpeg output: {error}"),
      )
    })?;

  Ok(bytes)
}

fn jpeg_dimension_error() -> ConvertError {
  ConvertError::new(
    ErrorCode::RenderError,
    "Failed to encode jpeg output: image dimensions exceed 65535 pixels.".to_string(),
  )
}

fn encode_image(image: &DynamicImage, output_format: OutputFormat) -> std::result::Result<Vec<u8>, ConvertError> {
  if matches!(output_format, OutputFormat::Jpeg) {
    // Pages render on opaque white, so the alpha channel is always 255 and is ignored by the encoder.
    return match image {
      DynamicImage::ImageRgba8(rgba) => encode_jpeg(rgba),
      other => encode_jpeg(&other.to_rgba8()),
    };
  }

  let mut cursor = Cursor::new(Vec::new());

  image
    .write_to(&mut cursor, output_format.image_format())
    .map_err(|error| {
      ConvertError::new(
        ErrorCode::RenderError,
        format!("Failed to encode {} output: {error}", output_format.as_str()),
      )
    })?;

  Ok(cursor.into_inner())
}

fn crop_image(image: RgbaImage, crop: &NativeCrop) -> std::result::Result<RgbaImage, ConvertError> {
  let image_width = image.width();
  let image_height = image.height();
  let right = crop.x.checked_add(crop.width).ok_or_else(|| {
    ConvertError::new(ErrorCode::InvalidCrop, "Crop width overflows the output image bounds.")
  })?;
  let bottom = crop.y.checked_add(crop.height).ok_or_else(|| {
    ConvertError::new(ErrorCode::InvalidCrop, "Crop height overflows the output image bounds.")
  })?;

  if right > image_width || bottom > image_height {
    return Err(ConvertError::new(
      ErrorCode::InvalidCrop,
      format!(
        "Crop rectangle ({}, {}, {}, {}) exceeds rendered page bounds of {}x{}.",
        crop.x, crop.y, crop.width, crop.height, image_width, image_height
      ),
    ));
  }

  Ok(imageops::crop_imm(&image, crop.x, crop.y, crop.width, crop.height).to_image())
}

// Encoder threads only ever receive owned images; PDFium is touched solely by the thread holding the lock.
const MAX_ENCODER_THREADS: usize = 4;

/// Process-wide cap on rendered page frames that exist at once, across all concurrent conversions.
///
/// A frame is the full RGBA bitmap of one rendered page, from the moment it is rendered until its encoder
/// finishes with it. The cap bounds peak frame memory to about 8 rendered pages in total (roughly 270 MB at
/// 300 DPI US letter), independent of how many conversions run at the same time. Without it, every call would
/// release the PDFium lock after rendering and memory would grow with the number of concurrent callers.
const MAX_FRAMES_IN_FLIGHT: usize = MAX_ENCODER_THREADS * 2;

struct FrameSlots {
  available: Mutex<usize>,
  released: Condvar,
}

static ENCODE_SLOTS: FrameSlots = FrameSlots {
  available: Mutex::new(MAX_FRAMES_IN_FLIGHT),
  released: Condvar::new(),
};

/// Holds one frame slot; the slot is returned when this value is dropped.
struct FrameSlot;

fn acquire_frame_slot() -> FrameSlot {
  let mut available = ENCODE_SLOTS.available.lock().unwrap_or_else(|poisoned| poisoned.into_inner());

  while *available == 0 {
    available = ENCODE_SLOTS.released.wait(available).unwrap_or_else(|poisoned| poisoned.into_inner());
  }

  *available -= 1;
  FrameSlot
}

impl Drop for FrameSlot {
  fn drop(&mut self) {
    let mut available = ENCODE_SLOTS.available.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    *available += 1;
    ENCODE_SLOTS.released.notify_one();
  }
}

struct RenderedPage {
  position: usize,
  image: RgbaImage,
  slot: FrameSlot,
}

struct EncodedPage {
  data: Vec<u8>,
  width: u32,
  height: u32,
}

type EncodeResult = std::result::Result<EncodedPage, ConvertError>;

fn render_one(document: &PdfDocument, page_index: usize, options: &ResolvedConvertOptions) -> std::result::Result<RgbaImage, ConvertError> {
  let page_number = u16::try_from(page_index).map_err(|_| {
    ConvertError::new(
      ErrorCode::InvalidPageIndex,
      format!("Page index {page_index} could not be represented by PDFium."),
    )
  })?;
  let page = document.pages().get(page_number).map_err(map_pdfium_error)?;

  let width = points_to_pixels(page.width().value, options.dpi);
  // Mirror pdfium-render's bitmap sizing for a target-width render so the guard matches the real bitmap.
  let height = f64::from((page.height().value * (width as f32 / page.width().value)).round().max(1.0));

  if width > MAX_DIMENSION_PIXELS || height > MAX_DIMENSION_PIXELS {
    return Err(ConvertError::new(
      ErrorCode::InvalidOptions,
      format!(
        "Page {page_index} would render at {width:.0}x{height:.0} pixels at {} DPI, exceeding the maximum dimension of 65535 pixels. Lower the dpi.",
        options.dpi
      ),
    ));
  }

  if let Some(max_pixels) = options.max_pixels {
    let pixel_count = width * height;
    if pixel_count > f64::from(max_pixels) {
      return Err(ConvertError::new(
        ErrorCode::InvalidOptions,
        format!(
          "Page {page_index} would render at {width:.0}x{height:.0} pixels ({pixel_count:.0} total) at {} DPI, exceeding maxPixels ({max_pixels}). Lower the dpi or raise maxPixels.",
          options.dpi
        ),
      ));
    }
  }

  let render_config = PdfRenderConfig::new()
    .set_target_width(width as i32)
    .set_clear_color(PdfColor::WHITE)
    .render_annotations(options.render_annotations)
    .render_form_data(options.render_annotations);

  let bitmap = page
    .render_with_config(&render_config)
    .map_err(map_pdfium_error)?;

  Ok(bitmap.as_image().into_rgba8())
}

fn crop_and_encode(mut image: RgbaImage, options: &ResolvedConvertOptions) -> EncodeResult {
  if let Some(crop) = &options.crop {
    image = crop_image(image, crop)?;
  }

  let dynamic_image = DynamicImage::ImageRgba8(image);
  let data = encode_image(&dynamic_image, options.output_format)?;

  Ok(EncodedPage {
    data,
    width: dynamic_image.width(),
    height: dynamic_image.height(),
  })
}

fn render_pages(request: ConvertRequest) -> std::result::Result<Vec<NativeConvertedPage>, ConvertError> {
  let mut options = normalize_options(request.options)?;
  let page_filter = options.pages.take();
  let options = options;
  let password = options.password.as_deref();

  let (sender, receiver) = sync_channel::<RenderedPage>(MAX_ENCODER_THREADS);
  let receiver = Arc::new(Mutex::new(receiver));
  let (result_sender, result_receiver) = channel::<(usize, EncodeResult)>();
  let failed = AtomicBool::new(false);

  let mut render_error: Option<(usize, ConvertError)> = None;
  let mut setup_error: Option<ConvertError> = None;
  let mut target_pages: Vec<usize> = Vec::new();
  let mut encoded: Vec<(usize, EncodeResult)> = Vec::new();

  std::thread::scope(|scope| {
    // Everything that touches PDFium lives in this block, on the calling thread. Leaving the block drops the
    // document and then the lock guard, so the lock is released before we wait for the encoders to finish.
    {
      let pdfium_guard = match lock_pdfium(request.pdfium_library_path.as_deref()) {
        Ok(guard) => guard,
        Err(error) => {
          setup_error = Some(error);
          return;
        }
      };
      let Some(pdfium) = pdfium_guard.as_ref() else {
        setup_error = Some(ConvertError::new(
          ErrorCode::PdfiumUnavailable,
          "PDFium initialization completed but no global binding was stored.",
        ));
        return;
      };

      let loaded = match request.input {
        InputSource::Path(path) => pdfium.load_pdf_from_file(&path, password),
        InputSource::Bytes(bytes) => pdfium.load_pdf_from_byte_vec(bytes, password),
      };
      let document = match loaded {
        Ok(document) => document,
        Err(error) => {
          setup_error = Some(map_pdfium_error(error));
          return;
        }
      };

      let page_count = usize::from(document.pages().len());
      target_pages = match resolve_page_indices(page_count, page_filter) {
        Ok(pages) => pages,
        Err(error) => {
          setup_error = Some(error);
          return;
        }
      };

      let workers = target_pages
        .len()
        .min(MAX_ENCODER_THREADS)
        .min(std::thread::available_parallelism().map(|count| count.get()).unwrap_or(1))
        .max(1);

      for _ in 0..workers {
        let receiver = Arc::clone(&receiver);
        let result_sender = result_sender.clone();
        let failed = &failed;
        let options = &options;

        scope.spawn(move || {
          loop {
            let next = match receiver.lock() {
              Ok(guard) => guard.recv(),
              Err(_) => break,
            };
            let Ok(page) = next else {
              break;
            };

            let RenderedPage { position, image, slot } = page;
            let result = crop_and_encode(image, options);
            // The RGBA frame is freed once `crop_and_encode` returns, so hand its slot back right away.
            drop(slot);
            if result.is_err() {
              failed.store(true, Ordering::Relaxed);
            }
            if result_sender.send((position, result)).is_err() {
              break;
            }
          }
        });
      }
      // Only the workers hold the receiver now, so if they all stop, `send` fails instead of blocking forever.
      drop(receiver);

      for (position, page_index) in target_pages.iter().copied().enumerate() {
        if failed.load(Ordering::Relaxed) {
          break;
        }

        // Waiting here while holding the PDFium lock cannot deadlock: slots are freed by encoders, which never
        // need the lock.
        let slot = acquire_frame_slot();

        match render_one(&document, page_index, &options) {
          Ok(image) => {
            if sender.send(RenderedPage { position, image, slot }).is_err() {
              break;
            }
          }
          Err(error) => {
            render_error = Some((position, error));
            break;
          }
        }
      }
    }

    // The lock is released. Close the queue so the workers finish, then collect their results.
    drop(sender);
    drop(result_sender);
    for item in result_receiver {
      encoded.push(item);
    }
  });

  if let Some(error) = setup_error {
    return Err(error);
  }

  // Match the old sequential loop: the failure with the lowest page position wins.
  encoded.sort_by_key(|(position, _)| *position);
  let mut first_error = render_error;
  let mut converted = Vec::with_capacity(encoded.len());

  for (position, result) in encoded {
    match result {
      Ok(page) => converted.push((position, page)),
      Err(error) => {
        if first_error.as_ref().is_none_or(|(error_position, _)| position < *error_position) {
          first_error = Some((position, error));
        }
      }
    }
  }

  if let Some((_, error)) = first_error {
    return Err(error);
  }

  Ok(
    converted
      .into_iter()
      .map(|(position, page)| NativeConvertedPage {
        page_index: target_pages[position] as u32,
        data: page.data.into(),
        mime_type: options.output_format.mime_type().to_owned(),
        width: page.width,
        height: page.height,
        dpi: options.dpi,
      })
      .collect(),
  )
}

const MAX_DIMENSION_PIXELS: f64 = 65_535.0;

fn points_to_pixels(points: f32, dpi: u32) -> f64 {
  f64::from(((points / 72.0) * dpi as f32).round().max(1.0))
}

fn map_pdfium_error(error: PdfiumError) -> ConvertError {
  let message = error.to_string();

  if message.to_ascii_lowercase().contains("password") {
    return ConvertError::new(
      ErrorCode::PasswordError,
      format!("Failed to open the PDF with the provided password: {message}"),
    );
  }

  if matches!(error, PdfiumError::PdfiumLibraryInternalError(_)) {
    return ConvertError::new(
      ErrorCode::MalformedPdf,
      format!("The PDF could not be parsed: {message}"),
    );
  }

  ConvertError::new(
    ErrorCode::RenderError,
    format!("PDF rendering failed: {message}"),
  )
}

#[napi(js_name = "convertPath")]
pub async fn convert_path(
  path: String,
  options: Option<NativeConvertOptions>,
  pdfium_library_path: Option<String>,
) -> Result<Vec<NativeConvertedPage>> {
  tokio::task::spawn_blocking(move || {
    render_pages(ConvertRequest {
      input: InputSource::Path(path),
      options: options.unwrap_or(default_native_options()),
      pdfium_library_path,
    })
  })
  .await
  .map_err(|error| Error::new(Status::GenericFailure, format!("RENDER_ERROR: Task join failure: {error}")))?
  .map_err(Into::into)
}

#[napi(js_name = "convertBytes")]
pub async fn convert_bytes(
  bytes: Buffer,
  options: Option<NativeConvertOptions>,
  pdfium_library_path: Option<String>,
) -> Result<Vec<NativeConvertedPage>> {
  tokio::task::spawn_blocking(move || {
    render_pages(ConvertRequest {
      input: InputSource::Bytes(bytes.to_vec()),
      options: options.unwrap_or(default_native_options()),
      pdfium_library_path,
    })
  })
  .await
  .map_err(|error| Error::new(Status::GenericFailure, format!("RENDER_ERROR: Task join failure: {error}")))?
  .map_err(Into::into)
}
