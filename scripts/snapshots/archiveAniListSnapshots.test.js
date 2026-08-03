const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const zlib = require("zlib");
const { archiveAniListSnapshots } = require("./archiveAniListSnapshots");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aeon-history-archive-"));
  const sourceDir = path.join(root, "source");
  const archiveDir = path.join(root, "archive");
  fs.mkdirSync(sourceDir, { recursive: true });
  for (let day = 1; day <= 16; day += 1) {
    const date = `2026-07-${String(day).padStart(2, "0")}`;
    fs.writeFileSync(
      path.join(sourceDir, `${date}.json`),
      JSON.stringify([{ id: day, popularity: day * 10, favourites: day, meanScore: 70 }]),
    );
  }
  return { root, sourceDir, archiveDir };
}

test("archives verified daily gzip files and retains the newest safety buffer", (context) => {
  const { root, sourceDir, archiveDir } = fixture();
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const result = archiveAniListSnapshots({ sourceDir, archiveDir, bufferDays: 14, prune: true });
  assert.equal(result.manifest.snapshotCount, 16);
  assert.equal(result.pruned, 2);
  assert.deepEqual(fs.readdirSync(sourceDir).sort(), Array.from({ length: 14 }, (_, index) =>
    `2026-07-${String(index + 3).padStart(2, "0")}.json`
  ));

  const first = result.manifest.snapshots[0];
  const restored = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(archiveDir, first.path))));
  assert.deepEqual(restored, [{ id: 1, popularity: 10, favourites: 1, meanScore: 70 }]);
});

test("never prunes source snapshots when any source cannot be archived", (context) => {
  const { root, sourceDir, archiveDir } = fixture();
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(sourceDir, "2026-07-08.json"), "not json");

  assert.throws(
    () => archiveAniListSnapshots({ sourceDir, archiveDir, bufferDays: 14, prune: true }),
    /Unexpected token|JSON/,
  );
  assert.equal(fs.readdirSync(sourceDir).filter((name) => name.endsWith(".json")).length, 16);
});

test("is idempotent and safely replaces a corrected same-day snapshot", (context) => {
  const { root, sourceDir, archiveDir } = fixture();
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  archiveAniListSnapshots({ sourceDir, archiveDir });
  const corrected = [{ id: 1, popularity: 999, favourites: 2, meanScore: 71 }];
  fs.writeFileSync(path.join(sourceDir, "2026-07-01.json"), JSON.stringify(corrected));

  const result = archiveAniListSnapshots({ sourceDir, archiveDir });
  const entry = result.manifest.snapshots.find((item) => item.date === "2026-07-01");
  const restored = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(archiveDir, entry.path))));
  assert.deepEqual(restored, corrected);
});

test("refuses to prune when any previously archived snapshot is missing", (context) => {
  const { root, sourceDir, archiveDir } = fixture();
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const first = archiveAniListSnapshots({ sourceDir, archiveDir, bufferDays: 14, prune: true });
  fs.rmSync(path.join(archiveDir, first.manifest.snapshots[0].path));
  for (const day of [17, 18]) {
    fs.writeFileSync(
      path.join(sourceDir, `2026-07-${day}.json`),
      JSON.stringify([{ id: day, popularity: day * 10, favourites: day, meanScore: 70 }]),
    );
  }

  assert.throws(
    () => archiveAniListSnapshots({ sourceDir, archiveDir, bufferDays: 14, prune: true }),
    /ENOENT/,
  );
  assert.equal(fs.readdirSync(sourceDir).filter((name) => name.endsWith(".json")).length, 16);
});
