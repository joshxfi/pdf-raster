# pdf-raster

## 0.2.0

### Minor Changes

- 2fdd749: Publish prebuilt binaries for Linux musl (Alpine) on x64 and arm64, as `pdf-raster-linux-x64-musl` and `pdf-raster-linux-arm64-musl`. The loader picks the musl package on musl systems instead of throwing.
- c0bb036: Add an opt-in `maxPixels` option to bound per-page render size, and reject pages that would render wider or taller than 65535 px instead of silently clamping them.
- a90331d: Require Node.js 24 or newer (`engines.node` is now `>=24`). Node.js 18 and 20 are end-of-life and only Node.js 24 is tested.

### Patch Changes

- b4127c9: Encode JPEG output roughly 2x faster using the `jpeg-encoder` crate, keeping the same quality (75) and 4:4:4 chroma sampling.
- b948d31: Fix a hang when the first `convert()` calls in a process run concurrently.
- d702d66: Encode rendered pages in parallel and release the PDFium lock before encoding finishes, improving multi-page and concurrent conversion throughput. Output is byte-identical.
- d973b58: Pin the bundled PDFium build to chromium/8076 and verify its checksum during builds.
