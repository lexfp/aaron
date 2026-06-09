# SPEC: Boss Signature Mechanics

## Goal
A player fighting a stage boss can face one bespoke, telegraphed non-projectile signature mechanic per boss species so that every one of the 10 bosses feels distinct beyond its shared projectile rotation.

## Requirements
1. Each of the 10 boss species gains exactly one bespoke NON-PROJECTILE signature mechanic in addition to its existing 3-attack projectile rotation; the signature is a separate code path from `BOSS_SPECIALS`/`triggerBossSpecial` (which fire `enemyShots` bolts).
2. The existing 3-attack `BOSS_SPECIALS` rotation, `_specialIdx` cycling, `_specialCD`/`_baseCD` timing, `_atkFlash` telegraph, `spawnBossMinion` (4-minion cap), the 50%-HP rage phase (speed ×1.4, `leapEvery` ×0.7, `swoopSpeed` ×1.3, `_specialCD` ×0.65, orange aura/ring, "ENRAGED" HP-bar label), and the exit-lock behavior (`isBossAlive` gating `checkExit`) remain unchanged in observable behavior.
3. Every signature mechanic shows a visible in-canvas telegraph for at least 0.3 seconds before its first damaging moment occurs.
4. Every signature mechanic is avoidable using only base movement (run + double jump at base stats) with no purchased upgrades; signatures never clamp, teleport, or trap the player.
5. Every signature mechanic that can damage the player routes that damage through the existing `hurtPlayer` path so it respects `player.invuln` i-frames (`INVULN_TIME=0.9`), sets `player.hurtFlash`, applies knockback, and kills only when `player.hp` reaches 0.
6. The boss never leaves the arena: any boss movement caused by a signature stays clamped to `[e.patrolMin, e.patrolMax]`, exactly as the existing `boss`/slide behavior does.
7. slime signature `split`: the first time the boss drops to or below 50% HP, in addition to entering rage it spawns 2 mini-slime minions (one each side of the arena) via the existing `spawnBossMinion`/minion-template path; the split fires at most once per boss life (`_split` flag).
8. crawler signature `burrow`: on a per-boss timer the crawler telegraphs by dropping a dust marker (a tracked zone) at the player's current x for ≥0.4s, becomes non-collidable while underground, then re-emerges at that marked x; the marker x is captured at telegraph start so the player can step off it.
9. slider signature `iceTrail`: while `_sliding` (its existing ice-dash special), the slider leaves a tracked ice-trail zone along the arena floor; if the player stands on a live ice-trail zone their idle friction is overridden toward slippery for a capped duration `player.iceSlipT` (≤2.5s), and friction returns to `getStageModifier().fric` when the timer expires or the player leaves all trail zones for that duration.
10. scorpion signature `poisonCloud`: spawns 1–2 lingering poison-cloud zones on the arena floor that each expire after a fixed lifetime (≤5s); standing inside a live cloud deals damage-over-time through `hurtPlayer` no more often than once per `INVULN_TIME` window (i-frames naturally gate the ticks).
11. lavablob signature `firePatch`: ignites 2–3 marked floor patches that show a ≥0.5s warning telegraph, then burn for a fixed lifetime (≤4s); contact with a burning patch damages the player via `hurtPlayer`; patches expire so the arena floor is never permanently denied.
12. bird signature `windGust`: telegraphs a lean + wind particles for ≥0.4s, then applies a horizontal push to `player.vx` for a capped duration (≤1.2s) via a `player.windPushT`/`player.windPushDir` pair read in `updatePlayer`; the push never exceeds base run speed in magnitude and the player can still move and jump against it.
13. shroom signature `sporeDaze`: releases a spore cloud telegraphed for ≥0.4s; if the player is inside it when it bursts, `player.dazeT` is set (≤1.5s) and while `dazeT>0` the player's horizontal input is dampened (reduced control), with a visible spore overlay around the player; the player still moves and jumps.
14. drone signature `shield`: projects an energy shield (`e.shieldHp`>0) that absorbs all `damageEnemy` damage to the boss until `shieldHp` reaches 0 or the shield times out (≤6s); a visible shield ring is drawn while active and the shield has a per-boss cooldown so it cannot be permanently up.
15. golem signature `crystalFall`: marks 2–4 ceiling-crystal drop spots with shadow markers on the arena floor for ≥0.5s, then drops crystals at those x positions; a crystal damages the player via `hurtPlayer` only during its fall/impact, and each crystal is removed after impact so it leaves no permanent obstacle.
16. knight signature `parry`: raises its shield for a telegraphed ≤1.2s parry window (`e.parryT`>0); while parrying, player projectiles (`projectiles`) that would hit the boss are reflected/destroyed and deal no boss damage, and a player melee swing that connects deals no damage and triggers a counter (knockback to the player via `hurtPlayer`); the raised-shield pose is visibly drawn.
17. All signature state lives on the boss enemy object or in module-level arrays declared in `platformer/js/entities.js`; `initEntities` clears every such module-level array and the cloned boss object carries no stale signature state, so a respawn fully resets all signatures (no lingering zones, no active player effects).
18. All player-side signature effect timers (`iceSlipT`, `windPushT`, `windPushDir`, `dazeT`) are fields on `player`, are initialized to 0 in `initPlayer`, and decay to 0 over time; because `initPlayer` runs on every respawn, a death clears all active player control effects.
19. Every lingering zone (dust marker, ice trail, poison cloud, fire patch, crystal-fall marker, spore cloud) has a finite `life`/timer and is removed when it expires; no signature can hold a region of the arena hazardous indefinitely.
20. Signature mechanics run inside the existing per-frame `updateEnemies` boss block (and a paired zone-update loop) at the existing fixed `dt` budget with no new external dependencies and no new timers outside `requestAnimationFrame`-driven `dt`.

## Examples
1. slime boss at 28 HP / 56 max takes a sword hit to 27 HP (below 50%): on that frame `e._rage` becomes true AND `e._split` becomes true, and two new enemies with `_fromBoss === true` and `species === 'slime'` appear (one near `arena.x + arena.w*0.15`, one near the far side). On the next time the boss crosses 50% (it cannot — already below), no further split occurs.
2. slider boss fires its ice-dash special; `e._sliding` is true and it crosses the arena. Ice-trail zones are pushed into the module ice-trail array along the floor. The player walks onto a trail zone: `player.iceSlipT` is set to ~2.0s and idle damping uses a slippery value (~0.965) instead of `getStageModifier().fric`. After 2.0s with no trail contact, `player.iceSlipT` is 0 and idle damping is back to the stage baseline (e.g. 0.72 on a Crystal stage).
3. golem boss triggers `crystalFall`: 3 shadow markers appear on the arena floor at x = 600, 740, 880 for 0.55s (no damage during the telegraph). After the telegraph, 3 crystals fall at those x positions; a player standing at x=740 who does not move takes one `hurtPlayer` hit (HP −14, `invuln` set to 0.9) and the crystals are removed on impact, leaving the floor clear.

## Edge Cases
1. Player is mid-i-frame (`player.invuln > 0`) when a fire patch, poison cloud, or falling crystal contacts them: no additional damage is applied that frame (the existing `hurtPlayer` guard already returns early), and the contact does not extend invuln.
2. Boss dies (HP ≤ 0) while its shield is up, while crystals are mid-fall, or while poison/fire/ice zones are live: the boss death proceeds normally, `isBossAlive()` returns false, and all lingering zones still expire on their own timers (or are cleared on the next `initEntities`) so the now-unlocked exit is reachable.
3. Player dies (falls off, spikes, or HP 0) while `player.dazeT`/`windPushT`/`iceSlipT` is active: `onPlayerDeath → respawnPlayer → initPlayer` resets those fields to 0, so the respawned player has full control with no residual daze/wind/slip.
4. slime boss is somehow already below 50% HP on its first qualifying frame (e.g. opening burst damage): `split` still fires exactly once because it is gated by the same one-shot `_split` flag, and never spawns more than the 2 split minions plus respecting the global 4-minion `spawnBossMinion` cap.
5. drone shield times out (≤6s) with `shieldHp` still > 0: the shield drops, the boss becomes damageable again, and the shield cannot reactivate until its per-boss cooldown elapses (so the boss is never permanently invulnerable).
6. Two ice-trail zones or two poison clouds overlap under the player: the player's effect timer is refreshed (set to its max, not stacked/extended beyond the cap), keeping the control effect within its ≤2.5s bound.

## Constraints
- No new runtime dependencies; pure canvas + vanilla ES modules; must hold 60fps.
- All new module-level arrays in `platformer/js/entities.js` must be reset inside `initEntities` alongside `coins`/`enemies`/`enemyShots`.
- Player control modifications (slider ice-slip, shroom daze, bird wind) must be time-limited to ≤2.5s and visually indicated; control is dampened, never removed (the player can always still move and jump).
- A signature must never make a boss level unwinnable: no permanent arena denial, no permanent boss invulnerability, no trapping/teleporting the player; every zone and every player effect expires on a finite timer.
- All boss movement from a signature stays within `[e.patrolMin, e.patrolMax]`.
- Damage to the player from any signature flows through the existing `hurtPlayer` closure so `INVULN_TIME` i-frames apply uniformly.

## Affected Components
- platformer/js/entities.js — signature mechanic logic in the `updateEnemies` boss block; new module-level zone arrays reset in `initEntities`; zone update + render; shield/parry interception in `damageEnemy`/`playerMeleeAttack`/`updateProjectiles`; signature telegraph/zone drawing in `drawEnemies`.
- platformer/js/player.js — new player effect fields (`iceSlipT`, `windPushT`, `windPushDir`, `dazeT`) added to the `player` object, initialized in `initPlayer`, decayed and applied in `updatePlayer` (idle-friction override, wind push, input damping), plus optional player-overlay rendering for active effects.
- platformer/js/level.js — per-species signature tuning in `makeBoss` (e.g. signature cooldown/lifetime/shield-HP fields seeded onto the boss object alongside `_baseCD`).
- platformer/js/main.js — no behavioral change required; confirms `updateEnemies` is called each frame before `updateEntities` and that the HP refresh path still runs when signature damage changes `player.hp`.

## Interface Contracts
- `initEntities(levelData)` (entities.js): in addition to clearing `coins`/`particles`/`enemies`/`projectiles`/`enemyShots`, clears all new signature zone arrays.
- `updateEnemies(dt, platforms, player)` (entities.js): unchanged signature; still returns `{ playerHit }`; internally drives signature timers and zone damage through the existing `hurtPlayer` closure.
- `damageEnemy(e, dmg, knockDir, knock)` (entities.js): when `e` is a boss with an active shield (`e.shieldHp > 0`), reduces shield instead of HP.
- `playerMeleeAttack(player, weapon)` (entities.js) and `updateProjectiles(dt, platforms)` (entities.js): when a boss has `e.parryT > 0`, a connecting player attack is parried (no boss damage; projectile consumed; melee triggers a counter via `hurtPlayer`).
- `drawEnemies(ctx, camX, W, t)` (entities.js): renders signature telegraphs, lingering zones, shield rings, and raised-shield poses.
- `initPlayer(spawnX, spawnY)` (player.js): sets `player.iceSlipT`, `player.windPushT`, `player.windPushDir`, `player.dazeT` to 0.
- `updatePlayer(dt, platforms, jumpJustPressed)` (player.js): reads `getStageModifier().fric` as the idle-friction baseline, overriding it toward slippery only while `iceSlipT > 0`; adds `windPushDir`-scaled velocity while `windPushT > 0`; dampens horizontal input while `dazeT > 0`.
- `makeBoss(stageIdx, p, arena)` (level.js): seeds per-species signature fields (cooldowns, lifetimes, `shieldHp`, parry timing) onto the returned boss object.
- Boss-object fields added (carried via `initEntities` clone): `_split`, `_burrowState`/`_burrowT`, `_sigCD`, `shieldHp`/`_shieldT`/`_shieldCD`, `parryT`/`_parryCD`, plus per-signature timers.
- Module-level arrays added in entities.js (reset in `initEntities`): a single lingering-zone array (entries tagged by `kind`: `ice`, `poison`, `fire`, `dust`, `crystal`, `spore`) with `{x, y, w, h, kind, life, maxLife, warn}` fields.

## Out of Scope
- Changing the projectile-based `BOSS_SPECIALS` rotation patterns, damage, or cooldowns.
- New boss species, new stages, or changes to non-boss enemy behavior.
- Boss HP/damage rebalancing beyond the seeded signature fields.
- HUD changes; signature feedback is in-canvas only.
- Audio.

## Depends On

## UI Design
None beyond in-canvas telegraphs and effect overlays: shadow/dust markers, glowing fire/poison/ice/spore zones, shield rings, raised-shield poses, and a spore/wind overlay around the player. No DOM/HUD elements are added.

## Security Considerations
None — no network, storage, user input parsing, or `eval`; purely local game state and canvas rendering. No new attack surface.

## Open Questions
None — all ambiguities resolved in Requirements (signature list fixed, all durations capped, damage routed through `hurtPlayer`, state reset via `initEntities`/`initPlayer`).

## Priority
Needed soon — the user wants every boss to feel very unique; this is the differentiating layer on top of the shared projectile rotation.
