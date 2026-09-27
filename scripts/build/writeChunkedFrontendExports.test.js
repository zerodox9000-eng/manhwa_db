const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const test = require("node:test");
const { compactWeeklyHistory, writeChunkedFrontendExports } = require("./writeChunkedFrontendExports");

const row = (d, p) => ({ d, p, f: p, s: p, r: p, rp: p, pp: p, ds: p, dp: p });

test("keeps only the exact weekly boundary records without mutating full history", () => {
  const history = {
    1: [row("2026-08-03", 3), row("2026-07-27", 1), row("2026-07-30", 2)],
    2: [row("2026-07-29", 4), row("2026-08-03", 5)],
    3: [row("2026-08-03", 6)],
    4: [row("2026-07-20", 7)],
  };

  assert.deepEqual(compactWeeklyHistory(history), {
    1: [row("2026-07-27", 1), row("2026-08-03", 3)],
    2: [row("2026-07-29", 4), row("2026-08-03", 5)],
    3: [row("2026-08-03", 6)],
  });
  assert.deepEqual(history[1].map((entry) => entry.d), ["2026-08-03", "2026-07-27", "2026-07-30"]);
});

test("returns an empty map when no dated history exists", () => {
  assert.deepEqual(compactWeeklyHistory({ 1: [] }), {});
});

test("writes a valid weekly-only manifest without publishing full history", (context) => {
  const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), "aeon-weekly-only-"));
  context.after(() => fs.rmSync(exportDir, { recursive: true, force: true }));
  const weeklyHistory = { 1: [row("2026-08-03", 3)] };
  const updates = {
    schemaVersion: 1,
    generatedAt: "2026-08-03T00:00:00.000Z",
    latestDate: "2026-08-03",
    windowDays: 365,
    statusWindowDays: 90,
    chapterWindowDays: 7,
    eligibleTitleCount: 1,
    popularity: [],
    statuses: [],
    chapters: [],
  };
  const manifest = writeChunkedFrontendExports({
    exportDir,
    catalog: [{ id: 1, description: "Available during the initial catalogue download." }],
    tags: {},
    history: null,
    weeklyHistory,
    recommendations: [],
    updates,
    generatedAt: "2026-08-03T00:00:00.000Z",
  });
  assert.equal(manifest.datasets.history, undefined);
  assert.equal(manifest.datasets.weeklyHistory.count, 1);
  assert.equal(fs.existsSync(path.join(exportDir, manifest.datasets.weeklyHistory.chunks[0].path)), true);
  const catalogChunk = fs.readFileSync(path.join(exportDir, manifest.datasets.catalog.chunks[0].path));
  assert.equal(
    JSON.parse(zlib.gunzipSync(catalogChunk).toString("utf8"))[0].description,
    "Available during the initial catalogue download.",
  );
  assert.equal(manifest.datasets.updates.count, Object.keys(updates).length);
  assert.equal(fs.existsSync(path.join(exportDir, manifest.datasets.updates.chunks[0].path)), true);
});
