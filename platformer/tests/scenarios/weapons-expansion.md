# Scenarios: Weapons System Expansion

## Scenario 1 — New weapons fill the cost curve
Kind: code
Given: the weapons subsystem spec is implemented in platformer/js/state.js
When:  WEAPON_DEFS is read
Then:  it contains exactly 11 weapons; the six new keys knives/spear/icewand/flamestaff/stormrod/excalibur exist with costs 200/560/620/700/950/1500 respectively, each new def has the correct type (knives ranged, spear melee, icewand ranged, flamestaff ranged, stormrod ranged, excalibur melee), and the original five (fists/sword/hammer/blaster/launcher) retain costs 0/120/320/480/850.
Verify by: Read WEAPON_DEFS in platformer/js/state.js and confirm the 11 entries, their keys, types, and cost values match.

## Scenario 2 — Effect-to-weapon mapping is fixed
Kind: code
Given: WEAPON_DEFS and WEAPON_MAP in platformer/js/state.js
When:  the `effect` field of each weapon is inspected
Then:  flamestaff.effect === 'burn', icewand.effect === 'freeze', stormrod.effect === 'chain', excalibur.effect === 'lifesteal', and fists/sword/hammer/blaster/launcher/knives/spear all have effect === null.
Verify by: Read the WEAPON_DEFS array in platformer/js/state.js and confirm each listed `effect` value.

## Scenario 3 — Upgrade level scales damage and cooldown without mutating defs
Kind: code
Given: a weapon owned at upgrade level 1 (e.g. flamestaff, base damage 4)
When:  getEquippedWeapon() is called with playerData.weaponLevels[key] === 1
Then:  the returned object's damage equals round(base*1.25) and cooldown equals baseCooldown*0.90, while the corresponding entry in WEAPON_DEFS still holds the original base damage/cooldown (no mutation).
Verify by: Read getEquippedWeapon, getWeaponUpgradeCost, and upgradeWeapon in platformer/js/state.js; confirm the returned weapon is computed from the base def and WEAPON_DEFS is not reassigned/mutated.

## Scenario 4 — Burn applies damage-over-time through the death path
Kind: code
Given: a flamestaff (effect 'burn') hit lands on an alive enemy in damageEnemy
When:  damageEnemy applies the burn and updateEnemies runs over subsequent frames
Then:  the enemy gets e._burn = { t: 2.5, dps: weapon.damage*0.5 }, updateEnemies subtracts dps*dt from e.hp while e._burn.t > 0, and when hp reaches 0 the enemy dies exactly once via the existing alive-guarded death/coin-drop branch.
Verify by: Read damageEnemy and updateEnemies in platformer/js/entities.js and confirm burn fields are set on hit and ticked each frame, routing death through the existing e.hp<=0 / e.alive branch.

## Scenario 5 — Freeze halves movement without changing stored speed
Kind: code
Given: an icewand (effect 'freeze') hit on an enemy
When:  updateEnemies processes that enemy while e._freeze > 0
Then:  the enemy's per-frame movement step is multiplied by 0.5, e._freeze decrements by dt toward 0, and the enemy's stored `speed` field is never reassigned by the freeze logic.
Verify by: Read updateEnemies and damageEnemy in platformer/js/entities.js and confirm freeze multiplies movement by 0.5 transiently and does not write e.speed.

## Scenario 6 — Charged attack deals doubled damage
Kind: code
Given: the attack input held continuously for CHARGE_TIME (0.6s) with player.attackCD <= 0
When:  the game loop fires the attack with charged === true
Then:  playerMeleeAttack/spawnProjectile apply ceil(weapon.damage*2) damage and knockback*1.6 (melee also reach*1.3), player._charge resets to 0, and an uncharged tap uses the base upgraded damage.
Verify by: Read the attack-gating block in platformer/js/main.js plus playerMeleeAttack/spawnProjectile in platformer/js/entities.js; confirm _charge accumulates from held input and the charged multipliers are applied.

## Scenario 7 — Old save without weaponLevels loads at level 0 and does not crash (Constraint: backward compatibility)
Kind: e2e
Given: localStorage key `platformer_save` set to a pre-feature JSON value with coins, weapons, equippedWeapon, and levelProgress but NO weaponLevels key
When:  platformer/platformer.html is loaded and the game initializes
Then:  the page loads without a console error/exception, the player's coins and owned weapons are preserved, and every weapon reports upgrade level 0 (shop shows 0 filled pips for owned weapons).
Verify by: In the browser, seed localStorage with a legacy save object lacking weaponLevels, reload platformer.html, open the shop, and observe owned weapons show zero upgrade pips with no thrown error in the console and coins unchanged.

## Scenario 8 — Upgrade cannot exceed max or be bought without coins (Constraint: save/coin integrity)
Kind: code
Given: a weapon at WEAPON_UPGRADE_MAX, and separately a weapon below max with insufficient coins
When:  upgradeWeapon(key) is called in each case
Then:  for the maxed weapon it returns false, leaves weaponLevels[key] unchanged, and getWeaponUpgradeCost(key) returns null; for the underfunded weapon it returns false and leaves both weaponLevels[key] and coins unchanged with no localStorage write.
Verify by: Read upgradeWeapon and getWeaponUpgradeCost in platformer/js/state.js and confirm the max-level guard, the affordability guard, and that savePlayerData() is only called on a successful upgrade.

## Scenario 9 — Levels remain beatable with fists / no enemy balance change (Constraint: must-not-happen)
Kind: code
Given: the implemented weapons feature
When:  enemy and boss construction (placeEnemies/makeBoss/SPECIES) and updateEnemies are inspected
Then:  no code path in the weapons feature writes enemy/boss maxHp, dmg, base speed, or spawn count; the only enemy mutations from weapons are e.hp reduction and the transient e._burn/e._freeze fields, so fists-only completion is unaffected.
Verify by: Grep platformer/js/entities.js for assignments to e.maxHp/e.dmg/e.speed within the weapons/effect code and confirm none exist; Read damageEnemy/updateEnemies to confirm only e.hp, e._burn, e._freeze are written by effect logic.

## Scenario 10 — Shop shows upgrade controls reusing existing classes
Kind: e2e
Given: a player who owns at least one upgradeable weapon and has enough coins for its next level
When:  the shop overlay is opened and the weapon's upgrade button is clicked
Then:  the card shows upgrade pips (★/☆) and a 🪙-cost upgrade button using existing shop CSS classes; after clicking, the filled-pip count increases by one, the coin balance drops by the upgrade cost, and the card's DMG/cooldown stat line reflects the higher upgraded value.
Verify by: In the browser, open platformer.html shop, click a weapon upgrade button, and observe one more filled pip, reduced coin count, and an increased DMG stat on that card (classes shop-card/shop-stars/shop-buy/shop-wstat reused, no new selectors).
