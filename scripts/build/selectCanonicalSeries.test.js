const test = require("node:test");
const assert = require("node:assert/strict");

const { selectCanonicalSeries } = require("./selectCanonicalSeries");

test("selects the newer year record when an ID moved between yearly files", () => {
  const result = selectCanonicalSeries([
    {
      sourceKey: "2023",
      sourceFile: "2023.series.json",
      entry: {
        id: 87259,
        year: 2023,
        content_rating: "safe",
        last_updated_at: "2026-09-01T10:40:41.731Z",
        source: {},
      },
    },
    {
      sourceKey: "2022",
      sourceFile: "2022.series.json",
      entry: {
        id: 87259,
        year: 2022,
        content_rating: "pornographic",
        last_updated_at: "2026-09-08T02:13:12.948Z",
        source: { anilist: { id: 147519 } },
      },
    },
  ]);

  assert.equal(result.selected.length, 1);
  assert.equal(result.selected[0].sourceKey, "2022");
  assert.equal(result.selected[0].entry.content_rating, "pornographic");
  assert.equal(result.resolvedDuplicates.length, 1);
  assert.equal(result.resolvedDuplicates[0].selected.source_key, "2022");
  assert.equal(result.quarantined.length, 0);
});

test("quarantines a conflicting duplicate when no unique newest record exists", () => {
  const result = selectCanonicalSeries([
    {
      sourceKey: "2022",
      sourceFile: "2022.series.json",
      entry: { id: 9001, year: 2022, content_rating: "safe", last_updated_at: "2026-09-08T00:00:00Z" },
    },
    {
      sourceKey: "2023",
      sourceFile: "2023.series.json",
      entry: { id: 9001, year: 2023, content_rating: "suggestive", last_updated_at: "2026-09-08T00:00:00Z" },
    },
  ]);

  assert.equal(result.selected.length, 0);
  assert.equal(result.resolvedDuplicates.length, 0);
  assert.equal(result.quarantined.length, 1);
  assert.equal(result.quarantined[0].id, "9001");
});

test("leaves unique records unchanged", () => {
  const row = {
    sourceKey: "2024",
    sourceFile: "2024.series.json",
    entry: { id: 42, year: 2024, last_updated_at: null },
  };

  const result = selectCanonicalSeries([row]);

  assert.deepEqual(result.selected, [row]);
  assert.deepEqual(result.resolvedDuplicates, []);
  assert.deepEqual(result.quarantined, []);
});
