# Recommendation Taxonomy Research

Working notes for building a future recommendation understanding layer.
This is not the final recommender design. It is the evidence base for one.

## Goals

- Learn which tags define trope families.
- Learn which tags act as bridges across families.
- Learn which tags are too broad to trust alone.
- Learn how the 99%+ popularity slice clusters before touching the actual recommender.

## What The Data Shows

- There is no single raw `Murim` tag in the catalog.
- Murim-like meaning is spread across multiple tags and combinations.
- Western sword / medieval / court stories form a separate cluster.
- School, action, drama, and romance are often bridge or mode tags, not family anchors.
- Reincarnation, age regression, time travel, transmigration, and second chance are stronger trope markers than broad genre tags.
- Game/system titles cluster around level system, game elements, game world, and system administrator.

## Major Families

### Murim-like

Observed signals:
- Wuxia
- Cultivation
- Martial Arts
- Martial Artist
- Swordsman
- Swordswoman
- Swordplay
- Chinese Ambience
- Chinese Folklore
- Chinese Mythology

Good examples:
- The Legend of the Northern Blade
- Heavenly Demon Reborn!
- GOSU
- Second Life Ranker
- Return of the Blossoming Blade
- Log-in Murim

Notes:
- `Martial Arts` is too broad to define murim alone.
- `Wuxia` and `Cultivation` are much stronger murim markers.
- `Swordplay` often bridges into other families.

### Western Sword / Medieval / Court

Observed signals:
- Swordplay
- Swordsman
- Swordswoman
- Swords
- Medieval
- Medieval European Ambience
- European Ambience
- Nobility
- Royalty
- Prince
- Princess
- Dukes
- Emperors
- Kingdom
- Kingdom Management
- Politics Involving Royalty

Good examples:
- Who Made Me a Princess
- Why Raeliana Ended Up at the Duke's Mansion
- Doctor Elise: The Royal Lady with the Lamp
- A Stepmother's Marchean
- The Remarried Empress
- Villains Are Destined to Die
- Lout of Count's Family

Notes:
- `Swordplay` is not enough by itself.
- `European Ambience`, `Nobility`, and `Royalty` are often more important than sword tags alone.

### School / Modern Action

Observed signals:
- School
- High School
- School Life
- School Clubs
- All-Boys School
- All-Girls School
- Prestigious School
- Martial Arts as a bridge
- Action / Drama as mode tags

Good examples:
- Lookism
- Weak Hero
- Viral Hit
- Study Group
- Eleceed
- Bastard
- Sweet Home

Notes:
- School is a huge connector and must be paired with other tags.
- Action and Drama usually describe mode or tone.

### Regression / Reincarnation / Isekai-like

Observed signals:
- Reincarnation
- Age Regression
- Second Chance
- Time Travel
- Transmigration
- Transmigrated into a Book World
- Reincarnated in Another World

Good examples:
- Who Made Me a Princess
- Why Raeliana Ended Up at the Duke's Mansion
- Doctor Elise: The Royal Lady with the Lamp
- A Returner's Magic Should Be Special
- The Skeleton Soldier Failed to Defend the Dungeon
- Villains Are Destined to Die
- Tomb Raider King
- FFF-Class Trashero

Notes:
- These are stronger family markers than generic action/drama tags.
- Regression can combine with murim, court, business, or game/system families.

### Game / System

Observed signals:
- Game World
- Game Elements
- Level System
- System Administrator
- Video Games
- Based on a Game
- Otome Game
- High Stakes Game
- Death Game

Good examples:
- Solo Leveling
- Hardcore Leveling Warrior
- SSS-Class Revival Hunter
- Omniscient Reader
- Second Life Ranker
- Log-in Murim

Notes:
- `Level System` and `Game Elements` are the key signals.
- `Swordplay` appears often but does not define the family on its own.

### Business / Office

Observed signals:
- Businessman/Businesswoman
- Movie Business
- Office
- Office Worker
- Office Lady
- Workplace Romance
- Company
- Secretary

Good examples:
- Yumi's Cells
- See You in My 19th Life
- Positively Yours
- Momentum

Notes:
- Small but important family because it mixes with romance and regression.

## Bridge Tags

These are common across many families and should not be treated as family anchors:

- Martial Arts
- Action
- Drama
- Romance
- School
- Historical
- Swordplay
- Fantasy
- Reincarnation
- Training

## Early Interpretation

- `Wuxia`, `Cultivation`, `Level System`, `Reincarnation`, `Nobility`, `Royalty`, and `School` are often stronger anchors than `Action`, `Drama`, or `Romance`.
- `Martial Arts` and `Swordplay` are important but usually act as bridges.
- `Historical` and `European Ambience` need context to know whether they point to court fantasy, western sword, or something else.
- Lead and role tags are important context, not complete family definitions.

## Research Direction

- Split the 99%+ titles into family groups first.
- For each group, list:
  - defining tags
  - supporting tags
  - bridge tags
  - misleading tags
- Compare 99%+ versus 90-99% to see which tag relations remain stable.
- Build an overlap map rather than forcing one tag to own a trope.

