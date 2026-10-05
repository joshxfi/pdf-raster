import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 900;

const WORDS = [
  "alpha",
  "bravo",
  "charlie",
  "delta",
  "echo",
  "foxtrot",
  "golf",
  "hotel",
  "india",
  "juliet",
  "kilo",
  "lima",
  "mike",
  "november",
  "oscar",
  "papa",
  "quebec",
  "romeo",
  "sierra",
  "tango",
  "uniform",
  "victor",
  "whiskey",
  "xray",
  "yankee",
  "zulu",
  "render",
  "page",
  "invoice",
  "total",
];

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function escapePdfText(value: string): string {
  return value.replace(/[\\()]/g, (char) => `\\${char}`);
}

function textLines(random: () => number, count: number): string[] {
  const lines: string[] = [];

  for (let line = 0; line < count; line += 1) {
    const words: string[] = [];
    for (let word = 0; word < 14; word += 1) {
      words.push(WORDS[Math.floor(random() * WORDS.length)]);
    }
    lines.push(words.join(" "));
  }

  return lines;
}

function textPageContent(random: () => number): string {
  const parts: string[] = [];

  // Table rules.
  parts.push("0.85 g");
  for (let index = 0; index < 4; index += 1) {
    parts.push(`54 ${700 - index * 150} 504 1.5 re f`);
  }
  parts.push("0.93 g 54 40 504 18 re f");
  parts.push("0 g");

  parts.push("BT /F1 10 Tf 12 TL 54 750 Td");
  for (const line of textLines(random, 55)) {
    parts.push(`(${escapePdfText(line)}) Tj T*`);
  }
  parts.push("ET");

  return parts.join("\n");
}

function imagePageContent(random: () => number): string {
  const parts: string[] = [];

  parts.push("q 504 0 0 378 54 360 cm /Im1 Do Q");
  parts.push("BT /F1 10 Tf 12 TL 54 340 Td");
  for (const line of textLines(random, 20)) {
    parts.push(`(${escapePdfText(line)}) Tj T*`);
  }
  parts.push("ET");

  return parts.join("\n");
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function generateImageData(random: () => number): Buffer {
  const raw = Buffer.alloc(IMAGE_WIDTH * IMAGE_HEIGHT * 3);
  let offset = 0;

  for (let y = 0; y < IMAGE_HEIGHT; y += 1) {
    for (let x = 0; x < IMAGE_WIDTH; x += 1) {
      const noise = Math.floor(random() * 40) - 20;
      raw[offset] = clampByte((x / IMAGE_WIDTH) * 255 + noise);
      raw[offset + 1] = clampByte((y / IMAGE_HEIGHT) * 255 + noise);
      raw[offset + 2] = clampByte(
        ((x + y) / (IMAGE_WIDTH + IMAGE_HEIGHT)) * 255 + noise,
      );
      offset += 3;
    }
  }

  return deflateSync(raw, { level: 6 });
}

type PdfPage = { content: string; usesImage: boolean };

function buildPdf(pages: PdfPage[], image: Buffer | null): Buffer {
  const chunks: Buffer[] = [];
  const offsets: number[] = [];
  let length = 0;

  const push = (chunk: Buffer): void => {
    chunks.push(chunk);
    length += chunk.length;
  };
  const pushText = (text: string): void => push(Buffer.from(text, "latin1"));
  const beginObject = (id: number): void => {
    offsets[id] = length;
    pushText(`${id} 0 obj\n`);
  };

  // Object ids: 1 catalog, 2 pages, 3 font, 4 image, then page/content pairs.
  const firstPageId = 5;
  const pageId = (index: number): number => firstPageId + index * 2;

  pushText("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");

  beginObject(1);
  pushText("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  beginObject(2);
  const kids = pages.map((_, index) => `${pageId(index)} 0 R`).join(" ");
  pushText(
    `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`,
  );

  beginObject(3);
  pushText(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n",
  );

  beginObject(4);
  if (image) {
    pushText(
      `<< /Type /XObject /Subtype /Image /Width ${IMAGE_WIDTH} /Height ${IMAGE_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${image.length} >>\nstream\n`,
    );
    push(image);
    pushText("\nendstream\nendobj\n");
  } else {
    pushText("null\nendobj\n");
  }

  pages.forEach((page, index) => {
    const id = pageId(index);
    const xobjects = page.usesImage ? " /XObject << /Im1 4 0 R >>" : "";

    beginObject(id);
    pushText(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >>${xobjects} >> /Contents ${id + 1} 0 R >>\nendobj\n`,
    );

    const content = Buffer.from(page.content, "latin1");
    beginObject(id + 1);
    pushText(`<< /Length ${content.length} >>\nstream\n`);
    push(content);
    pushText("\nendstream\nendobj\n");
  });

  const objectCount = pageId(pages.length - 1) + 2;
  const xrefOffset = length;
  pushText(`xref\n0 ${objectCount}\n0000000000 65535 f \n`);
  for (let id = 1; id < objectCount; id += 1) {
    pushText(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  pushText(
    `trailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );

  return Buffer.concat(chunks);
}

function buildTextFixture(): Buffer {
  const random = mulberry32(0x5eed01);
  const pages: PdfPage[] = [];

  for (let index = 0; index < 20; index += 1) {
    pages.push({ content: textPageContent(random), usesImage: false });
  }

  return buildPdf(pages, null);
}

function buildMixedFixture(): Buffer {
  const random = mulberry32(0x5eed02);
  const image = generateImageData(random);
  const pages: PdfPage[] = [];

  for (let index = 0; index < 10; index += 1) {
    pages.push(
      index % 2 === 0
        ? { content: textPageContent(random), usesImage: false }
        : { content: imagePageContent(random), usesImage: true },
    );
  }

  return buildPdf(pages, image);
}

export function generateFixtures(outDir: string, force = false): string[] {
  mkdirSync(outDir, { recursive: true });

  const targets: Array<[string, () => Buffer]> = [
    ["text-20.pdf", buildTextFixture],
    ["mixed-10.pdf", buildMixedFixture],
  ];

  return targets.map(([name, build]) => {
    const path = resolve(outDir, name);
    if (force || !existsSync(path)) {
      writeFileSync(path, build());
    }
    return path;
  });
}

if (import.meta.main) {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const path of generateFixtures(resolve(here, ".fixtures"), true)) {
    console.log(path);
  }
}
