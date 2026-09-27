const test = require("node:test");
const assert = require("node:assert/strict");
const { applySnapshot, chapterIncreaseSortDates } = require("./snapshotStatuses");

function state() {
  return {
    schemaVersion: 1,
    lastSnapshotDate: null,
    currentStatuses: {},
    statusChanges: {},
    currentChapters: {},
    chapterChanges: {},
    chapterIncreaseSortTrackingSince: null,
  };
}

test("records known status changes and chapter increases only", () => {
  const value = state();
  applySnapshot(value, { statuses: { 1: "releasing" }, chapters: { 1: 20 } }, "2026-07-20");
  applySnapshot(value, { statuses: { 1: "completed" }, chapters: { 1: 23 } }, "2026-07-21");
  assert.deepEqual(value.statusChanges[1], [{ date: "2026-07-21", from: "releasing", to: "completed" }]);
  assert.deepEqual(value.chapterChanges[1], [{ date: "2026-07-21", from: 20, to: 23 }]);
  assert.equal(value.chapterIncreaseSortTrackingSince, "2026-07-14");
  assert.deepEqual(chapterIncreaseSortDates(value), { 1: "2026-07-21" });

  applySnapshot(value, { statuses: {}, chapters: { 1: 22 } }, "2026-07-22");
  assert.equal(value.statusChanges[1].length, 1);
  assert.equal(value.chapterChanges[1].length, 1);
  assert.equal(value.currentChapters[1], 22);
});

test("derives post-rollout increase dates from the existing ledger without backfilling old events", () => {
  const value = state();
  value.chapterChanges[9] = [{ date: "2020-01-02", from: 3, to: 4 }];

  applySnapshot(value, { statuses: {}, chapters: { 1: 20 } }, "2026-07-20");
  applySnapshot(value, { statuses: {}, chapters: { 1: 21 } }, "2026-07-21");
  assert.deepEqual(chapterIncreaseSortDates(value), { 1: "2026-07-21" });

  applySnapshot(value, { statuses: {}, chapters: { 1: 19 } }, "2026-07-22");
  assert.deepEqual(chapterIncreaseSortDates(value), { 1: "2026-07-21" });
  applySnapshot(value, { statuses: {}, chapters: { 1: 22 } }, "2026-07-23");
  assert.deepEqual(chapterIncreaseSortDates(value), { 1: "2026-07-23" });

  const rebuilt = state();
  applySnapshot(rebuilt, { statuses: {}, chapters: { 1: 20 } }, "2026-07-20", { trackChapterIncreaseSort: false });
  applySnapshot(rebuilt, { statuses: {}, chapters: { 1: 21 } }, "2026-07-21", { trackChapterIncreaseSort: false });
  applySnapshot(rebuilt, { statuses: {}, chapters: { 1: 21 } }, "2026-07-23");
  assert.equal(rebuilt.chapterIncreaseSortTrackingSince, "2026-07-17");
  assert.deepEqual(chapterIncreaseSortDates(rebuilt), { 1: "2026-07-21" });
});
