# SPEC: Player Skins

## Goal
A player can buy and equip cosmetic skins in the shop so that they can customize the character's appearance without affecting gameplay.

## Requirements
1. `platformer/js/state.js` exports a `SKIN_DEFS` array of skin definition objects. Each object has the fields: `key` (unique string id), `label` (display name), `icon` (emoji string), `cost` (integer coin price; `0` for the default skin), `unlock` (either `null` for coin-purchasable skins or an object `{ stage: N }` where `N` is a stage number 1–10 that must be completed to earn the skin), and `palette` (an object of color fields, see requirement 4).
2. `SKIN_DEFS` contains between 8 and 12 skins inclusive. Exactly one skin has `key: 'default'`, `cost: 0`, and `unlock: null`; it is always owned and is the equipped skin for any save that has never chosen one. At least 5 skins are coin-purchasable (`unlock: null`, `cost > 0`), and at least 2 skins are progression-unlocked (`unlock: { stage: N }`, `cost: 0`).
3. `state.js` exports a `SKIN_MAP` object mapping each skin `key` to its definition (built the same way as `WEAPON_MAP`).
4. Each skin's `palette` object defines at minimum these color fields used by the renderer: `body` (shirt fill), `bodyStripe` (shirt stripe), `limb` (arm/hand fill), `leg` (leg fill), `skin` (head/face fill), and `hair` (hair fill). A palette may optionally include `accessory`, an object `{ type, color }` where `type` is one of `'visor'`, `'cap'`, or `'none'`, drawn as a simple shape on the head; absence of `accessory` is treated as `{ type: 'none' }`.
5. `playerData` (the `DEFAULT` object in `state.js`) gains two fields: `skins` (an object map of owned skin keys → `true`, defaulting to `{ default: true }`) and `equippedSkin` (a string skin key, defaulting to `'default'`).
6. `loadPlayerData()` defensively merges the new fields the same way it merges `upgrades`/`weapons`: `playerData.skins = { ...DEFAULT.skins, ...(saved.skins || {}) }`, `playerData.equippedSkin = saved.equippedSkin || 'default'`, and if `equippedSkin` is not a key in `SKIN_MAP` or is not currently owned, it is reset to `'default'`. A save written before this feature (no `skins`/`equippedSkin` keys) loads with the default skin owned and equipped, and its `coins`, `weapons`, `upgrades`, `stagesUnlocked`, and `levelProgress` are unchanged.
7. `state.js` exports `ownsSkin(key)`: returns `true` when `key === 'default'`, when `playerData.skins[key]` is truthy, or when the skin is progression-unlocked and its required stage is complete per `isStageComplete(stage)`; otherwise `false`.
8. `state.js` exports `buySkin(key)`: returns `false` and changes nothing if the key is unknown, already owned, progression-unlocked (not coin-purchasable), or the player has fewer coins than `cost`. Otherwise it deducts `cost` from `playerData.coins`, sets `playerData.skins[key] = true`, calls `savePlayerData()`, and returns `true`.
9. `state.js` exports `equipSkin(key)`: returns `false` if `ownsSkin(key)` is false; otherwise sets `playerData.equippedSkin = key`, calls `savePlayerData()`, and returns `true`.
10. `state.js` exports `getEquippedSkin()`: returns the `SKIN_MAP` entry for `playerData.equippedSkin`, falling back to the `'default'` definition when the equipped key is missing or no longer owned.
11. `player.js` `drawPlayer()` reads the active palette from `getEquippedSkin().palette` and uses it for the shirt fill, shirt stripe, arm/hand fill, leg fill, head/face fill, and hair fill in place of the current hardcoded color literals; the default skin's palette reproduces the current colors (`body:#2980b9`, `bodyStripe:#1a6fa8`, `limb:#f0a070`, `leg:#1a252f`, `skin:#f5cba7`, `hair:#5d4037`).
12. When the active palette includes an `accessory` of type `'visor'` or `'cap'`, `drawPlayer()` draws that accessory on the head inside the player's translated/facing-flipped context; type `'none'` draws no accessory.
13. All five animation states (`idle`, `walk`, `jump`, `fall`, plus the landing squash), the `hurtFlash` red overlay, the `invuln` blink (alpha), the `djFlash` outline, and the weapon swing (`drawWeaponSwing`) continue to render correctly under any equipped skin's palette.
14. `renderShop()` in `platformer/js/ui.js` renders a new "Skins" section (a `.shop-section-title` followed by one `.shop-card` per skin in `SKIN_DEFS`) after the existing Weapons and Upgrades sections, in the same `#shop-grid` container, reusing the existing shop card classes.
15. Each skin card shows a color swatch/preview (using the skin's palette colors), the skin `label`, the skin `icon`, and an action control: if equipped, a non-button `EQUIPPED` indicator (class `.shop-maxed`, card gets `.equipped`); else if owned, an `Equip` button (`.shop-buy.shop-equip`); else if coin-purchasable, a buy button showing the cost (`.shop-buy`, with `.cant-afford` when `coins < cost`); else (progression skin not yet earned) a locked indicator showing the unlock requirement text (e.g. `🔒 Complete Stage 5`) and no purchase control.
16. Clicking an `Equip` button calls `equipSkin(key)` then re-renders the shop; clicking an affordable buy button calls `buySkin(key)` and, on success, calls `equipSkin(key)` then re-renders the shop; a locked skin's card has no click handler that buys or equips it.
17. Equipping a skin takes effect immediately (the next `drawPlayer()` frame uses the new palette) with no level reload, and persists across browser sessions because `equipSkin`/`buySkin` call `savePlayerData()` which writes to localStorage key `platformer_save`.
18. Skins have no effect on gameplay: the player hitbox (`player.w`/`player.h`), physics constants, collision, damage, and all other mechanics are identical regardless of equipped skin.

## Examples
1. Coin purchase + equip: `playerData.coins = 200`, default skin equipped. A skin `{ key:'ninja', cost:150, unlock:null }` is not owned. `buySkin('ninja')` returns `true`, `playerData.coins` becomes `50`, `playerData.skins.ninja === true`. Calling `equipSkin('ninja')` returns `true` and sets `playerData.equippedSkin === 'ninja'`; the next rendered frame draws the shirt with the ninja palette's `body` color.
2. Insufficient coins: `playerData.coins = 100`, skin `{ key:'gold', cost:300, unlock:null }` not owned. `buySkin('gold')` returns `false`, `playerData.coins` stays `100`, `playerData.skins.gold` stays undefined, and nothing is written to localStorage by the call.
3. Progression unlock: skin `{ key:'champion', cost:0, unlock:{ stage:5 } }`. While stage 5 is incomplete, `ownsSkin('champion')` is `false` and `buySkin('champion')` returns `false` (not purchasable). After every level of stage 5 is complete (`isStageComplete(5) === true`), `ownsSkin('champion')` returns `true` and `equipSkin('champion')` returns `true` at no coin cost.

## Edge Cases
1. Old save with no `skins`/`equippedSkin` keys: after `loadPlayerData()`, `playerData.skins` equals `{ default: true }`, `playerData.equippedSkin` equals `'default'`, and coins/weapons/upgrades/progress are unchanged.
2. Save with `equippedSkin` set to a key that is no longer owned (e.g. a coin skin the player never bought, or a removed key): `loadPlayerData()` (and `getEquippedSkin()`) fall back to `'default'` rather than throwing or drawing with an undefined palette.
3. `buySkin`/`equipSkin` called with an unknown key: both return `false` and change nothing.
4. Equipping the already-equipped skin: `equipSkin(currentKey)` returns `true` and leaves `equippedSkin` unchanged (idempotent).
5. A progression skin that becomes earned mid-session (player completes its stage during play): the next `renderShop()` shows it as `Equip` (owned) with no purchase control, without requiring a reload.

## Constraints
1. No new third-party dependencies; no build step; ES modules only.
2. Skins are purely cosmetic — they must not change hitbox, physics, collision, damage, or any gameplay value.
3. Rendering must keep the game at 60fps; palette lookup per frame must be O(1) (a map/object read), not a per-frame array scan or allocation-heavy operation.
4. Backward compatibility: loading a pre-feature save must not lose or alter coins, owned weapons, upgrades, unlocked stages, or level progress.
5. `buySkin` must never deduct coins or grant ownership when it returns `false`.
6. Equipping persists via the existing single localStorage key `platformer_save` (underscore); no additional storage keys are introduced.
7. All UI must reuse the existing dark/gold shop theme classes from `platformer.css`; no parallel styling system or inline color theme is introduced beyond the per-skin swatch colors.

## Affected Components
- platformer/js/state.js — add `SKIN_DEFS`, `SKIN_MAP`, `skins`/`equippedSkin` defaults, defensive load merge, and `ownsSkin`/`buySkin`/`equipSkin`/`getEquippedSkin`.
- platformer/js/player.js — `drawPlayer()` reads `getEquippedSkin().palette` for body/limb/leg/skin/hair colors and draws the optional accessory.
- platformer/js/ui.js — `renderShop()` adds the "Skins" section with swatch/preview, owned/equipped/locked states, and buy/equip handlers.
- platformer/platformer.css — optional swatch/lock styles for skin cards reusing existing shop classes/variables (only if a new class is needed for the color swatch).

## Interface Contracts
- `state.js` exports (new): `SKIN_DEFS` (array), `SKIN_MAP` (object), `ownsSkin(key)`, `buySkin(key)`, `equipSkin(key)`, `getEquippedSkin()`.
- `state.js` reads/uses (existing): `playerData`, `savePlayerData`, `isStageComplete`, `DEFAULT`, `SAVE_KEY` (`'platformer_save'`).
- `player.js` imports `getEquippedSkin` from `state.js`; `drawPlayer()` consumes `getEquippedSkin().palette`.
- `ui.js` imports `SKIN_DEFS`, `ownsSkin`, `buySkin`, `equipSkin`, `getEquippedSkin` from `state.js`.
- localStorage: reads and writes the single key `platformer_save` (no new keys).
- DOM touched in `ui.js`: existing `#shop-grid` container (skin cards appended), reusing classes `shop-section-title`, `shop-card`, `shop-card.equipped`, `shop-icon`, `shop-name`, `shop-desc`, `shop-buy`, `shop-buy.shop-equip`, `shop-buy.cant-afford`, `shop-maxed`; `#shop-coin-count` reflects coin balance after a purchase.

## Out of Scope
- Animated, multi-frame, or sprite-asset skins (palettes recolor the existing procedural art only).
- Skins that alter gameplay (stat boosts, different hitbox, abilities).
- Trading, gifting, refunding, or selling skins back for coins.
- Per-stage automatic skin switching or random skin selection.
- Skin previews rendered with the live animated player canvas (a static swatch in the card is sufficient).

## Depends On

## UI Design
The Skins section lives in the existing `#shop-overlay` / `#shop-grid` (a responsive `auto-fill` grid of `minmax(200px,1fr)` cards) and appears after the Weapons and Upgrades sections. It opens with a `.shop-section-title` reading "🎨 Skins" (full-width, same bottom-border style as the other section headers).

Each skin is one `.shop-card` (same dark `--bg3` panel, `--border` outline, centered column layout) containing, top to bottom:
- A swatch/preview: a small horizontal row or stacked block of color chips drawn from the palette (e.g. a body-color block with a smaller skin-tone circle and hair chip), so the player sees the recolor at a glance. This uses a single new helper class for the swatch (e.g. `.shop-swatch`) styled with the existing variables; chip background colors come from the palette inline. The skin `icon` emoji sits in the existing `.shop-icon` slot above or beside the swatch.
- The skin `label` in `.shop-name` and a short flavor line in `.shop-desc`.
- The action control, mirroring the Weapons section:
  - Equipped → `<div class="shop-maxed">EQUIPPED</div>` and the card gets the green `.equipped` outline.
  - Owned, not equipped → green `Equip` button (`.shop-buy.shop-equip`).
  - Coin-purchasable, not owned → orange buy button (`.shop-buy`) showing `🪙 {cost}`, dimmed to `.cant-afford` when unaffordable.
  - Progression skin, not yet earned → a locked indicator (reuse `.shop-maxed` styling or a small `.shop-lock` text) reading `🔒 Complete Stage {N}` and no buy/equip button; the card may carry the `.locked` modifier styling already used by `.ss-card.locked` if a muted look is desired.
Theme stays the dark background with gold (`--coin`/`--accent`) accents for prices and green (`#2ecc71`) for the equipped/Equip state, identical to the Weapons section so the new section is visually indistinguishable in style.

## Security Considerations
All data is local (single-player, localStorage). `buySkin`/`equipSkin` must validate the key against `SKIN_MAP` and guard ownership/affordability so malformed or out-of-range keys cannot grant skins, set an invalid `equippedSkin`, or drive coins negative. Skin definitions are static in source; no untrusted input is parsed. The defensive merge in `loadPlayerData()` must tolerate a corrupted or partial `skins`/`equippedSkin` value (wrong type, unknown key) without throwing, falling back to the default skin.

## Open Questions
None.

## Priority
Needed soon — user-requested cosmetic customization. Small/Medium scope, no gameplay risk, self-contained.
