# pdf-raster

[![NPM Version](https://img.shields.io/npm/v/pdf-raster)](https://www.npmjs.com/package/pdf-raster)
[![License](https://img.shields.io/github/license/joshxfi/pdf-raster)](https://github.com/joshxfi/pdf-raster/blob/main/LICENSE)
[![Bun](https://img.shields.io/badge/Bun-%23282a36.svg?logo=bun&logoColor=white)](https://bun.sh)

Render PDF pages to PNG, JPEG or WebP buffers in Node.js and Bun.

pdf-raster runs PDFium, the PDF engine from Chromium, inside a native addon
written in Rust with napi-rs. One function, `convert()`, takes a file path or
PDF bytes and returns one encoded image per page. In the repository benchmark
it renders a 300 DPI letter page in about 10 ms on an Apple M4, 12.7 to 17.6
times faster than pdfjs-dist with `@napi-rs/canvas`.

[Documentation](https://pdf-raster.omsimos.com) ·
[Quickstart](https://pdf-raster.omsimos.com/docs/quickstart) ·
[npm](https://www.npmjs.com/package/pdf-raster)

## Install

```bash
npm install pdf-raster
# or
pnpm add pdf-raster
# or
bun add pdf-raster
```

pdf-raster needs Node.js 24 or newer, or Bun. Prebuilt binaries cover macOS,
Linux with glibc and Windows, on x64 and arm64. Each platform package includes
its own PDFium library, so there is nothing else to install.

## Usage

```ts
import { writeFile } from "node:fs/promises";
import { convert } from "pdf-raster";

const pages = await convert("./report.pdf", {
  pages: [0, 1], // zero-based
  dpi: 300,
  outputFormat: "webp",
});

for (const page of pages) {
  console.log(page.pageIndex, page.mimeType, page.width, page.height);
  await writeFile(`page-${page.pageIndex + 1}.webp`, page.data);
}
```

## API

### `convert(input, options?)`

`input` is a file path, `Buffer`, `Uint8Array` or `ArrayBuffer`.

| Option              | Type                        | Default     | Description |
| :------------------ | :-------------------------- | :---------- | :---------- |
| `pages`             | `number[]`                  | every page  | Zero-based page indices. The result follows this order. |
| `dpi`               | `number`                    | `300`       | Render resolution. |
| `outputFormat`      | `"png" \| "jpeg" \| "webp"` | `"png"`     | PNG and WebP are lossless. JPEG uses quality 75. |
| `password`          | `string`                    |             | Password for an encrypted PDF. |
| `crop`              | `{ x, y, width, height }`   |             | Rectangle to keep, in pixels of the rendered page. |
| `renderAnnotations` | `boolean`                   | `true`      | Draw annotations and form field values. |
| `maxPixels`         | `number`                    | no limit    | Largest allowed width × height per page. Larger pages throw `INVALID_OPTIONS`. |

It resolves to one `ConvertedPage` per page:

```ts
type ConvertedPage = {
  pageIndex: number;
  data: Buffer; // the encoded image
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  width: number;
  height: number;
  dpi: number;
};
```

On failure it rejects with a `PdfToImagesError`. Its `code` is one of
`INVALID_INPUT`, `INVALID_OPTIONS`, `INVALID_PAGE_INDEX`, `INVALID_CROP`,
`PASSWORD_ERROR`, `MALFORMED_PDF`, `PDFIUM_UNAVAILABLE` or `RENDER_ERROR`. The
[API reference](https://pdf-raster.omsimos.com/docs/api-reference) describes
each one.

## Performance

Measured on an Apple M4 (4 performance and 6 efficiency cores, 24 GB), macOS
27, Bun 1.4.2, rendering at 300 DPI (2550 × 3300 pixels per page) to PNG, one conversion at a time.
`bun run --cwd benchmark fixtures` generates both PDFs. `text-20.pdf` has 20
letter pages of text, and `mixed-10.pdf` has 10 letter pages that alternate
between text and a 1200 × 900 image.

| Library                      | text-20, ms/page | mixed-10, ms/page | Total time vs pdf-raster |
| :--------------------------- | ---------------: | ----------------: | :----------------------- |
| pdf-raster                   | 10.08            | 17.13             |                          |
| pdfjs-dist + @napi-rs/canvas | 176.93           | 218.30            | 17.6x / 12.7x slower     |
| pdfjs-dist + node-canvas     | 256.88           | 299.05            | 25.5x / 17.5x slower     |

pdf-raster throughput on `text-20.pdf`, in pages per second:

| Format | 1 call at a time | 4 calls at once |
| :----- | ---------------: | --------------: |
| PNG    | 97.4             | 105.8           |
| JPEG   | 59.7             | 67.4            |
| WebP   | 96.1             | 102.3           |

> [!NOTE]
> pdf-raster compresses PNGs with a fast setting, so its PNG files are about
> 2.5 times larger than the ones pdfjs-dist writes (58.9 MB against 23.4 MB for
> the 20 pages of `text-20.pdf`). For smaller files, use WebP, which is also
> lossless and encodes almost as fast. It averaged 0.94 MB per text page against
> 2.9 MB for PNG and 1.2 MB for JPEG. On the image-heavy PDF, JPEG was the
> smallest at 1.1 MB per page against 2.3 MB for WebP.

Compared with the published 0.1.0 on the same machine, 0.2.0 raised
throughput on `text-20.pdf` from 28.3 to 97.4 pages per second for PNG, 14.1
to 59.7 for JPEG and 36.8 to 96.1 for WebP.
JPEG moved to a faster encoder, and pages now encode in parallel outside the
PDFium lock.

Results depend on your hardware and your PDFs. Run `bun run benchmark` in this
repository to measure your own.

## Running on a server

pdf-raster loads native code, so it runs only in server code. It does not work
in browsers, React Client Components, Edge runtimes or WebAssembly.

- Concurrent `convert()` calls are safe. PDFium is not thread-safe, so pages
  render one at a time behind a process-wide lock. Encoding runs outside the
  lock on up to 4 threads per call.
- The process holds at most 8 rendered pages in memory at once, about 270 MB
  at 300 DPI on letter paper.
- If clients can choose the DPI, set `maxPixels` so oversized pages fail
  before pdf-raster allocates memory for them.
- In Next.js, add `serverExternalPackages: ["pdf-raster"]` to `next.config.*`
  and use the Node.js runtime. See the
  [runtime guide](https://pdf-raster.omsimos.com/docs/runtime-and-environment).

## Development

This repository is a Bun and Turborepo monorepo. You need Bun 1.4.2 (pinned
in `packageManager`), stable Rust and Node.js 24 or newer.

```bash
bun install
bun run pdfium:download   # download PDFium into the local cache
bun run build
bun run test
bun run benchmark
```

| Directory    | Contents |
| :----------- | :------- |
| `core/`      | The published `pdf-raster` package |
| `docs/`      | The documentation site |
| `benchmark/` | Comparisons against pdfjs-dist |
| `example/`   | A demo app that uses the local workspace package |
| `consumer/`  | A minimal Next.js app that installs pdf-raster from npm |

[Local development](https://pdf-raster.omsimos.com/docs/local-development)
covers environment variables and the release process.

## License

MIT
