# pdf-raster

[![NPM Version](https://img.shields.io/npm/v/pdf-raster)](https://www.npmjs.com/package/pdf-raster)
[![License](https://img.shields.io/github/license/joshxfi/pdf-raster)](https://github.com/joshxfi/pdf-raster/blob/main/LICENSE)
[![Bun](https://img.shields.io/badge/Bun-%23282a36.svg?logo=bun&logoColor=white)](https://bun.sh)

Render PDF pages to PNG, JPEG or WebP buffers in Node.js and Bun.

pdf-raster runs PDFium inside a native addon written in Rust. One function,
`convert()`, takes a file path or PDF bytes and returns one encoded image per
page. In the repository benchmark on an Apple M4 it is 12.7 to 17.6 times
faster than pdfjs-dist with `@napi-rs/canvas` on 300 DPI letter pages.

[Documentation](https://pdf-raster.omsimos.com) ·
[Quickstart](https://pdf-raster.omsimos.com/docs/quickstart) ·
[GitHub](https://github.com/joshxfi/pdf-raster)

## Install

```bash
npm install pdf-raster
# or
pnpm add pdf-raster
# or
bun add pdf-raster
```

pdf-raster needs Node.js 24 or newer, or Bun. Prebuilt binaries cover macOS,
Linux (glibc and musl, including Alpine) and Windows, on x64 and arm64, and
include PDFium.

## Usage

```ts
import { convert } from "pdf-raster";

const [page] = await convert("./report.pdf", {
  pages: [0], // zero-based
  dpi: 300,
});

console.log(page.mimeType, page.width, page.height);
// image/png 2550 3300

// page.data is a Buffer with the encoded image
```

## Options

| Option              | Type                        | Default    | Description |
| :------------------ | :-------------------------- | :--------- | :---------- |
| `pages`             | `number[]`                  | every page | Zero-based page indices. The result follows this order. |
| `dpi`               | `number`                    | `300`      | Render resolution. |
| `outputFormat`      | `"png" \| "jpeg" \| "webp"` | `"png"`    | PNG and WebP are lossless. JPEG uses quality 75. |
| `password`          | `string`                    |            | Password for an encrypted PDF. |
| `crop`              | `{ x, y, width, height }`   |            | Rectangle to keep, in pixels of the rendered page. |
| `renderAnnotations` | `boolean`                   | `true`     | Draw annotations and form field values. |
| `maxPixels`         | `number`                    | no limit   | Largest allowed width × height per page. Larger pages throw `INVALID_OPTIONS`. |

Each result has `pageIndex`, `data`, `mimeType`, `width`, `height` and `dpi`.
Failures reject with a `PdfToImagesError` that carries a fixed `code`, such as
`MALFORMED_PDF` or `PASSWORD_ERROR`.

## Performance

On an Apple M4 with 24 GB, macOS 27, Bun 1.4.2, at 300 DPI to PNG, one
conversion at a time:

| Library                      | Text PDF, ms/page | PDF with images, ms/page |
| :--------------------------- | ----------------: | -----------------------: |
| pdf-raster                   | 10.08             | 17.13                    |
| pdfjs-dist + @napi-rs/canvas | 176.93            | 218.30                   |
| pdfjs-dist + node-canvas     | 256.88            | 299.05                   |

PNG output uses fast compression and is about 2.5 times larger than
pdfjs-dist's PNGs. WebP is also lossless, encodes almost as fast, and is about
a third the size of PNG on text pages. JPEG is the smallest on pages with
photos. The
[benchmark page](https://pdf-raster.omsimos.com/docs/benchmark) has the full
results.

## Server use

pdf-raster loads native code and runs only on the server. It does not work in
browsers, React Client Components, Edge runtimes or WebAssembly.

- Concurrent `convert()` calls are safe. Pages render one at a time behind a
  process-wide lock and encode in parallel outside it.
- The process holds at most 8 rendered pages in memory at once, about 270 MB
  at 300 DPI on letter paper.
- Set `maxPixels` when clients can choose the DPI.
- In Next.js, add `serverExternalPackages: ["pdf-raster"]` to `next.config.*`.

## Links

- [Documentation](https://pdf-raster.omsimos.com)
- [Examples](https://pdf-raster.omsimos.com/docs/example-patterns)
- [Example app](https://github.com/joshxfi/pdf-raster/tree/main/example)

## License

MIT
