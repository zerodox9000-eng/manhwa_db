require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");

const API = process.env.MANGABAKA_API || "https://api.mangabaka.org";
const CACHE_DIR = path.resolve(__dirname, "../../db/cache");
const CACHE_FILE = path.join(CACHE_DIR, "mangabaka-latest.json");
const LIMIT = 100;
const PAGE_DELAY_MS = Number(process.env.MANGABAKA_LATEST_DELAY_MS || 850);
const MAX_RETRIES = 6;
const MAX_PAGE = Number(process.env.MANGABAKA_LATEST_MAX_PAGE || 100);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(page) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await axios.get(`${API}/v1/series/search`, {
        params: {
          type: "manhwa",
          sort_by: "latest",
          page,
          limit: LIMIT,
        },
        timeout: 30000,
      });
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const retryAfter = Number(error.response?.headers?.["retry-after"]);
      if (status !== 429 && status < 500) throw error;
      if (attempt === MAX_RETRIES) throw error;
      const delay = Number.isFinite(retryAfter)
        ? retryAfter * 1000
        : Math.min(30000, 1500 * attempt * attempt);
      console.log(`MangaBaka latest page ${page} retry ${attempt}/${MAX_RETRIES} after ${delay}ms`);
      await sleep(delay);
    }
  }
  throw new Error(`Unable to fetch MangaBaka latest page ${page}`);
}

async function main() {
  const ranks = {};
  const snapshotAt = new Date().toISOString();
  let page = 1;
  let rank = 1;
  let expectedPages = Infinity;

  while (page <= expectedPages) {
    console.log(`MangaBaka latest page ${page}`);
    const payload = await fetchPage(page);
    const rows = payload.data || [];
    const count = payload.pagination?.count || rows.length;
    expectedPages = Math.min(MAX_PAGE, Math.ceil(count / LIMIT));

    for (const entry of rows) {
      if (entry?.id != null && ranks[entry.id] == null) {
        ranks[entry.id] = rank;
        rank += 1;
      }
    }

    if (!rows.length) break;
    page += 1;
    await sleep(PAGE_DELAY_MS);
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(
    CACHE_FILE,
    JSON.stringify({ snapshotAt, count: Object.keys(ranks).length, ranks }, null, 2),
    "utf-8",
  );
  console.log(`Cached ${Object.keys(ranks).length} MangaBaka latest ranks.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
