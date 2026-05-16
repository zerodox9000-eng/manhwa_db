# PIPELINE

## Fetch

npm run fetch

Fetches yearly MangaBaka data.

Stored in:
db/raw/by-year/

---

## Normalize

npm run normalize

Creates stable processed structure.

Stored in:
db/processed/by-year/

---

## Enrich

npm run enrich

Queries AniList GraphQL.

Stored in:
db/enriched/anilist/

---

## Retry

npm run retry

Retries failed AniList batches.

---

## Snapshot

npm run snapshot

Creates daily stat snapshots.

Stored in:
db/snapshots/anilist-daily/

---

## Frontend Build

npm run build:frontend

Builds:
- exports
- analytics
- tags
- details
- gzip files

---

## Daily Pipeline

npm run daily

Runs:

update
→ normalize
→ enrich
→ snapshot
→ build frontend