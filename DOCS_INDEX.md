# Docs Index

This repo has a few docs that explain different parts of the backend.

## Start Here

- [README](README.md)
- [PIPELINE](PIPELINE.md)
- [ARCHITECTURE](ARCHITECTURE.md)
- [FRONTEND_DATA](FRONTEND_DATA.md)
- [ANALYTICS](ANALYTICS.md)
- [CONTRIBUTING](CONTRIBUTING.md)

## What Each Doc Covers

- `README.md`
  - Repo overview
  - Legacy pipeline
  - V2 pipeline
  - main folders and scripts

- `PIPELINE.md`
  - Script-by-script pipeline summary
  - Legacy and v2 build entrypoints

- `ARCHITECTURE.md`
  - Data flow
  - Storage layers
  - Export contract split

- `FRONTEND_DATA.md`
  - Which exports the frontend should read
  - Legacy vs v2 data shape

- `ANALYTICS.md`
  - Discovery and ranking intent
  - How fan-favourite and discovery stats are used

- `CONTRIBUTING.md`
  - Rules for preserving export contracts
  - What not to edit directly

## Practical Rule

If a change affects how data is collected, normalized, enriched, or exported, update the relevant doc here in the same change.
