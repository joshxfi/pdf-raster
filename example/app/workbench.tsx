"use client";

import { ArrowUpRight, FileText, Upload } from "lucide-react";
import Image from "next/image";
import type { ReactElement } from "react";
import { useRef, useState, useTransition } from "react";

import {
  DEFAULT_DPI,
  DEFAULT_PAGE_INPUT,
  DPI_OPTIONS,
  MAX_SELECTED_PAGES,
  parsePageSelection,
  type SupportedDpi,
} from "@/app/lib/demo-config";
import { Logo } from "@/components/logo";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const DOCS_URL = "https://pdf-raster.omsimos.com";
const REPO_URL = "https://github.com/joshxfi/pdf-raster";

type ConvertedPreviewPage = {
  pageIndex: number;
  width: number;
  height: number;
  dpi: number;
  src: string;
};

type ConvertResponse = {
  benchmark: {
    serverMs: number;
    convertMs: number;
    pagesRendered: number;
    inputBytes: number;
    outputBytes: number;
  };
  pages: ConvertedPreviewPage[];
};

type ErrorResponse = {
  code?: string;
  message?: string;
};

function isConvertResponse(payload: unknown): payload is ConvertResponse {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "pages" in payload &&
      Array.isArray((payload as { pages?: unknown }).pages),
  );
}

function isErrorResponse(payload: unknown): payload is ErrorResponse {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof (payload as { message?: unknown }).message === "string",
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}

/** The convert() call the route makes for the current form state. */
function describeCall(pagesInput: string, dpi: SupportedDpi) {
  const parsed = parsePageSelection(pagesInput);
  const pages =
    parsed.ok && parsed.pages ? `[${parsed.pages.join(", ")}]` : null;

  return [
    "const pages = await convert(bytes, {",
    ...(pages ? [`  pages: ${pages},`] : []),
    `  dpi: ${dpi},`,
    "});",
  ].join("\n");
}

export function ConversionWorkbench(): ReactElement {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pagesInput, setPagesInput] = useState(DEFAULT_PAGE_INPUT);
  const [dpi, setDpi] = useState<SupportedDpi>(DEFAULT_DPI);
  const [results, setResults] = useState<ConvertedPreviewPage[]>([]);
  const [benchmark, setBenchmark] = useState<
    (ConvertResponse["benchmark"] & { roundTripMs: number }) | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastRunFileName, setLastRunFileName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function acceptFile(file: File | null) {
    setSelectedFile(file);
    setErrorMessage(null);
  }

  async function runConversion() {
    if (!selectedFile) {
      setErrorMessage("Choose a PDF first.");
      return;
    }

    setErrorMessage(null);
    setResults([]);
    setBenchmark(null);

    const formData = new FormData();
    formData.set("file", selectedFile);
    formData.set("pages", pagesInput);
    formData.set("dpi", String(dpi));

    const requestStart = performance.now();
    let response: Response;
    try {
      response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });
    } catch {
      setLastRunFileName(null);
      setErrorMessage("Could not reach the server.");
      return;
    }
    const clientRequestMs = performance.now() - requestStart;

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setLastRunFileName(null);
      setErrorMessage(
        isErrorResponse(payload) && payload.message
          ? payload.code
            ? `${payload.code}: ${payload.message}`
            : payload.message
          : "Conversion failed.",
      );
      return;
    }

    if (isConvertResponse(payload)) {
      setResults(payload.pages);
      setBenchmark({
        ...payload.benchmark,
        roundTripMs: clientRequestMs,
      });
    }
    setLastRunFileName(selectedFile.name);
  }

  const stats = benchmark
    ? [
        { label: "convert()", value: `${benchmark.convertMs.toFixed(0)} ms` },
        { label: "Server", value: `${benchmark.serverMs.toFixed(0)} ms` },
        {
          label: "Round trip",
          value: `${benchmark.roundTripMs.toFixed(0)} ms`,
        },
        { label: "Pages", value: String(benchmark.pagesRendered) },
        { label: "PDF", value: formatFileSize(benchmark.inputBytes) },
        { label: "PNG output", value: formatFileSize(benchmark.outputBytes) },
      ]
    : [];

  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      <header className="border-b border-border">
        <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <a
              href={DOCS_URL}
              className="inline-flex items-center gap-2 font-semibold tracking-tight"
            >
              <Logo className="size-5 text-primary" />
              pdf-raster
            </a>
            <span className="pr-eyebrow rounded-full border border-border px-2 py-0.5">
              Example
            </span>
          </div>
          <nav className="flex items-center gap-1 text-sm text-muted-foreground">
            <a
              href={`${DOCS_URL}/docs/examples-nextjs`}
              className="rounded-md px-2.5 py-1.5 transition-colors hover:bg-accent hover:text-foreground"
            >
              Docs
            </a>
            <a
              href={`${REPO_URL}/tree/main/example`}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 transition-colors hover:bg-accent hover:text-foreground"
            >
              Source
              <ArrowUpRight className="size-3.5" />
            </a>
          </nav>
        </div>
      </header>

      <div className="grid flex-1 gap-4 p-4 sm:p-6 lg:min-h-0 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-6">
        <aside className="pr-scroll flex min-h-0 flex-col gap-6 rounded-xl border border-border bg-card p-5 lg:overflow-y-auto">
          <div className="flex flex-col gap-2">
            <p className="pr-eyebrow">Next.js route handler</p>
            <h1 className="text-3xl font-semibold tracking-[-0.03em]">
              PDF to PNG
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Upload a PDF. The route passes the bytes to <code>convert()</code>{" "}
              and returns each page as a PNG data URL.
            </p>
          </div>

          <label
            htmlFor="example-pdf-upload"
            className={cn(
              "pr-dotgrid flex cursor-pointer flex-col items-center gap-3 rounded-lg border border-dashed border-border px-4 py-6 text-center transition-colors hover:border-primary/60",
              isDragging && "border-primary bg-[var(--pr-accent-soft)]",
            )}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              acceptFile(event.dataTransfer.files?.[0] ?? null);
            }}
          >
            <input
              id="example-pdf-upload"
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(event) =>
                acceptFile(event.currentTarget.files?.[0] ?? null)
              }
            />
            {selectedFile ? (
              <>
                <FileText className="size-5 text-primary" />
                <div className="min-w-0 max-w-full">
                  <p className="truncate text-sm font-medium">
                    {selectedFile.name}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {formatFileSize(selectedFile.size)} · click to replace
                  </p>
                </div>
              </>
            ) : (
              <>
                <Upload className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Drop a PDF here</p>
                  <p className="text-xs text-muted-foreground">
                    or click to browse, up to 20 MB
                  </p>
                </div>
              </>
            )}
          </label>

          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(() => {
                void runConversion();
              });
            }}
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="page-selection" className="pr-eyebrow">
                Pages
              </label>
              <Input
                id="page-selection"
                value={pagesInput}
                onChange={(event) => setPagesInput(event.target.value)}
                placeholder="All pages"
                className="h-10 rounded-md bg-background font-mono shadow-none"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                Page numbers start at 1, separated by commas, up to{" "}
                {MAX_SELECTED_PAGES}. Leave it empty to render every page.
              </p>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="pr-eyebrow mb-2">DPI</legend>
              <div className="grid grid-cols-3 rounded-md border border-border bg-background p-0.5">
                {DPI_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={option === dpi}
                    onClick={() => setDpi(option)}
                    className={cn(
                      "rounded-[5px] py-1.5 font-mono text-sm text-muted-foreground transition-colors hover:text-foreground",
                      option === dpi &&
                        "bg-card text-foreground shadow-[0_0_0_1px_var(--color-border)]",
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-col gap-2">
              <span className="pr-eyebrow">Server call</span>
              <pre className="overflow-x-auto rounded-md border border-border bg-background px-3 py-2.5 font-mono text-xs leading-5">
                {describeCall(pagesInput, dpi)}
              </pre>
            </div>

            <button
              type="submit"
              disabled={isPending || !selectedFile}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-[opacity,transform] hover:opacity-90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
            >
              {isPending ? "Converting…" : "Convert"}
            </button>
          </form>

          {errorMessage ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm leading-6 text-destructive"
            >
              {errorMessage}
            </div>
          ) : null}
        </aside>

        <section className="flex min-h-[50vh] min-w-0 flex-col gap-4 lg:min-h-0">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-[-0.02em]">
              Rendered pages
            </h2>
            <p className="max-w-[20rem] truncate font-mono text-xs text-muted-foreground">
              {lastRunFileName ?? "nothing rendered yet"}
            </p>
          </div>

          {benchmark ? (
            <dl className="grid grid-cols-3 overflow-hidden rounded-xl border border-border bg-border gap-px md:grid-cols-6">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-card px-4 py-3">
                  <dt className="pr-eyebrow normal-case tracking-normal">
                    {stat.label}
                  </dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums tracking-tight">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {results.length === 0 ? (
            <div className="pr-dotgrid grid min-h-[26rem] flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
              <div className="flex max-w-sm flex-col items-center gap-3">
                <Logo className="size-8 text-muted-foreground/60" />
                <p className="text-lg font-semibold tracking-tight">
                  {isPending ? "Rendering…" : "No pages yet"}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Choose a PDF and press Convert. Each page shows up here with
                  its size and DPI.
                </p>
              </div>
            </div>
          ) : (
            <div className="pr-scroll flex-1 overflow-y-auto lg:min-h-0">
              <div className="grid gap-4 xl:grid-cols-2">
                {results.map((page) => (
                  <figure
                    key={`${page.pageIndex}-${page.width}-${page.height}`}
                    className="overflow-hidden rounded-xl border border-border bg-card"
                  >
                    <figcaption className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                      <span className="text-sm font-medium">
                        Page {page.pageIndex + 1}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {page.width} × {page.height} · {page.dpi} dpi
                      </span>
                    </figcaption>
                    <div className="pr-dotgrid bg-muted/40 p-4">
                      <Image
                        alt={`Page ${page.pageIndex + 1} rendered by pdf-raster`}
                        className="w-full rounded-[3px] bg-[var(--pr-paper)] shadow-[0_1px_0_var(--color-border),0_16px_32px_-16px_rgb(0_0_0/0.25)] ring-1 ring-border"
                        height={page.height}
                        sizes="(max-width: 1279px) 100vw, 50vw"
                        src={page.src}
                        unoptimized
                        width={page.width}
                      />
                    </div>
                  </figure>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
