# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Instructions for Claude

Do not make any changes until you have 95% confidence in what you need to build. Keep prompting until that level of confidence is reached. 
Always keep this file updated as thoroughly as possible. After any significant changes — new features, new files, architecture changes, new commands — update CLAUDE.md to reflect them. 


## Repository Overview

A collection of independent browser games and tools, each in its own directory. There is no monorepo build system — projects are self-contained. The main `index.html` is a portfolio hub hosted on GitHub Pages.

## Projects & Commands

### war_zone/ — 3D Tactical Shooter (Three.js)
No build step. Open `war_zone/war_zone.html` directly in a browser. Three.js is loaded from CDN. All game logic lives in `js/`.
Don't rely on console debug statements. The cursor is locked, so use alerts instead.

**Feature documentation:** `war_zone/FEATURES.md` is the authoritative reference for every game system (weapons, maps, modes, combat, progression, controls, rendering, etc.). **Update `war_zone/FEATURES.md` every time any war_zone feature is added, changed, or removed** — it must stay in sync with the code.

### tic-tac-toe-bot/ — Bot with Minimax AI (Vanilla JS + Jest)
```bash
npm install --prefix tic-tac-toe-bot   # first time only
npm test --prefix tic-tac-toe-bot       # run tests
npm test --prefix tic-tac-toe-bot -- --watch  # watch mode
```
Open `tic-tac-toe-bot/index.html` directly in a browser to play.

### dog_clicker/ — Flutter Game
```bash
cd dog_clicker
flutter pub get   # install deps
flutter run       # run on device/emulator
flutter build web
flutter test
```

### cosmicVentures/ — Browser Game / Chrome Extension
Open any `cosmic-ventures*.html` directly in a browser. For the Chrome extension variant (`cv-ext/`): load unpacked via `chrome://extensions` with Developer Mode enabled.

### auto_clicker_extension/ — Chrome Extension (MV3)
Load unpacked via `chrome://extensions` with Developer Mode enabled.

## Architecture

### war_zone — Modular JS Game Engine
Nine JS modules loaded in order via `<script>` tags in `war_zone.html`. No bundler.

| File | Responsibility |
|------|---------------|
| `main.js` | Game loop, screen management, state updates |
| `map.js` | Terrain generation (city, mountain, crater map types) |
| `entities.js` | Enemy/NPC spawning and AI |
| `weapons.js` | Weapon definitions, ammo, reload |
| `combat.js` | Hit detection, damage, knockback |
| `ui.js` | HUD rendering (health, ammo, money, kill stats) |
| `input.js` | Keyboard (WASD/shift/space) and mouse aim |
| `data.js` | Game config constants |
| `state.js` | Shared game state object |

Map types: city (grid roads/sidewalks), mountain (all-slope terrain), crater (pit terrain). Game modes: Zombie Apocalypse, Rescue Mission, PvP Arena. Weapons: Fists, Glock, Assault Rifle, Sniper, RPG, Minigun, and melee weapons.

Update tutorial every time a new important feature/concept is added.

### tic-tac-toe-bot — Logic/UI Separation
- `game.js`: Pure functions only — no DOM access. Contains minimax algorithm (`getBotMoveHard`) and random AI (`getBotMoveEasy`). Exports to `window` for testability.
- `ui.js`: IIFE managing all DOM interaction, event listeners, and game state (`playerSymbol`, `botSymbol`, `difficulty`, `cells`).
- Tests in `tests/` use Jest 29 with no DOM dependency.

### dog_clicker — Flutter Clean Architecture + BLoC
```
lib/
  core/        # shared utilities, service locator
  data/        # repositories, data sources
  domain/      # use cases, entity models
  presentation/ # BLoC state management, pages, widgets
  injection.dart # get_it dependency injection setup
```
Key dependencies: `flutter_bloc`, `get_it`, `dartz` (Either/Option), `equatable`.

### cosmicVentures/cv-ext — Chrome Extension (MV3)
Runs entirely in an 800×580px popup. `game.js` + `game.css` are self-contained with no external dependencies.

### auto_clicker_extension — Chrome Extension (MV3)
- `popup.html/js/css`: UI for keybind configuration
- `content.js`: Injected into pages to detect and click elements
- `background.js`: Service worker handling click automation timing

## Recent Features (war_zone)
- **Day/Night cycle**: 7.5-min cycle; references stored in `gameState.sunLight` / `gameState.ambientLightRef` set in `map.js`, updated in `animate()` in `main.js`
- **Chat system**: `` ` `` opens chat input (input.js); plain text → `#chat-bubble` div (5s); `` `admin `` → prompt for code (`zone`) → sets `cheatUnlocked=true`; `` `cheatName `` runs cheat if unlocked; input turns green (`cheat-mode` CSS class) when cheats are unlocked
- **Fly mode cheat**: type `` `fly `` in chat (after unlocking with `` `admin ``); `playerState.flyMode` flag; Space=up, Shift=down
- **Damage threshold**: `DAMAGE_THRESHOLD=10` in `data.js`; tracked via `playerData.weaponUsage` (incremented on game-over); repair $50
- **Owned armor**: `playerData.ownedArmor[]` tracks purchased armor separately from equipped slots; drag-drop in loadout
- **Debris collision**: `noStep:true` flag on debris obstacles skips step-over check in `checkCollision()`
- **Craters**: dirt-coloured materials + floor rocks + soil ring layers (map.js city section); craters only spawn on city blocks (not roads) — ShapeGeometry holes in city ground use `-pit.cz` (shape-Y maps to world -Z after rotateX(-PI/2))
- **SVG armor icons**: `getArmorSVG(type, name, small)` in ui.js generates inline SVG per tier
- **Armor prices**: heavy armor ×100 (millions), chainmail ×5, light ×3; heavy breastplate = $8,000,000
- **Fog**: daytime uses horizon haze (fog.near = mapSize*0.85, far = mapSize*1.35 with sky-blue color); night restores close dark fog
- **Sun arc**: `sunAngle = dn * 2PI - PI/2` so noon (dn=0.5, dayFactor=1.0) places sun overhead (+Y)
- **City ground**: ShapeGeometry with `rotateX(-PI/2)` uses `side: THREE.DoubleSide` to ensure visibility regardless of winding order
- **Fly mode**: cheat console closing calls resumeGameFn() to re-engage pointer lock; shift=down, space=up
- **Fortress map**: static map (size=250) in map.js `buildFortressMap(obs)`; outer walls at ±85 (h=12, reduced from 18) with 3 secret passage walls (E press to open 3s); inner keep walls (h=20) with 3-unit doorways N/S/E/W; cylindrical corner towers (outer r=9 h=20, inner keep r=3.5 h=26 mossy stone); battlements via `addMerlonsX`/`addMerlonsZ` helpers on all wall tops; arrow slits on keep exterior faces; wooden gate panel at south keep entrance; portcullis frame at outer south gate; `gameState.secretPassages[]` + `passThrough` flag skips player collision (main.js:58) but NOT zombie collision; torches = CylinderGeometry + SphereGeometry + PointLight(0xff8833); **wall walkways**: paved path slabs on outer wall tops (noCollide, decorative); **wall staircases**: `addStaircase(x0,z0,dir)` helper adds 24 stacked box steps (stepH=0.5, stepD=0.8, stairW=3.5) — one staircase per outer wall side (N at x=-55, S at x=55, E at z=50, W at z=-50); step-over logic (≤0.6 per step) lets player climb; top step at y=12 lets player step onto wall top
- **Chunk streaming (forest/mountain/desert)**: all three maps size=480, streamed via `updateForestChunks`/`updateMountainChunks`/`updateDesertChunks` (TERRAIN_LOAD_DIST=150, UNLOAD=240); chunk builders `_buildForestChunkMeshes`, `_buildMountainChunkMeshes`, `_buildDesertChunkMeshes` in map.js; called every 0.5s in animate() like city; mountain slopeMeshes added/removed from `gameState.slopeMeshes` on chunk load/unload
- **Weapon rebalance**: Glock buffed (damage 2→12, DPS now 34 vs fists 13); SMG added at $6,000 (damage=5 fireRate=0.08 DPS≈63); all melee/gun stats tuned for clear cost-to-power curve; sniper zoomedDamage 75→150; minigun DPS ≈160; RPG damage 100→150 radius 6→8
- **Map improvements**: desert chunks add sand dunes (tilted BoxGeometry, isSlope) + ruined outpost walls (30% per chunk); forest chunks add boulders (with optional moss cap) + mushroom clusters; mountain chunks add snow caps + drifts on formations h>22; maps have updated descriptions and tweaked colors/ambient light
- **Apex Zombie**: new enemy type in entities.js `spawnZombie(..., isApex)`; HP = `1000+(level-1)*200`, damage = `50+(level-1)*10`, speed = `min(moveSpeed*speedMult+2, 8+(level-1)*0.4)` (capped at player walk speed+2), dropMoney = `100+(level-1)*25`, XP = `300+(level-1)*50`; distinct look: bodySize 4.5, orange-gold skin (`0xcc5500`), yellow eyes, emissive fire-spike crown; kill feed "APEX ZOMBIE SLAIN!" in gold `#ffaa00`; zombie mode: requires level ≥3, chance = `min(0.15, (level-2)*0.02)`; rescue mode: 1 spawns at game start 18 units from player with `attracted=true`, `zombiesAlive` initialized before spawn
- **Cave map**: static enclosed map (size=200) in map.js `buildCaveMap(obs)`; `generateCaveLayout(rng)` returns pure data (caverns + MST tunnels); crystal clusters each get a `THREE.PointLight` (blue-green, range 20–30); ceiling slab has `noStep:true`; `gameState.zombieSpawnCavern` holds `{cx,cz,radius}` of the largest cavern; zombie spawns clamped to 130-unit streaming constraint; ambient audio in `gameState.caveAmbientNode` with graceful degradation if Web Audio unavailable

## Applied Learning
When something fails repeatedly or there is a workaround/easier way to do something, add a one-line bullet point less than 15 words mentioning it to save time in the future

  - Don't rely on console debug statements. The cursor is locked, so use alerts instead.
  - Zombie spawn distance must stay under TERRAIN_LOAD_DIST (150) or they spawn in empty unloaded chunks.