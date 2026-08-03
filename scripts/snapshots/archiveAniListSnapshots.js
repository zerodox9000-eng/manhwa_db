const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const DATE_FILE = /^(\d{4})-(\d{2})-(\d{2})\.json$/;
const MANIFEST_SCHEMA_VERSION = 1;
const DEFAULT_BUFFER_DAYS = 14;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function snapshotFiles(sourceDir) {
  if (!fs.existsSync(sourceDir)) return [];
  return fs.readdirSync(sourceDir)
    .filter((name) => DATE_FILE.test(name))
    .sort();
}

function archiveRelativePath(filename) {
  const match = filename.match(DATE_FILE);
  if (!match) throw new Error(`Invalid AniList snapshot filename: ${filename}`);
  return path.posix.join("anilist", match[1], `${filename}.gz`);
}

function writeFileSafely(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, bytes);
  fs.copyFileSync(temporary, file);
  fs.rmSync(temporary, { force: true });
}

function readManifest(archiveDir) {
  const manifestPath = path.join(archiveDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return { schemaVersion: MANIFEST_SCHEMA_VERSION, snapshots: [] };
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION || !Array.isArray(manifest.snapshots)) {
    throw new Error("Unsupported AniList history archive manifest.");
  }
  return manifest;
}

function readAndValidateSource(file) {
  const raw = fs.readFileSync(file);
  const parsed = JSON.parse(raw.toString("utf8"));
  if (!Array.isArray(parsed)) throw new Error(`${file} is not an AniList snapshot array.`);
  return { raw, records: parsed.length };
}

function verifyArchiveEntry(archiveDir, entry) {
  const archivePath = path.resolve(archiveDir, entry.path);
  const root = `${path.resolve(archiveDir)}${path.sep}`;
  if (!archivePath.startsWith(root)) throw new Error(`Archive path escapes root: ${entry.path}`);
  const compressed = fs.readFileSync(archivePath);
  if (compressed.length !== entry.gzipBytes || sha256(compressed) !== entry.gzipSha256) {
    throw new Error(`Archived gzip verification failed: ${entry.date}`);
  }
  const raw = zlib.gunzipSync(compressed);
  if (raw.length !== entry.rawBytes || sha256(raw) !== entry.rawSha256) {
    throw new Error(`Archived raw snapshot verification failed: ${entry.date}`);
  }
  return true;
}

function archiveAniListSnapshots({
  sourceDir,
  archiveDir,
  bufferDays = DEFAULT_BUFFER_DAYS,
  prune = false,
}) {
  if (!sourceDir || !archiveDir) throw new Error("sourceDir and archiveDir are required.");
  if (!Number.isInteger(bufferDays) || bufferDays < 1) throw new Error("bufferDays must be a positive integer.");

  const files = snapshotFiles(sourceDir);
  const manifest = readManifest(archiveDir);
  const entries = new Map(manifest.snapshots.map((entry) => [entry.date, entry]));

  for (const filename of files) {
    const date = filename.slice(0, 10);
    const sourcePath = path.join(sourceDir, filename);
    const { raw, records } = readAndValidateSource(sourcePath);
    const compressed = zlib.gzipSync(raw, { level: 9, mtime: 0 });
    const relativePath = archiveRelativePath(filename);
    const entry = {
      date,
      path: relativePath,
      records,
      rawBytes: raw.length,
      gzipBytes: compressed.length,
      rawSha256: sha256(raw),
      gzipSha256: sha256(compressed),
    };
    const existing = entries.get(date);
    const archivePath = path.join(archiveDir, ...relativePath.split("/"));
    if (!existing || existing.rawSha256 !== entry.rawSha256 || !fs.existsSync(archivePath)) {
      writeFileSafely(archivePath, compressed);
    }
    entries.set(date, entry);
    verifyArchiveEntry(archiveDir, entry);
  }

  const snapshots = [...entries.values()].sort((left, right) => left.date.localeCompare(right.date));
  const nextManifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    generatedAt: snapshots.at(-1)?.date
      ? `${snapshots.at(-1).date}T00:00:00.000Z`
      : null,
    snapshotCount: snapshots.length,
    firstDate: snapshots[0]?.date ?? null,
    lastDate: snapshots.at(-1)?.date ?? null,
    totalRawBytes: snapshots.reduce((sum, entry) => sum + entry.rawBytes, 0),
    totalGzipBytes: snapshots.reduce((sum, entry) => sum + entry.gzipBytes, 0),
    snapshots,
  };
  writeFileSafely(
    path.join(archiveDir, "manifest.json"),
    Buffer.from(`${JSON.stringify(nextManifest, null, 2)}\n`),
  );

  for (const entry of snapshots) {
    verifyArchiveEntry(archiveDir, entry);
  }

  for (const filename of files) {
    if (!entries.has(filename.slice(0, 10))) {
      throw new Error(`Snapshot was not archived: ${filename}`);
    }
  }

  const retained = files.slice(-bufferDays);
  const removable = files.slice(0, Math.max(0, files.length - retained.length));
  if (prune) {
    for (const filename of removable) fs.rmSync(path.join(sourceDir, filename));
  }

  return {
    archived: files.length,
    retained: retained.length,
    pruned: prune ? removable.length : 0,
    manifest: nextManifest,
  };
}

if (require.main === module) {
  const root = path.resolve(__dirname, "../..");
  const sourceDir = path.join(root, "db/snapshots/anilist-daily");
  const archiveDir = process.env.ANILIST_HISTORY_ARCHIVE_DIR;
  if (!archiveDir) throw new Error("Set ANILIST_HISTORY_ARCHIVE_DIR to the checked-out archive repository.");
  const bufferArgument = process.argv.find((value) => value.startsWith("--buffer-days="));
  const bufferDays = bufferArgument
    ? Number(bufferArgument.split("=")[1])
    : DEFAULT_BUFFER_DAYS;
  const result = archiveAniListSnapshots({
    sourceDir,
    archiveDir: path.resolve(archiveDir),
    bufferDays,
    prune: process.argv.includes("--prune"),
  });
  console.log(
    `AniList history archive verified through ${result.manifest.lastDate}: ` +
    `${result.archived} source snapshots, ${result.retained} retained, ${result.pruned} pruned.`,
  );
}

module.exports = {
  DEFAULT_BUFFER_DAYS,
  archiveAniListSnapshots,
  archiveRelativePath,
  verifyArchiveEntry,
};
