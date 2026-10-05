import { existsSync, statSync } from "node:fs";
import { parseArgs } from "node:util";

import { getDefaultBenchmarkInputs, runPdfiumBenchmark } from "./pdfium";
import { PDFJS_NAPI_BACKEND, runPdfjsNapiBenchmark } from "./pdfjs-napi";
import {
  PDFJS_NODE_CANVAS_BACKEND,
  runPdfjsNodeCanvasBenchmark,
} from "./pdfjs-node-canvas";
import { createReport, printHumanReport, summarizeRuns } from "./report";
import type {
  BenchLibrary,
  BenchOptions,
  BenchRunResult,
  BenchSummary,
  FileBenchmarkReport,
} from "./types";

function printHelp(): void {
  console.log(`Usage: bun run benchmark [pdf-path ...] [options]

Options:
  --dpi <number>          Render DPI (default: 300)
  --output <format>       Output format: png | jpeg | webp (default: png)
  --pages <list>          Comma-separated zero-based page indices
  --warmups <number>      Warmup runs before measuring (default: 1)
  --runs <number>         Measured runs per library (default: 5)
  --libs <list>           Comma-separated libraries: pdf-raster,pdfjs-napi,pdfjs-node-canvas
                          (default: all)
  --concurrency <number>  Simultaneous convert() calls per measured run, pdf-raster
                          only (default: 1)
  --json                  Print JSON report instead of the table output
  --help                  Show this help message
`);
}

function parsePages(value: string | undefined): number[] | undefined {
  if (!value) {
    return undefined;
  }

  const pages = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => Number(entry));

  if (
    pages.length === 0 ||
    pages.some((page) => !Number.isInteger(page) || page < 0)
  ) {
    throw new Error(
      "Expected --pages to be a comma-separated list of zero-based page indices.",
    );
  }

  return pages;
}

const ALL_LIBS: BenchLibrary[] = [
  "pdf-raster",
  "pdfjs-napi",
  "pdfjs-node-canvas",
];

function parseLibs(value: string | undefined): BenchLibrary[] {
  if (!value) {
    return ALL_LIBS;
  }

  const libs = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (
    libs.length === 0 ||
    libs.some((lib) => !ALL_LIBS.includes(lib as BenchLibrary))
  ) {
    throw new Error(`Expected --libs to be a subset of ${ALL_LIBS.join(",")}.`);
  }

  return [...new Set(libs)] as BenchLibrary[];
}

function parseOptions(argv: string[]): BenchOptions {
  const sanitizedArgs = argv.filter((argument) => argument !== "--");
  const { values, positionals } = parseArgs({
    args: sanitizedArgs,
    allowPositionals: true,
    options: {
      dpi: {
        type: "string",
      },
      output: {
        type: "string",
      },
      pages: {
        type: "string",
      },
      warmups: {
        type: "string",
      },
      runs: {
        type: "string",
      },
      libs: {
        type: "string",
      },
      concurrency: {
        type: "string",
      },
      json: {
        type: "boolean",
      },
      help: {
        type: "boolean",
      },
    },
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  const dpi = values.dpi ? Number(values.dpi) : 300;
  const warmups = values.warmups ? Number(values.warmups) : 1;
  const runs = values.runs ? Number(values.runs) : 5;
  const concurrency = values.concurrency ? Number(values.concurrency) : 1;
  const output = (values.output ?? "png") as BenchOptions["outputFormat"];

  if (!Number.isInteger(dpi) || dpi <= 0) {
    throw new Error("Expected --dpi to be a positive integer.");
  }

  if (!Number.isInteger(warmups) || warmups < 0) {
    throw new Error("Expected --warmups to be a non-negative integer.");
  }

  if (!Number.isInteger(runs) || runs <= 0) {
    throw new Error("Expected --runs to be a positive integer.");
  }

  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("Expected --concurrency to be an integer >= 1.");
  }

  if (output !== "png" && output !== "jpeg" && output !== "webp") {
    throw new Error("Expected --output to be one of png, jpeg, or webp.");
  }

  const libs = parseLibs(values.libs);
  if (
    concurrency > 1 &&
    libs.some((lib) => lib === "pdfjs-napi" || lib === "pdfjs-node-canvas")
  ) {
    console.warn(
      "Warning: --concurrency applies only to pdf-raster; pdf.js backends run at concurrency 1.",
    );
  }

  const inputs =
    positionals.length > 0 ? positionals : getDefaultBenchmarkInputs();
  if (inputs.length === 0) {
    throw new Error("No benchmark input PDFs were found.");
  }

  for (const inputPath of inputs) {
    if (!existsSync(inputPath)) {
      throw new Error(`Benchmark input does not exist: ${inputPath}`);
    }
  }

  return {
    inputs,
    dpi,
    outputFormat: output,
    pages: parsePages(values.pages),
    warmups,
    runs,
    json: values.json ?? false,
    libs,
    concurrency,
  };
}

async function measureLibrary(
  run: (inputPath: string, options: BenchOptions) => Promise<BenchRunResult>,
  inputPath: string,
  options: BenchOptions,
): Promise<BenchRunResult[]> {
  for (let index = 0; index < options.warmups; index += 1) {
    await run(inputPath, options);
  }

  const results: BenchRunResult[] = [];
  for (let index = 0; index < options.runs; index += 1) {
    results.push(await run(inputPath, options));
  }

  return results;
}

async function benchmarkFile(
  inputPath: string,
  options: BenchOptions,
): Promise<FileBenchmarkReport> {
  const inputBytes = statSync(inputPath).size;
  const summaries: BenchSummary[] = [];

  if (options.libs.includes("pdf-raster")) {
    summaries.push(
      summarizeRuns(
        await measureLibrary(runPdfiumBenchmark, inputPath, options),
      ),
    );
  }

  // pdf.js backends always run at concurrency 1.
  const pdfjsOptions: BenchOptions = { ...options, concurrency: 1 };

  if (options.libs.includes("pdfjs-napi")) {
    summaries.push(
      summarizeRuns(
        await measureLibrary(runPdfjsNapiBenchmark, inputPath, pdfjsOptions),
      ),
    );
  }

  if (options.libs.includes("pdfjs-node-canvas")) {
    summaries.push(
      summarizeRuns(
        await measureLibrary(
          runPdfjsNodeCanvasBenchmark,
          inputPath,
          pdfjsOptions,
        ),
      ),
    );
  }

  return {
    inputPath,
    inputBytes,
    settings: {
      dpi: options.dpi,
      outputFormat: options.outputFormat,
      pages: options.pages,
      warmups: options.warmups,
      runs: options.runs,
      libs: options.libs,
      concurrency: options.concurrency,
    },
    summaries,
  };
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const files: FileBenchmarkReport[] = [];

  for (const inputPath of options.inputs) {
    files.push(await benchmarkFile(inputPath, options));
  }

  const pdfjsBackends: string[] = [];
  if (options.libs.includes("pdfjs-napi")) {
    pdfjsBackends.push(PDFJS_NAPI_BACKEND);
  }
  if (options.libs.includes("pdfjs-node-canvas")) {
    pdfjsBackends.push(PDFJS_NODE_CANVAS_BACKEND);
  }

  const report = createReport(files, pdfjsBackends);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  printHumanReport(report);
}

await main();
