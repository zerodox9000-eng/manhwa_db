const test = require("node:test");
const assert = require("node:assert/strict");
const {
  bandFor,
  buildChapterEvents,
  buildStatusEvents,
  discoverEligible,
} = require("./buildUpdatesExport");

function series(overrides = {}) {
  return {
    id: 1,
    content_rating: "safe",
    source: { anilist: { id: 1 } },
    stats: { popularity: 100 },
    analytics: { popularityPercentile: 75 },
    tag_ids: [],
    ...overrides,
  };
}

test("Discover eligibility matches the shipped content and band boundaries", () => {
  assert.equal(discoverEligible(series()), true);
  assert.equal(discoverEligible(series({ content_rating: "erotica" })), false);
  assert.equal(discoverEligible(series({ tag_ids: [4] })), false);
  assert.equal(discoverEligible(series({ analytics: { popularityPercentile: 69 }, tag_ids: [33] })), false);
  assert.equal(discoverEligible(series({ analytics: { popularityPercentile: 70 }, tag_ids: [33] })), true);
  assert.equal(bandFor(98.5), "top1");
});

test("status and chapter exports contain only eligible, valid observations", () => {
  const eligible = new Set([1]);
  const state = {
    statusChanges: {
      1: [
        { date: "2026-03-01", from: "hiatus", to: "releasing" },
        { date: "2026-07-19", from: "unknown", to: "releasing" },
        { date: "2026-07-20", from: "releasing", to: "completed" },
      ],
      2: [{ date: "2026-07-20", from: "releasing", to: "hiatus" }],
    },
    chapterChanges: {
      1: [
        { date: "2026-07-13", from: 30, to: 35 },
        { date: "2026-07-19", from: 44, to: 40 },
        { date: "2026-07-20", from: 40, to: 43 },
      ],
      2: [{ date: "2026-07-20", from: 10, to: 12 }],
    },
  };
  assert.deepEqual(buildStatusEvents(state, eligible, "2026-07-21"), [
    { id: 1, date: "2026-07-20", from: "releasing", to: "completed" },
  ]);
  assert.deepEqual(buildChapterEvents(state, eligible, "2026-07-21"), [
    { id: 1, date: "2026-07-20", from: 40, to: 43 },
  ]);
});

test("chapter exports omit dates above twice their rolling normal median", () => {
  const eligible = new Set(Array.from({ length: 12 }, (_, index) => index + 1));
  const chapterChanges = {};
  for (let day = 1; day <= 7; day += 1) {
    for (let id = 1; id <= 4; id += 1) {
      chapterChanges[id] ??= [];
      chapterChanges[id].push({ date: `2026-07-${String(day).padStart(2, "0")}`, from: day, to: day + 1 });
    }
  }
  for (let id = 1; id <= 9; id += 1) {
    chapterChanges[id] ??= [];
    chapterChanges[id].push({ date: "2026-07-08", from: 20, to: 21 });
  }
  for (let id = 1; id <= 5; id += 1) {
    chapterChanges[id] ??= [];
    chapterChanges[id].push({ date: "2026-07-09", from: 21, to: 22 });
  }

  const events = buildChapterEvents({ chapterChanges }, eligible, "2026-07-09");
  assert.equal(events.some((event) => event.date === "2026-07-08"), false);
  assert.equal(events.filter((event) => event.date === "2026-07-09").length, 5);
});
