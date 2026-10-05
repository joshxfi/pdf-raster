import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..");
const moduleUrl = pathToFileURL(join(packageRoot, "dist", "index.js")).href;
const single = join(here, "fixtures", "single-page.pdf");
const multi = join(here, "fixtures", "multi-page.pdf");

const { convert } = await import(moduleUrl);

const watchdog = setTimeout(() => {
  console.error(
    "concurrent first convert() calls did not settle within 30s (PDFium init deadlock)",
  );
  process.exit(1);
}, 30_000);

const results = await Promise.all(
  Array.from({ length: 8 }, (_, i) =>
    convert(i % 2 ? multi : single, { dpi: 72 }),
  ),
);
clearTimeout(watchdog);

assert.equal(results.length, 8);
for (const pages of results) {
  assert.ok(pages.length > 0, "expected non-empty page results");
}

console.log("concurrent init ok");
