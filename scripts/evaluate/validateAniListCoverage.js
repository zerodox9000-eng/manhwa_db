const fs = require("fs");
const path = require("path");

const INPUT_DIRS = [
  path.resolve(__dirname, "../../db/processed/by-year"),
  path.resolve(__dirname, "../../db/processed/collections"),
];
const OUTPUT_DIR = path.resolve(__dirname, "../../db/enriched/anilist");
const errors = [];
let expectedTotal = 0;
let actualTotal = 0;

const files = INPUT_DIRS
  .filter(inputDir => fs.existsSync(inputDir))
  .flatMap(inputDir => fs.readdirSync(inputDir)
    .filter(file => file.endsWith(".series.json"))
    .map(file => ({ file, inputDir })))
  .sort((left, right) => left.file.localeCompare(right.file));

for (const item of files) {
  const scope = item.file.replace(".series.json", "");
  const input = JSON.parse(fs.readFileSync(path.join(item.inputDir, item.file), "utf8"));
  const expected = input.filter(entry => entry.source?.anilist?.id);
  const outputPath = path.join(OUTPUT_DIR, `${scope}.anilist.json`);
  expectedTotal += expected.length;

  if (!fs.existsSync(outputPath)) {
    errors.push(`${scope}: missing enrichment file`);
    continue;
  }

  const actual = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  actualTotal += actual.length;
  const expectedIds = new Set(expected.map(entry => entry.id));
  const actualIds = new Set(actual.map(entry => entry.id));

  if (actualIds.size !== actual.length) {
    errors.push(`${scope}: duplicate enrichment IDs`);
  }

  for (const id of expectedIds) {
    if (!actualIds.has(id)) errors.push(`${scope}: missing ID ${id}`);
  }

  for (const id of actualIds) {
    if (!expectedIds.has(id)) errors.push(`${scope}: unexpected ID ${id}`);
  }

  console.log(`${scope}: ${actual.length}/${expected.length}`);
}

if (errors.length > 0) {
  console.error(`AniList coverage validation failed with ${errors.length} issue(s):`);
  for (const error of errors.slice(0, 100)) console.error(`- ${error}`);
  if (errors.length > 100) console.error(`...and ${errors.length - 100} more`);
  process.exit(1);
}

console.log(`AniList coverage validation passed for ${actualTotal}/${expectedTotal} entries.`);
