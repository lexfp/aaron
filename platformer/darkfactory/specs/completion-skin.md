# SPEC: Completion Skin

## Goal
A player can automatically unlock and own the free "Champion" skin so that beating all 10 stages grants a visible end-game trophy.

## Requirements
1. `SKIN_DEFS` in `platformer/js/state.js` contains exactly one new entry with `key: 'champion'`, `label: 'Champion'`, `desc: 'Awarded for beating all 10 stages.'`, `cost: 0`, and `unlock: 'all-stages'`.
2. The `champion` entry's `palette` is `{ body: '#f9c74f', accessory_type: 'crown', accessory_color: '#f4a100' }`.
3. `state.js` exports `isGameComplete()` which returns `true` if and only if `playerData.stagesUnlocked >= 10`, otherwise `false`.
4. `state.js` exports `grantCompletionSkin()` which, when `isGameComplete()` is `true` and `ownsSkin('champion')` is `false`, sets `playerData.skins['champion'] = true`, calls `savePlayerData()`, and returns `true`.
5. When `isGameComplete()` is `false`, `grantCompletionSkin()` returns `false`, does not modify `playerData.skins`, and does not call `savePlayerData()`.
6. When `isGameComplete()` is `true` and `ownsSkin('champion')` is already `true`, `grantCompletionSkin()` returns `false` and does not call `savePlayerData()`.
7. `grantCompletionSkin()` never calls `equipSkin` and never changes `playerData.equippedSkin`.
8. `grantCompletionSkin()` mutates only `playerData.skins`; it does not modify `SKIN_DEFS` or `SKIN_MAP`.
9. `loadPlayerData()` calls `grantCompletionSkin()` after merging saved data into `playerData`.
10. `main.js` calls `grantCompletionSkin()` immediately after the existing `markLevelComplete(...)` call in the stage-complete flow.
11. In the shop, the `champion` skin renders with a padlock and the unlock label while not owned, and renders as equippable once `playerData.skins['champion']` is `true`, using existing `ui.js` lock/unlock rendering with no `ui.js` code change.

## Examples
Example 1 — Granting on 10th stage completion
  Input: `playerData.stagesUnlocked === 10`, no `champion` key; `grantCompletionSkin()` called.
  Expected output: returns `true`; `playerData.skins['champion'] === true`; `savePlayerData()` called once; `playerData.equippedSkin` unchanged.

Example 2 — Not yet complete
  Input: `playerData.stagesUnlocked === 9`, no `champion` key; `grantCompletionSkin()` called.
  Expected output: returns `false`; `playerData.skins` still has no `champion` key; `savePlayerData()` not called.

Example 3 — Already owned
  Input: `playerData.stagesUnlocked === 10`, `playerData.skins['champion'] === true`; `grantCompletionSkin()` called.
  Expected output: returns `false`; `playerData.skins['champion']` remains `true`; `savePlayerData()` not called.

## Edge Cases
- Player completed all 10 stages before this feature shipped: `loadPlayerData()` calls `grantCompletionSkin()` after merge, so `stagesUnlocked === 10` retroactively grants `champion` on next load.
- Repeated calls when already complete and owned: each call returns `false` and performs no save (idempotent).
- `champion` is granted but not equipped: `getEquippedSkin()` continues to return the previously equipped skin's palette until the player explicitly equips `champion` in the shop.

## Constraints
- `grantCompletionSkin()` must never call `equipSkin` and must never set or change `playerData.equippedSkin`.
- `grantCompletionSkin()` must never mutate `SKIN_DEFS` or `SKIN_MAP`.
- `grantCompletionSkin()` must only call `savePlayerData()` when it actually newly grants the skin.
- `champion` must have `cost: 0`; the skin must never deduct coins and must never be purchasable via `buySkin`.

## Affected Components
- platformer/js/state.js — add `champion` entry to `SKIN_DEFS`; add exports `isGameComplete()` and `grantCompletionSkin()`; call `grantCompletionSkin()` at end of `loadPlayerData()`.
- platformer/js/main.js — call `grantCompletionSkin()` immediately after `markLevelComplete(...)` in the stage-complete flow.
- platformer/js/ui.js — no code change; existing shop lock/unlock rendering displays the `champion` skin correctly.

## Interface Contracts
- `isGameComplete()` — returns boolean `true` when `playerData.stagesUnlocked >= 10`, else `false`.
- `grantCompletionSkin()` — returns boolean `true` only when it newly grants `champion`; sets `playerData.skins['champion'] = true` and saves; returns `false` otherwise without saving; never equips; never mutates `SKIN_DEFS`/`SKIN_MAP`.

## Out of Scope
- Any change to shop rendering logic in `ui.js`.
- Auto-equipping the `champion` skin.
- Notifications, toasts, or overlays announcing the unlock.
- Changes to how `stagesUnlocked` is incremented.

## Depends On

## UI Design
(none — uses existing shop lock/unlock rendering)

## Security Considerations
Grant relies on local `playerData.stagesUnlocked` from `localStorage`; a player editing local save data could grant themselves the skin. Acceptable for a single-player cosmetic trophy with no coin or gameplay value.

## Open Questions
None.

## Priority
Nice-to-have
