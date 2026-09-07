import fs from "node:fs";
import path from "node:path";

const endpoint = "https://graphql.anilist.co";
const year = "2014";
const inputFile = path.resolve(`db/processed/by-year/${year}.series.json`);
const token = String(process.env.ANILIST_ACCESS_TOKEN || "").trim();

if (!fs.existsSync(inputFile)) {
  console.error(`AniList ${year} status check: input file is missing.`);
  process.exit(2);
}

const entries = JSON.parse(fs.readFileSync(inputFile, "utf8"));
const ids = [...new Set(entries
  .map(entry => Number(entry?.source?.anilist?.id))
  .filter(id => Number.isSafeInteger(id) && id > 0))];

const requestHeaders = {
  "content-type": "application/json",
  referer: "https://github.com/zerodox9000-eng/manhwa_db",
};

function buildQuery(batch) {
  const fields = batch.map((id, index) => `
    a${index}: Media(
      id: ${id},
      type: MANGA
    ) {
      id
      popularity
      favourites
      meanScore
    }
  `);

  return `query AniList${year}Status { ${fields.join("\n")} }`;
}

console.log(`AniList ${year} status check: ${ids.length} unique Manga ID(s), anonymous batches of 100.`);

let completed = 0;
for (let start = 0; start < ids.length; start += 100) {
  const batch = ids.slice(start, start + 100);
  const headers = { ...requestHeaders };
  if (token) headers.authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: buildQuery(batch) }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    console.error(`AniList ${year} status check: NETWORK_ERROR (${String(error?.message || "request failed").slice(0, 200)}).`);
    process.exit(1);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Report a concise failure below.
  }

  const errors = Array.isArray(payload?.errors) ? payload.errors : [];
  const dataAliases = Object.keys(payload?.data || {}).length;
  console.log(`Batch ${start + 1}-${start + batch.length}: HTTP ${response.status}; data aliases ${dataAliases}; GraphQL errors ${errors.length}.`);

  if (!response.ok || errors.length > 0 || dataAliases !== batch.length) {
    console.error(JSON.stringify(errors.slice(0, 5).map(error => ({
      message: String(error?.message || "Unknown AniList error").slice(0, 200),
      status: Number.isFinite(Number(error?.status)) ? Number(error.status) : null,
      path: error?.path || null,
      locations: error?.locations || null,
    }))));
    console.error(`AniList ${year} status check: FAILED at batch ${start + 1}-${start + batch.length}.`);
    process.exit(1);
  }

  completed += batch.length;
}

console.log(`AniList ${year} status check: OK (${completed}/${ids.length} Manga records).`);
