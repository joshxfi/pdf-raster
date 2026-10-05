import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const packageDir = resolve(repoRoot, "core");
const artifactsDir = resolve(packageDir, "artifacts");
const npmDir = resolve(packageDir, "npm");

const fileNameByTarget = {
  "darwin-arm64": "libpdfium.dylib",
  "darwin-x64": "libpdfium.dylib",
  "linux-arm64-gnu": "libpdfium.so",
  "linux-x64-gnu": "libpdfium.so",
  "win32-arm64-msvc": "pdfium.dll",
  "win32-x64-msvc": "pdfium.dll",
} as const;

// Adding a platform target requires updating: core/package.json napi.targets,
// fileNameByTarget above, and the expected-target map in
// scripts/publish-packages.ts.
const allowPartialTargets =
  process.env.ALLOW_PARTIAL_PDFIUM_ARTIFACTS === "true";

function walk(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

if (!existsSync(artifactsDir)) {
  console.error(`Artifacts directory not found: ${artifactsDir}`);
  process.exit(1);
}

const files = walk(artifactsDir);
const copiedTargets = new Set();

for (const filePath of files) {
  if (!filePath.endsWith(".node")) {
    continue;
  }

  const match = /pdf-raster\.(.+)\.node$/.exec(filePath);
  if (!match) {
    continue;
  }

  const target = match[1];
  const pdfiumFileName =
    fileNameByTarget[target as keyof typeof fileNameByTarget];

  if (!pdfiumFileName) {
    continue;
  }

  const sourcePdfium = join(dirname(filePath), pdfiumFileName);
  if (!existsSync(sourcePdfium)) {
    console.error(`Missing ${pdfiumFileName} next to ${filePath}`);
    process.exit(1);
  }

  const targetDir = resolve(npmDir, target);
  mkdirSync(targetDir, { recursive: true });
  const targetPdfium = resolve(targetDir, pdfiumFileName);
  copyFileSync(sourcePdfium, targetPdfium);

  const packageJsonPath = resolve(targetDir, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const files = new Set(
    Array.isArray(packageJson.files) ? packageJson.files : [],
  );
  files.add(pdfiumFileName);
  packageJson.files = Array.from(files);
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  copiedTargets.add(target);
}

for (const target of Object.keys(fileNameByTarget)) {
  if (copiedTargets.has(target)) {
    continue;
  }

  if (!allowPartialTargets) {
    console.error(`Missing PDFium artifact for ${target}`);
    process.exit(1);
  }

  console.warn(`Skipping PDFium copy for missing local target: ${target}`);
}

console.log(
  `copied PDFium libraries for ${copiedTargets.size} target packages`,
);
