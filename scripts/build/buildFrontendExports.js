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
    "stats/history.json"
  )
);

console.log(
  "Gzip exports built."
);










