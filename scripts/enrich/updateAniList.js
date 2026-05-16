require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
  GraphQLClient,
  gql
} = require("graphql-request");

const INPUT_DIR = path.join(
  __dirname,
  "../../db/processed/by-year"
);

const OUTPUT_DIR = path.join(
  __dirname,
  "../../db/enriched/anilist"
);

const FAILED_LOG = path.join(
  __dirname,
  "../../db/enriched/failed-batches.json"
);

const client = new GraphQLClient(
  "https://graphql.anilist.co"
);

function sleep(ms) {

  return new Promise(
    resolve => setTimeout(resolve, ms)
  );
}

function chunk(array, size) {

  const chunks = [];

  for (
    let i = 0;
    i < array.length;
    i += size
  ) {

    chunks.push(
      array.slice(i, i + size)
    );
  }

  return chunks;
}

async function enrichAdaptive(
  batch,
  year,
  level = 0
) {

  const sizes =
    [40, 10, 3, 1];

  const delays =
    [2500, 5000, 8000, 12000];

  const size =
    sizes[level] || 1;

  const delay =
    delays[level] || 2000;

  const split =
    chunk(batch, size);

  let results = [];

  for (const subBatch of split) {

    try {

      const query =
        buildQuery(subBatch);

      const data =
        await client.request(query);

      const mapped =
        subBatch.map(
          (entry, index) => {

            const result =
              data[`a${index}`];

            return {

              id: entry.id,

              anilist:
                result ? {

                popularity:
                  result.popularity || null,

                favourites:
                  result.favourites || null,

                meanScore:
                  result.meanScore || null

              } : null
            };
          }
        );

      results.push(...mapped);

      await sleep(delay);

    } catch (error) {

      console.log(
  `Adaptive fallback level ${level + 1} failed (${year})`
);

console.log(
  error.response?.errors ||
  error.message ||
  error
);

await sleep(
  delays[level] || 12000
);

      if (level < 3) {

        const recovered =
          await enrichAdaptive(
            subBatch,
            year,
            level + 1
          );

        if (
  Array.isArray(recovered) &&
  recovered.length > 0
) {

  results.push(...recovered);
}

      } else {

        console.log(
          `Permanent failure isolated`
        );

        const failed =
          loadFailedLog();

        failed.push({

          year,

          ids:
            subBatch.map(
              x => ({

                mangabaka_id:
                  x.id,

                anilist_id:
                  x.source
                    ?.anilist
                    ?.id || null,

                title:
                  x.display_title
              })
            )
        });

        saveFailedLog(failed);


      }
    }
  }

  return results;
}

function buildQuery(batch) {

  const fields = batch.map(
    (entry, index) => {

      const anilistId =
        entry.source?.anilist?.id;

      return `
        a${index}: Media(
          id: ${anilistId},
          type: MANGA
        ) {
          id
          popularity
          favourites
          meanScore
        }
      `;
    }
  );

  return gql`
    query {
      ${fields.join("\n")}
    }
  `;
}

function loadFailedLog() {

  if (
    !fs.existsSync(FAILED_LOG)
  ) {

    return [];
  }

  return JSON.parse(
    fs.readFileSync(
      FAILED_LOG,
      "utf-8"
    )
  );
}

function saveFailedLog(log) {

  fs.writeFileSync(
    FAILED_LOG,
    JSON.stringify(
      log,
      null,
      2
    ),
    "utf-8"
  );
}

async function enrichBatch(
  batch,
  year,
  batchIndex
) {

  const query =
    buildQuery(batch);

  try {

    const data =
      await client.request(query);

    return batch.map(
      (entry, index) => {

        const result =
          data[`a${index}`];

        return {

          id: entry.id,

          anilist: result ? {

            popularity:
              result.popularity || null,

            favourites:
              result.favourites || null,

            meanScore:
              result.meanScore || null

          } : null
        };
      }
    );

  } catch (error) {

    console.log(
      `Failed batch ${batchIndex} (${year})`
    );

    const failed =
      loadFailedLog();

    failed.push({

      year,

      batch: batchIndex,

      ids: batch.map(
        x => ({
          mangabaka_id:
            x.id,

          anilist_id:
            x.source
              ?.anilist
              ?.id || null,

          title:
            x.display_title
        })
      )
    });

    saveFailedLog(failed);



    return batch.map(
      entry => ({
        id: entry.id,
        anilist: null
      })
    );
  }
}

async function processFile(file) {

  console.log(
    `Processing ${file}`
  );

  const year =
    file.replace(
      ".series.json",
      ""
    );

  const data = JSON.parse(
    fs.readFileSync(
      path.join(INPUT_DIR, file),
      "utf-8"
    )
  );

  const validEntries =
    data.filter(
      entry =>
        entry.source?.anilist?.id
    );

  console.log(
    `AniList entries: ${validEntries.length}`
  );

    const results =
    await enrichAdaptive(
      validEntries,
      year
    );

  fs.writeFileSync(
    path.join(
      OUTPUT_DIR,
      `${year}.anilist.json`
    ),
    JSON.stringify(
      results,
      null,
      2
    ),
    "utf-8"
  );

  console.log(
    `Saved ${year}`
  );
}

async function main() {

  const files = fs.readdirSync(INPUT_DIR).filter(file => file.endsWith(".series.json"));

  for (const file of files) {

    await processFile(file);
  }

  console.log("Done.");
}

main().catch(console.error);














