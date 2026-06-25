# Scenarios: Enemy Procedural Animations

## Scenario 1 — Hop species squash and stretch keyed to vy
Kind: code
Given: a `slime` enemy whose `behavior === 'hop'`, with the `drawSlime` function (or its hop equivalent) reading `e.vy`.
When:  the enemy is grounded (`e.vy === 0`) versus rising (`e.vy < 0`) across two consecutive renders.
Then:  the rendered ellipse is wider-and-shorter when grounded and taller-and-narrower when rising, computed only from `e.vy`/`e.t`/`e.phase`; no line in the hop draw path assigns to `e.x`, `e.y`, `e.w`, `e.h`, or `e.vy`.
Verify by: reading `drawSlime` (and `drawShroom`, `drawLavaBlob`) in platformer/js/entities.js — confirm the scale factors derive from `e.vy` and that no enemy gameplay field is mutated in the draw function.

## Scenario 2 — Charge telegraph shake is render-only (must-NOT-mutate position)
Kind: code
Given: a `scorpion` enemy in telegraph state (`e._st === 1`) handled by `drawScorpion`.
When:  the telegraph frames are rendered.
Then:  a horizontal shake offset is applied via `ctx.translate` inside the draw function, and `e.x` is identical before and after `drawScorpion` runs (the dash in `updateEnemies` still begins from the unshaken patrol position).
Verify by: reading `drawScorpion` and `drawKnight` in platformer/js/entities.js — confirm the shake uses a local offset / `ctx.translate` and never writes `e.x`; cross-check the `charge` block in `updateEnemies` is unchanged.

## Scenario 3 — Dying enemy is non-interactive during its death visual (must-NOT-happen)
Kind: code
Given: an enemy killed by `damageEnemy` (so `e.alive === false` and `e._deathT` is set to ~0.35), still being drawn for its death animation.
When:  the player overlaps the enemy's former hitbox during the death visual, and projectiles pass through it.
Then:  the contact-damage loop, stomp check, projectile collision loop, and `isBossAlive` all skip it because they are gated on `e.alive`; the player takes no damage and projectiles are not blocked by the dying enemy.
Verify by: reading `updateEnemies` (the `for (const e of enemies)` guard `if (!e.alive) continue;`), `playerMeleeAttack`, `detonate`, `updateProjectiles`, and `isBossAlive` in platformer/js/entities.js — confirm none were changed to consider a dying enemy interactive, and that `damageEnemy` sets `_deathT` without flipping `alive` back.

## Scenario 4 — Death visual elapses then enemy stops rendering
Kind: code
Given: a non-boss enemy with `e.alive === false` and `e._deathT > 0`.
When:  `drawEnemies` runs over successive frames decrementing `e._deathT` by the frame `dt`/`t` delta.
Then:  the enemy renders a squash-and-fade for between 0.25s and 0.4s, and once `e._deathT <= 0` it is no longer drawn; a freshly cloned enemy from `initEntities` has no `_deathT` and is drawn normally.
Verify by: reading `drawEnemies` and `initEntities` in platformer/js/entities.js — confirm the skip condition draws the death visual while `_deathT > 0`, stops after, and that the clone object literal in `initEntities` does not include `_deathT`.

## Scenario 5 — Boss animations compose with scale, aura, and HP bar
Kind: code
Given: a boss enemy (`e.boss === true`, `e.bossScale === 3`) that is hit (`e.hitFlash > 0`) and later killed (`e._deathT > 0`), with `_rage` possibly active.
When:  `drawEnemies` renders the boss.
Then:  the hit scale-pulse and death squash apply inside/around the existing `ctx.scale(e.bossScale)` block, the red/orange aura and pulsing rage ring still draw, and the HP bar still renders over the boss — each transform wrapped in its own `ctx.save()/restore()` so none leaks.
Verify by: reading the boss branch of `drawEnemies` in platformer/js/entities.js — confirm save/restore nesting around the new pulse/death transforms and that the aura + HP-bar code is intact.

## Scenario 6 — Flier flap rate increases while chasing
Kind: code
Given: a `bee` (`behavior === 'fly'`) and the player, with the flap animation in `drawBee`.
When:  the player is within 300px (chasing) versus beyond 300px (hovering home).
Then:  the wing-flap angular rate is higher in the chasing case, computed in the draw function from the player position made available to `drawEnemies`; no gameplay field is written and the `fly` movement block in `updateEnemies` is unchanged.
Verify by: reading `drawBee` (and `drawEmber`) and the `drawEnemies` signature/call in platformer/js/entities.js plus the `drawEnemies` call site in platformer/js/main.js — confirm player position is passed through and used only for flap rate.

## Scenario 7 — No per-frame allocations in the enemy draw loop
Kind: code
Given: the per-enemy body of `drawEnemies` and the `SPECIES_DRAW` art functions after the animation changes.
When:  the loop runs for 15+ enemies per frame.
Then:  the animation additions introduce no `new`, array literal, object literal, or closure created inside the per-enemy loop for animation purposes (pre-existing gradients in boss/turret/lava art are unchanged); all new animation math uses scalars and existing fields.
Verify by: reading `drawEnemies` and the modified `SPECIES_DRAW` functions in platformer/js/entities.js — confirm no new allocations were added inside the loop for animation.

## Scenario 8 — Live game runs smoothly with animations on screen
Kind: e2e
Given: the platformer loaded in a browser at platformer/platformer.html on a boss level (e.g. stage 1 level 10) so multiple enemies plus a scaled boss are visible.
When:  the player moves, attacks enemies, and kills the boss.
Then:  enemies visibly walk/hop/flap/telegraph and play a brief death squash/poof on death (no instant disappearance), the game remains responsive (no visible stutter), and killing the boss unlocks the exit exactly as before.
Verify by: observing in the browser that enemies animate, dying enemies show a ~0.3s death visual, frame rate stays smooth with many enemies, and the exit door unlocks only after the boss's death visual while the boss caused no damage during that visual.
