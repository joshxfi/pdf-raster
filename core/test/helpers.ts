import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export function fixturePath(name: string): string {
  return join(here, "fixtures", name);
}

export function parsePngDimensions(data: Uint8Array): {
  width: number;
  height: number;
} {
  const png = Buffer.from(data);
  const signature = png.subarray(0, 8);
  const expectedSignature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  if (!signature.equals(expectedSignature)) {
    throw new Error("Expected a PNG signature.");
  }

  if (png.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error("Expected a PNG IHDR chunk.");
  }

  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

export function expectJpegSignature(data: Uint8Array): void {
  const jpeg = Buffer.from(data);

  if (
    jpeg.byteLength < 3 ||
    jpeg[0] !== 0xff ||
    jpeg[1] !== 0xd8 ||
    jpeg[2] !== 0xff
  ) {
    throw new Error("Expected a JPEG signature.");
  }
}

export function expectWebpSignature(data: Uint8Array): void {
  const webp = Buffer.from(data);

  if (
    webp.byteLength < 12 ||
    webp.subarray(0, 4).toString("ascii") !== "RIFF" ||
    webp.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    throw new Error("Expected a WebP signature.");
  }
}

export function parseJpegSampling(data: Uint8Array): {
  width: number;
  height: number;
  samplingBytes: number[];
} {
  const jpeg = Buffer.from(data);
  let offset = 2;

  while (offset + 4 <= jpeg.length) {
    if (jpeg[offset] !== 0xff) {
      throw new Error(`Expected a JPEG marker at offset ${offset}.`);
    }

    const marker = jpeg[offset + 1];
    const length = jpeg.readUInt16BE(offset + 2);

    if (marker === 0xc0 || marker === 0xc2) {
      const height = jpeg.readUInt16BE(offset + 5);
      const width = jpeg.readUInt16BE(offset + 7);
      const componentCount = jpeg[offset + 9];
      const samplingBytes: number[] = [];

      for (let index = 0; index < componentCount; index += 1) {
        samplingBytes.push(jpeg[offset + 11 + index * 3]);
      }

      return { width, height, samplingBytes };
    }

    offset += 2 + length;
  }

  throw new Error("No JPEG SOF0/SOF2 marker found.");
}
