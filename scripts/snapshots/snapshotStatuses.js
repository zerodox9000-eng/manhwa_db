const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "../..");
const SERIES_DIR = path.join(ROOT, "db/processed/by-year");
const STATE_PATH = path.join(ROOT, "db/state/status-history.json");
const KNOWN_STATUSES = new Set(["releasing", "completed", "hiatus", "cancelled", "upcoming"]);

function normalizeStatus(value) {
  const status = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return KNOWN_STATUSES.has(status) ? status : null;
}

function normalizeChapterCount(value) {
  if (value == null || value === "") return null;
  const count = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(count) && count >= 0 ? count : null;
}

function recordsFromJson(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.series)) return value.series;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function catalogSnapshotFromFiles(readFile, files) {
  const statuses = {};
  const chapters = {};
  for (const file of files.sort()) {
    const records = recordsFromJson(JSON.parse(readFile(file)));
    for (const record of records) {
      const id = Number(record?.id);
      const status = normalizeStatus(record?.status);
      const chapterCount = normalizeChapterCount(record?.total_chapters);
      if (!Number.isInteger(id) || id <= 0) continue;
      if (status) statuses[id] = status;
      if (chapterCount != null) chapters[id] = chapterCount;
    }
  }
  return { statuses, chapters };
}

function currentCatalogSnapshot() {
  const files = fs.readdirSync(SERIES_DIR)
    .filter((name) => name.endsWith(".series.json"))
    .map((name) => path.join(SERIES_DIR, name));
  return catalogSnapshotFromFiles((file) => fs.readFileSync(file, "utf8"), files);
}

function applySnapshot(state, snapshot, date) {
  const { statuses, chapters } = snapshot;
  for (const [id, next] of Object.entries(statuses)) {
    const previous = state.currentStatuses[id] ?? null;
    if (previous && previous !== next) {
      const changes = state.statusChanges[id] ?? [];
      const last = changes.at(-1);
      if (!last || last.date !== date || last.from !== previous || last.to !== next) {
        changes.push({ date, from: previous, to: next });
        state.statusChanges[id] = changes;
      }
    }
    state.currentStatuses[id] = next;
  }
  for (const [id, next] of Object.entries(chapters)) {
    const previous = state.currentChapters[id];
    if (Number.isFinite(previous) && next > previous) {
      const changes = state.chapterChanges[id] ?? [];
      const last = changes.at(-1);
      if (!last || last.date !== date || last.from !== previous || last.to !== next) {
        changes.push({ date, from: previous, to: next });
        state.chapterChanges[id] = changes;
      }
    }
    state.currentChapters[id] = next;
  }
  state.lastSnapshotDate = date;
}

function gitSnapshots() {
  const log = execFileSync(
    "git",
    ["log", "--reverse", "--format=%H|%cI", "--", "db/processed/by-year"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  ).trim();
  if (!log) return [];

  const byDate = new Map();
  for (const line of log.split(/\r?\n/)) {
    const [hash, timestamp] = line.split("|");
    const date = timestamp?.slice(0, 10);
    if (hash && date) byDate.set(date, hash);
  }
  return [...byDate.entries()].map(([date, hash]) => ({ date, hash }));
}

function catalogSnapshotAtCommit(hash) {
  const names = execFileSync(
    "git",
    ["ls-tree", "-r", "--name-only", hash, "--", "db/processed/by-year"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  ).trim().split(/\r?\n/).filter((name) => name.endsWith(".series.json"));
  return catalogSnapshotFromFiles(
    (name) => execFileSync("git", ["show", `${hash}:${name}`], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 100 * 1024 * 1024,
    }),
    names,
  );
}

function emptyState() {
  return {
    schemaVersion: 1,
    lastSnapshotDate: null,
    currentStatuses: {},
    statusChanges: {},
    currentChapters: {},
    chapterChanges: {},
  };
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, `${JSON.stringify(state)}\n`);
  const statusCount = Object.values(state.statusChanges).reduce((sum, changes) => sum + changes.length, 0);
  const chapterCount = Object.values(state.chapterChanges).reduce((sum, changes) => sum + changes.length, 0);
  console.log(`Title update history saved: ${statusCount} status transitions and ${chapterCount} chapter increases through ${state.lastSnapshotDate}.`);
}

function rebuild() {
  const state = emptyState();
  const snapshots = gitSnapshots();
  snapshots.forEach(({ date, hash }, index) => {
    applySnapshot(state, catalogSnapshotAtCommit(hash), date);
    console.log(`Status history ${index + 1}/${snapshots.length}: ${date}`);
  });
  const today = new Date().toISOString().slice(0, 10);
  applySnapshot(state, currentCatalogSnapshot(), today);
  writeState(state);
}

function snapshot() {
  const state = fs.existsSync(STATE_PATH)
    ? JSON.parse(fs.readFileSync(STATE_PATH, "utf8"))
    : emptyState();
  applySnapshot(state, currentCatalogSnapshot(), new Date().toISOString().slice(0, 10));
  writeState(state);
}

if (require.main === module) {
  if (process.argv.includes("--rebuild")) rebuild();
  else snapshot();
}

module.exports = { applySnapshot, catalogSnapshotFromFiles, normalizeChapterCount, normalizeStatus };
