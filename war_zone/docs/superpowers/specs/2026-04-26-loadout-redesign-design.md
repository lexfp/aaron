# Loadout Screen Redesign — Design Spec
Date: 2026-04-26

## Summary

Replace the current single-scroll loadout page with a three-column fixed-height layout using the red military theme that matches the homepage and shop. All existing game logic is preserved; only the UI structure and visual style change.

---

## Layout

Full-viewport-height screen. No page-level scroll — each column scrolls independently.

```
┌──────────────────────────────────────────────────────────┐
│  LOADOUT   Mode: Zombie Apocalypse  Slots: 2/4  Pts: 3  ← Back │
├──────────────────┬───────────────┬─────────────────────────┤
│    WEAPONS       │     ARMOR     │         STATS           │
│  (flex 1.2)      │  (flex 1.1)   │       (flex 1)          │
│                  │               │                         │
│  scrollable list │ 2×2 slot grid │  available pts banner   │
│  of weapon cards │  ──────────   │  7 compact stat rows    │
│                  │  drag-drop    │                         │
│                  │  inventory    │                         │
└──────────────────┴───────────────┴─────────────────────────┘
```

### Header Bar
- Left: "LOADOUT" title (red, large letter-spacing)
- Center: Mode name · Slots counter (e.g. "2 / 4") · Stat Points (yellow)
- Right: ← Back button (grey, hover → white)

---

## Weapons Column

**Header:** "WEAPONS" (red, uppercase) · "Click to equip · max N slots" (N = 3 for PvP, 4 otherwise)

**Weapon cards** — vertical list, not grid. Each card contains:
- Icon area (32×32 box)
- Weapon name + ammo line (e.g. "17 / 17 · semi-auto" or "Melee")
- State badge (right-aligned):
  - Equipped: red border + red-tinted background + "EQUIPPED" badge
  - Unequipped: dark border + "equip" ghost badge
  - Damaged: red-alert border + "⚠ REPAIR $50" badge; clicking the badge repairs (deducts $50, resets usage); clicking elsewhere on a damaged card does nothing (cannot equip while damaged)

**Behavior unchanged:** click card to toggle equip/unequip; max slots enforced; utility items (compass, flashlight) hidden.

---

## Armor Column

**Header:** "ARMOR" (red, uppercase) · "Drag inventory → slot to equip"

### Equip Slots (top section)
2×2 grid. Four slots: Helmet (purple), Chest (red), Legs (green), Boots (brown). Each slot:
- Empty: dashed border in slot color + "— empty —" text
- Filled: solid border + armor name + condensed stats (e.g. "25 armor · 10% DR")
- Small ✕ remove button when filled

### Divider + Inventory (below)
Label: "Owned Armor — drag to equip"

Draggable inventory cards, each showing:
- Slot type label (e.g. "Chest")
- Armor name
- Condensed stats (armor value + DR%)
- Currently-equipped items rendered at 50% opacity (still draggable)

**Drag-and-drop fully preserved.** Drop validation (type must match slot) and red flash on mismatch unchanged. SVG armor icons removed — replaced by text stats for compactness.

---

## Stats Column

**Header:** "STATS" (red, uppercase) · "Spend points to upgrade"

**Available points banner:** full-width row showing the unallocated point count in yellow (#ffaa00).

**7 stat rows** (Health, Speed, Damage, Stamina, Stamina Regen, Jump Height, Reload Time). Each row:
- Stat name (left) + − / value / + controls (right)
- Thin colored progress bar (each stat keeps its existing color)
- One-line effect summary below bar (e.g. "+10 max HP", "+2% sprint speed")

**Simplification from current:** bulk quantity input removed. Each +/− click allocates/removes exactly 1 point. All underlying stat formulas and save logic unchanged.

---

## Theme

| Token | Value |
|---|---|
| Page background | `#0a0a0a` |
| Column background | `#0d0d0d` / `#111` |
| Column borders | `#1a1a1a` |
| Accent (headers, equipped) | `#cc2200` |
| Stat points value | `#ffaa00` |
| Body text | `#e0e0e0` |
| Subdued text | `#444`–`#555` |
| Stat bar colors | per-stat (unchanged: green/blue/red/orange/yellow/purple/cyan) |

Removes: the old orange/gold (#ffaa00) weapon equipped color, the dark gradient background, and the centered h2 title.

---

## What Changes vs. Current

| Area | Before | After |
|---|---|---|
| Layout | Single vertical scroll | Three fixed-height columns |
| Weapons | `auto-fill` grid | Vertical list with state badges |
| Armor slots | Large drop targets with SVG icons | Compact 2×2 grid, text stats only |
| Armor inventory | Full-size draggable cards with SVGs | Compact rows (type · name · stats) |
| Stats UI | 7 bulky cards with quantity input + two buttons | 7 slim rows with bar + single +/− |
| Theme | Orange/gold on dark gradient | Red (#cc2200) on near-black |
| Header | Centered `h2` | Structured bar with metadata |

## What Stays the Same

- All drag-and-drop armor logic and drop validation
- Click-to-equip weapons, max slots, PvP slot count (3)
- Repair mechanic ($50, resets `weaponUsage`)
- All 7 stat formulas and `playerData` save/load
- Utility item hiding (compass, flashlight)
- `showLoadout()` entry point and screen transition

---

## Files to Change

| File | Change |
|---|---|
| `war_zone.html` | Replace `#loadout-screen` inner HTML with three-column skeleton |
| `styles.css` | Replace all `.loadout-*` rules with new column layout CSS |
| `js/ui.js` | Rewrite `showLoadout()` to render three-column structure; simplify stat controls |
