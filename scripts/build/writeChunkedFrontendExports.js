const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const CONTRACT = "manhwa-frontend-data";
const SCHEMA_VERSION = 1;
const CHUNK_TARGET_BYTES = 8 * 1024 * 1024;
const MAX_CHUNK_BYTES = 20 * 1024 * 1024;
const LEGACY_COMPATIBILITY_MAX_BYTES = 80 * 1024 * 1024;
const LEGACY_AGGREGATES = [
  "series/all.json",
  "stats/history.json",
  "recommendations/features.json",
];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function compactWeeklyHistory(history) {
  let latestDate = null;
  for (const entries of Object.values(history)) {
    for (const entry of entries) {
      if (typeof entry?.d === "string" && (!latestDate || entry.d > latestDate)) latestDate = entry.d;
    }
  }
  if (!latestDate) return {};

  const latestTime = Date.parse(`${latestDate}T00:00:00Z`);
  if (!Number.isFinite(latestTime)) throw new Error(`Invalid latest history date: ${latestDate}`);
  const fromDate = new Date(latestTime - WEEK_MS).toISOString().slice(0, 10);
  const compact = {};

  for (const [id, rawEntries] of Object.entries(history)) {
    const entries = [...rawEntries].sort((left, right) => left.d.localeCompare(right.d));
    const start = entries.find((entry) => entry.d >= fromDate);
    const end = entries.findLast((entry) => entry.d <= latestDate);
    if (!start || !end || start.d > end.d) continue;
    compact[id] = start.d === end.d ? [start] : [start, end];
  }

  return compact;
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function arrayChunks(items) {
  const chunks = [];
  let parts = [];
  let bytes = 2;

  for (const item of items) {
    const serialized = JSON.stringify(item);
    const itemBytes = Buffer.byteLength(serialized);
    const addedBytes = itemBytes + (parts.length > 0 ? 1 : 0);

    if (parts.length > 0 && bytes + addedBytes > CHUNK_TARGET_BYTES) {
      chunks.push({
        raw: Buffer.from(`[${parts.join(",")}]`),
        records: parts.length,
      });
      parts = [];
      bytes = 2;
    }

    parts.push(serialized);
    bytes += itemBytes + (parts.length > 1 ? 1 : 0);
  }

  if (parts.length > 0 || items.length === 0) {
    chunks.push({
      raw: Buffer.from(`[${parts.join(",")}]`),
      records: parts.length,
    });
  }

  return chunks;
}

function objectChunks(value) {
  const entries = Object.entries(value);
  const chunks = [];
  let parts = [];
  let bytes = 2;

  for (const [key, entryValue] of entries) {
    const serialized = `${JSON.stringify(key)}:${JSON.stringify(entryValue)}`;
    const itemBytes = Buffer.byteLength(serialized);
    const addedBytes = itemBytes + (parts.length > 0 ? 1 : 0);

    if (parts.length > 0 && bytes + addedBytes > CHUNK_TARGET_BYTES) {
      chunks.push({
        raw: Buffer.from(`{${parts.join(",")}}`),
        records: parts.length,
      });
      parts = [];
      bytes = 2;
    }

    parts.push(serialized);
    bytes += itemBytes + (parts.length > 1 ? 1 : 0);
  }

  if (parts.length > 0 || entries.length === 0) {
    chunks.push({
      raw: Buffer.from(`{${parts.join(",")}}`),
      records: parts.length,
    });
  }

  return chunks;
}

function prepareDataset(name, kind, value) {
  const chunks = kind === "array" ? arrayChunks(value) : objectChunks(value);
  return {
    name,
    kind,
    count: kind === "array" ? value.length : Object.keys(value).length,
    chunks: chunks.map(({ raw, records }) => {
      const compressed = zlib.gzipSync(raw);
      if (compressed.length >= MAX_CHUNK_BYTES) {
        throw new Error(
          `${name} chunk is ${(compressed.length / 1024 / 1024).toFixed(2)} MiB; ` +
          `reduce CHUNK_TARGET_BYTES before publishing.`
        );
      }
      return {
        compressed,
        records,
        sha256: sha256(compressed),
      };
    }),
  };
}

function readPreviousBuildId(exportDir) {
  const manifestPath = path.join(exportDir, "meta/data-manifest.json");
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8")).buildId || null;
  } catch {
    return null;
  }
}

function removeExpiredBuilds(buildsDir, keepBuildIds) {
  if (!fs.existsSync(buildsDir)) return;
  for (const entry of fs.readdirSync(buildsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || keepBuildIds.has(entry.name)) continue;
    fs.rmSync(path.join(buildsDir, entry.name), { recursive: true, force: true });
  }
}

function writeChunkedFrontendExports({
  exportDir,
  catalog,
  tags,
  history,
  weeklyHistory,
  recommendations,
  generatedAt = new Date().toISOString(),
}) {
  const datasets = [
    prepareDataset("catalog", "array", catalog),
    prepareDataset("tags", "object", tags),
    ...(history ? [prepareDataset("history", "object", history)] : []),
    prepareDataset("weeklyHistory", "object", weeklyHistory),
    prepareDataset("recommendations", "array", recommendations),
  ];
  const contentHash = sha256(
    Buffer.from(
      datasets.flatMap((dataset) => dataset.chunks.map((chunk) => chunk.sha256)).join(":")
    )
  );
  const buildId = `v${SCHEMA_VERSION}-${contentHash.slice(0, 16)}`;
  const buildsDir = path.join(exportDir, "builds");
  const buildDir = path.join(buildsDir, buildId);
  const previousBuildId = readPreviousBuildId(exportDir);

  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(buildDir, { recursive: true });

  const manifestDatasets = {};
  for (const dataset of datasets) {
    const datasetDir = path.join(buildDir, dataset.name);
    fs.mkdirSync(datasetDir, { recursive: true });
    const chunks = dataset.chunks.map((chunk, index) => {
      const filename = `${String(index + 1).padStart(4, "0")}.json.gz`;
      const relativePath = path.posix.join("builds", buildId, dataset.name, filename);
      fs.writeFileSync(path.join(datasetDir, filename), chunk.compressed);
      return {
        path: relativePath,
        bytes: chunk.compressed.length,
        sha256: chunk.sha256,
        records: chunk.records,
      };
    });
    manifestDatasets[dataset.name] = {
      kind: dataset.kind,
      count: dataset.count,
      chunks,
    };
  }

  const manifest = {
    contract: CONTRACT,
    schemaVersion: SCHEMA_VERSION,
    buildId,
    generatedAt,
    chunkTargetBytes: CHUNK_TARGET_BYTES,
    datasets: manifestDatasets,
  };

  fs.mkdirSync(path.join(exportDir, "meta"), { recursive: true });
  fs.writeFileSync(
    path.join(exportDir, "meta/data-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );

  removeExpiredBuilds(
    buildsDir,
    new Set([buildId, previousBuildId].filter(Boolean))
  );

  console.log(
    `Chunked frontend build ${buildId} written with ` +
    `${datasets.reduce((sum, dataset) => sum + dataset.chunks.length, 0)} chunks.`
  );
  return manifest;
}

function finalizeLegacyFrontendExports(exportDir, { retainFullHistory = true } = {}) {
  const retainedAggregates = retainFullHistory
    ? LEGACY_AGGREGATES
    : LEGACY_AGGREGATES.filter((relativePath) => relativePath !== "stats/history.json");
  const gzipPaths = retainedAggregates.map((relativePath) =>
    path.join(exportDir, `${relativePath}.gz`)
  );
  const retireCompatibilityBundle = gzipPaths.some(
    (gzipPath) =>
      !fs.existsSync(gzipPath) ||
      fs.statSync(gzipPath).size >= LEGACY_COMPATIBILITY_MAX_BYTES
  );

  for (const relativePath of LEGACY_AGGREGATES) {
    fs.rmSync(path.join(exportDir, relativePath), { force: true });
  }
  if (!retainFullHistory) fs.rmSync(path.join(exportDir, "stats/history.json.gz"), { force: true });

  if (retireCompatibilityBundle) {
    for (const gzipPath of gzipPaths) {
      fs.rmSync(gzipPath, { force: true });
    }
    console.log("Legacy aggregate gzip bundle retired before reaching the GitHub size limit.");
    return;
  }

  console.log(
    retainFullHistory
      ? "Legacy aggregate gzip bundle retained for older frontend versions."
      : "Non-history legacy aggregate gzip files retained during weekly-only rollout."
  );
}

module.exports = {
  CHUNK_TARGET_BYTES,
  CONTRACT,
  LEGACY_COMPATIBILITY_MAX_BYTES,
  MAX_CHUNK_BYTES,
  SCHEMA_VERSION,
  compactWeeklyHistory,
  finalizeLegacyFrontendExports,
  writeChunkedFrontendExports,
};
