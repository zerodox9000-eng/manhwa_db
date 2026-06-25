# ANALYTICS

## Goal

Surface genuinely loved series without pure popularity dominance.

The analytics layer exists to support discovery and feed ranking in the exported frontend contracts, not to replace the source data model.

---

## Metrics

### Fan Favourite Ratio

favourites / popularity

Raw fandom attachment ratio.

---

### Popularity Percentile

Relative popularity position across full dataset.

---

### Fan Ratio Percentile

Relative fandom attachment position.

---

### Discovery Score

Adaptive score combining:
- fandom attachment
- popularity confidence
- nonlinear normalization

Purpose:
- fair discovery feeds
- cult-hit surfacing
- reduced mainstream bias

In the current exports, this is derived from the AniList snapshot data and written into the legacy analytics/history export.

---

### Discovery Percentile

Global ranking of discovery score.

Used for:
- prestige ranking
- feed labels
- recommendation sections

---

## Philosophy

Tiny niche entries should not dominate unfairly.

Massive popular entries should not gain infinite advantage.

System uses:
- percentile normalization
- logarithmic scaling
- adaptive weighting

instead of hardcoded static thresholds.

The v2 contract still keeps these ideas, but it favors smaller manifest-driven exports and explicit source fields over frontend-local inference.
