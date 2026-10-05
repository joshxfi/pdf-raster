import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { ConvertedPage } from "./types.js";

type ProcessReport = {
  header?: {
    glibcVersionRuntime?: string;
  };
  sharedObjects?: string[];
};

type NativeConvertOptions = {
  pages?: number[];
  dpi?: number;
  outputFormat?: "jpeg" | "png" | "webp";
  password?: string;
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  renderAnnotations?: boolean;
  maxPixels?: number;
};

type NativeBinding = {
  convertPath(
    path: string,
    options?: NativeConvertOptions,
    pdfiumLibraryPath?: string,
  ): Promise<ConvertedPage[]>;
  convertBytes(
    bytes: Buffer,
    options?: NativeConvertOptions,
    pdfiumLibraryPath?: string,
  ): Promise<ConvertedPage[]>;
};

type LoadedBinding = {
  binding: NativeBinding;
  pdfiumPath?: string;
};

const require = createRequire(import.meta.url);
const dynamicRequire = new Function(
  "loader",
  "specifier",
  "return loader(specifier)",
) as (loader: NodeJS.Require, specifier: string) => unknown;
const dynamicRequireResolve = new Function(
  "loader",
  "specifier",
  "return loader.resolve(specifier)",
) as (loader: NodeJS.Require, specifier: string) => string;
const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..");
const workspaceRoot = resolve(packageRoot, "..", "..");
const loadErrors: unknown[] = [];

function isMusl(): boolean {
  if (process.platform !== "linux") {
    return false;
  }

  try {
    return require("node:fs")
      .readFileSync("/usr/bin/ldd", "utf8")
      .includes("musl");
  } catch {
    try {
      const report = process.report?.getReport?.() as ProcessReport | undefined;
      if (report?.header?.glibcVersionRuntime) {
        return false;
      }

      return (
        report?.sharedObjects?.some((file: string) => file.includes("musl")) ??
        false
      );
    } catch {
      return false;
    }
  }
}

function setPdfiumLibraryPath(path: string | undefined): void {
  if (!path || process.env.PDFIUM_LIB_PATH) {
    return;
  }

  process.env.PDFIUM_LIB_PATH = path;
}

function ensureBundledPdfiumPath(): void {
  if (process.env.PDFIUM_LIB_PATH) {
    return;
  }

  const candidates = getPdfiumCandidates();

  const bundled = candidates.find((candidate) => existsSync(candidate));
  setPdfiumLibraryPath(bundled);
}

function getBundledPdfiumPath(): string | undefined {
  return getPdfiumCandidates().find((candidate) => existsSync(candidate));
}

function getPdfiumFileName(): string {
  if (process.platform === "win32") {
    return "pdfium.dll";
  }

  if (process.platform === "darwin") {
    return "libpdfium.dylib";
  }

  return "libpdfium.so";
}

function getPdfiumCacheKey(): string {
  const linuxTarget = `${process.platform}-${process.arch}`;

  if (process.platform !== "linux") {
    return process.platform === "win32"
      ? `win32-${process.arch}-msvc`
      : linuxTarget;
  }

  return isMusl() ? `${linuxTarget}-musl` : `${linuxTarget}-gnu`;
}

function getPdfiumReleaseSegment(): string {
  return (process.env.PDFIUM_RELEASE || "latest").replaceAll(
    /[^a-zA-Z0-9._-]+/g,
    "-",
  );
}

function getPdfiumCandidates(): string[] {
  const fileName = getPdfiumFileName();
  const cacheRoot = process.env.PDFIUM_CACHE_DIR
    ? resolve(process.env.PDFIUM_CACHE_DIR)
    : join(workspaceRoot, ".cache", "pdfium");

  return [
    join(packageRoot, fileName),
    join(packageRoot, "lib", fileName),
    join(cacheRoot, getPdfiumReleaseSegment(), getPdfiumCacheKey(), fileName),
  ];
}

function resolvePdfiumPathFromModule(
  resolvedModulePath: string,
): string | undefined {
  const moduleDir = dirname(resolvedModulePath);
  const fileName = getPdfiumFileName();
  const candidates = [
    join(moduleDir, fileName),
    join(moduleDir, "lib", fileName),
  ];

  return candidates.find((candidate) => existsSync(candidate));
}

function loadBinding(
  specifier: string,
  load: () => unknown,
  resolveSpecifier: () => string,
): LoadedBinding | null {
  try {
    const resolvedSpecifier = resolveSpecifier();
    return {
      binding: load() as NativeBinding,
      pdfiumPath: resolvePdfiumPathFromModule(resolvedSpecifier),
    };
  } catch (error) {
    loadErrors.push(
      error instanceof Error
        ? new Error(`${specifier}: ${error.message}`)
        : error,
    );
    return null;
  }
}

function loadRuntimeBinding(specifier: string): LoadedBinding | null {
  return loadBinding(
    specifier,
    () => dynamicRequire(require, specifier),
    () => dynamicRequireResolve(require, specifier),
  );
}

function loadExplicitBinding(): LoadedBinding | null {
  const explicitPath = process.env.NAPI_RS_NATIVE_LIBRARY_PATH;
  if (!explicitPath) {
    return null;
  }

  return loadRuntimeBinding(explicitPath);
}

function requireLocalDarwinArm64() {
  return loadRuntimeBinding("../pdf-raster.darwin-arm64.node");
}

function requirePackageDarwinArm64() {
  return loadRuntimeBinding("pdf-raster-darwin-arm64");
}

function requireLocalDarwinX64() {
  return loadRuntimeBinding("../pdf-raster.darwin-x64.node");
}

function requirePackageDarwinX64() {
  return loadRuntimeBinding("pdf-raster-darwin-x64");
}

function requireLocalLinuxArm64() {
  return loadRuntimeBinding("../pdf-raster.linux-arm64-gnu.node");
}

function requirePackageLinuxArm64() {
  return loadRuntimeBinding("pdf-raster-linux-arm64-gnu");
}

function requireLocalLinuxX64() {
  return loadRuntimeBinding("../pdf-raster.linux-x64-gnu.node");
}

function requirePackageLinuxX64() {
  return loadRuntimeBinding("pdf-raster-linux-x64-gnu");
}

function requireLocalWin32Arm64() {
  return loadRuntimeBinding("../pdf-raster.win32-arm64-msvc.node");
}

function requirePackageWin32Arm64() {
  return loadRuntimeBinding("pdf-raster-win32-arm64-msvc");
}

function requireLocalWin32X64() {
  return loadRuntimeBinding("../pdf-raster.win32-x64-msvc.node");
}

function requirePackageWin32X64() {
  return loadRuntimeBinding("pdf-raster-win32-x64-msvc");
}

function loadTargetBinding(): LoadedBinding | null {
  switch (process.platform) {
    case "darwin":
      switch (process.arch) {
        case "arm64":
          return requireLocalDarwinArm64() ?? requirePackageDarwinArm64();
        case "x64":
          return requireLocalDarwinX64() ?? requirePackageDarwinX64();
        default:
          return null;
      }
    case "linux":
      switch (process.arch) {
        case "arm64":
          return requireLocalLinuxArm64() ?? requirePackageLinuxArm64();
        case "x64":
          return requireLocalLinuxX64() ?? requirePackageLinuxX64();
        default:
          return null;
      }
    case "win32":
      switch (process.arch) {
        case "arm64":
          return requireLocalWin32Arm64() ?? requirePackageWin32Arm64();
        case "x64":
          return requireLocalWin32X64() ?? requirePackageWin32X64();
        default:
          return null;
      }
    default:
      return null;
  }
}

function loadNativeBinding(): LoadedBinding {
  ensureBundledPdfiumPath();

  const explicit = loadExplicitBinding();
  if (explicit) {
    setPdfiumLibraryPath(explicit.pdfiumPath);
    return explicit;
  }

  if (process.platform === "linux") {
    if (isMusl()) {
      throw new Error(
        "Failed to load the native pdf-raster binding for linux musl. Prebuilt musl artifacts are not published for this package.",
      );
    }
  }

  const loaded = loadTargetBinding();
  if (loaded) {
    setPdfiumLibraryPath(loaded.pdfiumPath);
    return loaded;
  }

  return failToLoad();
}

function failToLoad(): never {
  const details = loadErrors
    .map((error) => (error instanceof Error ? error.message : String(error)))
    .join("\n");
  throw new Error(
    `Failed to load the native pdf-raster binding for ${process.platform}/${process.arch}.${details ? `\n${details}` : ""}`,
  );
}

const loadedBinding = loadNativeBinding();

export const nativeBinding = loadedBinding.binding;
export const bundledPdfiumPath =
  process.env.PDFIUM_LIB_PATH ??
  loadedBinding.pdfiumPath ??
  getBundledPdfiumPath();

export type { NativeBinding, NativeConvertOptions };
