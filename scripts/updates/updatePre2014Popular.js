require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const {
  COLLECTION_NAME,
  loadRoster,
  writeJsonAtomic,
} = require("../curation/pre2014Popular");

const ROOT = path.resolve(__dirname, "../..");
const API = process.env.MANGABAKA_API || "https://api.mangabaka.org";
const RAW_FILE = path.join(ROOT, "db/raw/collections/pre2014-popular.json");
const CHANGELOG_DIR = path.join(ROOT, "db/updates/changelog");
const REQUEST_TIMEOUT_MS = Number(process.env.MANGABAKA_REQUEST_TIMEOUT_MS || 30000);
const REQUEST_DELAY_MS = Number(process.env.PRE2014_POPULAR_REQUEST_DELAY_MS || 500);
const MAX_RETRIES = 5;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504, 520, 522, 524, 530]);
const RETRYABLE_CODES = new Set(["ECONNABORTED", "ECONNRESET", "ETIMEDOUT"]);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function retryDelayMs(error, attempt) {
  const retryAfterSeconds = Number(error.response?.headers?.["retry-after"]);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return retryAfterSeconds * 1000;
  }
  return Math.min(30000, 2000 * attempt * attempt);
}

function isRetryableError(error) {
  return RETRYABLE_STATUSES.has(error.response?.status) ||
    RETRYABLE_CODES.has(error.code);
}

function isNotFound(error) {
  return Number(error.response?.status) === 404;
}

function readExisting() {
  if (!fs.existsSync(RAW_FILE)) return [];
  const value = JSON.parse(fs.readFileSync(RAW_FILE, "utf8"));
  if (!Array.isArray(value)) throw new Error("Pre-2014 popular raw collection must be an array.");
  return value;
}

function rosterIdFor(entry) {
  return Number(
    entry?._pre2014_popular?.anilist_id ??
    entry?._collection?.anilist_id ??
    entry?.source?.anilist?.id
  );
}

function selectCurrentSeries(series, anilistId) {
  const matching = series.filter((entry) =>
    Number(entry?.source?.anilist?.id) === anilistId ||
    Number(entry?._pre2014_popular?.anilist_id) === anilistId
  );
  const candidates = matching.length > 0 ? matching : series;

  return [...candidates].sort((left, right) => {
    const leftActive = left?.state === "active" && !left?.merged_with ? 1 : 0;
    const rightActive = right?.state === "active" && !right?.merged_with ? 1 : 0;
    if (leftActive !== rightActive) return rightActive - leftActive;
    return String(right?.last_updated_at || "").localeCompare(String(left?.last_updated_at || ""));
  })[0] || null;
}

async function fetchSeriesForAniList(anilistId) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await axios.get(
        `${API}/v1/source/anilist/${anilistId}`,
        {
          params: {
            with_series: true,
            with_merged_series: true,
          },
          timeout: REQUEST_TIMEOUT_MS,
        }
      );

      const series = response.data?.data?.series;
      if (!Array.isArray(series)) {
        throw new Error(`MangaBaka AniList lookup ${anilistId} returned no series array.`);
      }

      return {
        series: selectCurrentSeries(series, anilistId),
        status: response.status,
      };
    } catch (error) {
      if (isNotFound(error)) {
        return { series: null, status: 404 };
      }

      if (!isRetryableError(error) || attempt === MAX_RETRIES) {
        throw new Error(`MangaBaka AniList lookup failed for ${anilistId}`, { cause: error });
      }

      const delay = retryDelayMs(error, attempt);
      console.log(
        `Pre-2014 popular AniList ${anilistId} API error ${error.response?.status || error.code}. ` +
        `Retry ${attempt}/${MAX_RETRIES} after ${delay}ms.`
      );
      await sleep(delay);
    }
  }

  throw new Error(`Unable to fetch MangaBaka record for AniList ${anilistId}.`);
}

function withCollectionMetadata(series, rosterEntry, previous) {
  const previousFirstSeen = previous?.first_seen_at || previous?._first_seen_at || null;
  const firstSeenAt = previousFirstSeen || series.first_seen_at || series._first_seen_at || new Date().toISOString();
  const firstSeenTrusted = previous
    ? previous.first_seen_at_is_trusted === true || previous._first_seen_at_is_trusted === true
    : series.first_seen_at_is_trusted === true || series._first_seen_at_is_trusted === true;

  return {
    ...series,
    first_seen_at: firstSeenAt,
    first_seen_at_is_trusted: firstSeenTrusted,
    _pre2014_popular: {
      collection: COLLECTION_NAME,
      anilist_id: rosterEntry.anilist_id,
      anilist_title: rosterEntry.title,
      anilist_release_year: rosterEntry.release_year,
      anilist_popularity_at_seed: rosterEntry.popularity,
      refreshed_at: new Date().toISOString(),
    },
  };
}

function changed(left, right) {
  return JSON.stringify(left) !== JSON.stringify(right);
}

async function main() {
  const roster = loadRoster();
  const existing = readExisting();
  const existingByRosterId = new Map(
    existing
      .map((entry) => [rosterIdFor(entry), entry])
      .filter(([id]) => Number.isSafeInteger(id) && id > 0)
  );
  const fresh = [];
  const unresolved = [];
  const seenSeriesIds = new Map();

  console.log(`Refreshing ${roster.entries.length} pre-2014 popular AniList titles through MangaBaka.`);

  for (let index = 0; index < roster.entries.length; index += 1) {
    const rosterEntry = roster.entries[index];
    const result = await fetchSeriesForAniList(rosterEntry.anilist_id);

    if (!result.series) {
      unresolved.push({
        anilist_id: rosterEntry.anilist_id,
        title: rosterEntry.title,
        status: result.status,
      });
    } else {
      const seriesId = Number(result.series.id);
      const previousMatch = existingByRosterId.get(rosterEntry.anilist_id);
      if (seenSeriesIds.has(seriesId)) {
        const prior = seenSeriesIds.get(seriesId);
        throw new Error(
          `Pre-2014 popular roster resolved multiple AniList IDs to MangaBaka ${seriesId}: ` +
          `${prior} and ${rosterEntry.anilist_id}.`
        );
      }
      seenSeriesIds.set(seriesId, rosterEntry.anilist_id);
      fresh.push(withCollectionMetadata(result.series, rosterEntry, previousMatch));
    }

    console.log(
      `Pre-2014 popular ${index + 1}/${roster.entries.length}: ` +
      `${rosterEntry.anilist_id} ${result.series ? `-> MangaBaka ${result.series.id}` : "unresolved"}`
    );

    if (index + 1 < roster.entries.length) await sleep(REQUEST_DELAY_MS);
  }

  const oldById = new Map(existing.map((entry) => [entry.id, entry]));
  const changes = [];
  for (const entry of fresh) {
    const old = oldById.get(entry.id);
    if (!old) {
      changes.push({ type: "new", id: entry.id, title: entry.title });
    } else if (changed(old, entry)) {
      changes.push({ type: "updated", id: entry.id, title: entry.title });
    }
  }
  for (const old of existing) {
    if (!fresh.some((entry) => entry.id === old.id)) {
      changes.push({ type: "removed", id: old.id, title: old.title });
    }
  }

  writeJsonAtomic(RAW_FILE, fresh);
  const today = new Date().toISOString().slice(0, 10);
  writeJsonAtomic(
    path.join(CHANGELOG_DIR, `${today}-pre2014-popular.json`),
    {
      collection: COLLECTION_NAME,
      roster_count: roster.entries.length,
      resolved_count: fresh.length,
      unresolved,
      changes,
      refreshed_at: new Date().toISOString(),
    }
  );

  console.log(
    `Pre-2014 popular refresh complete: ${fresh.length}/${roster.entries.length} resolved; ` +
    `${unresolved.length} unresolved.`
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  fetchSeriesForAniList,
  selectCurrentSeries,
};
