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

**Homepage layout:** The `#homepage` div uses a two-panel split layout (dark military style, near-black backgrounds). Left panel (`.home-left`, 280px): red accent bar, "WAR / ZONE" red-gradient title, player stats (Money, Level, Missions), and 5 utility buttons (Shop, Loadout, Tutorial, Keybinds, Achievements — class `.util-btn`). Right panel (`.home-right`, flex: 1): three game-mode rows (class `.mode-row`) for Zombie Apocalypse, Rescue Mission, PvP Arena — each with animated stripe, icon, name, description, and arrow; slides right and turns red on hover. The `.menu-btn` class is used only by the pause menu and round overlay, not the homepage.

**Loadout layout:** `#loadout-screen` uses a three-column fixed-height flex layout (`display:flex; flex-direction:column`). Structure: `.lo-header` (title + mode/slots/pts meta + back button, red border-bottom), `.lo-body` (flex row of three `.lo-col` divs). Columns: `.lo-col-weapons` (flex 1.2) — vertical list of `.lo-w-card` items, click to equip; `.lo-col-armor` (flex 1.1) — 2×2 `.lo-armor-slots` grid at top (drag-drop targets) + `.lo-a-inv-card` inventory list below (also click-to-equip fallback); `.lo-col-stats` (flex 1) — `.lo-pts-banner` + 7 `.lo-stat-row` items with +/− buttons. Theme: `#cc2200` red accents on `#0a0a0a` background (matches homepage/shop). Key IDs: `lo-meta-mode`, `lo-meta-slots`, `lo-meta-pts`, `lo-weapons-sub`, `lo-col-weapons-body`, `lo-col-armor-body`, `lo-col-stats-body`, `lo-stat-pts-val`.

**Shop layout:** `#shop-screen` uses the same dark military theme as the homepage (`display:flex; flex-direction:column`). Structure: `.shop-header` (title + balance), `.shop-tabs` (5 tab buttons with `data-tab` attribute — weapons/equipment/consumables/attachments/xp), `.shop-panels` (contains 5 `.shop-panel` divs, only `.active` one is visible), `.shop-footer` (back button). Tab switching via `window.shopTab(id, btn)` — tracks `_shopActiveTab` module var so the active tab is preserved when `showShop()` re-renders after a purchase. Consumables tab uses `.shop-grid-consumable` for amber accent colors (distinct from the red weapon theme). Equipment tab has no consumables — those are in their own Consumables tab via `renderConsumableShop()`. Key IDs preserved: `shop-money`, `weapon-shop`, `equipment-shop`, `consumable-shop`, `attachment-shop`, `xp-shop`.

**Map screen layout:** `#map-screen` uses the same dark military theme (`display:flex; flex-direction:column`). Structure: `.ms-header` (title "SELECT MAP" + `.ms-mode-badge` showing current mode + `.ms-back-btn` styled back button, red `::before` left bar); `.ms-body` (flex row): `.ms-list` (220px wide, `#ms-list` — scrollable list of `.ms-item` rows built by JS, each with `.ms-item-dot` + `.ms-item-info` (`.ms-item-name` + `.ms-item-size`) + `.ms-item-arrow`; `.ms-list-label` id `ms-list-label` shows map count); `.ms-preview` (flex:1 — `.ms-img-wrap` with full-bleed `.ms-img` + `.ms-img-overlay` gradient + `.ms-img-content` holding `#ms-preview-name`, `#ms-preview-desc`, `#ms-preview-tags`; `.ms-footer` with `#ms-deploy-btn` red button). Clicking a list item calls `selectMap()` in `renderMapScreen()` (ui.js) to update the preview; deploy button launches the game. Cave map has no image — `#ms-preview-img` gets `display:none`. Key IDs: `ms-mode-badge`, `ms-list`, `ms-list-label`, `ms-preview-img`, `ms-preview-name`, `ms-preview-desc`, `ms-preview-tags`, `ms-deploy-btn`.

### platformer/ — 2D Platformer (Vanilla JS + Canvas)
No build step. Open `platformer/platformer.html` directly in a browser. Uses ES modules (no bundler). Canvas renders at 800×500 internally.

**Key features:** Double jump (with particle burst), 10 stages × 50 levels (500 total, **segment-composed** from seeded RNG — see Level generation below), shop with **buyable weapons + 5 upgrades + 3 special attacks** (Jump Boost, Speed Boots, Coin Magnet, DJ Boost, Extra Lives), 10 animated stage themes, **hazards** (spikes), **dynamic platforms** (moving + crumbling), **enemies + combat** (attack/punch — see below), **player special attacks** (see below), **animated/interactive main menu** (see below).

**Player special attacks (`SPECIAL_DEFS` in state.js, logic in entities.js):** 7 one-time-purchase specials (2000–5500 coins); the player can own all 7 but only **5 are active at once** via the loadout system. Each has a per-level cooldown tracked in `player.specialCDs[key]` (reset to 0 on level start). **Loadout:** `playerData.equippedSpecials` (array of 5 special-key strings or null) maps the 5 fixed slots (Q/E/R/T/G) to specials. `getEquippedSpecials()` returns the array; `setEquippedSpecial(slotIdx, key)` assigns a special (removing it from any other slot). `SLOT_KEYS=['Q','E','R','T','G']` in state.js. The game loop in main.js iterates over the 5 equipped slots, not SPECIAL_DEFS directly. All bypass boss shields. `SPECIAL_DEFS`/`SPECIAL_MAP`/`ownsSpecial`/`buySpecial`/`getEquippedSpecials`/`setEquippedSpecial`/`SLOT_KEYS` live in state.js. HUD strip `#hud-specials` (bottom of canvas, `.special-pill`) shows the 5 equipped slots with slot-key labels — managed by `updateSpecialsHUD(specialCDs)` in ui.js. Shop has a "⚡ Special Attacks" section with a loadout panel (`.loadout-section` with 5 `.loadout-slot` cards + `.loadout-pool` of owned specials; click slot to select, click special to assign) plus buy cards for unowned specials. The 7 specials: **Heal Surge** (💊, 2000, 40s) — restores 45 HP; **Mega Bomb** (💣, 3500, 25s) — physics bomb 250px blast, 70 dmg; **Nova Strike** (🌀, 5000, 30s) — screen-wide 35 dmg; **Shield Surge** (🛡️, 2500, 35s) — 3.5s invuln + bubble visual; **Chain Lightning** (⚡, 4000, 20s) — 60/35/20/10 chain to 4 enemies; **Time Stop** (⏱️, 5500, 50s) — freezes enemies 3s (boss 1.5s), ice tint; **Quake Slam** (🌋, 3000, 28s) — shockwave 45 dmg (90 vs boss), launches player. `playerBombs[]` in entities.js for Mega Bomb physics. `unlockEverything()` auto-fills equippedSpecials with first 5 specials.

**Main menu effects (`ui.js` `setupMenuEffects`):** The `#main-menu` has a full-screen `<canvas id="menu-fx">` particle system (drifting motes, mouse-trail sparkles, confetti/emoji bursts via `burst()`), orbiting emoji ring (`.menu-orbit`), animated gradient/float title, and `--menu-hue` hue-rotate filter. A `.toy-box` row of interactive widgets: 🎲 dice (random face + emoji burst), 🎨 palette (random hue + toggle rainbow particles), 🎆 spark (confetti), 🐸 boop (cycles faces), 🪩 disco (toggles `.disco` strobe class). There is also an intentionally undocumented easter egg reachable through one of the toys (`luckyRun` in ui.js); it is deliberately camouflaged in the source (neutral names, encoded strings, no comments) so players inspecting the page can't easily find it — **do not add comments, rename it descriptively, or document the trigger here.** Visual feedback in the toys is throttled (≈70ms) and `burst()` is capped at `MAX_PARTICLES=140`, so rapid clicking never lags.

**File layout:**
```
platformer/
  platformer.html           Entry point; all screen divs + canvas
  platformer.css            UI styling (dark theme, gold/orange accent)
  js/
    main.js                 Game loop (requestAnimationFrame), level lifecycle
    state.js                playerData (coins, upgrades, progress) — localStorage
    input.js                Keyboard state, jump buffer, coyote time support
    player.js               Physics, double-jump, 5-state animation machine, canvas drawing
    level.js                Seeded segment-composition generator (mulberry32 RNG), hazards, dynamic platforms, resolveX/resolveY
    entities.js             Coins, exit door, particles, enemies (AI + combat), projectiles
    renderer.js             10 stage themes with parallax backgrounds
    ui.js                   Screen management, HUD, shop, level-complete, stage-complete
```

**Camera (`updateCamera` in main.js):** `camX` follows the player horizontally (smoothed, clamped to `[0, levelWidth-GW]`). `camY` follows vertically but is **anchored at 0 during normal play** (floor at the bottom) and only goes negative — scrolling up to reveal sky — when the player rises above `TOP_DEADZONE=150` px from the screen top (e.g. low-gravity Space, springy jumps). A hard clamp `camY = min(camY, player.y - 8)` guarantees the player can never cross the top edge even on a fast rise. `renderFrame` translates the world by `(-camX, -camY)`; the screen-space cave vignette and background account for `camY`.

**Physics constants:** `GRAVITY=1850`, `JUMP=555`, `DJ=495`, `SPEED=280 px/s`. `COYOTE_TIME=0.1s`, `JUMP_BUFFER=0.085s`. Max double-jump reach (base stats) ≈ 271px horizontal / 149px vertical — `level.js` keeps every required leap inside this envelope (validated: 0 unreachable jumps across all 500 levels).

**Dash & slide (`player.js`):** Two built-in movement abilities. **Dash** — press Shift (any side); locks `vx = DASH_SPEED (620 px/s)` for `DASH_DUR (0.18s)`, grants 0.18s of i-frames, briefly dampens falling vy. Cooldown `DASH_CD=1.6s`. Available in air or on ground. 3 fading afterimage ghost copies drawn behind the player while active. **Slide** — hold Down/S while running (vx > 60) on the ground with cooldown ready; shrinks player.h from `PLAYER_H=42` to `SLIDE_H=20` (player.y adjusted +22 to keep feet planted), sets `vx = facing * speed * 1.55`, decelerates via `vx *= 0.97` each frame. Duration `SLIDE_DUR=0.45s`, cooldown `SLIDE_CD=0.7s`. Slide ends early if player leaves the ground. Jumping while sliding calls `endSlide()` to restore height before applying jump force. `drawPlayer` draws at `PLAYER_H` even while sliding (squashed sx=1.45 sy=0.48 with 0.32 rad forward lean); during dash, sx=1.18 sy=0.88 with the afterimage trail. Particle effects: `addDashParticles` (yellow trail), `addSlideParticles` (dust kick) in entities.js. Two dedicated level segments use these: `segDashGap` (gap 278–330px — wider than max double-jump, dense coin arc shows the trajectory) and `segLowCrawl` (ground run with 'down' ceiling spikes at `GROUND_Y-45=385`: standing inset top 391 < spike bottom 399 → kill, sliding inset top 413 > 399 → clear). Both added to TERRAIN_POOL and SEGMENTS (tier 1, gate 0.03) so they appear across all 10 stages from stage 1 level 15 onward.

**Per-stage level character (`STAGE_PROFILES[]` in level.js, `getProfile(stageIdx)`):** each biome plays differently, not just recolored. Fields: `grounded` (lay a continuous full-width `ground` strip via `mkGround(0,width)` after width/exit are fixed, so a missed jump lands on terrain instead of a death-void — added for stages 0 Meadow, 1 Cave, 3 Desert, 6 Forest); `low` (keep platforms within `FLOOR-175` of the ground as rolling terrain — clamp applied in `connect` via `b.low`); `pool` (array of segment `id`s allowed — terrain stages use `TERRAIN_POOL` = hills/spikes/gauntlet and are denied the floating `movingBridge`/`elevator`/`crumble`; floating stages have `pool:null` = all, gated by progress); `flyerFreq` (how common the stage's air species are: cave bats `1.7`, sky birds `1.9`, space drones `1.7`). `pickSegment(b,e,last,prof)` filters by `prof.pool`; `buildLevel(rng,p,stageIdx)` sets `b.low`; `placeEnemies(...,stageIdx)` scatters several foes along a wide ground (one per ~360px), places hang species above walkways, and places air species over gaps (gap tolerance `200/flyerFreq`, gate `p≥0.04`). Spikes are recolored per stage via `STAGE_THEMES[].spikeColor` (cave stone, desert cactus-green, ice icicle-blue, lava molten, crystal cyan, …), used in `drawHazards`.
**Level generation (`level.js`):** Levels are NOT a single random walk — they are **composed from curated segments** (set pieces), giving a deliberate, hand-built feel. `buildLevel()` walks a cursor `{x, y}` left→right and appends segments via `connect()` (which auto-arcs guide-coins over each jump and clamps required rise to `MAX_RISE=95`). Arc: warm-up `segRest` → escalating segments paced with periodic breathers → a forced hard climax → `segFinish` (hosts the exit). Segment table `SEGMENTS[]` has `{fn, tier (0/1/2), gate}`; `pickSegment()` chooses by effective difficulty `e` (blends global `progress` + local position in the level) and `gate` (mechanic unlock thresholds: spikes ≥0.03, moving ≥0.06, ceiling-spike gauntlet ≥0.10, crumble ≥0.16, spike-leap ≥0.20). **Levels are 5× longer:** the full-curve length is `baseW = lerp(5500, 24000, progress)` (old was 1100→4800). **Opening on-ramp:** the first ~15 levels (start of Meadow) ease in via `introT = clamp(idx/15, 0, 1)` (idx = global level index): `targetW = lerp(1800, baseW, introT)` (much shorter early), effective difficulty is held down (`e *= 0.5 + 0.5*introT` → easy-tier segments), and the forced hard climax is eased (`climaxE *= 0.35 + 0.65*introT`) and **skipped entirely while `introT < 0.2`** (levels 1–3, so they stay ~2000px / 8 platforms and end gently). Result: L1–3 ≈ short & flat, enemies first appear ~L7 (`p≥0.012`), spikes ~L16 (gate 0.03), full curve by ~L16. Segment generators: `segRest, segGapRun, segStairsUp/Down, segPillars, segZigzag, segLongLeap, segDescentDrop, segSpikePath` (ground run w/ spike clusters), `segMovingBridge` (horizontal mover over void), `segElevator` (vertical lift), `segGauntlet` (ceiling spikes — single jump clears, double jump skewers), `segCrumbleRun, segSpikeLeap, segCoinVault` (reward set piece), `segLowCrawl` (ground run requiring slide under ceiling spikes), `segDashGap` (wide gap requiring dash+jump), `segFinish`.
**Level gen seed:** `stageIdx * 50 + levelIdx + 1` (0-indexed params). Difficulty scales via `progress = (stageIdx*50+levelIdx)/499`.
**Platform types:** `normal`, `ground` (continuous walkway), `move` (oscillates; `p.move = {axis:'x'|'y', baseX, baseY, max, speed, phase}`), `crumble` (falls `CRUMBLE_DELAY=0.42s` after landing, regenerates after `CRUMBLE_REGEN=2.8s`). `resetDynamics(levelData)` resets all dynamic platforms (called on level start AND respawn); `updateDynamics(dt, levelData)` runs each frame **before** `updatePlayer` (stores per-frame `_dx/_dy` for player carry, ticks crumble timers).
**Hazards:** `levelData.hazards[]` of `{x, y, w, h, dir:'up'|'down'}` spike triangles. `hazardHit(player, hazards)` (inset hitbox, forgiving) → instant death (same path as falling off). `drawHazards()` renders them. `'up'` sits on a surface (jump over), `'down'` hangs from a ceiling (don't jump into).
**Collision:** Separate x-then-y passes (`resolveX` → `resolveY`). `resolveY` uses `player.y + player.h >= platTop` (not strict >) so `vy=0` still detects grounded; it sets `player._groundPlat` (the landed platform) and triggers crumble. Both passes skip platforms with `_crumbleState===2` (crumbled away). Moving-platform carry: `updatePlayer` applies `_groundPlat._dx/_dy` to the player when grounded on a `move` platform.
**Enemies & combat (`entities.js`):** `levelData.enemies[]` (built by `placeEnemies()` in level.js) is cloned into a live `enemies[]` by `initEntities` (so respawn resets them). **Every stage fields its own bespoke species with different BEHAVIOR, not reskins** — `SPECIES{}` + `STAGE_ROSTER[]` in level.js define per-stage ground/air/hang species (stats scale with `p`, each has `dmg`, `color` for particles, `air` flag = no knockback clamp); `updateEnemies` in entities.js implements the behavior archetypes and `drawEnemies` has bespoke per-species art (`SPECIES_DRAW{}`, pre-flipped so +x = facing). **Behaviors:** `walk` (patrol), `hop` (**free-roaming**: real gravity + lands on any platform, hops toward the player within 320×240px aggro, patrols home when idle, dies in pits >600y; knockback unclamped), `fly` (**pursues the player within 300px** at `chase` px/s, else hovers near home), `swoop` (perch → dive at player → glide back), `float` (slow homing within 340px, else drifts home), `orbit` (circles an anchor; **the anchor itself stalks the player at 28px/s within 320px**), `charge` (patrol → telegraph 0.32s → dash at chargeSpeed), `drop` (hangs; falls when player passes beneath; shatters on platform impact), `spider` (descends a silk thread when player is below, lingers, climbs back), `shoot` (turret: tracks player, fires `enemyShots[]` bolts every fireEvery within range; bolts die on platforms, sting the player via the same i-frame/knockback path), `boss` (arena boss: walks toward player, leaps at them every `leapEvery`s with `leapForce`, clamped to the arena).
**Bosses (every 10th level):** `idx % 10 === 9` levels (10/20/30/40/50 per stage) are compact boss levels — `buildLevel` builds a short approach then a **1150px arena platform** (`b.arena`), `generateLevel` clears regular foes off the arena and pushes `makeBoss(stageIdx, p, arena)` (level.js). The boss is the stage's signature species at `bossScale=3` (`BOSS_SPECIES`: slime/crawler/slider/scorpion/lavablob/bird/shroom/drone/golem/knight), hp `24 + p*36`, dmg ≥14; sky/space bosses (`bird`/`drone`) use buffed `swoop` from a perch above the arena, the rest use `boss` leap-chase. **The exit stays locked while the boss lives**: `isBossAlive()` (entities.js) gates `checkExit()` in main.js, and `drawExitDoor` renders a grey padlocked door labeled "DEFEAT THE BOSS". Bosses render via their species art scaled ×3 (`ctx.scale(bossScale)` + proxied w/h) with a red aura and a chunky HP bar; killing one fires `addExplosion` bursts. **Rosters:** 0 Meadow slime+bee · 1 Cave crawler+bat · 2 Icy slider+icicle(hang) · 3 Desert scorpion+vulture · 4 Lava lavablob+ember · 5 Sky bird+puff (air-only) · 6 Forest shroom+spider(hang) · 7 Space turret+drone · 8 Crystal golem+shard · 9 Fortress knight+wraith. Density + HP scale with `progress`; the start area (x<320) and exit platform stay enemy-free, and the very first level (p<0.012) has none. `enemyShots` is reset in `initEntities` and drawn at the end of `drawEnemies`. **Boss special attacks:** each boss has a unique `triggerBossSpecial` (entities.js) fired on a per-species `_baseCD` timer (`SP_CD` table in level.js `makeBoss`): slime=triple arcing green blob, crawler=shockwave (2 side shots + lobbed rock), slider=ice dash at 600px/s across arena (`_sliding` flag in boss behavior block), scorpion=5-way venom fan aimed at player, lavablob=6-way radial magma slam + explosion, bird=3 feather darts aimed at player, shroom=large arcing spore bomb, drone=5-beam laser spread downward, golem=8-way crystal burst, knight=3 blade slashes + lunging leap. Boss shots are tagged `{boss:true, r, color, vy, grav}` — `enemyShots` update now supports `vy`/`grav` for arcing trajectories; collision uses circle check for boss shots. **Rage phase at 50% HP:** sets `e._rage=true`, speed ×1.4, `leapEvery` ×0.7, `swoopSpeed` ×1.3, `_specialCD *= 0.65`; aura turns orange with pulsing ring; HP bar turns orange and shows "ENRAGED" label; a 50%-threshold marker always visible on the HP bar. Yellow `_atkFlash` overlay on the boss when a special fires. **Player health:** the player has a HP bar (`player.hp`/`player.maxHp=100`, set in player.js, reset to full on level start AND respawn). **Side contact with an enemy drains HP** (per-species `dmg`, 4–12 — bee 4 up to golem/knight 12; `CONTACT_DAMAGE` in entities.js is only a legacy fallback) rather than instakilling, then grants `INVULN_TIME=0.9s` of i-frames (`player.invuln`) + knockback + a red `player.hurtFlash`; during i-frames the player blinks (alpha) and takes no further contact damage. **When HP hits 0 the player dies** (`updateEnemies` returns `playerHit:true` only then). Contact deals **no** damage at all if the player is **mid-attack and facing that enemy** (guard: `(player.attackCD>0 || player.swingT>0)` and the enemy's center is on the side the player faces) — so you can fight foes up close with weapons. **Falling off the bottom and touching a spike (`hazardHit`) remain instant death** regardless of HP. **Stomping** (landing on an enemy from above) is safe, deals `STOMP_DAMAGE=2`, and bounces the player. HUD shows HP via `#hud-hp-bar`/`#hud-hp-fill`/`#hud-hp-text` (green→amber→red); `updateHUD(...)` takes `hp, maxHp` and `main.js` refreshes it whenever `player.hp` changes. `updateEnemies(dt, platforms, player)` returns `{playerHit}`.
  - **Weapons** (`WEAPON_DEFS`/`WEAPON_MAP` in state.js): `fists` (free, owned by default), `sword`, `hammer` (melee: `damage`/`reach`/`cooldown`/`knockback`), `blaster`, `launcher` (ranged: `speed`/`splash`). Owned set in `playerData.weapons`, equipped in `playerData.equippedWeapon`; `ownsWeapon/buyWeapon/equipWeapon/getEquippedWeapon`. Buying auto-equips. Sold in the shop's **Weapons** section (`renderShop` in ui.js), shown in HUD (`#hud-weapon`).
  - **Attacking:** `isAttack()` in input.js (J/X/K/F/Enter **or** left mouse, held + cooldown-gated). `main.js` game loop, when `player.attackCD<=0`: melee → `playerMeleeAttack(player, weapon)` (instant hitbox in front, returns kills); ranged → `spawnProjectile(player, weapon)` (`updateProjectiles` moves them, `detonate` applies direct or `splash` damage). Attack resolves **before** enemy contact so a kill that frame prevents death. `player.attackCD`/`swingT`/`weapon` live on the player; the swing/weapon is drawn by `drawWeaponSwing` in player.js.
**Stage themes:** index 0–9 in `STAGE_THEMES[]` in renderer.js (Meadow, Cave, Icy Peaks, Desert, Lava, Sky, Forest, Space, Crystal, Dark Fortress).
**Per-stage gameplay twists (`STAGE_MODIFIERS[]` in player.js):** each stage applies a physics/visual modifier, selected via `setStageModifier(stageIdx)` (called in `startLevel` AND `respawnPlayer` in main.js, before `initPlayer`); `getStageModifier()` exposes the active one. Fields: `gMul` (gravity ×), `jMul` (jump/double-jump force ×, applied in `initPlayer`), `fric` (idle horizontal damping per frame — base 0.72; higher = slippery, lower = grippy), `wind` (oscillating sideways gust accel px/s², added to `vx` in `updatePlayer`), `dark` (1 = limited-visibility vignette drawn around the player in `renderFrame`). The twists: 0 Meadow 🌱 springy (jMul 1.12), 1 Cave 🕯️ pitch dark (vignette), 2 Icy Peaks ❄️ slippery (fric 0.965), 3 Desert 🌬️ gusts (wind 1300), 4 Lava 🔥 scorching (gMul+jMul 1.25 = heavy/snappy), 5 Sky ☁️ updrafts (gMul 0.6 floaty), 6 Forest 🍄 mossy grip (fric 0.42), 7 Space 🚀 zero-g (gMul 0.32), 8 Crystal 💎 bouncy (jMul 1.24), 9 Dark Fortress 🏰 heavy gravity (gMul+jMul 1.45). **Reachability is preserved:** heavy stages scale gMul and jMul *together* (vertical reach ↑, horizontal unchanged) and floaty stages lower gMul alone (reach ↑), so all 500 validated levels stay solvable. `updatePlayer` uses `grav = GRAVITY*gMul` and `term = TERMINAL_VEL*max(0.45,gMul)`. The active twist's label shows in the HUD (`#hud-modifier`).
**HUD:** the old lives "hearts" panel (`#hud-lives`) was removed — lives had no gameplay effect (death always respawns at level start regardless), so the display was dropped. The HUD now shows stage+twist, coins, HP bar, and equipped weapon.

### attractor/ — DOT-Based AI Pipeline Orchestration (Node.js ESM)
No build step. Run pipelines with `node attractor/attractor.js <pipeline.dot>`.

**Three spec layers implemented:**
1. **Unified LLM Client** (`src/llm/`) — provider-agnostic wrapper for Anthropic, OpenAI, and Gemini. Auto-initializes from env vars (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`). Middleware support, exponential-backoff retry, streaming.
2. **Coding Agent Loop** (`src/agent/`) — `Session` class with agentic loop: tool execution (concurrent), character-first output truncation, event system, steering injection, loop detection, subagent spawning.
3. **Pipeline Engine** (`src/pipeline/`) — DOT language pipelines with 6 phases (Parse→Transform→Validate→Initialize→Execute→Finalize), 7 node handler types, 5-level edge selection, goal gates, per-node retry with exponential backoff, checkpoint/resume, human-in-the-loop via `CLIInterviewer`.

**File layout:**
```
attractor/
  attractor.js              CLI entry point
  src/
    index.js                re-exports everything
    llm/
      catalog.js            MODELS map with capabilities + pricing
      client.js             LLMClient (router + middleware + retry)
      providers/
        anthropic.js        Anthropic native API adapter (prompt caching)
        openai.js           OpenAI native API adapter
        gemini.js           Gemini native API adapter
    agent/
      session.js            Session (the coding agent loop)
      events.js             Event types + EventEmitter
      truncation.js         Character-first + line-based truncation
      execution-env.js      LocalExecutionEnvironment (file/shell/glob/grep)
      tools/
        core.js             read_file, write_file, shell, glob, grep, list_dir
        profiles.js         Provider profiles: anthropic (edit_file), openai (apply_patch), gemini (search_and_replace)
    pipeline/
      engine.js             PipelineEngine (6-phase orchestrator)
      dot-parser.js         Recursive-descent DOT parser
      validator.js          Pipeline linter (errors + warnings)
      context.js            PipelineContext (key-value + JS expression eval)
      checkpoint.js         CheckpointManager (JSON file save/resume)
      handlers.js           HANDLERS: start, exit, codergen, wait.human, condition, tool, parallel, manager
      interviewer.js        CLIInterviewer + NoopInterviewer
  examples/
    hello.dot               Human-in-the-loop review pattern
    coding-task.dot         Analyze → propose → approve → implement pipeline
    platformer/
      analyze.dot           Read all platformer JS modules → review → write ARCHITECTURE.md
      level-review.dot      Analyze a specific archetype's balance/physics (--var archetype=standard)
      add-enemy.dot         Design + implement a new enemy type (--var enemy_type=patrol_slime)
      balance.dot           Audit upgrade costs and progression curve
  tests/
    dot-parser.test.js      29 tests for the DOT tokenizer/parser
    validator.test.js       18 tests for pipeline linting rules
    context.test.js         31 tests for PipelineContext (get/set/evaluate/snapshot)
    checkpoint.test.js      10 tests for CheckpointManager (save/load/clear)
    interviewer.test.js     9 tests for NoopInterviewer + CLIInterviewer
    handlers.test.js        22 tests for all HANDLERS (start/exit/condition/wait.human/codergen/manager)
    engine.test.js          25 tests for PipelineEngine (routing, edge selection, retries, checkpoints)
```

**Node handlers:** `start` / `exit` (no-op), `codergen` (spawns Session with prompt), `wait.human` (CLI approval gate), `condition` (evaluates JS expression against context), `tool` (runs a profile tool directly), `parallel` (fan-out marker), `manager` (supervision loop).

**Edge selection priority:** condition match → preferred label → suggestedNext from handler → highest weight → lexical order.

**Context variables set by handlers:** `{nodeId}_status`, `{nodeId}_output`, `{nodeId}_approved`, `{nodeId}_answer`, `{nodeId}_error`.

**Testing:** Uses Node.js built-in `node:test` (no extra deps, ESM-native). 144 tests, 0 failures.
- `codergen` catches session errors internally → returns FAILURE status (engine does NOT retry it)
- `tool` handler throws on missing tool → engine retry loop fires; use for testing retry logic
- Multiple `handler="exit"` nodes fail validation — branch tests use codergen nodes sharing one exit

```bash
cd attractor && npm install   # first time only
npm test                      # run all 144 tests
node attractor.js examples/hello.dot
node attractor.js examples/platformer/analyze.dot
node attractor.js examples/platformer/level-review.dot --var archetype=zigzag
node attractor.js examples/platformer/add-enemy.dot --var enemy_type=bouncer
node attractor.js examples/platformer/balance.dot
node attractor.js examples/coding-task.dot --var target=src/ --checkpoint --debug
```

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
| `input.js` | Keyboard/mouse input; normalizes keybinds to engine keys |
| `data.js` | Game config constants; `DEFAULT_KEYBINDS`, `keybinds`, `saveKeybinds` |
| `state.js` | Shared game state object |

Map types: city (grid roads/sidewalks), mountain (all-slope terrain), crater (pit terrain). Game modes: Zombie Apocalypse, Rescue Mission, PvP Arena. Weapons: Fists, Glock, Assault Rifle, Sniper, RPG, Minigun, and melee weapons. Utility items (no damage): Compass (needle points to hostage/extraction zone), Flashlight (SpotLight beam, spawns as world pickup near player each match).

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
- **Achievements system**: 20 achievements in `js/achievements.js` (leaf module — imports only state.js/data.js); stats tracked in `playerData` (`totalZombieKills`, `bestRescueTime`, `totalRescueCompletions`, `totalPvpWins`, `bestZombieSession`, `totalDamageDealt`, `totalHeadshotKills`, `flawlessRuns`, `totalAirstrikes`, `totalExplosiveKills`, `apexKills`, `gigaKills`, `totalMedkitsUsed`); `gameState.missionStartTime`/`tookDamageThisGame` reset in `startGame()`; toast notification in HUD top-right; overlay via `#achievements-overlay`; homepage "Achievements" button calls `window._openAchievements`; `PURCHASABLE_WEAPONS` filtered by `cost > 0`
- **Weapon graphics overhaul** (weapons.js): All weapons upgraded — Glock: separate slide + serrations + sights + trigger guard + under-rail; Revolver: enhanced cylinder with 6 chamber holes + barrel rib + ejector rod + wood grips; Shotgun: wood stock + pump ridges + tube magazine + bead sight; AR: handguard + gas tube + front sight tower + charging handle; Crossbow: prod limb + string + bolt track + stirrup; RPG: 4 stabilizing fins on warhead; Chainsaw: T-bar front handle + fuel cap + tip sprocket; Katana: bo-hi groove + habaki collar + kashira pommel cap + improved ito wrap; Longsword: ricasso section + grip wraps + disc pommel; Axe: eye-socket ring + poll back-spike + grain lines; Shield: rim border + cross emblem + corner rivets; Knife: grip wraps + spine ridge + pommel + wider guard; Grenade: segmented ridges + lever + pin ring; Molotov: bottle shape with neck + rag; SMG config added to GUN_CONFIGS
- **Day/Night cycle**: 7.5-min cycle; references stored in `gameState.sunLight` / `gameState.ambientLightRef` set in `map.js`, updated in `animate()` in `main.js`
- **Chat system**: `` ` `` opens chat input (input.js); plain text → `#chat-bubble` div (5s); `` `admin `` → prompt for code (`zone`) → sets `cheatUnlocked=true`; `` `cheatName `` runs cheat if unlocked; input turns green (`cheat-mode` CSS class) when cheats are unlocked
- **Fly mode cheat**: type `` `fly `` in chat (after unlocking with `` `admin ``); `playerState.flyMode` flag; Space=up, Shift=down
- **Night vision cheat**: type `` `nightvision `` in chat; `playerState.nightVision` flag; applies green CSS filter to canvas (`saturate(0) sepia(1) hue-rotate(90deg) saturate(3) brightness(1.8)`), dark vignette `#nv-overlay` div, and forces `ambientLightRef.intensity ≥ 4.0` + green color in main.js day/night block
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
- **Fortress map**: static map (size=250) in map.js `buildFortressMap(obs)`; outer walls at ±85 (h=6) with 3 original secret passages (N x=35, E z=10, W z=-35) + **4 underground tunnels** (N x=0, S x=55, E z=0, W z=0) — each splits the wall with upper arch (y=3–6) + passage block (y=0–3), leads to underground network; **underground network**: `gameState.undergroundZones[]` (rectangular `{minX,maxX,minZ,maxZ,depth}`) drives `getFloorHeight` below y=0; central chamber at x=-6 to x=6, z=-6 to z=6 (floor y=-8) with 4 columns, PointLight, torches; N/E/W corridors 6-wide connect chamber to wall tunnels, each with 16-step descending staircase; S corridor (x=52–58) T-junctions into east corridor; **2 secret wall corridors** (Corridor A: N wall interior x=-75–-15; Corridor B: E wall interior z=-75–-20) each with 2 passage doors, end caps, noCollide roof, torches; inner keep walls (h=10) with S doorway only; `addPassage(x,y,z,w,h,d,label)` stores label; prompt shows `Press [E] to open ${label}`; `gameState.secretPassages[]` + `passThrough` skips collision; **wall staircases**: `addStaircase(x0,z0,dir)` helper — 12 steps × 0.5h, one per wall side
- **Chunk streaming (forest/mountain/desert)**: all three maps size=480, streamed via `updateForestChunks`/`updateMountainChunks`/`updateDesertChunks` (TERRAIN_LOAD_DIST=150, UNLOAD=240); chunk builders `_buildForestChunkMeshes`, `_buildMountainChunkMeshes`, `_buildDesertChunkMeshes` in map.js; called every 0.5s in animate() like city; mountain slopeMeshes added/removed from `gameState.slopeMeshes` on chunk load/unload
- **Weapon rebalance**: Glock buffed (damage 2→12, DPS now 34 vs fists 13); SMG added at $6,000 (damage=5 fireRate=0.08 DPS≈63); all melee/gun stats tuned for clear cost-to-power curve; sniper zoomedDamage 75→150; minigun DPS ≈160; RPG damage 100→150 radius 6→8
- **Map improvements**: desert chunks add sand dunes (tilted BoxGeometry, isSlope) + ruined outpost walls (30% per chunk); forest chunks add boulders (with optional moss cap) + mushroom clusters; mountain chunks add snow caps + drifts on formations h>22; maps have updated descriptions and tweaked colors/ambient light
- **Apex Zombie**: new enemy type in entities.js `spawnZombie(..., isApex)`; HP = `1000+(level-1)*200`, damage = `50+(level-1)*10`, speed = `min(moveSpeed*speedMult+2, 8+(level-1)*0.4)` (capped at player walk speed+2), dropMoney = `100+(level-1)*25`, XP = `300+(level-1)*50`; distinct look: bodySize 4.5, orange-gold skin (`0xcc5500`), yellow eyes, emissive fire-spike crown; kill feed "APEX ZOMBIE SLAIN!" in gold `#ffaa00`; zombie mode: requires level ≥3 and kills ≥35, chance = `min(0.05, (level-2)*0.005)`; rescue mode: 1 spawns at game start 18 units from player with `attracted=true`, `zombiesAlive` initialized before spawn
- **Cave map**: static enclosed map (size=200) in map.js `buildCaveMap(obs)`; `generateCaveLayout(rng)` returns pure data (caverns + MST tunnels); crystal clusters each get a `THREE.PointLight` (blue-green, range 20–30); ceiling slab has `noStep:true`; `gameState.zombieSpawnCavern` holds `{cx,cz,radius}` of the largest cavern; zombie spawns clamped to 130-unit streaming constraint; ambient audio in `gameState.caveAmbientNode` with graceful degradation if Web Audio unavailable
- **Keybinds menu**: `DEFAULT_KEYBINDS` + `keybinds` (localStorage-persisted) + `saveKeybinds` in data.js; input.js normalizes any bound key to engine keys (keys.w/s/a/d/shift/space) + replaces all hardcoded action checks with `keybinds.*`; `window._keybindsMenuOpen` flag blocks game input while rebinding; `#keybinds-overlay` in war_zone.html; `setupKeybindsMenu`/`openKeybindsMenu`/`closeKeybindsMenu` in ui.js; "Keybinds" button on homepage + pause menu; Escape cancels capture, Reset Defaults restores all keys
- **Hive-mind squad system**: `gameState.hiveMind = { squads: [], _nextSquadId: 0 }` in state.js; boss zombies auto-create squads (up to 10 members) via `assignSquad()`; Giga commands 5 squads, Apex commands 10 squads via `assignCommander()`; `updateSquads()` runs each frame from `updateZombies()` — handles alarm propagation (any member spotted → whole squad activates), state machine (`assembling→approaching→executing`), role-based movement overrides (`_squadMoveAngle`, `_holdPosition`), leader promotion on death, 1-member squad merging; roles: leader/flanker_l/flanker_r/charger/support; squad names (random adjective+noun) shown as floating orange `THREE.Sprite` label above HP bar on every member (`addSquadNameSprite()`); execute pulse: orange emissive flash (0.5s); commander broadcast pulse: 3× emissive (1s); Apex/Giga spawn rates unchanged
- **Flashlight**: free utility item; spawns as world pickup (cylinder mesh, emissive glow) near player each match; `gameState.playerFlashlight` = SpotLight (intensity 18, range 120, angle PI/7) attached to camera; active only when flashlight is equipped; in 3rd-person repositions to shine forward from player body; pushes scene fog far (mapSize×6) while equipped
- **Compass**: free utility item always in player's starting inventory; 3D model with animated needle; needle points to `gameState.hostage.mesh.position` (if alive, Rescue Mission) else `gameState.extractionZone`; works in both 1st and 3rd person
- **Hallway map**: `buildHallwayMap(obs)` in map.js; size=200; single corridor 8 wide × 10 tall × 380 long along Z axis; ceiling light strips every 20 units + wall torches near zombie end; 6 crate cover positions; player spawns at `gameState.hallwayPlayerSpawnZ` (+187), zombies at `gameState.hallwayZombieSpawnZ` (−187)

## Applied Learning
When something fails repeatedly or there is a workaround/easier way to do something, add a one-line bullet point less than 15 words mentioning it to save time in the future

  - Don't rely on console debug statements. The cursor is locked, so use alerts instead.
  - Zombie spawn distance must stay under TERRAIN_LOAD_DIST (150) or they spawn in empty unloaded chunks.