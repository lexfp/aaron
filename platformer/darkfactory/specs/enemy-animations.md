# SPEC: Enemy Procedural Animations

## Goal
A player can see enemies visibly animate — locomotion, attack telegraphs, hit/death reactions, and idle motion — so that the platformer reads as lively and combat feedback is legible without any change to gameplay.

## Requirements
1. Animation is render-only: it lives entirely inside `drawEnemies` / `SPECIES_DRAW` draw functions (and small new render-only fields on enemy objects). No animation code path may modify `e.x`, `e.y`, `e.w`, `e.h`, `e.hp`, `e.alive`, `e.dir`, `e.vy`, or any gameplay state read by `updateEnemies`, collision, or `damageEnemy`.
2. Walk-behavior species (`crawler`, `slider`, `golem`) show a body bob and/or leg shuffle whose phase is keyed to horizontal travel using existing per-frame state (`e.t`, `e.x`, `e.dir`), so the cycle visibly advances while the enemy moves and is near-still when it is at a patrol endpoint.
3. Hop-behavior species (`slime`, `lavablob`, `shroom`) render a squash (wider/shorter) the frame they are grounded (`e.vy === 0`) and a stretch (taller/narrower) while rising (`e.vy < 0`), driven by the existing `e.vy` field; the existing slime/shroom `air`-keyed squash is preserved or improved, not removed.
4. Flying-pursuit species (`bee`, `ember`) flap their wings faster when actively chasing (when `Math.hypot(player−enemy) < 300`, matching the `fly` behavior's chase test) than when hovering home; the flap rate is computed in the draw function from enemy/player positions passed to `drawEnemies`, with no new gameplay state.
5. The `spider` species visibly skitters its legs (increased leg-wiggle amplitude/rate) while descending or climbing (`e._mode === 1` or `e._mode === 3`) versus while anchored (`e._mode === 0`).
6. Charge-behavior species (`scorpion`, `knight`) shake (small oscillating horizontal render offset) only during the telegraph windup (`e._st === 1`); the shake is a draw-time offset applied via `ctx.translate` and never written to `e.x`.
7. The `drop` species (`icicle`) renders a quiver (small oscillating offset) while still anchored and the player is within its trigger column (`Math.abs(player.cx − enemy.cx) < 30`), before `e._mode` becomes 1.
8. The `shoot` species (`turret`) shows a muzzle glow that builds (grows/brightens) as its fire cooldown `e._cd` approaches 0; the existing `e._cd < 0.4` glow threshold is preserved or extended into a smooth ramp.
9. On a non-fatal hit (`e.hitFlash > 0` and `e.alive`), the enemy renders a brief scale-pulse (drawn larger then settling) in addition to the existing white flash overlay; the pulse uses `e.hitFlash` and adds no new field beyond what already exists.
10. When an enemy dies (`damageEnemy` sets `e.alive = false`), it plays a death visual lasting between 0.25s and 0.4s — a squash-and-fade (and for bosses, an expanding fade) — and only then stops rendering. The death visual is driven by a new render-only field `e._deathT` initialized in `damageEnemy` at the moment of death.
11. A dying enemy (in its death visual, `!e.alive`) is non-interactive immediately: it deals no contact damage, cannot be stomped, does not block projectiles, and is not re-counted as alive — all such loops remain gated on `e.alive` and are not changed.
12. `drawEnemies` skips an enemy only once both `!e.alive` and its death visual has elapsed (`e._deathT` has counted past its duration or is undefined for an enemy that was never alive); the per-frame decrement of `e._deathT` happens in `drawEnemies` using the `t`/`dt` already available to the render layer.
13. Idle life: at least the `slime`, `bee`, `bird`, `scorpion`, `knight`, and `drone` species show an occasional eye blink and/or antenna/tail/plume sway derived from `e.t`, visible while the enemy is otherwise stationary.
14. Boss rendering (×3 `bossScale` transform, red/orange aura, pulsing rage ring, HP bar, `_atkFlash`) continues to work and composes with all new animations — squash/stretch, telegraph shake, hit pulse, and death visual all apply inside or around the existing `ctx.scale(bossScale)` block without distorting the aura or HP bar position.
15. With 15+ enemies on screen the render loop performs no per-enemy heap allocations introduced by this feature (no `new`, array literals, or object literals created inside the per-enemy draw path for animation); all animation math uses scalars and existing fields.
16. Respawn resets all animation state: `initEntities` produces fresh enemy clones with `_deathT` unset and `hitFlash`/`t`/behavior-state fields at their initial values, so a respawned level shows no residual death/hit visuals.

## Examples
1. A `slime` (hop) sitting on a platform with `e.vy === 0`: rendered body is squashed to roughly 1.15× width and 0.85× height with a gentle idle wobble; the instant it leaps and `e.vy` becomes −250, it renders stretched (~0.88× width, 1.12× height). Its `e.x`/`e.y` are identical to the no-animation build at every frame.
2. A `scorpion` (charge) enters telegraph: `e._st` becomes 1 for 0.32s. During those frames the sprite oscillates ±~1.5px horizontally (tail also lifts, as today) via `ctx.translate`, then snaps to a clean dash pose when `e._st` becomes 2. `e.x` is never altered by the shake — verified by the dash starting from exactly the patrol position.
3. A `bat` boss at 3 HP takes a killing blow: `damageEnemy` sets `alive=false` and `_deathT=0.35`. For the next 0.35s `drawEnemies` shows the boss sprite squashing and fading (with the existing explosion particles), then stops drawing it. During all 0.35s the contact loop, stomp check, and projectile loop skip it because `!e.alive`, so the player standing on the death spot takes no damage.

## Edge Cases
1. An enemy killed off-screen (outside the `camX` cull window): `_deathT` is still set in `damageEnemy`, but `drawEnemies` culls it by position so no death visual is drawn; when the level respawns the clone has no `_deathT`, so nothing lingers. The enemy is non-interactive from the kill frame regardless of being culled.
2. An enemy that dies the same frame the player's melee swing resolves: because attack resolves before contact (main.js order) and `e.alive` is already false, the death visual starts and the player takes no contact damage that frame — the death animation must not reintroduce a contactable hitbox.
3. A boss reaching 50% HP (rage) the same frame it is hit: the hit scale-pulse and the rage aura/ring both render without one overwriting the other's transform (each wrapped in its own save/restore).
4. Two enemies overlapping while one is mid-death: the dying one (`!e.alive`) is drawn (death visual) but contributes nothing to collision; the live one animates normally. Neither allocates per-frame.
5. `_deathT` reaching exactly 0 on a frame: the enemy is drawn that final frame (or skipped) deterministically — once `e._deathT <= 0` it is no longer drawn — with no flicker or double-skip.

## Constraints
- Hitboxes, movement, damage values, knockback, AI, spawn logic, and all gameplay-observable behavior are unchanged; this feature touches only rendering and adds render-only fields.
- A dead/dying enemy (`!e.alive`) must remain non-interactive: contact-damage, stomp, projectile-block, and `isBossAlive` checks stay gated on `e.alive` and are not modified.
- Boss ×3 scaling and the red/orange aura, pulsing rage ring, and HP bar must keep working and not be visually broken by the new transforms.
- No per-frame heap allocations in the per-enemy draw path (no new arrays/objects/closures created inside the enemy loop for animation); reuse scalars and existing fields. Gradients already created by existing boss/turret/lava art are pre-existing and out of scope to remove.
- 60fps must hold with 15+ enemies on screen on the target 800×500 canvas.
- Respawn via `initEntities` must reset every animation field; clones must not carry a stale `_deathT`.

## Affected Components
- platformer/js/entities.js — `drawEnemies`, `damageEnemy`, the `SPECIES_DRAW` art functions, and the legacy `drawWalker`/`drawJumper`/`drawFlyer`/`drawBrute` helpers; `initEntities` clone shape (ensure `_deathT` unset).
- platformer/js/main.js — `renderFrame` passes the data `drawEnemies` needs for chase-rate and quiver/drop-trigger animations (player center and the frame `dt`), if not already available; no logic change.

## Interface Contracts
- `drawEnemies(ctx, camX, W, t, player?)` — render function in entities.js. If player position is needed for flap-rate/quiver animation, it is passed in (player object or its center coords); the signature change is additive and main.js's call site is updated accordingly. Returns nothing.
- `damageEnemy(e, dmg, knockDir, knock)` — unchanged signature; on the death branch (`e.hp <= 0`) it additionally sets `e._deathT` to the death-visual duration (0.25–0.4s) as a render-only field.
- Enemy object fields added (render-only, read only by the draw layer): `_deathT` (number, seconds remaining of death visual; absent on a live enemy that has never died).
- Existing fields read by the draw layer remain: `e.t`, `e.vy`, `e.dir`, `e.hitFlash`, `e._st`, `e._mode`, `e._cd`, `e._rage`, `e._atkFlash`, `e.boss`, `e.bossScale`, `e.phase`, `e.x`, `e.y`, `e.w`, `e.h`, `e.color`, `e.species`, `e.maxHp`, `e.hp`, `e.anchorY`.
- `initEntities(levelData)` — unchanged signature; clones must not include `_deathT`.

## Out of Scope
- Sprite sheets, image assets, or any external file loading.
- New enemy species, behaviors, or attacks.
- Player, coin, projectile, exit-door, or background animation changes.
- Sound effects.
- Any change to enemy stats, AI tuning, or balance.

## Depends On

## UI Design
None — all visuals are in-canvas procedural drawing on the existing 800×500 game canvas. No DOM/HUD elements added or changed.

## Security Considerations
None — no user input, network, storage, or eval is involved; this is local canvas rendering only.

## Open Questions
None — interpretations chosen: death-visual duration is 0.35s (within the 0.25–0.4s range, matching the existing main.js `deathTimer`); chase-flap rate is computed in-draw from player position passed to `drawEnemies` rather than stored on the enemy.

## Priority
Needed soon — visual polish explicitly requested by the user; low risk because it is render-layer only.
