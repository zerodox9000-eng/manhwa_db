const assert = require("node:assert/strict");
const test = require("node:test");
const { firstSeenDate, updateFirstSeenState } = require("./firstSeenState");

test("preserves historical first-seen dates after old snapshots leave the active buffer", () => {
  let state = updateFirstSeenState(null, {
    1: [{ d: "2026-05-15" }],
    2: [{ d: "2026-06-01" }],
  });
  state = updateFirstSeenState(state, {
    1: [{ d: "2026-07-20" }],
    2: [{ d: "2026-07-20" }],
    3: [{ d: "2026-07-20" }],
  });
  assert.equal(firstSeenDate(state, 1, "2026-08-01T00:00:00Z"), "2026-08-01");
  assert.equal(firstSeenDate(state, 2, "2026-08-01T00:00:00Z"), "2026-06-01");
  assert.equal(firstSeenDate(state, 3, "2026-08-01T00:00:00Z"), "2026-07-20");
});
