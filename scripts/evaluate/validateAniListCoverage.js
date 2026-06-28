const fs = require("fs");
const path = require("path");

const INPUT_DIR = path.resolve(__dirname, "../../db/processed/by-year");
const OUTPUT_DIR = path.resolve(__dirname, "../../db/enriched/anilist");
const errors = [];
let expectedTotal = 0;
let actualTotal = 0;

for (const file of fs.readdirSync(INPUT_DIR).filter(file => file.endsWith(".series.json")).sort()) {
  const year = file.replace(".series.json", "");
  const input = JSON.parse(fs.readFileSync(path.join(INPUT_DIR, file), "utf8"));
  const expected = input.filter(entry => entry.source?.anilist?.id);
  const outputPath = path.join(OUTPUT_DIR, `${year}.anilist.json`);
  expectedTotal += expected.length;

  if (!fs.existsSync(outputPath)) {
    errors.push(`${year}: missing enrichment file`);
    continue;
  }

  const actual = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  actualTotal += actual.length;
  const expectedIds = new Set(expected.map(entry => entry.id));
  const actualIds = new Set(actual.map(entry => entry.id));

  if (actualIds.size !== actual.length) {
    errors.push(`${year}: duplicate enrichment IDs`);
  }

  for (const id of expectedIds) {
    if (!actualIds.has(id)) errors.push(`${year}: missing ID ${id}`);
  }

  for (const id of actualIds) {
    if (!expectedIds.has(id)) errors.push(`${year}: unexpected ID ${id}`);
  }

  console.log(`${year}: ${actual.length}/${expected.length}`);
}

if (errors.length > 0) {
  console.error(`AniList coverage validation failed with ${errors.length} issue(s):`);
  for (const error of errors.slice(0, 100)) console.error(`- ${error}`);
  if (errors.length > 100) console.error(`...and ${errors.length - 100} more`);
  process.exit(1);
}

console.log(`AniList coverage validation passed for ${actualTotal}/${expectedTotal} entries.`);
