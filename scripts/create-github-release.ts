import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Creates the vX.Y.Z tag and GitHub release for the core version once it is
// on npm, with that version's CHANGELOG section as the notes. Safe to rerun:
// it does nothing when the release already exists or the version is not
// published yet.

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const packageDir = resolve(repoRoot, "core");
const dryRun = process.argv.includes("--dry-run");

function run(command: string, args: string[], input?: string): string {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    input,
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

function runOrNull(command: string, args: string[]): string | null {
  try {
    return run(command, args);
  } catch {
    return null;
  }
}

function changelogSection(version: string): string {
  const lines = readFileSync(resolve(packageDir, "CHANGELOG.md"), "utf8").split(
    "\n",
  );
  const start = lines.findIndex((line) => line.trim() === `## ${version}`);
  if (start === -1) {
    throw new Error(`core/CHANGELOG.md has no "## ${version}" section`);
  }

  const next = lines.findIndex(
    (line, index) => index > start && line.startsWith("## "),
  );
  return lines
    .slice(start + 1, next === -1 ? undefined : next)
    .join("\n")
    .trim();
}

const { name, version } = JSON.parse(
  readFileSync(resolve(packageDir, "package.json"), "utf8"),
) as { name: string; version: string };
const tag = `v${version}`;

if (runOrNull("gh", ["release", "view", tag, "--json", "tagName"]) !== null) {
  console.log(`Skipping ${tag}: the GitHub release already exists`);
  process.exit(0);
}

if (runOrNull("npm", ["view", `${name}@${version}`, "version"]) !== version) {
  console.log(`Skipping ${tag}: ${name}@${version} is not on npm`);
  process.exit(0);
}

const target = process.env.GITHUB_SHA || run("git", ["rev-parse", "HEAD"]);
const repository =
  process.env.GITHUB_REPOSITORY ||
  run("gh", [
    "repo",
    "view",
    "--json",
    "nameWithOwner",
    "-q",
    ".nameWithOwner",
  ]);
const previousTag = run("gh", [
  "release",
  "list",
  "--exclude-drafts",
  "--json",
  "tagName",
  "-q",
  ".[].tagName",
])
  .split("\n")
  .find((releaseTag) => releaseTag && releaseTag !== tag);

const notes = [
  changelogSection(version),
  previousTag
    ? `**Full Changelog**: https://github.com/${repository}/compare/${previousTag}...${tag}`
    : "",
]
  .filter(Boolean)
  .join("\n\n");

if (dryRun) {
  console.log(`[dry-run] would create ${tag} at ${target}:\n\n${notes}`);
  process.exit(0);
}

run(
  "gh",
  [
    "release",
    "create",
    tag,
    "--target",
    target,
    "--title",
    tag,
    "--notes-file",
    "-",
  ],
  notes,
);
console.log(`Created GitHub release ${tag} at ${target}`);
