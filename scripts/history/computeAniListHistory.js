const fs = require("fs");
const path = require("path");

function upperBound(sorted, value) {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (sorted[middle] <= value) low = middle + 1;
    else high = middle;
  }
  return low;
}

function percentileRank(sorted, value) {
  return sorted.length === 0 ? 0 : (upperBound(sorted, value) / sorted.length) * 100;
}

function historyEntriesForSnapshot(data, date) {
  const dayEntries = data.map((entry) => {
    const popularity = entry.popularity || 0;
    const favourites = entry.favourites || 0;
    return {
      id: entry.id,
      popularity,
      favourites,
      meanScore: entry.meanScore || null,
      rawRatio: popularity > 0 ? (favourites / popularity) * 100 : 0,
    };
  });
  const popularityValues = dayEntries
    .map((entry) => Math.log10(Math.max(entry.popularity, 1)))
    .sort((left, right) => left - right);
  const ratioValues = dayEntries
    .map((entry) => entry.rawRatio)
    .sort((left, right) => left - right);
  const scored = dayEntries.map((entry) => {
    const popularityLog = Math.log10(Math.max(entry.popularity, 1));
    const popularityPercentile = percentileRank(popularityValues, popularityLog);
    const ratioPercentile = percentileRank(ratioValues, entry.rawRatio);
    const confidenceWeight = 1 / (1 + Math.exp(-((popularityPercentile - 20) / 12)));
    const discoveryScore = ratioPercentile * confidenceWeight;
    return { ...entry, popularityPercentile, ratioPercentile, discoveryScore };
  });
  const discoveryValues = scored
    .map((entry) => entry.discoveryScore)
    .sort((left, right) => left - right);

  return scored.map((entry) => ({
    id: entry.id,
    value: {
      d: date,
      p: entry.popularity,
      f: entry.favourites,
      s: entry.meanScore,
      r: Number(entry.rawRatio.toFixed(4)),
      rp: Number(entry.ratioPercentile.toFixed(4)),
      pp: Number(entry.popularityPercentile.toFixed(4)),
      ds: Number(entry.discoveryScore.toFixed(4)),
      dp: Number(percentileRank(discoveryValues, entry.discoveryScore).toFixed(4)),
    },
  }));
}

function buildHistoryFromSnapshots(snapshotDir, filenames) {
  const selected = (filenames ?? fs.readdirSync(snapshotDir).filter((name) => name.endsWith(".json")))
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .sort();
  const history = {};
  for (const filename of selected) {
    const date = filename.slice(0, 10);
    const data = JSON.parse(fs.readFileSync(path.join(snapshotDir, filename), "utf8"));
    if (!Array.isArray(data)) throw new Error(`${filename} is not an AniList snapshot array.`);
    for (const entry of historyEntriesForSnapshot(data, date)) {
      history[entry.id] ??= [];
      history[entry.id].push(entry.value);
    }
  }
  return history;
}

module.exports = { buildHistoryFromSnapshots, historyEntriesForSnapshot, percentileRank };
