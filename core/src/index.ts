import { bundledPdfiumPath, nativeBinding } from "./native.js";
import {
  type ConvertedPage,
  type ConvertInput,
  type ConvertOptions,
  type Crop,
  type OutputFormat,
  PdfToImagesError,
  type PdfToImagesErrorCode,
} from "./types.js";

const DEFAULT_OUTPUT_FORMAT: OutputFormat = "png";
const SUPPORTED_OUTPUT_FORMATS = new Set<OutputFormat>(["jpeg", "png", "webp"]);
const NATIVE_ERROR_CODES = new Set<PdfToImagesErrorCode>([
  "INVALID_INPUT",
  "INVALID_OPTIONS",
  "INVALID_PAGE_INDEX",
  "INVALID_CROP",
  "PASSWORD_ERROR",
  "MALFORMED_PDF",
  "PDFIUM_UNAVAILABLE",
  "RENDER_ERROR",
]);

function isSupportedOutputFormat(
  value: string,
): value is typeof DEFAULT_OUTPUT_FORMAT | "jpeg" | "webp" {
  return SUPPORTED_OUTPUT_FORMATS.has(value as OutputFormat);
}

function isNativeErrorCode(value: string): value is PdfToImagesErrorCode {
  return NATIVE_ERROR_CODES.has(value as PdfToImagesErrorCode);
}

function normalizeInput(input: ConvertInput): string | Buffer {
  if (typeof input === "string") {
    return input;
  }

  if (Buffer.isBuffer(input)) {
    return input;
  }

  if (input instanceof ArrayBuffer) {
    return Buffer.from(input);
  }

  if (ArrayBuffer.isView(input)) {
    return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  }

  throw new PdfToImagesError(
    "INVALID_INPUT",
    "Expected a file path, Buffer, Uint8Array, or ArrayBuffer.",
  );
}

function normalizeCrop(crop: Crop | undefined): Crop | undefined {
  if (!crop) {
    return undefined;
  }

  const values = [crop.x, crop.y, crop.width, crop.height];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new PdfToImagesError(
      "INVALID_CROP",
      "Crop values must be finite numbers.",
    );
  }

  if (crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0) {
    throw new PdfToImagesError(
      "INVALID_CROP",
      "Crop values must be non-negative and width/height must be greater than zero.",
    );
  }

  return {
    x: Math.trunc(crop.x),
    y: Math.trunc(crop.y),
    width: Math.trunc(crop.width),
    height: Math.trunc(crop.height),
  };
}

function normalizeOptions(options: ConvertOptions = {}): ConvertOptions {
  if (options.outputFormat && !isSupportedOutputFormat(options.outputFormat)) {
    throw new PdfToImagesError(
      "INVALID_OPTIONS",
      "Supported output formats are png, jpeg, and webp.",
    );
  }

  if (options.dpi !== undefined) {
    if (!Number.isFinite(options.dpi) || options.dpi <= 0) {
      throw new PdfToImagesError(
        "INVALID_OPTIONS",
        "DPI must be a positive number.",
      );
    }

    const dpi = Math.trunc(options.dpi);
    if (dpi < 1 || dpi > 0xffff_ffff) {
      throw new PdfToImagesError(
        "INVALID_OPTIONS",
        "DPI must be between 1 and 4294967295.",
      );
    }
  }

  if (options.maxPixels !== undefined) {
    if (
      !Number.isInteger(options.maxPixels) ||
      options.maxPixels < 1 ||
      options.maxPixels > 0xffff_ffff
    ) {
      throw new PdfToImagesError(
        "INVALID_OPTIONS",
        "maxPixels must be an integer between 1 and 4294967295.",
      );
    }
  }

  if (options.pages) {
    if (!Array.isArray(options.pages)) {
      throw new PdfToImagesError(
        "INVALID_OPTIONS",
        "`pages` must be an array of zero-based page indices.",
      );
    }

    for (const pageIndex of options.pages) {
      if (
        !Number.isSafeInteger(pageIndex) ||
        pageIndex < 0 ||
        pageIndex > 0xffff_ffff
      ) {
        throw new PdfToImagesError(
          "INVALID_PAGE_INDEX",
          "Page indices must be non-negative integers below 2^32.",
        );
      }
    }
  }

  return {
    pages: options.pages?.map((pageIndex) => Math.trunc(pageIndex)),
    dpi: options.dpi !== undefined ? Math.trunc(options.dpi) : undefined,
    outputFormat: options.outputFormat ?? DEFAULT_OUTPUT_FORMAT,
    password: options.password,
    crop: normalizeCrop(options.crop),
    renderAnnotations: options.renderAnnotations,
    maxPixels: options.maxPixels,
  };
}

function mapNativeError(error: unknown): never {
  if (error instanceof PdfToImagesError) {
    throw error;
  }

  if (error instanceof Error) {
    const separatorIndex = error.message.indexOf(":");
    if (separatorIndex > 0) {
      const code = error.message.slice(0, separatorIndex);
      const message = error.message.slice(separatorIndex + 1).trim();

      if (isNativeErrorCode(code)) {
        throw new PdfToImagesError(code, message, { cause: error });
      }
    }

    throw new PdfToImagesError("RENDER_ERROR", error.message, { cause: error });
  }

  throw new PdfToImagesError("RENDER_ERROR", "Unknown native error.", {
    cause: error,
  });
}

export async function convert(
  input: ConvertInput,
  options: ConvertOptions = {},
): Promise<ConvertedPage[]> {
  const normalizedInput = normalizeInput(input);
  const normalizedOptions = normalizeOptions(options);

  try {
    if (typeof normalizedInput === "string") {
      return await nativeBinding.convertPath(
        normalizedInput,
        normalizedOptions,
        bundledPdfiumPath,
      );
    }

    return await nativeBinding.convertBytes(
      normalizedInput,
      normalizedOptions,
      bundledPdfiumPath,
    );
  } catch (error) {
    mapNativeError(error);
  }
}

export { PdfToImagesError };
export type {
  ConvertedPage,
  ConvertInput,
  ConvertOptions,
  Crop,
  OutputFormat,
  PdfToImagesErrorCode,
} from "./types.js";
