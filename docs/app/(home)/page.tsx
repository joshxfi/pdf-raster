import Link from "next/link";

import { benchmarkSummary } from "@/lib/benchmark";

const valuePanels = [
  {
    kicker: "Native",
    title: "Rust + PDFium under a small JS API",
    body: "Use one server-side package surface while keeping rendering native and fast.",
  },
  {
    kicker: "Formats",
    title: "PNG by default, JPEG and WebP when needed",
    body: "Choose the output format that fits preview delivery, storage, or downstream image transport.",
  },
  {
    kicker: "Usage",
    title: "Built for backend document workflows",
    body: "Use it in route handlers, batch jobs, queues, OCR pipelines, preview services, or multimodal ingestion.",
  },
];

export default function HomePage() {
  return (
    <main className="docs-lab-grid mx-auto flex w-full max-w-7xl flex-1 px-4 py-10 md:px-6 md:py-14">
      <div className="relative z-10 grid w-full gap-5 xl:grid-cols-[minmax(0,1.2fr)_380px]">
        <section className="docs-lab-shell rounded-[2rem] p-6 md:p-8">
          <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <p className="docs-lab-kicker">Native PDF rasterization</p>
                <h1 className="max-w-4xl text-4xl leading-[1.08] font-semibold tracking-[-0.08em] text-fd-foreground md:text-6xl md:leading-[1.02]">
                  PDF Raster
                </h1>
                <p className="max-w-2xl text-base leading-7 text-fd-muted-foreground md:text-lg">
                  pdf-raster is a native PDF-to-images library for Node.js and
                  Bun. It turns PDFs into encoded page images through a small
                  server-side API for backend and document workflows.
                </p>
              </div>

              <div className="docs-lab-stat min-w-[180px] rounded-3xl p-4">
                <p className="docs-lab-label">Current sample run</p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.08em] text-fd-foreground">
                  {benchmarkSummary.speedupRange}
                </p>
                <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">
                  Faster than `pdfjs-dist` canvas backends on 300 DPI letter
                  pages (AMD Ryzen 7 7800X3D).
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/docs"
                className="inline-flex items-center rounded-full border border-[var(--docs-lab-accent)] bg-[var(--docs-lab-accent)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
              >
                Documentation
              </Link>
              <Link
                href="/docs/benchmark"
                className="inline-flex items-center rounded-full border border-fd-border bg-fd-card px-5 py-2.5 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
              >
                View benchmark
              </Link>
              <Link
                href="https://github.com/joshxfi/pdf-raster"
                className="inline-flex items-center rounded-full border border-fd-border bg-transparent px-5 py-2.5 text-sm font-medium text-fd-muted-foreground transition-colors hover:border-fd-foreground hover:text-fd-foreground"
              >
                GitHub repo
              </Link>
            </div>

            <div className="docs-lab-rule" />

            <div className="grid gap-4 lg:grid-cols-3">
              {valuePanels.map((panel) => (
                <article
                  key={panel.title}
                  className="docs-lab-stat rounded-[1.6rem] p-5"
                >
                  <p className="docs-lab-label">{panel.kicker}</p>
                  <h2 className="mt-3 text-xl font-semibold tracking-[-0.05em] text-fd-foreground">
                    {panel.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-fd-muted-foreground">
                    {panel.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <aside className="grid gap-5">
          <section className="docs-lab-shell rounded-[2rem] p-6">
            <div className="space-y-5">
              <div>
                <p className="docs-lab-label">Benchmark snapshot</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.06em] text-fd-foreground">
                  Local results from the included fixture PDFs.
                </h2>
              </div>

              <div className="grid gap-3">
                {benchmarkSummary.metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="docs-lab-stat rounded-[1.4rem] p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="docs-lab-label">{metric.label}</p>
                      <span className="text-sm font-medium text-[var(--docs-lab-accent)]">
                        {metric.ours}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-fd-muted-foreground">
                      <div className="flex items-center justify-between gap-4">
                        <span>pdf-raster</span>
                        <span className="font-medium text-fd-foreground">
                          {metric.ours}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span>pdfjs-dist + @napi-rs/canvas</span>
                        <span>{metric.napi}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span>pdfjs-dist + node-canvas</span>
                        <span>{metric.nodeCanvas}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-sm leading-6 text-fd-muted-foreground">
                These are sample local results from the same benchmark output
                shown in the README. Use the full benchmark page for the command
                shape, caveats, and raw output.
              </p>

              <Link
                href="/docs/benchmark"
                className="inline-flex items-center rounded-full border border-fd-border px-4 py-2 text-sm font-medium text-fd-foreground transition-colors hover:border-[var(--docs-lab-accent)] hover:bg-[color:var(--docs-lab-accent-soft)]"
              >
                Read benchmark details
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
