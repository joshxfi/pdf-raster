import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { generateFixtures } from "./fixtures";
import type { BenchOptions, BenchRunResult } from "./types";

type PdfToImagesModule = typeof import("pdf-raster");

const runtimeImport = new Function("specifier", "return import(specifier)") as <
  T,
>(
  specifier: string,
) => Promise<T>;

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const coreRoot = resolve(repoRoot, "core");

function getNativeBinaryName(): string {
  if (process.platform === "darwin" && process.arch === "arm64") {
    return "pdf-raster.darwin-arm64.node";
  }

  if (process.platform === "darwin" && process.arch === "x64") {
    return "pdf-raster.darwin-x64.node";
  }

  if (process.platform === "linux" && process.arch === "arm64") {
    return "pdf-raster.linux-arm64-gnu.node";
  }

  if (process.platform === "linux" && process.arch === "x64") {
    return "pdf-raster.linux-x64-gnu.node";
  }

  if (process.platform === "win32" && process.arch === "arm64") {
    return "pdf-raster.win32-arm64-msvc.node";
  }

  if (process.platform === "win32" && process.arch === "x64") {
    return "pdf-raster.win32-x64-msvc.node";
  }

  throw new Error(
    `Benchmark CLI does not support ${process.platform}/${process.arch}.`,
  );
}

function getBundledPdfiumName(): string {
  if (process.platform === "darwin") {
    return "libpdfium.dylib";
  }

  if (process.platform === "win32") {
    return "pdfium.dll";
  }

  return "libpdfium.so";
}

async function ensureCoreBuilt(): Promise<void> {
  const distEntry = resolve(coreRoot, "dist", "index.js");
  const nativeBinary = resolve(coreRoot, getNativeBinaryName());
  const bundledPdfium = resolve(coreRoot, getBundledPdfiumName());

  if (
    existsSync(distEntry) &&
    existsSync(nativeBinary) &&
    existsSync(bundledPdfium)
  ) {
    return;
  }

  const exitCode = await new Promise<number>((resolvePromise, reject) => {
    const child = spawn("bun", ["run", "build"], {
      cwd: coreRoot,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => resolvePromise(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new Error(
      `Failed to build core before benchmarking (exit ${exitCode}).`,
    );
  }
}

async function loadPdfToImages(): Promise<PdfToImagesModule> {
  await ensureCoreBuilt();
  return runtimeImport<PdfToImagesModule>("pdf-raster");
}

function getMimeType(outputFormat: BenchOptions["outputFormat"]): string {
  if (outputFormat === "jpeg") {
    return "image/jpeg";
  }

  if (outputFormat === "webp") {
    return "image/webp";
  }

  return "image/png";
}

export function getDefaultBenchmarkInputs(): string[] {
  return generateFixtures(resolve(here, ".fixtures"));
}

export async function runPdfiumBenchmark(
  inputPath: string,
  options: BenchOptions,
): Promise<BenchRunResult> {
  const { convert } = await loadPdfToImages();
  const concurrency = options.concurrency;
  const totalStart = performance.now();
  const results = await Promise.all(
    Array.from({ length: concurrency }, () =>
      convert(inputPath, {
        dpi: options.dpi,
        outputFormat: options.outputFormat,
        pages: options.pages,
      }),
    ),
  );
  const totalMs = performance.now() - totalStart;
  const pages = results[0];
  const totalPages = results.reduce(
    (total, result) => total + result.length,
    0,
  );
  const outputBytes = pages.reduce(
    (total, page) => total + page.data.byteLength,
    0,
  );

  return {
    library: "pdf-raster",
    backend: "public convert() API",
    pageCount: pages.length,
    dpi: options.dpi,
    mimeType: pages[0]?.mimeType ?? getMimeType(options.outputFormat),
    rasterMs: null,
    encodeMs: null,
    totalMs,
    outputBytes,
    msPerPage: pages.length > 0 ? totalMs / pages.length : 0,
    outputBytesPerPage: pages.length > 0 ? outputBytes / pages.length : 0,
    concurrency,
    pagesPerSecond: totalMs > 0 ? totalPages / (totalMs / 1000) : 0,
    pages: pages.map((page) => ({
      pageIndex: page.pageIndex,
      width: page.width,
      height: page.height,
      rasterMs: null,
      encodeMs: null,
      totalMs: null,
      outputBytes: page.data.byteLength,
    })),
  };
}
