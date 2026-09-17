const test = require("node:test");
const assert = require("node:assert/strict");

const {
  BATCH_SIZE,
  buildRosterBindings,
  chunk,
  indexBatchResults,
} = require("./updatePre2014Popular");

test("chunks 93 MangaBaka IDs into 50 and 43", () => {
  const ids = Array.from({ length: 93 }, (_, index) => index + 1);
  const result = chunk(ids);

  assert.equal(BATCH_SIZE, 50);
  assert.deepEqual(result.map((batch) => batch.length), [50, 43]);
  assert.deepEqual(result.flat(), ids);
});

test("binds each AniList roster entry to its saved MangaBaka ID", () => {
  const roster = [
    { anilist_id: 11, title: "First" },
    { anilist_id: 22, title: "Second" },
  ];
  const existing = [
    { id: 101, _pre2014_popular: { anilist_id: 11 } },
    { id: 202, _pre2014_popular: { anilist_id: 22 } },
  ];

  const result = buildRosterBindings(roster, existing);

  assert.deepEqual(result.map((binding) => binding.seriesId), [101, 202]);
  assert.deepEqual(result.map((binding) => binding.previous.id), [101, 202]);
});

test("indexes only requested records from a batch response", () => {
  const byId = new Map();
  const matched = indexBatchResults(
    [101, 202],
    [{ id: 101, title: "Requested" }, { id: 999, title: "Canonical alias" }],
    byId
  );

  assert.equal(matched, 1);
  assert.deepEqual([...byId.keys()], [101]);
});

test("rejects a missing saved ID instead of rediscovering through AniList", () => {
  assert.throws(
    () => buildRosterBindings(
      [{ anilist_id: 11, title: "Missing" }],
      []
    ),
    /has no saved MangaBaka ID/
  );
});
