# Scenarios: Dice Unlock Cheat

## Scenario 1 — unlockEverything grants all weapons and levels
Kind: code
Given: `state.js` is loaded and `playerData` is at default (only `fists` owned, `stagesUnlocked = 1`, `levelProgress = {}`).
When:  `unlockEverything()` is called.
Then:  Every key in `WEAPON_DEFS` is `true` in `playerData.weapons`; `playerData.stagesUnlocked === 10`; `playerData.levelProgress` contains `true` for all 500 keys `${s}-${l}` (s 0–9, l 1–50); `savePlayerData()` is called exactly once.
Verify by: Read `unlockEverything` in platformer/js/state.js and confirm it iterates `WEAPON_DEFS` setting each `.key` true, sets `stagesUnlocked = 10`, loops s 0–9 and l 1–50 setting `levelProgress[`${s}-${l}`] = true`, and calls `savePlayerData()` once after the mutations.

## Scenario 2 — unlockEverything never changes equippedWeapon (must-NOT)
Kind: code
Given: `playerData.equippedWeapon` is `'sword'`.
When:  `unlockEverything()` is called.
Then:  `playerData.equippedWeapon` remains `'sword'`, and no equip function is invoked.
Verify by: Read `unlockEverything` in platformer/js/state.js and confirm it contains no assignment to `playerData.equippedWeapon` and no call to `equipWeapon`, `equipSkin`, or any equip function.

## Scenario 3 — Dice counter is closure-scoped, not module-level
Kind: code
Given: `setupMenuEffects` in ui.js attaches the `#toy-dice` click handler.
When:  The dice click counter variable is inspected.
Then:  `_diceHits` is declared as a local inside `setupMenuEffects` (closure scope), not at module top level.
Verify by: Read `setupMenuEffects` in platformer/js/ui.js and confirm `_diceHits` is declared with `let` inside the function body and that no module-level declaration of it exists.

## Scenario 4 — 500 clicks triggers the cheat
Kind: code
Given: The `#toy-dice` handler with `_diceHits = 0`.
When:  500 dice clicks occur.
Then:  On the 500th click `unlockEverything()` is called and `_diceHits` is reset to 0.
Verify by: Read the `#toy-dice` click handler in `setupMenuEffects` in platformer/js/ui.js and confirm it increments `_diceHits` and that `if (_diceHits >= 500)` calls `unlockEverything()` then resets `_diceHits = 0`.

## Scenario 5 — 499 clicks does not trigger the cheat
Kind: code
Given: The `#toy-dice` handler has been clicked 499 times.
When:  `_diceHits` is inspected.
Then:  `_diceHits === 499` and `unlockEverything()` has not been called.
Verify by: Read the `#toy-dice` click handler in platformer/js/ui.js and confirm the trigger condition is `>= 500`, so 499 clicks alone do not fire `unlockEverything()`.

## Scenario 6 — No visual announcement beyond the existing burst (must-NOT)
Kind: code
Given: The dice cheat trigger path in ui.js.
When:  `unlockEverything()` is invoked from the dice handler.
Then:  No toast, overlay, alert, or console/log statement is added on the cheat path; only the pre-existing `burst()` per-click effect runs.
Verify by: Read the `#toy-dice` click handler in platformer/js/ui.js and confirm the cheat branch contains only the `unlockEverything()` call and counter reset, with no `console.*`, `alert`, toast, or overlay calls added.

## Scenario 7 — Does not conflict with the luckyRun easter egg (must-NOT)
Kind: code
Given: The existing `luckyRun` easter egg uses the locals `streak`, `prev`, `done`, and `goal` in the dice handler.
When:  The new cheat counter is added.
Then:  The new counter uses only `_diceHits` and does not read, write, or remove `streak`, `prev`, `done`, `goal`, or the `luckyRun(callbacks)` call.
Verify by: Read the `#toy-dice` click handler in platformer/js/ui.js and confirm the `luckyRun` trigger is intact and that the new counter only touches `_diceHits`.

## Scenario 8 — Idempotent when everything already unlocked
Kind: code
Given: `playerData` already has all 11 weapons true, `stagesUnlocked = 10`, and all 500 level-progress keys true.
When:  `unlockEverything()` is called again.
Then:  Values are overwritten with the same `true`/`10` values, `savePlayerData()` is called once, and no error is thrown.
Verify by: Read `unlockEverything` in platformer/js/state.js and confirm the assignments are unconditional overwrites (no early-return or guard that could throw) and `savePlayerData()` is still called once.
