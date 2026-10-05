---
"pdf-raster": minor
---

Add an opt-in `maxPixels` option to bound per-page render size, and reject pages that would render wider or taller than 65535 px instead of silently clamping them.
