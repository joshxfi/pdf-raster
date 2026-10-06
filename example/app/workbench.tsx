"use client";

import { ArrowUpRight, FileText } from "lucide-react";
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

type RunStats = ConvertResponse["benchmark"] & { roundTripMs: number };

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

/** The convert() call the route makes for the current settings. */
function describeCall(pagesInput: string, dpi: SupportedDpi) {
  const parsed = parsePageSelection(pagesInput);
  const pages =
    parsed.ok && parsed.pages ? `pages: [${parsed.pages.join(", ")}], ` : "";
  return `convert(bytes, { ${pages}dpi: ${dpi} })`;
}

export function ConversionWorkbench(): ReactElement {
  const [file, setFile] = useState<File | null>(null);
  const [pagesInput, setPagesInput] = useState(DEFAULT_PAGE_INPUT);
  const [dpi, setDpi] = useState<SupportedDpi>(DEFAULT_DPI);
  const [pages, setPages] = useState<ConvertedPreviewPage[]>([]);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function run(target: File | null = file) {
    if (!target) {
      fileInputRef.current?.click();
      return;
    }
    startTransition(() => {
      void convertFile(target);
    });
  }

  function chooseFile(next: File | null) {
    if (!next) return;
    setFile(next);
    run(next);
  }

  async function convertFile(target: File) {
    setError(null);

    const formData = new FormData();
    formData.set("file", target);
    formData.set("pages", pagesInput);
    formData.set("dpi", String(dpi));

    const start = performance.now();
    let response: Response;
    try {
      response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });
    } catch {
      setError("Could not reach the server.");
      return;
    }
    const roundTripMs = performance.now() - start;
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setError(
        isErrorResponse(payload) && payload.message
          ? [payload.code, payload.message].filter(Boolean).join(": ")
          : "Conversion failed.",
      );
      return;
    }

    if (isConvertResponse(payload)) {
      setPages(payload.pages);
      setStats({ ...payload.benchmark, roundTripMs });
    }
  }

  return (
    // The whole page accepts a dropped PDF.
    // biome-ignore lint/a11y/noStaticElementInteractions: drop target only; the file button is the accessible control.
    <div
      className="relative flex min-h-screen flex-col"
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        chooseFile(event.dataTransfer.files?.[0] ?? null);
      }}
    >
      <header className="border-b border-border">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-4">
          <a
            href={DOCS_URL}
            className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <Logo className="size-4 text-primary" />
            pdf-raster
            <span className="font-normal text-muted-foreground">/ example</span>
          </a>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <a
              href={`${DOCS_URL}/docs/examples-nextjs`}
              className="transition-colors hover:text-foreground"
            >
              Docs
            </a>
            <a
              href={`${REPO_URL}/tree/main/example`}
              className="inline-flex items-center gap-0.5 transition-colors hover:text-foreground"
            >
              Source
              <ArrowUpRight className="size-3.5" />
            </a>
          </nav>
        </div>
      </header>

      <form
        className="sticky top-0 z-10 border-b border-border bg-background"
        onSubmit={(event) => {
          event.preventDefault();
          run();
        }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-end gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
            <span className="text-xs text-muted-foreground">PDF</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              aria-label="PDF file"
              onChange={(event) => {
                chooseFile(event.currentTarget.files?.[0] ?? null);
                event.currentTarget.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-9 min-w-0 items-center gap-2 rounded-md border border-border px-3 text-left text-sm transition-colors hover:bg-accent"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              {file ? (
                <>
                  <span className="truncate">{file.name}</span>
                  <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">
                  Choose or drop a PDF
                </span>
              )}
            </button>
          </div>

          <label className="flex w-40 flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              Pages, from 1 (max {MAX_SELECTED_PAGES})
            </span>
            <input
              value={pagesInput}
              onChange={(event) => setPagesInput(event.target.value)}
              placeholder="all"
              className="h-9 rounded-md border border-border bg-transparent px-3 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
            />
          </label>

          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-xs text-muted-foreground">DPI</legend>
            <div className="flex h-9 rounded-md border border-border">
              {DPI_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={option === dpi}
                  onClick={() => setDpi(option)}
                  className={cn(
                    "w-14 border-l border-border font-mono text-sm text-muted-foreground transition-colors first:rounded-l-md first:border-l-0 last:rounded-r-md hover:text-foreground",
                    option === dpi &&
                      "bg-foreground text-background hover:text-background",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={isPending}
            className="h-9 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Converting…" : file ? "Convert" : "Choose PDF"}
          </button>
        </div>

        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 pb-3 font-mono text-xs text-muted-foreground">
          <code>{describeCall(pagesInput, dpi)}</code>
          {error ? (
            <span role="alert" className="text-destructive">
              {error}
            </span>
          ) : stats ? (
            <span>
              {stats.pagesRendered} pages · convert(){" "}
              <span className="text-foreground">
                {stats.convertMs.toFixed(0)} ms
              </span>{" "}
              · server {stats.serverMs.toFixed(0)} ms · round trip{" "}
              {stats.roundTripMs.toFixed(0)} ms ·{" "}
              {formatFileSize(stats.inputBytes)} PDF →{" "}
              {formatFileSize(stats.outputBytes)} PNG
            </span>
          ) : null}
        </div>
      </form>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6">
        {pages.length === 0 ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex min-h-80 w-full flex-1 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <span className="font-medium text-foreground">
              {isPending ? "Converting…" : "Drop a PDF anywhere on this page"}
            </span>
            <span>
              or click to choose one. It converts as soon as it loads.
            </span>
          </button>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-4 gap-y-6">
            {pages.map((page) => (
              <li key={`${page.pageIndex}-${page.width}-${page.height}`}>
                <figure className="flex flex-col gap-2">
                  <Image
                    alt={`Page ${page.pageIndex + 1} rendered by pdf-raster`}
                    className="w-full border border-border bg-white"
                    height={page.height}
                    sizes="(max-width: 640px) 50vw, 240px"
                    src={page.src}
                    unoptimized
                    width={page.width}
                  />
                  <figcaption className="flex justify-between gap-2 text-xs">
                    <span>Page {page.pageIndex + 1}</span>
                    <span className="font-mono text-muted-foreground">
                      {page.width} × {page.height}
                    </span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        )}
      </main>

      {isDragging ? (
        <div className="pointer-events-none fixed inset-2 z-20 grid place-items-center rounded-md border-2 border-dashed border-primary bg-background/80 text-sm font-medium">
          Drop to convert
        </div>
      ) : null}
    </div>
  );
}
