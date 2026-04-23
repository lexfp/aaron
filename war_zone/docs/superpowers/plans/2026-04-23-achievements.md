# Achievements System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent achievements system with 20 achievements, money rewards, in-game toast notifications, and a homepage overlay to war_zone.

**Architecture:** New leaf module `js/achievements.js` imports only `state.js` and `data.js` (no circular deps). Existing modules (`entities.js`, `combat.js`, `main.js`, `ui.js`) import `checkAchievements` and call it at stat-tracking sites. All stats persist in `playerData` via the existing localStorage save system.

**Tech Stack:** Vanilla ES modules, Three.js (already loaded), localStorage, DOM manipulation.

**Important note on waves:** There is no actual wave progression in zombie mode — `gameState.wave` stays at 1. The "wave" achievements use `bestZombieSession` (highest kills in one zombie apocalypse session) instead.

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Modify | `js/state.js` | Add 15 stat fields to `defaultPlayerData()`; add 2 fields to `gameState` |
| Create | `js/achievements.js` | ACHIEVEMENTS array, `checkAchievements()`, toast, overlay UI |
| Modify | `war_zone.html` | Add `#achievements-overlay` div + "Achievements" homepage button |
| Modify | `js/entities.js` | Track kills/money/apex/giga in `killZombie()`; add `isExplosive` param |
| Modify | `js/combat.js` | Track headshots, damage dealt, airstrikes, medkits, PvP wins, flawless; flag damage taken |
| Modify | `js/main.js` | Import achievements; set start time; track rescue completion; track session kills |
| Modify | `js/ui.js` | Call `checkAchievements()` after weapon purchase |
| Modify | `war_zone/FEATURES.md` | Document achievements system |
| Modify | `../CLAUDE.md` | Add achievements to Recent Features |

---

## Task 1: Add stat fields to `state.js`

**Files:**
- Modify: `js/state.js`

- [ ] **Step 1: Add 15 fields to `defaultPlayerData()`**

Open `js/state.js`. The `defaultPlayerData()` function currently ends with `stats: { ... }`. Add after it (before the closing brace):

```js
function defaultPlayerData() {
    return {
        money: 100,
        missions: 0,
        ownedWeapons: ['fists', 'glock'],
        ownedEquipment: [],
        ownedArmor: [],
        weaponAttachments: {},
        weaponUsage: {},
        equippedLoadout: ['fists', 'glock'],
        equippedArmor: null,
        equippedHelmet: null,
        equippedPants: null,
        equippedBoots: null,
        reserveAmmo: {},
        airstrikes: 0,
        level: 1,
        xp: 0,
        statPoints: 0,
        stats: { health: 0, speed: 0, damage: 0, stamina: 0, staminaRegen: 0, jump: 0, reload: 0 },
        achievements: {},
        totalZombieKills: 0,
        bestRescueTime: null,
        totalRescueCompletions: 0,
        totalPvpWins: 0,
        bestZombieSession: 0,
        totalMoneyEarned: 0,
        totalDamageDealt: 0,
        totalHeadshotKills: 0,
        flawlessRuns: 0,
        totalAirstrikes: 0,
        totalExplosiveKills: 0,
        apexKills: 0,
        gigaKills: 0,
        totalMedkitsUsed: 0,
    };
}
```

- [ ] **Step 2: Add 2 fields to `gameState`**

In `js/state.js`, find `export const gameState = {` and add these two fields anywhere in the object (after `hiveMind` is a good spot):

```js
    missionStartTime: null,
    tookDamageThisGame: false,
```

- [ ] **Step 3: Commit**

```bash
git add js/state.js
git commit -m "feat: add achievement stat fields to playerData and gameState"
```

---

## Task 2: Create `js/achievements.js`

**Files:**
- Create: `js/achievements.js`

- [ ] **Step 1: Create the file**

Create `js/achievements.js` with the full content below. This is a leaf module — it only imports from `state.js` and `data.js`.

```js
import { playerData, savePlayerData } from './state.js';
import { WEAPONS } from './data.js';

const PURCHASABLE_WEAPONS = Object.keys(WEAPONS).filter(
    k => !['compass', 'flashlight', 'fists'].includes(k)
);

export const ACHIEVEMENTS = [
    // --- Kills ---
    {
        id: 'first_blood', name: 'First Blood', desc: 'Kill your first zombie', reward: 500,
        check: pd => pd.totalZombieKills >= 1,
    },
    {
        id: 'zombie_slayer', name: 'Zombie Slayer', desc: 'Kill 50 zombies', reward: 5000,
        check: pd => pd.totalZombieKills >= 50,
        progress: pd => ({ current: pd.totalZombieKills, max: 50 }),
    },
    {
        id: 'zombie_veteran', name: 'Zombie Veteran', desc: 'Kill 500 zombies', reward: 30000,
        check: pd => pd.totalZombieKills >= 500,
        progress: pd => ({ current: pd.totalZombieKills, max: 500 }),
    },
    {
        id: 'zombie_god', name: 'Zombie God', desc: 'Kill 5,000 zombies', reward: 200000,
        check: pd => pd.totalZombieKills >= 5000,
        progress: pd => ({ current: pd.totalZombieKills, max: 5000 }),
    },
    // --- Rescue ---
    {
        id: 'rescue_rookie', name: 'Rescue Rookie', desc: 'Complete your first rescue mission', reward: 1000,
        check: pd => pd.totalRescueCompletions >= 1,
    },
    {
        id: 'hostage_hero', name: 'Hostage Hero', desc: 'Complete 10 rescue missions', reward: 5000,
        check: pd => pd.totalRescueCompletions >= 10,
        progress: pd => ({ current: pd.totalRescueCompletions, max: 10 }),
    },
    {
        id: 'speed_runner', name: 'Speed Runner', desc: 'Beat rescue in under 3 minutes', reward: 2000,
        check: pd => pd.bestRescueTime !== null && pd.bestRescueTime <= 180,
    },
    {
        id: 'lightning_run', name: 'Lightning Run', desc: 'Beat rescue in under 90 seconds', reward: 5000,
        check: pd => pd.bestRescueTime !== null && pd.bestRescueTime <= 90,
    },
    // --- PvP ---
    {
        id: 'arena_warrior', name: 'Arena Warrior', desc: 'Win your first PvP match', reward: 500,
        check: pd => pd.totalPvpWins >= 1,
    },
    {
        id: 'arena_champion', name: 'Arena Champion', desc: 'Win 10 PvP matches', reward: 3000,
        check: pd => pd.totalPvpWins >= 10,
        progress: pd => ({ current: pd.totalPvpWins, max: 10 }),
    },
    // --- Zombie Session ---
    {
        id: 'wave_crasher', name: 'Wave Crasher', desc: 'Kill 50 zombies in one session', reward: 1000,
        check: pd => pd.bestZombieSession >= 50,
        progress: pd => ({ current: pd.bestZombieSession, max: 50 }),
    },
    {
        id: 'wave_master', name: 'Wave Master', desc: 'Kill 150 zombies in one session', reward: 5000,
        check: pd => pd.bestZombieSession >= 150,
        progress: pd => ({ current: pd.bestZombieSession, max: 150 }),
    },
    // --- Combat ---
    {
        id: 'headhunter', name: 'Headhunter', desc: 'Land 50 headshot kills', reward: 1000,
        check: pd => pd.totalHeadshotKills >= 50,
        progress: pd => ({ current: pd.totalHeadshotKills, max: 50 }),
    },
    {
        id: 'untouchable', name: 'Untouchable', desc: 'Win a mission without taking damage', reward: 2000,
        check: pd => pd.flawlessRuns >= 1,
    },
    {
        id: 'demolitions', name: 'Demolitions Expert', desc: 'Get 25 explosive kills', reward: 1500,
        check: pd => pd.totalExplosiveKills >= 25,
        progress: pd => ({ current: pd.totalExplosiveKills, max: 25 }),
    },
    {
        id: 'airstrike_cmd', name: 'Airstrike Commander', desc: 'Call 5 airstrikes', reward: 1000,
        check: pd => pd.totalAirstrikes >= 5,
        progress: pd => ({ current: pd.totalAirstrikes, max: 5 }),
    },
    {
        id: 'apex_hunter', name: 'Apex Hunter', desc: 'Kill an Apex Zombie', reward: 1500,
        check: pd => pd.apexKills >= 1,
    },
    {
        id: 'giga_slayer', name: 'Giga Slayer', desc: 'Kill a Giga Zombie', reward: 2000,
        check: pd => pd.gigaKills >= 1,
    },
    // --- Progression ---
    {
        id: 'arms_dealer', name: 'Arms Dealer', desc: 'Own every weapon', reward: 5000,
        check: pd => PURCHASABLE_WEAPONS.every(k => pd.ownedWeapons.includes(k)),
        progress: pd => ({ current: PURCHASABLE_WEAPONS.filter(k => pd.ownedWeapons.includes(k)).length, max: PURCHASABLE_WEAPONS.length }),
    },
    {
        id: 'field_medic', name: 'Field Medic', desc: 'Use 20 med kits', reward: 500,
        check: pd => pd.totalMedkitsUsed >= 20,
        progress: pd => ({ current: pd.totalMedkitsUsed, max: 20 }),
    },
];

// --- Toast ---

let _toastCount = 0;

function showAchievementToast(name, reward) {
    const hud = document.getElementById('hud');
    if (!hud) return;

    const toast = document.createElement('div');
    const offset = _toastCount * 90;
    _toastCount++;

    toast.style.cssText = `
        position:absolute; top:${16 + offset}px; right:16px;
        background:rgba(0,0,0,0.88); border:2px solid #ffaa00;
        border-radius:8px; padding:10px 16px; color:#fff;
        font-family:monospace; font-size:13px; line-height:1.5;
        z-index:500; pointer-events:none; text-align:right;
        opacity:1; transition:opacity 0.6s;
        box-shadow:0 0 12px rgba(255,170,0,0.4);
    `;
    toast.innerHTML = `<span style="color:#ffaa00;font-weight:700;">🏆 Achievement Unlocked</span><br>${name}<br><span style="color:#00ff88">+$${reward.toLocaleString()}</span>`;
    hud.appendChild(toast);

    setTimeout(() => { toast.style.opacity = '0'; }, 3400);
    setTimeout(() => { toast.remove(); _toastCount = Math.max(0, _toastCount - 1); }, 4000);
}

// --- Check ---

export function checkAchievements() {
    for (const a of ACHIEVEMENTS) {
        if (playerData.achievements[a.id]) continue;
        if (!a.check(playerData)) continue;
        playerData.achievements[a.id] = true;
        playerData.money += a.reward;
        playerData.totalMoneyEarned = (playerData.totalMoneyEarned || 0) + a.reward;
        savePlayerData();
        showAchievementToast(a.name, a.reward);
    }
}

// --- Overlay UI ---

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function buildOverlayContent() {
    const unlocked = ACHIEVEMENTS.filter(a => playerData.achievements[a.id]).length;
    const total = ACHIEVEMENTS.length;

    let html = `
        <h2 style="color:#ffaa00;margin:0 0 6px;font-size:1.4rem;text-align:center;letter-spacing:2px;">ACHIEVEMENTS</h2>
        <div style="text-align:center;color:#aaa;font-size:13px;margin-bottom:8px;">${unlocked} / ${total} Unlocked</div>
    `;

    if (playerData.bestRescueTime !== null) {
        html += `<div style="text-align:center;color:#88ccff;font-size:13px;margin-bottom:14px;">Best Rescue Time: <strong>${formatTime(playerData.bestRescueTime)}</strong></div>`;
    }

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';

    for (const a of ACHIEVEMENTS) {
        const done = !!playerData.achievements[a.id];
        const prog = a.progress ? a.progress(playerData) : null;
        const border = done ? '#ffaa00' : '#444';
        const nameColor = done ? '#fff' : '#777';
        const descColor = done ? '#aaa' : '#555';
        const rewardColor = done ? '#00ff88' : '#555';
        const icon = done ? '✓' : '🔒';

        let progressHTML = '';
        if (prog) {
            const pct = Math.min(100, Math.round((prog.current / prog.max) * 100));
            const cur = Math.min(prog.current, prog.max);
            progressHTML = `
                <div style="margin-top:6px;font-size:11px;color:#888;">${cur.toLocaleString()} / ${prog.max.toLocaleString()}</div>
                <div style="height:3px;background:#222;border-radius:2px;margin-top:3px;">
                    <div style="height:100%;width:${pct}%;background:${done ? '#ffaa00' : '#555'};border-radius:2px;"></div>
                </div>
            `;
        }

        html += `
            <div style="border:1px solid ${border};border-radius:8px;padding:10px 12px;background:rgba(0,0,0,0.4);">
                <div style="font-size:13px;font-weight:700;color:${nameColor};">${icon} ${a.name}</div>
                <div style="font-size:11px;color:${descColor};margin-top:3px;">${a.desc}</div>
                ${progressHTML}
                <div style="font-size:11px;color:${rewardColor};margin-top:5px;">Reward: $${a.reward.toLocaleString()}</div>
            </div>
        `;
    }

    html += '</div>';
    return html;
}

export function openAchievementsScreen() {
    const overlay = document.getElementById('achievements-overlay');
    if (!overlay) return;
    const panel = overlay.querySelector('.ach-panel');
    if (panel) panel.innerHTML = buildOverlayContent();
    overlay.style.display = 'flex';
}

export function initAchievementsUI() {
    const overlay = document.getElementById('achievements-overlay');
    if (!overlay) return;

    overlay.innerHTML = `
        <div class="ach-panel" style="background:linear-gradient(135deg,#0a0a1a,#1a1a2e);border:1px solid #444;border-radius:14px;padding:32px 40px;max-width:700px;width:92%;max-height:84vh;overflow-y:auto;"></div>
    `;

    const panel = overlay.querySelector('.ach-panel');
    panel.innerHTML = buildOverlayContent();

    overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.style.display = 'none';
    });
}
```

- [ ] **Step 2: Commit**

```bash
git add js/achievements.js
git commit -m "feat: add achievements.js module with 20 achievements, toast, and overlay"
```

---

## Task 3: Add HTML elements to `war_zone.html`

**Files:**
- Modify: `war_zone.html`

- [ ] **Step 1: Add the Achievements button to the homepage**

In `war_zone.html`, find:

```html
        <button class="menu-btn" style="font-size:15px;opacity:0.75" onclick="showTutorial()">Tutorial</button>
        <button class="menu-btn" style="font-size:15px;opacity:0.75" onclick="openKeybindsMenu()">Keybinds</button>
```

Replace with:

```html
        <button class="menu-btn" style="font-size:15px;opacity:0.75" onclick="showTutorial()">Tutorial</button>
        <button class="menu-btn" style="font-size:15px;opacity:0.75" onclick="openKeybindsMenu()">Keybinds</button>
        <button class="menu-btn" style="font-size:15px;opacity:0.75" onclick="window._openAchievements && window._openAchievements()">Achievements</button>
```

- [ ] **Step 2: Add the achievements overlay div**

In `war_zone.html`, find the keybinds overlay div:

```html
    <!-- Keybinds overlay -->
    <div id="keybinds-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:2100;justify-content:center;align-items:center;">
```

Add the achievements overlay directly before it:

```html
    <!-- Achievements overlay -->
    <div id="achievements-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:2100;justify-content:center;align-items:center;"></div>

    <!-- Keybinds overlay -->
    <div id="keybinds-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:2100;justify-content:center;align-items:center;">
```

- [ ] **Step 3: Commit**

```bash
git add war_zone.html
git commit -m "feat: add achievements overlay and homepage button to war_zone.html"
```

---

## Task 4: Track stats in `entities.js`

**Files:**
- Modify: `js/entities.js`

- [ ] **Step 1: Import checkAchievements**

At the top of `js/entities.js`, find the existing imports. Add `checkAchievements` to the import list. Find the line that imports from `ui.js`:

```js
import { addKillFeed, updateHUD, showRoundOverlay } from './ui.js';
```

Add a new import line after the existing imports:

```js
import { checkAchievements } from './achievements.js';
```

- [ ] **Step 2: Update `killZombie` to track all relevant stats**

Find `export function killZombie(z, idx) {` at line ~443. The current signature is `killZombie(z, idx)`. Change it to accept an optional `isExplosive` flag and add stat tracking:

Replace:

```js
export function killZombie(z, idx) {
    if (z.dead) return;
    z.dead = true; z.hp = 0;
    if (gameState.mode === 'zombie') {
        gameState.zombieTotalKills = (gameState.zombieTotalKills || 0) + 1;
        gameState.zombieKillCredit = (gameState.zombieKillCredit || 0) + 1;
        if (gameState.zombieKillCredit >= 2) {
            gameState.zombieKillCredit -= 2;
            gameState.zombiesToSpawn += 3;
        }
        document.getElementById('wave-hud').textContent = `Kills: ${gameState.zombieTotalKills}`;
    }
    playerData.money += z.dropMoney;
```

With:

```js
export function killZombie(z, idx, isExplosive = false) {
    if (z.dead) return;
    z.dead = true; z.hp = 0;
    if (gameState.mode === 'zombie') {
        gameState.zombieTotalKills = (gameState.zombieTotalKills || 0) + 1;
        gameState.zombieKillCredit = (gameState.zombieKillCredit || 0) + 1;
        if (gameState.zombieKillCredit >= 2) {
            gameState.zombieKillCredit -= 2;
            gameState.zombiesToSpawn += 3;
        }
        document.getElementById('wave-hud').textContent = `Kills: ${gameState.zombieTotalKills}`;
        const sessionKills = gameState.zombieTotalKills;
        if (sessionKills > (playerData.bestZombieSession || 0)) playerData.bestZombieSession = sessionKills;
    }
    playerData.totalZombieKills = (playerData.totalZombieKills || 0) + 1;
    playerData.totalMoneyEarned = (playerData.totalMoneyEarned || 0) + z.dropMoney;
    if (isExplosive) playerData.totalExplosiveKills = (playerData.totalExplosiveKills || 0) + 1;
    if (z.isApex) playerData.apexKills = (playerData.apexKills || 0) + 1;
    if (z.isGiga) playerData.gigaKills = (playerData.gigaKills || 0) + 1;
    playerData.money += z.dropMoney;
```

- [ ] **Step 3: Call checkAchievements after the kill is processed**

In `killZombie`, find the last line of the function which is `savePlayerData();`. Add `checkAchievements()` right after it:

Replace:

```js
    awardXP(xp);
    savePlayerData();
}
```

With:

```js
    awardXP(xp);
    savePlayerData();
    checkAchievements();
}
```

- [ ] **Step 4: Commit**

```bash
git add js/entities.js
git commit -m "feat: track zombie kills, apex/giga kills, explosive kills, session best in killZombie"
```

---

## Task 5: Track stats in `combat.js`

**Files:**
- Modify: `js/combat.js`

- [ ] **Step 1: Import checkAchievements**

At the top of `js/combat.js`, find the existing imports and add:

```js
import { checkAchievements } from './achievements.js';
```

- [ ] **Step 2: Add headshot-kill tracking module-level flag**

Near the top of `js/combat.js`, after the imports, add one line:

```js
let _lastHitWasHeadshot = false;
```

- [ ] **Step 3: Set the headshot flag in `calculateDamage`**

In `calculateDamage`, find the headshot detection block:

```js
        if (localY > entityHeight * 0.75) {
            const hasActiveScope = def.hasScope || hasScope(wid);
            const damageStats = playerData.stats?.damage || 0;
            const headshotBase = (hasActiveScope && isZoomed) ? 40 : 10;
            dmg += headshotBase * (1 + damageStats * 0.05);
            addKillFeed('HEADSHOT!', '#ff4444');
        }
```

Replace with:

```js
        if (localY > entityHeight * 0.75) {
            const hasActiveScope = def.hasScope || hasScope(wid);
            const damageStats = playerData.stats?.damage || 0;
            const headshotBase = (hasActiveScope && isZoomed) ? 40 : 10;
            dmg += headshotBase * (1 + damageStats * 0.05);
            addKillFeed('HEADSHOT!', '#ff4444');
            _lastHitWasHeadshot = true;
        } else {
            _lastHitWasHeadshot = false;
        }
```

- [ ] **Step 4: Track damage dealt and headshot kills in `applyDamageToEnemy`**

Find `function applyDamageToEnemy(hit, dmg) {`. Replace the entire function:

```js
function applyDamageToEnemy(hit, dmg) {
    const entity = findEntityFromHit(hit);
    if (!entity) return;
    if (entity.damageReduction) dmg = Math.max(1, Math.floor(dmg * (1 - entity.damageReduction)));
    entity.hp -= dmg;
    playerData.totalDamageDealt = (playerData.totalDamageDealt || 0) + dmg;
    playHit();
    showDamageNumber(hit.point, dmg);

    if (entity.hp <= 0) {
        if (gameState.mode === 'zombie' || gameState.mode === 'rescue') {
            if (_lastHitWasHeadshot) playerData.totalHeadshotKills = (playerData.totalHeadshotKills || 0) + 1;
            const idx = gameState.zombieEntities.indexOf(entity);
            if (idx >= 0) killZombie(entity, idx);
        } else if (gameState.mode === 'pvp') {
            gameState.pvpPlayerScore++;
            addKillFeed('Enemy eliminated!', '#00ff88');
            document.getElementById('wave-hud').textContent =
                `Round ${gameState.pvpRound} | ${gameState.pvpPlayerScore}-${gameState.pvpEnemyScore}`;
            awardXP(30);
            checkPvPEnd();
        }
    }
}
```

- [ ] **Step 5: Track damage taken in `damagePlayer`**

Find `export function damagePlayer(amount, attackerPos = null) {`. After the `if (playerState.godMode) return;` line, add:

```js
    gameState.tookDamageThisGame = true;
```

So it reads:

```js
export function damagePlayer(amount, attackerPos = null) {
    if (playerState.godMode) return;
    gameState.tookDamageThisGame = true;
    const { def } = getCurrentWeapon();
```

- [ ] **Step 6: Track medkit usage in `useMedkit`**

Find `export function useMedkit() {`. After `savePlayerData();` add:

```js
    playerData.totalMedkitsUsed = (playerData.totalMedkitsUsed || 0) + 1;
    checkAchievements();
```

So the function ends:

```js
    playerData.ownedEquipment.splice(idx, 1);
    savePlayerData();
    playerData.totalMedkitsUsed = (playerData.totalMedkitsUsed || 0) + 1;
    checkAchievements();
    playPickup();
    updateHUD();
    refreshConsumablesIfOpen();
    return true;
}
```

- [ ] **Step 7: Track airstrike usage in `callAirstrike`**

Find `export function callAirstrike() {`. After `playSound(40, 2.0, 'sawtooth', 0.5);` add:

```js
    playerData.totalAirstrikes = (playerData.totalAirstrikes || 0) + 1;
    checkAchievements();
```

So it reads:

```js
export function callAirstrike() {
    const pos = camera.position.clone();
    playSound(40, 2.0, 'sawtooth', 0.5);
    playerData.totalAirstrikes = (playerData.totalAirstrikes || 0) + 1;
    checkAchievements();
    showRoundOverlay('AIRSTRIKE INBOUND', 'Take cover!', 1500);
```

- [ ] **Step 8: Track explosive kills in `callAirstrike`**

In `callAirstrike`, inside the `setTimeout` callback, find:

```js
                if (z.hp <= 0) killZombie(z, i);
```

Replace with:

```js
                if (z.hp <= 0) killZombie(z, i, true);
```

- [ ] **Step 9: Track explosive kills from `createExplosion`**

Find `function createExplosion(pos, radius, damage) {`. Look for `killZombie(z, i)` inside it and add the `isExplosive` flag. Find the pattern within the explosion radius loop:

```js
                if (z.hp <= 0) killZombie(z, i);
```

In the `createExplosion` function body, replace all occurrences of `killZombie(z, i)` (that aren't already in `callAirstrike`) with:

```js
                if (z.hp <= 0) killZombie(z, i, true);
```

Also track damage dealt in the explosion. Find `entity.hp -= dmg;` within `createExplosion` and add before it:

```js
            playerData.totalDamageDealt = (playerData.totalDamageDealt || 0) + Math.min(dmg, Math.max(0, z.hp));
```

- [ ] **Step 10: Track PvP win and flawless in `checkPvPEnd`**

Find `export function checkPvPEnd() {`. Replace:

```js
    if (gameState.pvpPlayerScore >= 3) {
        playerData.money += 200;
        savePlayerData();
        showRoundOverlay('YOU WIN!', '+$200', 3000);
        setTimeout(() => cb.quitToMenu(), 3500);
```

With:

```js
    if (gameState.pvpPlayerScore >= 3) {
        playerData.money += 200;
        playerData.totalMoneyEarned = (playerData.totalMoneyEarned || 0) + 200;
        playerData.totalPvpWins = (playerData.totalPvpWins || 0) + 1;
        if (!gameState.tookDamageThisGame) playerData.flawlessRuns = (playerData.flawlessRuns || 0) + 1;
        savePlayerData();
        checkAchievements();
        showRoundOverlay('YOU WIN!', '+$200', 3000);
        setTimeout(() => cb.quitToMenu(), 3500);
```

- [ ] **Step 11: Commit**

```bash
git add js/combat.js
git commit -m "feat: track damage dealt, headshots, airstrikes, medkits, PvP wins, flawless runs in combat.js"
```

---

## Task 6: Wire achievements into `main.js`

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: Import achievements functions**

At the top of `js/main.js`, after the existing imports, add:

```js
import { checkAchievements, initAchievementsUI, openAchievementsScreen } from './achievements.js';
```

- [ ] **Step 2: Expose `openAchievementsScreen` to the homepage button**

Find where other window globals are set (near the bottom of `main.js` where event listeners are attached, around line 1767). Add:

```js
window._openAchievements = openAchievementsScreen;
```

- [ ] **Step 3: Initialize achievements UI once on load**

Find near the end of `main.js` where the game event listeners are set up (after the import block, before `animate()` is called). Add:

```js
initAchievementsUI();
```

Place it right before the `animate();` call at the bottom of the file.

- [ ] **Step 4: Reset per-game flags in `startGame`**

Find `startGame` and locate the line `gameState.active = true;` near the end of the function (around line 950). Add before it:

```js
    gameState.missionStartTime = performance.now();
    gameState.tookDamageThisGame = false;
```

- [ ] **Step 5: Track rescue completion and flawless run**

Find the rescue success block (around line 1437):

```js
                    if (dist < 5 && gameState.active) {
                        gameState.active = false;
                        controls.unlock();
                        playerData.missions++;
                        playerData.money += 3000;
                        savePlayerData();
                        showRoundOverlay('MISSION ACCOMPLISHED', 'Hostage Extracted! +$3000', 0, true);
                    }
```

Replace with:

```js
                    if (dist < 5 && gameState.active) {
                        gameState.active = false;
                        controls.unlock();
                        playerData.missions++;
                        playerData.money += 3000;
                        playerData.totalMoneyEarned = (playerData.totalMoneyEarned || 0) + 3000;
                        playerData.totalRescueCompletions = (playerData.totalRescueCompletions || 0) + 1;
                        if (!gameState.tookDamageThisGame) playerData.flawlessRuns = (playerData.flawlessRuns || 0) + 1;
                        const elapsedSec = (performance.now() - (gameState.missionStartTime || performance.now())) / 1000;
                        if (playerData.bestRescueTime === null || elapsedSec < playerData.bestRescueTime) {
                            playerData.bestRescueTime = elapsedSec;
                        }
                        savePlayerData();
                        checkAchievements();
                        showRoundOverlay('MISSION ACCOMPLISHED', 'Hostage Extracted! +$3000', 0, true);
                    }
```

- [ ] **Step 6: Commit**

```bash
git add js/main.js
git commit -m "feat: wire achievements into main.js (startGame reset, rescue tracking, UI init)"
```

---

## Task 7: Track Arms Dealer in `ui.js`

**Files:**
- Modify: `js/ui.js`

- [ ] **Step 1: Import checkAchievements**

At the top of `js/ui.js`, add:

```js
import { checkAchievements } from './achievements.js';
```

- [ ] **Step 2: Call checkAchievements after weapon purchase**

Find `window.buyWeapon`:

```js
window.buyWeapon = function (id) {
    const w = WEAPONS[id];
    if (playerData.money >= w.cost && !playerData.ownedWeapons.includes(id)) {
        playerData.money -= w.cost;
        playerData.ownedWeapons.push(id);
        playerData.weaponUsage[id] = 0;
        savePlayerData();
        showShop();
    }
};
```

Replace with:

```js
window.buyWeapon = function (id) {
    const w = WEAPONS[id];
    if (playerData.money >= w.cost && !playerData.ownedWeapons.includes(id)) {
        playerData.money -= w.cost;
        playerData.ownedWeapons.push(id);
        playerData.weaponUsage[id] = 0;
        savePlayerData();
        checkAchievements();
        showShop();
    }
};
```

- [ ] **Step 3: Commit**

```bash
git add js/ui.js
git commit -m "feat: check Arms Dealer achievement after weapon purchase in ui.js"
```

---

## Task 8: Update documentation

**Files:**
- Modify: `war_zone/FEATURES.md`
- Modify: `../CLAUDE.md`

- [ ] **Step 1: Add achievements section to FEATURES.md**

Open `war_zone/FEATURES.md`. Find a suitable section (after the "Game Modes" or "Progression" section) and add:

```markdown
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
```

- [ ] **Step 2: Update CLAUDE.md Recent Features**

Open `../CLAUDE.md`. In the "Recent Features (war_zone)" section, add a bullet at the top:

```markdown
- **Achievements system**: 20 achievements in `js/achievements.js` (leaf module — imports only state.js/data.js); stats tracked in `playerData` (`totalZombieKills`, `bestRescueTime`, `totalRescueCompletions`, `totalPvpWins`, `bestZombieSession`, `totalDamageDealt`, `totalHeadshotKills`, `flawlessRuns`, `totalAirstrikes`, `totalExplosiveKills`, `apexKills`, `gigaKills`, `totalMedkitsUsed`); `gameState.missionStartTime`/`tookDamageThisGame` reset in `startGame()`; toast notification in HUD top-right; overlay via `#achievements-overlay`; homepage "Achievements" button calls `window._openAchievements`
```

- [ ] **Step 3: Commit**

```bash
git add war_zone/FEATURES.md ../CLAUDE.md
git commit -m "docs: document achievements system in FEATURES.md and CLAUDE.md"
```

---

## Self-Review

**Spec coverage:**
- ✅ 15 stat fields in `playerData` (Task 1)
- ✅ `missionStartTime` + `tookDamageThisGame` in `gameState` (Task 1)
- ✅ All 20 achievements defined in `achievements.js` (Task 2)
- ✅ `checkAchievements()` loops and unlocks (Task 2)
- ✅ Toast notification (Task 2)
- ✅ Overlay UI with progress bars, locked/unlocked state (Task 2)
- ✅ Homepage Achievements button (Task 3)
- ✅ `#achievements-overlay` div in HTML (Task 3)
- ✅ `killZombie` tracks kills, money, apex, giga, explosive, session best (Task 4)
- ✅ `damagePlayer` sets `tookDamageThisGame` (Task 5)
- ✅ Headshot kills tracked via `_lastHitWasHeadshot` flag (Task 5)
- ✅ `applyDamageToEnemy` tracks `totalDamageDealt` (Task 5)
- ✅ `useMedkit` tracks `totalMedkitsUsed` (Task 5)
- ✅ `callAirstrike` tracks `totalAirstrikes` + marks explosive kills (Task 5)
- ✅ `createExplosion` marks explosive kills (Task 5)
- ✅ PvP win tracks `totalPvpWins` + flawless (Task 5)
- ✅ `startGame` resets per-game flags (Task 6)
- ✅ Rescue success tracks time, completions, flawless (Task 6)
- ✅ `openAchievementsScreen` exposed to `window._openAchievements` (Task 6)
- ✅ `initAchievementsUI` called on load (Task 6)
- ✅ Arms Dealer checked after weapon purchase (Task 7)
- ✅ Documentation updated (Task 8)

**No placeholders found.**

**Type consistency:** `killZombie(z, idx, isExplosive = false)` — the new third parameter is optional with a default so all existing call sites `killZombie(z, i)` remain valid without changes (except where we explicitly pass `true` for explosions).

**`bestZombieSession` note:** The spec said `highestWave` but the actual game has no wave progression system (`gameState.wave` is always 1). The plan uses `bestZombieSession` throughout — the achievements description was updated to match ("Kill 50/150 zombies in one session").
