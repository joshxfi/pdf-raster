import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BenchmarkChart } from "@/components/benchmark-chart";
import { Code } from "@/components/code";
import { InstallCommand } from "@/components/home/install-command";
import { RasterPage } from "@/components/home/raster-page";
import { Pipeline } from "@/components/pipeline";
import { benchmarkSummary } from "@/lib/benchmark";
import { npmUrl, repoUrl } from "@/lib/layout.shared";

const usageCode = `import { writeFile } from "node:fs/promises";
import { convert } from "pdf-raster";

const pages = await convert("./report.pdf", {
  pages: [0, 1],
  dpi: 300,
  outputFormat: "webp",
});

for (const page of pages) {
  await writeFile(\`page-\${page.pageIndex + 1}.webp\`, page.data);
}`;

const resultCode = `[
  {
    pageIndex: 0,
    data: <Buffer 52 49 46 46 ...>,
    mimeType: "image/webp",
    width: 2550,
    height: 3300,
    dpi: 300,
  },
  // one entry per requested page
]`;

const stats = [
  {
    value: benchmarkSummary.fastestMsPerPage,
    label: "per page at 300 DPI to PNG on a 20-page text PDF",
  },
  {
    value: benchmarkSummary.maxSpeedup,
    label: "faster than pdfjs-dist with @napi-rs/canvas on the same PDF",
  },
  {
    value: "6",
    label: "prebuilt targets, macOS, Linux and Windows on x64 and arm64",
  },
  {
    value: "8 frames",
    label: "the most raw pages held in memory at once, across all calls",
  },
];

const options = [
  ["pages", "number[]", "all pages"],
  ["dpi", "number", "300"],
  ["outputFormat", '"png" | "jpeg" | "webp"', '"png"'],
  ["password", "string", ""],
  ["crop", "{ x, y, width, height }", ""],
  ["renderAnnotations", "boolean", "true"],
  ["maxPixels", "number", "unlimited"],
];

const useCases = [
  {
    title: "OCR",
    body: "Pass page.data to Tesseract.js or any OCR engine that reads image bytes.",
    href: "/docs/examples-ocr-vlm",
  },
  {
    title: "Vision models",
    body: "Send each page to a multimodal model as an image part with the AI SDK.",
    href: "/docs/examples-ocr-vlm",
  },
  {
    title: "Upload previews",
    body: "Convert an uploaded PDF in a Next.js route handler and return page images.",
    href: "/docs/examples-nextjs",
  },
  {
    title: "Batch jobs",
    body: "Render files from disk, a queue or object storage in a worker process.",
    href: "/docs/examples-node",
  },
];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <Stats />
      <Section
        eyebrow="API"
        title="One function that returns an image per page"
        intro={
          <>
            <code>convert(input, options?)</code> takes a file path, Buffer,
            Uint8Array or ArrayBuffer. It resolves to an array with one entry
            per page, holding the encoded bytes, the MIME type and the pixel
            size.
          </>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <Code code={usageCode} title="convert.ts" />
            <Code code={resultCode} title="Resolved value" />
          </div>
          <OptionsTable />
        </div>
      </Section>

      <Section
        eyebrow="Benchmark"
        title={`${benchmarkSummary.speedupRange} faster than pdf.js on a canvas`}
        intro="The repository benchmark renders two generated letter-size PDFs at 300 DPI and compares pdf-raster with pdfjs-dist on two Node.js canvas backends."
      >
        <div className="rounded-xl border border-fd-border bg-fd-card p-5 md:p-8">
          <BenchmarkChart />
        </div>
        <div className="mt-6 grid gap-6 text-sm leading-6 text-fd-muted-foreground md:grid-cols-2">
          <p>
            pdf-raster writes PNGs with fast compression, so its PNG files are
            about 2.5 times larger than the ones pdfjs-dist produces. WebP is
            also lossless, encodes almost as fast, and is about a third of the
            PNG size on text pages.
          </p>
          <p>
            These numbers come from one machine. Run{" "}
            <code className="font-mono text-fd-foreground">
              bun run benchmark
            </code>{" "}
            in the repository to measure your own hardware and PDFs.{" "}
            <TextLink href="/docs/benchmark">Benchmark details</TextLink>
          </p>
        </div>
      </Section>

      <Section
        eyebrow="Concurrency"
        title="Safe to call from many requests at once"
        intro="PDFium is not thread-safe, so pdf-raster renders one page at a time behind a process-wide lock. Encoding happens outside the lock, so other calls can render while earlier pages encode."
      >
        <Pipeline />
        <ul className="mt-6 grid gap-x-10 gap-y-3 text-sm leading-6 text-fd-muted-foreground md:grid-cols-2">
          <li>
            At most 8 rendered pages exist at once in the process. At 300 DPI on
            letter paper that is about 270 MB.
          </li>
          <li>
            Set <code className="font-mono text-fd-foreground">maxPixels</code>{" "}
            when clients choose the DPI. Oversized pages fail with{" "}
            <code className="font-mono text-fd-foreground">
              INVALID_OPTIONS
            </code>{" "}
            before any memory is allocated.{" "}
            <TextLink href="/docs/runtime-and-environment#concurrency-and-memory">
              Concurrency and memory
            </TextLink>
          </li>
        </ul>
      </Section>

      <Section
        eyebrow="Use cases"
        title="Where pdf-raster fits"
        intro="It renders pages and stops there. Pass the buffers to whatever comes next."
      >
        <div className="grid gap-px overflow-hidden rounded-xl border border-fd-border bg-fd-border sm:grid-cols-2 lg:grid-cols-4">
          {useCases.map((useCase) => (
            <Link
              key={useCase.title}
              href={useCase.href}
              className="group flex flex-col gap-2 bg-fd-card p-5 transition-colors hover:bg-fd-accent/60"
            >
              <span className="flex items-center justify-between font-medium">
                {useCase.title}
                <ArrowRight className="size-4 text-fd-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--pr-accent)]" />
              </span>
              <span className="text-sm leading-6 text-fd-muted-foreground">
                {useCase.body}
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-6 text-sm leading-6 text-fd-muted-foreground">
          pdf-raster does not run in browsers, Edge runtimes or WebAssembly, and
          it does not edit PDFs or extract text.
        </p>
      </Section>

      <ClosingCall />
    </main>
  );
}

function Hero() {
  return (
    <section className="pr-dotgrid border-b border-fd-border">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-4 py-16 md:px-6 md:py-24 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-20">
        <div className="flex flex-col items-start gap-7">
          <p className="pr-eyebrow">Node.js 24+ · Bun · PDFium</p>
          <h1 className="max-w-2xl text-4xl leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-6xl">
            Render PDF pages to PNG, JPEG and WebP.
          </h1>
          <p className="max-w-xl text-lg leading-8 text-pretty text-fd-muted-foreground">
            pdf-raster runs PDFium in a native addon written in Rust. Pass{" "}
            <code className="font-mono text-[0.9em] text-fd-foreground">
              convert()
            </code>{" "}
            a path or a Buffer and get back one encoded image per page.
          </p>
          <InstallCommand />
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/docs/quickstart"
              className="inline-flex items-center gap-2 rounded-md bg-fd-primary px-4 py-2.5 text-sm font-medium text-fd-primary-foreground transition-[opacity,transform] hover:opacity-90 active:scale-[0.98]"
            >
              Read the quickstart
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href={repoUrl}
              className="inline-flex items-center gap-2 rounded-md border border-fd-border bg-fd-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
            >
              GitHub
              <ArrowUpRight className="size-4 text-fd-muted-foreground" />
            </Link>
          </div>
        </div>
        <RasterPage />
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="border-b border-fd-border">
      <dl className="mx-auto grid w-full max-w-6xl grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <div
            key={stat.value}
            className={[
              "flex flex-col gap-1.5 border-fd-border px-4 py-7 md:px-6",
              index % 2 === 1 ? "border-l" : "",
              index >= 2 ? "border-t lg:border-t-0" : "",
              index === 2 ? "lg:border-l" : "",
            ].join(" ")}
          >
            <dt className="order-2 text-sm leading-5 text-fd-muted-foreground">
              {stat.label}
            </dt>
            <dd className="order-1 text-2xl font-semibold tracking-tight tabular-nums md:text-3xl">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function OptionsTable() {
  return (
    <div className="flex flex-col self-start overflow-hidden rounded-xl border border-fd-border bg-fd-card">
      <div className="flex items-center justify-between border-b border-fd-border px-4 py-3">
        <span className="font-mono text-xs text-fd-muted-foreground">
          ConvertOptions
        </span>
        <Link
          href="/docs/api-reference"
          className="text-xs text-fd-muted-foreground transition-colors hover:text-fd-foreground"
        >
          API reference →
        </Link>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="sr-only">
          <tr>
            <th>Option</th>
            <th>Type</th>
            <th>Default</th>
          </tr>
        </thead>
        <tbody>
          {options.map(([name, type, fallback]) => (
            <tr
              key={name}
              className="border-b border-fd-border last:border-b-0"
            >
              <td className="px-4 py-3 align-top">
                <span className="font-mono text-[13px] text-fd-foreground">
                  {name}
                </span>
                <span className="mt-0.5 block font-mono text-xs break-words text-fd-muted-foreground">
                  {type}
                </span>
              </td>
              <td className="px-4 py-3 text-right align-top font-mono text-xs whitespace-nowrap text-fd-muted-foreground">
                {fallback}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClosingCall() {
  return (
    <section className="border-t border-fd-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-16 md:flex-row md:items-end md:justify-between md:px-6">
        <div className="flex max-w-xl flex-col gap-3">
          <h2 className="text-2xl font-semibold tracking-[-0.02em] md:text-3xl">
            Convert your first PDF
          </h2>
          <p className="leading-7 text-fd-muted-foreground">
            The quickstart covers file paths, buffers, page selection and output
            formats in a few short examples.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/docs/quickstart"
            className="inline-flex items-center gap-2 rounded-md bg-fd-primary px-4 py-2.5 text-sm font-medium text-fd-primary-foreground transition-[opacity,transform] hover:opacity-90 active:scale-[0.98]"
          >
            Quickstart
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href={npmUrl}
            className="inline-flex items-center gap-2 rounded-md border border-fd-border bg-fd-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
          >
            npm
            <ArrowUpRight className="size-4 text-fd-muted-foreground" />
          </Link>
        </div>
      </div>
      <footer className="border-t border-fd-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-fd-muted-foreground md:px-6">
          <span>MIT license. Rendering by PDFium, bindings by napi-rs.</span>
          <span className="font-mono">pdf-raster</span>
        </div>
      </footer>
    </section>
  );
}

function Section({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-24">
      <div className="mb-10 flex max-w-2xl flex-col gap-3">
        <p className="pr-eyebrow">{eyebrow}</p>
        <h2 className="text-3xl font-semibold tracking-[-0.03em] text-balance md:text-4xl">
          {title}
        </h2>
        <p className="leading-7 text-pretty text-fd-muted-foreground [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-fd-foreground">
          {intro}
        </p>
      </div>
      {children}
    </section>
  );
}

function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="font-medium text-fd-foreground underline decoration-fd-border underline-offset-4 transition-colors hover:decoration-[var(--pr-accent)]"
    >
      {children}
    </Link>
  );
}
