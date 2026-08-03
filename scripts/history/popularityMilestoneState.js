const DAY_MS = 86_400_000;
const WINDOW_DAYS = 365;
const BANDS = [
  { id: "deep-cut", min: 0, max: 69 },
  { id: "underground", min: 70, max: 79 },
  { id: "upcoming", min: 80, max: 89 },
  { id: "mainstream", min: 90, max: 98 },
  { id: "top1", min: 99, max: 100 },
];

function bandFor(value) {
  const displayed = Math.round(Number(value));
  return BANDS.find((band) => displayed >= band.min && displayed <= band.max)?.id ?? null;
}

function cloneCheckpoint(track) {
  return {
    band: track.band,
    achieved: [...track.achieved],
    milestones: { ...track.milestones },
  };
}

function restoreSameDay(track, date) {
  if (track.lastDate !== date || !track.beforeLast) return;
  track.band = track.beforeLast.band;
  track.achieved = [...track.beforeLast.achieved];
  track.milestones = { ...track.beforeLast.milestones };
  track.events = track.events.filter((event) => event.date !== date);
  track.lastDate = null;
  track.lastPp = null;
  track.beforeLast = null;
}

function applyObservation(track, entry) {
  const band = bandFor(entry.pp);
  if (!band || !entry.d) return;
  restoreSameDay(track, entry.d);
  if (track.lastDate && entry.d < track.lastDate) {
    throw new Error(`Popularity observation ${entry.d} precedes state ${track.lastDate}.`);
  }
  const beforeLast = cloneCheckpoint(track);
  const bandIndex = BANDS.findIndex((item) => item.id === band);
  if (track.band === null) {
    for (let index = 0; index <= bandIndex; index += 1) track.achieved.push(BANDS[index].id);
  } else if (band !== track.band) {
    const priorIndex = BANDS.findIndex((item) => item.id === track.band);
    if (bandIndex > priorIndex) {
      for (let index = Math.max(0, priorIndex + 1); index <= bandIndex; index += 1) {
        const reached = BANDS[index].id;
        if (track.achieved.includes(reached)) continue;
        track.achieved.push(reached);
        track.milestones[reached] = entry.d;
        track.events.push({
          date: entry.d,
          from: index === 0 ? null : BANDS[index - 1].id,
          to: reached,
          direction: "rising",
          popularityPercentile: Math.round(entry.pp),
          previousObservedDate: null,
          observedMilestones: { ...track.milestones },
        });
      }
    }
  }
  track.band = band;
  track.lastDate = entry.d;
  track.lastPp = entry.pp;
  track.beforeLast = beforeLast;
}

function emptyTrack() {
  return {
    band: null,
    achieved: [],
    milestones: {},
    events: [],
    lastDate: null,
    lastPp: null,
    beforeLast: null,
  };
}

function updatePopularityMilestoneState(state, history) {
  const next = state ?? { schemaVersion: 1, lastDate: null, tracks: {} };
  if (next.schemaVersion !== 1 || typeof next.tracks !== "object") {
    throw new Error("Unsupported popularity milestone state.");
  }
  let latestDate = next.lastDate;
  for (const [id, rawEntries] of Object.entries(history)) {
    const track = next.tracks[id] ?? emptyTrack();
    const entries = [...(rawEntries ?? [])]
      .filter((entry) => entry?.d && Number.isFinite(entry.pp))
      .sort((left, right) => left.d.localeCompare(right.d));
    for (const entry of entries) {
      if (track.lastDate && entry.d < track.lastDate) continue;
      applyObservation(track, entry);
      if (!latestDate || entry.d > latestDate) latestDate = entry.d;
    }
    next.tracks[id] = track;
  }
  next.lastDate = latestDate;
  if (latestDate) {
    const cutoff = Date.parse(`${latestDate}T00:00:00Z`) - WINDOW_DAYS * DAY_MS;
    for (const track of Object.values(next.tracks)) {
      track.events = track.events.filter(
        (event) => Date.parse(`${event.date}T00:00:00Z`) >= cutoff,
      );
    }
  }
  return next;
}

function popularityEventsFromState(state, eligibleIds, latestDate = state?.lastDate) {
  if (!state || !latestDate) return [];
  const cutoff = Date.parse(`${latestDate}T00:00:00Z`) - WINDOW_DAYS * DAY_MS;
  const events = [];
  for (const [id, track] of Object.entries(state.tracks)) {
    if (!eligibleIds.has(Number(id))) continue;
    for (const event of track.events ?? []) {
      if (Date.parse(`${event.date}T00:00:00Z`) < cutoff) continue;
      events.push({ id: Number(id), ...event });
    }
  }
  return events.sort((left, right) =>
    right.date.localeCompare(left.date) || right.popularityPercentile - left.popularityPercentile
  );
}

module.exports = { BANDS, bandFor, popularityEventsFromState, updatePopularityMilestoneState };
