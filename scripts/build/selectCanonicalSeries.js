function parseTimestamp(value) {
  if (typeof value !== "string" || !value.trim()) return null;

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function entryForRow(row) {
  return row && row.entry ? row.entry : row;
}

function rowId(row) {
  const entry = entryForRow(row);
  return entry?.id == null ? null : String(entry.id);
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = stableJson(value[key]);
        return result;
      }, {});
  }

  return value;
}

function sameEntry(left, right) {
  return JSON.stringify(stableJson(entryForRow(left))) === JSON.stringify(stableJson(entryForRow(right)));
}

function rowSortKey(row) {
  return `${row.sourceKey || ""}\u0000${row.sourceFile || ""}`;
}

function summarizeRow(row) {
  const entry = entryForRow(row);

  return {
    source_key: row.sourceKey || null,
    source_file: row.sourceFile || null,
    year: entry?.year ?? null,
    title: entry?.display_title || entry?.mangabaka_title || null,
    last_updated_at: entry?.last_updated_at || null,
  };
}

function summarySortKey(summary) {
  return `${summary.source_key || ""}\u0000${summary.source_file || ""}`;
}

/**
 * Select one canonical processed record per MangaBaka ID.
 *
 * A newer last_updated_at is considered authoritative because the same ID can
 * remain in an old year file after its year changes. If the candidates cannot
 * be resolved deterministically, only that ID is quarantined from the export.
 */
function selectCanonicalSeries(rows) {
  const grouped = new Map();

  for (const row of rows) {
    const id = rowId(row);
    if (id == null) continue;

    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(row);
  }

  const selected = [];
  const resolvedDuplicates = [];
  const quarantined = [];

  for (const [id, candidates] of [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (candidates.length === 1) {
      selected.push(candidates[0]);
      continue;
    }

    const withTimestamps = candidates
      .map((candidate) => ({
        candidate,
        timestamp: parseTimestamp(entryForRow(candidate)?.last_updated_at),
      }))
      .filter((item) => item.timestamp != null);

    if (withTimestamps.length > 0) {
      const newestTimestamp = Math.max(...withTimestamps.map((item) => item.timestamp));
      const newest = withTimestamps.filter((item) => item.timestamp === newestTimestamp);

      if (newest.length === 1) {
        const chosen = newest[0].candidate;
        selected.push(chosen);
        resolvedDuplicates.push({
          id,
          resolution: "newest-last-updated-at",
          selected: summarizeRow(chosen),
          candidates: candidates.map(summarizeRow).sort((left, right) => summarySortKey(left).localeCompare(summarySortKey(right))),
        });
        continue;
      }

      if (newest.every((item) => sameEntry(item.candidate, newest[0].candidate))) {
        const chosen = [...newest]
          .sort((left, right) => rowSortKey(left.candidate).localeCompare(rowSortKey(right.candidate)))[0]
          .candidate;
        selected.push(chosen);
        resolvedDuplicates.push({
          id,
          resolution: "identical-newest-records",
          selected: summarizeRow(chosen),
          candidates: candidates.map(summarizeRow).sort((left, right) => summarySortKey(left).localeCompare(summarySortKey(right))),
        });
        continue;
      }
    } else if (candidates.every((candidate) => sameEntry(candidate, candidates[0]))) {
      const chosen = [...candidates].sort((left, right) => rowSortKey(left).localeCompare(rowSortKey(right)))[0];
      selected.push(chosen);
      resolvedDuplicates.push({
        id,
        resolution: "identical-records",
        selected: summarizeRow(chosen),
        candidates: candidates.map(summarizeRow).sort((left, right) => summarySortKey(left).localeCompare(summarySortKey(right))),
      });
      continue;
    }

    quarantined.push({
      id,
      reason: "conflicting-duplicate-without-unique-newest-record",
      candidates: candidates
        .map(summarizeRow)
        .sort((left, right) => summarySortKey(left).localeCompare(summarySortKey(right))),
    });
  }

  return { selected, resolvedDuplicates, quarantined };
}

module.exports = {
  parseTimestamp,
  selectCanonicalSeries,
};
