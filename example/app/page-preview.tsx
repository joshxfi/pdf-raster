"use client";

import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import Image from "next/image";
import type { ReactElement } from "react";
import { useEffect, useRef } from "react";

import { pageFileName } from "@/app/lib/download";

type PreviewPage = {
  pageIndex: number;
  width: number;
  height: number;
  dpi: number;
  src: string;
};

type PagePreviewProps = {
  pages: PreviewPage[];
  /** Position in `pages` of the page to show, or null when closed. */
  index: number | null;
  base: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

const iconButton =
  "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30";

/** Full-size view of one rendered page, with arrow-key navigation. */
export function PagePreview({
  pages,
  index,
  base,
  onIndexChange,
  onClose,
}: PagePreviewProps): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const page = index === null ? null : pages[index];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (page && !dialog.open) dialog.showModal();
    if (!page && dialog.open) dialog.close();
  }, [page]);

  const hasPrevious = index !== null && index > 0;
  const hasNext = index !== null && index < pages.length - 1;

  return (
    <dialog
      ref={dialogRef}
      aria-label={page ? `Page ${page.pageIndex + 1}` : "Page preview"}
      onClose={onClose}
      onKeyDown={(event) => {
        if (index === null) return;
        if (event.key === "ArrowLeft" && hasPrevious) onIndexChange(index - 1);
        if (event.key === "ArrowRight" && hasNext) onIndexChange(index + 1);
      }}
      onClick={(event) => {
        // Close on any click outside the image and the toolbar.
        const target = event.target as HTMLElement;
        if (!target.closest("img, [data-preview-toolbar]")) onClose();
      }}
      className="m-0 h-dvh max-h-none w-dvw max-w-none bg-transparent p-0 text-foreground backdrop:bg-black/75"
    >
      {page ? (
        <div className="flex h-full flex-col">
          <div
            data-preview-toolbar
            className="flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-2"
          >
            <div className="flex min-w-0 items-baseline gap-3">
              <span className="text-sm font-medium">
                Page {page.pageIndex + 1}
              </span>
              <span className="truncate font-mono text-xs text-muted-foreground">
                {index !== null ? `${index + 1} of ${pages.length} · ` : ""}
                {page.width} × {page.height} · {page.dpi} dpi
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous page"
                className={iconButton}
                disabled={!hasPrevious}
                onClick={() => index !== null && onIndexChange(index - 1)}
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Next page"
                className={iconButton}
                disabled={!hasNext}
                onClick={() => index !== null && onIndexChange(index + 1)}
              >
                <ChevronRight className="size-4" />
              </button>
              <a
                href={page.src}
                download={pageFileName(base, page.pageIndex, pages)}
                className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Download className="size-4" />
                Download
              </a>
              <button
                type="button"
                aria-label="Close preview"
                className={iconButton}
                onClick={onClose}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            <Image
              alt={`Page ${page.pageIndex + 1} rendered by pdf-raster`}
              className="h-auto max-h-full w-auto max-w-full border border-border bg-white object-contain"
              height={page.height}
              src={page.src}
              unoptimized
              width={page.width}
            />
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
