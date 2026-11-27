<p align="center">
  <img src="https://raw.githubusercontent.com/zerodox9000-eng/Manhwa_pwa/main/docs/assets/aeon-social-preview.jpg" width="640" alt="Aeon loading screen with manhwa covers">
</p>

<h1 align="center">Aeon Catalogue</h1>

<p align="center">The catalogue and daily data pipeline behind Aeon, a manhwa discovery app.</p>

<p align="center">
  <a href="https://zerodox9000-eng.github.io/aeon-v2/"><img src="https://img.shields.io/badge/Open%20V2%20Preview-00a9bd?style=flat-square" alt="Open V2 Preview"></a>
  <a href="https://github.com/zerodox9000-eng/manhwa_db"><img src="https://img.shields.io/badge/Pipeline%20Source-20232a?style=flat-square&amp;logo=github&amp;logoColor=white" alt="Pipeline Source"></a>
  <a href="https://www.reddit.com/u/ZERO_DOX/"><img src="https://img.shields.io/badge/Creator-ZERO__DOX-20232a?style=flat-square&amp;logo=reddit&amp;logoColor=white" alt="Creator profile"></a>
</p>

<p align="center"><a href="https://zerodox9000-eng.github.io/aeon-v2/"><strong>Open Aeon V2 Preview</strong></a> · <a href="https://github.com/zerodox9000-eng/aeon-v2">V2 frontend source</a> · <a href="https://github.com/zerodox9000-eng/Manhwa_pwa">Aeon project README</a></p>

<p align="center"><img src="https://raw.githubusercontent.com/zerodox9000-eng/Manhwa_pwa/main/docs/assets/aeon-v2-home.webp" width="360" alt="Home with the Top Fan Picks Showcase"></p>

## About

This repository collects, normalizes, validates, and publishes the manhwa catalogue used by Aeon. The frontend uses the published data for search, curated and custom feeds, series details, and recent updates.

- **Catalogue** includes titles, aliases, creators, covers, publication details, and source links.
- **Tags** include genres, themes, detailed tags, and their hierarchy.
- **Audience data** includes AniList popularity, favourites, and scores for matched titles. Aeon's fan response uses favourites relative to popularity, with a confidence adjustment for audience size.
- **Updates** include changes in publication status, popularity, and chapter counts for the frontend's Updates tabs.

## V2 screenshots

<p align="center"><img src="https://raw.githubusercontent.com/zerodox9000-eng/Manhwa_pwa/main/docs/assets/aeon-v2-updates.webp" width="320" alt="Status changes in Updates"><br>Status Updates</p>

<p align="center"><img src="https://raw.githubusercontent.com/zerodox9000-eng/Manhwa_pwa/main/docs/assets/aeon-v2-details.webp" width="300" alt="The Stellar Swordmaster details, fan response and reading links"><br>Series Details</p>

## Daily pipeline and frontend data

GitHub Actions refreshes the catalogue daily. The pipeline collects and normalizes source data, enriches matched entries with available audience statistics, and validates frontend exports before publishing.

Frontend consumers use [the exports under `db/exports/frontend/`](./db/exports/frontend/). See [FRONTEND_DATA.md](./FRONTEND_DATA.md) for the data contract, [PIPELINE.md](./PIPELINE.md) for how the jobs run, and [ARCHITECTURE.md](./ARCHITECTURE.md) for the repository structure.

## Data sources

<p>
  <a href="https://mangabaka.dev/"><img src="https://img.shields.io/badge/MangaBaka-0b7285?style=flat-square" alt="MangaBaka"></a>
  <a href="https://anilist.co/"><img src="https://img.shields.io/badge/AniList-2563eb?style=flat-square" alt="AniList"></a>
  <a href="https://www.mangaupdates.com/"><img src="https://img.shields.io/badge/MangaUpdates-7c3aed?style=flat-square" alt="MangaUpdates"></a>
  <a href="https://www.anime-planet.com/"><img src="https://img.shields.io/badge/Anime--Planet-e11d48?style=flat-square" alt="Anime-Planet"></a>
</p>

MangaBaka supplies the core catalogue, covers, publication details, links, and tags. AniList supplies audience statistics for matched titles. MangaUpdates and Anime-Planet appear as reference links where available. Source data and artwork belong to their respective services, publishers, and creators.

## Project

Aeon and its catalogue are maintained by ZERO_DOX. [Creator profile](https://www.reddit.com/u/ZERO_DOX/)

For V2 user help, open **Settings → Backup & Help → Learn metrics and data**. The GitHub wiki covers Aeon V1. [V1 wiki](https://github.com/zerodox9000-eng/Manhwa_pwa/wiki)

For repository contributions, start with [AGENTS.md](./AGENTS.md) and [CONTRIBUTING.md](./CONTRIBUTING.md).
