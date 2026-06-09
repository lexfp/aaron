# SPEC: Weapons System Expansion

## Goal
A platformer player can buy new weapons, upgrade and charge them, and trigger on-hit elemental effects so that combat gains optional depth and reward without changing level solvability.

## Requirements
1. `WEAPON_DEFS` in `platformer/js/state.js` contains, in addition to the existing five (`fists` $0, `sword` $120, `hammer` $320, `blaster` $480, `launcher` $850), exactly six new weapons with these keys, types, and costs that fill the curve and end with a legendary tier: `knives` (ranged, $200), `spear` (melee, $560), `icewand` (ranged, $620), `flamestaff` (ranged, $700), `stormrod` (ranged, $950), `excalibur` (melee, $1500).
2. Each weapon def carries all fields the engine already reads for its type: melee weapons have `damage`, `reach`, `cooldown`, `knockback`; ranged weapons have `damage`, `cooldown`, `speed`, `knockback`, and `splash` (0 if none). New weapons also carry the new fields defined in requirements 3, 6, and 7. The existing five weapons keep their current numeric values unchanged.
3. Each weapon def has an `effect` field that is either `null` or one of the string values `'burn'`, `'freeze'`, `'chain'`, `'lifesteal'`. The mapping is fixed: `flamestaff.effect === 'burn'`, `icewand.effect === 'freeze'`, `stormrod.effect === 'chain'`, `excalibur.effect === 'lifesteal'`; every other weapon (`fists`, `sword`, `hammer`, `blaster`, `launcher`, `knives`, `spear`) has `effect: null`.
4. `playerData` (default in `platformer/js/state.js`) gains a `weaponLevels` object mapping weapon key → integer upgrade level (0-based, default 0 for every weapon). `loadPlayerData()` merges saved `weaponLevels` over the default the same way it merges `upgrades` and `weapons`, so a save written before this feature loads with every weapon at level 0 and no thrown exception.
5. A weapon can be upgraded up to `WEAPON_UPGRADE_MAX = 3` levels. `getWeaponUpgradeCost(key)` returns the coin cost of the next level for an owned weapon (`null` when already at max) using a per-weapon cost array derived from its base cost; `upgradeWeapon(key)` deducts coins, increments `playerData.weaponLevels[key]`, calls `savePlayerData()`, and returns `true` on success, or returns `false` without changing state when the weapon is unowned, already at max, or the player lacks coins.
6. `getEquippedWeapon()` returns a weapon object whose `damage` and `cooldown` reflect the equipped weapon's upgrade level: each upgrade level multiplies `damage` by 1.25 (rounded to the nearest integer, minimum 1 above base) and multiplies `cooldown` by 0.90, computed from the base def without mutating `WEAPON_DEFS`. `reach`, `speed`, `knockback`, `splash`, `effect`, `icon`, `label`, `key`, `type`, and `color` are passed through unchanged.
7. On-hit effects are applied inside `damageEnemy()` in `platformer/js/entities.js` based on the attacking weapon's `effect`, and they only ever subtract enemy HP, slow an enemy's movement, or heal the player — they never alter an enemy's `maxHp`, `dmg`, spawn count, or base `speed` permanently: `'burn'` sets `e._burn = { t: 2.5, dps: <weapon.damage * 0.5> }` and `updateEnemies()` subtracts `dps*dt` from `e.hp` each frame while `e._burn.t > 0`, killing the enemy via the normal death path when hp reaches 0; `'freeze'` sets `e._freeze = 1.5` and `updateEnemies()` multiplies that enemy's per-frame movement by 0.5 while `e._freeze > 0` (decremented by dt) without changing stored `speed`; `'chain'` deals `floor(weapon.damage * 0.5)` (minimum 1) to the nearest other alive enemy within 140px of the struck enemy, once per hit; `'lifesteal'` adds `min(2, weapon.damage)` to `player.hp` capped at `player.maxHp` on each hit that damages an enemy.
8. Charged attacks: when the attack input is held continuously for `CHARGE_TIME = 0.6s` while `player.attackCD <= 0`, the next attack is a heavy attack dealing `ceil(weapon.damage * 2)` damage with `knockback * 1.6`, and (for melee) `reach * 1.3`. Charge progress is tracked on `player._charge` (seconds held), reset to 0 when the attack input is released or after an attack fires. A normal (uncharged) tap attack deals the base upgraded damage.
9. The game loop in `platformer/js/main.js` passes the equipped weapon and a `charged` boolean into `playerMeleeAttack(player, weapon, charged)` / `spawnProjectile(player, weapon, charged)`; both functions apply the requirement-8 multipliers when `charged` is true and otherwise behave exactly as today.
10. The shop Weapons section in `platformer/js/ui.js` shows, for each owned weapon, an upgrade control (level pips and an upgrade button labeled with the next cost, or "MAX") reusing existing shop CSS classes; clicking upgrade calls `upgradeWeapon()` and re-renders, and the displayed stat line reflects the upgraded `damage`/`cooldown` for owned weapons.
11. All 500 existing levels remain completable using only `fists`: no requirement above changes enemy or boss `hp`, `maxHp`, `dmg`, count, or spawn logic except through the player dealing damage as in requirement 7.

## Examples
1. A player owns `flamestaff` (base damage 4) at upgrade level 1. `getEquippedWeapon()` returns `damage = round(4 * 1.25) = 5`, `cooldown = baseCooldown * 0.90`, `effect = 'burn'`. Firing a bolt that hits a 10-HP enemy deals 5 immediately and sets `e._burn = { t: 2.5, dps: 2.5 }`; over the next 2.5s the enemy loses ~6 more HP and dies, dropping coins via the normal death path.
2. A player owns `icewand` (effect `'freeze'`). A hit sets the struck enemy's `_freeze = 1.5`. For the next 1.5s that enemy's `walk`/`hop`/`fly` movement step is halved (×0.5), then returns to full speed; the enemy's stored `speed` value is unchanged throughout.
3. A player holds the attack key for 0.6s with `excalibur` equipped (base damage 9, level 0). On release the heavy swing deals `ceil(9 * 2) = 18` to the struck enemy, knockback ×1.6, and lifesteal adds `min(2,9)=2` HP to the player (capped at 100). `player._charge` resets to 0.

## Edge Cases
1. Loading a `platformer_save` written before this feature (no `weaponLevels` key): `loadPlayerData()` produces `playerData.weaponLevels` equal to a default object with every weapon at 0, existing coins/weapons/equippedWeapon/levelProgress preserved, and no exception thrown.
2. `upgradeWeapon('sword')` when the player has fewer coins than the next-level cost returns `false`, leaves `playerData.weaponLevels.sword` and `playerData.coins` unchanged, and does not write to localStorage.
3. `upgradeWeapon('icewand')` when `weaponLevels.icewand === WEAPON_UPGRADE_MAX` returns `false` and does not deduct coins; `getWeaponUpgradeCost('icewand')` returns `null`.
4. A chain-lightning hit when no other alive enemy is within 140px deals no chain damage and does not throw.
5. A burn applied to an enemy that is also frozen ticks burn damage normally while movement stays halved; the enemy dying from burn still routes through the standard death/coin-drop path exactly once (`e.alive` guard).
6. A charged attack fired while the player is already at full HP with `lifesteal` does not raise `player.hp` above `player.maxHp`.

## Constraints
- No new runtime dependencies; vanilla JS + ES modules, no build step. All code stays in existing `platformer/js/*.js` files.
- Must hold 60fps on the 800×500 canvas: effect state lives as plain fields on existing enemy/player objects, effect updates piggyback on the existing `updateEnemies` loop (no new per-frame allocations beyond the small `_burn`/`_freeze` objects set on hit), and chain-lightning scans the existing `enemies` array only.
- Must NOT change enemy or boss balance except via player-dealt damage: enemy `hp`/`maxHp`/`dmg`/`speed`/spawn counts and all boss-special tuning are read-only to this feature except `e.hp` reduction and the transient `e._burn`/`e._freeze` fields.
- Must NOT make any of the 500 levels unbeatable with fists; weapons remain optional power.
- Save format change must be backward compatible via the existing DEFAULT-merge pattern in `loadPlayerData()`.
- The localStorage save key remains `platformer_save` (underscore); no new keys are introduced.

## Affected Components
- platformer/js/state.js — adds six weapon defs, the `effect` field, `weaponLevels` to DEFAULT + load/save merge, `WEAPON_UPGRADE_MAX`, `getWeaponUpgradeCost`, `upgradeWeapon`, and upgrade-aware `getEquippedWeapon`.
- platformer/js/entities.js — `damageEnemy` applies burn/freeze/chain/lifesteal; `updateEnemies` ticks `_burn`/`_freeze`; `playerMeleeAttack`/`spawnProjectile` accept a `charged` flag and apply heavy-attack multipliers.
- platformer/js/main.js — tracks `player._charge` from the held attack input and passes `charged` into the melee/ranged attack calls.
- platformer/js/player.js — adds `_charge` to the player object and (optional visual) a charge-ready glow cue during `drawPlayer`/`drawWeaponSwing`.
- platformer/js/ui.js — shop Weapons section renders per-weapon upgrade pips + upgrade button and upgraded stat line.
- platformer/platformer.css — reuses existing shop classes; no new selectors required.

## Interface Contracts
- `platformer/js/state.js` exports (existing): `WEAPON_DEFS`, `WEAPON_MAP`, `ownsWeapon`, `buyWeapon`, `equipWeapon`, `getEquippedWeapon`, `playerData`, `loadPlayerData`, `savePlayerData`. New exports: `WEAPON_UPGRADE_MAX`, `getWeaponUpgradeCost(key)`, `upgradeWeapon(key)`.
- `platformer/js/entities.js` exports (existing): `playerMeleeAttack(player, weapon, charged)`, `spawnProjectile(player, weapon, charged)`, `updateEnemies(dt, platforms, player)`, `damageEnemy` (internal). Enemy transient fields read/written: `e._burn`, `e._freeze`, `e.hp`, `e.alive`.
- `platformer/js/player.js` player object fields touched: `player._charge`, existing `attackCD`, `swingT`, `hp`, `maxHp`, `weapon`.
- `platformer/js/main.js` calls `getEquippedWeapon`, `isAttack`, `playerMeleeAttack`, `spawnProjectile`.
- localStorage: reads/writes key `platformer_save`; the persisted JSON gains a `weaponLevels` object. No DOM IDs added beyond shop cards built inside `#shop-grid`.
- DOM classes used (existing): `shop-card`, `shop-section-title`, `shop-icon`, `shop-name`, `shop-desc`, `shop-wstat`, `shop-stars`, `shop-buy`, `shop-equip`, `shop-maxed`, `cant-afford`, `equipped`.

## Out of Scope
- New shop tabs, new CSS selectors, or a separate weapons screen.
- Weapon-specific projectile art beyond reusing the existing `color`/`splash` rendering and the existing weapon-swing drawing.
- Effects on bosses being rebalanced; bosses take effect damage through the same `damageEnemy` path with no special-cased numbers.
- Selling or refunding weapons/upgrades.
- Status effects from enemies onto the player (only player→enemy effects, plus lifesteal healing the player).

## Depends On

## UI Design
The shop Weapons section keeps its current dark/gold theme and existing `shop-card` grid. For each weapon card already rendered by `renderShop`, when the weapon is owned, add below the stat line a `shop-stars` element showing filled/empty pips for the upgrade level (`★`×level + `☆`×(WEAPON_UPGRADE_MAX−level)) and either a `shop-buy` button labeled `🪙 <nextCost>` (calls `upgradeWeapon`, then re-render) or a `shop-maxed` "MAX" badge when at `WEAPON_UPGRADE_MAX`. The `shop-wstat` line for owned weapons shows the upgraded `DMG`/`cooldown` values. Unowned weapons render exactly as today (buy button only). Colors, spacing, and hover states come entirely from the existing `.shop-*` rules in `platformer/platformer.css`.

## Security Considerations
None beyond existing posture — static browser game with localStorage. Save tampering only affects the local player's own progress; `upgradeWeapon`/`buyWeapon` still gate on owned/affordable so a tampered save cannot crash the loops.

## Open Questions
None.

## Priority
Needed soon — user-requested gameplay depth.
