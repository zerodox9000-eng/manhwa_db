# MANGABAKA DB

Modern manhwa discovery database pipeline built around MangaBaka + AniList enrichment.

## Features

- Modern manhwa focused dataset (2014+)
- Year-partitioned raw collection
- Normalized frontend-ready exports
- AniList popularity/favourites/meanScore enrichment
- Historical snapshot tracking
- Adaptive fan-favourite discovery analytics
- Static-hosting friendly architecture
- GitHub Actions automation ready
- Mobile-first frontend support
- Gzip-compressed exports

---

## Pipeline

Raw Fetch  
→ Normalize  
→ AniList Enrichment  
→ Snapshot History  
→ Analytics  
→ Frontend Exports  
→ Compression

---

## Commands

### Initial full fetch

npm run fetch

### Normalize data

npm run normalize

### AniList enrichment

npm run enrich

### Retry failed enrichment batches

npm run retry

### Create daily snapshot

npm run snapshot

### Build frontend exports

npm run build:frontend

### Full daily pipeline

npm run daily

---

## Frontend

Frontend should consume ONLY:

db/exports/frontend/

Everything else is backend/internal pipeline structure.

---

## APIs

- MangaBaka API
- AniList GraphQL API