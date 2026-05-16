require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
  GraphQLClient,
  gql
} = require("graphql-request");

const FAILED_LOG = path.join(
  __dirname,
  "../../db/enriched/failed-batches.json"
);

const OUTPUT_DIR = path.join(
  __dirname,
  "../../db/enriched/anilist"
);

const client = new GraphQLClient(
  "https://graphql.anilist.co"
);

function sleep(ms) {

  return new Promise(
    resolve => setTimeout(resolve, ms)
  );
}

async function enrichOne(entry) {

  const anilistId =
    entry.anilist_id;

  if (!anilistId) {

    return {
      id: entry.mangabaka_id,
      anilist: null
    };
  }

  const query = gql`
    query {
      Media(
        id: ${anilistId},
        type: MANGA
      ) {

        popularity
        favourites
        meanScore
      }
    }
  `;

  try {

    const data =
      await client.request(query);

    console.log(
      `Recovered: ${entry.title}`
    );

    return {

      id: entry.mangabaka_id,

      anilist: {

        popularity:
          data.Media?.popularity || null,

        favourites:
          data.Media?.favourites || null,

        meanScore:
          data.Media?.meanScore || null
      }
    };

  } catch (error) {

    console.log(
      `Permanent failure: ${entry.title}`
    );

    return {

      id: entry.mangabaka_id,

      anilist: null,

      failed: true,

      anilist_id:
        anilistId,

      title:
        entry.title
    };
  }
}

async function main() {

  if (
    !fs.existsSync(FAILED_LOG)
  ) {

    console.log(
      "No failed batches log found."
    );

    return;
  }

  const failedBatches =
    JSON.parse(
      fs.readFileSync(
        FAILED_LOG,
        "utf-8"
      )
    );

  

  const permanentFailures = [];

  

  fs.writeFileSync(
    path.join(
      OUTPUT_DIR,
      "permanent-failures.json"
    ),
    JSON.stringify(
      permanentFailures,
      null,
      2
    ),
    "utf-8"
  );

  fs.writeFileSync(
  FAILED_LOG,
  "[]",
  "utf-8"
);

console.log(
  "Cleared failed log."
);

fs.writeFileSync(
  FAILED_LOG,
  JSON.stringify(
    permanentFailures,
    null,
    2
  ),
  "utf-8"
);

console.log(
  "Updated failed log."
);

console.log("Done.");
}

main().catch(console.error);











