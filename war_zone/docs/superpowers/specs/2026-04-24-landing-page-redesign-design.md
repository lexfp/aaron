# Landing Page Redesign — Design Spec
Date: 2026-04-24

## Summary

Redesign `war_zone/war_zone.html`'s homepage (`#homepage`) from a single centered column of stacked buttons into a two-panel split layout. Nothing changes for the HUD, overlays, shop, loadout, map screen, or any other screen — only the `#homepage` div and its CSS.

---

## Layout

**Split Panel** — two side-by-side columns filling the full viewport (`position: fixed; inset: 0`), no scrolling.

### Left Panel (~280px wide)
- Fixed width, full height, dark background (`#0d0b0b`)
- 3px red accent bar on the very left edge (gradient, not solid)
- **Top section:** stacked `WAR / ZONE` title (large, red gradient), subtitle, a short horizontal divider, then live player stats (Money, Level, Missions)
- **Bottom section:** "Options" section label + 5 utility buttons (Shop, Loadout, Tutorial, Keybinds, Achievements) — each a full-width bordered card with an emoji icon and all-caps label
- Utility buttons on hover: slide 3px right, border + text turn red

### Right Panel (flex: 1)
- Fills remaining width, dark background (`#0b0b0b`)
- "Select Game Mode" section label at top
- 3 game mode rows (Zombie Apocalypse, Rescue Mission, PvP Arena), each a full-width bordered card containing:
  - 4px left stripe (dark red at rest, bright red on hover)
  - Emoji icon (36px)
  - Mode name (18px, bold, all-caps) + description line
  - Right arrow `›`
- On hover: row slides 4px right, left stripe + name + arrow turn bright red (`#ff4444`), arrow translates forward

---

## Visual Style

**Dark Military** — near-black backgrounds, red as the single accent color, no glow/blur effects, subtle scanline texture overlay.

| Element | Value |
|---|---|
| Left panel bg | `#0d0b0b` |
| Right panel bg | `#0b0b0b` |
| Title | Gradient `#ff4444 → #cc2222 → #8a1515` |
| Accent stripe | `#cc2222` |
| Stat values | `#cc4444` |
| Button border (rest) | `#2a1818` |
| Button border (hover) | `#cc3333` / `#ff4444` |
| Mode stripe (rest) | `#3a1515` |
| Mode stripe (hover) | `#ff4444` |
| Scanline texture | `repeating-linear-gradient`, 4px pitch, 4% opacity |

---

## Implementation Scope

- Modify `#homepage` CSS in `styles.css`: change from `flex-direction: column; align-items: center; justify-content: center` to the two-column flex layout
- Remove the old `#homepage h1`, `.subtitle`, `.menu-btn`, `.player-stats` rules (or replace them entirely)
- Add new CSS classes for: `.home-left`, `.home-right`, `.home-title`, `.home-stats`, `.util-btn`, `.mode-row`, `.mode-stripe`, `.mode-inner`
- Modify `#homepage` HTML in `war_zone.html` to match the new structure — existing button IDs (`btn-zombie`, `btn-rescue`, `btn-pvp`, `btn-shop`, `btn-loadout`) must be preserved so `main.js` event listeners continue to work
- The `.menu-btn` class is also used by pause menu and round overlay — those rules must be preserved or the new homepage buttons must use different class names
- Revert the `clamp()`-based changes made earlier (they are superseded by this redesign)

---

## Constraints

- No changes to JS files
- Preserve all existing button `id` attributes
- `.menu-btn` class used outside homepage (pause menu, return-home button) — keep those styles intact; homepage buttons get a new class
- Must work without a build step (plain HTML/CSS)
- No external dependencies added
