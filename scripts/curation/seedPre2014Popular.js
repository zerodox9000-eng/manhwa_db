require("dotenv").config();

const { GraphQLClient, gql } = require("graphql-request");
const {
  DEFAULT_EXPECTED_COUNT,
  DEFAULT_ROSTER_FILE,
  writeJsonAtomic,
} = require("./pre2014Popular");

const client = new GraphQLClient("https://graphql.anilist.co", {
  headers: {
    referer: "https://github.com/zerodox9000-eng/manhwa_db",
  },
});

const PAGE_SIZE = 50;
const POPULARITY_THRESHOLD = 1000;
const RELEASE_DATE_BEFORE = 20140000;
const EXPECTED_COUNT = Number(
  process.env.PRE2014_POPULAR_EXPECTED_COUNT || DEFAULT_EXPECTED_COUNT
);
const QUERY = gql`
  query(
    $page: Int!,
    $perPage: Int!,
    $country: CountryCode!,
    $before: FuzzyDateInt!,
    $popularity: Int!,
    $adult: Boolean!
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        hasNextPage
        lastPage
      }
      media(
        type: MANGA
        countryOfOrigin: $country
        startDate_lesser: $before
        popularity_greater: $popularity
        isAdult: $adult
        sort: POPULARITY_DESC
      ) {
        id
        countryOfOrigin
        popularity
        isAdult
        title {
          english
          romaji
          native
        }
        startDate {
          year
          month
          day
        }
      }
    }
  }
`;

function displayTitle(title) {
  return title?.english || title?.romaji || title?.native || null;
}

async function discover() {
  const entries = [];
  const seen = new Set();
  let page = 1;

  while (true) {
    const data = await client.request(QUERY, {
      page,
      perPage: PAGE_SIZE,
      country: "KR",
      before: RELEASE_DATE_BEFORE,
      popularity: POPULARITY_THRESHOLD,
      adult: false,
    });
    const pageData = data.Page;

    for (const media of pageData.media || []) {
      const year = Number(media.startDate?.year);
      const popularity = Number(media.popularity);
      if (
        media.countryOfOrigin !== "KR" ||
        year > 2013 ||
        popularity <= POPULARITY_THRESHOLD ||
        media.isAdult !== false
      ) {
        continue;
      }
      if (seen.has(media.id)) continue;
      seen.add(media.id);
      entries.push({
        anilist_id: media.id,
        title: displayTitle(media.title),
        release_year: Number.isSafeInteger(year) ? year : null,
        popularity,
        country_of_origin: media.countryOfOrigin,
      });
      if (entries.length > EXPECTED_COUNT) {
        throw new Error(
          `AniList pre-2014 popular discovery exceeded the expected ${EXPECTED_COUNT} titles; ` +
          `received at least ${entries.length}. The roster was not written.`
        );
      }
    }

    console.log(`AniList pre-2014 popular discovery page ${page}: ${entries.length} selected.`);
    if (entries.length === EXPECTED_COUNT) break;
    if (!pageData.pageInfo?.hasNextPage) break;
    page += 1;
  }

  if (entries.length !== EXPECTED_COUNT) {
    throw new Error(
      `AniList pre-2014 popular discovery expected ${EXPECTED_COUNT} titles, ` +
      `received ${entries.length}. The roster was not written.`
    );
  }

  return entries;
}

async function main() {
  const entries = await discover();
  writeJsonAtomic(DEFAULT_ROSTER_FILE, {
    schema_version: 1,
    collection: "pre2014-popular",
    selection: {
      country_of_origin: "KR",
      release_year_before_or_equal: 2013,
      anilist_popularity_greater_than: POPULARITY_THRESHOLD,
      expected_count: EXPECTED_COUNT,
      anilist_is_adult: false,
      discovered_at: new Date().toISOString(),
    },
    titles: entries,
  });
  console.log(`Saved ${entries.length} AniList titles to ${DEFAULT_ROSTER_FILE}.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { discover, displayTitle };
