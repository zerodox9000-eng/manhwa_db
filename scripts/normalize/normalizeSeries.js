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



function cleanTitle(value) {

  const title =
    String(value || "").trim();

  return title &&
    !/^(unknown title|untitled|no title|n\/a|-)?$/i.test(title)
      ? title
      : null;
}

function chooseDisplayTitle(
  series,
  titles_en = []
) {

  const primaryOfficial =
    titles_en.find(
      t =>
        t.is_primary === true &&
        Array.isArray(t.traits) &&
        t.traits.includes("official") &&
        cleanTitle(t.title)
    );

  if (primaryOfficial) {
    return cleanTitle(primaryOfficial.title);
  }

  const primary =
    titles_en.find(
      t =>
        t.is_primary === true &&
        cleanTitle(t.title)
    );

  if (primary) {
    return cleanTitle(primary.title);
  }

  const official =
    titles_en.find(
      t =>
        Array.isArray(t.traits) &&
        t.traits.includes("official") &&
        cleanTitle(t.title)
    );

  if (official) {
    return cleanTitle(official.title);
  }

  const englishTitle =
    titles_en.find(t => cleanTitle(t.title));

  if (englishTitle) {
    return cleanTitle(englishTitle.title);
  }

  return (
    cleanTitle(series.title) ||
    cleanTitle(series.native_title) ||
    cleanTitle(series.romanized_title) ||
    "Unknown Title"
  );
}

function cleanTitleEntry(title) {

  const clean =
    cleanTitle(title?.title);

  if (!clean) {
    return null;
  }

  return {
    language:
      title.language || null,

    title:
      clean,

    traits:
      Array.isArray(title.traits)
        ? title.traits
        : [],

    is_primary:
      title.is_primary === true,

    note:
      title.note || null
  };
}

function getMangabakaLink(series) {

  return `https://mangabaka.org/${series.id}`;
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
    (series.titles || [])
      .map(cleanTitleEntry)
      .filter(Boolean);

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
        series,
        englishTitles.map(t => ({

          title: t.title,

          traits:
            t.traits || [],

          is_primary:
            t.is_primary === true
        }))
      ),

    mangabaka_title:
      cleanTitle(series.title),

    native_title:
      cleanTitle(series.native_title),

    romanized_title:
      cleanTitle(series.romanized_title),

    titles,

    

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

    first_seen_at:
      series.first_seen_at ||
      series._first_seen_at ||
      null,

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
















