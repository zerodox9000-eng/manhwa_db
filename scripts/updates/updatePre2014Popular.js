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
const BATCH_SIZE = 50;
const configuredMissingFallbacks = Number(
  process.env.PRE2014_POPULAR_MAX_MISSING_FALLBACKS || 10
);
const MAX_MISSING_FALLBACKS = Number.isSafeInteger(configuredMissingFallbacks) &&
  configuredMissingFallbacks >= 0
  ? configuredMissingFallbacks
  : 10;
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

function mangaBakaIdFor(entry, label) {
  const id = Number(entry?.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error(`${label} must contain a positive MangaBaka ID.`);
  }
  return id;
}

function chunk(values, size = BATCH_SIZE) {
  if (!Array.isArray(values)) throw new Error("Values to chunk must be an array.");
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error("Chunk size must be positive.");

  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function buildRosterBindings(rosterEntries, existing) {
  const existingByRosterId = new Map();

  existing.forEach((entry, index) => {
    const anilistId = rosterIdFor(entry);
    if (!Number.isSafeInteger(anilistId) || anilistId <= 0) {
      throw new Error(`Pre-2014 popular raw entry ${index + 1} has no valid AniList ID.`);
    }

    const seriesId = mangaBakaIdFor(entry, `Pre-2014 popular raw entry ${index + 1}`);
    if (existingByRosterId.has(anilistId)) {
      throw new Error(`Pre-2014 popular raw collection contains duplicate AniList ID ${anilistId}.`);
    }

    existingByRosterId.set(anilistId, { entry, seriesId });
  });

  const seenSeriesIds = new Map();
  return rosterEntries.map((rosterEntry, index) => {
    const previous = existingByRosterId.get(rosterEntry.anilist_id);
    if (!previous) {
      throw new Error(
        `Pre-2014 popular roster entry ${index + 1} (AniList ${rosterEntry.anilist_id}) ` +
        "has no saved MangaBaka ID. The one-time collection must be seeded before the daily refresh can run."
      );
    }

    if (seenSeriesIds.has(previous.seriesId)) {
      const prior = seenSeriesIds.get(previous.seriesId);
      throw new Error(
        `Pre-2014 popular roster maps multiple AniList IDs to MangaBaka ${previous.seriesId}: ` +
        `${prior} and ${rosterEntry.anilist_id}.`
      );
    }
    seenSeriesIds.set(previous.seriesId, rosterEntry.anilist_id);

    return {
      rosterEntry,
      previous: previous.entry,
      seriesId: previous.seriesId,
    };
  });
}

function indexBatchResults(requestedIds, series, byId) {
  const requested = new Set(requestedIds);
  let matched = 0;

  for (const entry of series) {
    const seriesId = mangaBakaIdFor(entry, "MangaBaka batch response entry");
    if (!requested.has(seriesId)) continue;

    if (byId.has(seriesId)) {
      throw new Error(`MangaBaka batch responses returned duplicate series ID ${seriesId}.`);
    }

    byId.set(seriesId, entry);
    matched += 1;
  }

  return matched;
}

async function fetchSeriesBatch(seriesIds) {
  if (seriesIds.length < 1 || seriesIds.length > BATCH_SIZE) {
    throw new Error(`MangaBaka batch must contain between 1 and ${BATCH_SIZE} IDs.`);
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await axios.get(
        `${API}/v1/series/batch`,
        {
          params: {
            id: seriesIds,
          },
          // MangaBaka expects repeated `id` parameters, not `id[]`.
          paramsSerializer: { indexes: null },
          timeout: REQUEST_TIMEOUT_MS,
        }
      );

      const series = response.data?.data;
      if (!Array.isArray(series)) {
        throw new Error("MangaBaka series batch returned no data array.");
      }

      return {
        series,
        status: response.status,
      };
    } catch (error) {
      if (!isRetryableError(error) || attempt === MAX_RETRIES) {
        throw new Error(
          `MangaBaka series batch failed for ${seriesIds.length} IDs`,
          { cause: error }
        );
      }

      const delay = retryDelayMs(error, attempt);
      console.log(
        `Pre-2014 popular MangaBaka batch API error ${error.response?.status || error.code}. ` +
        `Retry ${attempt}/${MAX_RETRIES} after ${delay}ms.`
      );
      await sleep(delay);
    }
  }

  throw new Error("Unable to fetch MangaBaka series batch.");
}

async function fetchSeriesById(seriesId) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await axios.get(
        `${API}/v1/series/${seriesId}`,
        { timeout: REQUEST_TIMEOUT_MS }
      );

      const series = response.data?.data;
      if (!series || mangaBakaIdFor(series, `MangaBaka series ${seriesId}`) !== seriesId) {
        throw new Error(`MangaBaka series ${seriesId} returned an invalid record.`);
      }

      return {
        series,
        status: response.status,
      };
    } catch (error) {
      if (isNotFound(error)) {
        return { series: null, status: 404 };
      }

      if (!isRetryableError(error) || attempt === MAX_RETRIES) {
        throw new Error(`MangaBaka series lookup failed for ${seriesId}`, { cause: error });
      }

      const delay = retryDelayMs(error, attempt);
      console.log(
        `Pre-2014 popular MangaBaka fallback ${seriesId} API error ${error.response?.status || error.code}. ` +
        `Retry ${attempt}/${MAX_RETRIES} after ${delay}ms.`
      );
      await sleep(delay);
    }
  }

  throw new Error(`Unable to fetch MangaBaka record ${seriesId}.`);
}

async function fetchCollectionSeries(bindings) {
  const requestedIds = bindings.map((binding) => binding.seriesId);
  const batches = chunk(requestedIds);
  const seriesById = new Map();
  const statusById = new Map();
  let batchReturnedCount = 0;

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const result = await fetchSeriesBatch(batch);
    const matched = indexBatchResults(batch, result.series, seriesById);
    batchReturnedCount += result.series.length;

    console.log(
      `Pre-2014 popular MangaBaka batch ${index + 1}/${batches.length}: ` +
      `${batch.length} requested, ${result.series.length} returned, ${matched} matched.`
    );

    if (index + 1 < batches.length) await sleep(REQUEST_DELAY_MS);
  }

  const missingIds = requestedIds.filter((seriesId) => !seriesById.has(seriesId));
  if (missingIds.length > MAX_MISSING_FALLBACKS) {
    throw new Error(
      `MangaBaka batch omitted ${missingIds.length} of ${requestedIds.length} requested IDs ` +
      `(${missingIds.join(", ")}). Refusing to issue individual fallback requests; ` +
      `the batch response is incomplete.`
    );
  }

  let fallbackCount = 0;
  for (let index = 0; index < missingIds.length; index += 1) {
    const seriesId = missingIds[index];
    const result = await fetchSeriesById(seriesId);
    statusById.set(seriesId, result.status);

    if (result.series) {
      seriesById.set(seriesId, result.series);
      fallbackCount += 1;
      console.log(
        `Pre-2014 popular MangaBaka fallback ${index + 1}/${missingIds.length}: ` +
        `${seriesId} resolved.`
      );
    } else {
      console.log(
        `Pre-2014 popular MangaBaka fallback ${index + 1}/${missingIds.length}: ` +
        `${seriesId} unresolved (404).`
      );
    }

    if (index + 1 < missingIds.length) await sleep(REQUEST_DELAY_MS);
  }

  return {
    seriesById,
    statusById,
    batchCount: batches.length,
    batchReturnedCount,
    fallbackCount,
    missingIds,
  };
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
  const bindings = buildRosterBindings(roster.entries, existing);
  const fresh = [];
  const unresolved = [];

  console.log(
    `Refreshing ${roster.entries.length} pre-2014 popular titles through ` +
    `${Math.ceil(bindings.length / BATCH_SIZE)} MangaBaka batch request(s).`
  );

  const refresh = await fetchCollectionSeries(bindings);

  for (let index = 0; index < bindings.length; index += 1) {
    const { rosterEntry, previous, seriesId } = bindings[index];
    const series = refresh.seriesById.get(seriesId);

    if (!series) {
      unresolved.push({
        anilist_id: rosterEntry.anilist_id,
        title: rosterEntry.title,
        mangabaka_id: seriesId,
        status: refresh.statusById.get(seriesId) || 404,
      });
    } else {
      fresh.push(withCollectionMetadata(series, rosterEntry, previous));
    }

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
      batch_count: refresh.batchCount,
      batch_requested_count: bindings.length,
      batch_returned_count: refresh.batchReturnedCount,
      individual_fallback_count: refresh.fallbackCount,
      batch_missing_ids: refresh.missingIds,
      unresolved,
      changes,
      refreshed_at: new Date().toISOString(),
    }
  );

  console.log(
    `Pre-2014 popular refresh complete: ${fresh.length}/${roster.entries.length} records assembled ` +
    `from ${refresh.batchCount} batch request(s) and ${refresh.fallbackCount} individual fallback ` +
    `request(s); ${unresolved.length} unresolved.`
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  BATCH_SIZE,
  buildRosterBindings,
  chunk,
  fetchCollectionSeries,
  fetchSeriesBatch,
  fetchSeriesById,
  indexBatchResults,
};
