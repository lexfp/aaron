# Map Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blue-accented map grid with a two-column split layout (scrollable list left, full-bleed image preview right) that matches the dark military theme of the homepage, shop, and loadout screens.

**Architecture:** Three files change — `styles.css` (new `.ms-*` rules replace old map rules), `war_zone.html` (new `#map-screen` DOM structure), `js/ui.js` (rewritten `renderMapScreen()`). `main.js` gets two one-line updates to call `renderMapScreen` on mode-button clicks instead of `showScreen`. No new files. No changes to `data.js` or game logic.

**Tech Stack:** Vanilla JS (ES modules), plain CSS, no build step. Verify by opening `war_zone.html` in a browser.

---

### Task 1: Replace old map CSS with new `.ms-*` styles

**Files:**
- Modify: `war_zone/styles.css:1444-1493`

- [ ] **Step 1: Remove the old map selector block**

In `styles.css`, find and delete the entire `/* Map selector */` block (lines 1444–1493). Replace it with the block below.

```css
/* Map selector */
#map-screen {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: none;
    flex-direction: column;
    background: #0a0a0a;
    overflow: hidden;
}

.ms-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 24px;
    border-bottom: 1px solid #1e1515;
    flex-shrink: 0;
    position: relative;
}

.ms-header::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: #cc2200;
}

.ms-title {
    font-size: 18px;
    font-weight: 900;
    letter-spacing: 4px;
    color: #fff;
    padding-left: 8px;
}

.ms-mode-badge {
    font-size: 9px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #444;
    border: 1px solid #1a1a1a;
    padding: 4px 10px;
}

.ms-back-btn {
    appearance: none;
    -webkit-appearance: none;
    font-size: 10px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #555;
    border: 1px solid #222;
    padding: 5px 14px;
    cursor: pointer;
    background: none;
    font-family: 'Segoe UI', Arial, sans-serif;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.ms-back-btn:hover {
    color: #fff;
    border-color: #ff4444;
    background: rgba(200, 40, 40, 0.2);
}

.ms-body {
    display: flex;
    flex: 1;
    overflow: hidden;
}

.ms-list {
    width: 220px;
    flex-shrink: 0;
    border-right: 1px solid #1a1a1a;
    overflow-y: auto;
    background: #080808;
}

.ms-list-label {
    font-size: 8px;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: #333;
    padding: 10px 14px 6px;
    border-bottom: 1px solid #111;
}

.ms-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 14px;
    border-bottom: 1px solid #0f0f0f;
    border-left: 2px solid transparent;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
}

.ms-item:hover {
    background: #0f0808;
    border-left-color: #662200;
}

.ms-item.active {
    background: #130d0d;
    border-left-color: #cc2200;
}

.ms-item-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #222;
    flex-shrink: 0;
}

.ms-item.active .ms-item-dot { background: #cc2200; }

.ms-item-info { flex: 1; }

.ms-item-name {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #666;
}

.ms-item.active .ms-item-name { color: #fff; }
.ms-item:hover:not(.active) .ms-item-name { color: #994444; }

.ms-item-size {
    font-size: 8px;
    color: #333;
    margin-top: 1px;
}

.ms-item.active .ms-item-size { color: #553333; }

.ms-item-arrow {
    color: #222;
    font-size: 12px;
}

.ms-item.active .ms-item-arrow { color: #cc2200; }

.ms-preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.ms-img-wrap {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: #0d0d0d;
}

.ms-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.65;
    display: block;
}

.ms-img-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
        to bottom,
        transparent 30%,
        rgba(0, 0, 0, 0.5) 65%,
        rgba(0, 0, 0, 0.92) 100%
    );
}

.ms-img-content {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    padding: 20px 24px 18px;
}

.ms-map-name {
    font-size: 26px;
    font-weight: 900;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #fff;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
    line-height: 1;
}

.ms-map-desc {
    font-size: 12px;
    color: #888;
    margin-top: 6px;
    letter-spacing: 0.5px;
    line-height: 1.5;
    max-width: 480px;
}

.ms-map-tags {
    display: flex;
    gap: 6px;
    margin-top: 10px;
}

.ms-tag {
    font-size: 8px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #444;
    border: 1px solid #1a1a1a;
    padding: 2px 8px;
}

.ms-footer {
    padding: 12px 24px;
    border-top: 1px solid #1a1a1a;
    background: #080808;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
}

.ms-footer-hint {
    font-size: 9px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #333;
}

.ms-deploy-btn {
    appearance: none;
    -webkit-appearance: none;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    background: #cc2200;
    color: #fff;
    border: none;
    padding: 10px 28px;
    cursor: pointer;
    font-family: 'Segoe UI', Arial, sans-serif;
    transition: background 0.15s;
}

.ms-deploy-btn:hover { background: #ff3300; }
```

- [ ] **Step 2: Commit**

```bash
git add war_zone/styles.css
git commit -m "style: replace map screen CSS with two-column split ms-* styles"
```

---

### Task 2: Replace `#map-screen` HTML

**Files:**
- Modify: `war_zone/war_zone.html:86-91`

- [ ] **Step 1: Replace the old #map-screen div**

Find this block in `war_zone.html` (lines 86–91):

```html
    <!-- Map Selection -->
    <div id="map-screen">
        <h2>Select Map</h2>
        <div class="map-grid" id="map-grid"></div>
        <button class="back-btn" onclick="showScreen('homepage')">Back</button>
    </div>
```

Replace it with:

```html
    <!-- Map Selection -->
    <div id="map-screen">
        <div class="ms-header">
            <div class="ms-title">SELECT MAP</div>
            <div class="ms-mode-badge" id="ms-mode-badge">Mode: —</div>
            <button class="ms-back-btn" onclick="showScreen('homepage')">← Back</button>
        </div>
        <div class="ms-body">
            <div class="ms-list" id="ms-list">
                <div class="ms-list-label" id="ms-list-label">Maps</div>
            </div>
            <div class="ms-preview">
                <div class="ms-img-wrap">
                    <img class="ms-img" id="ms-preview-img" src="" alt="">
                    <div class="ms-img-overlay"></div>
                    <div class="ms-img-content">
                        <div class="ms-map-name" id="ms-preview-name"></div>
                        <div class="ms-map-desc" id="ms-preview-desc"></div>
                        <div class="ms-map-tags" id="ms-preview-tags"></div>
                    </div>
                </div>
                <div class="ms-footer">
                    <div class="ms-footer-hint">Click a map on the left to preview</div>
                    <button class="ms-deploy-btn" id="ms-deploy-btn">Deploy →</button>
                </div>
            </div>
        </div>
    </div>
```

- [ ] **Step 2: Commit**

```bash
git add war_zone/war_zone.html
git commit -m "html: replace map-screen grid with two-column split structure"
```

---

### Task 3: Rewrite `renderMapScreen()` in `ui.js`

**Files:**
- Modify: `war_zone/js/ui.js:644-686`

- [ ] **Step 1: Replace the renderMapScreen function**

Find the entire `renderMapScreen` function in `js/ui.js` (lines 644–686, starting with `// --- Map Screen ---`). Replace with:

```js
// --- Map Screen ---

export function renderMapScreen(startGameFn) {
    const modeNames = { zombie: 'Zombie Apocalypse', rescue: 'Rescue Mission', pvp: 'PvP Arena' };
    document.getElementById('ms-mode-badge').textContent = 'Mode: ' + (modeNames[gameState.pendingMode] || '—');

    const mapImages = {
        warehouse: 'Pictures/warehouse.png',
        city:      'Pictures/city.png',
        desert:    'Pictures/desert.png',
        forest:    'Pictures/forest.png',
        mountain:  'Pictures/mountains.png',
        fortress:  'Pictures/fortress.png',
        hallway:   'Pictures/hallway.png',
    };

    const mapMeta = {
        warehouse: { size: 'Small',  env: 'Indoor'      },
        city:      { size: 'Large',  env: 'Outdoor'     },
        desert:    { size: 'Large',  env: 'Outdoor'     },
        forest:    { size: 'Large',  env: 'Outdoor'     },
        mountain:  { size: 'Large',  env: 'Outdoor'     },
        fortress:  { size: 'Medium', env: 'Mixed'       },
        hallway:   { size: 'Medium', env: 'Indoor'      },
        cave:      { size: 'Medium', env: 'Underground' },
    };

    const list = document.getElementById('ms-list');
    // Clear all items but keep the label header
    list.querySelectorAll('.ms-item').forEach(el => el.remove());

    const mapIds = Object.keys(MAPS);
    document.getElementById('ms-list-label').textContent = `${mapIds.length} Maps Available`;

    let selectedId = null;

    function selectMap(id) {
        selectedId = id;
        list.querySelectorAll('.ms-item').forEach(el => el.classList.remove('active'));
        const item = list.querySelector(`[data-map="${id}"]`);
        if (item) item.classList.add('active');

        const m = MAPS[id];
        const imgEl = document.getElementById('ms-preview-img');
        const src = mapImages[id];
        if (src) {
            imgEl.src = src;
            imgEl.style.display = '';
        } else {
            imgEl.src = '';
            imgEl.style.display = 'none';
        }
        document.getElementById('ms-preview-name').textContent = m.name;
        document.getElementById('ms-preview-desc').textContent = m.description;

        const meta = mapMeta[id] || {};
        const tagsEl = document.getElementById('ms-preview-tags');
        tagsEl.innerHTML = '';
        [meta.size, meta.env].filter(Boolean).forEach(label => {
            const t = document.createElement('div');
            t.className = 'ms-tag';
            t.textContent = label;
            tagsEl.appendChild(t);
        });

        document.getElementById('ms-deploy-btn').textContent = `Deploy to ${m.name} →`;
    }

    for (const [id, m] of Object.entries(MAPS)) {
        const meta = mapMeta[id] || {};
        const item = document.createElement('div');
        item.className = 'ms-item';
        item.dataset.map = id;
        item.innerHTML = `
            <div class="ms-item-dot"></div>
            <div class="ms-item-info">
                <div class="ms-item-name">${m.name}</div>
                <div class="ms-item-size">${meta.size || ''} · ${meta.env || ''}</div>
            </div>
            <div class="ms-item-arrow">›</div>
        `;
        item.onclick = () => selectMap(id);
        list.appendChild(item);
    }

    document.getElementById('ms-deploy-btn').onclick = () => {
        if (selectedId) startGameFn(gameState.pendingMode, selectedId);
    };

    selectMap(mapIds[0]);
    showScreen('map-screen');
}
```

- [ ] **Step 2: Commit**

```bash
git add war_zone/js/ui.js
git commit -m "feat: rewrite renderMapScreen as two-column split with preview"
```

---

### Task 4: Update call sites in `main.js`

**Files:**
- Modify: `war_zone/js/main.js:1780-1796`

The old code called `renderMapScreen(startGame)` once at startup (line 1780) and then called `showScreen('map-screen')` from mode buttons. Now `renderMapScreen` handles showing the screen itself, so we call it on each mode click instead.

- [ ] **Step 1: Remove the one-time startup call**

In `main.js`, find line 1780:
```js
renderMapScreen(startGame);
```
Delete that line entirely.

- [ ] **Step 2: Update btn-zombie handler**

Find (line 1782):
```js
document.getElementById('btn-zombie').addEventListener('click', () => { gameState.pendingMode = 'zombie'; showScreen('map-screen'); });
```
Replace with:
```js
document.getElementById('btn-zombie').addEventListener('click', () => { gameState.pendingMode = 'zombie'; renderMapScreen(startGame); });
```

- [ ] **Step 3: Update btn-pvp handler**

Find (line 1796):
```js
document.getElementById('btn-pvp').addEventListener('click', () => { gameState.pendingMode = 'pvp'; showScreen('map-screen'); });
```
Replace with:
```js
document.getElementById('btn-pvp').addEventListener('click', () => { gameState.pendingMode = 'pvp'; renderMapScreen(startGame); });
```

Note: The `btn-rescue` handler calls `startGame` directly (bypassing the map screen) — leave it unchanged.

- [ ] **Step 4: Commit**

```bash
git add war_zone/js/main.js
git commit -m "refactor: call renderMapScreen on mode click instead of showScreen"
```

---

### Task 5: Verify in browser

- [ ] **Step 1: Open the game**

Open `war_zone/war_zone.html` directly in a browser (no server needed).

- [ ] **Step 2: Check Zombie Apocalypse flow**

Click "Zombie Apocalypse" on the homepage. Verify:
- Map screen opens with dark `#0a0a0a` background (not blue gradient)
- Header shows red left bar, "SELECT MAP" title, "Mode: Zombie Apocalypse" badge, styled Back button
- Left column: 8 map rows, first map (Warehouse) pre-selected with red left border + red dot
- Right column: Warehouse image visible (dim, full-height), "WAREHOUSE" name overlaid, description, Small · Indoor tags
- "Deploy to Warehouse →" red button in footer

- [ ] **Step 3: Check map selection interaction**

Click each map in the list. Verify:
- Active state moves (red border, red dot, white name)
- Right panel image, name, description, and deploy button text all update
- Cave shows a dark placeholder (no image) — no broken img icon

- [ ] **Step 4: Check deploy**

Select any map and click "Deploy to [Map] →". Verify the game starts on the correct map.

- [ ] **Step 5: Check PvP flow**

Go back to homepage. Click "PvP Arena". Verify the badge reads "Mode: PvP Arena".

- [ ] **Step 6: Check Back button**

On the map screen, click "← Back". Verify it returns to the homepage.

- [ ] **Step 7: Update CLAUDE.md and FEATURES.md**

In `CLAUDE.md`, update the `#map-screen` description under "Homepage layout" to reflect the new two-column split structure and new CSS classes (`.ms-header`, `.ms-list`, `.ms-preview`, etc.).

In `war_zone/FEATURES.md`, update the map selection UI description if it has one.

- [ ] **Step 8: Final commit**

```bash
git add war_zone/CLAUDE.md war_zone/FEATURES.md
git commit -m "docs: update CLAUDE.md and FEATURES.md for map screen redesign"
```
