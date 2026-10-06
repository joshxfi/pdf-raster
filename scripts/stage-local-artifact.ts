import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { getTargetDescriptor, isMusl, repoRoot } from "./pdfium.ts";

type LocalTarget = {
  artifactDirName: string;
  binaryFileName: string;
};

const LOCAL_TARGETS: Partial<
  Record<NodeJS.Platform, Partial<Record<NodeJS.Architecture, LocalTarget>>>
> = {
  darwin: {
    arm64: {
      artifactDirName: "darwin-arm64",
      binaryFileName: "pdf-raster.darwin-arm64.node",
    },
    x64: {
      artifactDirName: "darwin-x64",
      binaryFileName: "pdf-raster.darwin-x64.node",
    },
  },
  linux: {
    arm64: {
      artifactDirName: "linux-arm64-gnu",
      binaryFileName: "pdf-raster.linux-arm64-gnu.node",
    },
    x64: {
      artifactDirName: "linux-x64-gnu",
      binaryFileName: "pdf-raster.linux-x64-gnu.node",
    },
  },
  win32: {
    arm64: {
      artifactDirName: "win32-arm64-msvc",
      binaryFileName: "pdf-raster.win32-arm64-msvc.node",
    },
    x64: {
      artifactDirName: "win32-x64-msvc",
      binaryFileName: "pdf-raster.win32-x64-msvc.node",
    },
  },
};

const LINUX_MUSL_TARGETS: Partial<Record<NodeJS.Architecture, LocalTarget>> = {
  arm64: {
    artifactDirName: "linux-arm64-musl",
    binaryFileName: "pdf-raster.linux-arm64-musl.node",
  },
  x64: {
    artifactDirName: "linux-x64-musl",
    binaryFileName: "pdf-raster.linux-x64-musl.node",
  },
};

function getLocalTarget(): LocalTarget {
  const targets = isMusl()
    ? LINUX_MUSL_TARGETS
    : LOCAL_TARGETS[process.platform];
  const target = targets?.[process.arch];

  if (!target) {
    throw new Error(
      `Unsupported local artifact target: ${process.platform}/${process.arch}`,
    );
  }

  return target;
}

const packageDir = resolve(repoRoot, "core");
const { artifactDirName, binaryFileName } = getLocalTarget();
const artifactsRoot = resolve(packageDir, "artifacts");
const artifactDir = resolve(packageDir, "artifacts", artifactDirName);
const sourceBinaryPath = resolve(packageDir, binaryFileName);
const { targetFileName } = getTargetDescriptor();
const sourcePdfiumPath = resolve(packageDir, targetFileName);

const artifactsAlreadyDownloaded =
  existsSync(artifactsRoot) && readdirSync(artifactsRoot).length > 0;

if (!existsSync(sourceBinaryPath)) {
  if (artifactsAlreadyDownloaded) {
    console.log(
      "skipping local artifact staging; CI artifacts already present",
    );
    process.exit(0);
  }

  console.error(`Local native binary not found: ${sourceBinaryPath}`);
  process.exit(1);
}

if (!existsSync(sourcePdfiumPath)) {
  console.error(`Bundled PDFium library not found: ${sourcePdfiumPath}`);
  process.exit(1);
}

mkdirSync(artifactDir, { recursive: true });

const stagedBinaryPath = resolve(artifactDir, binaryFileName);
const stagedPdfiumPath = resolve(artifactDir, targetFileName);

if (existsSync(stagedBinaryPath)) {
  console.log(
    `keeping existing artifact ${stagedBinaryPath}; delete core/artifacts to restage`,
  );
  process.exit(0);
}

copyFileSync(sourceBinaryPath, stagedBinaryPath);
copyFileSync(sourcePdfiumPath, stagedPdfiumPath);

console.log(`staged ${binaryFileName} -> ${stagedBinaryPath}`);
console.log(`staged ${targetFileName} -> ${stagedPdfiumPath}`);
