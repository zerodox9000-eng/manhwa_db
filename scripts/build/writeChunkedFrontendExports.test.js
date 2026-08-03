const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
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
  const manifest = writeChunkedFrontendExports({
    exportDir,
    catalog: [{ id: 1 }],
    tags: {},
    history: null,
    weeklyHistory,
    recommendations: [],
    generatedAt: "2026-08-03T00:00:00.000Z",
  });
  assert.equal(manifest.datasets.history, undefined);
  assert.equal(manifest.datasets.weeklyHistory.count, 1);
  assert.equal(fs.existsSync(path.join(exportDir, manifest.datasets.weeklyHistory.chunks[0].path)), true);
});
