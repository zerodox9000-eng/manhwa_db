const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { popularityEventsFromState } = require("../history/popularityMilestoneState");

const WINDOW_DAYS = 365;
const STATUS_WINDOW_DAYS = 90;
const CHAPTER_WINDOW_DAYS = 7;
const CHAPTER_ANOMALY_BASELINE_DAYS = 30;
const CHAPTER_ANOMALY_MIN_BASELINE_DAYS = 7;
const DAY_MS = 86_400_000;
const COMMON_EXCLUDED_TAG_IDS = new Set([4, 180, 41, 10]);
const DEEP_CUT_EXTRA_EXCLUDED_TAG_IDS = new Set([33, 16]);
const KNOWN_STATUSES = new Set(["releasing", "completed", "hiatus", "cancelled", "upcoming"]);
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

function discoverEligible(series) {
  if (series.content_rating !== "safe" && series.content_rating !== "suggestive") return false;
  const hasAniList = Boolean(
    series.source?.anilist?.id ||
    Number.isFinite(series.stats?.popularity) ||
    Number.isFinite(series.stats?.favourites) ||
    Number.isFinite(series.stats?.meanScore),
  );
  if (!hasAniList || !Number.isFinite(series.stats?.popularity)) return false;
  const tags = new Set(series.tag_ids ?? []);
  if ([...COMMON_EXCLUDED_TAG_IDS].some((id) => tags.has(id))) return false;
  const currentBand = bandFor(series.analytics?.popularityPercentile);
  if (!currentBand) return false;
  if (currentBand === "deep-cut" && [...DEEP_CUT_EXTRA_EXCLUDED_TAG_IDS].some((id) => tags.has(id))) return false;
  return true;
}

function latestHistoryDate(history) {
  let latest = null;
  for (const entries of Object.values(history)) {
    for (const entry of entries ?? []) {
      if (entry.d && (!latest || entry.d > latest)) latest = entry.d;
    }
  }
  return latest;
}

function buildPopularityEvents(history, eligibleIds, latestDate) {
  if (!latestDate) return [];
  const cutoff = Date.parse(`${latestDate}T00:00:00Z`) - WINDOW_DAYS * DAY_MS;
  const events = [];
  for (const [id, rawEntries] of Object.entries(history)) {
    if (!eligibleIds.has(Number(id))) continue;
    const entries = [...(rawEntries ?? [])]
      .filter((entry) => entry.d && Number.isFinite(entry.pp))
      .sort((left, right) => left.d.localeCompare(right.d));
    let priorBand = null;
    const achieved = new Set();
    const milestones = {};
    for (const entry of entries) {
      const band = bandFor(entry.pp);
      const bandIndex = BANDS.findIndex((item) => item.id === band);
      if (priorBand === null) {
        for (let index = 0; index <= bandIndex; index += 1) achieved.add(BANDS[index].id);
        priorBand = band;
        continue;
      }
      if (band === priorBand) continue;
      const priorIndex = BANDS.findIndex((item) => item.id === priorBand);
      if (bandIndex > priorIndex) {
        for (let index = Math.max(0, priorIndex + 1); index <= bandIndex; index += 1) {
          const reached = BANDS[index].id;
          if (achieved.has(reached)) continue;
          achieved.add(reached);
          milestones[reached] = entry.d;
          if (Date.parse(`${entry.d}T00:00:00Z`) >= cutoff) {
            events.push({
              id: Number(id),
              date: entry.d,
              from: index === 0 ? null : BANDS[index - 1].id,
              to: reached,
              direction: "rising",
              popularityPercentile: Math.round(entry.pp),
              previousObservedDate: null,
              observedMilestones: { ...milestones },
            });
          }
        }
      }
      priorBand = band;
    }
  }
  return events.sort((left, right) =>
    right.date.localeCompare(left.date) || right.popularityPercentile - left.popularityPercentile
  );
}

function buildStatusEvents(state, eligibleIds, latestDate) {
  if (!latestDate || !state?.statusChanges) return [];
  const cutoff = Date.parse(`${latestDate}T00:00:00Z`) - (STATUS_WINDOW_DAYS - 1) * DAY_MS;
  const events = [];
  for (const [id, changes] of Object.entries(state.statusChanges)) {
    if (!eligibleIds.has(Number(id))) continue;
    for (const change of changes ?? []) {
      if (!change.date || Date.parse(`${change.date}T00:00:00Z`) < cutoff) continue;
      if (!KNOWN_STATUSES.has(change.from) || !KNOWN_STATUSES.has(change.to) || change.from === change.to) continue;
      events.push({ id: Number(id), date: change.date, from: change.from, to: change.to });
    }
  }
  return events.sort((left, right) => right.date.localeCompare(left.date) || left.id - right.id);
}

function buildChapterEvents(state, eligibleIds, latestDate) {
  if (!latestDate || !state?.chapterChanges) return [];
  const cutoff = Date.parse(`${latestDate}T00:00:00Z`) - (CHAPTER_WINDOW_DAYS - 1) * DAY_MS;
  const eventsByDate = new Map();
  for (const [id, changes] of Object.entries(state.chapterChanges)) {
    if (!eligibleIds.has(Number(id))) continue;
    for (const change of changes ?? []) {
      if (!change.date) continue;
      if (!Number.isFinite(change.from) || !Number.isFinite(change.to) || change.to <= change.from) continue;
      const events = eventsByDate.get(change.date) ?? [];
      events.push({ id: Number(id), date: change.date, from: change.from, to: change.to });
      eventsByDate.set(change.date, events);
    }
  }
  const normalDailyCounts = [];
  const anomalousDates = new Set();
  for (const date of [...eventsByDate.keys()].sort()) {
    const count = eventsByDate.get(date).length;
    if (normalDailyCounts.length >= CHAPTER_ANOMALY_MIN_BASELINE_DAYS) {
      const sorted = [...normalDailyCounts].sort((left, right) => left - right);
      const middle = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
      if (count > median * 2) {
        anomalousDates.add(date);
        continue;
      }
    }
    normalDailyCounts.push(count);
    if (normalDailyCounts.length > CHAPTER_ANOMALY_BASELINE_DAYS) normalDailyCounts.shift();
  }
  const events = [];
  for (const [date, dateEvents] of eventsByDate) {
    if (anomalousDates.has(date) || Date.parse(`${date}T00:00:00Z`) < cutoff) continue;
    events.push(...dateEvents);
  }
  return events.sort((left, right) => right.date.localeCompare(left.date) || left.id - right.id);
}

function writeUpdatesExport({ exportDir, catalog, history, generatedAt }) {
  const statePath = path.resolve(exportDir, "../../state/status-history.json");
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : null;
  const popularityStatePath = path.resolve(exportDir, "../../state/popularity-milestones.json");
  const popularityState = fs.existsSync(popularityStatePath)
    ? JSON.parse(fs.readFileSync(popularityStatePath, "utf8"))
    : null;
  const latestDate = [latestHistoryDate(history), state?.lastSnapshotDate, generatedAt.slice(0, 10)]
    .filter(Boolean)
    .sort()
    .at(-1);
  const eligibleIds = new Set(catalog.filter(discoverEligible).map((series) => series.id));
  const payload = {
    schemaVersion: 1,
    generatedAt,
    latestDate,
    windowDays: WINDOW_DAYS,
    statusWindowDays: STATUS_WINDOW_DAYS,
    chapterWindowDays: CHAPTER_WINDOW_DAYS,
    eligibleTitleCount: eligibleIds.size,
    popularity: popularityState
      ? popularityEventsFromState(popularityState, eligibleIds, latestDate)
      : buildPopularityEvents(history, eligibleIds, latestDate),
    statuses: buildStatusEvents(state, eligibleIds, latestDate),
    chapters: buildChapterEvents(state, eligibleIds, latestDate),
  };
  const outputPath = path.join(exportDir, "stats/updates.json");
  const json = `${JSON.stringify(payload)}\n`;
  fs.writeFileSync(outputPath, json);
  fs.writeFileSync(`${outputPath}.gz`, zlib.gzipSync(Buffer.from(json)));
  console.log(`Updates export: ${payload.popularity.length} popularity milestones, ${payload.statuses.length} status changes, ${payload.chapters.length} chapter increases.`);
  return payload;
}

module.exports = { bandFor, buildChapterEvents, buildPopularityEvents, buildStatusEvents, discoverEligible, writeUpdatesExport };
