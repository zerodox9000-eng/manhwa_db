const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { writeUpdatesExport } = require("./buildUpdatesExport");

const EXPORT_DIR = path.resolve(__dirname, "../../db/exports/frontend");
const manifest = JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, "meta/data-manifest.json"), "utf8"));

function readDataset(name) {
  const descriptor = manifest.datasets?.[name];
  if (!descriptor?.chunks?.length) throw new Error(`Missing ${name} chunks in frontend manifest.`);
  const chunks = descriptor.chunks.map((chunk) =>
    JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(EXPORT_DIR, chunk.path))))
  );
  if (descriptor.kind === "array") return chunks.flat();
  return Object.assign({}, ...chunks);
}

writeUpdatesExport({
  exportDir: EXPORT_DIR,
  catalog: readDataset("catalog"),
  history: readDataset(manifest.datasets.weeklyHistory ? "weeklyHistory" : "history"),
  generatedAt: manifest.generatedAt,
});
