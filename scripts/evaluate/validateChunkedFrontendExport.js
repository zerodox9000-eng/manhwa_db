const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const {
  CONTRACT,
  MAX_CHUNK_BYTES,
  SCHEMA_VERSION,
} = require("../build/writeChunkedFrontendExports");

const EXPORT_DIR = path.resolve(__dirname, "../../db/exports/frontend");
const MANIFEST_PATH = path.join(EXPORT_DIR, "meta/data-manifest.json");

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function readLegacy(relativePath) {
  const jsonPath = path.join(EXPORT_DIR, relativePath);
  const gzipPath = `${jsonPath}.gz`;
  if (fs.existsSync(jsonPath)) {
    return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  }
  if (fs.existsSync(gzipPath)) {
    return JSON.parse(zlib.gunzipSync(fs.readFileSync(gzipPath)).toString("utf8"));
  }
  return null;
}

function safeChunkPath(relativePath) {
  const resolved = path.resolve(EXPORT_DIR, relativePath);
  const exportPrefix = `${EXPORT_DIR}${path.sep}`;
  assert(
    resolved.startsWith(exportPrefix),
    `Chunk path escapes the frontend export directory: ${relativePath}`
  );
  return resolved;
}

function loadDataset(datasetName, descriptor) {
  assert(["array", "object"].includes(descriptor.kind), `${datasetName} has invalid kind`);
  assert(Array.isArray(descriptor.chunks) && descriptor.chunks.length > 0, `${datasetName} has no chunks`);

  const combined = descriptor.kind === "array" ? [] : {};
  let recordCount = 0;

  for (const chunk of descriptor.chunks) {
    const chunkPath = safeChunkPath(chunk.path);
    const compressed = fs.readFileSync(chunkPath);
    assert(compressed.length === chunk.bytes, `${chunk.path} byte count mismatch`);
    assert(compressed.length < MAX_CHUNK_BYTES, `${chunk.path} exceeds the chunk size ceiling`);
    assert(sha256(compressed) === chunk.sha256, `${chunk.path} checksum mismatch`);

    const parsed = JSON.parse(zlib.gunzipSync(compressed).toString("utf8"));
    const records = descriptor.kind === "array" ? parsed.length : Object.keys(parsed).length;
    assert(records === chunk.records, `${chunk.path} record count mismatch`);
    recordCount += records;

    if (descriptor.kind === "array") {
      combined.push(...parsed);
    } else {
      for (const [key, value] of Object.entries(parsed)) {
        assert(!(key in combined), `${chunk.path} duplicates key ${key}`);
        combined[key] = value;
      }
    }
  }

  assert(recordCount === descriptor.count, `${datasetName} total record count mismatch`);
  return combined;
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  assert(manifest.contract === CONTRACT, "Unexpected chunk manifest contract");
  assert(manifest.schemaVersion === SCHEMA_VERSION, "Unsupported chunk manifest schema");
  assert(typeof manifest.buildId === "string" && manifest.buildId.length > 0, "Missing build id");

  const expected = {
    catalog: readLegacy("series/all.json"),
    tags: readLegacy("meta/tags.json"),
    history: readLegacy("stats/history.json"),
    recommendations: readLegacy("recommendations/features.json"),
  };

  for (const [datasetName, expectedValue] of Object.entries(expected)) {
    const descriptor = manifest.datasets?.[datasetName];
    assert(descriptor, `Manifest is missing ${datasetName}`);
    const chunkedValue = loadDataset(datasetName, descriptor);
    if (expectedValue != null) {
      assert.deepStrictEqual(
        chunkedValue,
        expectedValue,
        `${datasetName} chunks do not reconstruct the legacy export`
      );
    }
  }

  console.log(
    `Chunked frontend export ${manifest.buildId} passed checksum, size, count, and legacy parity validation.`
  );
}

main();
