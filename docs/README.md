# docs

This app is the documentation site for `pdf-raster`, built with
Fumadocs and Next.js.

## Commands

```bash
bun run dev
bun run check-types
bun run build
```

The docs app runs on port `3001` in local development.

## Content layout

- `app/(home)`: landing page
- `app/docs`: documentation routes
- `app/global.css`: color tokens, fonts and landing page styles
- `components`: the benchmark chart, pipeline diagram and landing page parts
- `content/docs`: MDX content for the library
- `lib/benchmark.ts`: benchmark numbers shared by the landing page and docs
- `lib/source.ts`: Fumadocs content source loader
- `lib/layout.shared.tsx`: nav, logo and repo links

## Notes

- the app stays standalone on Fumadocs UI
- `check-types` runs Fumadocs MDX generation, Next type generation, and `tsc`
- docs content is currently focused on `pdf-raster`
