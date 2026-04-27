# Loadout Stat Step Input — Design Spec

**Date:** 2026-04-27  
**Status:** Approved

## Overview

Replace the single-step +/− buttons on each loadout stat row with a per-row step input. The user types a number into the input to set the step size, then clicks + or − to apply that many points at once.

## Layout Change

Each stat row's controls strip changes from:

```
[−]  [value]  [+]
```

to:

```
[−]  [value]  [step input]  [+]
```

- `.lo-stat-val` — existing read-only current value display, unchanged
- New `<input type="number">` — step field, default `1`, positioned between value and + button

## Behavior

| Action | Result |
|--------|--------|
| Click + | Adds `min(step, playerData.statPoints)` to stat |
| Click − | Subtracts `min(step, playerData.stats[key])` from stat |
| Step < 1 | Treated as 1 (no-op protection) |
| Step > available points | Clamped to available points (add direction) |
| Step > current stat value | Clamped to current stat value (remove direction) |

Both buttons remain individually disabled when the normal single-step operation would be impossible (statPoints < 1 for +, stats[key] < 1 for −). The step input does not affect disabled state.

## Styling

- Width: `38px`
- Background: `#1a0a0a`
- Border: `1px solid #cc2200`
- Text color: `#ffffff`
- Font: inherit (matches row)
- No spinner arrows: `input[type=number]::-webkit-inner-spin-button { display:none }`
- `min="1"`, no enforced `max`
- Matches existing military dark theme (`#0a0a0a` bg, `#cc2200` red accents)

## Scope

- **Only file changed:** `js/ui.js`
- Inside the `showLoadout()` stat-building loop (lines ~583–627)
- No changes to `state.js`, `data.js`, or any other module
- No new files

## Non-Goals

- No global/shared step input
- No Enter-key-to-apply behavior
- No persistence of step values between sessions
