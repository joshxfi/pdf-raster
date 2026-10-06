import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const packageDir = resolve(repoRoot, "core");
const npmDir = resolve(packageDir, "npm");
const publishWithProvenance = process.env.NPM_PUBLISH_PROVENANCE === "true";
const dryRun = process.argv.includes("--dry-run");

// Keep in sync with fileNameByTarget in copy-pdfium-to-npm.ts and
// napi.targets in core/package.json when adding a platform target.
const pdfiumFileByTarget = {
  "darwin-arm64": "libpdfium.dylib",
  "darwin-x64": "libpdfium.dylib",
  "linux-arm64-gnu": "libpdfium.so",
  "linux-arm64-musl": "libpdfium.so",
  "linux-x64-gnu": "libpdfium.so",
  "linux-x64-musl": "libpdfium.so",
  "win32-arm64-msvc": "pdfium.dll",
  "win32-x64-msvc": "pdfium.dll",
} as const;

const expectedTargets = Object.keys(pdfiumFileByTarget).sort() as Array<
  keyof typeof pdfiumFileByTarget
>;

type PackageJson = {
  name?: string;
  version?: string;
  files?: string[];
  optionalDependencies?: Record<string, string>;
};

function run(command: string, args: string[], cwd: string): void {
  const output = execFileSync(command, args, {
    cwd,
    stdio: ["inherit", "pipe", "pipe"],
    env: process.env,
  });

  if (output.length > 0) {
    process.stdout.write(output);
  }
}

function getErrorOutput(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const withStreams = error as Error & {
    stdout?: Buffer | string;
    stderr?: Buffer | string;
  };

  return [
    error.message,
    withStreams.stdout ? String(withStreams.stdout) : "",
    withStreams.stderr ? String(withStreams.stderr) : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function readPackageJson(dir: string): PackageJson {
  return JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
}

function fileSize(path: string): number {
  return existsSync(path) ? statSync(path).size : 0;
}

function assertPublishable(corePackage: PackageJson): void {
  const problems: string[] = [];

  for (const file of ["index.js", "index.d.ts"]) {
    if (!existsSync(join(packageDir, "dist", file))) {
      problems.push(`core/dist/${file} is missing`);
    }
  }

  for (const target of expectedTargets) {
    const dir = join(npmDir, target);
    if (!existsSync(dir)) {
      problems.push(`core/npm/${target} is missing`);
      continue;
    }

    const binaryName = `pdf-raster.${target}.node`;
    const pdfiumName = pdfiumFileByTarget[target];

    for (const fileName of [binaryName, pdfiumName]) {
      if (fileSize(join(dir, fileName)) <= 0) {
        problems.push(`core/npm/${target}/${fileName} is missing or empty`);
      }
    }

    if (!existsSync(join(dir, "package.json"))) {
      problems.push(`core/npm/${target}/package.json is missing`);
      continue;
    }

    const targetPackage = readPackageJson(dir);
    if (targetPackage.name !== `pdf-raster-${target}`) {
      problems.push(
        `core/npm/${target}/package.json name is ${targetPackage.name}, expected pdf-raster-${target}`,
      );
    }
    if (targetPackage.version !== corePackage.version) {
      problems.push(
        `core/npm/${target}/package.json version is ${targetPackage.version}, expected ${corePackage.version}`,
      );
    }
    for (const fileName of [binaryName, pdfiumName]) {
      if (!targetPackage.files?.includes(fileName)) {
        problems.push(
          `core/npm/${target}/package.json files does not include ${fileName}`,
        );
      }
    }
  }

  if (existsSync(npmDir)) {
    for (const entry of readdirSync(npmDir, { withFileTypes: true })) {
      if (
        entry.isDirectory() &&
        !(expectedTargets as string[]).includes(entry.name)
      ) {
        problems.push(`core/npm/${entry.name} is an unexpected directory`);
      }
    }
  }

  const expectedOptionalNames = expectedTargets
    .map((target) => `pdf-raster-${target}`)
    .sort();
  const optionalDependencies = corePackage.optionalDependencies ?? {};
  const actualOptionalNames = Object.keys(optionalDependencies).sort();
  if (
    JSON.stringify(actualOptionalNames) !==
    JSON.stringify(expectedOptionalNames)
  ) {
    problems.push(
      `core optionalDependencies keys are [${actualOptionalNames.join(", ")}], expected [${expectedOptionalNames.join(", ")}]`,
    );
  }
  for (const [name, version] of Object.entries(optionalDependencies)) {
    if (version !== corePackage.version) {
      problems.push(
        `core optionalDependencies ${name} is ${version}, expected ${corePackage.version}`,
      );
    }
  }

  if (problems.length > 0) {
    console.error("Refusing to publish; package validation failed:");
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    process.exit(1);
  }
}

function isPublished(name: string, version: string): boolean {
  try {
    const output = execFileSync(
      "npm",
      ["view", `${name}@${version}`, "version"],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      },
    );
    return String(output).trim() === version;
  } catch (error) {
    const message = getErrorOutput(error);
    if (message.includes("E404") || message.includes("404")) {
      return false;
    }

    throw error;
  }
}

function publishDir(cwd: string): void {
  const { name, version } = readPackageJson(cwd);
  if (!name || !version) {
    console.error(`Missing name or version in ${cwd}/package.json`);
    process.exit(1);
  }

  if (isPublished(name, version)) {
    console.log(`Skipping ${name}@${version}: already published`);
    return;
  }

  if (dryRun) {
    console.log(`[dry-run] would publish ${name}@${version} from ${cwd}`);
    return;
  }

  const args = ["publish", "--access", "public", "--ignore-scripts"];
  if (publishWithProvenance) {
    args.push("--provenance");
  }

  run("npm", args, cwd);
}

run("bun", ["run", "--cwd", packageDir, "build:types"], repoRoot);
run("bun", ["run", "--cwd", packageDir, "prepare-npm-packages"], repoRoot);

// Read after prepare-npm-packages: napi prepublish rewrites this file.
const corePackage = readPackageJson(packageDir);
assertPublishable(corePackage);

for (const target of expectedTargets) {
  publishDir(join(npmDir, target));
}

publishDir(packageDir);
