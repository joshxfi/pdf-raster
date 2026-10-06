import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Bump deliberately: update the tag and every hash together, then run the
// full test suite. Hashes come from the GitHub release asset digests.
const PINNED_PDFIUM_RELEASE = "chromium/8076";
const PINNED_PDFIUM_SHA256: Record<string, string> = {
  "pdfium-linux-arm64.tgz":
    "d7247b33ae5545615a5e877235dd97afc879e3a8805689684f528cae3339d352",
  "pdfium-linux-musl-arm64.tgz":
    "8a87d594a6c3d3c9bc04fabbe2c5809e344eb49f21ba1c59e2cbfd6a41bd3db1",
  "pdfium-linux-musl-x64.tgz":
    "312d2a7d66aecbf3b8f5965af6aa458cc433a35190f4a1ec69b5560683ca91b4",
  "pdfium-linux-x64.tgz":
    "d9d67bc40af03aef4fe28a60b19b1086f28ace019c8c9caf19cb7fe3d14ceca3",
  "pdfium-mac-arm64.tgz":
    "0d6781fe08906baff3d82c90953e519fbc4eb253fe76431e5ed53b157763b97c",
  "pdfium-mac-x64.tgz":
    "40865f34642c34d82cc336132df9e0347133f4692cd46776647af160f9a5cca9",
  "pdfium-win-arm64.tgz":
    "ab7c45c25fc8456fd9b94666ce3dd27a940f4984f54b328f012468f869d34346",
  "pdfium-win-x64.tgz":
    "808d36da9bc5a3104315fb307c80998121f565ee53953633bf33e80d7429e5ac",
};

function isMusl() {
  if (process.platform !== "linux") {
    return false;
  }

  try {
    return readFileSync("/usr/bin/ldd", "utf8").includes("musl");
  } catch {
    return false;
  }
}

function sanitizePathSegment(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9._-]+/g, "-");
}

function getConfiguredRelease() {
  return process.env.PDFIUM_RELEASE?.trim() || PINNED_PDFIUM_RELEASE;
}

function getRequestedTarget() {
  return process.env.PDFIUM_TARGET?.trim() || null;
}

function getTargetDescriptor() {
  const musl = isMusl();
  const target = getRequestedTarget();

  if (target === "aarch64-apple-darwin" || target === "darwin-arm64") {
    return {
      archiveName: "pdfium-mac-arm64.tgz",
      cacheKey: "darwin-arm64",
      targetFileName: "libpdfium.dylib",
    };
  }

  if (target === "x86_64-apple-darwin" || target === "darwin-x64") {
    return {
      archiveName: "pdfium-mac-x64.tgz",
      cacheKey: "darwin-x64",
      targetFileName: "libpdfium.dylib",
    };
  }

  if (target === "aarch64-unknown-linux-gnu" || target === "linux-arm64-gnu") {
    return {
      archiveName: "pdfium-linux-arm64.tgz",
      cacheKey: "linux-arm64-gnu",
      targetFileName: "libpdfium.so",
    };
  }

  if (target === "x86_64-unknown-linux-gnu" || target === "linux-x64-gnu") {
    return {
      archiveName: "pdfium-linux-x64.tgz",
      cacheKey: "linux-x64-gnu",
      targetFileName: "libpdfium.so",
    };
  }

  if (
    target === "aarch64-unknown-linux-musl" ||
    target === "linux-arm64-musl"
  ) {
    return {
      archiveName: "pdfium-linux-musl-arm64.tgz",
      cacheKey: "linux-arm64-musl",
      targetFileName: "libpdfium.so",
    };
  }

  if (target === "x86_64-unknown-linux-musl" || target === "linux-x64-musl") {
    return {
      archiveName: "pdfium-linux-musl-x64.tgz",
      cacheKey: "linux-x64-musl",
      targetFileName: "libpdfium.so",
    };
  }

  if (target === "aarch64-pc-windows-msvc" || target === "win32-arm64-msvc") {
    return {
      archiveName: "pdfium-win-arm64.tgz",
      cacheKey: "win32-arm64-msvc",
      targetFileName: "pdfium.dll",
    };
  }

  if (target === "x86_64-pc-windows-msvc" || target === "win32-x64-msvc") {
    return {
      archiveName: "pdfium-win-x64.tgz",
      cacheKey: "win32-x64-msvc",
      targetFileName: "pdfium.dll",
    };
  }

  if (process.platform === "darwin" && process.arch === "arm64") {
    return {
      archiveName: "pdfium-mac-arm64.tgz",
      cacheKey: "darwin-arm64",
      targetFileName: "libpdfium.dylib",
    };
  }

  if (process.platform === "darwin" && process.arch === "x64") {
    return {
      archiveName: "pdfium-mac-x64.tgz",
      cacheKey: "darwin-x64",
      targetFileName: "libpdfium.dylib",
    };
  }

  if (process.platform === "linux" && process.arch === "arm64") {
    return {
      archiveName: musl
        ? "pdfium-linux-musl-arm64.tgz"
        : "pdfium-linux-arm64.tgz",
      cacheKey: musl ? "linux-arm64-musl" : "linux-arm64-gnu",
      targetFileName: "libpdfium.so",
    };
  }

  if (process.platform === "linux" && process.arch === "x64") {
    return {
      archiveName: musl ? "pdfium-linux-musl-x64.tgz" : "pdfium-linux-x64.tgz",
      cacheKey: musl ? "linux-x64-musl" : "linux-x64-gnu",
      targetFileName: "libpdfium.so",
    };
  }

  if (process.platform === "win32" && process.arch === "arm64") {
    return {
      archiveName: "pdfium-win-arm64.tgz",
      cacheKey: "win32-arm64-msvc",
      targetFileName: "pdfium.dll",
    };
  }

  if (process.platform === "win32" && process.arch === "x64") {
    return {
      archiveName: "pdfium-win-x64.tgz",
      cacheKey: "win32-x64-msvc",
      targetFileName: "pdfium.dll",
    };
  }

  throw new Error(
    `Unsupported platform for PDFium download: ${process.platform} ${process.arch}`,
  );
}

function getPdfiumCacheRoot() {
  if (process.env.PDFIUM_CACHE_DIR?.trim()) {
    return resolve(process.env.PDFIUM_CACHE_DIR.trim());
  }

  return resolve(repoRoot, ".cache", "pdfium");
}

function getCachedPdfiumPath() {
  const target = getTargetDescriptor();
  const release = sanitizePathSegment(getConfiguredRelease());

  return resolve(
    getPdfiumCacheRoot(),
    release,
    target.cacheKey,
    target.targetFileName,
  );
}

function getPdfiumDownloadUrl() {
  if (process.env.PDFIUM_DOWNLOAD_URL?.trim()) {
    return process.env.PDFIUM_DOWNLOAD_URL.trim();
  }

  const target = getTargetDescriptor();
  const release = getConfiguredRelease();
  const releasePath = `download/${encodeURIComponent(release)}`;

  return `https://github.com/bblanchon/pdfium-binaries/releases/${releasePath}/${target.archiveName}`;
}

function readNullTerminatedString(
  buffer: Buffer,
  start: number,
  length: number,
): string {
  const value = buffer
    .subarray(start, start + length)
    .toString("utf8")
    .replace(/\0.*$/, "")
    .trim();

  return value;
}

function extractMatchingFileFromTar(
  tarBuffer: Buffer,
  targetFileName: string,
): Buffer {
  let offset = 0;

  while (offset + 512 <= tarBuffer.length) {
    const header = tarBuffer.subarray(offset, offset + 512);
    const isEmptyHeader = header.every((byte: number) => byte === 0);

    if (isEmptyHeader) {
      break;
    }

    const name = readNullTerminatedString(header, 0, 100);
    const prefix = readNullTerminatedString(header, 345, 155);
    const typeFlag = readNullTerminatedString(header, 156, 1) || "0";
    const sizeValue = readNullTerminatedString(header, 124, 12);
    const size = sizeValue ? Number.parseInt(sizeValue, 8) : 0;
    const fullName = prefix ? `${prefix}/${name}` : name;
    const normalizedName = fullName.replaceAll("\\", "/");
    const baseName = normalizedName.split("/").at(-1);
    const fileStart = offset + 512;
    const fileEnd = fileStart + size;

    if (
      (typeFlag === "0" || typeFlag === "\0") &&
      baseName === targetFileName &&
      fileEnd <= tarBuffer.length
    ) {
      return tarBuffer.subarray(fileStart, fileEnd);
    }

    offset = fileStart + Math.ceil(size / 512) * 512;
  }

  throw new Error(
    `Could not find ${targetFileName} in the downloaded archive.`,
  );
}

function getExpectedSha256(archiveName: string): string {
  const override = process.env.PDFIUM_SHA256?.trim();

  if (override) {
    return override.toLowerCase();
  }

  if (
    getConfiguredRelease() === PINNED_PDFIUM_RELEASE &&
    !process.env.PDFIUM_DOWNLOAD_URL?.trim()
  ) {
    const pinned = PINNED_PDFIUM_SHA256[archiveName];

    if (!pinned) {
      throw new Error(`No pinned PDFium checksum for ${archiveName}.`);
    }

    return pinned;
  }

  throw new Error(
    "PDFIUM_SHA256 must be set when PDFIUM_RELEASE or PDFIUM_DOWNLOAD_URL overrides the pinned PDFium release.",
  );
}

async function downloadPdfiumToCache() {
  const cachedPdfiumPath = getCachedPdfiumPath();

  if (existsSync(cachedPdfiumPath)) {
    return cachedPdfiumPath;
  }

  const target = getTargetDescriptor();
  const expectedSha256 = getExpectedSha256(target.archiveName);

  mkdirSync(dirname(cachedPdfiumPath), { recursive: true });

  const response = await fetch(getPdfiumDownloadUrl(), {
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download PDFium archive (${response.status} ${response.statusText}).`,
    );
  }

  const compressedArchive = Buffer.from(await response.arrayBuffer());
  const actualSha256 = createHash("sha256")
    .update(compressedArchive)
    .digest("hex");

  if (actualSha256 !== expectedSha256) {
    throw new Error(
      `PDFium archive checksum mismatch for ${target.archiveName}: expected ${expectedSha256}, got ${actualSha256}.`,
    );
  }

  const extractedArchive = gunzipSync(compressedArchive);
  const libraryBuffer = extractMatchingFileFromTar(
    extractedArchive,
    target.targetFileName,
  );

  writeFileSync(cachedPdfiumPath, libraryBuffer);
  return cachedPdfiumPath;
}

async function resolvePdfiumSourcePath() {
  const configuredSource = process.env.PDFIUM_LIB_PATH?.trim();

  if (configuredSource) {
    const explicitPath = resolve(configuredSource);

    if (existsSync(explicitPath)) {
      return explicitPath;
    }

    console.warn(
      `warning: PDFIUM_LIB_PATH does not exist, falling back to cache/download: ${explicitPath}`,
    );
  }

  const cachedPdfiumPath = getCachedPdfiumPath();
  if (existsSync(cachedPdfiumPath)) {
    return cachedPdfiumPath;
  }

  return downloadPdfiumToCache();
}

function getWorkspacePdfiumCandidates() {
  const packageDir = resolve(repoRoot, "core");
  const target = getTargetDescriptor();
  const candidates = [
    join(packageDir, target.targetFileName),
    join(packageDir, "lib", target.targetFileName),
    getCachedPdfiumPath(),
  ];

  return Array.from(new Set(candidates));
}

export {
  getCachedPdfiumPath,
  getConfiguredRelease,
  getPdfiumCacheRoot,
  getPdfiumDownloadUrl,
  getRequestedTarget,
  getTargetDescriptor,
  getWorkspacePdfiumCandidates,
  isMusl,
  repoRoot,
  resolvePdfiumSourcePath,
};
