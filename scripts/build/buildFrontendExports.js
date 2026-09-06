const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const {
  compactWeeklyHistory,
  finalizeLegacyFrontendExports,
  writeChunkedFrontendExports,
} = require("./writeChunkedFrontendExports");
const {
  applyTitleDisplayOverride,
  loadTitleDisplayOverrides,
} = require("./titleDisplayOverrides");
const { writeUpdatesExport } = require("./buildUpdatesExport");
const { firstSeenDate, updateFirstSeenState } = require("../history/firstSeenState");
const { updatePopularityMilestoneState } = require("../history/popularityMilestoneState");

const SERIES_DIR =
  path.resolve(
    __dirname,
    "../../db/processed/by-year"
  );

const TAGS_DIR =
  path.resolve(
    __dirname,
    "../../db/processed/tags"
  );

const ENRICHED_DIR =
  path.resolve(
    __dirname,
    "../../db/enriched/anilist"
  );

const SNAPSHOT_DIR =
  path.resolve(
    __dirname,
    "../../db/snapshots/anilist-daily"
  );

const EXPORT_DIR =
  path.resolve(
    __dirname,
    "../../db/exports/frontend"
  );

const LATEST_CACHE =
  path.resolve(
    __dirname,
    "../../db/cache/mangabaka-latest.json"
  );

const CONTEXT_OVERRIDES =
  path.resolve(
    __dirname,
    "../../db/curation/context-overrides.json"
  );

const POPULARITY_STATE_PATH = path.resolve(__dirname, "../../db/state/popularity-milestones.json");
const FIRST_SEEN_STATE_PATH = path.resolve(__dirname, "../../db/state/anilist-first-seen.json");
const PUBLISH_FULL_HISTORY =
  process.env.FRONTEND_PUBLISH_FULL_HISTORY === "1" &&
  process.env.FRONTEND_WEEKLY_ONLY !== "1";

function readJson(file) {

  return JSON.parse(
    fs.readFileSync(file, "utf-8")
  );
}

const latestCache =
  fs.existsSync(LATEST_CACHE)
    ? readJson(LATEST_CACHE)
    : { snapshotAt: null, ranks: {} };

const contextOverrides =
  fs.existsSync(CONTEXT_OVERRIDES)
    ? readJson(CONTEXT_OVERRIDES)
    : {};

const titleDisplayOverrides = loadTitleDisplayOverrides();

const seriesMap = new Map();

const tagMap = new Map();

const historyMap = {};
const analyticsEntries = [];

function percentileRank(
  sorted,
  value
) {
  let low = 0;
  let high = sorted.length;

  while (low < high) {
    const middle = (low + high) >>> 1;

    if (sorted[middle] <= value) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return (
    low / sorted.length
  ) * 100;
}

const seriesTagIds = new Map();
const seriesTagWeights = new Map();

const TEXT_STOPWORDS = new Set([
  "a", "about", "after", "again", "all", "also", "an", "and", "are", "as", "at", "back", "be", "been", "but", "by",
  "can", "could", "day", "did", "do", "does", "down", "for", "from", "get", "gets", "had", "has", "have", "he", "her",
  "him", "his", "how", "i", "if", "in", "into", "is", "it", "its", "just", "life", "like", "manga", "manhwa", "may",
  "more", "new", "no", "not", "now", "of", "on", "once", "one", "only", "or", "other", "out", "own", "she", "so",
  "some", "source", "story", "that", "the", "their", "them", "then", "there", "they", "this", "to", "up", "was",
  "when", "where", "who", "will", "with", "world", "would", "you", "young"
]);

function normalizedText(value) {
  return String(value || "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\*\*|\[[^\]]+\]\([^)]+\)/g, " ")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tokensFromText(value) {
  return normalizedText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !TEXT_STOPWORDS.has(token));
}

function increment(map, key, value = 1) {
  map.set(key, (map.get(key) || 0) + value);
}

function tagPathText(tag) {
  return `${tag?.name || ""} ${tag?.path || ""}`.toLowerCase();
}

function tagMatches(tag, pattern) {
  return pattern.test(tagPathText(tag));
}

function buildRecommendationGroups(entry) {
  const groups = new Set();
  const text = normalizedText([
    entry.display_title,
    entry.mangabaka_title,
    entry.native_title,
    entry.romanized_title,
    entry.description,
    ...(entry.authors || []),
    ...(entry.artists || [])
  ].join(" "));
  const tagTexts = (entry.tag_ids || [])
    .map((tagId) => tagMap.get(tagId))
    .filter(Boolean);
  const allText = `${text} ${tagTexts.map(tagPathText).join(" ")}`;

  if (/(business|economics|merchant|company|corporate|conglomerate|chaebol|ceo|director|office|employee|workplace|career|trading|sales|hostile takeover)/.test(allText)) groups.add("business-career");
  if (/(regression|regressed|return|returned|reborn|reincarnation|second chance|time rewind|time travel|time manipulation|age regression|wakes up|back in time|change the past|rewrite destiny)/.test(allText)) groups.add("regression-return");
  if (/(south korea|korean|seoul|chaebol|conglomerate|kdrama|naver|kakao|webtoon)/.test(allText)) groups.add("modern-korea");
  if (/(working|office|company|ceo|director|secretary|coworker|employee|career|manager)/.test(allText)) groups.add("modern-workplace");
  if (/(romance|marriage|pregnancy|dating|couple|wife|husband|fiance|one-night stand|love triangle|male lead falls in love|mature romance)/.test(allText)) groups.add("romance-core");
  if (/(horror|gore|ghost|zombie|death game|survival horror|psychological horror)/.test(allText)) groups.add("horror-survival");
  if (/(murim|wuxia|cultivation|sect|swordplay|martial artist|swordsman|ancient china|chinese ambience|chinese mythology)/.test(allText)) groups.add("murim-wuxia");
  if (/(wuxia|cultivation|sect|ancient china|chinese ambience|chinese mythology)/.test(allText)) groups.add("chinese-murim");
  if (/(dungeon|tower|hunter|ranker|level system|game system|guild|virtual reality|game world|rpg)/.test(allText)) groups.add("game-system");
  if (/(kingdom management|territory management|estate|civilization|agriculture|governance|lord|domain management)/.test(allText)) groups.add("kingdom-management");
  if (/(engineering|engineer|developer|builder|construction|architecture|inventions|civil engineering|estate)/.test(allText)) groups.add("engineering-builder");
  if (/(european ambience|medieval|nobility|royalty|duke|prince|princess|emperor|villainess|castle|kingdom)/.test(allText)) groups.add("euro-fantasy");
  if (/(doctor|medical|hospital|surgeon|nurse|clinic|patient)/.test(allText)) groups.add("medical-career");
  if (/(actor|actress|idol|celebrity|showbiz|entertainment industry|manager)/.test(allText)) groups.add("showbiz-career");
  if (/(boxing|sports|baseball|basketball|football|tennis|golf|wrestling|athletics|racing)/.test(allText)) groups.add("sports-career");
  if (/(school|high school|college|student|teacher|academy)/.test(allText)) groups.add("school-life");
  if (/(food|cooking|restaurant|chef|gourmet)/.test(allText)) groups.add("food-career");

  if (groups.has("business-career") && groups.has("regression-return")) groups.add("business-career-regression");
  if (groups.has("business-career-regression") && groups.has("modern-korea")) groups.add("korean-corporate-regression");
  if (groups.has("korean-corporate-regression") && /(sci-fi|time rewind|time travel|economics|politics|smart protagonist)/.test(allText)) groups.add("sci-fi-business-regression");
  if (groups.has("business-career") && groups.has("modern-workplace")) groups.add("corporate-workplace");
  if (groups.has("business-career") && groups.has("modern-korea")) groups.add("korean-business");
  if (groups.has("romance-core") && groups.has("modern-workplace")) groups.add("office-romance");
  if (groups.has("romance-core") && groups.has("euro-fantasy")) groups.add("euro-romance");

  for (const tag of tagTexts) {
    if (tagMatches(tag, /economics|working|company|ceo|office worker|business|corporate|conglomerate|trading|time rewind|age regression/)) {
      groups.add("business-career-regression");
    }
  }

  return [...groups].sort();
}

function buildTextFeatures(entry, documentFrequencies, totalDocuments) {
  const tokens = tokensFromText([
    entry.display_title,
    entry.mangabaka_title,
    entry.description,
    ...(entry.authors || []),
    ...(entry.artists || [])
  ].join(" "));
  const termCounts = new Map();
  for (const token of tokens) increment(termCounts, token);
  const features = {};
  [...termCounts.entries()]
    .map(([term, count]) => {
      const idf = Math.log((totalDocuments + 1) / ((documentFrequencies.get(term) || 0) + 1)) + 1;
      return [term, Number((count * idf).toFixed(4))];
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, 36)
    .forEach(([term, weight]) => {
      features[term] = weight;
    });
  return features;
}

function signalList(text, checks) {
  return checks.filter((check) => check.pattern.test(text)).map((check) => check.value);
}

function roleFromSignals(primary, secondary = []) {
  if (primary.length >= 2) return "core";
  if (primary.length === 1 && secondary.length >= 1) return "major";
  if (primary.length === 1) return "major";
  if (secondary.length > 0) return "minor";
  return "none";
}

function mergeUnique(left = [], right = []) {
  return [...new Set([...(left || []), ...(right || [])].filter(Boolean))];
}

function primaryProfileFor(groups) {
  const order = [
    "sci-fi-business-regression",
    "korean-corporate-regression",
    "business-career-regression",
    "corporate-workplace",
    "kingdom-management",
    "engineering-builder",
    "murim-wuxia",
    "game-system",
    "medical-career",
    "sports-career",
    "showbiz-career",
    "food-career",
    "horror-survival",
    "office-romance",
    "euro-fantasy",
    "business-career"
  ];
  return order.find((group) => groups.includes(group)) || groups[0] || null;
}

function buildSemanticContext(entry, profileGroups, primaryAnchors) {
  const tags = (entry.tag_ids || [])
    .map((tagId) => tagMap.get(tagId))
    .filter(Boolean);
  const tagNames = tags.map((tag) => tag.name);
  const text = normalizedText([
    entry.display_title,
    entry.mangabaka_title,
    entry.native_title,
    entry.romanized_title,
    entry.description,
    tagNames.join(" "),
    tags.map((tag) => tag.path).join(" ")
  ].join(" "));
  const titleTerms = tokensFromText([
    entry.display_title,
    entry.mangabaka_title,
    entry.native_title,
    entry.romanized_title
  ].join(" ")).slice(0, 12);
  const descriptionTerms = tokensFromText(entry.description || "").slice(0, 24);
  const sourceFields = [
    entry.source?.anilist?.id ? "anilist" : null,
    entry.source?.mangaupdates?.id ? "mangaupdates" : null,
    entry.source?.animeplanet?.id ? "animeplanet" : null,
    entry.links?.read_en ? "read-en" : null
  ].filter(Boolean);
  const storySignals = {
    setting: signalList(text, [
      { pattern: /south korea|seoul|korean|naver|kakao/, value: "modern-korea" },
      { pattern: /company|office|corporate|workplace|employee|ceo|director/, value: "corporate-workplace" },
      { pattern: /kingdom|territory|estate|castle|nobility|duke|emperor|prince|princess/, value: "kingdom-fantasy" },
      { pattern: /murim|wuxia|sect|cultivation|ancient china/, value: "murim-world" },
      { pattern: /school|academy|student|teacher/, value: "school" },
      { pattern: /hospital|clinic|doctor|surgeon/, value: "medical" }
    ]),
    protagonistRole: signalList(text, [
      { pattern: /employee|office worker|worker|salaryman|manager/, value: "employee" },
      { pattern: /ceo|director|chairman|executive|conglomerate|chaebol/, value: "executive" },
      { pattern: /doctor|surgeon|nurse|patient/, value: "medical-professional" },
      { pattern: /hunter|ranker|player|necromancer/, value: "system-player" },
      { pattern: /martial artist|swordsman|cultivator|disciple/, value: "martial-artist" },
      { pattern: /engineer|developer|builder|architect/, value: "builder" }
    ]),
    careerDomain: signalList(text, [
      { pattern: /business|economics|company|corporate|trading|sales|conglomerate|chaebol/, value: "business" },
      { pattern: /engineering|construction|architecture|developer|builder/, value: "engineering" },
      { pattern: /doctor|hospital|surgeon|medical/, value: "medical" },
      { pattern: /actor|idol|showbiz|entertainment|celebrity/, value: "showbiz" },
      { pattern: /boxing|baseball|basketball|football|tennis|golf|sports/, value: "sports" },
      { pattern: /food|chef|restaurant|cooking|gourmet/, value: "food" }
    ]),
    premiseMechanic: signalList(text, [
      { pattern: /time rewind|time travel|regression|regressed|returned|second chance|back in time/, value: "regression" },
      { pattern: /reincarnation|reborn|transmigration|isekai/, value: "reincarnation" },
      { pattern: /system|level system|quest|skill|status window/, value: "system" },
      { pattern: /dungeon|tower|hunter|ranker/, value: "hunter-system" }
    ]),
    conflictType: signalList(text, [
      { pattern: /revenge|betrayal|murder|dead family|hostile takeover/, value: "revenge" },
      { pattern: /survival|death game|apocalypse|zombie|horror/, value: "survival" },
      { pattern: /politics|succession|throne|kingdom/, value: "politics" },
      { pattern: /romance|marriage|dating|pregnancy|love/, value: "romance" }
    ]),
    progressionType: signalList(text, [
      { pattern: /career|promotion|employee|company|business|success/, value: "career-growth" },
      { pattern: /level|rank|hunter|tower|dungeon|quest/, value: "power-growth" },
      { pattern: /kingdom management|territory|estate|construction|agriculture/, value: "management-growth" },
      { pattern: /training|cultivation|martial arts|sword/, value: "martial-growth" }
    ]),
    tone: signalList(text, [
      { pattern: /comedy|gag|parody|satire/, value: "comedic" },
      { pattern: /horror|gore|trauma|psychological/, value: "dark" },
      { pattern: /revenge|betrayal|murder|politics/, value: "tense" },
      { pattern: /romance|slice of life|family life/, value: "warm" }
    ]),
    worldType: signalList(text, [
      { pattern: /urban|modern|21st century|company|office|south korea/, value: "modern-urban" },
      { pattern: /fantasy|magic|kingdom|medieval|nobility/, value: "fantasy-world" },
      { pattern: /murim|wuxia|sect|cultivation/, value: "martial-world" },
      { pattern: /game|system|dungeon|tower|hunter/, value: "system-world" }
    ]),
    romanceRole: roleFromSignals(signalList(text, [{ pattern: /romance|marriage|dating|pregnancy|love triangle|wife|husband/, value: "romance" }]), signalList(text, [{ pattern: /ceo|office|duke|villainess/, value: "context" }])),
    regressionRole: roleFromSignals(signalList(text, [{ pattern: /time rewind|regression|regressed|second chance|back in time/, value: "regression" }]), signalList(text, [{ pattern: /reincarnation|reborn|returned/, value: "return" }])),
    systemRole: roleFromSignals(signalList(text, [{ pattern: /level system|status window|system administrator|quest|skill/, value: "system" }]), signalList(text, [{ pattern: /dungeon|tower|hunter|ranker|game/, value: "game" }]))
  };

  const context = {
    primaryProfile: primaryProfileFor(profileGroups),
    profileGroups,
    primaryAnchors,
    excludedProfiles: [],
    storySignals,
    semanticSummary: [primaryProfileFor(profileGroups), ...storySignals.setting.slice(0, 2), ...storySignals.premiseMechanic.slice(0, 2)]
      .filter(Boolean)
      .join(" / "),
    searchKeywords: mergeUnique(titleTerms, descriptionTerms).slice(0, 40),
    evidence: {
      tags: tagNames.slice(0, 40),
      titleTerms,
      descriptionTerms,
      sourceFields
    },
    confidence: Number(Math.min(1, 0.28 + profileGroups.length * 0.07 + primaryAnchors.length * 0.09 + Math.min(tags.length, 24) * 0.01).toFixed(3))
  };

  const override = contextOverrides[String(entry.id)] || contextOverrides[entry.display_title];
  if (!override) return context;

  return {
    ...context,
    ...override,
    profileGroups: mergeUnique(context.profileGroups, override.profileGroups),
    primaryAnchors: mergeUnique(context.primaryAnchors, override.primaryAnchors),
    excludedProfiles: mergeUnique(context.excludedProfiles, override.excludedProfiles),
    evidence: {
      ...context.evidence,
      ...(override.evidence || {})
    },
    storySignals: {
      ...context.storySignals,
      ...(override.storySignals || {})
    }
  };
}

function buildRecommendationFeature(entry, tagDocumentCounts, textDocumentFrequencies, totalDocuments) {
  const profileGroups = buildRecommendationGroups(entry);
  const tagFeatures = {};
  for (const tagId of entry.tag_ids || []) {
    const tag = tagMap.get(tagId);
    if (!tag) continue;
    const idf = Math.log((totalDocuments + 1) / ((tagDocumentCounts.get(tagId) || 0) + 1)) + 1;
    tagFeatures[`tag:${tagId}`] = Number(idf.toFixed(4));
    const pathParts = String(tag.path || "").split(" > ").filter(Boolean);
    if (pathParts[0]) tagFeatures[`root:${pathParts[0]}`] = Number(Math.min(0.4, idf * 0.08).toFixed(4));
    if (tag.parent_id) tagFeatures[`parent:${tag.parent_id}`] = Number((idf * 0.22).toFixed(4));
  }
  const primaryAnchors = profileGroups.filter((group) =>
    [
      "business-career-regression",
      "corporate-workplace",
      "korean-business",
      "korean-corporate-regression",
      "sci-fi-business-regression",
      "kingdom-management",
      "engineering-builder",
      "horror-survival",
      "murim-wuxia",
      "chinese-murim",
      "game-system",
      "euro-fantasy",
      "medical-career",
      "showbiz-career",
      "sports-career",
      "food-career"
    ].includes(group)
  );
  return {
    id: entry.id,
    profileGroups,
    primaryAnchors,
    context: buildSemanticContext(entry, profileGroups, primaryAnchors),
    tagFeatures,
    textFeatures: buildTextFeatures(entry, textDocumentFrequencies, totalDocuments),
    quality: {
      discPct: entry.analytics?.fanFavouriteDiscoveryPercentile ?? null,
      fanPct: entry.analytics?.fanFavouriteRaw ?? null,
      popularity: entry.stats?.popularity ?? null
    }
  };
}



const tagFiles =
  fs.readdirSync(TAGS_DIR);

for (const file of tagFiles) {

  const data =
    readJson(
      path.join(TAGS_DIR, file)
    );

  for (const entry of data) {

    const ids = [];
    const weights = {};

    for (
      const tag of
      entry.tags_v2 || []
    ) {

      ids.push(tag.id);

      if (Number.isSafeInteger(tag.id) && typeof tag.weight === "string" && tag.weight.trim()) {
        weights[String(tag.id)] = tag.weight.trim();
      }

      if (!tagMap.has(tag.id)) {

        tagMap.set(tag.id, {

          id: tag.id,

          name: tag.name,

          path: tag.name_path,

          is_genre:
            tag.is_genre,

          parent_id:
            tag.parent_id,

          level:
            tag.level
        });
      }
    }

    seriesTagIds.set(
      entry.id,
      ids
    );

    seriesTagWeights.set(
      entry.id,
      weights
    );
  }
}



const seriesFiles =
  fs.readdirSync(SERIES_DIR);

for (const file of seriesFiles) {

  const data =
    readJson(
      path.join(SERIES_DIR, file)
    );

  for (const entry of data) {

    const displayTitle = applyTitleDisplayOverride(entry, titleDisplayOverrides);

    seriesMap.set(entry.id, {

      id: entry.id,

      state:
        entry.state,

      type:
        entry.type,

      display_title:
        displayTitle,

      mangabaka_title:
        entry.mangabaka_title || null,

      native_title:
        entry.native_title || null,

      romanized_title:
        entry.romanized_title || null,

      titles:
        entry.titles || [],

      description:
        entry.description || null,

      cover:
        entry.cover || null,

      total_chapters:
        entry.total_chapters || null,

      status:
        entry.status || null,

      content_rating:
        entry.content_rating || null,

      is_licensed:
        entry.is_licensed || false,

      year:
        entry.year || null,

      published:
        entry.published || {},

      first_seen_at:
        entry.first_seen_at || null,

      first_seen_at_is_trusted:
        entry.first_seen_at_is_trusted === true,

      last_updated_at:
        entry.last_updated_at || null,

      mangabaka_latest_rank:
        latestCache.ranks?.[entry.id] || null,

      mangabaka_latest_snapshot_at:
        latestCache.snapshotAt || null,

      authors:
        entry.authors || [],

      artists:
        entry.artists || [],

      

      links:
        entry.links || {},

      source:
        entry.source || {},

      tag_ids:
        seriesTagIds.get(entry.id) || [],

      ...(entry.source?.anilist?.id != null && Object.keys(seriesTagWeights.get(entry.id) || {}).length > 0
        ? { tag_weights: seriesTagWeights.get(entry.id) }
        : {}),

      stats: {

        popularity: null,

        favourites: null,

        meanScore: null
      },

      analytics: {

        fanFavouriteRaw: null,

        fanFavouriteWeighted: null,

        fanFavouritePercentile: null
      }
    });
  }
}



const enrichedFiles =
  fs.readdirSync(ENRICHED_DIR);

for (const file of enrichedFiles) {

  const data =
    readJson(
      path.join(ENRICHED_DIR, file)
    );

  for (const entry of data) {

    const existing =
      seriesMap.get(entry.id);

    if (
      existing &&
      entry.anilist
    ) {

      existing.stats = {

        popularity:
          entry.anilist.popularity,

        favourites:
          entry.anilist.favourites,

        meanScore:
          entry.anilist.meanScore
      };

      const popularity =
        entry.anilist.popularity || 0;

      const favourites =
        entry.anilist.favourites || 0;

      const rawRatio =
        popularity > 0
          ? (favourites / popularity) * 100
          : 0;

      existing.analytics = {

        fanFavouriteRaw:
          Number(
            rawRatio.toFixed(4)
          ),

        fanRatioPercentile:
          null,

        popularityPercentile:
          null,

        fanFavouriteDiscoveryScore:
          null,

        fanFavouriteDiscoveryPercentile:
          null
      };

      analyticsEntries.push({

        id: existing.id,

        popularity,

        rawRatio
      });
    }
  }
}







const popularityValues =
  analyticsEntries
    .map(x =>
      Math.log10(
        Math.max(
          x.popularity,
          1
        )
      )
    )
    .sort((a,b)=>a-b);

const ratioValues =
  analyticsEntries
    .map(x => x.rawRatio)
    .sort((a,b)=>a-b);

for (
  const entry of
  analyticsEntries
) {

  const popularityLog =
    Math.log10(
      Math.max(
        entry.popularity,
        1
      )
    );

  const popPercentile =
    percentileRank(
      popularityValues,
      popularityLog
    );

  const ratioPercentile =
    percentileRank(
      ratioValues,
      entry.rawRatio
    );

  const confidenceWeight =
    1 /
    (
      1 +
      Math.exp(
        -(
          (popPercentile - 20)
          / 12
        )
      )
    );

  const discoveryScore =
    ratioPercentile *
    confidenceWeight;

  const series =
    seriesMap.get(entry.id);

  if (series) {

    series.analytics = {

      fanFavouriteRaw:
        Number(
          entry.rawRatio.toFixed(4)
        ),

      fanRatioPercentile:
        Number(
          ratioPercentile.toFixed(4)
        ),

      popularityPercentile:
        Number(
          popPercentile.toFixed(4)
        ),

      fanFavouriteDiscoveryScore:
        Number(
          discoveryScore.toFixed(4)
        )
    };
  }
}

const discoveryScores =
  analyticsEntries
    .map(x => {

      const series =
        seriesMap.get(x.id);

      return series?.analytics
        ?.fanFavouriteDiscoveryScore || 0;
    })
    .sort((a,b)=>a-b);

for (
  const entry of
  analyticsEntries
) {

  const series =
    seriesMap.get(entry.id);

  if (!series) continue;

  const score =
    series.analytics
      .fanFavouriteDiscoveryScore;

  const discoveryPercentile =
    percentileRank(
      discoveryScores,
      score
    );

  series.analytics
    .fanFavouriteDiscoveryPercentile =
      Number(
        discoveryPercentile.toFixed(4)
      );
}

const snapshotFiles =

  fs.readdirSync(SNAPSHOT_DIR)
    .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
    .sort();


for (const file of snapshotFiles) {


  const date =

    file.replace(".json", "");


  const data =

    readJson(

      path.join(SNAPSHOT_DIR, file)

    );


  const dayEntries = [];


  for (const entry of data) {


    const popularity =
      entry.popularity || 0;


    const favourites =
      entry.favourites || 0;


    const rawRatio =

      popularity > 0
        ? (favourites / popularity) * 100
        : 0;


    dayEntries.push({


      id: entry.id,


      popularity,


      favourites,


      meanScore:
        entry.meanScore || null,


      rawRatio
    });

  }


  const dailyPopularityValues =

    dayEntries

      .map(x =>

        Math.log10(

          Math.max(

            x.popularity,

            1

          )

        )

      )

      .sort((a,b)=>a-b);


  const dailyRatioValues =

    dayEntries

      .map(x => x.rawRatio)

      .sort((a,b)=>a-b);


  const dailyDiscoveryScores = [];


  for (const entry of dayEntries) {


    const popularityLog =

      Math.log10(

        Math.max(

          entry.popularity,

          1

        )

      );


    const popPercentile =

      percentileRank(

        dailyPopularityValues,

        popularityLog

      );


    const ratioPercentile =

      percentileRank(

        dailyRatioValues,

        entry.rawRatio

      );


    const confidenceWeight =

      1 /

      (

        1 +

        Math.exp(

          -(

            (popPercentile - 20)

            / 12

          )

        )

      );


    const discoveryScore =

      ratioPercentile *

      confidenceWeight;


    dailyDiscoveryScores.push(
      discoveryScore
    );

  }


  dailyDiscoveryScores.sort(
    (a,b)=>a-b
  );


  for (const entry of dayEntries) {


    if (

      !historyMap[entry.id]

    ) {


      historyMap[entry.id] = [];

    }


    const popularityLog =

      Math.log10(

        Math.max(

          entry.popularity,

          1

        )

      );


    const popPercentile =

      percentileRank(

        dailyPopularityValues,

        popularityLog

      );


    const ratioPercentile =

      percentileRank(

        dailyRatioValues,

        entry.rawRatio

      );


    const confidenceWeight =

      1 /

      (

        1 +

        Math.exp(

          -(

            (popPercentile - 20)

            / 12

          )

        )

      );


    const discoveryScore =

      ratioPercentile *

      confidenceWeight;


    const discoveryPercentile =

      percentileRank(

        dailyDiscoveryScores,

        discoveryScore

      );


    historyMap[entry.id].push({


      d: date,


      p: entry.popularity,


      f: entry.favourites,


      s: entry.meanScore,


      r:
        Number(
          entry.rawRatio.toFixed(4)
        ),


      rp:
        Number(
          ratioPercentile.toFixed(4)
        ),


      pp:
        Number(
          popPercentile.toFixed(4)
        ),


      ds:
        Number(
          discoveryScore.toFixed(4)
        ),


      dp:
        Number(
          discoveryPercentile.toFixed(4)
        )
    });

  }

}

const discovery = [];
const weeklyHistoryMap = compactWeeklyHistory(historyMap);
const existingPopularityState = fs.existsSync(POPULARITY_STATE_PATH)
  ? readJson(POPULARITY_STATE_PATH)
  : null;
const existingFirstSeenState = fs.existsSync(FIRST_SEEN_STATE_PATH)
  ? readJson(FIRST_SEEN_STATE_PATH)
  : null;
if ((!existingPopularityState || !existingFirstSeenState) && snapshotFiles.length <= 14) {
  throw new Error("History state must be bootstrapped before pruning snapshots to the 14-day buffer.");
}
const popularityState = updatePopularityMilestoneState(existingPopularityState, historyMap);
const firstSeenState = updateFirstSeenState(existingFirstSeenState, historyMap);
fs.writeFileSync(POPULARITY_STATE_PATH, `${JSON.stringify(popularityState)}\n`);
fs.writeFileSync(FIRST_SEEN_STATE_PATH, `${JSON.stringify(firstSeenState)}\n`);
const recommendationFeatures = [];

for (
  const entry of
  seriesMap.values()
) {
  if (!entry.first_seen_at) {
    entry.first_seen_at = firstSeenDate(firstSeenState, entry.id, entry.last_updated_at);
  }

  discovery.push({

    id: entry.id,

    display_title:
      entry.display_title,

    mangabaka_title:
      entry.mangabaka_title,

    native_title:
      entry.native_title,

    romanized_title:
      entry.romanized_title,

    titles:
      entry.titles,

    cover:
      entry.cover,

    year:
      entry.year,

    status:
      entry.status,

    content_rating:
      entry.content_rating,

    type:
      entry.type,

    total_chapters:
      entry.total_chapters,

    published:
      entry.published,

    first_seen_at:
      entry.first_seen_at,

    first_seen_at_is_trusted:
      entry.first_seen_at_is_trusted,

    last_updated_at:
      entry.last_updated_at,

    mangabaka_latest_rank:
      entry.mangabaka_latest_rank,

    mangabaka_latest_snapshot_at:
      entry.mangabaka_latest_snapshot_at,

    authors:
      entry.authors,

    artists:
      entry.artists,

    links:
      entry.links,

    source:
      entry.source,

    tag_ids:
      entry.tag_ids,

    ...(entry.source?.anilist?.id != null && Object.keys(entry.tag_weights || {}).length > 0
      ? { tag_weights: entry.tag_weights }
      : {}),

    stats:
      entry.stats,

    analytics:
      entry.analytics
  });

  const detailPath = path.join(EXPORT_DIR, `details/${entry.id}.json`);
  let preservedContext;
  try {
    if (fs.existsSync(detailPath)) preservedContext = JSON.parse(fs.readFileSync(detailPath, "utf8")).context;
  } catch {
    preservedContext = undefined;
  }
  fs.writeFileSync(
    detailPath,

    JSON.stringify(
      {
        ...entry,
        ...(preservedContext === undefined ? {} : { context: preservedContext }),
        display_title: applyTitleDisplayOverride(entry, titleDisplayOverrides),
      },
      null,
      2
    )
  );
}

fs.mkdirSync(
  path.join(
    EXPORT_DIR,
    "recommendations"
  ),
  { recursive: true }
);

const tagsExport = Object.fromEntries(tagMap);

fs.writeFileSync(

  path.join(
    EXPORT_DIR,
    "series/all.json"
  ),

  JSON.stringify(discovery)
);

fs.writeFileSync(

  path.join(
    EXPORT_DIR,
    "recommendations/features.json"
  ),

  JSON.stringify(recommendationFeatures)
);

fs.writeFileSync(

  path.join(
    EXPORT_DIR,
    "meta/tags.json"
  ),

  JSON.stringify(
    tagsExport,
    null,
    2
  )
);

if (PUBLISH_FULL_HISTORY) {
  fs.writeFileSync(
    path.join(EXPORT_DIR, "stats/history.json"),
    JSON.stringify(historyMap)
  );
} else {
  fs.rmSync(path.join(EXPORT_DIR, "stats/history.json"), { force: true });
  fs.rmSync(path.join(EXPORT_DIR, "stats/history.json.gz"), { force: true });
}

writeUpdatesExport({
  exportDir: EXPORT_DIR,
  catalog: discovery,
  history: historyMap,
  generatedAt: latestCache.snapshotAt || new Date().toISOString(),
});

fs.writeFileSync(

  path.join(
    EXPORT_DIR,
    "meta/history-schema.json"
  ),

  JSON.stringify({

    d: "date",

    p: "popularity",

    f: "favourites",

    s: "meanScore",

    r: "fanFavouriteRaw",
    w: "fanFavouriteWeighted",
    pp: "fanFavouritePercentile"
  },
  null,
  2)
);

console.log(
  "Frontend exports built."
);



function gzipFile(filePath) {

  const content =
    fs.readFileSync(filePath);

  const gzipped =
    zlib.gzipSync(content);

  fs.writeFileSync(
    `${filePath}.gz`,
    gzipped
  );
}

gzipFile(
  path.join(
    EXPORT_DIR,
    "series/all.json"
  )
);

gzipFile(
  path.join(
    EXPORT_DIR,
    "meta/tags.json"
  )
);

gzipFile(
  path.join(
    EXPORT_DIR,
    "recommendations/features.json"
  )
);

if (PUBLISH_FULL_HISTORY) gzipFile(path.join(EXPORT_DIR, "stats/history.json"));

console.log(
  "Gzip exports built."
);

writeChunkedFrontendExports({
  exportDir: EXPORT_DIR,
  catalog: discovery,
  tags: tagsExport,
  history: PUBLISH_FULL_HISTORY ? historyMap : null,
  weeklyHistory: weeklyHistoryMap,
  recommendations: recommendationFeatures,
  generatedAt: latestCache.snapshotAt || new Date().toISOString(),
});

finalizeLegacyFrontendExports(EXPORT_DIR, { retainFullHistory: PUBLISH_FULL_HISTORY });









