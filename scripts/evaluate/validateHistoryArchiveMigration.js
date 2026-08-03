const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { buildChapterEvents, buildPopularityEvents, buildStatusEvents, discoverEligible } = require("../build/buildUpdatesExport");
const { compactWeeklyHistory } = require("../build/writeChunkedFrontendExports");
const { buildHistoryFromSnapshots } = require("../history/computeAniListHistory");
const { popularityEventsFromState, updatePopularityMilestoneState } = require("../history/popularityMilestoneState");

const ROOT = path.resolve(__dirname, "../..");
const EXPORT_DIR = path.join(ROOT, "db/exports/frontend");
const SNAPSHOT_DIR = path.join(ROOT, "db/snapshots/anilist-daily");
const manifest = JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, "meta/data-manifest.json"), "utf8"));

function readDataset(name) {
  const descriptor = manifest.datasets[name];
  if (!descriptor?.chunks?.length) throw new Error(`Missing ${name} dataset.`);
  const chunks = descriptor.chunks.map((chunk) =>
    JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(EXPORT_DIR, chunk.path))))
  );
  return descriptor.kind === "array" ? chunks.flat() : Object.assign({}, ...chunks);
}

const fullHistory = readDataset("history");
const catalog = readDataset("catalog");
const snapshotFiles = fs.readdirSync(SNAPSHOT_DIR)
  .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
  .sort();
const bufferHistory = buildHistoryFromSnapshots(SNAPSHOT_DIR, snapshotFiles.slice(-14));
assert.deepEqual(
  compactWeeklyHistory(bufferHistory),
  compactWeeklyHistory(fullHistory),
  "The 14-snapshot buffer changed weekly runtime history.",
);

const updates = JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, "stats/updates.json"), "utf8"));
const eligibleIds = new Set(catalog.filter(discoverEligible).map((series) => series.id));
const popularityState = updatePopularityMilestoneState(null, fullHistory);
assert.deepEqual(
  popularityEventsFromState(popularityState, eligibleIds, updates.latestDate),
  buildPopularityEvents(fullHistory, eligibleIds, updates.latestDate),
  "Incremental popularity milestone state changed Updates results.",
);
assert.deepEqual(
  popularityEventsFromState(popularityState, eligibleIds, updates.latestDate),
  updates.popularity,
  "Popularity state differs from the currently published Updates payload.",
);

const statusState = JSON.parse(fs.readFileSync(path.join(ROOT, "db/state/status-history.json"), "utf8"));
assert.deepEqual(buildStatusEvents(statusState, eligibleIds, updates.latestDate), updates.statuses);
assert.deepEqual(buildChapterEvents(statusState, eligibleIds, updates.latestDate), updates.chapters);

console.log(
  `History archive migration parity passed: ${snapshotFiles.length} snapshots, ` +
  `${Object.keys(fullHistory).length} tracks, ${updates.popularity.length} popularity, ` +
  `${updates.statuses.length} status, and ${updates.chapters.length} chapter events unchanged.`,
);
