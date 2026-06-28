const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "../..");
const MAX_GITHUB_FILE_SIZE = 100 * 1024 * 1024;
const WARNING_FILE_SIZE = 90 * 1024 * 1024;

function repositoryFiles() {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: ROOT, encoding: "buffer", maxBuffer: 16 * 1024 * 1024 }
  );

  return output
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
}

function formatMiB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function gitBlobSize(relativePath, diskSize) {
  if (diskSize < WARNING_FILE_SIZE) return diskSize;

  const hash = execFileSync(
    "git",
    ["hash-object", "-w", `--path=${relativePath}`, relativePath],
    { cwd: ROOT, encoding: "utf8" }
  ).trim();

  return Number(
    execFileSync("git", ["cat-file", "-s", hash], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim()
  );
}

const oversized = [];
const warnings = [];
const files = repositoryFiles();

for (const relativePath of files) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) continue;

  const size = gitBlobSize(relativePath, fs.statSync(filePath).size);
  if (size >= MAX_GITHUB_FILE_SIZE) {
    oversized.push({ relativePath, size });
  } else if (size >= WARNING_FILE_SIZE) {
    warnings.push({ relativePath, size });
  }
}

for (const file of warnings) {
  console.warn(`GitHub size warning: ${file.relativePath} is ${formatMiB(file.size)}.`);
}

if (oversized.length > 0) {
  for (const file of oversized) {
    console.error(
      `GitHub size limit exceeded: ${file.relativePath} is ${formatMiB(file.size)}.`
    );
  }
  process.exit(1);
}

console.log(`GitHub file-size validation passed for ${files.length} files.`);
