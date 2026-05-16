# ARCHITECTURE

## Pipeline Flow

MangaBaka API
→ Raw yearly storage
→ Normalize
→ AniList enrichment
→ Historical snapshots
→ Analytics generation
→ Frontend export generation
→ Compression

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

---

## Philosophy

Frontend and backend remain separated.

Frontend NEVER directly reads:
- raw
- processed
- enrichment
- cache

Only exports.