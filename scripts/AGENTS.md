# Purpose

Owns backend pipeline scripts for fetching, updating, normalizing, enriching, snapshotting, analytics, and frontend export generation.

## Ownership

- `fetch/` and `updates/` own MangaBaka retrieval and incremental updates.
- `normalize/` owns stable processed records.
- `enrich/` owns AniList enrichment and retry behavior.
- `snapshots/` owns daily stat history.
- `evaluate/` and `build/` own analytics and frontend export production.

## Local Contracts

- Read the root AGENTS.md first.
- Do not publish partial data silently. If a year, source, or enrichment pass fails, make the failure visible and preserve consistency.
- Keep exported schemas backward-compatible with the frontend unless the frontend repo is updated in the same task.
- `db/curation/title-display-overrides.json` is an audited display-title registry. Export builders apply it only to frontend display values after normalization; raw source titles remain untouched. Each override must match a stored MangaBaka title variant or the build must fail.
- The daily pipeline does not fetch MangaBaka's `sort_by=latest` listing. Existing exported `mangabaka_latest_rank` values remain compatibility data for saved feeds, but the cache is no longer refreshed or used by a shipped default feed.
- `db/curation/anilist-permanent-missing.json` contains only explicitly confirmed `(MangaBaka ID, AniList ID)` 404 pairs. Enrichment emits a null stats record for those pairs without making a request. All other IDs retain adaptive chunking, retry, and isolation behavior.
- AniList enrichment uses 100-title primary batches, the maximum accepted by the current query-complexity ceiling. A transient AniList 5xx response retries the same batch twice, then uses 50-title batches before the existing 10, 3, and 1-title isolation path. Missing or malformed IDs skip the 50-title step. Do not raise the primary batch without measuring the live API again.
- The yearly MangaBaka incremental fetch is sequential with a 2.5-second completed-page gap. Requests time out after 30 seconds, retry a finite six times, and honor a server `Retry-After` response when present. Do not parallelize it or lower the normal gap without a measured rate-limit check.
- Avoid network-heavy full pipeline runs unless required by the user or needed to verify a pipeline fix.

## Work Guidance

- Prefer idempotent scripts that can resume or be rerun safely.
- Log enough context to identify failed year/source batches without dumping secrets.
- Keep API-specific fallback behavior explicit and testable.

## Verification

- Run the narrow changed script when possible.
- For daily pipeline fixes, run or dispatch the daily pipeline when the user asks for live data generation.

## Child DOX Index

No child AGENTS.md files.
