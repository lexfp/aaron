# SPEC: Dice Unlock Cheat

## Goal
A player can click the 🎲 dice toy on the main menu 500 times so that all weapons and all 500 levels are unlocked through a hidden cheat with no separate cheat menu, and the cheat fires at most once per menu session.

## Requirements
1. `state.js` exports a new function `unlockEverything()`.
2. `unlockEverything()` sets `playerData.weapons[key] = true` for every key in `WEAPON_DEFS` (all 11 keys: `fists`, `sword`, `hammer`, `blaster`, `launcher`, `knives`, `spear`, `icewand`, `flamestaff`, `stormrod`, `excalibur`).
3. `unlockEverything()` sets `playerData.stagesUnlocked = 10`.
4. `unlockEverything()` sets `playerData.levelProgress[`${s}-${l}`] = true` for every `s` in 0–9 and every `l` in 1–50, producing all 500 level-progress entries.
5. `unlockEverything()` calls `savePlayerData()` exactly once, after all mutations are applied.
6. `unlockEverything()` never reads or writes `playerData.equippedWeapon`.
7. `unlockEverything()` never calls `equipWeapon`, `equipSkin`, or any other equip function.
8. `unlockEverything()` returns `undefined`.
9. The dice click handler inside `setupMenuEffects` in `ui.js` maintains a click counter `_diceHits` (initialized to 0) and a one-time flag `_diceUnlocked` (initialized to `false`), both declared as locals in the `setupMenuEffects` closure scope.
10. On each dice click, the handler increments `_diceHits`.
11. When `_diceHits` reaches 500 or more and `_diceUnlocked` is `false`, the handler calls `unlockEverything()`, sets `_diceUnlocked = true`, and resets `_diceHits` to 0.
12. When `_diceHits` reaches 500 or more and `_diceUnlocked` is already `true`, the handler resets `_diceHits` to 0 and does NOT call `unlockEverything()`.
13. The dice counter `_diceHits` and flag `_diceUnlocked` are separate locals that do not read, write, or replace the existing `streak`, `prev`, `done`, or `goal` variables used by the `luckyRun` easter egg.
14. The cheat produces no toast, no overlay, and no console/log output; only the standard dice burst that already fires per click occurs.

## Examples
Example 1 — First 500 clicks unlocks everything
  Input: Player clicks `#toy-dice` 500 times within the same menu session, `_diceUnlocked` is `false`.
  Expected output: On the 500th click `unlockEverything()` is called once; `playerData.weapons` has all 11 keys true, `playerData.stagesUnlocked` is 10, `playerData.levelProgress` has all 500 keys true, `savePlayerData()` called once, `_diceUnlocked` set to `true`, `_diceHits` reset to 0.

Example 2 — Second 500 clicks does nothing
  Input: `_diceUnlocked` is `true` (cheat already fired this session); player clicks `#toy-dice` 500 more times.
  Expected output: On the 500th of those clicks `_diceHits >= 500` but `_diceUnlocked` is `true`, so `unlockEverything()` is NOT called. `_diceHits` resets to 0. No save occurs.

Example 3 — equippedWeapon preserved
  Input: `playerData.equippedWeapon` is `'sword'` and the player triggers the cheat on the first 500th click.
  Expected output: After `unlockEverything()` runs, `playerData.equippedWeapon` is still `'sword'`; only weapons, stagesUnlocked, and levelProgress changed.

## Edge Cases
- All weapons and levels are already unlocked when the first 500-click threshold is hit: `unlockEverything()` overwrites with the same values and saves once; no error. `_diceUnlocked` becomes `true`.
- Menu re-render mid-streak: when `setupMenuEffects` is called again, both `_diceHits` and `_diceUnlocked` are freshly initialized to 0/false, so a fired cheat from a prior render does not persist.
- Exactly 500 clicks: the cheat fires on the 500th click because `_diceHits >= 500` is satisfied at 500.
- 499 clicks after the cheat has already fired: `_diceHits` reaches 499 but `_diceUnlocked` is `true`, so even if it reaches 500 the cheat will not re-fire.

## Constraints
- `unlockEverything()` MUST NOT modify `playerData.equippedWeapon`.
- `unlockEverything()` MUST NOT call `equipWeapon`, `equipSkin`, or any equip function.
- The dice counter and flag MUST use closure-scoped locals in `setupMenuEffects`, NOT module-level variables.
- The cheat MUST fire at most once per `setupMenuEffects` invocation (per menu session).
- The cheat MUST NOT alter, replace, or break the existing `luckyRun` easter egg trigger or its `streak`/`prev`/`done`/`goal` state.
- The cheat MUST NOT add any visual or textual announcement beyond the existing per-click dice burst.
- `savePlayerData()` MUST be called exactly once per `unlockEverything()` invocation.

## Affected Components
- platformer/js/state.js — add and export `unlockEverything()` that sets all weapons, `stagesUnlocked = 10`, all 500 level-progress entries, then calls `savePlayerData()` once.
- platformer/js/ui.js — in the `#toy-dice` click handler within `setupMenuEffects`, add closure-scoped `_diceHits` counter and `_diceUnlocked` flag; call `unlockEverything()` only on the first 500-click threshold; import `unlockEverything` from state.js.

## Interface Contracts
- `unlockEverything()` — sets every `WEAPON_DEFS` key true in `playerData.weapons`, sets `playerData.stagesUnlocked = 10`, sets all 500 `playerData.levelProgress` keys true, calls `savePlayerData()` once, leaves `playerData.equippedWeapon` untouched, and returns `undefined`.

## Out of Scope
- Any UI announcement, toast, overlay, sound, or log for the cheat.
- A separate or visible cheat menu.
- Changing the equipped weapon or skin.
- Modifying or relocating the existing `luckyRun` easter egg.
- Unlocking or granting coins, upgrades, or any data outside weapons and level/stage progress.

## Depends On

## UI Design
No new UI. The only feedback is the existing throttled dice burst (`burst()`, ≈70ms throttle, `MAX_PARTICLES=140`) that already plays on each dice click.

## Security Considerations
This is a client-side single-player easter-egg cheat persisted in localStorage; it grants no server-side privileges and exposes no sensitive data. The trigger remains undocumented in user-facing UI.

## Open Questions
None.

## Priority
Nice-to-have
