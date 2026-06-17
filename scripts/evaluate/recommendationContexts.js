const fs = require("fs");
const path = require("path");

const EXPORT_DIR = path.resolve(__dirname, "../../db/exports/frontend");
const seriesPath = path.join(EXPORT_DIR, "series/all.json");
const featuresPath = path.join(EXPORT_DIR, "recommendations/features.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function scoreOverlap(base, candidate) {
  const baseGroups = new Set(base.context?.profileGroups || base.profileGroups || []);
  const candidateGroups = new Set(candidate.context?.profileGroups || candidate.profileGroups || []);
  const baseAnchors = new Set(base.context?.primaryAnchors || base.primaryAnchors || []);
  const candidateAnchors = new Set(candidate.context?.primaryAnchors || candidate.primaryAnchors || []);
  let sharedGroups = 0;
  let sharedAnchors = 0;
  for (const group of baseGroups) if (candidateGroups.has(group)) sharedGroups += 1;
  for (const anchor of baseAnchors) if (candidateAnchors.has(anchor)) sharedAnchors += 1;
  return sharedGroups + sharedAnchors * 2 + (candidate.quality?.discPct || 0) / 100;
}

const samples = [
  "korean-corporate-regression",
  "business-career",
  "murim-wuxia",
  "kingdom-management",
  "engineering-builder",
  "game-system",
  "medical-career",
  "sports-career",
  "showbiz-career",
  "food-career",
  "office-romance",
  "horror-survival",
  "school-life",
  "euro-fantasy"
];

const series = readJson(seriesPath);
const features = readJson(featuresPath);
const titlesById = new Map(series.map((item) => [item.id, item.display_title]));

let missingContext = 0;
for (const feature of features) if (!feature.context) missingContext += 1;

console.log(`Recommendation context audit`);
console.log(`Features: ${features.length}`);
console.log(`Missing context: ${missingContext}`);

for (const profile of samples) {
  const pool = features.filter((feature) => (feature.context?.profileGroups || feature.profileGroups || []).includes(profile));
  console.log(`\n[${profile}] ${pool.length} titles`);
  for (const base of pool.slice(0, 3)) {
    const matches = pool
      .filter((candidate) => candidate.id !== base.id)
      .map((candidate) => ({ candidate, score: scoreOverlap(base, candidate) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    console.log(`- ${titlesById.get(base.id) || base.id}`);
    for (const { candidate, score } of matches) {
      console.log(`  ${score.toFixed(2)}  ${titlesById.get(candidate.id) || candidate.id}`);
    }
  }
}
