# FRONTEND DATA

## Entry Point

Legacy frontend should consume:

db/exports/frontend/

New frontend should consume:

db/exports/frontend-v2/manifest.json

---

## Files

### series/all.json

Lightweight discovery dataset.

Contains:
- titles
- covers
- tags
- stats
- analytics

Used for:
- feeds
- search
- ranking
- filtering

This is the legacy export shape. The v2 catalog splits this into a smaller manifest-driven catalog plus lazy details.

---

### details/{id}.json

Heavy per-series detail data.

Lazy-loaded only when needed.

In v2, this lives under `db/exports/frontend-v2/builds/{buildId}/details/{id}.json`.

---

### meta/tags.json

Global tag registry.

Contains:
- tag ids
- names
- hierarchy
- genre flags

In v2, the tag graph also includes more explicit build metadata and is loaded through the manifest.

---

### meta/mangabaka-tag-weights.safe-suggestive-anilist.json

Raw MangaBaka tag-weight mapping for the safe + suggestive + AniList export set.

Contains:
- series id
- `tag_weights` per title

Used for:
- recommendation feature building
- tag affinity math
- backend-precomputed or frontend-fallback scoring

Prefer the compressed `.json.gz` version when available.

---

### recommendations/features.json

Precomputed recommendation feature vectors.

Contains:
- profile groups
- primary anchors
- tag features
- text features
- quality signals

Used for:
- faster recommendation ranking
- stable frontend fallback when the backend has already done the feature math

Prefer the compressed `.json.gz` version when available.

---

### stats/history.json

Historical AniList snapshots.

Compressed schema:

d = date  
p = popularity  
f = favourites  
s = meanScore  
r = raw ratio  
rp = ratio percentile  
pp = popularity percentile  
ds = discovery score

---

## Compression

Exports also exist as:

.gz

Frontend should prefer compressed versions where possible.

## V2 Contract Notes

The v2 contract is designed so the frontend can:

- fetch a small manifest first
- validate a complete build before switching data
- load catalog entries without loading all details
- keep legacy and new loading logic separate
