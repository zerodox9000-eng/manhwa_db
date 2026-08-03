function earliestHistoryDate(history) {
  return Object.values(history)
    .flatMap((entries) => entries?.[0]?.d ? [entries[0].d] : [])
    .sort()[0] ?? null;
}

function updateFirstSeenState(state, history) {
  const creating = state == null;
  const next = state ?? {
    schemaVersion: 1,
    baselineDate: earliestHistoryDate(history),
    baselineIds: [],
    firstSeenById: {},
  };
  if (
    next.schemaVersion !== 1 ||
    !Array.isArray(next.baselineIds) ||
    typeof next.firstSeenById !== "object"
  ) {
    throw new Error("Unsupported AniList first-seen state.");
  }
  if (!next.baselineDate) next.baselineDate = earliestHistoryDate(history);
  const baselineIds = new Set(next.baselineIds.map(String));
  for (const [id, entries] of Object.entries(history)) {
    const firstDate = entries?.[0]?.d ?? null;
    if (creating && firstDate === next.baselineDate) baselineIds.add(id);
    if (
      firstDate &&
      firstDate !== next.baselineDate &&
      !baselineIds.has(id) &&
      !next.firstSeenById[id]
    ) {
      next.firstSeenById[id] = firstDate;
    }
  }
  next.baselineIds = [...baselineIds].sort((left, right) => Number(left) - Number(right));
  return next;
}

function firstSeenDate(state, id, lastUpdatedAt) {
  return state.firstSeenById[id] ?? lastUpdatedAt?.slice(0, 10) ?? null;
}

module.exports = { earliestHistoryDate, firstSeenDate, updateFirstSeenState };
