<p align="center">
  <img src="https://raw.githubusercontent.com/zerodox9000-eng/Manhwa_pwa/main/docs/assets/aeon-social-preview.jpg" width="640" alt="Aeon with manhwa covers">
</p>

<h1 align="center">Aeon Catalogue</h1>

<p align="center">
  The catalogue and daily data pipeline used by Aeon.
</p>

<p align="center">
  <a href="https://zerodox9000-eng.github.io/Manhwa_pwa/"><img src="https://img.shields.io/badge/Open%20App-00a9bd?style=flat-square" alt="Open app"></a>
  <a href="https://github.com/zerodox9000-eng/manhwa_db"><img src="https://img.shields.io/badge/Source-20232a?style=flat-square&logo=github&logoColor=white" alt="Source code"></a>
  <a href="https://www.reddit.com/u/ZERO_DOX/"><img src="https://img.shields.io/badge/Creator-ZERO__DOX-20232a?style=flat-square&logo=reddit&logoColor=white" alt="Creator profile"></a>
</p>

<p align="center"><strong>App link:</strong> <a href="https://zerodox9000-eng.github.io/Manhwa_pwa/">https://zerodox9000-eng.github.io/Manhwa_pwa/</a></p>

<p align="center"><a href="https://github.com/zerodox9000-eng/Manhwa_pwa">Frontend repository</a> · <a href="https://github.com/zerodox9000-eng/Manhwa_pwa/wiki">User guide</a></p>

## About

This repository collects, normalizes, validates, and publishes the data used by the [Aeon manhwa discovery app](https://github.com/zerodox9000-eng/Manhwa_pwa).

It provides:

- Primary titles, aliases, creators, covers, publication details, and source links.
- Genres, themes, detailed tags, content information, and tag hierarchy.
- AniList popularity, favourites, and score information for matched titles.
- Historical snapshots used by growth and recent-change feeds.
- Compact frontend releases prepared for Aeon's search, feeds, and title pages.

<p align="center">
  <img src="https://raw.githubusercontent.com/zerodox9000-eng/Manhwa_pwa/main/docs/assets/aeon-home-discover-top-1.jpg" width="360" alt="Aeon Home showing the Discover Top 1% feed">
</p>

## Screenshots

<p align="center"><img src="https://raw.githubusercontent.com/zerodox9000-eng/Manhwa_pwa/main/docs/assets/aeon-library.jpg" width="360" alt="Aeon feed library"><br>Feeds</p>

<p align="center"><img src="https://raw.githubusercontent.com/zerodox9000-eng/Manhwa_pwa/main/docs/assets/aeon-search.jpg" width="360" alt="Aeon catalogue search"><br>Search</p>

<p align="center"><img src="https://raw.githubusercontent.com/zerodox9000-eng/Manhwa_pwa/main/docs/assets/aeon-details.jpg" width="300" alt="Aeon title details"><br>Title details</p>

<p align="center"><img src="https://raw.githubusercontent.com/zerodox9000-eng/Manhwa_pwa/main/docs/assets/aeon-settings-2026-09.jpg" width="360" alt="Aeon settings"><br>Settings</p>

<p align="center"><img src="https://raw.githubusercontent.com/zerodox9000-eng/Manhwa_pwa/main/docs/assets/aeon-updates-popularity.jpg" width="320" alt="Aeon popularity milestones"><br>Popularity Milestones</p>

<p align="center"><img src="https://raw.githubusercontent.com/zerodox9000-eng/Manhwa_pwa/main/docs/assets/aeon-updates-status.jpg" width="320" alt="Aeon status changes"><br>Status Changes</p>

<p align="center"><img src="https://raw.githubusercontent.com/zerodox9000-eng/Manhwa_pwa/main/docs/assets/aeon-updates-chapters.jpg" width="320" alt="Aeon chapter updates"><br>Chapter Updates</p>

## Updates

The catalogue is refreshed by a daily GitHub Actions pipeline. New and changed records are normalized, matched with available audience information, recorded in history, validated, and then published for Aeon.

Frontend releases are stored under `db/exports/frontend/`. Raw collection files and pipeline state remain internal to this repository.

## Fan Rank

Fan Rank compares favourites with popularity, adjusts for confidence at different audience sizes, and ranks the result as a percentile across AniList-mapped manhwa with the required statistics.

## Data sources

<p>
  <a href="https://mangabaka.dev/"><img src="https://img.shields.io/badge/MangaBaka-0b7285?style=flat-square" alt="MangaBaka"></a>
  <a href="https://anilist.co/"><img src="https://img.shields.io/badge/AniList-2563eb?style=flat-square" alt="AniList"></a>
  <a href="https://www.mangaupdates.com/"><img src="https://img.shields.io/badge/MangaUpdates-7c3aed?style=flat-square" alt="MangaUpdates"></a>
  <a href="https://www.anime-planet.com/"><img src="https://img.shields.io/badge/Anime--Planet-e11d48?style=flat-square" alt="Anime-Planet"></a>
</p>

MangaBaka is the main source for catalogue records, covers, publication details, links, and tags. AniList supplies popularity, favourites, and score information for matched titles. MangaUpdates and Anime-Planet may be retained as reference links when available.

Source data and artwork remain the property of their respective services, publishers, and creators.

## Project

Aeon and its catalogue are open-source projects created and maintained by [ZERO_DOX](https://www.reddit.com/u/ZERO_DOX/).

Maintainer documentation is available in [PIPELINE.md](./PIPELINE.md), [FRONTEND_DATA.md](./FRONTEND_DATA.md), and [ARCHITECTURE.md](./ARCHITECTURE.md). Before editing, read [AGENTS.md](./AGENTS.md) and the closest child instructions for the affected area.
