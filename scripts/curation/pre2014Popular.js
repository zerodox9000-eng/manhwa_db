const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const DEFAULT_ROSTER_FILE = path.join(ROOT, "db/curation/pre2014-popular-anilist.json");
const COLLECTION_NAME = "pre2014-popular";
const DEFAULT_EXPECTED_COUNT = 93;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function numericId(value, label) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return id;
}

function numericValue(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function rosterEntries(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.titles)) return value.titles;
  if (Array.isArray(value?.entries)) return value.entries;
  throw new Error("Pre-2014 popular AniList roster must contain a titles array.");
}

function loadRoster(file = process.env.PRE2014_POPULAR_ROSTER_FILE || DEFAULT_ROSTER_FILE) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing pre-2014 popular AniList roster: ${file}`);
  }

  const document = readJson(file);
  const rawEntries = rosterEntries(document);
  const expectedCount = Number(
    document?.selection?.expected_count ??
    document?.expected_count ??
    process.env.PRE2014_POPULAR_EXPECTED_COUNT ??
    DEFAULT_EXPECTED_COUNT
  );

  if (!Number.isSafeInteger(expectedCount) || expectedCount <= 0) {
    throw new Error("Pre-2014 popular roster expected_count must be a positive integer.");
  }

  if (rawEntries.length !== expectedCount) {
    throw new Error(
      `Pre-2014 popular roster count mismatch: expected ${expectedCount}, received ${rawEntries.length}.`
    );
  }

  const seen = new Set();
  const entries = rawEntries.map((entry, index) => {
    const anilistId = numericId(
      entry?.anilist_id ?? entry?.anilistId ?? entry?.id,
      `Roster entry ${index + 1} AniList ID`
    );

    if (seen.has(anilistId)) {
      throw new Error(`Pre-2014 popular roster contains duplicate AniList ID ${anilistId}.`);
    }
    seen.add(anilistId);

    return {
      anilist_id: anilistId,
      title: entry?.title || entry?.name || null,
      release_year: numericValue(
        entry?.release_year ?? entry?.releaseYear ?? entry?.startDate?.year
      ),
      popularity: numericValue(
        entry?.popularity ?? entry?.anilist_popularity
      ),
      country_of_origin: entry?.country_of_origin ?? entry?.countryOfOrigin ?? null,
    };
  });

  return {
    file,
    document,
    expectedCount,
    entries,
  };
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, file);
}

module.exports = {
  COLLECTION_NAME,
  DEFAULT_EXPECTED_COUNT,
  DEFAULT_ROSTER_FILE,
  loadRoster,
  numericId,
  writeJsonAtomic,
};
