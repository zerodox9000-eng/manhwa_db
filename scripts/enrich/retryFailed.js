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

  const recoveredByYear = {};

  const permanentFailures = [];

  for (const batch of failedBatches) {

    console.log(
      `Retrying ${batch.year} batch ${batch.batch}`
    );

    for (const entry of batch.ids) {

      const result =
        await enrichOne(entry);

      if (!recoveredByYear[batch.year]) {

        recoveredByYear[
          batch.year
        ] = [];
      }

      recoveredByYear[
        batch.year
      ].push(result);

      if (result.failed) {

        permanentFailures.push(
          result
        );
      }

      await sleep(1200);
    }
  }

  for (
    const year of Object.keys(
      recoveredByYear
    )
  ) {

    const output = path.join(
      OUTPUT_DIR,
      `${year}.retry.json`
    );

    fs.writeFileSync(
      output,
      JSON.stringify(
        recoveredByYear[year],
        null,
        2
      ),
      "utf-8"
    );

    console.log(
      `Saved retry file ${year}`
    );
  }

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

  console.log("Done.");
}

main().catch(console.error);


