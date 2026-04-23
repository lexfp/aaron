# Achievements System — Design Spec
**Date:** 2026-04-23  
**Project:** war_zone (3D Tactical Shooter)

---

## Overview

Add a persistent achievements system to war_zone. Players unlock achievements by meeting in-game milestones (kill counts, rescue times, wave survival, etc.). Each achievement deposits a money reward immediately on unlock. A new "Achievements" button on the homepage opens an overlay showing all achievements, their progress, and unlock status.

---

## Stats Tracking

### New fields added to `defaultPlayerData()` in `state.js`

```js
achievements: {},            // { achievementId: true } — set of unlocked IDs
totalZombieKills: 0,         // lifetime kills across zombie + rescue modes
bestRescueTime: null,        // fastest rescue completion in seconds (float), null = never
totalRescueCompletions: 0,   // successful extraction count
totalPvpWins: 0,             // PvP wins (3-round set wins)
highestWave: 0,              // highest wave reached in zombie mode
totalMoneyEarned: 0,         // cumulative money from kills + mission rewards
totalDamageDealt: 0,         // total damage dealt to enemies
totalHeadshotKills: 0,       // headshot-kill count
flawlessRuns: 0,             // missions won without taking any damage
totalAirstrikes: 0,          // airstrikes called
totalExplosiveKills: 0,      // kills via RPG or grenade
apexKills: 0,                // apex zombie kills
gigaKills: 0,                // giga zombie kills
totalMedkitsUsed: 0,         // med kits consumed
```

### New fields added to `gameState` in `state.js`

```js
missionStartTime: null,       // performance.now() at startGame() — used for rescue timer
tookDamageThisGame: false,    // set true by damagePlayer(); reset at startGame()
```

---

## Achievement Definitions

All 20 achievements live in `js/achievements.js` as the `ACHIEVEMENTS` array. Each entry has: `id`, `name`, `desc`, `reward` (money), `check(pd)` → bool, `progress(pd)` → `{current, max}` (numeric milestones only; undefined for binary checks).

### Kill Achievements
| ID | Name | Description | Reward | Condition |
|---|---|---|---|---|
| `first_blood` | First Blood | Kill your first zombie | $500 | totalZombieKills ≥ 1 |
| `zombie_slayer` | Zombie Slayer | Kill 50 zombies | $5,000 | totalZombieKills ≥ 50 |
| `zombie_veteran` | Zombie Veteran | Kill 500 zombies | $30,000 | totalZombieKills ≥ 500 |
| `zombie_god` | Zombie God | Kill 5,000 zombies | $200,000 | totalZombieKills ≥ 5000 |

### Rescue Mission
| ID | Name | Description | Reward | Condition |
|---|---|---|---|---|
| `rescue_rookie` | Rescue Rookie | Complete your first rescue mission | $1,000 | totalRescueCompletions ≥ 1 |
| `hostage_hero` | Hostage Hero | Complete 10 rescue missions | $5,000 | totalRescueCompletions ≥ 10 |
| `speed_runner` | Speed Runner | Beat rescue in under 3 minutes | $2,000 | bestRescueTime ≤ 180 |
| `lightning_run` | Lightning Run | Beat rescue in under 90 seconds | $5,000 | bestRescueTime ≤ 90 |

### PvP
| ID | Name | Description | Reward | Condition |
|---|---|---|---|---|
| `arena_warrior` | Arena Warrior | Win your first PvP match | $500 | totalPvpWins ≥ 1 |
| `arena_champion` | Arena Champion | Win 10 PvP matches | $3,000 | totalPvpWins ≥ 10 |

### Waves (Zombie Mode)
| ID | Name | Description | Reward | Condition |
|---|---|---|---|---|
| `wave_crasher` | Wave Crasher | Survive to wave 10 | $1,000 | highestWave ≥ 10 |
| `wave_master` | Wave Master | Survive to wave 25 | $5,000 | highestWave ≥ 25 |

### Combat
| ID | Name | Description | Reward | Condition |
|---|---|---|---|---|
| `headhunter` | Headhunter | Land 50 headshot kills | $1,000 | totalHeadshotKills ≥ 50 |
| `untouchable` | Untouchable | Win a mission without taking damage | $2,000 | flawlessRuns ≥ 1 |
| `demolitions` | Demolitions Expert | Get 25 explosive kills | $1,500 | totalExplosiveKills ≥ 25 |
| `airstrike_cmd` | Airstrike Commander | Call 5 airstrikes | $1,000 | totalAirstrikes ≥ 5 |
| `apex_hunter` | Apex Hunter | Kill an Apex Zombie | $1,500 | apexKills ≥ 1 |
| `giga_slayer` | Giga Slayer | Kill a Giga Zombie | $2,000 | gigaKills ≥ 1 |

### Progression
| ID | Name | Description | Reward | Condition |
|---|---|---|---|---|
| `arms_dealer` | Arms Dealer | Own every weapon | $5,000 | all purchasable weapons owned |
| `field_medic` | Field Medic | Use 20 med kits | $500 | totalMedkitsUsed ≥ 20 |

---

## Module Architecture

### `js/achievements.js` (new file)

Leaf module — imports only `state.js` and `data.js`. No imports from `ui.js`, `combat.js`, `entities.js`, or `main.js` (avoids circular deps).

**Exports:**
- `checkAchievements()` — loops all ACHIEVEMENTS; for any not yet in `playerData.achievements` where `check(pd)` is true: marks unlocked, adds reward to `playerData.money`, increments `totalMoneyEarned`, calls `savePlayerData()`, calls `showAchievementToast()`
- `initAchievementsUI()` — builds `#achievements-overlay` inner content, wires close button, called once from `main.js` on init
- `openAchievementsScreen()` — refreshes overlay content and shows it (exported for homepage button)

**Internal:**
- `showAchievementToast(name, reward)` — creates a DOM element appended to `#hud`, styled with gold border, "Achievement Unlocked" header, name + reward. Auto-removes after 4 seconds. Stacks if multiple unlock simultaneously (offset by 90px each).

### Changes to existing files

**`state.js`**
- Add 15 stat fields to `defaultPlayerData()`
- Add `missionStartTime: null` and `tookDamageThisGame: false` to `gameState`

**`entities.js`**
- `killZombie(z, idx)`: increment `totalZombieKills`; add `z.dropMoney` to `totalMoneyEarned`; if `z.isApex` increment `apexKills`; if `z.isGiga` increment `gigaKills`; if killed by explosive (pass flag from caller) increment `totalExplosiveKills`; call `checkAchievements()`

**`combat.js`**
- `damagePlayer()`: set `gameState.tookDamageThisGame = true`
- headshot kill detection: increment `totalHeadshotKills`; call `checkAchievements()`
- `callAirstrike()`: increment `totalAirstrikes`; call `checkAchievements()`
- `useMedkit()`: increment `totalMedkitsUsed`; call `checkAchievements()`
- `gameOver()`: no flawless (player died)
- PvP win path in `checkPvPEnd()`: if `!gameState.tookDamageThisGame` increment `flawlessRuns`; increment `totalPvpWins`; add reward to `totalMoneyEarned`; call `checkAchievements()`

**`main.js`**
- `startGame()`: set `gameState.missionStartTime = performance.now()`; set `gameState.tookDamageThisGame = false`
- Rescue success block (line ~1438): compute elapsed seconds, update `bestRescueTime` if better; increment `totalRescueCompletions`; add $3000 to `totalMoneyEarned`; if `!tookDamageThisGame` increment `flawlessRuns`; call `checkAchievements()`
- Wave increment logic: `if (gameState.wave > playerData.highestWave) playerData.highestWave = gameState.wave`; call `checkAchievements()`
- Import `checkAchievements`, `initAchievementsUI`, `openAchievementsScreen` from `./achievements.js`
- Call `initAchievementsUI()` once after DOM ready

**`ui.js`**
- Shop weapon purchase handler: after purchasing a weapon call `checkAchievements()` (for Arms Dealer). Import `checkAchievements` from `./achievements.js`.

**`war_zone.html`**
- Add `<div id="achievements-overlay">` (hidden, fullscreen, same style as keybinds overlay)
- Add "Achievements" button in homepage `#homepage` div (same small style as Tutorial/Keybinds buttons)

---

## UI — Achievements Overlay

- Fullscreen dark backdrop (`rgba(0,0,0,0.88)`), z-index 2100
- Inner panel: `max-width: 700px`, scrollable, dark gradient background, gold header "ACHIEVEMENTS"
- Summary line at top: "X / 20 Unlocked"
- Achievement cards in a 2-column grid:
  - **Unlocked**: gold border (`#ffaa00`), gold checkmark ✓, name in white, description in gray, reward in green
  - **Locked**: gray border, lock icon, name in gray, description in dark gray, reward in gray
  - **Numeric milestones**: show progress bar (e.g., "342 / 500") below description
- Close button at bottom (same style as keybinds close button)
- "Best Rescue Time" shown at top of overlay as a stat line if `bestRescueTime` is not null

---

## Toast Notification

Appears anchored to top-right of `#hud` (same corner as kill feed but left of it, or below it). Format:

```
🏆 Achievement Unlocked
[Achievement Name]
+$[reward]
```

Gold border, dark background, slides in from right, fades out after 4s. Multiple simultaneous unlocks stack vertically.

---

## Data Migration

Existing saves won't have the new fields. `loadPlayerData()` already merges with `defaultPlayerData()` via spread (`{...def, ...d}`), so new fields default to `0`/`null`/`{}` automatically — no migration needed.

---

## Spec Self-Review

- No TBDs or placeholders
- Dependency graph is acyclic: achievements.js is a pure leaf
- Arms Dealer check filters out `compass` and `flashlight` (utility/non-purchasable items)
- `totalExplosiveKills` requires passing an `isExplosive` flag through `killZombie` — this is a minor interface change but contained to entities.js + its callers in combat.js
- Rescue time tracks wall-clock seconds via `performance.now()` diff — accurate and simple
- `highestWave` updated on wave increment, not on game-over wave display, so partial waves count correctly
- flawless check: only rescue success and PvP win count (zombie mode has no win condition)
