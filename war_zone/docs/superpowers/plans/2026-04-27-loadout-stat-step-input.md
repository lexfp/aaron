# Loadout Stat Step Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-row number input to each stat row in the loadout screen so clicking + or − applies that many points at once instead of always one.

**Architecture:** Single-file change. The stat-building loop in `showLoadout()` gains a step input element between the value display and the + button. Both button handlers read the input at click time and clamp to available budget.

**Tech Stack:** Vanilla JS, CSS — no build step, no test framework (browser game).

---

## File Map

| File | Change |
|------|--------|
| `war_zone/styles.css` | Add `.lo-stat-step` input styles (lines ~1013) |
| `war_zone/js/ui.js` | Modify stat-row HTML template and button handlers (lines ~583–627) |

---

### Task 1: Add CSS for the step input

**Files:**
- Modify: `war_zone/styles.css` (after line 1013, after `.lo-stat-effect` rule)

- [ ] **Step 1: Insert CSS rule after `.lo-stat-effect`**

Open `styles.css`. Find this line (around line 1013):
```css
.lo-stat-effect   { font-size: 9px; color: #333; margin-top: 4px; }
```

Insert immediately after it:
```css
.lo-stat-step {
    width: 38px;
    background: #1a0a0a;
    border: 1px solid #cc2200;
    color: #fff;
    font-size: 12px;
    font-family: inherit;
    text-align: center;
    padding: 2px 0;
    border-radius: 2px;
}
.lo-stat-step::-webkit-inner-spin-button,
.lo-stat-step::-webkit-outer-spin-button { display: none; }
.lo-stat-step:focus { outline: none; border-color: #ff4422; }
```

- [ ] **Step 2: Commit**

```bash
git add war_zone/styles.css
git commit -m "feat: add lo-stat-step input styles"
```

---

### Task 2: Add step input to stat-row HTML template

**Files:**
- Modify: `war_zone/js/ui.js` (lines ~583–596)

- [ ] **Step 1: Replace the `row.innerHTML` template**

Find this block inside the `showLoadout()` stat loop (starts around line 583):

```js
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
```

Replace with:

```js
        row.innerHTML = `
            <div class="lo-stat-top">
                <div class="lo-stat-name">${label}</div>
                <div class="lo-stat-controls">
                    <button class="lo-stat-btn lo-btn-rem" ${pts < 1 ? 'disabled' : ''}>−</button>
                    <div class="lo-stat-val">${pts}</div>
                    <input class="lo-stat-step" type="number" value="1" min="1">
                    <button class="lo-stat-btn lo-btn-add" ${playerData.statPoints < 1 ? 'disabled' : ''}>+</button>
                </div>
            </div>
            <div class="lo-stat-bar-wrap">
                <div class="lo-stat-bar" style="background:${color};width:${barPct}%"></div>
            </div>
            <div class="lo-stat-effect">${desc}</div>
        `;
```

- [ ] **Step 2: Commit**

```bash
git add war_zone/js/ui.js
git commit -m "feat: add step input element to stat-row template"
```

---

### Task 3: Update button handlers to use step value

**Files:**
- Modify: `war_zone/js/ui.js` (lines ~598–627)

- [ ] **Step 1: Add `stepEl` selector after the existing selectors**

Find these lines (around line 598–601):
```js
        const remBtn = row.querySelector('.lo-btn-rem');
        const addBtn = row.querySelector('.lo-btn-add');
        const valEl  = row.querySelector('.lo-stat-val');
        const barEl  = row.querySelector('.lo-stat-bar');
```

Replace with:
```js
        const remBtn = row.querySelector('.lo-btn-rem');
        const addBtn = row.querySelector('.lo-btn-add');
        const valEl  = row.querySelector('.lo-stat-val');
        const barEl  = row.querySelector('.lo-stat-bar');
        const stepEl = row.querySelector('.lo-stat-step');
```

- [ ] **Step 2: Replace `remBtn.onclick` handler**

Find:
```js
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
```

Replace with:
```js
        remBtn.onclick = () => {
            const step = Math.max(1, parseInt(stepEl.value) || 1);
            const remove = Math.min(step, playerData.stats[key]);
            if (remove < 1) return;
            playerData.stats[key] -= remove;
            playerData.statPoints += remove;
            savePlayerData();
            valEl.textContent = playerData.stats[key];
            barEl.style.width = `${Math.min(100, (playerData.stats[key] / 10) * 100)}%`;
            document.getElementById('lo-stat-pts-val').textContent = playerData.statPoints;
            document.getElementById('lo-meta-pts').textContent = playerData.statPoints;
            remBtn.disabled = playerData.stats[key] < 1;
            addBtn.disabled = playerData.statPoints < 1;
        };
```

- [ ] **Step 3: Replace `addBtn.onclick` handler**

Find:
```js
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
```

Replace with:
```js
        addBtn.onclick = () => {
            const step = Math.max(1, parseInt(stepEl.value) || 1);
            const add = Math.min(step, playerData.statPoints);
            if (add < 1) return;
            playerData.stats[key] += add;
            playerData.statPoints -= add;
            savePlayerData();
            valEl.textContent = playerData.stats[key];
            barEl.style.width = `${Math.min(100, (playerData.stats[key] / 10) * 100)}%`;
            document.getElementById('lo-stat-pts-val').textContent = playerData.statPoints;
            document.getElementById('lo-meta-pts').textContent = playerData.statPoints;
            addBtn.disabled = playerData.statPoints < 1;
            remBtn.disabled = playerData.stats[key] < 1;
        };
```

- [ ] **Step 4: Commit**

```bash
git add war_zone/js/ui.js
git commit -m "feat: step input drives +/- point allocation in loadout stats"
```

---

### Task 4: Manual verification

**Files:** None — browser test only.

- [ ] **Step 1: Open the game**

Open `war_zone/war_zone.html` in a browser. Navigate to Loadout.

- [ ] **Step 2: Verify step input appears**

Each stat row should show: `[−]  [current value]  [38px input defaulting to 1]  [+]`

- [ ] **Step 3: Test step=1 (default behavior)**

With step input at `1`, click + on Health. Stat increases by 1, available points decrease by 1. Click −. Stat decreases by 1, points restored. Matches old behavior.

- [ ] **Step 4: Test bulk add**

Set step input to `5` on Health. Click +. Stat increases by 5, points decrease by 5.

- [ ] **Step 5: Test clamping — add**

With only 3 points remaining, set step to `10`, click +. Stat increases by exactly 3 (all remaining points). Available points reaches 0. + button disables.

- [ ] **Step 6: Test clamping — remove**

With Health at 2, set step to `10`, click −. Stat decreases by exactly 2 (down to 0). − button disables.

- [ ] **Step 7: Test step=0 / invalid input**

Clear the step input (empty). Click + or −. Should treat step as 1, apply one point.
