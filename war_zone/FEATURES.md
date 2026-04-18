# War Zone — Feature Reference
> Update this file whenever a feature is added, changed, or removed.

## Controls
**Move:** WASD | **Sprint/Fly down:** Shift | **Jump/Fly up:** Space | **Shoot:** LMB | **Zoom:** Z | **Reload:** R | **Drop weapon:** X | **Airstrike:** F | **Switch slot:** 1–9 | **Next/Prev weapon:** C / Q | **Med kit:** Q (uses kit if owned, else prev weapon) | **Adrenaline:** Y | **Pickup / consumables panel:** E | **Third-person toggle:** Tab | **Pause:** Esc | **Chat/cheats:** ` (backtick)

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
| Fortress | 250 | Static; outer walls h=12 with staircases to walk tops; inner keep h=20; 3 secret passages (E to open 3s); towers, battlements, torches |
| Cave | 200 | Enclosed underground labyrinth; glowing crystal PointLights; zombie spawn restricted to designated cavern |

**Day/night cycle** (City/Forest/Mountain/Desert): 7.5-min loop. Noon = sun overhead. Daytime fog is sky-blue horizon haze; night switches to close dark fog.  
**Chunk streaming:** load within 150 units, unload beyond 240. Updated every 0.5s. Zombie spawns must stay under 130 units or they appear in unloaded terrain.  
**Zombie spawn cavern** (Cave): All zombies in Zombie Apocalypse mode spawn within a single designated cavern (`gameState.zombieSpawnCavern`), creating a clear threat origin point.

## Weapons
| Name | Cost | Type | Damage | Fire Rate | Ammo | DPS / Notes |
|------|------|------|--------|-----------|------|-------------|
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
| Apex Zombie | 1000+(lvl-1)×200 | 50+(lvl-1)×10 | min(playerWalk+2, 8+(lvl-1)×0.4) | 100+(lvl-1)×25 | Zombie mode: requires level ≥3, 2%/level chance (max 15%). Rescue mode: 1 spawns 18 units from player, immediately attracted. Orange-gold skin, fire spike crown, yellow eyes; 300+(lvl-1)×50 XP on kill |
| Rescue Hostile | 40 | 8 | 4.0 | $3 | 50% armed; 40% armored (35% dmg reduction) |

## Progression
**XP → Level:** `nextLevel = level × 100 XP`. Each level-up grants **+5 stat points**.  
**Stat points** (Loadout → Stats): Health +5 HP · Speed +2% · Damage +2% · Stamina +10 · Jump +5% · Reload −5% (min 20% base time)  
**Money:** earned from kills; spent in Shop on weapons, armor, consumables, attachments, or XP packages (100/$2.5k → 6000/$50k)

## Chat & Cheats
Open with `` ` ``. Plain text = chat bubble (5s). Prefix with `` ` `` for commands.  
`` `admin `` → enter code **zone** → cheats unlocked (input turns green).  
Cheats: `` `fly `` (Space=up, Shift=down) · `` `god `` · `` `noclip `` · `` `refill `` · `` `killall ``

## Module Map
`engine.js` scene/camera/renderer · `data.js` all constants · `state.js` player+game state, leveling · `map.js` terrain+chunk streaming · `entities.js` enemy AI+spawning · `weapons.js` view models+reload · `combat.js` shooting+damage+explosions · `input.js` keyboard/mouse/chat · `ui.js` shop/loadout/HUD · `audio.js` Web Audio synth · `main.js` game loop+collision+3rd-person camera
