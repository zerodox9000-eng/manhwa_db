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

---

## Future Expansion

Planned areas:
- trend analytics
- recommendation graphs
- similarity scoring
- personalization
- incremental exports