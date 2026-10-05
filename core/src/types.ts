export type ConvertInput = string | Buffer | Uint8Array | ArrayBuffer;

export type OutputFormat = "jpeg" | "png" | "webp";

export type Crop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ConvertOptions = {
  pages?: number[];
  dpi?: number;
  outputFormat?: OutputFormat;
  password?: string;
  crop?: Crop;
  renderAnnotations?: boolean;
  /** Maximum pixels per rendered page (width × height). Unlimited when omitted. */
  maxPixels?: number;
};

export type ConvertedPage = {
  pageIndex: number;
  data: Buffer;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
  dpi: number;
};

export type PdfToImagesErrorCode =
  | "INVALID_INPUT"
  | "INVALID_OPTIONS"
  | "INVALID_PAGE_INDEX"
  | "INVALID_CROP"
  | "PASSWORD_ERROR"
  | "MALFORMED_PDF"
  | "PDFIUM_UNAVAILABLE"
  | "RENDER_ERROR";

export class PdfToImagesError extends Error {
  code: PdfToImagesErrorCode;

  constructor(
    code: PdfToImagesErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PdfToImagesError";
    this.code = code;
  }
}
