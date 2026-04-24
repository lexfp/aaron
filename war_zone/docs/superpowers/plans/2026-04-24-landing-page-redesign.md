# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `#homepage` div with a two-panel split layout (left: brand/stats/utility buttons, right: game mode rows) in a dark military visual style.

**Architecture:** Pure HTML + CSS change to `war_zone.html` and `styles.css`. No JS changes. All existing button IDs and stat element IDs are preserved so `main.js` and `ui.js` event listeners continue working without modification.

**Tech Stack:** Plain HTML5, CSS3. No build step. Open `war_zone/war_zone.html` directly in a browser to verify.

---

### Task 1: Restore `.menu-btn` and remove clamp() overrides from styles.css

An earlier session added `clamp()`-based responsive scaling to `#homepage`, `#homepage h1`, `#homepage .subtitle`, and `.menu-btn`. This redesign supersedes those changes. `.menu-btn` must be restored to its original values because it is still used by the pause menu and round overlay.

**Files:**
- Modify: `war_zone/styles.css`

- [ ] **Step 1: Restore the `#homepage` block to a clean baseline**

In `styles.css`, replace the current `/* Homepage */` section (which has `clamp()` values) with:

```css
/* Homepage */
#homepage {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
}
```

- [ ] **Step 2: Remove the old `#homepage h1` block**

Delete this entire rule from `styles.css`:

```css
#homepage h1 {
    font-size: clamp(36px, 7vh, 72px);
    font-weight: 900;
    letter-spacing: 4px;
    background: linear-gradient(90deg, #ff4444, #ff8800, #ffaa00);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: clamp(4px, 0.8vh, 10px);
    flex-shrink: 0;
}
```

- [ ] **Step 3: Remove the old `#homepage .subtitle` block**

Delete this entire rule from `styles.css`:

```css
#homepage .subtitle {
    color: #888;
    font-size: clamp(13px, 2vh, 18px);
    margin-bottom: clamp(12px, 3vh, 50px);
    flex-shrink: 0;
}
```

- [ ] **Step 4: Restore `.menu-btn` to original values**

Replace the current `.menu-btn` block (which has `clamp()` values and `flex-shrink: 0`) with the original:

```css
.menu-btn {
    width: 300px;
    padding: 16px;
    margin: 8px;
    font-size: 20px;
    font-weight: 700;
    border: 2px solid #ff4444;
    background: rgba(255, 68, 68, 0.1);
    color: #ff4444;
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.2s;
    text-transform: uppercase;
    letter-spacing: 2px;
}
```

- [ ] **Step 5: Remove the old `.player-stats` block**

Delete this entire rule from `styles.css`:

```css
.player-stats {
    position: absolute;
    top: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.7);
    padding: 15px 25px;
    border-radius: 10px;
    border: 1px solid #333;
    font-size: 16px;
    text-align: right;
}

.player-stats span {
    color: #ffaa00;
    font-weight: 700;
}
```

- [ ] **Step 6: Commit**

```bash
git add war_zone/styles.css
git commit -m "refactor: revert clamp overrides, clear old homepage CSS rules"
```

---

### Task 2: Add split-panel CSS to styles.css

**Files:**
- Modify: `war_zone/styles.css` (append after the `/* Homepage */` block from Task 1)

- [ ] **Step 1: Add the left panel styles**

Append to `styles.css` immediately after the `#homepage { ... }` block:

```css
/* Homepage — Split Panel */
.home-left {
    width: 280px;
    flex-shrink: 0;
    background: #0d0b0b;
    border-right: 1px solid #1e1515;
    display: flex;
    flex-direction: column;
    padding: 40px 24px 32px;
    position: relative;
}

.home-left::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: linear-gradient(180deg, transparent, #cc2222 25%, #cc2222 75%, transparent);
}

.home-right {
    flex: 1;
    background: #0b0b0b;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 32px 40px;
    gap: 10px;
    position: relative;
}

/* scanline texture over entire screen */
#homepage::before {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px);
    pointer-events: none;
    z-index: 1;
}
```

- [ ] **Step 2: Add brand / stats styles**

```css
.home-brand {
    margin-bottom: auto;
}

.home-title {
    font-size: 52px;
    font-weight: 900;
    letter-spacing: 4px;
    line-height: 0.88;
    background: linear-gradient(160deg, #ff4444 0%, #cc2222 60%, #8a1515 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    text-transform: uppercase;
}

.home-subtitle {
    font-size: 10px;
    letter-spacing: 3px;
    color: #442222;
    text-transform: uppercase;
    margin-top: 10px;
}

.home-divider {
    width: 48px;
    height: 1px;
    background: linear-gradient(90deg, #662222, transparent);
    margin: 22px 0 16px;
}

.home-stats {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.home-stat-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
}

.home-stat-label {
    font-size: 10px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #3a3a3a;
}

.home-stat-value {
    font-size: 14px;
    font-weight: 700;
    color: #cc4444;
}
```

- [ ] **Step 3: Add utility button styles**

```css
.home-utils {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.home-utils-label {
    font-size: 9px;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: #2a1a1a;
    margin-bottom: 4px;
}

.util-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border: 1px solid #2a1818;
    border-radius: 4px;
    background: #100d0d;
    color: #664444;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, transform 0.12s, color 0.15s;
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    text-align: left;
}

.util-btn:hover {
    border-color: #cc3333;
    background: #150d0d;
    color: #ff4444;
    transform: translateX(3px);
}

.util-btn .util-icon {
    font-size: 14px;
    flex-shrink: 0;
    opacity: 0.7;
}

.util-btn:hover .util-icon {
    opacity: 1;
}
```

- [ ] **Step 4: Add game mode row styles**

```css
.home-modes-label {
    font-size: 9px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #2e2020;
    margin-bottom: 2px;
}

.mode-row {
    width: 100%;
    border: 1px solid #2e1a1a;
    border-radius: 6px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, transform 0.12s;
    display: flex;
    align-items: stretch;
    background: #100d0d;
    overflow: hidden;
    font-family: 'Segoe UI', Arial, sans-serif;
    padding: 0;
    text-align: left;
}

.mode-row:hover {
    border-color: #ff4444;
    background: #130d0d;
    transform: translateX(4px);
}

.mode-stripe {
    width: 4px;
    flex-shrink: 0;
    background: #3a1515;
    transition: background 0.15s;
}

.mode-row:hover .mode-stripe {
    background: #ff4444;
}

.mode-inner {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 22px 24px;
    flex: 1;
}

.mode-icon {
    font-size: 36px;
    flex-shrink: 0;
    width: 48px;
    text-align: center;
}

.mode-text {
    flex: 1;
}

.mode-name {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #884444;
    transition: color 0.15s;
}

.mode-desc {
    font-size: 12px;
    color: #3a2222;
    margin-top: 5px;
    letter-spacing: 0.5px;
    transition: color 0.15s;
}

.mode-arrow {
    color: #2a1515;
    font-size: 24px;
    flex-shrink: 0;
    transition: color 0.15s, transform 0.15s;
}

.mode-row:hover .mode-name { color: #ff4444; }
.mode-row:hover .mode-desc { color: #774444; }
.mode-row:hover .mode-arrow { color: #ff4444; transform: translateX(4px); }
```

- [ ] **Step 5: Commit**

```bash
git add war_zone/styles.css
git commit -m "feat: add split-panel homepage CSS (dark military style)"
```

---

### Task 3: Replace #homepage HTML in war_zone.html

The old `#homepage` div uses a flat list of `<button class="menu-btn">` elements and a `.player-stats` div. Replace it with the split-panel structure, keeping all IDs that JS depends on: `btn-zombie`, `btn-rescue`, `btn-pvp`, `btn-shop`, `btn-loadout`, `home-money`, `home-missions`, `home-level`.

**Files:**
- Modify: `war_zone/war_zone.html`

- [ ] **Step 1: Replace the entire `#homepage` div**

In `war_zone.html`, find the `<!-- Homepage -->` comment and replace everything from `<div id="homepage">` to its closing `</div>` with:

```html
<!-- Homepage -->
<div id="homepage">
    <div class="home-left">
        <div class="home-brand">
            <div class="home-title">WAR<br>ZONE</div>
            <div class="home-subtitle">3D Tactical Shooter</div>
            <div class="home-divider"></div>
            <div class="home-stats">
                <div class="home-stat-row">
                    <span class="home-stat-label">Money</span>
                    <span class="home-stat-value" id="home-money">$100</span>
                </div>
                <div class="home-stat-row">
                    <span class="home-stat-label">Level</span>
                    <span class="home-stat-value" id="home-level">1</span>
                </div>
                <div class="home-stat-row">
                    <span class="home-stat-label">Missions</span>
                    <span class="home-stat-value" id="home-missions">0</span>
                </div>
            </div>
        </div>
        <div class="home-utils">
            <div class="home-utils-label">Options</div>
            <button id="btn-shop" class="util-btn"><span class="util-icon">🛒</span>Shop</button>
            <button id="btn-loadout" class="util-btn"><span class="util-icon">⚙️</span>Loadout</button>
            <button class="util-btn" onclick="showTutorial()"><span class="util-icon">📖</span>Tutorial</button>
            <button class="util-btn" onclick="openKeybindsMenu()"><span class="util-icon">⌨️</span>Keybinds</button>
            <button class="util-btn" onclick="window._openAchievements && window._openAchievements()"><span class="util-icon">🏆</span>Achievements</button>
        </div>
    </div>
    <div class="home-right">
        <div class="home-modes-label">Select Game Mode</div>
        <button id="btn-zombie" class="mode-row">
            <div class="mode-stripe"></div>
            <div class="mode-inner">
                <span class="mode-icon">🧟</span>
                <div class="mode-text">
                    <div class="mode-name">Zombie Apocalypse</div>
                    <div class="mode-desc">Survive endless waves of the undead</div>
                </div>
                <span class="mode-arrow">›</span>
            </div>
        </button>
        <button id="btn-rescue" class="mode-row">
            <div class="mode-stripe"></div>
            <div class="mode-inner">
                <span class="mode-icon">🚁</span>
                <div class="mode-text">
                    <div class="mode-name">Rescue Mission</div>
                    <div class="mode-desc">Locate and extract the hostage</div>
                </div>
                <span class="mode-arrow">›</span>
            </div>
        </button>
        <button id="btn-pvp" class="mode-row">
            <div class="mode-stripe"></div>
            <div class="mode-inner">
                <span class="mode-icon">⚔️</span>
                <div class="mode-text">
                    <div class="mode-name">PvP Arena</div>
                    <div class="mode-desc">Fight for dominance in the arena</div>
                </div>
                <span class="mode-arrow">›</span>
            </div>
        </button>
    </div>
</div>
```

- [ ] **Step 2: Verify IDs are present**

Confirm the following IDs exist exactly once in the new HTML:
- `btn-zombie`, `btn-rescue`, `btn-pvp` (game mode buttons)
- `btn-shop`, `btn-loadout` (utility buttons)
- `home-money`, `home-level`, `home-missions` (stat spans)

- [ ] **Step 3: Commit**

```bash
git add war_zone/war_zone.html
git commit -m "feat: replace homepage with split-panel layout (dark military)"
```

---

### Task 4: Visual verification

No automated test suite for the browser game. Verify by opening the file directly.

**Files:** none (read-only verification)

- [ ] **Step 1: Open in browser**

Open `war_zone/war_zone.html` in a browser. The homepage should show:
- Left panel (~280px): "WAR / ZONE" title in red gradient, stats below, 5 bordered utility buttons at the bottom
- Right panel: "Select Game Mode" label + 3 tall bordered rows (Zombie, Rescue, PvP)
- No items clipped by viewport edges at any window size

- [ ] **Step 2: Check hover states**

Hover each of the 8 buttons. Expected:
- Utility buttons: slide 3px right, border and text turn red
- Mode rows: slide 4px right, left stripe + name + arrow turn `#ff4444`

- [ ] **Step 3: Check JS still works**

Click each game mode button — map selection screen should appear. Click Shop — shop screen should appear. Click Loadout — loadout screen should appear. Click Tutorial, Keybinds, Achievements — their overlays should open.

- [ ] **Step 4: Check pause menu is unaffected**

Start a game, press Escape. The pause menu should appear with correctly styled `.menu-btn` buttons (white background on hover, not red). Confirm the redesign did not break pause menu button appearance.

- [ ] **Step 5: Commit if all checks pass**

```bash
git add -A
git commit -m "chore: verify homepage redesign complete"
```

---

### Task 5: Update CLAUDE.md and FEATURES.md

**Files:**
- Modify: `war_zone/CLAUDE.md` (the project root CLAUDE.md)
- Modify: `war_zone/FEATURES.md`

- [ ] **Step 1: Update CLAUDE.md architecture table**

In the `war_zone — Modular JS Game Engine` section, update the `ui.js` row description to mention the new homepage structure if relevant. Also ensure the Recent Features section does not describe the old `.player-stats` / `menu-btn` homepage layout as current.

- [ ] **Step 2: Update FEATURES.md**

Find the section describing the homepage / main menu in `FEATURES.md` and update it to describe the split-panel layout, the two panels, and the dark military style.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md war_zone/FEATURES.md
git commit -m "docs: update CLAUDE.md and FEATURES.md for split-panel homepage redesign"
```
