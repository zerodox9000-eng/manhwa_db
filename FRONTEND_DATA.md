# FRONTEND DATA

## Entry Point

Frontend should consume:

db/exports/frontend/

---

## Files

### series/all.json

Lightweight discovery dataset.

Contains:
- titles
- covers
- tags
- `tag_weights` for AniList-backed entries (`core`, `defining`, `recurrent`, `incidental`, or `unweighted`)
- stats
- analytics

Used for:
- feeds
- search
- ranking
- filtering

---

### details/{id}.json

Heavy per-series detail data.

Lazy-loaded only when needed.

---

### meta/tags.json

Global tag registry.

Contains:
- tag ids
- names
- hierarchy
- genre flags

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

Frontend should prefer compressed versions.
