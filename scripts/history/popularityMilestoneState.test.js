const assert = require("node:assert/strict");
const test = require("node:test");
const {
  popularityEventsFromState,
  updatePopularityMilestoneState,
} = require("./popularityMilestoneState");

const row = (d, pp) => ({ d, pp });

test("keeps first observations quiet and emits each upward milestone once", () => {
  const state = updatePopularityMilestoneState(null, {
    1: [row("2026-07-01", 75), row("2026-07-02", 85), row("2026-07-03", 75), row("2026-07-04", 85)],
  });
  assert.deepEqual(popularityEventsFromState(state, new Set([1])), [{
    id: 1,
    date: "2026-07-02",
    from: "underground",
    to: "upcoming",
    direction: "rising",
    popularityPercentile: 85,
    previousObservedDate: null,
    observedMilestones: { upcoming: "2026-07-02" },
  }]);
});

test("replaces same-day observations without duplicating or retaining false milestones", () => {
  let state = updatePopularityMilestoneState(null, {
    1: [row("2026-07-01", 75), row("2026-07-02", 85)],
  });
  state = updatePopularityMilestoneState(state, { 1: [row("2026-07-02", 95)] });
  assert.deepEqual(popularityEventsFromState(state, new Set([1])).map((event) => event.to), [
    "upcoming",
    "mainstream",
  ]);
  assert.equal(state.tracks[1].events.length, 2);
});
