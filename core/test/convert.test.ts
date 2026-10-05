import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import type { ConvertedPage, PdfToImagesErrorCode } from "../dist/index";
import { convert, PdfToImagesError } from "../dist/index";
import {
  expectJpegSignature,
  expectWebpSignature,
  fixturePath,
  parseJpegSampling,
  parsePngDimensions,
} from "./helpers";

const singlePageFixture = fixturePath("single-page.pdf");
const multiPageFixture = fixturePath("multi-page.pdf");
const malformedFixture = fixturePath("malformed.pdf");

async function expectPdfError(
  promise: Promise<unknown>,
  code: PdfToImagesErrorCode,
) {
  try {
    await promise;
    throw new Error(`Expected PdfToImagesError(${code}) to be thrown.`);
  } catch (error) {
    expect(error).toBeInstanceOf(PdfToImagesError);
    expect((error as PdfToImagesError).code).toBe(code);
  }
}

function expectPageShape(page: ConvertedPage, pageIndex: number, dpi: number) {
  expect(page.pageIndex).toBe(pageIndex);
  expect(page.dpi).toBe(dpi);
  expect(page.data.byteLength).toBeGreaterThan(8);
}

describe("pdf-raster", () => {
  test("converts all pages by default from an in-memory buffer", async () => {
    const bytes = await readFile(multiPageFixture);
    const pages = await convert(bytes);

    expect(pages).toHaveLength(2);
    expectPageShape(pages[0], 0, 300);
    expectPageShape(pages[1], 1, 300);
    expect(pages[0].width).toBe(833);
    expect(pages[0].height).toBe(417);
  });

  test("accepts Uint8Array input", async () => {
    const bytes = new Uint8Array(await readFile(singlePageFixture));
    const pages = await convert(bytes, {
      pages: [0],
    });

    expect(pages).toHaveLength(1);
    expectPageShape(pages[0], 0, 300);
  });

  test("accepts ArrayBuffer input", async () => {
    const bytes = await readFile(singlePageFixture);
    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    );
    const pages = await convert(arrayBuffer, {
      pages: [0],
    });

    expect(pages).toHaveLength(1);
    expectPageShape(pages[0], 0, 300);
  });

  test("converts selected pages from a file path", async () => {
    const pages = await convert(multiPageFixture, {
      pages: [1],
      dpi: 150,
    });

    expect(pages).toHaveLength(1);
    expectPageShape(pages[0], 1, 150);
    expect(pages[0].width).toBe(417);
    expect(pages[0].height).toBe(209);
  });

  test("returns PNG buffers with metadata for a single-page PDF", async () => {
    const pages = await convert(singlePageFixture, {
      pages: [0],
      dpi: 300,
    });

    expect(pages).toHaveLength(1);
    expectPageShape(pages[0], 0, 300);
    expect(pages[0].mimeType).toBe("image/png");
    const dimensions = parsePngDimensions(pages[0].data);
    expect(dimensions.width).toBe(pages[0].width);
    expect(dimensions.height).toBe(pages[0].height);
  });

  test("truncates non-integer dpi values during normalization", async () => {
    const pages = await convert(singlePageFixture, {
      pages: [0],
      dpi: 150.9,
    });

    expect(pages).toHaveLength(1);
    expectPageShape(pages[0], 0, 150);
    expect(pages[0].width).toBe(417);
    expect(pages[0].height).toBe(209);
  });

  test("supports JPEG output while keeping dimensions and metadata", async () => {
    const pages = await convert(singlePageFixture, {
      pages: [0],
      outputFormat: "jpeg",
    });

    expect(pages).toHaveLength(1);
    expectPageShape(pages[0], 0, 300);
    expect(pages[0].mimeType).toBe("image/jpeg");
    expectJpegSignature(pages[0].data);
  });

  test("jpeg output keeps 4:4:4 chroma sampling", async () => {
    const pages = await convert(singlePageFixture, {
      pages: [0],
      outputFormat: "jpeg",
    });

    const { samplingBytes } = parseJpegSampling(pages[0].data);

    expect(samplingBytes).toHaveLength(3);
    expect(samplingBytes.every((byte) => byte === 0x11)).toBe(true);
  });

  test("jpeg output decodes to the reported dimensions", async () => {
    const pages = await convert(singlePageFixture, {
      pages: [0],
      outputFormat: "jpeg",
    });

    const { width, height } = parseJpegSampling(pages[0].data);

    expect(width).toBe(pages[0].width);
    expect(height).toBe(pages[0].height);
  });

  test("supports WebP output while keeping dimensions and metadata", async () => {
    const pages = await convert(singlePageFixture, {
      pages: [0],
      outputFormat: "webp",
    });

    expect(pages).toHaveLength(1);
    expectPageShape(pages[0], 0, 300);
    expect(pages[0].mimeType).toBe("image/webp");
    expectWebpSignature(pages[0].data);
  });

  test("supports crop output when the crop is within bounds", async () => {
    const pages = await convert(singlePageFixture, {
      crop: {
        x: 10,
        y: 20,
        width: 100,
        height: 200,
      },
    });

    expect(pages).toHaveLength(1);
    expectPageShape(pages[0], 0, 300);
    expect(pages[0].width).toBe(100);
    expect(pages[0].height).toBe(200);
  });

  test("truncates non-integer crop values during normalization", async () => {
    const pages = await convert(singlePageFixture, {
      crop: {
        x: 10.9,
        y: 20.1,
        width: 100.8,
        height: 200.4,
      },
    });

    expect(pages).toHaveLength(1);
    expectPageShape(pages[0], 0, 300);
    expect(pages[0].width).toBe(100);
    expect(pages[0].height).toBe(200);
  });

  test("rejects invalid dpi values", async () => {
    await expectPdfError(
      convert(singlePageFixture, {
        dpi: 0,
      }),
      "INVALID_OPTIONS",
    );
  });

  test("rejects unsupported output formats", async () => {
    await expectPdfError(
      convert(singlePageFixture, {
        outputFormat: "gif" as never,
      }),
      "INVALID_OPTIONS",
    );
  });

  test("rejects out-of-range page indices", async () => {
    await expectPdfError(
      convert(singlePageFixture, {
        pages: [9],
      }),
      "INVALID_PAGE_INDEX",
    );
  });

  test("rejects negative crop values before calling native code", async () => {
    await expectPdfError(
      convert(singlePageFixture, {
        crop: {
          x: -1,
          y: 0,
          width: 10,
          height: 10,
        },
      }),
      "INVALID_CROP",
    );
  });

  test("rejects crop rectangles that exceed the rendered page bounds", async () => {
    await expectPdfError(
      convert(singlePageFixture, {
        crop: {
          x: 800,
          y: 0,
          width: 100,
          height: 50,
        },
      }),
      "INVALID_CROP",
    );
  });

  test("surfaces malformed pdf input cleanly", async () => {
    const malformedBytes = await readFile(malformedFixture);

    await expectPdfError(convert(malformedBytes), "MALFORMED_PDF");
  });

  test("rejects renders that exceed maxPixels", async () => {
    await expectPdfError(
      convert(singlePageFixture, { maxPixels: 300_000 }),
      "INVALID_OPTIONS",
    );
  });

  test("allows renders within maxPixels", async () => {
    const pages = await convert(singlePageFixture, { maxPixels: 400_000 });

    expect(pages).toHaveLength(1);
    expect(pages[0].width).toBe(833);
    expect(pages[0].height).toBe(417);
  });

  test("rejects very high dpi when maxPixels is set, without allocating", async () => {
    const start = performance.now();
    await expectPdfError(
      convert(singlePageFixture, { dpi: 20_000, maxPixels: 100_000_000 }),
      "INVALID_OPTIONS",
    );
    expect(performance.now() - start).toBeLessThan(2000);
  });

  test("rejects pages wider than 65535 px instead of clamping", async () => {
    const start = performance.now();
    await expectPdfError(
      convert(singlePageFixture, { dpi: 30_000 }),
      "INVALID_OPTIONS",
    );
    expect(performance.now() - start).toBeLessThan(2000);
  });

  test("rejects fractional dpi below 1", async () => {
    await expectPdfError(
      convert(singlePageFixture, { dpi: 0.5 }),
      "INVALID_OPTIONS",
    );
  });

  test("rejects page indices beyond the u32 range", async () => {
    await expectPdfError(
      convert(singlePageFixture, { pages: [2 ** 32] }),
      "INVALID_PAGE_INDEX",
    );
  });

  test("rejects invalid maxPixels", async () => {
    for (const maxPixels of [0, 1.5, 2 ** 32]) {
      await expectPdfError(
        convert(singlePageFixture, { maxPixels }),
        "INVALID_OPTIONS",
      );
    }
  });

  test("maxPixels guard matches the rendered size of rotated pages", async () => {
    const original = (await readFile(singlePageFixture)).toString("latin1");
    const marker = "/MediaBox [0 0 200 100]";
    expect(original).toContain(marker);
    const rotated = Buffer.from(
      original.replace(marker, `/Rotate 90 ${marker}`),
      "latin1",
    );

    for (const dpi of [150, 300]) {
      const [page] = await convert(rotated, { dpi });
      const actual = page.width * page.height;

      const pages = await convert(rotated, { dpi, maxPixels: actual });
      expect(pages).toHaveLength(1);
      await expectPdfError(
        convert(rotated, { dpi, maxPixels: actual - 1 }),
        "INVALID_OPTIONS",
      );
    }
  });
});
