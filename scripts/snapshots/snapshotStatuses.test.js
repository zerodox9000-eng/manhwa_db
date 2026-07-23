const test = require("node:test");
const assert = require("node:assert/strict");
const { applySnapshot } = require("./snapshotStatuses");

function state() {
  return {
    schemaVersion: 1,
    lastSnapshotDate: null,
    currentStatuses: {},
    statusChanges: {},
    currentChapters: {},
    chapterChanges: {},
  };
}

test("records known status changes and chapter increases only", () => {
  const value = state();
  applySnapshot(value, { statuses: { 1: "releasing" }, chapters: { 1: 20 } }, "2026-07-20");
  applySnapshot(value, { statuses: { 1: "completed" }, chapters: { 1: 23 } }, "2026-07-21");
  assert.deepEqual(value.statusChanges[1], [{ date: "2026-07-21", from: "releasing", to: "completed" }]);
  assert.deepEqual(value.chapterChanges[1], [{ date: "2026-07-21", from: 20, to: 23 }]);

  applySnapshot(value, { statuses: {}, chapters: { 1: 22 } }, "2026-07-22");
  assert.equal(value.statusChanges[1].length, 1);
  assert.equal(value.chapterChanges[1].length, 1);
  assert.equal(value.currentChapters[1], 22);
});
