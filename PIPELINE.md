# PIPELINE

## Fetch

npm run fetch

Fetches yearly MangaBaka data.

Stored in:
db/raw/by-year/

## Incremental Update

npm run incremental

Uses:
- last_updated_at
- sync-state tracking
- raw patch merging

Purpose:
- reduce API load
- reduce rebuild overhead
- enable scalable daily syncing

This is the legacy daily collection path. It still powers the old export contract.
Current MangaBaka coverage starts at 2013 and runs through the current year.


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

AniList stats are part of both the legacy and v2 contracts because they feed ranking and discovery behavior.

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

Legacy contract output lives under `db/exports/frontend/`.

## V2 Frontend Build

npm run build:frontend:v2

Builds:
- manifest
- immutable build catalog
- immutable build tags
- lazy details
- gzip files

V2 output lives under `db/exports/frontend-v2/`.

---

## Daily Pipeline

npm run daily

Runs:

update
→ normalize
→ enrich
→ snapshot
→ build frontend

`npm run daily:incremental` is the current scheduled workflow entrypoint in GitHub Actions.
That incremental path now includes 2013 onward, so the daily job and the local backfill stay aligned.
