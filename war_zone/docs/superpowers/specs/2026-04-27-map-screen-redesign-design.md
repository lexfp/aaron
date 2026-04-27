# Map Screen Redesign — Design Spec

**Date:** 2026-04-27  
**Status:** Approved

---

## Goal

Replace the current map selection screen (blue gradient, blue accents, plain h2 header, rounded grid cards) with the same dark military theme used by the homepage, shop, and loadout screens (flat `#0a0a0a` background, `#cc2200` red accents, structured header/footer, military typography).

---

## Chosen Layout: Two-Column Split

Left panel: scrollable list of all 8 maps. Right panel: full-bleed preview image + map name/description/tags for the currently selected map. Red "Deploy" button in the footer launches the game.

---

## Structure

### HTML (`war_zone.html`)

Replace the existing `#map-screen` div:

```html
<div id="map-screen">
  <div class="ms-header">
    <div class="ms-title">SELECT MAP</div>
    <div class="ms-mode-badge" id="ms-mode-badge">Mode: —</div>
    <button class="ms-back-btn" onclick="showScreen('homepage')">← Back</button>
  </div>
  <div class="ms-body">
    <div class="ms-list" id="ms-list">
      <!-- populated by renderMapScreen() -->
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

### CSS (`styles.css`)

Remove all existing `#map-screen`, `.map-grid`, `.map-card` rules. Add:

- `#map-screen` — `display:none; position:fixed; inset:0; flex-direction:column; background:#0a0a0a; z-index:100`
- `.ms-header` — flex row, `padding:14px 24px`, `border-bottom:1px solid #1e1515`, red left bar via `::before` (same pattern as `.shop-header::before` and `.lo-header::before`)
- `.ms-title` — `font-size:18px; font-weight:900; letter-spacing:4px; color:#fff`
- `.ms-mode-badge` — small uppercase label showing the pending game mode, `color:#444; border:1px solid #1a1a1a`
- `.ms-back-btn` — same style as `.shop-back-btn` (border `#333`, color `#666`, hover: red border + white text)
- `.ms-body` — `display:flex; flex:1; overflow:hidden`
- `.ms-list` — `width:220px; background:#080808; border-right:1px solid #1a1a1a; overflow-y:auto`
- `.ms-item` — flex row, `padding:9px 14px`, `border-left:2px solid transparent`; hover: dark red bg + `border-left-color:#662200`; `.active`: `background:#130d0d; border-left-color:#cc2200`
- `.ms-item-dot` — `5px` circle, `#222` default, `#cc2200` when `.active`
- `.ms-item-name` — `10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#666`; active → `#fff`
- `.ms-item-size` — `8px; color:#333`; active → `#553333`
- `.ms-preview` — `flex:1; display:flex; flex-direction:column; overflow:hidden`
- `.ms-img-wrap` — `flex:1; position:relative; background:#0d0d0d`
- `.ms-img` — `width:100%; height:100%; object-fit:cover; opacity:0.65`
- `.ms-img-overlay` — `position:absolute; inset:0; background: linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.5) 65%, rgba(0,0,0,0.92) 100%)`
- `.ms-img-content` — `position:absolute; bottom:0; left:0; right:0; padding:20px 24px 18px`
- `.ms-map-name` — `font-size:26px; font-weight:900; letter-spacing:3px; text-transform:uppercase; color:#fff`
- `.ms-map-desc` — `font-size:12px; color:#888; margin-top:6px; line-height:1.5`
- `.ms-map-tags` — flex row, `gap:6px; margin-top:10px`
- `.ms-tag` — `font-size:8px; letter-spacing:1.5px; text-transform:uppercase; color:#444; border:1px solid #1a1a1a; padding:2px 8px`
- `.ms-footer` — `padding:12px 24px; border-top:1px solid #1a1a1a; background:#080808; display:flex; align-items:center; justify-content:space-between`
- `.ms-deploy-btn` — `background:#cc2200; color:#fff; font-weight:700; letter-spacing:2px; text-transform:uppercase; padding:10px 28px; border:none`; hover: `#ff3300`

### JS (`js/ui.js` — `renderMapScreen`)

Rewrite `renderMapScreen(startGameFn)`:

1. Update `#ms-mode-badge` with `gameState.pendingMode`
2. Build list items in `#ms-list` for each map in `MAPS`
3. Each item: clicking it calls `selectMap(id)` — does NOT launch the game
4. `selectMap(id)`: updates active class on list items; updates `#ms-preview-img` src, `#ms-preview-name`, `#ms-preview-desc`, `#ms-preview-tags`; updates `#ms-deploy-btn` text to `Deploy to [Map Name] →`; stores selected map id
5. `#ms-deploy-btn` onclick: calls `startGameFn(gameState.pendingMode, selectedMapId)`
6. Auto-select first map when screen opens (pre-populate preview)
7. Cave has no image — `#ms-preview-img` gets `display:none` and `ms-img-wrap` shows a dark placeholder

### Map metadata for list items

| Map | Size label | Environment |
|-----|-----------|-------------|
| warehouse | Small | Indoor |
| city | Large | Outdoor |
| desert | Large | Outdoor |
| forest | Large | Outdoor |
| mountain | Large | Outdoor |
| fortress | Medium | Mixed |
| hallway | Medium | Indoor |
| cave | Medium | Underground |

Map tags are derived from size/environment — no new data fields needed in `data.js`.

---

## What Does Not Change

- `MAPS` data in `data.js` — no new fields
- Game launch logic — `startGameFn(mode, mapId)` signature unchanged
- `showScreen()` already handles `map-screen` visibility
- Map image filenames in `Pictures/` unchanged

---

## Out of Scope

- Interactive tags/filters
- Animated transitions between map previews
- Locked/unlocked map states
