const fs = require("fs");
const path = require("path");

const INPUT_DIR = path.join(
  __dirname,
  "../../db/enriched/anilist"
);

const OUTPUT_DIR = path.join(
  __dirname,
  "../../db/snapshots/anilist-daily"
);

const today =
  new Date().toISOString().split("T")[0];

const files =
  fs.readdirSync(INPUT_DIR);

let snapshot = [];

for (const file of files) {

  const data = JSON.parse(
    fs.readFileSync(
      path.join(INPUT_DIR, file),
      "utf-8"
    )
  );

  const slim = data.map(x => ({

    id: x.id,

    popularity:
      x.anilist?.popularity || null,

    favourites:
      x.anilist?.favourites || null,

    meanScore:
      x.anilist?.meanScore || null
  }));

  snapshot.push(...slim);
}

fs.writeFileSync(
  path.join(
    OUTPUT_DIR,
    `${today}.json`
  ),
  JSON.stringify(
    snapshot,
    null,
    2
  ),
  "utf-8"
);

console.log(
  `Snapshot saved: ${today}`
);



