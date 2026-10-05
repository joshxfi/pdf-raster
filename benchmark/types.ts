export type BenchOutputFormat = "jpeg" | "png" | "webp";

export type BenchLibrary = "pdf-raster" | "pdfjs-napi" | "pdfjs-node-canvas";

export type BenchOptions = {
  inputs: string[];
  dpi: number;
  outputFormat: BenchOutputFormat;
  pages?: number[];
  warmups: number;
  runs: number;
  json: boolean;
  libs: BenchLibrary[];
  concurrency: number;
};

export type BenchPageResult = {
  pageIndex: number;
  width: number;
  height: number;
  rasterMs: number | null;
  encodeMs: number | null;
  totalMs: number | null;
  outputBytes: number;
};

export type BenchRunResult = {
  library: string;
  backend: string;
  pageCount: number;
  dpi: number;
  mimeType: string;
  rasterMs: number | null;
  encodeMs: number | null;
  totalMs: number;
  outputBytes: number;
  msPerPage: number;
  outputBytesPerPage: number;
  concurrency: number;
  pagesPerSecond: number;
  pages: BenchPageResult[];
};

export type NumericSummary = {
  avg: number;
  min: number;
  max: number;
  p50: number;
};

export type BenchSummary = {
  library: string;
  backend: string;
  pageCount: number;
  dpi: number;
  mimeType: string;
  rasterMs: NumericSummary | null;
  encodeMs: NumericSummary | null;
  totalMs: NumericSummary;
  msPerPage: NumericSummary;
  outputBytes: NumericSummary;
  outputBytesPerPage: NumericSummary;
  concurrency: number;
  pagesPerSecond: NumericSummary;
  runs: BenchRunResult[];
};

export type BenchFailure = {
  library: BenchLibrary;
  message: string;
};

export type FileBenchmarkReport = {
  inputPath: string;
  inputBytes: number;
  settings: {
    dpi: number;
    outputFormat: BenchOutputFormat;
    pages?: number[];
    warmups: number;
    runs: number;
    libs: BenchLibrary[];
    concurrency: number;
  };
  summaries: BenchSummary[];
  failures?: BenchFailure[];
};

export type BenchmarkReport = {
  generatedAt: string;
  pdfjsBackends: string[];
  files: FileBenchmarkReport[];
};
