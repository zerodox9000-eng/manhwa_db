require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");

const SYNC_STATE =
  path.join(
    __dirname,
    "../../db/state/sync-state.json"
  );

function getLastSync() {

  if (!fs.existsSync(SYNC_STATE)) {

    return null;
  }

  return JSON.parse(
    fs.readFileSync(
      SYNC_STATE,
      "utf-8"
    )
  ).lastSync;
}

function saveLastSync() {

  fs.mkdirSync(
    CHANGELOG_DIR,
    { recursive: true }
  );

  fs.writeFileSync(
    SYNC_STATE,
    JSON.stringify({
      lastSync:
        new Date().toISOString()
    }, null, 2),
    "utf-8"
  );
}


const API =
  process.env.MANGABAKA_API;




const RAW_DIR =

  path.join(
    __dirname,
    "../../db/raw/by-year"
  );


const PROCESSED_DIR =
  path.join(
    __dirname,
    "../../db/processed/by-year"
  );

const CHANGELOG_DIR =
  path.join(
    __dirname,
    "../../db/updates/changelog"
  );

const YEARS = Array.from({ length: new Date().getFullYear() - 2013 }, (_, i) => 2014 + i);

const PAGE_DELAY_MS = Number(process.env.MANGABAKA_YEAR_PAGE_DELAY_MS || 2500);
const REQUEST_TIMEOUT_MS = Number(process.env.MANGABAKA_REQUEST_TIMEOUT_MS || 30000);
const MAX_RETRIES = 6;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504, 520, 522, 524, 530]);
const RETRYABLE_CODES = new Set(["ECONNABORTED", "ECONNRESET", "ETIMEDOUT"]);

function sleep(ms) {

  return new Promise(
    resolve => setTimeout(resolve, ms)
  );
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

async function fetchPage(year, page, type = "manhwa") {

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {

    try {

      return await axios.get(
        `${API}/v1/series/search`,
        {
          params: {

            page,

            limit: 100,

            type,

            published_start_date_lower:
              `${year}-01-01`,

            published_start_date_upper:
              `${year}-12-31`
          },
          timeout: REQUEST_TIMEOUT_MS
        }
      );

    } catch (error) {

      const status = error.response?.status;

      if (!isRetryableError(error) || attempt === MAX_RETRIES) {

        throw error;
      }

      const delay = retryDelayMs(error, attempt);

      console.log(
        `${year} ${type} page ${page} API error ${status || error.code}. Retry ${attempt}/${MAX_RETRIES} after ${delay}ms`
      );

      await sleep(delay);
    }
  }

  throw new Error(`Unable to fetch MangaBaka ${type} year ${year} page ${page}`);
}

async function fetchYearType(year, type) {

  let page = 1;

  let all = [];

  while (true) {

  console.log(
    `${year} ${type} page ${page}`
  );

  const response =
    await fetchPage(year, page, type);

  const results =
    response.data?.data || [];

  if (!results.length) {

    break;
  }

  const before =
    all.length;

  results.forEach(entry => {

    if (
      !all.some(
        x => x.id === entry.id
      )
    ) {

      all.push(entry);
    }
  });

  console.log(
    `${year} ${type} total ${all.length} entries`
  );

  if (all.length === before) {

    console.log(
      `${year} ${type} page ${page} no new entries found`
    );

    break;
  }

  page++;

  await sleep(PAGE_DELAY_MS);
}

return all;
}

function mergeManhwaAndOel(manhwa, oel) {

  const entries = new Map(
    manhwa.map(entry => [entry.id, entry])
  );

  for (const entry of oel) {

    if (!entries.has(entry.id)) {

      entries.set(entry.id, entry);
    }
  }

  return [...entries.values()];
}

async function fetchYear(year) {

  const manhwa =
    await fetchYearType(year, "manhwa");

  const oel =
    await fetchYearType(year, "oel");

  const merged =
    mergeManhwaAndOel(manhwa, oel);

  console.log(
    `${year} combined total ${merged.length} entries (${manhwa.length} manhwa, ${oel.length} OEL)`
  );

  return merged;
}

function getEnglishTitles(titles) {

  return (titles || [])
    .filter(
      t => t.language === "en"
    )
    .map(
      t => t.title
    );
}

function cleanTitle(value) {

  const title =
    String(value || "").trim();

  return title &&
    !/^(unknown title|untitled|no title|n\/a|-)?$/i.test(title)
      ? title
      : null;
}

function normalize(entry) {

  return {

    id: entry.id,

    display_title:
      cleanTitle(entry.title) ||
      cleanTitle(
        getEnglishTitles(
          entry.titles
        )[0]
      ) ||
      cleanTitle(entry.titles?.[0]?.title) ||
      cleanTitle(entry.native_title) ||
      cleanTitle(entry.romanized_title) ||
      null,

    mangabaka_title:
      cleanTitle(entry.title),

    native_title:
      cleanTitle(entry.native_title),

    romanized_title:
      cleanTitle(entry.romanized_title),

    english_titles:
      getEnglishTitles(
        entry.titles
      ),

    chapters:
      entry.chapters || null,

    status:
      entry.status || null,

    published:
      entry.published || {},

    first_seen_at:
      entry.first_seen_at ||
      entry._first_seen_at ||
      null,

    last_updated_at:
      entry.last_updated_at || null,

    source:
      entry.source || {},

    links: {

      mangabaka:
        `https://mangabaka.org/${entry.id}`,

      read_en:
        entry.links?.read_en || null,

      official_en:
        entry.links?.official_en || null
    }
  };
}

function changed(a, b) {

  return JSON.stringify(a)
    !== JSON.stringify(b);
}

async function processYear(year) {

  const fresh =
    await fetchYear(year);

  const rawPath =
    path.join(
      RAW_DIR,
      `${year}.json`
    );

  let rawExisting = [];

  if (
    fs.existsSync(rawPath)
  ) {

    rawExisting = JSON.parse(
      fs.readFileSync(
        rawPath,
        "utf-8"
      )
    );
  }

  const rawMap =
    new Map(
      rawExisting.map(
        x => [x.id, x]
      )
    );

  for (const entry of fresh) {

    const existing =
      rawMap.get(entry.id);

    const firstSeen =
      existing?.first_seen_at ||
      existing?._first_seen_at ||
      entry.first_seen_at ||
      new Date().toISOString();

    const firstSeenTrusted =
      existing?.first_seen_at_is_trusted === true ||
      existing?._first_seen_at_is_trusted === true ||
      !existing;

    rawMap.set(
      entry.id,
      {
        ...(existing || {}),
        ...entry,
        first_seen_at: firstSeen,
        first_seen_at_is_trusted: firstSeenTrusted
      }
    );
  }

  const rawMerged =
    [...rawMap.values()];

  fs.mkdirSync(
    CHANGELOG_DIR,
    { recursive: true }
  );

  fs.writeFileSync(
    rawPath,
    JSON.stringify(
      rawMerged,
      null,
      2
    ),
    "utf-8"
  );

  const normalized =
    rawMerged.map(normalize);

  const existingPath =
    path.join(
      PROCESSED_DIR,
      `${year}.series.json`
    );

  let existing = [];

  if (
    fs.existsSync(existingPath)
  ) {

    existing = JSON.parse(
      fs.readFileSync(
        existingPath,
        "utf-8"
      )
    );
  }

  const existingMap =
    new Map(
      existing.map(
        x => [x.id, x]
      )
    );

  const updated = [];

  const changes = [];

  for (const entry of normalized) {

    const old =
      existingMap.get(entry.id);

    if (!old) {

      changes.push({

        type: "new",

        id: entry.id,

        title:
          entry.display_title
      });

      updated.push(entry);

      continue;
    }

    if (changed(old, entry)) {

      changes.push({

        type: "updated",

        id: entry.id,

        title:
          entry.display_title
      });
    }

    updated.push(entry);
  }

  fs.mkdirSync(
    CHANGELOG_DIR,
    { recursive: true }
  );

  fs.writeFileSync(
    existingPath,
    JSON.stringify(
      updated,
      null,
      2
    ),
    "utf-8"
  );

  const today =
    new Date()
      .toISOString()
      .split("T")[0];

  fs.mkdirSync(
    CHANGELOG_DIR,
    { recursive: true }
  );

  fs.writeFileSync(

    path.join(
      CHANGELOG_DIR,
      `${today}-${year}.json`
    ),

    JSON.stringify(
      changes,
      null,
      2
    ),

    "utf-8"
  );

  console.log(
    `${year} updated`
  );
}

async function main() {

  for (const year of YEARS) {

  await processYear(year);
}

saveLastSync();

  console.log("Done.");
}

if (require.main === module) {

  main().catch(error => {

    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  fetchPage,
  fetchYearType,
  mergeManhwaAndOel,
  isRetryableError,
  retryDelayMs
};




























