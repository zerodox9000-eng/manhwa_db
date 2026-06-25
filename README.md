# manhwa_db

This repository is the backend and export pipeline for the Manhwa app.

It currently serves two export contracts:

- Legacy PWA exports under `db/exports/frontend/`
- Additive v2 exports under `db/exports/frontend-v2/`

The legacy contract is the older, broader export set that the first PWA consumed.
The v2 contract is the newer manifest-first shape designed to be smaller, more explicit, and easier for a future frontend or agent to reason about.

## How The Repo Works

The repo is a data pipeline with two layers:

1. Source collection and normalization.
2. Export building for one or more frontend contracts.

The main data source is MangaBaka. AniList is used for enrichment and ranking stats. The repo stores intermediate yearly data under `db/`, then turns that into export files for the frontend.

## Scripts

Current package scripts:

- `npm run update`
- `npm run incremental`
- `npm run normalize`
- `npm run enrich`
- `npm run snapshot`
- `npm run build:frontend`
- `npm run build:frontend:v2`
- `npm run validate:frontend`
- `npm run validate:frontend:v2`
- `npm run daily`
- `npm run daily:incremental`

## Legacy Pipeline

The legacy path is the one the old PWA was built around.

Flow:

1. `npm run incremental`
2. `npm run normalize`
3. `npm run enrich`
4. `npm run snapshot`
5. `npm run build:frontend`

What each step does:

- `incremental`
  - Pulls MangaBaka search results year by year.
  - Coverage currently starts at 2013 and runs through the current year.
  - Updates raw yearly files.
  - Writes per-day changelog entries.

- `normalize`
  - Converts raw MangaBaka records into stable processed yearly records.
  - Normalizes titles, links, dates, sources, and content fields.

- `enrich`
  - Looks up AniList-linked titles.
  - Writes AniList stats back into enriched yearly files.

- `snapshot`
  - Captures a daily stats snapshot from the enriched AniList data.

- `build:frontend`
  - Builds the legacy frontend export folder.
  - Produces the big catalog, history, recommendation, tag, and detail files.
  - Gzips the main export artifacts.

Note:

- The MangaBaka fetch/update scripts include 2013 onward, so the raw yearly store and daily incremental runs stay aligned.

## V2 Pipeline

The v2 path is additive and does not replace the legacy exports yet.

Flow:

1. `npm run build:frontend:v2`
2. `npm run validate:frontend:v2` when checking the contract

What it does differently:

- Writes a `manifest.json` front door.
- Writes immutable build files under `db/exports/frontend-v2/builds/{buildId}/`.
- Separates catalog, tags, and details more cleanly.
- Uses explicit release metadata and source flags for frontend logic.

## Recommendation Data

- `db/exports/frontend/meta/mangabaka-tag-weights.safe-suggestive-anilist.json`
- `db/exports/frontend/meta/mangabaka-tag-weights.safe-suggestive-anilist.json.gz`
- `db/exports/frontend/recommendations/features.json`

The tag-weight file is the raw MangaBaka-derived mapping that the frontend can use to build recommendation signals. The recommendation features file is the precomputed, frontend-ready layer when you want the backend to do more of the math ahead of time.

The frontend should not scrape MangaBaka directly. The recommender is backend-prebaked: the backend should compute the recommendation features and ranking inputs ahead of time, and the frontend should only send filter choices and render the returned list.

Default recommendation ordering:

1. Fit score
2. Fan rank
3. Popularity percentile

Fit is the main ranking signal. Fan rank and popularity are supporting signals and tie-breakers, not the primary sort key.

## Daily Workflow

The GitHub Actions workflow in `.github/workflows/daily-pipeline.yml` currently:
1. Installs dependencies.
2. Bootstraps the expected `db/` subdirectories.
3. Writes `MANGABAKA_API` into `.env` from repository secrets.
4. Runs `npm run daily:incremental`.
5. Commits updated DB/export files back to the repo.

## Data Flow

The pipeline is currently organized as:

1. Fetch MangaBaka data.
2. Normalize it into yearly processed files.
3. Enrich AniList-linked entries.
4. Snapshot AniList stats.
5. Build legacy exports.
6. Build the additive v2 export contract.

## Important Data Folders

- `db/raw/by-year/`
- `db/processed/by-year/`
- `db/processed/tags/`
- `db/enriched/anilist/`
- `db/snapshots/anilist-daily/`
- `db/cache/`
- `db/exports/frontend/`
- `db/exports/frontend-v2/`
- `db/updates/changelog/`
- `db/state/`

## Export Contract Notes

- Legacy exports remain for compatibility with the old frontend contract.
- V2 exports are manifest-first and use immutable build directories.
- Feed semantics are owned by the backend contract, not by frontend-local cache timing.
- `Add` and `Rel` sort semantics are backend-owned behavior, not frontend guesses.

## Useful Entry Files

- `.github/workflows/daily-pipeline.yml`
- `scripts/updates/incrementalRawPatch.js`
- `scripts/normalize/normalizeSeries.js`
- `scripts/enrich/updateAniList.js`
- `scripts/snapshots/snapshotAniList.js`
- `scripts/build/fetchMangabakaLatest.js`
- `scripts/build/buildFrontendExports.js`
- `scripts/build/buildFrontendV2Exports.js`
- `docs/recommendation-taxonomy-research.md`
- `db/exports/frontend/meta/mangabaka-tag-weights.safe-suggestive-anilist.log`
- `db/updates/changelog/`
- `db/state/`

## Old Vs New In One Sentence

- Legacy = one big export set for the old app.
- V2 = a manifest plus immutable build assets for the newer frontend contract.

## APIs

- MangaBaka API
- AniList GraphQL API
