require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");

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

const YEARS = Array.from({ length: new Date().getFullYear() - 2012 }, (_, i) => 2013 + i);

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
        `API error ${error.response?.status}. Sleeping 20s...`
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

  const normalized =
    fresh.map(normalize);

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













