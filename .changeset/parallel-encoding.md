---
"pdf-raster": patch
---

Encode rendered pages in parallel and release the PDFium lock before encoding finishes, improving multi-page and concurrent conversion throughput. Output is byte-identical.
