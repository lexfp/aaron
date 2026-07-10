# Scenarios: Keybindings Menu

## Scenario 1 — Successful rebind persists and takes effect live
Kind: code
Given: `playerData.keybinds` is loaded at defaults and `KeyG` is not bound to any action (special5 has been rebound away from it).
When:  `setKeybind('moveLeft','KeyG')` is called, then a keydown with `code:'KeyG'` is registered as held.
Then:  the call returns `{ok:true}`, `playerData.keybinds.moveLeft` deep-equals `['KeyG']`, the value written to `localStorage['platformer_save']` parses to an object whose `keybinds.moveLeft` is `['KeyG']`, and `isLeft()` returns `true`.
Verify by: driving `state.setKeybind` and `input.isLeft` from a Node/JSDOM harness with a stubbed `localStorage`, reading the module exports in `platformer/js/state.js` and `platformer/js/input.js`.

## Scenario 2 — Conflict rejection leaves binding untouched (must-NOT-happen)
Kind: code
Given: `playerData.keybinds.special1` is `['KeyQ']` and `playerData.keybinds.jump` is `['Space','ArrowUp','KeyW']`.
When:  `setKeybind('jump','KeyQ')` is called.
Then:  it returns `{ok:false, conflictAction:'special1'}`, `playerData.keybinds.jump` still deep-equals `['Space','ArrowUp','KeyW']`, and the `localStorage['platformer_save']` write count is unchanged from before the call (no save written).
Verify by: calling `state.setKeybind` with a spy/counter wrapping the stubbed `localStorage.setItem` in `platformer/js/state.js`.

## Scenario 3 — Escape can never be bound (must-NOT-happen)
Kind: code
Given: `playerData.keybinds.dash` is `['ShiftLeft','ShiftRight']`.
When:  `setKeybind('dash','Escape')` is called.
Then:  it returns an object with `ok === false`, `playerData.keybinds.dash` is unchanged, no action in `playerData.keybinds` contains `'Escape'`, and `consumeEsc()` still responds to a keydown with `code:'Escape'`.
Verify by: calling `state.setKeybind` and inspecting `state.getKeybinds()` output plus driving `input.consumeEsc` in `platformer/js/state.js` and `platformer/js/input.js`.

## Scenario 4 — Old save with no keybinds field loads full defaults
Kind: code
Given: `localStorage['platformer_save']` holds a JSON save object with no `keybinds` key and a valid `upgrades` object.
When:  `loadPlayerData()` runs.
Then:  `playerData.keybinds` deep-equals `DEFAULT_KEYBINDS` (e.g. `attack` is `['KeyJ','KeyX','KeyK','KeyF','Enter']`), the arrays are not the same references as those in `DEFAULT_KEYBINDS`, and the existing `upgrades` field from the save is preserved.
Verify by: seeding stubbed `localStorage`, calling `state.loadPlayerData`, and comparing `state.getKeybinds()` against `state.DEFAULT_KEYBINDS` in `platformer/js/state.js`.

## Scenario 5 — Partial keybinds object is per-action deep-merged
Kind: code
Given: `localStorage['platformer_save']` holds a save whose `keybinds` object only contains `moveLeft:['KeyA']` and `jump:['Space']`.
When:  `loadPlayerData()` runs.
Then:  `playerData.keybinds.moveLeft` is `['KeyA']`, `playerData.keybinds.jump` is `['Space']`, and every other of the 11 actions equals its `DEFAULT_KEYBINDS` value (e.g. `slide` is `['ArrowDown','KeyS']`).
Verify by: seeding stubbed `localStorage`, calling `state.loadPlayerData`, and inspecting `state.getKeybinds()` in `platformer/js/state.js`.

## Scenario 6 — Reset restores all multi-key defaults
Kind: code
Given: `playerData.keybinds.attack` has been rebound to `['Enter']` and `playerData.keybinds.jump` to `['Space']`.
When:  `resetKeybinds()` is called.
Then:  `playerData.keybinds` deep-equals `DEFAULT_KEYBINDS` (`attack` back to `['KeyJ','KeyX','KeyK','KeyF','Enter']`, `jump` back to `['Space','ArrowUp','KeyW']`), and `localStorage['platformer_save']` is written with those defaults.
Verify by: calling `state.resetKeybinds` then comparing `state.getKeybinds()` and the parsed `localStorage['platformer_save']` against `state.DEFAULT_KEYBINDS` in `platformer/js/state.js`.

## Scenario 7 — input.js reads bindings live (no module-load cache)
Kind: code
Given: the game is not active/paused, `input.initInput` has run, and `playerData.keybinds.special1` starts as `['KeyQ']`.
When:  `setKeybind('special1','KeyP')` is called at runtime, then a keydown with `code:'KeyP'` is dispatched, then `consumeSpecial(0)` is called.
Then:  `consumeSpecial(0)` returns `true` (the freshly bound key fires) and a subsequent keydown with the old `code:'KeyQ'` does not make `consumeSpecial(0)` return true.
Verify by: driving `input.initInput`, `state.setKeybind`, dispatching keydown events, and calling `input.consumeSpecial` in a JSDOM harness against `platformer/js/input.js` and `platformer/js/state.js`.

## Scenario 8 — Keybinds menu screen registers and renders 11 rows
Kind: e2e
Given: the platformer page is loaded and the main menu is shown.
When:  the player clicks `#btn-keybinds`.
Then:  `#keybinds-menu` is the only screen with display flex, it contains exactly 11 action rows in `KEYBIND_ACTIONS` order with `moveLeft`'s row showing "Left Arrow" and "A" as human-readable names, and a "Back" click returns to `#main-menu`.
Verify by: a Playwright script clicking `#btn-keybinds`, asserting visible-screen state and row count/labels, then clicking Back and asserting `#main-menu` is shown.
