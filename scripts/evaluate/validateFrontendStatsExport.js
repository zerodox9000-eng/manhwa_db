const fs = require("fs");
const path = require("path");

const EXPORT_DIR = path.resolve(__dirname, "../../db/exports/frontend");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, relativePath), "utf-8"));
}

function isDateLike(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(Date.parse(value));
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

function validateSeries(series, errors) {
  assert(series && Number.isInteger(series.id), "Series id must be an integer", errors);
  assert(series.stats && typeof series.stats === "object", `Series ${series.id} missing stats object`, errors);
  assert(series.analytics && typeof series.analytics === "object", `Series ${series.id} missing analytics object`, errors);

  for (const key of ["popularity", "favourites", "meanScore"]) {
    const value = series.stats?.[key];
    assert(value == null || typeof value === "number", `Series ${series.id} stats.${key} must be number/null`, errors);
  }

  const fanRank = series.analytics?.fanFavouriteDiscoveryPercentile;
  assert(fanRank == null || (typeof fanRank === "number" && fanRank >= 0 && fanRank <= 100), `Series ${series.id} Fan Rank outside 0-100/null`, errors);

  const fanPct = series.analytics?.fanFavouriteRaw;
  assert(fanPct == null || (typeof fanPct === "number" && fanPct >= 0), `Series ${series.id} Fan% invalid`, errors);

  const published = series.published ?? {};
  for (const field of ["start_date", "end_date"]) {
    const value = published[field];
    assert(value == null || isDateLike(value), `Series ${series.id} published.${field} is not parseable`, errors);
  }
  assert(series.first_seen_at == null || isDateLike(series.first_seen_at), `Series ${series.id} first_seen_at is not parseable`, errors);
  assert(series.last_updated_at == null || isDateLike(series.last_updated_at), `Series ${series.id} last_updated_at is not parseable`, errors);

  const rank = series.mangabaka_latest_rank;
  assert(rank == null || (Number.isInteger(rank) && rank > 0), `Series ${series.id} latest rank must be positive integer/null`, errors);
}

function validateHistory(history, seriesIds, errors) {
  for (const [id, entries] of Object.entries(history)) {
    assert(seriesIds.has(Number(id)), `History id ${id} not present in series export`, errors);
    assert(Array.isArray(entries), `History ${id} must be an array`, errors);
    let previous = "";
    for (const entry of entries) {
      assert(isDateLike(entry.d), `History ${id} has invalid d`, errors);
      assert(entry.d >= previous, `History ${id} is not sorted by date`, errors);
      previous = entry.d;
      for (const key of ["p", "f", "r", "rp", "pp", "ds", "dp"]) {
        assert(typeof entry[key] === "number", `History ${id}.${key} must be a number`, errors);
      }
      assert(entry.s == null || typeof entry.s === "number", `History ${id}.s must be number/null`, errors);
    }
  }
}

function main() {
  const errors = [];
  const series = readJson("series/all.json");
  const history = readJson("stats/history.json");
  const seriesIds = new Set(series.map((entry) => entry.id));

  for (const entry of series) validateSeries(entry, errors);
  validateHistory(history, seriesIds, errors);

  if (errors.length > 0) {
    console.error(`Frontend export validation failed with ${errors.length} issue(s):`);
    for (const error of errors.slice(0, 80)) console.error(`- ${error}`);
    if (errors.length > 80) console.error(`...and ${errors.length - 80} more`);
    process.exit(1);
  }

  console.log(`Frontend export validation passed for ${series.length.toLocaleString()} series and ${Object.keys(history).length.toLocaleString()} history tracks.`);
}

main();
