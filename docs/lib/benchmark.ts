/**
 * Numbers from one `bun run benchmark -- --runs 5 --warmups 1` run on an
 * Apple M4 (4 performance and 6 efficiency cores, 24 GB), macOS 27, Bun 1.4.2,
 * 300 DPI, PNG output.
 * Keep in sync with content/docs/benchmark.mdx and both READMEs.
 */
export const benchmarkMachine = "an Apple M4 with 24 GB, macOS 27, Bun 1.4.2";

export type BenchmarkRow = {
  library: string;
  msPerPage: number | null;
  /** Why the library has no number for this fixture. */
  note?: string;
};

export type BenchmarkFixture = {
  id: string;
  label: string;
  rows: BenchmarkRow[];
};

export const benchmarkFixtures: BenchmarkFixture[] = [
  {
    id: "text-20",
    label: "text-20.pdf, 20 text pages",
    rows: [
      { library: "pdf-raster", msPerPage: 10.08 },
      { library: "pdfjs-dist + @napi-rs/canvas", msPerPage: 176.93 },
      { library: "pdfjs-dist + node-canvas", msPerPage: 256.88 },
    ],
  },
  {
    id: "mixed-10",
    label: "mixed-10.pdf, 10 pages of text and images",
    rows: [
      { library: "pdf-raster", msPerPage: 17.13 },
      { library: "pdfjs-dist + @napi-rs/canvas", msPerPage: 218.3 },
      { library: "pdfjs-dist + node-canvas", msPerPage: 299.05 },
    ],
  },
];

export const benchmarkSummary = {
  /** pdf-raster vs pdfjs-dist + @napi-rs/canvas, total time. */
  speedupRange: "12.7× to 17.6×",
  /** The text-20 multiplier, the larger of the two. */
  maxSpeedup: "17.6×",
  fastestMsPerPage: "10.1 ms",
};
