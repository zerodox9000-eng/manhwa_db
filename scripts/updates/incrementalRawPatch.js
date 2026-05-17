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

let dynamicDelay = 25;

function sleep(ms) {

  return new Promise(
    resolve => setTimeout(resolve, ms)
  );
}

async function fetchYear(year) {

  let page = 1;

  let all = []; let seenIds = new Set();

  while (true) {

  console.log(
    `${year} page ${page}`
  );

  let response;

while (true) {

  try {

    response = await axios.get(
      `${API}/v1/series/search`,
      {
        params: {

          page,

          limit: 100,

          type: "manhwa",

          published_start_date_lower:
            `${year}-01-01`,

          published_start_date_upper:
            `${year}-12-31`
        }
      }
    );

    break;

  } catch (error) {

    if ([429,500,502,503,504,520,522,524,530].includes(error.response?.status)) {

      console.log(
      `API error ${error.response?.status}. Backing off...`
    );

    dynamicDelay =
      Math.min(
        dynamicDelay * 2,
        10000
      );

    console.log(
      `New delay: ${dynamicDelay}ms`
    );

      await sleep(20000);

      continue;
    }

    throw error;
  }
}const results =
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
    `${year} total ${all.length} entries`
  );

  if (all.length === before) {

    console.log(
      `${year} page ${page} no new entries found`
    );

    break;
  }

  page++;

  await sleep(3500);
}

dynamicDelay =
  Math.max(
    25,
    dynamicDelay * 0.9
  );

return all;
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

function normalize(entry) {

  return {

    id: entry.id,

    display_title:
      getEnglishTitles(
        entry.titles
      )[0] ||
      entry.titles?.[0]?.title ||
      null,

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

    source:
      entry.source || {},

    links: {

      mangabaka:
        entry.links?.mangabaka || null,

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

    rawMap.set(
      entry.id,
      entry
    );
  }

  const rawMerged =
    [...rawMap.values()];

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

main().catch(console.error);

























