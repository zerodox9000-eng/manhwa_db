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
