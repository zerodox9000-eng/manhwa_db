# CONTRIBUTING

## Philosophy

This project prioritizes:
- frontend stability
- reproducible exports
- static hosting compatibility
- maintainability

---

## Rules

### Never break export contracts

Frontend should remain stable even if backend changes internally.

There are two contracts to preserve:

- legacy exports in `db/exports/frontend/`
- additive v2 exports in `db/exports/frontend-v2/`

---

### Never manually edit raw data

Do not edit:

db/raw/

---

### Frontend consumes exports only

Frontend should never directly access:
- raw
- processed
- enrichment
- cache

The new frontend should prefer the v2 manifest/build contract for new loading code.

---

## Future Expansion

Planned areas:
- trend analytics
- recommendation graphs
- similarity scoring
- personalization
- incremental exports
- smaller API-first v2 refresh jobs
