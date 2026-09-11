const fs = require("fs");
const path = require("path");

const TAG_OVERRIDES_PATH = path.resolve(
  __dirname,
  "../../db/curation/tag-overrides.json"
);

function loadTagOverrides() {
  if (!fs.existsSync(TAG_OVERRIDES_PATH)) return new Map();

  const payload = JSON.parse(fs.readFileSync(TAG_OVERRIDES_PATH, "utf8"));
  if (
    payload?.schemaVersion !== 1 ||
    !payload.overrides ||
    typeof payload.overrides !== "object" ||
    Array.isArray(payload.overrides)
  ) {
    throw new Error("Invalid tag override registry.");
  }

  return new Map(
    Object.entries(payload.overrides).map(([id, override]) => {
      if (!/^\d+$/.test(id) || !override || !Array.isArray(override.remove_tag_ids)) {
        throw new Error(`Invalid tag override for ${id}.`);
      }

      const removeTagIds = override.remove_tag_ids.map(Number);
      if (
        removeTagIds.some(
          (tagId) => !Number.isSafeInteger(tagId) || tagId <= 0
        )
      ) {
        throw new Error(`Invalid removed tag ID in override for ${id}.`);
      }

      return [String(Number(id)), new Set(removeTagIds)];
    })
  );
}

function applyTagOverrides(series, overrides) {
  const tags = Array.isArray(series?.tags_v2) ? series.tags_v2 : [];
  const removeTagIds = overrides.get(String(series?.id));
  if (!removeTagIds?.size) return tags;

  return tags.filter((tag) => !removeTagIds.has(Number(tag?.id)));
}

module.exports = {
  applyTagOverrides,
  loadTagOverrides,
};
