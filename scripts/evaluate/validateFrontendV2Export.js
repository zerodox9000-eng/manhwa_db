const fs = require("fs");
const path = require("path");

const EXPORT_DIR = path.resolve(
  process.env.FRONTEND_V2_EXPORT_DIR || path.join(__dirname, "../../db/exports/frontend-v2"),
);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

function validate() {
  const errors = [];
  const manifestPath = path.join(EXPORT_DIR, "manifest.json");
  assert(fs.existsSync(manifestPath), `Missing manifest: ${manifestPath}`, errors);
  if (errors.length) return errors;

  const manifest = readJson(manifestPath);
  assert(manifest.contract?.name === "manhwa-frontend-v2", "Unexpected v2 contract name", errors);
  assert(Number.isInteger(manifest.contract?.version), "Missing numeric contract version", errors);
  assert(Boolean(manifest.build?.id), "Missing build id", errors);
  assert(manifest.atomicLoading?.switchPolicy === "download-and-validate-build-before-visible-switch", "Missing atomic switch policy", errors);

  const catalogPath = path.join(EXPORT_DIR, manifest.files?.catalog?.path || "");
  const tagsPath = path.join(EXPORT_DIR, manifest.files?.tags?.path || "");
  assert(fs.existsSync(catalogPath), `Missing catalog file: ${catalogPath}`, errors);
  assert(fs.existsSync(`${catalogPath}.gz`), `Missing catalog gzip: ${catalogPath}.gz`, errors);
  assert(fs.existsSync(tagsPath), `Missing tags file: ${tagsPath}`, errors);
  assert(fs.existsSync(`${tagsPath}.gz`), `Missing tags gzip: ${tagsPath}.gz`, errors);
  if (errors.length) return errors;

  const catalog = readJson(catalogPath);
  const tags = readJson(tagsPath);
  assert(Array.isArray(catalog), "Catalog must be an array", errors);
  assert(Array.isArray(tags), "Tag graph must be an array", errors);
  assert(catalog.length === manifest.counts?.catalog, "Catalog count does not match manifest", errors);
  assert(tags.length === manifest.counts?.tags, "Tag count does not match manifest", errors);
  assert(catalog.some((item) => item.year === 2013), "Catalog is missing year-2013 titles", errors);

  let anilistRanks = 0;
  let animeplanetTitles = 0;
  const seenIds = new Set();
  for (const item of catalog) {
    assert(Number.isInteger(item.id), "Catalog item missing integer id", errors);
    assert(!seenIds.has(item.id), `Duplicate catalog id ${item.id}`, errors);
    seenIds.add(item.id);
    assert(Boolean(item.display_title), `Series ${item.id} missing display_title`, errors);
    assert(item.cover?.aspectRatio > 0, `Series ${item.id} missing positive cover aspectRatio`, errors);
    assert(item.release && typeof item.release === "object", `Series ${item.id} missing release object`, errors);

    if (item.anilist_added_rank != null) {
      anilistRanks += 1;
      assert(item.source_flags?.anilist === true, `Series ${item.id} has AniList rank without AniList source`, errors);
    }
    if (item.animeplanet_title != null) {
      animeplanetTitles += 1;
      assert(item.source_flags?.animeplanet === true, `Series ${item.id} has Anime-Planet title without Anime-Planet source`, errors);
    }
  }

  assert(anilistRanks === manifest.counts?.anilistAddedRanksMatched, "AniList rank count does not match manifest", errors);
  assert(animeplanetTitles === manifest.counts?.animeplanetTitlesDerived, "Anime-Planet title count does not match manifest", errors);

  const detailTemplate = manifest.files?.details?.pathTemplate;
  assert(typeof detailTemplate === "string" && detailTemplate.includes("{id}"), "Missing detail path template", errors);
  const detailPrefix = typeof detailTemplate === "string" ? detailTemplate.split("{id}")[0] : "";
  const detailsDir = path.join(EXPORT_DIR, detailPrefix);
  const detailFileCount = fs.existsSync(detailsDir)
    ? fs.readdirSync(detailsDir).filter((file) => file.endsWith(".json")).length
    : 0;
  assert(detailFileCount === manifest.files?.details?.count, "Detail file count does not match manifest", errors);
  assert(detailFileCount === catalog.length, "Detail file count does not match catalog count", errors);
  for (const item of catalog.slice(0, 10)) {
    const detailPath = path.join(EXPORT_DIR, detailTemplate.replace("{id}", String(item.id)));
    assert(fs.existsSync(detailPath), `Missing sample detail file: ${detailPath}`, errors);
  }

  assert(fs.statSync(catalogPath).size < 100 * 1024 * 1024, "Catalog file exceeds GitHub size limit", errors);
  assert(fs.statSync(path.join(EXPORT_DIR, manifest.files?.catalog?.gzipPath || "")).size > 0, "Missing catalog gzip bytes", errors);

  return errors;
}

const errors = validate();
if (errors.length) {
  console.error(`Frontend v2 export validation failed with ${errors.length} error(s):`);
  for (const error of errors.slice(0, 50)) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Frontend v2 export validation passed.");
