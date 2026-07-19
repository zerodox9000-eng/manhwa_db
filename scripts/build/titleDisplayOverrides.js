const fs = require("fs");
const path = require("path");

const TITLE_DISPLAY_OVERRIDES = path.resolve(
  __dirname,
  "../../db/curation/title-display-overrides.json"
);

function normalizeTitle(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function loadTitleDisplayOverrides() {
  if (!fs.existsSync(TITLE_DISPLAY_OVERRIDES)) return new Map();

  const payload = JSON.parse(fs.readFileSync(TITLE_DISPLAY_OVERRIDES, "utf8"));
  if (payload?.schemaVersion !== 1 || !payload.overrides || typeof payload.overrides !== "object") {
    throw new Error("Invalid title display override registry.");
  }

  return new Map(
    Object.entries(payload.overrides).map(([id, value]) => {
      if (!value || typeof value.displayTitle !== "string" || !value.displayTitle.trim()) {
        throw new Error(`Invalid title display override for ${id}.`);
      }
      return [String(id), value.displayTitle.trim()];
    })
  );
}

function applyTitleDisplayOverride(entry, overrides) {
  const override = overrides.get(String(entry.id));
  if (!override) return entry.display_title;

  const storedTitles = (entry.titles || []).map((title) => title?.title).filter(Boolean);
  if (!storedTitles.some((title) => normalizeTitle(title) === normalizeTitle(override))) {
    throw new Error(
      `Title display override for ${entry.id} is not a stored MangaBaka title: ${override}`
    );
  }

  return override;
}

module.exports = {
  applyTitleDisplayOverride,
  loadTitleDisplayOverrides,
};
