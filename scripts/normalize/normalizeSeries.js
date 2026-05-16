const fs = require("fs");
const path = require("path");

const INPUT_DIR = path.resolve(
  __dirname,
  "../../db/raw/by-year"
);

const SERIES_OUTPUT = path.resolve(
  __dirname,
  "../../db/processed/by-year"
);

const TAGS_OUTPUT = path.resolve(
  __dirname,
  "../../db/processed/tags"
);

if (!fs.existsSync(TAGS_OUTPUT)) {

  fs.mkdirSync(
    TAGS_OUTPUT,
    { recursive: true }
  );
}



function chooseDisplayTitle(
  titles_en = []
) {

  const official =
    titles_en.find(
      t =>
        Array.isArray(t.traits) &&
        t.traits.includes("official")
    );

  if (official) {
    return official.title;
  }

  const nonRomaji =
    titles_en.find(
      t =>
        !/([aeiou]{2,}|-)/i.test(
          t.title
        )
    );

  if (nonRomaji) {
    return nonRomaji.title;
  }

  if (titles_en.length > 0) {
    return titles_en[0].title;
  }

  return "Unknown Title";
}

function getMangabakaLink(series) {

  return `https://mangabaka.org/series/${series.id}`;
}

function getEnglishReadLink(series) {

  const allLinks =
    series.links_v2 || [];

  const englishLink =
    allLinks.find(
      link =>
        link.language === "en" &&
        link.type === "webplatform"
    );

  return englishLink?.url || null;
}

function getSource(series) {

  const src =
    series.source || {};

  const anilistId =
    src.anilist?.id || null;

  const animePlanetId =
    src.anime_planet?.id || null;

  const mangaUpdatesId =
    src.manga_updates?.id || null;

  return {

    anilist: anilistId ? {

      id: anilistId,

      rating:
        src.anilist
          ?.rating_normalized || null,

      url:
        `https://anilist.co/manga/${anilistId}`

    } : null,

    animeplanet:
      animePlanetId ? {

      id:
        animePlanetId,

      rating:
        src.anime_planet
          ?.rating_normalized || null,

      url:
        `https://www.anime-planet.com/manga/${animePlanetId}`

    } : null,

    mangaupdates:
      mangaUpdatesId ? {

      id:
        mangaUpdatesId,

      rating:
        src.manga_updates
          ?.rating_normalized || null,

      url:
        `https://www.mangaupdates.com/series/${mangaUpdatesId}`

    } : null
  };
}

function normalizeSeries(series) {

  const titles =
  series.titles || [];

const englishTitles =
  titles.filter(
    t => t.language === "en"
  );

  return {

    id: series.id,

    state: series.state,

    type: series.type,

    display_title:
      chooseDisplayTitle(
        englishTitles.map(t => ({

          title: t.title,

          traits:
            t.traits || []
        }))
      ),

    

    description:
      series.description || null,

    cover:
      series.cover?.x350?.x1 ||
      series.cover?.x250?.x1 ||
      series.cover?.raw?.url ||
      null,

    total_chapters:
      series.total_chapters || null,

    status:
      series.status || null,

    content_rating:
      series.content_rating || null,

    is_licensed:
      series.is_licensed || false,

    year:
      series.year || null,

    published:
      series.published || null,

    last_updated_at:
      series.last_updated_at || null,

    authors:
      series.authors || [],

    artists:
      series.artists || [],

    

    links: {

      mangabaka:
        getMangabakaLink(series),

      read_en:
        getEnglishReadLink(series)
    },

    source:
      getSource(series)
  };
}

function normalizeTags(series) {

  return {

    id: series.id,

    tags_v2:
      series.tags_v2 || []
  };
}

async function main() {

  const files = fs
    .readdirSync(INPUT_DIR)
    .filter(
      file =>
        file.endsWith(".json")
    );

  for (const file of files) {

    console.log(
      `Processing ${file}`
    );

    const data =
      JSON.parse(
        fs.readFileSync(
          path.join(
            INPUT_DIR,
            file
          ),
          "utf-8"
        )
      );

    const seriesData =
      data.map(
        normalizeSeries
      );

    const tagsData =
      data.map(
        normalizeTags
      );

    const baseName =
      file.replace(
        ".json",
        ""
      );

    fs.writeFileSync(
      path.join(
        SERIES_OUTPUT,
        `${baseName}.series.json`
      ),
      JSON.stringify(
        seriesData,
        null,
        2
      ),
      "utf-8"
    );

    fs.writeFileSync(
      path.join(
        TAGS_OUTPUT,
        `${baseName}.tags.json`
      ),
      JSON.stringify(
        tagsData,
        null,
        2
      ),
      "utf-8"
    );

    console.log(
      `Saved ${baseName}`
    );
  }

  console.log("Done.");
}

main().catch(console.error);
















