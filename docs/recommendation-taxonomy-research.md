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
- The catalog uses the real tag vocabulary below, so analysis should stay close to those names instead of invented shorthand.

## Major Families

### Murim-like

Observed signals:
- Wuxia
- Cultivation
- Martial Arts
- Martial Artist
- China
- Ancient China
- Swordplay
- Swordsman
- Swordswoman
- Swords

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
- `China` and `Ancient China` help separate murim-adjacent stories from western sword fantasy.

### Western Sword / Medieval / Court

Observed signals:
- Swordplay
- Swordsman
- Swordswoman
- Swords
- Medieval
- Medieval European Ambience
- European Ambience
- Europe
- European Folklore
- Nobility
- Noble Female Lead
- Noble Male Lead
- Royalty
- Politics Involving Royalty
- Royal-Noble Relationship

Good examples:
- Who Made Me a Princess
- Why Raeliana Ended Up at the Duke's Mansion
- Doctor Elise: The Royal Lady with the Lamp
- A Stepmother's Märchen
- The Remarried Empress
- Villains Are Destined to Die
- Lout of Count's Family

Notes:
- `Swordplay` is not enough by itself.
- `European Ambience`, `Nobility`, and `Royalty` are often more important than sword tags alone.
- `Medieval European Ambience` is much rarer than `European Ambience`, so it should be treated as a very strong but sparse signal.

### School / Modern Action

Observed signals:
- School
- High School
- School Life
- School Clubs
- All-Boys School
- All-Girls School
- Prestigious School
- Boarding School
- Martial Arts School
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
- `High School` is much narrower than `School`, so use it as a refinement signal, not a family anchor.
- School has at least two important sub-families that should not be mixed:
  - school bully / fighting / delinquency / modern action
  - school romance / youth / relationship-driven drama
- `Lookism`, `Weak Hero`, `Viral Hit`, and `Study Group` belong much closer to the first sub-family.
- `True Beauty`, `Seasons of Blossom`, and other relationship-led school titles belong much closer to the second sub-family.

### Regression / Reincarnation / Isekai-like

Observed signals:
- Reincarnation
- Age Regression
- Second Chance
- Time Travel
- Time Loop
- Time Manipulation
- Time Rewind
- Transmigration
- Reincarnated in Another World
- Reincarnated in a Book World
- Reincarnated Female Lead
- Reincarnated Male Lead
- Regressed Female Lead
- Regressed Male Lead

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
- `Reincarnation` alone is not enough to know the family, but it is a very strong hook when paired with royalty, romance, or a game/system context.

### Game / System

Observed signals:
- Game World
- Transported to a Game World
- Game Elements
- Level System
- System Administrator
- Based on a Game
- Based on a Video Game
- Video Games
- Otome Game
- High Stakes Game
- High Stakes Games
- Death Game
- Game of Death
- Survival Game

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
- `Game World` is weaker than `Game Elements` / `Level System`, but it still helps identify the right cluster.

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

- `Wuxia`, `Cultivation`, `Level System`, `Reincarnation`, `Royalty`, and `School` are often stronger anchors than `Action`, `Drama`, or `Romance`.
- `Martial Arts` and `Swordplay` are important but usually act as bridges.
- `Historical` and `European Ambience` need context to know whether they point to court fantasy, western sword, or something else.
- Lead and role tags are important context, not complete family definitions.
- `High School`, `Nobility`, `European Ambience`, and `Game Elements` are useful refiners, but they are not enough on their own.

## Research Direction

- Split the 99%+ titles into family groups first.
- For each group, list:
  - defining tags
  - supporting tags
  - bridge tags
  - misleading tags
- Compare 99%+ versus 90-99% to see which tag relations remain stable.
- Build an overlap map rather than forcing one tag to own a trope.

## Logs To Use

- `db/exports/frontend/meta/mangabaka-tag-weights.safe-suggestive-anilist.log`
- `db/exports/frontend/meta/mangabaka-tag-weights.safe-suggestive-anilist.progress.jsonl`
- `db/updates/changelog/`
- `db/state/`

Source of truth:
- Keep the weight scrape artifacts in the backend export tree.
- Do not treat frontend `public/data/` copies as authoritative if they appear during parallel work.
- The backend paths above are the ones future agents should inspect first.

Use these to confirm:
- scrape completeness
- failed titles
- timing / batch behavior
- whether a weight export actually matches the catalog snapshot used for analysis

## Current Overlap Signal

High-popularity overlap counts show that broad tags are truly bridge tags:

- `Martial Arts` is present in 42 popular titles, and it overlaps with murim, school, and game-heavy stories.
- `Swordplay` is present in 59 popular titles, and it overlaps with murim, western court, school, and game/system titles.
- `Action` and `Drama` are extremely broad and appear across almost every family.
- `Romance` crosses court, school, and even some action/fantasy families.
- `School` is broad enough to act as its own family, but also appears inside action, romance, and game/system titles.
- `Wuxia + Martial Arts` is a clean murim pairing.
- `Swordplay + European Ambience` is a clean court / western sword pairing.
- `School + Action` and `School + Drama` are common modern-action mixtures.
- `Reincarnation + Royalty` is a strong royal-rebirth pattern.
- `Game Elements + Level System` is the strongest game/system pairing.

This means family assignment cannot rely on one tag alone.

## Top 10 Percent Check

The same pattern still holds when widening from the 99% slice to the top 10% slice:

- `Martial Arts` grows a lot, but it still behaves like a bridge tag rather than a family anchor.
- `Swordplay`, `European Ambience`, `Nobility`, and `Royalty` become even more common in the wider slice, but the pairings still matter more than the individual tag.
- `Drama` and `Romance` become extremely common at top 10%, which makes them even less useful as standalone family definitions.
- `Reincarnation` stays strong, but `Reincarnation + Royalty` is still the clearer signal than `Reincarnation` alone.
- `Game Elements` and `Level System` still pair well, but `Level System` is sparse enough that it should not be required as a hard gate.
- `School + Drama` and `School + Romance` remain common mixed patterns, which means school is a context family, not a pure genre family.

This is the key takeaway for recommender logic:
- the broader the slice, the more useless the flat broad tags become
- the more valuable the exact tag combinations become
- the model should rank by weighted overlap of anchor + bridge + context, not by one hard tag match

## Other Splits To Keep Separate

These are the next major confusion points to guard against while expanding toward the top 50 percent slice:

### School Bully / Fighting vs School Romance

- `School`, `High School`, `Bully`, `Bullied Protagonist`, `Street Fighting`, `Fighting`, and `Delinquent` point toward school-bully / fighting stories.
- `School`, `High School`, `Romance`, `Love Triangle`, `First Love`, and `Youth` point toward school romance / relationship-led stories.
- These should not be treated as one family just because they share `School`.

### Court Fantasy vs Court Romance

- `Royalty`, `Nobility`, `Princess`, `Prince`, `Dukes`, `Empress`, and `Politics Involving Royalty` often anchor court fantasy / noble drama.
- `Royalty` combined with `Romance` often shifts the feel toward relationship-led court stories.
- `Reincarnation + Royalty` is especially common and should be treated as its own strong royal-rebirth pattern.

### Murim Action vs Western Sword Fantasy

- `Wuxia`, `Cultivation`, `Martial Arts`, `Martial Artist`, `China`, and `Ancient China` point toward murim-like stories.
- `Swordplay`, `Swordsman`, `Swordswoman`, `Medieval`, `European Ambience`, `Europe`, and `Royalty` point toward western sword or medieval court fantasy.
- `Swordplay` by itself is too ambiguous and should be treated as a bridge tag.

### Game/System vs Pure Fantasy

- `Game Elements`, `Level System`, `Game World`, `System Administrator`, and `Transported to a Game World` are the real game/system cluster.
- `Fantasy` alone is too broad to define that cluster.
- `Game Elements + Level System` stays much more reliable than either tag alone.

### Office / Business Romance vs Office / Career Drama

- `Office`, `Company`, `Secretary`, `Businessman`, and `Businesswoman` can support either romance or career stories.
- When paired with `Romance`, the family shifts toward office romance.
- When paired with growth, work, or career context, it shifts toward office / business drama.

### Horror / Survival vs Supernatural Drama

- `Horror`, `Survival`, `Monster`, `Zombie`, `Ghost`, `Thriller`, and `Dark Fantasy` are not interchangeable.
- Some titles are survival-first, some are horror-first, and some are supernatural drama with only mild horror flavor.
- These should be separated before feeding rec logic, because the mood expectation is very different.

## Common Trope Buckets

These are the recurring manhwa tropes that often overlap in tags but should still be separated when building recommendations:

- Villainess / noble-lady rebirth stories
  - usually mix `Reincarnation`, `Age Regression`, `Royalty`, `Nobility`, `Romance`, and `Drama`
  - examples: `Who Made Me a Princess`, `The Villainess Turns the Hourglass`, `Villains Are Destined to Die`
- Regression / second-chance power growth stories
  - usually mix `Age Regression`, `Reincarnation`, `Training`, `Weak to Strong`, `Action`, and sometimes `Game Elements`
  - examples: `A Returner's Magic Should Be Special`, `The Skeleton Soldier Failed to Defend the Dungeon`
- Dungeon / system power fantasy
  - usually mix `Game Elements`, `Level System`, `Game World`, `Dungeon Exploring`, `Training`, `Action`, and `Fantasy`
  - examples: `Solo Leveling`, `Second Life Ranker`, `SSS-Class Revival Hunter`
- Academy / school fighting stories
  - usually mix `School`, `High School`, `Bully`, `Street Fighting`, `Fighting`, `Action`, and `Drama`
  - examples: `Lookism`, `Weak Hero`, `Viral Hit`, `Study Group`
- Academy / school romance stories
  - usually mix `School`, `High School`, `Romance`, `Drama`, `Love Triangle`, and `Youth`
  - examples: `True Beauty`, `Seasons of Blossom`
- Court romance / noble drama
  - usually mix `Royalty`, `Nobility`, `Princess`, `Prince`, `Romance`, `Drama`, and `Reincarnation`
  - examples: `Why Raeliana Ended Up at the Duke's Mansion`, `The Remarried Empress`
- Murim / martial-arts progression
  - usually mix `Wuxia`, `Cultivation`, `Martial Arts`, `Swordplay`, `China`, `Ancient China`, `Action`, and `Training`
  - examples: `The Legend of the Northern Blade`, `Heavenly Demon Reborn!`, `Return of the Blossoming Blade`
- Western sword / medieval court fantasy
  - usually mix `Swordplay`, `Swordsman`, `Swordswoman`, `European Ambience`, `Medieval`, `Royalty`, `Nobility`, and `Fantasy`
  - examples: `A Stepmother's Märchen`, `The Remarried Empress`, `Lout of Count's Family`

## Recommendation Safety Rules

- Do not mix BL, GL, or explicit adult romance with general romance recs by default.
- Treat `Boys Love`, `Girls Love`, `Yaoi`, `Yuri`, `Hentai`, and similar adult-leaning signals as separate recommendation lanes.
- Normal romance recs should stay in the straight romance lane unless the user explicitly wants cross-lane results.
- If a title is BL, GL, or smut-heavy, that should be a deliberate branch in scoring, not a silent merge.
- Do not treat `Fantasy` as a family anchor by itself; it is usually a backdrop tag.
- Do not treat `Action` as a family anchor by itself; it is usually a mode tag.
- Do not treat `School` as a single family; it has multiple important sub-lanes.
- When sampling buckets, use exact tag combinations instead of loose theme-adjacent filters, or the buckets will get polluted by broad tags and look falsely similar.

The important rule:
- overlap at the trope layer is normal
- the model should not stop at the tag layer
- it should infer which trope bucket the tags belong to before scoring recs

## Exact Combo Signal

Exact tag combinations are already showing useful separations:

- `School + High School + Bully + Street Fighting` is much narrower than plain `School`.
- `School + High School + Romance + Love Triangle` is a different lane from school fighting.
- `School + High School + Horror` is a different lane again, and should not be merged with either of the above.
- `Royalty + Nobility + Politics Involving Royalty` is a court-politics lane, while `Royalty + Nobility + Romance` is more court-romance.
- `Wuxia + Martial Arts` gives a strong murim signal.
- `Swordplay + European Ambience` gives a strong western sword signal.
- `Game Elements + Level System` is a strong game/system core.
- `Age Regression + Training` is a much tighter power-growth signal than `Age Regression` alone.
- `Age Regression + Romance` is a much broader romance-rebirth lane.
- `Boys Love`, `Girls Love`, and `Hentai` each need separate handling because their exact combinations behave very differently in the catalog.

More exact tests:

- `Villainess + Reincarnation + Nobility + Romance` is a major rebirth/court-romance lane.
- `Villainess + Royalty + Politics Involving Royalty + Drama` is a different court-politics lane.
- `Noble Female Lead + Reincarnation + Romance` is another rebirth/court-romance lane, but not identical to villainess stories.
- `Royalty + Nobility + Drama` is court-drama and can include romance, politics, or fantasy.
- `Royalty + Nobility + Fantasy` is court-fantasy and can still overlap with romance.
- `Boys Love + Romance`, `Girls Love + Romance`, and `Hentai + Romance` all exist as separate lanes, not one merged romance lane.
- `Yaoi + Adult Cast` and `Yuri + Adult Cast` are narrow relationship/adult combinations and should be handled with care.
- `Office + Romance` and `Office + Adult Cast` are also separate enough to deserve different treatment.
- `Survival + Horror` is a cleaner lane than just `Horror` or just `Survival`.
- `School + High School + Horror` is a distinct school-horror lane and should not be merged into school romance or school fighting.
- `Fantasy + Magic` is far too broad to stand on its own.
- `Fantasy + Wuxia + Martial Arts` is much tighter and points to martial fantasy.
- `Fantasy + Game Elements + Level System` is a game-fantasy lane.
- `Fantasy + Dungeon Exploring + Game Elements` is a dungeon-fantasy lane.
- `Action + Martial Arts` is much broader than the martial-fantasy lane and needs more context.
- `Action + Game Elements` is a separate action-game lane.
- `Age Regression + Training + Action` is a power-growth lane.
- `Age Regression + Romance + Drama` is a romance-rebirth lane.
- `Fantasy + Age Regression` is still broad and should not be treated as a single genre by itself.
- `Fantasy + Royalty + Nobility` is court-fantasy, while `Fantasy + School` is a different school-fantasy lane.
- `School + Supernatural + Horror` is a distinct supernatural-school lane.
- `Office + Company + Romance` is very broad and can include explicit, romantic, or workplace stories, so it needs more context before it becomes a recommendation lane.
- `Office + Reincarnation` is rare and should be treated as an interesting special case, not a main bucket yet.
- `Businessman / Businesswoman` by themselves are not enough to identify a business-core story.
- `Career`-style tags need more role context before they can be used safely.
- `Mystery + Investigation + Secret + Suspense` is very narrow and should be treated as a mystery lane, not just general drama.
- `School + Mystery + Investigation` is a school-mystery lane.
- `Mystery + Horror + Ghost` is a mystery-horror lane, not just supernatural.
- `Comedy + Romance` and `Comedy + Fantasy` are broad mixed lanes and need more context before being used as anchors.
- `Slice of Life + Daily Life` is a backdrop lane, not a genre core.
- `School + Slice of Life` and `Office + Slice of Life` are separate context buckets.
- `Historical + Politics Involving Royalty` is a court-history lane.
- `Historical + Romance` and `Historical + Fantasy` are separate from court politics and can overlap without being the same thing.
- `Supernatural + Horror` is distinct from `Supernatural + Romance`.
- `Thriller + Suspense` needs caution because it often overlaps with horror, school, or mystery.
- `Family Drama` and `Coming of Age` are context-heavy lanes and should not be treated as family anchors on their own.
- `Mystery + Investigation + Murder` is a crime-mystery lane.
- `Mystery + School + Investigation` is school mystery.
- `Supernatural + Ghosts + Mystery` is a ghost-mystery lane.
- `Horror + Body Horror` is a different lane from `Horror + Mystery + Thriller`.
- `Survival + Apocalypse` is the backbone of apocalypse survival stories, but the mood can still split into zombie, monster, psychological, or conspiracy variants.
- `Revenge + School` is a revenge-drama lane, not just school drama.
- `Revenge + Court` is a court power lane.
- `Revenge + Action + Weak to Strong` is a power-growth revenge lane.
- `Comedy + Fantasy` often hides supernatural slice-of-life or gag fantasy rather than epic fantasy.
- `Slice of Life + School` is a coming-of-age lane, while `Slice of Life + Office` is a workplace daily-life lane.
- `Historical + Fantasy` is broad and can include court, royal politics, or period fantasy without being the same thing.
- `Psychological + Thriller` is another caution cluster because it often overlaps with mystery, horror, or revenge rather than functioning as a standalone family.
- `Sports + Competition + Training` is a sports-growth lane.
- `Sports + Fighting + Action` is a sports-fight lane.
- `Sports + Romance` is a different mixed lane and should not be merged with either of the above.
- `Cooking + Working + Restaurant` is food-career / lifestyle.
- `Cooking + Romance + Restaurant` is food-romance.
- `Cooking + Comedy + Restaurant` is food-comedy.
- `Office + Company + Working` is workplace career.
- `Office + Company + Revenge` is workplace revenge.
- `Office + Company + Romance` is workplace romance.
- `Office + Company + Erotica` is workplace adult content.
- `Politics Involving Royalty + Royalty + Drama` is court-politics.
- `Politics Involving Royalty + Royalty + Romance` is court-romance politics.
- `Politics Involving Royalty + Revenge + Royalty` is court revenge/power.
- `Comedy + School` is not just school romance; it can be school comedy, youth, or gag school stories.
- `Comedy + Office` is workplace comedy.
- `Comedy + Horror` is a distinct dark-comedy horror lane.
- `Supernatural + Drama` is broad and needs a more specific anchor before rec usage.
- `Supernatural + Romance` is a separate lane from `Supernatural + Mystery`.
- `Mystery + Psychological` is a strong psychological mystery lane.
- `Revenge + Psychological` is a revenge-psychology lane.
- `Sports + Training + Competition` is a sports-growth lane.
- `Sports + Fighting + Action` is a combat-sports lane.
- `Sports + Romance` can be a separate lane from sports competition or sports drama.
- `School + Sports + Team Sports` is a school-sports lane.
- `School + Martial Arts School` is a fighting-school lane, not a normal school romance lane.
- `School + Bullying + Action` is a delinquency/fighting-school lane.
- `School + Bullying + Romance` is a different school-drama lane.
- `School + Boys Love` and `School + Shounen Ai` are separate school relationship lanes.
- `School + Gender Bender` is its own niche and should not be merged with normal school romance.
- `School + Sports + Team Sports` is a school-sports lane.
- `School + Sports + Baseball` is a school-baseball lane.
- `School + Sports + E-Sports` is a school-gaming lane.
- `School + Comedy + Slice of Life` is a school-growth / school-comedy lane.
- `School + Horror + Mystery` is a school-horror mystery lane.
- `School + Bullying + Psychological` is a bullying-psychology lane.
- `School + Action + Gangs` is a delinquency / gang-fighting lane.
- `School + Gender Bender + Comedy` is its own niche and should not be merged with normal school romance.
- `School + Boys Love + Shounen Ai` is school BL.
- `School + Girls Love + Yuri` is school GL.
- `School + Love Triangle + Romance` is school romance, but `School + Love Triangle + Comedy` can be more youth/comedy than romance.
- `School + Coming of Age` is school growth / youth.
- `School + Time Rewind` is a regression school lane.
- `School + Meta + Survival` is a meta-survival school lane.
- `School + Apocalypse` is a school-apocalypse lane.
- `School + Delinquents` is a delinquency lane, not normal school life.
- `School + Friendship + Slice of Life` is a school-friendship lane.
- `School + Models / Idols` is a performance/appearance niche, not a core romance lane.
- `School + Crossdressing / Gender Bender` is a niche lane that should stay separate.
- `School + Supernatural + Romance` is a different lane from `School + Supernatural + Horror`.
- `School + Family Drama` is a separate emotional lane.
- `School + Bullying + Revenge` is a revenge-school lane.

This is still not the final model, but it is strong evidence that the recommender should build from exact role combinations and then widen outward with bridge tags.

## Examples Worth Keeping

### Murim-like

- The Legend of the Northern Blade
- Heavenly Demon Reborn!
- Return of the Blossoming Blade
- Log-in Murim
- Absolute Sword Sense
- Myst, Might, Mayhem

### Western Sword / Court

- Who Made Me a Princess
- Why Raeliana Ended Up at the Duke's Mansion
- Doctor Elise: The Royal Lady with the Lamp
- The Remarried Empress
- Villains Are Destined to Die
- Lout of Count's Family

### School / Modern

- Lookism
- Weak Hero
- Viral Hit
- Study Group
- Sweet Home
- Eleceed

### Regression / Reincarnation

- Who Made Me a Princess
- Why Raeliana Ended Up at the Duke's Mansion
- Doctor Elise: The Royal Lady with the Lamp
- A Returner's Magic Should Be Special
- The Skeleton Soldier Failed to Defend the Dungeon
- Villains Are Destined to Die

### Game / System

- Solo Leveling
- Hardcore Leveling Warrior
- SSS-Class Revival Hunter
- Omniscient Reader
- Second Life Ranker
- Log-in Murim

## New Hypothesis

- `Martial Arts` should probably be a bridge tag between murim-like action, school fighting, and game/system action.
- `Swordplay` may need separate sub-roles depending on whether it appears with murim, court fantasy, or game/system.
- `School` looks like a primary family in modern titles, but it also appears as context in action, romance, and supernatural stories.
- `Historical` is not enough by itself; it needs `European Ambience`, `Royalty`, `Nobility`, or `Chinese` context to become meaningful.
- The recommender should probably think in terms of family anchors plus bridge tags, not a single flat tag list.
- The safe default is:
  - one or two family anchors
  - one broad mode tag
  - one or two bridge/context tags
  - then score against overlap, not exact equality

## Lane Map Snapshot

Stable lanes and sublanes currently supported by the evidence:

- Murim
  - tragedy / revenge
  - comedy / chaos
  - ruthless cultivation
  - scholar/regression crossover
  - system-murim hybrid
- Court
  - child/fairytale rebirth
  - villainess survival
  - adult empress / court politics
  - duke-mansion romance
  - court-revenge power lane
- System / dungeon
  - brute-force battle fantasy
  - tactical solo progression
  - revival / loop
  - crafting / reset
  - meta-scenario / survival
  - murim-system hybrid
- School
  - fight / delinquency
  - romance / youth
  - sports
  - horror / mystery / apocalypse
  - BL / GL / gender-bender
  - coming-of-age
  - revenge
  - friendship / slice-of-life
- Office / business
  - career / daily-life
  - romance
  - BL workplace
  - adult / smut
  - revenge / betrayal
- Horror / survival
  - zombie
  - monster
  - body horror
  - psychological
  - conspiracy
  - school-survival
  - apocalypse
- Romance / adult relationship
  - straight romance
  - BL
  - GL
  - smut / explicit
  - supernatural
  - school
  - workplace
- BL
  - school
  - workplace
  - adult
- GL
  - school
  - workplace
  - adult
- Sports
  - competition / training
  - fighting/combat sports
  - school sports
  - romance-adjacent
- Food
  - cooking / career
  - romance
  - comedy
- Mystery / thriller / supernatural
  - crime mystery
  - school mystery
  - ghost mystery
  - psychological thriller
  - supernatural romance
  - supernatural horror
- Historical / fantasy / comedy / slice-of-life
  - court history
  - historical romance
  - historical fantasy
  - comedy-fantasy
  - school slice-of-life
  - office slice-of-life
  - the overlap buckets above are stable enough to keep as lanes, but they still need exact-combo scoring rules rather than hard genre equality

Closed out in this pass:
- GL workplace is now a stable lane and should no longer be treated as an open validation gap.
- BL school, BL workplace, BL adult, GL school, GL adult, and school gender-bender / crossdressing-adjacent cases all have enough title evidence to keep as named sublanes.
- Court, school, system/dungeon, murim, office/business, horror, romance/adult, sports, food, mystery/thriller, and historical/fantasy are all now mapped at least to sublane level.

Open validation areas still needing more title-level passes:
- business-core vs business-backdrop separation
- pure fantasy vs dark fantasy vs supernatural fantasy edge cases
- more sports niche subtypes beyond boxing/baseball/football
- more cooking/food lane refinements
- a few murim outliers that still blur between sword-tech, tragedy, and system hybrid
