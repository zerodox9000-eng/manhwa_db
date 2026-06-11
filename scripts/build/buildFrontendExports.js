const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

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

function readJson(file) {

  return JSON.parse(
    fs.readFileSync(file, "utf-8")
  );
}

const latestCache =
  fs.existsSync(LATEST_CACHE)
    ? readJson(LATEST_CACHE)
    : { snapshotAt: null, ranks: {} };

const seriesMap = new Map();

const tagMap = new Map();

const historyMap = {};
const analyticsEntries = [];

function percentileRank(
  sorted,
  value
) {

  let count = 0;

  for (const v of sorted) {

    if (v <= value) {

      count++;
    }
  }

  return (
    count / sorted.length
  ) * 100;
}

const seriesTagIds = new Map();

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

  if (/(business|economics|merchant|company|corporate|conglomerate|ceo|director|office|employee|workplace|career|trading|hostile takeover|politic|revenge|betrayal|murder|smart protagonist)/.test(allText)) groups.add("business-career");
  if (/(regression|regressed|return|returned|reborn|reincarnation|second chance|time rewind|time travel|time manipulation|age regression|wakes up|back in time|change the past|rewrite destiny)/.test(allText)) groups.add("regression-return");
  if (/(south korea|korean|seoul|chaebol|conglomerate|kdrama|naver|kakao|webtoon)/.test(allText)) groups.add("modern-korea");
  if (/(working|office|company|ceo|director|secretary|coworker|employee|career|manager)/.test(allText)) groups.add("modern-workplace");
  if (/(romance|marriage|pregnancy|dating|couple|wife|husband|fiance|one-night stand|love triangle|male lead falls in love|mature romance)/.test(allText)) groups.add("romance-core");
  if (/(horror|gore|ghost|zombie|death game|survival horror|psychological horror)/.test(allText)) groups.add("horror-survival");
  if (/(murim|wuxia|martial arts|cultivation|sect|swordplay|martial artist|swordsman|ancient china|chinese ambience|chinese mythology)/.test(allText)) groups.add("murim-wuxia");
  if (/(dungeon|tower|hunter|ranker|level system|game system|guild|virtual reality|game world|rpg)/.test(allText)) groups.add("game-system");
  if (/(european ambience|medieval|nobility|royalty|duke|prince|princess|emperor|villainess|castle|kingdom)/.test(allText)) groups.add("euro-fantasy");
  if (/(doctor|medical|hospital|surgeon|nurse|clinic|patient)/.test(allText)) groups.add("medical-career");
  if (/(actor|actress|idol|celebrity|showbiz|entertainment industry|manager)/.test(allText)) groups.add("showbiz-career");
  if (/(boxing|sports|baseball|basketball|football|tennis|golf|wrestling|athletics|racing)/.test(allText)) groups.add("sports-career");
  if (/(school|high school|college|student|teacher|academy)/.test(allText)) groups.add("school-life");
  if (/(food|cooking|restaurant|chef|gourmet)/.test(allText)) groups.add("food-career");

  if (groups.has("business-career") && groups.has("regression-return")) groups.add("business-career-regression");
  if (groups.has("business-career") && groups.has("modern-workplace")) groups.add("corporate-workplace");
  if (groups.has("business-career") && groups.has("modern-korea")) groups.add("korean-business");
  if (groups.has("romance-core") && groups.has("modern-workplace")) groups.add("office-romance");
  if (groups.has("romance-core") && groups.has("euro-fantasy")) groups.add("euro-romance");

  for (const tag of tagTexts) {
    if (tagMatches(tag, /economics|politics|working|company|ceo|office worker|smart protagonist|time rewind|time travel|age regression|second chance|betrayal|revenge/)) {
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
      "horror-survival",
      "murim-wuxia",
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

    for (
      const tag of
      entry.tags_v2 || []
    ) {

      ids.push(tag.id);

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

    seriesMap.set(entry.id, {

      id: entry.id,

      state:
        entry.state,

      type:
        entry.type,

      display_title:
        entry.display_title,

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

  fs.readdirSync(SNAPSHOT_DIR);


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
const recommendationFeatures = [];
const tagDocumentCounts = new Map();
const textDocumentFrequencies = new Map();
const totalDocuments = seriesMap.size;

for (const entry of seriesMap.values()) {
  for (const tagId of new Set(entry.tag_ids || [])) {
    increment(tagDocumentCounts, tagId);
  }
  for (const token of new Set(tokensFromText([
    entry.display_title,
    entry.mangabaka_title,
    entry.description,
    ...(entry.authors || []),
    ...(entry.artists || [])
  ].join(" ")))) {
    increment(textDocumentFrequencies, token);
  }
}

for (
  const entry of
  seriesMap.values()
) {

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

    stats:
      entry.stats,

    analytics:
      entry.analytics
  });

  recommendationFeatures.push(
    buildRecommendationFeature(
      entry,
      tagDocumentCounts,
      textDocumentFrequencies,
      totalDocuments
    )
  );

  fs.writeFileSync(

    path.join(
      EXPORT_DIR,
      `details/${entry.id}.json`
    ),

    JSON.stringify(
      entry,
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

fs.writeFileSync(

  path.join(
    EXPORT_DIR,
    "series/all.json"
  ),

  JSON.stringify(
    discovery,
    null,
    2
  )
);

fs.writeFileSync(

  path.join(
    EXPORT_DIR,
    "recommendations/features.json"
  ),

  JSON.stringify(
    recommendationFeatures,
    null,
    2
  )
);

fs.writeFileSync(

  path.join(
    EXPORT_DIR,
    "meta/tags.json"
  ),

  JSON.stringify(
    Object.fromEntries(tagMap),
    null,
    2
  )
);

fs.writeFileSync(

  path.join(
    EXPORT_DIR,
    "stats/history.json"
  ),

  JSON.stringify(
    historyMap,
    null,
    2
  )
);

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

gzipFile(
  path.join(
    EXPORT_DIR,
    "stats/history.json"
  )
);

console.log(
  "Gzip exports built."
);










