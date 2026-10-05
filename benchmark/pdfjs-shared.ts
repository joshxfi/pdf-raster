import { readFile } from "node:fs/promises";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import type { BenchOptions, BenchRunResult } from "./types";

type RenderTask = {
  promise: Promise<void>;
};

type PdfPage = {
  getViewport(options: { scale: number }): { width: number; height: number };
  render(options: {
    canvasContext: unknown;
    viewport: { width: number; height: number };
    background: string;
  }): RenderTask;
  cleanup(): void;
};

type PdfDocument = {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
  cleanup(): void;
  destroy(): Promise<void>;
};

type PdfLoadingTask = {
  promise: Promise<PdfDocument>;
  destroy(): Promise<void>;
};

export type CanvasLike = {
  getContext(type: "2d"): unknown;
  toBuffer(mimeType: string): Buffer;
};

export type PdfjsCanvasBackend = {
  name: string;
  installGlobals(): void;
  createCanvas(width: number, height: number): CanvasLike;
};

function resolvePageSelection(pageCount: number, pages?: number[]): number[] {
  if (!pages || pages.length === 0) {
    return Array.from({ length: pageCount }, (_, index) => index);
  }

  for (const pageIndex of pages) {
    if (pageIndex < 0 || pageIndex >= pageCount) {
      throw new Error(
        `Requested page index ${pageIndex} is out of range for ${pageCount} page(s).`,
      );
    }
  }

  return pages;
}

function encodeCanvas(
  canvas: CanvasLike,
  outputFormat: BenchOptions["outputFormat"],
): Buffer {
  const mimeType =
    outputFormat === "jpeg"
      ? "image/jpeg"
      : outputFormat === "webp"
        ? "image/webp"
        : "image/png";

  return canvas.toBuffer(mimeType);
}

function resolveMimeType(outputFormat: BenchOptions["outputFormat"]): string {
  if (outputFormat === "jpeg") {
    return "image/jpeg";
  }

  if (outputFormat === "webp") {
    return "image/webp";
  }

  return "image/png";
}

export async function runPdfjsBenchmark(
  backend: PdfjsCanvasBackend,
  inputPath: string,
  options: BenchOptions,
): Promise<BenchRunResult> {
  backend.installGlobals();

  const pdfBytes = new Uint8Array(await readFile(inputPath));
  const totalStart = performance.now();
  const documentOptions = {
    data: pdfBytes,
    disableWorker: true,
    useSystemFonts: true,
    isEvalSupported: false,
    useWorkerFetch: false,
  } as Parameters<typeof getDocument>[0];
  const loadingTask = getDocument(documentOptions) as PdfLoadingTask;
  const document = await loadingTask.promise;
  const pages = resolvePageSelection(document.numPages, options.pages);
  const scale = options.dpi / 72;
  let rasterMs = 0;
  let encodeMs = 0;
  let outputBytes = 0;
  const pageResults: BenchRunResult["pages"] = [];

  try {
    for (const pageIndex of pages) {
      const pageStart = performance.now();
      const page = await document.getPage(pageIndex + 1);
      const viewport = page.getViewport({ scale });
      const width = Math.max(1, Math.ceil(viewport.width));
      const height = Math.max(1, Math.ceil(viewport.height));
      const canvas = backend.createCanvas(width, height);
      const context = canvas.getContext("2d");
      const rasterStart = performance.now();
      const renderTask = page.render({
        canvasContext: context,
        viewport,
        background: "#ffffff",
      });

      await renderTask.promise;

      const pageRasterMs = performance.now() - rasterStart;
      const encodeStart = performance.now();
      const output = encodeCanvas(canvas, options.outputFormat);
      const pageEncodeMs = performance.now() - encodeStart;
      const pageTotalMs = performance.now() - pageStart;

      rasterMs += pageRasterMs;
      encodeMs += pageEncodeMs;
      outputBytes += output.byteLength;
      pageResults.push({
        pageIndex,
        width,
        height,
        rasterMs: pageRasterMs,
        encodeMs: pageEncodeMs,
        totalMs: pageTotalMs,
        outputBytes: output.byteLength,
      });
      page.cleanup();
    }
  } finally {
    document.cleanup();
    await document.destroy();
    await loadingTask.destroy();
  }

  const totalMs = performance.now() - totalStart;

  return {
    library: "pdfjs-dist",
    backend: backend.name,
    pageCount: pageResults.length,
    dpi: options.dpi,
    mimeType: resolveMimeType(options.outputFormat),
    rasterMs,
    encodeMs,
    totalMs,
    outputBytes,
    msPerPage: pageResults.length > 0 ? totalMs / pageResults.length : 0,
    outputBytesPerPage:
      pageResults.length > 0 ? outputBytes / pageResults.length : 0,
    concurrency: 1,
    pagesPerSecond: totalMs > 0 ? pageResults.length / (totalMs / 1000) : 0,
    pages: pageResults,
  };
}
