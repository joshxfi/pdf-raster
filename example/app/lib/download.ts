import { zipSync } from "fflate";

type DownloadablePage = { pageIndex: number; src: string };

/** "report.pdf" -> "report" */
export function baseName(fileName: string) {
  return fileName.replace(/\.pdf$/i, "") || "document";
}

/**
 * File name for one rendered page, numbered from 1. Numbers are zero-padded
 * to the width of the highest page number so files sort in page order.
 */
export function pageFileName(
  base: string,
  pageIndex: number,
  pages: DownloadablePage[],
) {
  const highest = Math.max(...pages.map((page) => page.pageIndex + 1));
  const number = String(pageIndex + 1).padStart(String(highest).length, "0");
  return `${base}-page-${number}.png`;
}

function dataUrlToBytes(dataUrl: string) {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Zips every page into one download. PNG is already compressed, so store only. */
export function downloadAllPages(pages: DownloadablePage[], base: string) {
  const files = Object.fromEntries(
    pages.map((page) => [
      pageFileName(base, page.pageIndex, pages),
      dataUrlToBytes(page.src),
    ]),
  );
  const zip = zipSync(files, { level: 0 });
  saveBlob(new Blob([zip], { type: "application/zip" }), `${base}-pages.zip`);
}
