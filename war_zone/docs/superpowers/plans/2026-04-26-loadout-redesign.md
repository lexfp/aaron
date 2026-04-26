# Loadout Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-scroll loadout page with a three-column fixed-height layout (Weapons | Armor | Stats) in the red military theme matching the homepage and shop.

**Architecture:** Swap the flat HTML skeleton in `war_zone.html` for a three-column `lo-col` structure; replace all old `.loadout-*` CSS rules with new `lo-*` rules; completely rewrite `showLoadout()` in `ui.js` to populate three named column body divs. All game logic (drag-drop, click-to-equip, repair, stat allocation) is preserved — only the DOM structure and styles change.

**Tech Stack:** Vanilla JS (ES modules), plain CSS, no build step — open `war_zone.html` directly in a browser to test.

---

## File Map

| File | Change |
|---|---|
| `war_zone/war_zone.html` | Replace `#loadout-screen` inner HTML (lines 127-133) with three-column skeleton |
| `war_zone/styles.css` | Replace old loadout CSS block (lines 694-757) with `lo-*` rules |
| `war_zone/js/ui.js` | Line 20: fix `showScreen` to use `flex` for loadout; lines 341-690: rewrite `showLoadout()` |
| `war_zone/CLAUDE.md` | Add note about redesigned loadout layout |

---

## Task 1: HTML Skeleton + CSS + showScreen Fix

**Files:**
- Modify: `war_zone/war_zone.html:127-133`
- Modify: `war_zone/styles.css:694-757`
- Modify: `war_zone/js/ui.js:20`

- [ ] **Step 1: Replace the `#loadout-screen` HTML**

In `war_zone.html`, replace lines 127-133:

```html
    <!-- Loadout -->
    <div id="loadout-screen">
        <h2>LOADOUT</h2>
        <div class="slots-info" id="slots-info">Equip weapons for your next mission</div>
        <div class="loadout-grid" id="loadout-grid"></div>
        <button class="back-btn" onclick="showScreen('homepage')">Back</button>
    </div>
```

With:

```html
    <!-- Loadout -->
    <div id="loadout-screen">
        <div class="lo-header">
            <div class="lo-title">LOADOUT</div>
            <div class="lo-meta">
                <div class="lo-meta-item">
                    <div class="lo-meta-label">Mode</div>
                    <div class="lo-meta-value" id="lo-meta-mode">—</div>
                </div>
                <div class="lo-meta-item">
                    <div class="lo-meta-label">Slots</div>
                    <div class="lo-meta-value" id="lo-meta-slots">0 / 4</div>
                </div>
                <div class="lo-meta-item">
                    <div class="lo-meta-label">Stat Points</div>
                    <div class="lo-meta-value lo-pts" id="lo-meta-pts">0</div>
                </div>
            </div>
            <button class="lo-back-btn" onclick="showScreen('homepage')">← Back</button>
        </div>
        <div class="lo-body">
            <div class="lo-col lo-col-weapons">
                <div class="lo-col-header">
                    <div class="lo-col-title">Weapons</div>
                    <div class="lo-col-sub" id="lo-weapons-sub">Click to equip · max 4 slots</div>
                </div>
                <div class="lo-col-body" id="lo-col-weapons-body"></div>
            </div>
            <div class="lo-col lo-col-armor">
                <div class="lo-col-header">
                    <div class="lo-col-title">Armor</div>
                    <div class="lo-col-sub">Drag inventory → slot to equip</div>
                </div>
                <div class="lo-col-body" id="lo-col-armor-body"></div>
            </div>
            <div class="lo-col lo-col-stats">
                <div class="lo-col-header">
                    <div class="lo-col-title">Stats</div>
                    <div class="lo-col-sub">Spend points to upgrade</div>
                </div>
                <div class="lo-col-body" id="lo-col-stats-body"></div>
            </div>
        </div>
    </div>
```

- [ ] **Step 2: Replace old loadout CSS**

In `styles.css`, replace lines 694-757 (from `/* Loadout */` through `.loadout-item .ammo-info { ... }`) with the following. Leave `.start-btn` and everything after it untouched.

```css
/* Loadout */
#loadout-screen {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: none;
    flex-direction: column;
    background: #0a0a0a;
    overflow: hidden;
}

.lo-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 28px;
    background: #0d0d0d;
    border-bottom: 2px solid #cc2200;
    flex-shrink: 0;
}

.lo-title {
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 6px;
    color: #cc2200;
    text-transform: uppercase;
}

.lo-meta { display: flex; gap: 28px; }

.lo-meta-label {
    font-size: 9px;
    color: #555;
    letter-spacing: 1px;
    text-transform: uppercase;
}

.lo-meta-value { font-size: 15px; font-weight: 700; color: #fff; }
.lo-meta-value.lo-pts { color: #ffaa00; }

.lo-back-btn {
    background: none;
    border: 1px solid #333;
    color: #666;
    padding: 7px 18px;
    font-size: 12px;
    letter-spacing: 2px;
    cursor: pointer;
    text-transform: uppercase;
    transition: all 0.15s;
    appearance: none;
}

.lo-back-btn:hover { border-color: #fff; color: #fff; }

.lo-body { display: flex; flex: 1; overflow: hidden; }

.lo-col {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-right: 1px solid #1a1a1a;
}

.lo-col:last-child { border-right: none; }
.lo-col-weapons { flex: 1.2; }
.lo-col-armor   { flex: 1.1; }
.lo-col-stats   { flex: 1; }

.lo-col-header {
    padding: 12px 18px 10px;
    background: #0d0d0d;
    border-bottom: 1px solid #1a1a1a;
    flex-shrink: 0;
}

.lo-col-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 3px;
    color: #cc2200;
    text-transform: uppercase;
}

.lo-col-sub { font-size: 10px; color: #444; margin-top: 2px; }

.lo-col-body {
    flex: 1;
    overflow-y: auto;
    padding: 14px;
    scrollbar-width: thin;
    scrollbar-color: #222 #0d0d0d;
}

/* Weapon cards */
.lo-w-card {
    background: #111;
    border: 1px solid #222;
    border-radius: 6px;
    padding: 10px 12px;
    margin-bottom: 7px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    display: flex;
    align-items: center;
    gap: 10px;
}

.lo-w-card:hover:not(.lo-damaged) { border-color: #444; background: #141414; }
.lo-w-card.lo-equipped { border-color: #cc2200; background: rgba(204,34,0,0.07); }
.lo-w-card.lo-damaged  { border-color: #ff4444; background: rgba(255,68,68,0.05); cursor: default; }

.lo-w-icon {
    width: 32px;
    height: 32px;
    background: #1a1a1a;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    flex-shrink: 0;
}

.lo-w-info { flex: 1; min-width: 0; }

.lo-w-name {
    font-size: 13px;
    font-weight: 600;
    color: #e0e0e0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.lo-w-card.lo-equipped .lo-w-name { color: #fff; }
.lo-w-ammo { font-size: 10px; color: #444; margin-top: 1px; }

.lo-w-badge {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1px;
    padding: 3px 8px;
    border-radius: 3px;
    flex-shrink: 0;
    border: 1px solid transparent;
    background: none;
    cursor: inherit;
}

.lo-w-badge.lo-badge-on  { background: rgba(204,34,0,0.2); color: #cc2200; border-color: rgba(204,34,0,0.4); }
.lo-w-badge.lo-badge-off { color: #333; border-color: #222; }
.lo-w-badge.lo-badge-rep { background: rgba(255,68,68,0.15); color: #ff6666; border-color: rgba(255,68,68,0.3); cursor: pointer; }
.lo-w-badge.lo-badge-rep:hover { background: rgba(255,68,68,0.25); }

/* Armor column */
.lo-armor-slots {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 14px;
}

.lo-a-slot {
    background: #111;
    border: 1px dashed #222;
    border-radius: 6px;
    padding: 10px;
    text-align: center;
    min-height: 70px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    transition: border-style 0.15s, background 0.15s;
}

.lo-a-slot.lo-a-filled             { border-style: solid; background: rgba(204,34,0,0.04); }
.lo-a-slot[data-slot-type="head"]  { border-color: #7755aa; }
.lo-a-slot[data-slot-type="armor"] { border-color: #cc2200; }
.lo-a-slot[data-slot-type="pants"] { border-color: #226644; }
.lo-a-slot[data-slot-type="boots"] { border-color: #664400; }

.lo-a-slot-label {
    font-size: 8px;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 3px;
}

.lo-a-slot[data-slot-type="head"]  .lo-a-slot-label { color: #7755aa; }
.lo-a-slot[data-slot-type="armor"] .lo-a-slot-label { color: #cc2200; }
.lo-a-slot[data-slot-type="pants"] .lo-a-slot-label { color: #226644; }
.lo-a-slot[data-slot-type="boots"] .lo-a-slot-label { color: #664400; }

.lo-a-slot-name { font-size: 10px; color: #888; }
.lo-a-slot.lo-a-filled .lo-a-slot-name { color: #ddd; }
.lo-a-slot-stats { font-size: 9px; color: #444; margin-top: 2px; }

.lo-a-remove {
    font-size: 9px;
    color: #555;
    background: none;
    border: none;
    cursor: pointer;
    margin-top: 4px;
    padding: 0;
    appearance: none;
}

.lo-a-remove:hover { color: #ff4444; }
.lo-divider { height: 1px; background: #1a1a1a; margin: 10px 0; }

.lo-inv-label {
    font-size: 9px;
    letter-spacing: 2px;
    color: #333;
    text-transform: uppercase;
    margin-bottom: 8px;
}

.lo-a-inv-card {
    background: #111;
    border: 1px solid #1e1e1e;
    border-radius: 5px;
    padding: 8px 10px;
    margin-bottom: 6px;
    cursor: grab;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: border-color 0.15s, opacity 0.15s;
}

.lo-a-inv-card:hover { border-color: #333; }
.lo-a-inv-card.lo-inv-equipped { border-color: #cc2200; opacity: 0.5; }

.lo-a-inv-type {
    font-size: 8px;
    letter-spacing: 1px;
    color: #444;
    text-transform: uppercase;
    flex-shrink: 0;
    width: 34px;
}

.lo-a-inv-name { font-size: 11px; color: #bbb; flex: 1; }
.lo-a-inv-stat { font-size: 9px; color: #444; }

/* Stats column */
.lo-pts-banner {
    background: #111;
    border: 1px solid #222;
    border-radius: 5px;
    padding: 8px 12px;
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.lo-pts-label { font-size: 10px; color: #555; letter-spacing: 1px; text-transform: uppercase; }
.lo-pts-val   { font-size: 18px; font-weight: 700; color: #ffaa00; }

.lo-stat-row {
    margin-bottom: 8px;
    background: #111;
    border: 1px solid #1e1e1e;
    border-radius: 5px;
    padding: 9px 11px;
}

.lo-stat-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 5px;
}

.lo-stat-name { font-size: 11px; color: #aaa; }
.lo-stat-controls { display: flex; align-items: center; gap: 5px; }

.lo-stat-btn {
    width: 22px;
    height: 22px;
    border-radius: 3px;
    border: 1px solid #2a2a2a;
    background: #1a1a1a;
    color: #666;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    line-height: 1;
    padding: 0;
    transition: all 0.12s;
    appearance: none;
}

.lo-stat-btn.lo-btn-add                      { border-color: #cc2200; color: #cc2200; }
.lo-stat-btn.lo-btn-add:hover                { background: rgba(204,34,0,0.15); }
.lo-stat-btn:disabled                         { opacity: 0.3; cursor: default; }
.lo-stat-btn.lo-btn-rem:hover:not(:disabled) { border-color: #555; color: #aaa; }

.lo-stat-val {
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    width: 22px;
    text-align: center;
}

.lo-stat-bar-wrap { background: #1a1a1a; border-radius: 2px; height: 3px; }
.lo-stat-bar      { height: 3px; border-radius: 2px; transition: width 0.2s; }
.lo-stat-effect   { font-size: 9px; color: #333; margin-top: 4px; }
```

- [ ] **Step 3: Fix showScreen to use flex for loadout**

In `js/ui.js`, line 20, change:

```js
el.style.display = s === 'loadout-screen' ? 'block' : 'flex';
```

To:

```js
el.style.display = 'flex';
```

- [ ] **Step 4: Open war_zone.html in browser and navigate to Loadout**

Expected: the screen opens and shows three empty columns with red column headers ("WEAPONS", "ARMOR", "STATS") and a header bar with "LOADOUT" title and ← Back button. No content in the columns yet — that's correct at this stage.

- [ ] **Step 5: Commit**

```bash
git add war_zone/war_zone.html war_zone/styles.css war_zone/js/ui.js
git commit -m "feat: add three-column loadout skeleton and CSS"
```

---

## Task 2: Rewrite showLoadout()

**Files:**
- Modify: `war_zone/js/ui.js:341-690`

- [ ] **Step 1: Replace the entire showLoadout() function**

In `js/ui.js`, replace lines 341-690 (the full `showLoadout()` function and the `window.showLoadout = showLoadout;` line after it) with:

```js
export function showLoadout() {
    showScreen('loadout-screen');
    const maxSlots = gameState.pendingMode === 'pvp' ? 3 : 4;

    // ── Header meta ──
    const modeNames = { zombie: 'Zombie Apocalypse', rescue: 'Rescue Mission', pvp: 'PvP Arena' };
    document.getElementById('lo-meta-mode').textContent = modeNames[gameState.pendingMode] || '—';
    document.getElementById('lo-meta-slots').textContent = `${playerData.equippedLoadout.length} / ${maxSlots}`;
    document.getElementById('lo-meta-pts').textContent = playerData.statPoints;
    document.getElementById('lo-weapons-sub').textContent = `Click to equip · max ${maxSlots} slots`;

    // ── WEAPONS ──
    const weaponsBody = document.getElementById('lo-col-weapons-body');
    weaponsBody.innerHTML = '';

    for (const id of playerData.ownedWeapons) {
        const w = WEAPONS[id];
        if (w.type === 'utility') continue;
        const equipped = playerData.equippedLoadout.includes(id);
        const needsRepair = (playerData.weaponUsage[id] || 0) >= DAMAGE_THRESHOLD;

        const card = document.createElement('div');
        card.className = 'lo-w-card' +
            (equipped ? ' lo-equipped' : '') +
            (needsRepair ? ' lo-damaged' : '');

        const ammoText = w.type === 'melee' ? 'Melee' : `${w.maxAmmo} / ${w.maxAmmo}`;
        let badgeClass, badgeText, badgeTag;
        if (needsRepair) {
            badgeClass = 'lo-badge-rep'; badgeText = '⚠ REPAIR $50'; badgeTag = 'button';
        } else if (equipped) {
            badgeClass = 'lo-badge-on'; badgeText = 'EQUIPPED'; badgeTag = 'div';
        } else {
            badgeClass = 'lo-badge-off'; badgeText = 'equip'; badgeTag = 'div';
        }

        card.innerHTML = `
            <div class="lo-w-icon">⚔</div>
            <div class="lo-w-info">
                <div class="lo-w-name">${w.name}</div>
                <div class="lo-w-ammo">${ammoText}</div>
            </div>
            <${badgeTag} class="lo-w-badge ${badgeClass}">${badgeText}</${badgeTag}>
        `;

        if (needsRepair) {
            card.querySelector('.lo-w-badge').onclick = (e) => {
                e.stopPropagation();
                if (playerData.money >= 50) {
                    playerData.money -= 50;
                    playerData.weaponUsage[id] = 0;
                    savePlayerData();
                    showLoadout();
                }
            };
        } else {
            card.onclick = () => {
                if (equipped) {
                    playerData.equippedLoadout = playerData.equippedLoadout.filter(x => x !== id);
                } else {
                    if (playerData.equippedLoadout.length >= maxSlots) return;
                    playerData.equippedLoadout.push(id);
                }
                savePlayerData();
                showLoadout();
            };
        }
        weaponsBody.appendChild(card);
    }

    // ── ARMOR ──
    const armorBody = document.getElementById('lo-col-armor-body');
    armorBody.innerHTML = '';

    // Retroactively sync equipped armor into ownedArmor (legacy data support)
    for (const eqKey of ['equippedHelmet', 'equippedArmor', 'equippedPants', 'equippedBoots']) {
        const id = playerData[eqKey];
        if (id && !playerData.ownedArmor.includes(id)) playerData.ownedArmor.push(id);
    }

    const slotDefs = [
        { key: 'equippedHelmet', label: 'Helmet', slotType: 'head' },
        { key: 'equippedArmor',  label: 'Chest',  slotType: 'armor' },
        { key: 'equippedPants',  label: 'Legs',   slotType: 'pants' },
        { key: 'equippedBoots',  label: 'Boots',  slotType: 'boots' }
    ];

    const slotsGrid = document.createElement('div');
    slotsGrid.className = 'lo-armor-slots';

    for (const { key, label, slotType } of slotDefs) {
        const eq = playerData[key] ? EQUIPMENT[playerData[key]] : null;
        const slotDiv = document.createElement('div');
        slotDiv.className = 'lo-a-slot' + (eq ? ' lo-a-filled' : '');
        slotDiv.dataset.slotType = slotType;

        let statsHtml = '';
        if (eq) {
            const parts = [];
            if (eq.armor) parts.push(`${eq.armor} armor`);
            if (eq.damageReduction) parts.push(`${Math.round(eq.damageReduction * 100)}% DR`);
            if (parts.length) statsHtml = `<div class="lo-a-slot-stats">${parts.join(' · ')}</div>`;
        }

        slotDiv.innerHTML = `
            <div class="lo-a-slot-label">${label}</div>
            <div class="lo-a-slot-name">${eq ? eq.name : '— empty —'}</div>
            ${statsHtml}
            ${eq ? `<button class="lo-a-remove">✕ remove</button>` : ''}
        `;

        if (eq) {
            slotDiv.querySelector('.lo-a-remove').onclick = (e) => {
                e.stopPropagation();
                playerData[key] = null;
                savePlayerData();
                showLoadout();
            };
        }

        slotDiv.addEventListener('dragover', e => {
            e.preventDefault();
            slotDiv.style.borderStyle = 'solid';
            slotDiv.style.background = 'rgba(255,255,255,0.05)';
        });
        slotDiv.addEventListener('dragleave', () => {
            slotDiv.style.borderStyle = playerData[key] ? 'solid' : 'dashed';
            slotDiv.style.background = playerData[key] ? 'rgba(204,34,0,0.04)' : '';
        });
        slotDiv.addEventListener('drop', e => {
            e.preventDefault();
            slotDiv.style.borderStyle = playerData[key] ? 'solid' : 'dashed';
            slotDiv.style.background = playerData[key] ? 'rgba(204,34,0,0.04)' : '';
            const armorId = e.dataTransfer.getData('armorId');
            const armorType = e.dataTransfer.getData('armorType');
            if (armorType === slotType) {
                playerData[key] = armorId;
                savePlayerData();
                window._updateTpArmor?.();
                showLoadout();
            } else {
                slotDiv.style.borderColor = '#ff2222';
                setTimeout(() => { slotDiv.style.borderColor = ''; }, 600);
            }
        });

        slotsGrid.appendChild(slotDiv);
    }
    armorBody.appendChild(slotsGrid);

    const divider = document.createElement('div');
    divider.className = 'lo-divider';
    armorBody.appendChild(divider);

    const invLabel = document.createElement('div');
    invLabel.className = 'lo-inv-label';
    invLabel.textContent = 'Owned Armor — drag to equip';
    armorBody.appendChild(invLabel);

    const typeToKey = { head: 'equippedHelmet', armor: 'equippedArmor', pants: 'equippedPants', boots: 'equippedBoots' };
    const typeLabel = { head: 'Head', armor: 'Chest', pants: 'Legs', boots: 'Boots' };

    if (playerData.ownedArmor.length > 0) {
        for (const id of playerData.ownedArmor) {
            const eq = EQUIPMENT[id];
            if (!eq) continue;
            const eqKey = typeToKey[eq.type];
            const isEquipped = playerData[eqKey] === id;

            const card = document.createElement('div');
            card.className = 'lo-a-inv-card' + (isEquipped ? ' lo-inv-equipped' : '');
            card.draggable = true;

            const parts = [];
            if (eq.armor) parts.push(`${eq.armor} arm`);
            if (eq.damageReduction) parts.push(`${Math.round(eq.damageReduction * 100)}% DR`);

            card.innerHTML = `
                <div class="lo-a-inv-type">${typeLabel[eq.type] || eq.type}</div>
                <div class="lo-a-inv-name">${eq.name}</div>
                <div class="lo-a-inv-stat">${parts.join(' · ')}</div>
            `;

            card.addEventListener('dragstart', e => {
                e.dataTransfer.setData('armorId', id);
                e.dataTransfer.setData('armorType', eq.type);
                card.style.opacity = '0.5';
            });
            card.addEventListener('dragend', () => { card.style.opacity = ''; });

            armorBody.appendChild(card);
        }
    } else {
        const empty = document.createElement('div');
        empty.style.cssText = 'color:#555;font-size:12px;font-style:italic;padding:4px 0;';
        empty.textContent = 'No armor owned — visit the Shop to purchase.';
        armorBody.appendChild(empty);
    }

    // ── STATS ──
    const statsBody = document.getElementById('lo-col-stats-body');
    statsBody.innerHTML = '';

    const ptsBanner = document.createElement('div');
    ptsBanner.className = 'lo-pts-banner';
    ptsBanner.innerHTML = `
        <div class="lo-pts-label">Available Points</div>
        <div class="lo-pts-val" id="lo-stat-pts-val">${playerData.statPoints}</div>
    `;
    statsBody.appendChild(ptsBanner);

    const statDefs = [
        { key: 'health',       label: 'Health',       color: '#00ff88', desc: '+5 max HP per point' },
        { key: 'speed',        label: 'Speed',         color: '#00aaff', desc: '+2% sprint speed per point' },
        { key: 'damage',       label: 'Damage',        color: '#ff4444', desc: '+2% dmg · +5% headshot per point' },
        { key: 'stamina',      label: 'Stamina',       color: '#ffaa00', desc: '+10 max stamina per point' },
        { key: 'staminaRegen', label: 'Stamina Regen', color: '#ffcc44', desc: '+10% regen rate per point' },
        { key: 'jump',         label: 'Jump Height',   color: '#aa66ff', desc: '+charge height per point' },
        { key: 'reload',       label: 'Reload Time',   color: '#00ddff', desc: '-5% reload time per point' }
    ];

    for (const { key, label, color, desc } of statDefs) {
        const pts = playerData.stats[key];
        const barPct = Math.min(100, (pts / 10) * 100);

        const row = document.createElement('div');
        row.className = 'lo-stat-row';
        row.innerHTML = `
            <div class="lo-stat-top">
                <div class="lo-stat-name">${label}</div>
                <div class="lo-stat-controls">
                    <button class="lo-stat-btn lo-btn-rem" ${pts < 1 ? 'disabled' : ''}>−</button>
                    <div class="lo-stat-val">${pts}</div>
                    <button class="lo-stat-btn lo-btn-add" ${playerData.statPoints < 1 ? 'disabled' : ''}>+</button>
                </div>
            </div>
            <div class="lo-stat-bar-wrap">
                <div class="lo-stat-bar" style="background:${color};width:${barPct}%"></div>
            </div>
            <div class="lo-stat-effect">${desc}</div>
        `;

        const remBtn = row.querySelector('.lo-btn-rem');
        const addBtn = row.querySelector('.lo-btn-add');
        const valEl  = row.querySelector('.lo-stat-val');
        const barEl  = row.querySelector('.lo-stat-bar');

        remBtn.onclick = () => {
            if (playerData.stats[key] < 1) return;
            playerData.stats[key]--;
            playerData.statPoints++;
            savePlayerData();
            valEl.textContent = playerData.stats[key];
            barEl.style.width = `${Math.min(100, (playerData.stats[key] / 10) * 100)}%`;
            document.getElementById('lo-stat-pts-val').textContent = playerData.statPoints;
            document.getElementById('lo-meta-pts').textContent = playerData.statPoints;
            remBtn.disabled = playerData.stats[key] < 1;
            addBtn.disabled = false;
        };

        addBtn.onclick = () => {
            if (playerData.statPoints < 1) return;
            playerData.stats[key]++;
            playerData.statPoints--;
            savePlayerData();
            valEl.textContent = playerData.stats[key];
            barEl.style.width = `${Math.min(100, (playerData.stats[key] / 10) * 100)}%`;
            document.getElementById('lo-stat-pts-val').textContent = playerData.statPoints;
            document.getElementById('lo-meta-pts').textContent = playerData.statPoints;
            addBtn.disabled = playerData.statPoints < 1;
            remBtn.disabled = false;
        };

        statsBody.appendChild(row);
    }
}
window.showLoadout = showLoadout;
```

- [ ] **Step 2: Open war_zone.html and test the weapons column**

Open Loadout from the homepage. Expected:
- Header shows mode name, slots count, stat points
- Weapons column: each owned weapon appears as a card with name and ammo line
- Clicking an unequipped weapon equips it (card gets red border); clicking again unequips
- Damaged weapons show "⚠ REPAIR $50" badge; clicking it deducts $50 and removes the damaged state
- Slots counter in header updates after each equip/unequip

- [ ] **Step 3: Test the armor column**

Expected:
- 2×2 slot grid shows helmet/chest/legs/boots with correct color borders
- Filled slots show the equipped armor name and condensed stats; empty slots show "— empty —"
- "✕ remove" button on filled slots unequips the armor
- Owned armor inventory shows below the divider as draggable rows
- Drag an inventory card to a matching slot → armor equips and screen re-renders
- Drag to wrong slot → slot border flashes red briefly, nothing equips

- [ ] **Step 4: Test the stats column**

Expected:
- Available points banner shows current `playerData.statPoints` in yellow
- 7 stat rows each show name, +/− buttons, colored bar, and effect description
- Clicking + spends 1 point: value increments, bar grows, banner updates, + disables when points reach 0
- Clicking − refunds 1 point: value decrements, bar shrinks, banner updates, − disables when stat reaches 0
- All values persist after navigating away and back (localStorage)

- [ ] **Step 5: Commit**

```bash
git add war_zone/js/ui.js
git commit -m "feat: rewrite showLoadout() for three-column layout"
```

---

## Task 3: CLAUDE.md Update + Final Commit

**Files:**
- Modify: `war_zone/CLAUDE.md`

- [ ] **Step 1: Update the homepage layout section in CLAUDE.md**

In `war_zone/CLAUDE.md`, find the `**Homepage layout:**` paragraph and add a new paragraph immediately after it describing the new loadout layout:

```
**Loadout layout:** `#loadout-screen` uses a three-column fixed-height flex layout (`display:flex; flex-direction:column`). Structure: `.lo-header` (title + mode/slots/pts meta + back button, red border-bottom), `.lo-body` (flex row of three `.lo-col` divs). Columns: `.lo-col-weapons` (flex 1.2) — vertical list of `.lo-w-card` items, click to equip; `.lo-col-armor` (flex 1.1) — 2×2 `.lo-armor-slots` grid at top (drag-drop targets) + `.lo-a-inv-card` inventory list below; `.lo-col-stats` (flex 1) — `.lo-pts-banner` + 7 `.lo-stat-row` items with +/− buttons. Theme: `#cc2200` red accents on `#0a0a0a` background (matches homepage/shop). Key IDs: `lo-meta-mode`, `lo-meta-slots`, `lo-meta-pts`, `lo-weapons-sub`, `lo-col-weapons-body`, `lo-col-armor-body`, `lo-col-stats-body`, `lo-stat-pts-val`.
```

- [ ] **Step 2: Final browser check**

Open `war_zone.html`. Navigate: Homepage → Loadout → select a game mode → Loadout again.

Confirm all three columns render correctly, the back button returns to homepage, and no console errors appear (check DevTools console).

- [ ] **Step 3: Commit**

```bash
git add war_zone/CLAUDE.md
git commit -m "docs: update CLAUDE.md with new loadout layout"
```
