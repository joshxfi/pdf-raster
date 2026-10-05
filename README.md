# pdf-raster

[![NPM Version](https://img.shields.io/npm/v/pdf-raster)](https://www.npmjs.com/package/pdf-raster)
[![License](https://img.shields.io/github/license/joshxfi/pdf-raster)](https://github.com/joshxfi/pdf-raster/blob/main/LICENSE)
[![Bun](https://img.shields.io/badge/Bun-%23282a36.svg?logo=bun&logoColor=white)](https://bun.sh)

**Blazing fast, native PDF-to-image conversion for Node.js and Bun.**

`pdf-raster` renders PDF pages into high-quality image buffers using a
high-performance Rust engine. Built with `napi-rs` and `PDFium`, it is
optimized for server-side workflows like OCR pipelines, VLM (Vision Language
Model) inputs, and document previews.

[**Explore Documentation**](https://pdf-raster.omsimos.com/)

---

## ✨ Why pdf-raster?

- 🚀 **High Performance:** 4x–8x faster than `pdfjs-dist` canvas-based implementations in the included local benchmark run.
- 🦀 **Native Power:** Leverages Rust and PDFium for industry-standard rendering.
- 🛠️ **Simple API:** A single `convert()` function handles everything.
- 📦 **Memory Efficient:** Supports `Buffer` inputs for processing without temp files.
- 🎨 **Flexible Output:** Native support for `png`, `jpeg`, and `webp`.

## 📦 Install

```bash
# Using Bun
bun add pdf-raster

# Using PNPM
pnpm add pdf-raster

# Using NPM
npm install pdf-raster
```

## 📖 Quick Usage

```ts
import { convert } from "pdf-raster";
import { writeFile } from "node:fs/promises";

// Convert specific pages to high-quality WebP
const [page] = await convert("./report.pdf", {
  pages: [0], // 0-indexed page numbers
  dpi: 300, // Higher DPI is useful for OCR and VLM inputs
  outputFormat: "webp",
});

console.log(`Rendered page ${page.pageIndex} (${page.width}x${page.height})`);

// page.data is a Buffer of the encoded image
await writeFile("output.webp", page.data);
```

## 🛠 API Reference

### `convert(input, options?)`

#### `input`

- **Type:** `string | Buffer | Uint8Array | ArrayBuffer`
- **Description:** A file path to a PDF or an in-memory PDF byte source.

#### `options` (Optional)

| Option              | Type                        | Default | Description                                         |
| :------------------ | :-------------------------- | :------ | :-------------------------------------------------- |
| `pages`             | `number[]`                  | `all`   | Specific pages to render, using 0-indexed values.   |
| `dpi`               | `number`                    | `300`   | Resolution of the output image.                     |
| `outputFormat`      | `"png" \| "jpeg" \| "webp"` | `"png"` | Encoding format for the returned buffers.           |
| `password`          | `string`                    | `-`     | Password for encrypted PDFs.                        |
| `crop`              | `{ x, y, width, height }`   | `-`     | Crop rectangle in rendered image pixel coordinates. |
| `renderAnnotations` | `boolean`                   | `true`  | Whether to render annotations and form data.        |
| `maxPixels`         | `number`                    | `-`     | Optional upper bound on width × height per rendered page; larger renders throw `INVALID_OPTIONS`. Recommended for servers that accept a DPI from clients. |

#### Return Value: `Promise<ConvertedPage[]>`

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

## ⚡ Performance Benchmark

Tested on **Apple Silicon (M4)**. Results represent a local benchmark run
against the included fixture PDFs at `300 DPI`.

| Library                      | Avg/Page    | Relative Speed         |
| :--------------------------- | :---------- | :--------------------- |
| **pdf-raster**               | **0.86 ms** | **Baseline (Fastest)** |
| pdfjs-dist + @napi-rs/canvas | 5.98 ms     | ~6.9x slower           |
| pdfjs-dist + node-canvas     | 7.19 ms     | ~8.4x slower           |

> [!NOTE]
> Benchmark results are based on the included local fixtures. Performance will
> vary with PDF complexity and hardware. Run `bun run benchmark` on your own
> machine to compare against your environment.

## 🌍 Runtime & Platform Support

This package uses native bindings and is intended for **server-side environments only**.

| Runtime           | Supported |
| :---------------- | :-------- |
| **Node.js**       | ✅ Yes    |
| **Bun**           | ✅ Yes    |
| **Browser**       | ❌ No     |
| **Edge Runtimes** | ❌ No     |

**Supported Architectures:**

- **OS:** Linux (gnu), macOS, Windows
- **Arch:** x64, arm64

> [!CAUTION]
> Do not import this into browser bundles, React Client Components, or Vercel Edge Functions.

## 🛠 Local Development

This repository is a Bun + Turborepo monorepo.

1. **Setup:** `bun install`
2. **Native Binaries:** `bun run pdfium:download`
3. **Build:** `bun run build`
4. **Test:** `bun run test`
5. **Benchmark:** `bun run benchmark`

### Workspace layout

- `core/` - the published `pdf-raster` package
- `example/` - the polished internal demo app using the local workspace package
- `consumer/` - a minimal Next.js app for validating the published npm package
- `docs/` - the hosted documentation source
- `benchmark/` - internal performance comparisons against `pdfjs-dist`

## 📄 License

MIT
