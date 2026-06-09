# Scenarios: Player Skins

## Scenario 1 — buySkin succeeds and deducts the exact cost
Kind: code
Given: `playerData.coins = 200`, a coin-purchasable skin in `SKIN_DEFS` with `cost > 0` and `unlock: null` that is not yet in `playerData.skins`.
When:  `buySkin(thatKey)` is called.
Then:  it returns `true`, `playerData.coins` decreases by exactly that skin's `cost`, `playerData.skins[thatKey] === true`, and `savePlayerData()` is invoked (value persisted to localStorage key `platformer_save`).
Verify by: read `buySkin` in `platformer/js/state.js` — confirm the affordability/ownership guard, the coin deduction, `playerData.skins[key] = true`, `savePlayerData()` call, and `return true`.

## Scenario 2 — buySkin with insufficient coins changes nothing (prohibited behavior)
Kind: code
Given: `playerData.coins = 100` and a coin-purchasable skin with `cost = 300` that is not owned.
When:  `buySkin(thatKey)` is called.
Then:  it returns `false`, `playerData.coins` is still `100`, `playerData.skins[thatKey]` is still undefined/absent, and no coin deduction or ownership grant occurs (maps to the "buySkin must never deduct coins or grant ownership when it returns false" constraint).
Verify by: read `buySkin` in `platformer/js/state.js` — confirm the early `return false` when coins are insufficient (and when already owned / progression-unlocked) precedes any mutation of `coins` or `skins`.

## Scenario 3 — old save loads with default skin and intact data (prohibited data loss)
Kind: code
Given: a localStorage `platformer_save` JSON written before this feature: `{ coins: 250, weapons: { fists:true, sword:true }, upgrades:{ jump:2 }, stagesUnlocked:3, levelProgress:{"1-1":true} }` with no `skins` or `equippedSkin` keys.
When:  `loadPlayerData()` runs.
Then:  `playerData.skins` equals `{ default: true }`, `playerData.equippedSkin === 'default'`, and `coins === 250`, `weapons.sword === true`, `upgrades.jump === 2`, `stagesUnlocked === 3`, `levelProgress["1-1"] === true` are all preserved unchanged.
Verify by: read `loadPlayerData` in `platformer/js/state.js` — confirm `skins`/`equippedSkin` use the same `{ ...DEFAULT.x, ...(saved.x || {}) }` / `saved.equippedSkin || 'default'` defensive merge as `weapons`/`upgrades`, and that existing fields are spread from `saved` first.

## Scenario 4 — equipSkin guards ownership and getEquippedSkin falls back
Kind: code
Given: a skin key that the player does not own and has not unlocked, and separately a `playerData.equippedSkin` set to a key absent from `SKIN_MAP`.
When:  `equipSkin(unownedKey)` is called, and later `getEquippedSkin()` is called with the invalid `equippedSkin`.
Then:  `equipSkin(unownedKey)` returns `false` and leaves `playerData.equippedSkin` unchanged; `getEquippedSkin()` returns the `'default'` skin definition (never `undefined`), so `getEquippedSkin().palette` is always a valid palette object.
Verify by: read `equipSkin` and `getEquippedSkin` in `platformer/js/state.js` — confirm `equipSkin` returns `false` when `ownsSkin(key)` is false, and `getEquippedSkin` falls back to `SKIN_MAP.default` when the equipped key is missing/unowned.

## Scenario 5 — progression skin unlocks only after the stage is complete
Kind: code
Given: a skin in `SKIN_DEFS` with `unlock: { stage: 5 }` and `cost: 0`, with stage 5 incomplete then later complete.
When:  `ownsSkin(thatKey)` is evaluated before and after `isStageComplete(5)` becomes `true`, and `buySkin(thatKey)` is attempted while locked.
Then:  while stage 5 is incomplete `ownsSkin` returns `false` and `buySkin` returns `false` (no coin spend); once `isStageComplete(5)` is `true`, `ownsSkin` returns `true` and `equipSkin(thatKey)` returns `true` with no change to `playerData.coins`.
Verify by: read `ownsSkin` and `buySkin` in `platformer/js/state.js` — confirm `ownsSkin` consults `isStageComplete(skin.unlock.stage)` for progression skins and `buySkin` rejects skins where `unlock` is non-null.

## Scenario 6 — equipped skin recolors the player without changing the hitbox (cosmetic-only constraint)
Kind: code
Given: a non-default skin equipped via `equipSkin`.
When:  `drawPlayer(ctx, t)` runs for the `idle`, `walk`, `jump`, and `fall` states and while `hurtFlash`/`invuln`/`djFlash`/`swingT` are active.
Then:  the shirt, stripe, arms/hands, legs, head/face, and hair fills come from `getEquippedSkin().palette` (not hardcoded literals), the optional accessory is drawn for `visor`/`cap` types, all five animation states plus hurt/invuln/dj/weapon-swing effects still render, and `player.w`/`player.h` and physics constants are untouched by skin selection.
Verify by: read `drawPlayer` (and any accessory helper) in `platformer/js/player.js` — confirm the body/stripe/limb/leg/skin/hair fillStyles read palette fields, the accessory branch keys off `palette.accessory.type`, and no skin code mutates `player.w`/`player.h` or physics constants.

## Scenario 7 — Skins section renders and equipping updates immediately
Kind: e2e
Given: the platformer is open with at least one affordable coin skin and the player has enough coins.
When:  the player opens the shop, scrolls to the "🎨 Skins" section, clicks the buy button on an affordable unowned skin (which auto-equips on success), and closes the shop into a level.
Then:  the bought skin's card switches to the green EQUIPPED state, the shop coin counter drops by the skin's cost, a locked progression skin shows a "🔒 Complete Stage N" indicator with no buy button, and after closing the shop the on-canvas player is drawn with the new palette colors without any page reload.
Verify by: observe in the browser that the Skins section appears after Weapons/Upgrades in `#shop-grid`, the coin counter decreases, the EQUIPPED indicator appears on the chosen card, locked skins show the requirement text, and the rendered player's colors change in-game immediately.
