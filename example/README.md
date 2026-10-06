# pdf-raster example

A Next.js app that uploads a PDF, renders the selected pages to PNG with
pdf-raster in a route handler, and shows each page with its size and the
conversion timings. It uses the local `core/` workspace package, so it runs
whatever you last built.

## Run it

From the repository root:

```bash
bun install
bun run pdfium:download
bun run --filter pdf-raster build
bun run --cwd example dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Files

| File | What it does |
| :--- | :----------- |
| `app/api/convert/route.ts` | Validates the upload, calls `convert()` and returns each page as a PNG data URL with timings |
| `app/workbench.tsx` | The upload form, DPI control and page previews |
| `app/lib/demo-config.ts` | DPI choices, the 6-page limit and page-number parsing |
| `next.config.js` | Lists `pdf-raster` in `serverExternalPackages` so Next.js does not bundle the native addon |

The page numbers you type start at 1. The app converts them to the zero-based
indices that `convert()` expects.

To test the published npm package instead of the local build, use the
`consumer/` app.
