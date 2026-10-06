import type { CSSProperties } from "react";

/**
 * A US-letter page drawn twice: once as vector shapes and once as a pixel
 * grid. A scan line sweeps down the page and reveals the pixel version, which
 * is what convert() does to each page.
 */

const CELL = 10;
const GAP = 1.5;
const COLS = 34;
const ROWS = 44;
const WIDTH = COLS * CELL;
const HEIGHT = ROWS * CELL;

type Block = { row: number; col: number; cols: number; rows?: number };

// Text-like content in grid units, shared by both layers.
const title: Block = { row: 4, col: 3, cols: 18, rows: 2 };
const textLines: Block[] = [
  { row: 7, col: 3, cols: 11 },
  ...[31, 29, 31, 22].map((end, i) => ({
    row: 10 + i * 2,
    col: 3,
    cols: end - 3,
  })),
  ...[31, 30, 31, 28, 25].map((end, i) => ({
    row: 19 + i * 2,
    col: 20,
    cols: end - 20,
  })),
  ...[31, 30, 31, 17].map((end, i) => ({
    row: 32 + i * 2,
    col: 3,
    cols: end - 3,
  })),
];
const figure: Block = { row: 19, col: 3, cols: 15, rows: 10 };

// A tiny deterministic noise so the "image" pixels and line ends vary.
function noise(x: number, y: number) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

type Cell = { x: number; y: number; o: number; accent?: boolean };

function textCells(block: Block, weight: number): Cell[] {
  const cells: Cell[] = [];
  const rows = block.rows ?? 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < block.cols; c++) {
      const isEdge = c === block.cols - 1 || c === 0;
      const o = isEdge
        ? 0.45
        : weight - noise(block.col + c, block.row + r) * 0.2;
      cells.push({ x: block.col + c, y: block.row + r, o });
    }
  }
  return cells;
}

function figureCells(block: Block): Cell[] {
  const rows = block.rows ?? 1;
  const cells: Cell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < block.cols; c++) {
      const u = c / (block.cols - 1);
      const v = r / (rows - 1);
      const sun = Math.hypot(u - 0.72, v - 0.28) < 0.17;
      const hill = v > 0.62 - 0.22 * Math.sin(u * Math.PI * 1.3);
      const o = hill ? 0.75 + noise(c, r) * 0.2 : 0.14 + v * 0.12;
      cells.push({
        x: block.col + c,
        y: block.row + r,
        o: sun ? 0.95 : o,
        accent: sun,
      });
    }
  }
  return cells;
}

const rasterCells: Cell[] = [
  ...textCells(title, 1),
  ...textLines.flatMap((line) => textCells(line, 0.7)),
  ...figureCells(figure),
];

function VectorLayer() {
  const fx = figure.col * CELL;
  const fy = figure.row * CELL;
  const fw = figure.cols * CELL;
  const fh = (figure.rows ?? 1) * CELL;

  return (
    <g>
      <rect
        x={title.col * CELL}
        y={title.row * CELL + 2}
        width={title.cols * CELL}
        height={16}
        rx={3}
        className="fill-fd-foreground"
      />
      {textLines.map((line) => (
        <rect
          key={`${line.row}-${line.col}`}
          x={line.col * CELL}
          y={line.row * CELL + 2.5}
          width={line.cols * CELL}
          height={5}
          rx={2.5}
          className="fill-fd-foreground"
          opacity={0.55}
        />
      ))}
      <rect
        x={fx}
        y={fy}
        width={fw}
        height={fh}
        rx={4}
        className="fill-fd-foreground"
        opacity={0.08}
      />
      <circle
        cx={fx + fw * 0.72}
        cy={fy + fh * 0.28}
        r={fh * 0.15}
        fill="var(--pr-accent)"
      />
      <path
        d={`M${fx} ${fy + fh * 0.7} C ${fx + fw * 0.3} ${fy + fh * 0.3}, ${fx + fw * 0.55} ${fy + fh * 0.45}, ${fx + fw} ${fy + fh * 0.8} V ${fy + fh} H ${fx} Z`}
        className="fill-fd-foreground"
        opacity={0.6}
      />
    </g>
  );
}

function RasterLayer() {
  return (
    <g>
      {rasterCells.map((cell) => (
        <rect
          key={`${cell.x}-${cell.y}`}
          x={cell.x * CELL + GAP / 2}
          y={cell.y * CELL + GAP / 2}
          width={CELL - GAP}
          height={CELL - GAP}
          rx={1}
          fill={cell.accent ? "var(--pr-accent)" : "currentColor"}
          opacity={cell.o}
        />
      ))}
    </g>
  );
}

export function RasterPage() {
  return (
    <figure className="relative mx-auto w-full max-w-[360px]">
      <div className="mb-3 flex items-center justify-between font-mono text-[11px] text-fd-muted-foreground">
        <span>report.pdf</span>
        <span>page 1 of 12</span>
      </div>

      <div className="relative">
        <CropMarks />
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="relative block w-full rounded-[3px] bg-fd-card text-fd-foreground shadow-[0_1px_0_var(--color-fd-border),0_24px_48px_-24px_rgb(0_0_0/0.25)] ring-1 ring-fd-border"
          role="img"
          aria-label="A PDF page whose text and image turn into pixels as a scan line passes over it"
        >
          <defs>
            <mask id="pr-raster-mask">
              <rect
                width={WIDTH}
                height={HEIGHT}
                fill="white"
                className="pr-scan"
              />
            </mask>
            <mask id="pr-vector-mask">
              <rect width={WIDTH} height={HEIGHT} fill="white" />
              <rect
                width={WIDTH}
                height={HEIGHT}
                fill="black"
                className="pr-scan"
              />
            </mask>
          </defs>

          <g mask="url(#pr-vector-mask)">
            <VectorLayer />
          </g>
          <g mask="url(#pr-raster-mask)">
            <RasterLayer />
          </g>

          <g
            className="pr-scanline"
            style={{ "--pr-scan-distance": `${HEIGHT}px` } as CSSProperties}
          >
            <rect
              x={0}
              y={-1}
              width={WIDTH}
              height={2}
              fill="var(--pr-accent)"
            />
            <rect
              x={0}
              y={-24}
              width={WIDTH}
              height={24}
              fill="url(#pr-scan-glow)"
            />
          </g>
          <defs>
            <linearGradient id="pr-scan-glow" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--pr-accent)" stopOpacity="0" />
              <stop
                offset="1"
                stopColor="var(--pr-accent)"
                stopOpacity="0.18"
              />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <figcaption className="mt-3 flex items-center justify-between gap-3 font-mono text-[11px] text-fd-muted-foreground">
        <span>
          <span className="text-fd-foreground">image/png</span> · 2550 × 3300
        </span>
        <span>300 dpi</span>
      </figcaption>
    </figure>
  );
}

/** Printer's crop marks just outside each corner of the page. */
function CropMarks() {
  const corners = [
    "-left-3 -top-3 border-l border-t",
    "-right-3 -top-3 border-r border-t",
    "-bottom-3 -left-3 border-b border-l",
    "-bottom-3 -right-3 border-b border-r",
  ];
  return (
    <>
      {corners.map((position) => (
        <span
          key={position}
          aria-hidden="true"
          className={`pointer-events-none absolute size-2.5 border-[var(--pr-ink-soft)] ${position}`}
        />
      ))}
    </>
  );
}
