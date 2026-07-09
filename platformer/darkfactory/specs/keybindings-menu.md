# SPEC: Keybindings Menu

## Goal
A player can rebind any of the 11 platformer control actions to their preferred keyboard keys so that they can play with a control scheme that suits them, persisted across sessions.

## Requirements
1. When `state.js` loads, it exports `DEFAULT_KEYBINDS`, an object mapping each of the 11 action keys (`moveLeft`, `moveRight`, `jump`, `dash`, `slide`, `attack`, `special1`, `special2`, `special3`, `special4`, `special5`) to an array of `KeyboardEvent.code` strings equal to: `moveLeft:['ArrowLeft','KeyA']`, `moveRight:['ArrowRight','KeyD']`, `jump:['Space','ArrowUp','KeyW']`, `dash:['ShiftLeft','ShiftRight']`, `slide:['ArrowDown','KeyS']`, `attack:['KeyJ','KeyX','KeyK','KeyF','Enter']`, `special1:['KeyQ']`, `special2:['KeyE']`, `special3:['KeyR']`, `special4:['KeyT']`, `special5:['KeyG']`.
2. When `state.js` loads, it exports `KEYBIND_ACTIONS`, an ordered array of `{key, label}` objects in this exact order: `moveLeft`="Move Left", `moveRight`="Move Right", `jump`="Jump", `dash`="Dash", `slide`="Slide (hold, ground+moving)", `attack`="Attack", `special1`="Special Slot 1", `special2`="Special Slot 2", `special3`="Special Slot 3", `special4`="Special Slot 4", `special5`="Special Slot 5".
3. When `loadPlayerData()` runs against a save with no `keybinds` field, the loaded `playerData.keybinds` equals a deep copy of `DEFAULT_KEYBINDS` (no shared array references with `DEFAULT_KEYBINDS`).
4. When `loadPlayerData()` runs against a save whose `keybinds` object is missing one or more of the 11 action keys, each missing action is filled from `DEFAULT_KEYBINDS` while each present action retains its saved value (per-action deep merge, same pattern as `upgrades`).
5. When `getKeybinds()` is called, it returns the current live `playerData.keybinds` object (reflecting any rebind performed earlier in the same session), not a snapshot captured at module load.
6. When `setKeybind(action, code)` is called with a `code` that is not `'Escape'` and is not currently present in any other action's bound array, the system sets `playerData.keybinds[action] = [code]` (a single-element array replacing the prior value), calls `savePlayerData()`, and returns `{ok:true}`.
7. When `setKeybind(action, code)` is called with a `code` already bound to a different action, the system makes no change to `playerData.keybinds`, does not call `savePlayerData()`, and returns `{ok:false, conflictAction}` where `conflictAction` is the action key holding that code.
8. When `setKeybind(action, 'Escape')` is called, the system makes no change and returns `{ok:false}` (Escape can never be assigned).
9. When `resetKeybinds()` is called, `playerData.keybinds` becomes a deep copy of `DEFAULT_KEYBINDS` (all 11 actions restored to their full default arrays including multi-key defaults) and `savePlayerData()` is called.
10. When `input.js` evaluates any movement/action check, it reads the relevant action's array fresh from `getKeybinds()` on each call rather than from module-load-time constants, so a rebind performed during a paused session takes effect immediately without reload.
11. When a key whose `code` is in the `moveLeft` array is held, `isLeft()` returns true; the same fresh-read membership rule applies to `isRight()` (moveRight), `isDown()` (slide), `isAttack()` (attack), `consumeJump()` (jump), `consumeDash()` (dash), and `consumeSpecial(idx)` for idx 0–4 mapping to `special1`–`special5` respectively.
12. When `consumeEsc()` is evaluated, it responds only to the literal `'Escape'` code and is not driven by `getKeybinds()`.
13. When the game is running, a left mouse click still triggers `attack` in addition to whichever key codes are bound to `attack`.
14. When `ui.js` loads, its `SCREENS` array includes `'keybinds-menu'` and `showScreen('keybinds-menu')` displays that screen while hiding all others.
15. When the keybinds menu is shown, it dynamically renders exactly one row per entry in `KEYBIND_ACTIONS`, each row containing the action label, the current binding(s) rendered as human-readable key names, and a "Rebind" button.
16. When a binding is rendered, each `KeyboardEvent.code` is displayed as a human-readable name (for example `ArrowRight` displays as "Right Arrow", `KeyA` as "A", `Space` as "Space", `ShiftLeft` as "Left Shift").
17. When the player clicks a row's "Rebind" button, that button enters capture mode and displays "Press a key…", and the next keydown (other than Escape) is passed to `setKeybind(action, event.code)`.
18. When a keydown during capture mode resolves to a successful `setKeybind`, the row re-renders showing the new single binding and capture mode ends.
19. When a keydown during capture mode resolves to a conflicting `setKeybind`, the row keeps its previous binding, capture mode ends, and the menu shows an inline conflict message naming the conflicting action's label.
20. When the player presses Escape during capture mode, capture is cancelled with no change to any binding and Escape is not assigned.
21. When the player clicks "Reset to Defaults", `resetKeybinds()` runs and every row re-renders to show its full default binding.
22. When the player opens the keybinds menu, the menu records the originating screen, and clicking "Back" returns to that originating screen (`main-menu` when opened from the main menu, `pause-menu` when opened from the pause menu).
23. When `platformer.html` renders the main menu it includes a `#btn-keybinds` button (class `menu-btn`) opening the keybinds menu, and when it renders the pause menu it includes a `#btn-pause-keybinds` button (class `pause-btn`) opening the keybinds menu.

## Examples
Example 1 — Rebind Move Left to G
  Input: player clicks the "Rebind" button on the `moveLeft` row, then presses the G key (`event.code === 'KeyG'`); no other action is currently bound to `KeyG` because the player already rebound `special5` away from it earlier, so `KeyG` is free.
  Expected output: `setKeybind('moveLeft','KeyG')` returns `{ok:true}`, `playerData.keybinds.moveLeft` becomes `['KeyG']`, the save is written, the `moveLeft` row displays "G", and immediately holding G makes `isLeft()` return true.

Example 2 — Conflict rejection
  Input: `special1` is bound to `['KeyQ']`; player clicks "Rebind" on the `jump` row and presses Q (`event.code === 'KeyQ'`).
  Expected output: `setKeybind('jump','KeyQ')` returns `{ok:false, conflictAction:'special1'}`, `playerData.keybinds.jump` is unchanged (still `['Space','ArrowUp','KeyW']`), no save is written, and the menu shows an inline conflict message naming "Special Slot 1".

Example 3 — Load old save then reset
  Input: `localStorage['platformer_save']` holds a save object with no `keybinds` field; game loads, then player clicks "Reset to Defaults".
  Expected output: after load, `playerData.keybinds` deep-equals `DEFAULT_KEYBINDS` (e.g. `attack` is `['KeyJ','KeyX','KeyK','KeyF','Enter']`); after reset, `playerData.keybinds` again deep-equals `DEFAULT_KEYBINDS` and the save is rewritten.

## Edge Cases
- Save file present with a partial `keybinds` object (e.g. only `moveLeft` and `jump` customized): the other 9 actions must load from `DEFAULT_KEYBINDS` without error.
- Player presses Escape while a row is in capture mode: capture cancels, no binding changes, and Escape is not bound.
- Player attempts to bind a key already used by another action: rejected with conflict, editing action keeps its prior binding.
- Player rebinds an action while the game is paused (mid-run): the new binding is active on resume without a page reload.
- Player rebinds `attack` away from all default keys: left mouse click still triggers attack.
- Corrupt or unparseable `platformer_save` JSON: load falls back to defaults including full `DEFAULT_KEYBINDS`, no crash.

## Constraints
- No new third-party dependencies; vanilla JS/Canvas only, matching the rest of the project.
- The `keybinds` field is purely additive to the save object; no existing save field's shape or meaning changes.
- `'Escape'` can never be assigned as any action's binding, always cancels an in-progress capture, and always still triggers pause/back regardless of rebinding.
- No two actions may simultaneously hold the same bound key; a conflicting rebind is rejected, not silently applied.
- Exported function names and signatures in `input.js` (`isLeft`, `isRight`, `consumeJump`, `consumeEsc`, `isAttack`, `consumeSpecial`, `isDown`, `consumeDash`, `clearAll`, `initInput`) remain unchanged so `player.js`, `entities.js`, and `main.js` need no changes.
- `input.js` must read bindings fresh via `getKeybinds()` on each check, never caching them at module load.
- `state.js` must not import `input.js` (no circular import); `input.js` imports only `getKeybinds` from `./state.js`.
- Persistence uses the existing `localStorage['platformer_save']` key only.
- New CSS reuses the existing dark-theme/gold-accent design system variables and classes (`.menu-btn`, `.pause-btn`, `.back-btn`, `.ss-card`); no new theme is introduced.
- The feature must not touch physics or procedural level generation.

## Affected Components
- platformer/js/state.js — adds `DEFAULT_KEYBINDS`, `KEYBIND_ACTIONS`, `getKeybinds`, `setKeybind`, `resetKeybinds`, and `keybinds` per-action deep-merge in `loadPlayerData`
- platformer/js/input.js — rewires all action checks to read from `getKeybinds()` instead of literal codes; imports `getKeybinds` from `./state.js`
- platformer/js/ui.js — adds `'keybinds-menu'` to `SCREENS`, builds the action rows, wires Rebind/Reset/Back buttons and capture mode, tracks originating screen
- platformer/platformer.html — adds `#keybinds-menu` screen, `#btn-keybinds` on main menu, `#btn-pause-keybinds` on pause menu, row container, Reset and Back buttons
- platformer/platformer.css — adds keybinds-menu row/button styling reusing existing theme variables

## Interface Contracts
- `state.DEFAULT_KEYBINDS` — exported object literal, deep-copied on load and reset
- `state.KEYBIND_ACTIONS` — exported ordered array of `{key, label}`, consumed by the menu renderer
- `state.getKeybinds()` — returns live `playerData.keybinds`; read by `input.js` and the menu renderer
- `state.setKeybind(action, code)` — returns `{ok:true}` or `{ok:false, conflictAction}`; writes `localStorage['platformer_save']` on success
- `state.resetKeybinds()` — resets `playerData.keybinds` and writes `localStorage['platformer_save']`
- `state.playerData.keybinds` — new persisted field; read by `input.js`, written by `setKeybind`/`resetKeybinds`
- `localStorage['platformer_save']` — read on load, written on any binding change
- `input.js` exports `isLeft`, `isRight`, `consumeJump`, `consumeEsc`, `isAttack`, `consumeSpecial`, `isDown`, `consumeDash`, `clearAll`, `initInput` — signatures unchanged
- `ui.SCREENS` — gains `'keybinds-menu'`; `ui.showScreen('keybinds-menu')` toggles display
- DOM IDs/classes touched: `#keybinds-menu`, `#btn-keybinds` (`.menu-btn`), `#btn-pause-keybinds` (`.pause-btn`), the per-action Rebind buttons, Reset button, Back button (`.back-btn`)

## Out of Scope
- Making Escape (pause/back/cancel) rebindable.
- Making the left-mouse-click attack trigger rebindable or removable.
- Multi-key binding via the menu (each rebind assigns exactly one key, replacing the array).
- Gamepad or touch remapping.
- Changes to physics, procedural level generation, stage themes, or existing save fields.

## Depends On

## UI Design
- New full screen `#keybinds-menu` styled with the existing dark-theme/gold-accent system.
- A scrollable container holds 11 rows built dynamically from `KEYBIND_ACTIONS` (same dynamic-population pattern as `buildStageSelect`/`buildLevelSelect`). Each row: left-aligned action label, center current binding(s) as human-readable names, right-aligned "Rebind" button.
- A row's Rebind button shows "Press a key…" while in capture mode.
- An inline conflict message area (initially empty) shows a message naming the conflicting action when a rebind is rejected.
- A "Reset to Defaults" button and a "Back" button (`.back-btn`) at the bottom; Back returns to the originating screen.
- Entry points: `#btn-keybinds` (`.menu-btn`) on the main menu and `#btn-pause-keybinds` (`.pause-btn`) on the pause menu.

## Security Considerations
None — static browser game with no auth; all data is local `localStorage`.

## Open Questions
None.

## Priority
Needed soon — explicit player request to customize controls.
