# pdf-raster

[![NPM Version](https://img.shields.io/npm/v/pdf-raster)](https://www.npmjs.com/package/pdf-raster)
[![License](https://img.shields.io/github/license/joshxfi/pdf-raster)](https://github.com/joshxfi/pdf-raster/blob/main/LICENSE)
[![Bun](https://img.shields.io/badge/Bun-%23282a36.svg?logo=bun&logoColor=white)](https://bun.sh)

**Blazing fast, native PDF-to-image conversion for Node.js and Bun.**

`pdf-raster` renders PDF pages into high-quality image buffers through
a small, high-performance server-side API. Built with Rust and PDFium, it is
10.6–13.0x faster than `pdfjs-dist` + `@napi-rs/canvas` on 300 DPI letter
pages in the repository benchmark.

[**Documentation**](https://pdf-raster.omsimos.com/) | [**GitHub**](https://github.com/joshxfi/pdf-raster)

## 📦 Install

```bash
# Bun
bun add pdf-raster

# PNPM
pnpm add pdf-raster

# NPM
npm install pdf-raster
```

## 🚀 Quick Usage

```ts
import { convert } from "pdf-raster";

const [page] = await convert("./report.pdf", {
  pages: [0], // 0-indexed page numbers
  dpi: 300, // High resolution for OCR and VLM inputs
});

// page.data is the encoded image buffer (default: png)
console.log({
  pageIndex: page.pageIndex,
  mimeType: page.mimeType,
  width: page.width,
  height: page.height,
});
```

### Output Types

```ts
type ConvertedPage = {
  pageIndex: number;
  data: Buffer;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  width: number;
  height: number;
  dpi: number;
};
```

## ⚡ Performance

Measured on an **AMD Ryzen 7 7800X3D (16 threads), Linux x64**, at `300 DPI`
(2550×3300 px letter pages) to PNG, one conversion at a time:

- **pdf-raster**: 16.91 ms/page on a 20-page text PDF, 25.94 ms/page on a
  10-page PDF with embedded images
- `pdfjs-dist + @napi-rs/canvas`: 220.45 / 276.26 ms/page (`13.0x` / `10.6x` slower)
- `pdfjs-dist + node-canvas`: 328.14 ms/page on the text PDF (`19.4x` slower);
  it fails on the PDF with embedded images
- **pdf-raster throughput on the text PDF** (pages/s, 1 / 4 concurrent calls):
  PNG 59.1 / 60.8, JPEG 48.4 / 58.7, WebP 53.8 / 56.6. In 0.2.0, JPEG is up to
  ~8x faster and PNG/WebP about 2x faster than 0.1.x.

> [!NOTE]
> These are local benchmark results, not universal guarantees. Run
> `bun run benchmark` in the repository to compare on your own machine.

## 🖥️ Server usage

- Concurrent `convert()` calls are safe.
- Rendering is serialized by a process-wide lock; encoding runs in parallel.
- Peak rendered-frame memory is capped at about 8 rendered pages per process
  (about 270 MB at 300 DPI US letter).
- Set `maxPixels` when the DPI comes from clients.
- Next.js needs `serverExternalPackages: ["pdf-raster"]` in `next.config.*`.

## 🌍 Runtime Support

- **Server-side only**: Node.js 24+ and Bun.
- **Targets**: macOS (x64/arm64), Linux (x64/arm64), Windows (x64/arm64).
- **Format Support**: `png` (default, lossless), `jpeg` (lossy), `webp` (lossless).

> [!CAUTION]
> This package contains native bindings. It will **not** work in Browser bundles, React Client Components, or Edge runtimes.

## 📖 Links

- [Full Documentation](https://pdf-raster.omsimos.com/)
- [Quickstart Guide](https://pdf-raster.omsimos.com/docs/quickstart)
- [Example App](https://github.com/joshxfi/pdf-raster/tree/main/example)
