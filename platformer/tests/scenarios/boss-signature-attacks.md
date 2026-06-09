# Scenarios: Boss Signature Mechanics

## Scenario 1 — slime split fires exactly once at 50% HP
Kind: code
Given: a stage-0 (Meadow) boss level where the slime boss is alive with `_split` unset and HP just above 50% of `maxHp`.
When:  the boss takes damage that drops its HP to or below 50% for the first time.
Then:  on that frame `e._split` becomes true and exactly 2 new enemies with `_fromBoss === true` and `species === 'slime'` are added; crossing/passing 50% again never adds more split minions.
Verify by: read the slime signature/split block in the `updateEnemies` boss section of platformer/js/entities.js (the `_split` one-shot guard alongside the existing `_rage` rage block) and the `spawnBossMinion` call path.

## Scenario 2 — ice-trail slow expires and friction returns to the stage baseline (prohibited-behavior invariant)
Kind: code
Given: a slider boss whose ice-dash special has laid ice-trail zones on the arena floor and a player standing on one with `player.iceSlipT > 0` and slippery idle damping in effect.
When:  `player.iceSlipT` decays to 0 (capped at ≤2.5s) and the player is no longer on any live ice-trail zone.
Then:  `updatePlayer` uses `getStageModifier().fric` as the idle horizontal damping again (no residual slipperiness); `iceSlipT` never exceeds its cap even with overlapping trail zones.
Verify by: read the idle-friction branch in `updatePlayer` in platformer/js/player.js (baseline `getStageModifier().fric`, overridden only while `iceSlipT > 0`) and the `iceSlipT` decay + cap logic.

## Scenario 3 — respawn mid-bossfight clears all lingering zones and player effects (prohibited-behavior invariant)
Kind: code
Given: an active boss fight with live signature zones in the entities.js module zone array (e.g. poison clouds, fire patches, falling crystals) and the player carrying active `dazeT`/`windPushT`/`iceSlipT`.
When:  the player dies and `respawnPlayer` runs (`initEntities` + `initPlayer`).
Then:  the module-level signature zone array is empty after `initEntities`, and `player.iceSlipT`, `player.windPushT`, `player.windPushDir`, `player.dazeT` are all 0 after `initPlayer` — no lingering arena hazard and full player control on respawn.
Verify by: read `initEntities` in platformer/js/entities.js (the signature zone array is reset with `.length = 0` next to `enemyShots`) and `initPlayer` in platformer/js/player.js (the four effect fields set to 0).

## Scenario 4 — every signature telegraphs ≥0.3s before its first damaging moment
Kind: code
Given: any boss species whose signature has a damaging phase (crawler burrow re-emerge, lavablob fire patch, golem crystal fall, scorpion poison cloud, shroom spore burst, bird wind).
When:  the signature is triggered.
Then:  a non-damaging telegraph (dust/shadow marker, warning glow, or lean+particles) is drawn for at least 0.3s before any `hurtPlayer` call or player-effect application from that signature occurs.
Verify by: read each signature's telegraph timer (e.g. `warn`/`_burrowT`/marker lifetime fields, all ≥0.3 or ≥0.4) in the `updateEnemies` boss block and zone-update loop of platformer/js/entities.js, confirming damage/effect is applied only after the telegraph timer elapses.

## Scenario 5 — drone shield blocks player damage then drops, and cannot be permanent (prohibited-behavior invariant)
Kind: code
Given: a drone boss with an active shield (`e.shieldHp > 0`, `_shieldT > 0`).
When:  the player lands melee/projectile hits on the boss, and separately when the shield times out (`_shieldT` reaches 0) with HP unchanged.
Then:  while shielded, `damageEnemy` reduces `e.shieldHp` (not `e.hp`); when the shield times out or `shieldHp` hits 0 the boss `e.hp` becomes damageable again, and the shield cannot reactivate until `_shieldCD` elapses (≤6s up, finite cooldown — never permanently invulnerable).
Verify by: read the shield branch in `damageEnemy` and the drone shield timer/cooldown logic in the `updateEnemies` boss block of platformer/js/entities.js.

## Scenario 6 — knight parry reflects projectiles and counters melee without trapping the player
Kind: code
Given: a knight boss with `e.parryT > 0` (raised-shield window, ≤1.2s) and a player firing a projectile and then swinging melee at the boss.
When:  the player's projectile would overlap the boss and the player's melee hitbox connects during the parry window.
Then:  the projectile is consumed/reflected and deals 0 boss damage, the melee deals 0 boss damage and triggers a counter that calls `hurtPlayer` (respecting `INVULN_TIME`), and the player is never frozen — they retain movement and jump throughout.
Verify by: read the parry interception in `updateProjectiles` and `playerMeleeAttack` (the `e.parryT > 0` guard) plus the `parryT`/`_parryCD` timing in the `updateEnemies` boss block of platformer/js/entities.js.

## Scenario 7 — existing projectile rotation and rage phase remain unchanged
Kind: code
Given: any boss species during a fight.
When:  its `_specialCD` reaches 0 and, separately, its HP first drops to ≤50%.
Then:  `triggerBossSpecial` still cycles the same 3 `BOSS_SPECIALS` entries via `_specialIdx`, `_specialCD` resets to `_baseCD * (rage ? 0.65 : 1.0)`, and the rage block still applies speed ×1.4 / `leapEvery` ×0.7 / `swoopSpeed` ×1.3 / orange aura + "ENRAGED" label — observable projectile and rage behavior is unchanged by the signature additions.
Verify by: read `triggerBossSpecial`, the `BOSS_SPECIALS` table, and the `_rage`/`_specialCD` block in `updateEnemies` (plus the aura/HP-bar render in `drawEnemies`) in platformer/js/entities.js, confirming they are untouched except for the additive `_split` one-shot.

## Scenario 8 — bird wind push is bounded and beatable with base movement
Kind: e2e
Given: a stage-5 (Sky) bird boss fight loaded in the browser, player standing on the arena.
When:  the bird telegraphs a wind gust (visible lean + wind particles) and then pushes the player horizontally.
Then:  the player is pushed sideways for ≤1.2s by no more than base run speed, can still walk back against the gust and double-jump, the push ends on its own, and the player is never shoved off the arena or out of `[patrolMin, patrolMax]` bounds.
Verify by: in the browser, observe the wind telegraph then a brief bounded sideways drift; confirm holding the opposite movement key visibly counters it and the player regains full control within ~1.2s without dying.
