# ARCHITECTURE

## Pipeline Flow

MangaBaka API
→ Raw yearly storage
→ Normalize
→ AniList enrichment
→ Historical snapshots
→ Analytics generation
→ Legacy frontend export generation
→ V2 manifest/build export generation
→ Compression

## Incremental Updating

Project supports incremental MangaBaka synchronization using:

db/state/sync-state.json

Pipeline:
- scans yearly partitions
- fetches only updated entries
- patches raw yearly files
- rebuilds processed structure from merged raw data

Full rebuild pipeline remains available as fallback verification.

The current workflow is still legacy-first, but the repo also builds a separate `frontend-v2` contract with a manifest and immutable build directory.
---

## Layers

### Raw

db/raw/by-year/

Unmodified yearly MangaBaka API responses.

Purpose:
- recovery
- reprocessing
- validation

---

### Processed

db/processed/by-year/

Normalized stable series format.

Purpose:
- frontend generation source
- stable backend structure

---

### Enriched

db/enriched/anilist/

AniList stats:
- popularity
- favourites
- meanScore

Separated intentionally from processed series metadata.

---

### Snapshots

db/snapshots/anilist-daily/

Daily stat history storage.

Used for:
- trends
- feed generation
- stat changes
- analytics history

---

### Frontend Exports

db/exports/frontend/

Frontend-consumable static exports only.

Contains:
- all.json
- details/
- tags.json
- history.json
- gzip files

### V2 Frontend Exports

db/exports/frontend-v2/

Manifest-first frontend contract for the newer app.

Contains:
- manifest.json
- builds/{buildId}/catalog/index.json
- builds/{buildId}/tags/graph.json
- builds/{buildId}/details/{id}.json
- gzip files for catalog and tag graph

---

## Philosophy

Frontend and backend remain separated.

Frontend NEVER directly reads:
- raw
- processed
- enrichment
- cache

Only exports.

The frontend should treat `frontend-v2` as the preferred contract for new work, while legacy exports remain for compatibility and transition safety.
