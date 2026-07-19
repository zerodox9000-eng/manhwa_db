require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { GraphQLClient, gql } = require("graphql-request");

const INPUT_DIR = path.resolve(__dirname, "../../db/processed/by-year");
const OUTPUT_DIR = path.resolve(__dirname, "../../db/enriched/anilist");
const PERMANENT_MISSING_FILE = path.resolve(__dirname, "../../db/curation/anilist-permanent-missing.json");
const client = new GraphQLClient("https://graphql.anilist.co");
// AniList's current query-complexity ceiling permits 100 of these Media lookups.
const BATCH_SIZES = [100, 50, 10, 3, 1];
const REQUEST_DELAYS = [2200, 3000, 5000, 8000, 8000];
const MAX_RATE_LIMIT_RETRIES = 5;
const MAX_SERVER_RETRIES = 2;
const SERVER_RETRY_DELAYS = [2000, 4000];

function permanentMissingKey(mangabakaId, anilistId) {
  return `${Number(mangabakaId)}:${Number(anilistId)}`;
}

function loadPermanentMissingKeys() {
  if (!fs.existsSync(PERMANENT_MISSING_FILE)) return new Set();
  const entries = JSON.parse(fs.readFileSync(PERMANENT_MISSING_FILE, "utf8"));
  if (!Array.isArray(entries)) throw new Error("AniList permanent-missing registry must be an array");

  return new Set(entries.map((entry) => {
    if (!Number.isInteger(Number(entry?.mangabakaId)) || !Number.isInteger(Number(entry?.anilistId))) {
      throw new Error("AniList permanent-missing registry contains an invalid ID pair");
    }
    return permanentMissingKey(entry.mangabakaId, entry.anilistId);
  }));
}

const PERMANENT_MISSING_KEYS = loadPermanentMissingKeys();

function isPermanentlyMissing(entry) {
  return PERMANENT_MISSING_KEYS.has(permanentMissingKey(entry.id, entry.source?.anilist?.id));
}

function partitionExpectedEntries(expected) {
  return {
    permanentlyMissing: expected.filter(isPermanentlyMissing),
    fetchable: expected.filter((entry) => !isPermanentlyMissing(entry)),
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function buildQuery(batch) {
  const fields = batch.map((entry, index) => `
    a${index}: Media(
      id: ${entry.source.anilist.id},
      type: MANGA
    ) {
      id
      popularity
      favourites
      meanScore
    }
  `);

  return gql`
    query {
      ${fields.join("\n")}
    }
  `;
}

function currentResult(entry, result) {
  return {
    id: entry.id,
    anilist: result ? {
      popularity: result.popularity || null,
      favourites: result.favourites || null,
      meanScore: result.meanScore || null,
    } : null,
  };
}

function isNotFound(error) {
  const errors = error?.response?.errors;
  return Array.isArray(errors) && errors.length > 0 && errors.every(item =>
    Number(item?.status) === 404 || /not found/i.test(String(item?.message))
  );
}

function isRateLimited(error) {
  return Number(error?.response?.status) === 429 ||
    error?.response?.errors?.some(item => Number(item?.status) === 429);
}

function isTransientServerError(error) {
  const status = Number(error?.response?.status) ||
    Number(error?.response?.errors?.[0]?.status);
  return status >= 500 && status <= 599;
}

function retryAfterMs(error) {
  const seconds = Number(error?.response?.headers?.get?.("retry-after"));
  return Number.isFinite(seconds) && seconds > 0
    ? (seconds * 1000) + 1000
    : 61_000;
}

function nextFallbackLevel(error, level, batchLength) {
  let nextLevel = level + 1;

  // A temporary server error gets a genuine half-size retry before isolation.
  if (!isTransientServerError(error) && level === 0) nextLevel = 2;

  while (nextLevel < BATCH_SIZES.length - 1 && BATCH_SIZES[nextLevel] >= batchLength) {
    nextLevel += 1;
  }

  return nextLevel;
}

async function enrichAdaptive(batch, year, level = 0) {
  const results = [];

  for (const subBatch of chunk(batch, BATCH_SIZES[level])) {
    let rateLimitRetries = 0;
    let serverRetries = 0;

    while (true) {
      try {
        const data = await client.request(buildQuery(subBatch));
        results.push(...subBatch.map((entry, index) => currentResult(entry, data[`a${index}`])));
        await sleep(REQUEST_DELAYS[level]);
        break;
      } catch (error) {
        if (isRateLimited(error) && rateLimitRetries < MAX_RATE_LIMIT_RETRIES) {
          rateLimitRetries += 1;
          const waitMs = retryAfterMs(error);
          console.log(`AniList rate window for ${year}; resuming this batch in ${Math.ceil(waitMs / 1000)}s.`);
          await sleep(waitMs);
          continue;
        }

        if (isTransientServerError(error) && serverRetries < MAX_SERVER_RETRIES) {
          const waitMs = SERVER_RETRY_DELAYS[serverRetries];
          serverRetries += 1;
          console.log(`AniList server retry ${serverRetries}/${MAX_SERVER_RETRIES} for ${year}; resuming this batch in ${Math.ceil(waitMs / 1000)}s.`);
          await sleep(waitMs);
          continue;
        }

        console.error(`AniList request retry ${level + 1} for ${year}:`, error.response?.errors || error.message);

        if (level < BATCH_SIZES.length - 1) {
          await sleep(REQUEST_DELAYS[level]);
          results.push(...await enrichAdaptive(subBatch, year, nextFallbackLevel(error, level, subBatch.length)));
          break;
        }

        if (subBatch.length === 1 && isNotFound(error)) {
          results.push(currentResult(subBatch[0], null));
          break;
        }

        throw new Error(`AniList refresh did not complete for ${year}`, { cause: error });
      }
    }
  }

  return results;
}

async function processFile(file, stagingDir) {
  const year = file.replace(".series.json", "");
  const data = JSON.parse(fs.readFileSync(path.join(INPUT_DIR, file), "utf8"));
  const expected = data.filter(entry => entry.source?.anilist?.id);

  console.log(`Processing ${file}`);
  console.log(`AniList entries: ${expected.length}`);

  const { permanentlyMissing, fetchable } = partitionExpectedEntries(expected);
  if (permanentlyMissing.length) {
    console.log(`Skipping ${permanentlyMissing.length} confirmed missing AniList ID(s) for ${year}.`);
  }

  const fetchedResults = await enrichAdaptive(fetchable, year);
  const fetchedById = new Map(fetchedResults.map((result) => [result.id, result]));
  const permanentlyMissingIds = new Set(permanentlyMissing.map((entry) => entry.id));
  const results = expected.map((entry) => permanentlyMissingIds.has(entry.id)
    ? currentResult(entry, null)
    : fetchedById.get(entry.id));
  if (results.some((result) => !result)) {
    throw new Error(`AniList current-run coverage mismatch for ${year}`);
  }
  const expectedIds = new Set(expected.map(entry => entry.id));
  const actualIds = new Set(results.map(entry => entry.id));

  if (
    results.length !== expected.length ||
    actualIds.size !== expectedIds.size ||
    [...expectedIds].some(id => !actualIds.has(id))
  ) {
    throw new Error(`AniList current-run coverage mismatch for ${year}`);
  }

  fs.writeFileSync(
    path.join(stagingDir, `${year}.anilist.json`),
    JSON.stringify(results, null, 2),
    "utf8"
  );
  console.log(`Refreshed ${year}: ${results.length}/${expected.length}`);
  return { year, count: results.length };
}

function publishCompleteRefresh(stagingDir) {
  const backupDir = `${OUTPUT_DIR}.previous`;
  fs.rmSync(backupDir, { recursive: true, force: true });
  fs.renameSync(OUTPUT_DIR, backupDir);

  try {
    fs.renameSync(stagingDir, OUTPUT_DIR);
    fs.rmSync(backupDir, { recursive: true, force: true });
  } catch (error) {
    if (!fs.existsSync(OUTPUT_DIR) && fs.existsSync(backupDir)) {
      fs.renameSync(backupDir, OUTPUT_DIR);
    }
    throw error;
  }
}

async function main() {
  const files = fs.readdirSync(INPUT_DIR)
    .filter(file => file.endsWith(".series.json"))
    .sort();
  const stagingDir = fs.mkdtempSync(path.join(path.dirname(OUTPUT_DIR), ".anilist-next-"));
  const refreshed = [];

  try {
    for (const file of files) {
      refreshed.push(await processFile(file, stagingDir));
    }

    if (refreshed.length !== files.length) {
      throw new Error(`AniList year coverage mismatch: ${refreshed.length}/${files.length}`);
    }

    publishCompleteRefresh(stagingDir);
  } catch (error) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
    throw error;
  }

  console.log(`AniList refresh complete for ${refreshed.length}/${files.length} years.`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { partitionExpectedEntries, isTransientServerError, nextFallbackLevel };
