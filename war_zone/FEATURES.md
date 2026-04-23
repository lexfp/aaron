# War Zone — Feature Reference
> Update this file whenever a feature is added, changed, or removed.

## Controls
**Move:** WASD | **Sprint/Fly down:** Shift | **Jump/Fly up:** Space | **Shoot:** LMB | **Zoom:** Z | **Reload:** R | **Drop weapon:** X | **Airstrike:** F | **Switch slot:** 1–9 | **Next/Prev weapon:** C / Q | **Med kit:** Q (uses kit if owned, else prev weapon) | **Adrenaline:** Y | **Pickup / consumables panel:** E | **Third-person toggle:** Tab | **Pause:** Esc | **Chat/cheats:** ` (backtick)

All controls (except 1–9 weapon slots) are rebindable via the **Keybinds** menu accessible from the main menu or the pause screen. Bindings persist across sessions via `localStorage` (`wz_keybinds`). Config lives in `data.js` (`DEFAULT_KEYBINDS`, `keybinds`, `saveKeybinds`); input.js normalizes pressed keys to engine keys using the config; ui.js renders and manages the menu overlay (`#keybinds-overlay`).

## Game Modes
| Mode | Goal | Notes |
|------|------|-------|
| Zombie Apocalypse | Survive waves | Every 2 kills spawns 3 more; bosses drop weapons |
| Rescue Mission | Rescue a hostage (press E) then reach extraction zone | Hostiles are armed humans; 40% have armor |
| PvP Arena | Kill the AI enemy; first to win rounds wins | 3-slot loadout limit |

## Maps
| Map | Size | Key Feature |
|-----|------|-------------|
| Warehouse | 120 | Pitch dark, flickering ceiling lights |
| City Ruins | 480 | Chunk-streamed buildings, craters, street lamps, day/night cycle |
| Dark Forest | 480 | Chunk-streamed trees, boulders, mushroom clusters |
| Rocky Mountains | 480 | Chunk-streamed slopes; raycaster-based floor snapping |
| Desert Outpost | 480 | Chunk-streamed dunes (isSlope), ruined walls (30% chunk chance) |
| Fortress | 250 | Static; outer walls h=6 with 4 staircases to walk tops; inner keep h=10; 3 original secret passages + 4 underground tunnels (N/S/E/W walls, press E) descending via staircases to underground network: east/west/north corridors meet central stone chamber with 4 columns & torches; south corridor T-junctions into east corridor; 2 enclosed wall corridors (N & E interior) — all opened with E (3s); label shown in prompt (tunnel/corridor/passage); towers, battlements, torches |
| Cave | 200 | Enclosed underground labyrinth; glowing crystal PointLights; zombie spawn restricted to designated cavern |
| The Hallway | 200 | Single 8-wide × 10-tall × 380-long corridor. Player spawns at z=+187 (south end); zombies spawn at z=−187 (north end). Ceiling light strips every 20 units; wall torches near zombie end. Scattered crates for cover. Pure chokepoint survival. |

**Day/night cycle** (City/Forest/Mountain/Desert): 7.5-min loop. Noon = sun overhead. Daytime fog is sky-blue horizon haze; night switches to close dark fog.  
**Chunk streaming:** load within 150 units, unload beyond 240. Updated every 0.5s. Zombie spawns must stay under 130 units or they appear in unloaded terrain.  
**Zombie spawn cavern** (Cave): All zombies in Zombie Apocalypse mode spawn within a single designated cavern (`gameState.zombieSpawnCavern`), creating a clear threat origin point.

## Weapons
| Name | Cost | Type | Damage | Fire Rate | Ammo | DPS / Notes |
|------|------|------|--------|-----------|------|-------------|
| Compass | Free | Utility | — | — | — | Always in inventory; needle points toward hostage (Rescue Mission) or extraction zone. Works in 1st and 3rd person. |
| Flashlight | Free | Utility | — | — | — | Spawns as world pickup near player spawn each match. Equip to toggle a SpotLight beam (range 120). Pushes fog far out while active. Works in 1st and 3rd person. |
| Fists | Free | Melee | 6 | 0.45s | ∞ | ~13 DPS, reach 2.5 |
| Glock | Free | Gun | 12 | 0.35s | 15+120 | ~34 DPS |
| Revolver | $750 | Gun | 28 | 0.65s | 8+64 | ~43 DPS |
| Molotov | $750 | Throwable | 12 dps | — | 2+6 | Fire zone r=5, 6s |
| Grenade | $1,000 | Throwable | 80 | — | 3+9 | Explosion r=6 |
| Shotgun | $2,500 | Gun | 14 (+70 close) | 0.9s | 6+36 | ~93 DPS point-blank |
| Axe | $4,000 | Melee | 14 | 0.65s | ∞ | ~22 DPS, reach 2.8 |
| Crossbow | $4,750 | Gun | 20 (80 zoomed) | 2.2s | 1+20 | Silent, has scope |
| Knife | $5,000 | Melee | 10 | 0.15s | ∞ | ~67 DPS, +90 headshot |
| Shield | $6,000 | Melee | 8 | 0.75s | ∞ | Blocks frontal hits; side/rear bypass |
| SMG | $6,000 | Gun | 5 | 0.08s | 30+210 | ~63 DPS |
| Katana | $7,500 | Melee | 18 | 0.35s | ∞ | ~51 DPS, reach 3.2 |
| Assault Rifle | $10,000 | Gun | 6 | 0.09s | 40+200 | ~67 DPS, long range |
| Longsword | $10,000 | Melee | 22 | 0.75s | ∞ | ~29 DPS, reach 3.8 |
| Chainsaw | $15,000 | Melee | 8 | 0.07s | ∞ | ~114 DPS |
| RPG | $25,000 | Gun | 150 | 2.5s | 1+5 | Explosive r=8 |
| Sniper | $100,000 | Gun | 30 (150 zoomed) | 1.2s | 5+30 | Has scope; +40 headshot zoomed |
| Minigun | $110,000 | Gun | 4 | 0.025s | 900+2700 | ~160 DPS |

**Weapon degradation:** 10 uses → damaged, cannot fire. Repair for $50.  
**Attachments:** Silencer $500 (no noise/zombie attraction) · Scope $800 (+20 damage when zoomed, for guns without native scope)

## Armor & Equipment
Four slots: Helmet, Breastplate, Pants, Boots. Drag-drop or click to equip in Loadout. Armor absorbs up to 50% of each hit; pool depletes over time.

| Slot | Light | Chainmail | Heavy |
|------|-------|-----------|-------|
| Helmet | $1,500 · 40 armor · 40% HS reduction | $11,000 · 70 · 60% | $30,000 · 100 · 85% |
| Breastplate | $4,500 · 100 armor · 30% dmg reduction | $27,500 · 175 · 45% | $50,000 · 250 · 60% |
| Pants | $1,500 · 50 armor · 15% dmg reduction | $10,000 · 90 · 25% | $20,000 · 130 · 35% |
| Boots | $1,125 · 30 armor · 10% dmg reduction | $7,500 · 60 · 20% | $12,000 · 90 · 30% |

**Consumables:** Med Kit $500 (+50 HP) · Adrenaline $750 (+25 temp HP) · Airstrike Targeter $5,000 (+1 charge, F key, 5-min cooldown)

## Enemies
| Type | HP | Dmg | Speed | Money | Notes |
|------|----|-----|-------|-------|-------|
| Zombie | 25 | 5 | 3.5 | $1 | 5% chance armed (close weapon) |
| Boss Zombie | 100 | 20 | 2.5 | $10 | Can carry any weapon |
| Giga Zombie | 1000 | 50 | 7.0 | $75 | Rare; very large |
| Apex Zombie | 1000+(lvl-1)×200 | 50+(lvl-1)×10 | min(playerWalk+2, 8+(lvl-1)×0.4, 15) | 100+(lvl-1)×25 | Zombie mode: requires level ≥3, replaces a giga spawn at 1%/level chance (max 10%). Rescue mode: 1 spawns 18 units from player, immediately attracted. Orange-gold skin, fire spike crown, yellow eyes; 300+(lvl-1)×50 XP on kill |
| Rescue Hostile | 40 | 8 | 4.0 | $3 | 50% armed; 40% armored (35% dmg reduction) |

### Hive-Mind Squad System

Zombies operate in a three-tier command hierarchy. All logic lives in `entities.js` (`assignSquad`, `assignCommander`, `updateSquads`); state lives in `gameState.hiveMind`.

**Hierarchy:**
- **Boss zombie** → leads 1 squad (up to 10 members); spawns its own squad automatically
- **Giga zombie** → division commander over up to 5 squads; when Giga engages player, all 5 squads instantly activate
- **Apex zombie** → army commander over up to 10 squads; same broadcast, broader reach

**Squad formation:** Boss zombies always create a new squad as leader. Regular zombies join the nearest boss-led squad within 30 units (up to 10 members). Squadless zombies fight independently using existing AI. When a Giga/Apex spawns it claims up to 5/10 existing squads; new boss squads that form near a commander are auto-assigned to it (within 80 units).

**Roles (per squad):** leader (1) · flanker_l (2) · flanker_r (2) · charger (2) · support (3). Slots fill in that order as members join.

**Squad state machine:** `assembling` → `approaching` → `executing`.
- `assembling`: wander normally; any member spotted → whole squad activates
- `approaching`: all members pursue player together
- `executing`: triggered when boss leader reaches 18 units from player — flankers sweep ±90°, chargers sprint straight, support holds at >25 units, all pulse orange

**Squad names:** Each squad gets a random "Adjective Noun" name (e.g. "Feral Brood") displayed above every member's head as a floating orange label above the HP bar. Label updates if a zombie merges into a new squad.

**Visual feedback:** All members flash orange emissive (0.5s) on execute. Giga/Apex pulse bright (1s) when broadcasting to commanded squads.

### Enemy Animations
Each arm is split into **upper arm** (shoulder pivot, `children[2/3]`) + **forearm group** (elbow pivot, `armGroup.children[1]`), allowing elbow bending.
- **Walk:** arms slightly raised forward (classic zombie reach); elbows naturally bend on backswing
- **Punch/melee:** shoulders alternate hard forward swings; elbows extend on strike, bend sharply on backswing; body rocks and lunges
- **Gun aiming:** right arm extended forward (elbow ~straight), left arm raised as support (elbow bent ~55°); body leans slightly forward
- Upper arm uses shirt material; forearm uses skin material for visible sleeve/wrist contrast

## Progression
**XP → Level:** `nextLevel = level × 100 XP`. Each level-up grants **+5 stat points**.  
**Stat points** (Loadout → Stats): Health +5 HP · Speed +2% · Damage +2% · Stamina +10 · Jump +5% · Reload −5% (min 20% base time)  
**Money:** earned from kills; spent in Shop on weapons, armor, consumables, attachments, or XP packages (100/$2.5k → 6000/$50k)

## Chat & Cheats
Open with `` ` ``. Plain text = chat bubble (5s). Prefix with `` ` `` for commands.  
`` `admin `` → enter code **zone** → cheats unlocked (input turns green).  
Cheats: `` `fly `` (Space=up, Shift=down) · `` `god `` · `` `noclip `` · `` `refill `` · `` `killall `` · `` `nightvision `` (toggle; green canvas filter + ambient intensity ≥4.0 + dark vignette overlay)

## Achievements

Persistent achievement system stored in `playerData.achievements` (localStorage). 20 achievements across 6 categories. Each unlocks a money reward immediately on completion.

**Categories:** Kills, Rescue Mission, PvP, Zombie Session, Combat, Progression

**Key stats tracked in `playerData`:**
- `totalZombieKills` — lifetime kills (all modes)
- `bestRescueTime` — fastest rescue in seconds (null if never completed)
- `totalRescueCompletions` — successful extractions
- `totalPvpWins` — PvP match wins
- `bestZombieSession` — highest kills in one zombie apocalypse session
- `totalMoneyEarned` — cumulative money from kills + rewards
- `totalDamageDealt` — total damage dealt to enemies
- `totalHeadshotKills` — headshot kills
- `flawlessRuns` — missions won without taking any damage
- `totalAirstrikes` — airstrikes called
- `totalExplosiveKills` — explosive kills (RPG, grenade, airstrike)
- `apexKills` / `gigaKills` — boss-type zombie kills
- `totalMedkitsUsed` — med kits consumed

**Per-game flags in `gameState`:**
- `missionStartTime` — `performance.now()` at game start (used for rescue timer)
- `tookDamageThisGame` — set `true` by `damagePlayer()`, reset in `startGame()`

**UI:** "Achievements" button on homepage opens `#achievements-overlay`. Shows all 20 achievement cards in a 2-column grid with progress bars, locked/unlocked state, and reward amounts. Best rescue time shown at top if set.

**Toast:** Gold-bordered toast pops in top-right corner of HUD on unlock. Multiple toasts stack vertically. Fades out after 4 seconds.

**Module:** `js/achievements.js` — leaf module (imports only `state.js`, `data.js`). Exports: `checkAchievements()`, `initAchievementsUI()`, `openAchievementsScreen()`.

## Module Map
`engine.js` scene/camera/renderer · `data.js` all constants · `state.js` player+game state, leveling · `map.js` terrain+chunk streaming · `entities.js` enemy AI+spawning · `weapons.js` view models+reload · `combat.js` shooting+damage+explosions · `input.js` keyboard/mouse/chat · `ui.js` shop/loadout/HUD · `audio.js` Web Audio synth · `main.js` game loop+collision+3rd-person camera
