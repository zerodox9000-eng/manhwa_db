const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const {
  applyTitleDisplayOverride,
  loadTitleDisplayOverrides,
} = require("./titleDisplayOverrides");

const titleDisplayOverrides = loadTitleDisplayOverrides();
const crypto = require("crypto");

const SERIES_DIR = path.resolve(
  process.env.FRONTEND_V2_SERIES_DIR || path.join(__dirname, "../../db/processed/by-year"),
);
const TAGS_DIR = path.resolve(
  process.env.FRONTEND_V2_TAGS_DIR || path.join(__dirname, "../../db/processed/tags"),
);
const ENRICHED_DIR = path.resolve(
  process.env.FRONTEND_V2_ENRICHED_DIR || path.join(__dirname, "../../db/enriched/anilist"),
);
const LATEST_CACHE = path.resolve(
  process.env.FRONTEND_V2_LATEST_CACHE || path.join(__dirname, "../../db/cache/mangabaka-latest.json"),
);
const EXPORT_DIR = path.resolve(
  process.env.FRONTEND_V2_EXPORT_DIR || path.join(__dirname, "../../db/exports/frontend-v2"),
);

const CONTRACT_VERSION = 1;
const ANILIST_GRAPHQL_URL = process.env.ANILIST_GRAPHQL_URL || "https://graphql.anilist.co";
const ANILIST_PAGE_SIZE = Number(process.env.ANILIST_ADD_PAGE_SIZE || 50);
const ANILIST_MAX_PAGES = Number(process.env.ANILIST_ADD_MAX_PAGES || 400);
const ANILIST_DELAY_MS = Number(process.env.ANILIST_ADD_PAGE_DELAY_MS || 750);
const SKIP_ANILIST = process.env.FRONTEND_V2_SKIP_ANILIST === "1";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function readJsonFiles(dir, required) {
  if (!fs.existsSync(dir)) {
    if (required) throw new Error(`Required input directory is missing: ${dir}`);
    return [];
  }

  return fs.readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .flatMap((file) => readJson(path.join(dir, file)));
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function stableJson(value) {
  return JSON.stringify(value, null, 2);
}

function writeJson(file, value) {
  const json = stableJson(value);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, json, "utf-8");
  fs.writeFileSync(`${file}.gz`, zlib.gzipSync(Buffer.from(json)));
  return {
    path: path.relative(EXPORT_DIR, file).replace(/\\/g, "/"),
    gzipPath: path.relative(EXPORT_DIR, `${file}.gz`).replace(/\\/g, "/"),
    bytes: Buffer.byteLength(json),
    gzipBytes: fs.statSync(`${file}.gz`).size,
    sha256: sha256(json),
  };
}

function writeDetailJson(file, value) {
  const json = stableJson(value);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, json, "utf-8");
  return {
    bytes: Buffer.byteLength(json),
    sha256: sha256(json),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function datePart(value) {
  return typeof value === "string" && value.length >= 10 ? value.slice(0, 10) : null;
}

function isFutureDate(date) {
  if (!date) return false;
  return date > new Date().toISOString().slice(0, 10);
}

function coverInfo(cover) {
  if (!cover) {
    return {
      url: null,
      thumbnailUrl: null,
      aspectRatio: 2 / 3,
      source: null,
    };
  }

  const url = typeof cover === "string" ? cover : cover.url || cover.x350 || cover.x250 || cover.raw || null;
  const thumbnailUrl = typeof cover === "string" ? cover : cover.thumbnailUrl || cover.x250 || cover.x350 || cover.url || cover.raw || null;
  const width = Number(cover.width || cover.w || 0) || null;
  const height = Number(cover.height || cover.h || 0) || null;

  return {
    url,
    thumbnailUrl,
    width,
    height,
    aspectRatio: width && height ? width / height : 2 / 3,
    source: url ? "mangabaka" : null,
  };
}

function sourceFlags(source) {
  return {
    anilist: Boolean(source?.anilist?.id),
    animeplanet: Boolean(source?.animeplanet?.id),
    mangaupdates: Boolean(source?.mangaupdates?.id),
  };
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = String(value || "").trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function titleAliases(entry) {
  return uniqueStrings([
    ...(entry.titles || []).map((title) => title?.title),
    entry.mangabaka_title,
    entry.native_title,
    entry.romanized_title,
  ]).slice(0, 12);
}

function compactLinks(links) {
  const readEnAll = uniqueStrings([
    ...(Array.isArray(links?.read_en_all) ? links.read_en_all : []),
    links?.read_en,
  ]);
  return {
    mangabaka: links?.mangabaka || null,
    read_en: readEnAll[0] || null,
    read_en_all: readEnAll,
    official_en: links?.official_en || null,
  };
}

function releaseInfo(entry) {
  const published = entry.published || {};
  const startDate = datePart(published.start_date);
  const endDate = datePart(published.end_date);
  const startEstimated = published.start_date_is_estimated === true;
  const endEstimated = published.end_date_is_estimated === true;
  const realStartDate = startDate && !startEstimated && !isFutureDate(startDate) ? startDate : null;

  return {
    start_date: startDate,
    start_date_is_estimated: startEstimated,
    start_date_is_future: isFutureDate(startDate),
    end_date: endDate,
    end_date_is_estimated: endEstimated,
    end_date_is_future: isFutureDate(endDate),
    rel_sort_date: realStartDate,
  };
}

function loadLatestCache() {
  if (!fs.existsSync(LATEST_CACHE)) {
    return {
      snapshotAt: null,
      ranks: {},
      warning: `Missing MangaBaka latest cache: ${LATEST_CACHE}`,
    };
  }
  return {
    ...readJson(LATEST_CACHE),
    warning: null,
  };
}

function loadSeriesTagMap(tagRows, tagMap) {
  const seriesTagIds = new Map();
  for (const entry of tagRows) {
    const ids = [];
    for (const tag of entry.tags_v2 || []) {
      ids.push(tag.id);
      if (!tagMap.has(tag.id)) {
        tagMap.set(tag.id, {
          id: tag.id,
          name: tag.name,
          path: tag.name_path,
          is_genre: tag.is_genre,
          parent_id: tag.parent_id,
          level: tag.level,
          content_rating: tag.content_rating || null,
          series_count: tag.series_count || null,
          weight: tag.weight || null,
        });
      }
    }
    seriesTagIds.set(entry.id, ids);
  }
  return seriesTagIds;
}

function loadEnrichedStats() {
  const stats = new Map();
  for (const entry of readJsonFiles(ENRICHED_DIR, false)) {
    stats.set(entry.id, {
      popularity: entry.anilist?.popularity || null,
      favourites: entry.anilist?.favourites || null,
      meanScore: entry.anilist?.meanScore || null,
    });
  }
  return stats;
}

async function fetchAniListAddedRanks() {
  if (SKIP_ANILIST) {
    return {
      ranks: new Map(),
      fetched: 0,
      pages: 0,
      skipped: true,
    };
  }

  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          currentPage
          hasNextPage
        }
        media(type: MANGA, countryOfOrigin: "KR", sort: ID_DESC) {
          id
        }
      }
    }
  `;
  const ranks = new Map();
  let page = 1;
  let pagesFetched = 0;

  while (page <= ANILIST_MAX_PAGES) {
    const response = await fetch(ANILIST_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          page,
          perPage: ANILIST_PAGE_SIZE,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`AniList added-rank request failed on page ${page}: ${response.status}`);
    }

    const payload = await response.json();
    if (payload.errors?.length) {
      throw new Error(`AniList added-rank GraphQL error: ${JSON.stringify(payload.errors)}`);
    }

    const media = payload.data?.Page?.media || [];
    pagesFetched += 1;
    for (const item of media) {
      if (item?.id != null && !ranks.has(item.id)) {
        ranks.set(item.id, ranks.size + 1);
      }
    }

    if (!payload.data?.Page?.pageInfo?.hasNextPage || media.length === 0) break;
    page += 1;
    if (ANILIST_DELAY_MS > 0) await sleep(ANILIST_DELAY_MS);
  }

  return {
    ranks,
    fetched: ranks.size,
    pages: pagesFetched,
    skipped: false,
  };
}

function buildCatalogRecord(entry, stats, latestCache, anilistRanks, tagIds) {
  const anilistId = entry.source?.anilist?.id || null;
  const displayTitle = applyTitleDisplayOverride(entry, titleDisplayOverrides);
  const releases = releaseInfo(entry);
  return {
    id: entry.id,
    display_title: displayTitle || entry.mangabaka_title || entry.romanized_title || "Unknown Title",
    backend_display_title: displayTitle || null,
    mangabaka_title: entry.mangabaka_title || null,
    native_title: entry.native_title || null,
    romanized_title: entry.romanized_title || null,
    title_aliases: titleAliases(entry),
    cover: coverInfo(entry.cover),
    year: entry.year || (releases.rel_sort_date ? Number(releases.rel_sort_date.slice(0, 4)) : null),
    status: entry.status || null,
    content_rating: entry.content_rating || null,
    total_chapters: entry.total_chapters || null,
    release: releases,
    first_seen_at: entry.first_seen_at || null,
    first_seen_at_is_trusted: entry.first_seen_at_is_trusted === true,
    last_updated_at: entry.last_updated_at || null,
    mangabaka_latest_rank: latestCache.ranks?.[entry.id] || null,
    mangabaka_latest_snapshot_at: latestCache.snapshotAt || null,
    anilist_added_rank: anilistId ? anilistRanks.get(Number(anilistId)) || null : null,
    authors: entry.authors || [],
    artists: entry.artists || [],
    links: compactLinks(entry.links || {}),
    source: entry.source || {},
    source_flags: sourceFlags(entry.source),
    tag_ids: tagIds || [],
    stats: stats.get(entry.id) || {
      popularity: null,
      favourites: null,
      meanScore: null,
    },
  };
}

function buildDetailRecord(entry, catalogRecord) {
  return {
    ...catalogRecord,
    titles: entry.titles || [],
    state: entry.state || null,
    type: entry.type || null,
    description: entry.description || null,
    is_licensed: entry.is_licensed === true,
    context: entry.context || null,
  };
}

function validateCatalog(catalog) {
  const errors = [];
  const seenIds = new Set();
  for (const item of catalog) {
    if (!item.id) errors.push("Catalog item missing id");
    if (seenIds.has(item.id)) errors.push(`Duplicate catalog id ${item.id}`);
    seenIds.add(item.id);
    if (!item.display_title) errors.push(`Series ${item.id} missing display_title`);
    if (item.anilist_added_rank != null && !item.source_flags.anilist) {
      errors.push(`Series ${item.id} has anilist_added_rank without AniList source`);
    }
  }
  return errors;
}

async function main() {
  const buildStartedAt = new Date().toISOString();
  const warnings = [];
  const latestCache = loadLatestCache();
  if (latestCache.warning) warnings.push(latestCache.warning);

  const tagMap = new Map();
  const tagRows = readJsonFiles(TAGS_DIR, false);
  const seriesTagIds = loadSeriesTagMap(tagRows, tagMap);
  const stats = loadEnrichedStats();
  if (!fs.existsSync(ENRICHED_DIR)) warnings.push(`Missing AniList enriched stats directory: ${ENRICHED_DIR}`);

  const seriesRows = readJsonFiles(SERIES_DIR, true);
  const anilistResult = await fetchAniListAddedRanks();
  const catalog = [];
  const details = [];
  const unmatchedAniListIds = new Set(anilistResult.ranks.keys());
  const uniqueSeriesRows = new Map();

  for (const entry of seriesRows.sort((a, b) => a.id - b.id)) {
    if (!entry?.id) continue;
    uniqueSeriesRows.set(Number(entry.id), entry);
  }

  for (const entry of [...uniqueSeriesRows.values()].sort((a, b) => a.id - b.id)) {
    const record = buildCatalogRecord(
      entry,
      stats,
      latestCache,
      anilistResult.ranks,
      seriesTagIds.get(entry.id) || [],
    );
    if (record.source?.anilist?.id) unmatchedAniListIds.delete(Number(record.source.anilist.id));
    catalog.push(record);
    details.push(buildDetailRecord(entry, record));
  }

  const validationErrors = validateCatalog(catalog);
  if (validationErrors.length) {
    throw new Error(`v2 catalog validation failed:\n${validationErrors.slice(0, 20).join("\n")}`);
  }

  const tagGraph = [...tagMap.values()].sort((a, b) => a.id - b.id);
  const catalogJson = stableJson(catalog);
  const tagJson = stableJson(tagGraph);
  const buildId = sha256([
    catalogJson,
    tagJson,
    latestCache.snapshotAt || "",
    anilistResult.fetched,
  ].join("\n")).slice(0, 16);

  const buildDir = path.join(EXPORT_DIR, "builds", buildId);
  const catalogFile = writeJson(path.join(buildDir, "catalog/index.json"), catalog);
  const tagFile = writeJson(path.join(buildDir, "tags/graph.json"), tagGraph);

  let largestDetail = {
    id: null,
    bytes: 0,
  };
  for (const detail of details) {
    const written = writeDetailJson(path.join(buildDir, `details/${detail.id}.json`), detail);
    if (written.bytes > largestDetail.bytes) {
      largestDetail = {
        id: detail.id,
        bytes: written.bytes,
      };
    }
  }

  const manifest = {
    contract: {
      name: "manhwa-frontend-v2",
      version: CONTRACT_VERSION,
      minimumFrontendContractVersion: 1,
    },
    build: {
      id: buildId,
      startedAt: buildStartedAt,
      completedAt: new Date().toISOString(),
    },
    atomicLoading: {
      entrypoint: "manifest.json",
      immutableBuildRoot: `builds/${buildId}/`,
      switchPolicy: "download-and-validate-build-before-visible-switch",
    },
    sources: {
      mangaBakaLatestSnapshotAt: latestCache.snapshotAt || null,
      anilistAddedRankSnapshotAt: anilistResult.skipped ? null : buildStartedAt,
      anilistAddedRankSkipped: anilistResult.skipped,
    },
    counts: {
      catalog: catalog.length,
      details: details.length,
      tags: tagGraph.length,
      anilistAddedRanksFetched: anilistResult.fetched,
      anilistAddedRanksMatched: catalog.filter((item) => item.anilist_added_rank != null).length,
      anilistAddedRanksUnmatched: unmatchedAniListIds.size,
    },
    files: {
      catalog: catalogFile,
      tags: tagFile,
      details: {
        pathTemplate: `builds/${buildId}/details/{id}.json`,
        count: details.length,
        largest: largestDetail,
      },
    },
    feedSemantics: {
      nonAniListAdd: "mangabaka_latest_rank",
      aniListAdd: "anilist_added_rank",
      aniListRel: "release.rel_sort_date where source_flags.anilist is true",
      nonAniListRel: "release.rel_sort_date where source_flags.anilist is false",
      estimatedDatesExcludedFromRel: true,
      futureDatesExcludedFromRel: true,
    },
    warnings,
  };

  fs.mkdirSync(EXPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(EXPORT_DIR, "manifest.json"), stableJson(manifest), "utf-8");

  const summary = {
    exportDir: EXPORT_DIR,
    buildId,
    recordsRead: seriesRows.length,
    uniqueRecordsRead: uniqueSeriesRows.size,
    recordsWritten: catalog.length,
    anilistPagesFetched: anilistResult.pages,
    anilistRanksFetched: anilistResult.fetched,
    anilistRanksMatched: manifest.counts.anilistAddedRanksMatched,
    anilistRanksUnmatched: unmatchedAniListIds.size,
    catalogBytes: catalogFile.bytes,
    catalogGzipBytes: catalogFile.gzipBytes,
    tagBytes: tagFile.bytes,
    tagGzipBytes: tagFile.gzipBytes,
    largestDetail,
    warnings,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
