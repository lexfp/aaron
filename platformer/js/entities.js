import { getTheme } from './renderer.js';

export const coins = [];
export const particles = [];
export const enemies = [];
export const projectiles = [];
export const enemyShots = []; // bolts fired by 'shoot' species (space turrets)
export const sigZones = [];  // signature-mechanic lingering zones (ice/poison/fire/dust/crystal/spore)

// Enemy tuning
const E_GRAVITY = 1600;
const STOMP_DAMAGE = 2;   // a head-stomp deals this much (kills 1-2 HP foes)
const STOMP_BOUNCE = 430; // upward velocity given to the player after a stomp
const INVULN_TIME = 0.9;  // player i-frames after taking a contact hit
// Fallback contact damage for legacy enemy types; species define their own `dmg`.
const CONTACT_DAMAGE = { walker: 6, jumper: 8, brute: 15, flyer: 5 };
// Legacy type → behavior mapping (species carry an explicit `behavior` field).
const LEGACY_BEHAVIOR = { walker: 'walk', jumper: 'hop', brute: 'walk', flyer: 'fly' };

export let exitDoor = null;

export function initEntities(levelData) {
  coins.length = 0;
  particles.length = 0;
  enemies.length = 0;
  projectiles.length = 0;
  enemyShots.length = 0;
  sigZones.length = 0;
  playerBombs.length = 0;

  for (const c of levelData.coins) {
    coins.push({ x: c.x, y: c.y, collected: false, spinAngle: c.spinAngle || 0 });
  }

  // Clone enemy templates into live runtime objects (so respawn resets them).
  for (const e of (levelData.enemies || [])) {
    enemies.push({
      ...e,
      maxHp: e.hp,
      alive: true,
      vy: 0,
      t: e.phase || 0,
      hitFlash: 0,
      jumpTimer: e.jumpEvery ? e.jumpEvery * 0.5 : 0,
    });
  }

  exitDoor = { ...levelData.exit };
}

export function addCoinParticles(wx, wy) {
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const speed = 55 + Math.random() * 80;
    particles.push({
      x: wx, y: wy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 55,
      life: 0.52, maxLife: 0.52,
      color: '#f1c40f', size: 4,
      gravity: 200,
    });
  }
}

export function addDJParticles(wx, wy) {
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const speed = 65 + Math.random() * 65;
    particles.push({
      x: wx, y: wy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.38, maxLife: 0.38,
      color: '#00ffe5', size: 3.5,
      gravity: 0,
    });
  }
}

export function addLandParticles(wx, wy) {
  for (let i = 0; i < 5; i++) {
    const spread = (i / 4 - 0.5) * 2;
    particles.push({
      x: wx + spread * 14, y: wy,
      vx: spread * 45,
      vy: -30 - Math.random() * 30,
      life: 0.3, maxLife: 0.3,
      color: 'rgba(200,200,200,0.7)', size: 3,
      gravity: 300,
    });
  }
}

export function addHitParticles(wx, wy, color, n = 7) {
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 130;
    particles.push({
      x: wx, y: wy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      life: 0.4, maxLife: 0.4,
      color, size: 3.5, gravity: 360,
    });
  }
}

export function addExplosion(wx, wy, color) {
  for (let i = 0; i < 22; i++) {
    const angle = (i / 22) * Math.PI * 2;
    const speed = 90 + Math.random() * 200;
    particles.push({
      x: wx, y: wy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.5, maxLife: 0.5,
      color: i % 2 ? color : '#ffae42', size: 5, gravity: 120,
    });
  }
}

export function updateEntities(dt, player, magnetRadius) {
  let coinsCollected = 0;

  for (const coin of coins) {
    if (coin.collected) continue;
    coin.spinAngle += dt * 3.2;

    const cx = coin.x + 8;
    const cy = coin.y + 8;
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;
    const dx = cx - px;
    const dy = cy - py;
    const dist = Math.hypot(dx, dy);

    // Magnet pull
    if (dist < magnetRadius && dist > 4) {
      const pull = 280;
      coin.x -= (dx / dist) * pull * dt;
      coin.y -= (dy / dist) * pull * dt;
    }

    // Collect
    if (Math.abs(dx) < player.w / 2 + 10 && Math.abs(dy) < player.h / 2 + 10) {
      coin.collected = true;
      addCoinParticles(cx, cy);
      coinsCollected++;
    }
  }

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.gravity * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // Stub: updateEnemies(dt, platforms) — TODO when enemies are added
  // updateEnemies(dt, platforms);

  return coinsCollected;
}

export function drawEntities(ctx, camX, stage, t) {
  const theme = getTheme(stage);
  const W = 800;

  // Coins
  for (const coin of coins) {
    if (coin.collected) continue;
    if (coin.x < camX - 30 || coin.x > camX + W + 30) continue;

    const drawW = Math.max(2, Math.abs(Math.cos(coin.spinAngle)) * 16);
    const cx = coin.x + 8;
    const cy = coin.y + 8;

    // Glow
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20);
    glow.addColorStop(0, 'rgba(255,215,0,0.35)');
    glow.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.fill();

    // Coin body
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.ellipse(cx, cy, drawW / 2, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner ring
    ctx.fillStyle = '#e6a800';
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(1, drawW / 2 - 3), 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    if (drawW > 5) {
      ctx.fillStyle = 'rgba(255,255,200,0.75)';
      ctx.beginPath();
      ctx.ellipse(cx - 2, cy - 2, drawW / 2 * 0.45, 2.5, -0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Exit door (locked + dimmed while a stage boss is alive)
  if (exitDoor) {
    const { x, y, w, h } = exitDoor;
    if (x > camX - 60 && x < camX + W + 60) {
      drawExitDoor(ctx, x, y, w, h, theme, t, isBossAlive());
    }
  }

  // Particles (in world space)
  for (const p of particles) {
    if (p.x < camX - 30 || p.x > camX + W + 30) continue;
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Stub: drawEnemies(ctx, camX, W) — TODO when enemies are added
}

function drawExitDoor(ctx, x, y, w, h, theme, t, locked) {
  const pulse = locked ? 0.22 : 0.65 + Math.sin(t * 2.8) * 0.35;
  const acc = locked ? '#555566' : theme.accentColor;

  // Outer glow
  const glow = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, 55);
  glow.addColorStop(0, `rgba(155,89,182,${pulse * 0.28})`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 55, y - 55, w + 110, h + 110);

  // Frame
  ctx.fillStyle = acc;
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);

  // Door body
  ctx.fillStyle = '#1a0a28';
  ctx.fillRect(x, y, w, h);

  // Animated portal interior
  ctx.fillStyle = acc;
  ctx.globalAlpha = pulse * 0.4;
  ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
  ctx.globalAlpha = 1;

  // Star portal center (a lock bar while the boss lives)
  ctx.fillStyle = acc;
  if (locked) {
    ctx.fillRect(x + w / 2 - 8, y + h / 2 - 3, 16, 6);
    ctx.strokeStyle = acc; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2 - 6, 6, Math.PI, 0); ctx.stroke();
    ctx.lineWidth = 1;
  } else {
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Label above the door
  ctx.fillStyle = locked ? '#8888aa' : theme.accentColor;
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(locked ? 'DEFEAT THE BOSS' : 'EXIT', x + w / 2, y - 10);
  ctx.textAlign = 'left';
}

// ─── COMBAT ──────────────────────────────────────────────────────────────

// The exit door stays locked while a stage boss lives (checked by main.js).
export function isBossAlive() {
  return enemies.some(e => e.boss && e.alive);
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function dropCoins(cx, cy, n) {
  for (let i = 0; i < n; i++) {
    // Upper semicircle only — sin is always ≤ 0, so coins scatter left/right/up, never into the platform below.
    const angle = -Math.PI + (i / Math.max(1, n)) * Math.PI;
    const r = 10 + (i % 3) * 12;
    coins.push({
      x: Math.round(cx + Math.cos(angle) * r) - 8,
      y: Math.round(cy + Math.sin(angle) * r) - 8,
      collected: false,
      spinAngle: angle,
    });
  }
  addCoinParticles(cx, cy); // gold burst at the kill spot
}

function killEnemy(e) {
  e.alive = false;
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  addHitParticles(cx, cy, e.color, 12);
  if (e.boss) {
    addExplosion(cx, cy, e.color);
    addExplosion(cx, cy - 20, '#ffd700');
    dropCoins(cx, cy, Math.round(e.maxHp * 1.5)); // big coin pile for bosses
  } else {
    dropCoins(cx, cy, Math.max(1, e.maxHp));      // coins scale with enemy toughness
  }
}

function damageEnemy(e, dmg, knockDir, knock, player, weapon) {
  if (!e.alive) return;
  if (e.boss && e.shieldHp > 0) {
    e.shieldHp = Math.max(0, e.shieldHp - dmg);
    e.hitFlash = 0.1;
    addHitParticles(e.x + e.w / 2, e.y + e.h / 2, '#00d2d3', 3);
    return;
  }
  if (e.boss && e.parryT > 0) { return; } // projectile parried
  e.hp -= dmg;
  e.hitFlash = 0.13;
  if (!e.air) {
    const dx = knockDir * knock * 0.025;
    // free-roaming hoppers take plain knockback; others stay in their band
    if (e.behavior === 'hop') e.x += dx;
    else if (e.patrolMax > e.patrolMin) e.x = Math.max(e.patrolMin, Math.min(e.patrolMax, e.x + dx));
  }

  // Apply on-hit weapon effects
  if (weapon && weapon.effect) {
    if (weapon.effect === 'burn') {
      e._burn = { t: 2.5, dps: weapon.damage * 0.5 };
    } else if (weapon.effect === 'freeze') {
      e._freeze = 1.5;
    } else if (weapon.effect === 'chain') {
      // Deal chain damage to the nearest other alive enemy within 140px
      const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
      let nearest = null, nearDist = Infinity;
      for (const other of enemies) {
        if (!other.alive || other === e) continue;
        const ocx = other.x + other.w / 2, ocy = other.y + other.h / 2;
        const d = Math.hypot(ocx - ecx, ocy - ecy);
        if (d < 140 && d < nearDist) { nearest = other; nearDist = d; }
      }
      if (nearest) {
        const chainDmg = Math.max(1, Math.floor(weapon.damage * 0.5));
        nearest.hp -= chainDmg;
        nearest.hitFlash = 0.13;
        const ncx = nearest.x + nearest.w / 2, ncy = nearest.y + nearest.h / 2;
        if (nearest.hp <= 0) {
          killEnemy(nearest);
        } else {
          addHitParticles(ncx, ncy, '#c8aaff', 4);
        }
      }
    } else if (weapon.effect === 'lifesteal' && player) {
      const heal = Math.min(2, weapon.damage);
      player.hp += heal;
      player.hp = Math.min(player.maxHp, player.hp);
    }
  }

  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  if (e.hp <= 0) {
    e.alive = false;
    e._deathT = e.boss ? 0.4 : 0.35;
    killEnemy(e);
  } else {
    addHitParticles(cx, cy, '#ffffff', 4);
  }
}

// Instant melee swing: damages every enemy inside a hitbox in front of the
// player. Returns the number of enemies killed.
export function playerMeleeAttack(player, weapon, charged) {
  const dmg = charged ? Math.ceil(weapon.damage*2) : weapon.damage;
  const knock = charged ? weapon.knockback*1.6 : weapon.knockback;
  const reach = charged ? Math.ceil((weapon.reach||24)*1.3) : (weapon.reach||24);
  const dir = player.facing, hx = dir>0 ? player.x+player.w-4 : player.x-reach+4;
  const hw = reach+8, hy = player.y-4, hh = player.h+8;
  let kills = 0;
  for (const e of enemies) {
    if (!e.alive) continue;
    if (rectsOverlap(hx, hy, hw, hh, e.x, e.y, e.w, e.h)) {
      if (e.boss && e.parryT > 0 && player.invuln <= 0) {
        // Knight counter: melee swing blocked, player knocked back
        const ecx = e.x + e.w / 2;
        player.hp = Math.max(0, player.hp - Math.round(e.dmg * 0.6));
        player.invuln = INVULN_TIME;
        player.hurtFlash = 0.3;
        player.vx = (ecx >= player.x + player.w / 2 ? -1 : 1) * 380;
        player.vy = -290;
        addHitParticles(ecx, e.y + e.h * 0.5, '#8854d0', 7);
        continue;
      }
      damageEnemy(e, dmg, dir, knock, player, weapon);
      if (!e.alive) kills++;
    }
  }
  return kills;
}

export function spawnProjectile(player, weapon, charged) {
  const dir = player.facing;
  const dmg = charged ? Math.ceil(weapon.damage * 2) : weapon.damage;
  const knock = charged ? weapon.knockback * 1.6 : weapon.knockback;
  projectiles.push({
    x: player.x + player.w / 2 + dir * 16,
    y: player.y + player.h * 0.4,
    vx: dir * (weapon.speed || 500),
    vy: weapon.splash ? -55 : 0, // explosive arrows arc slightly
    grav: weapon.splash ? 340 : 0,
    dmg,
    splash: weapon.splash || 0,
    knock: knock || 200,
    color: weapon.color,
    r: weapon.splash ? 6 : 4,
    life: 2.4, dir,
    effect: weapon.effect || null,
    weapon,
    player,
  });
}

function detonate(pr) {
  if (pr.splash > 0) {
    addExplosion(pr.x, pr.y, pr.color);
    for (const e of enemies) {
      if (!e.alive) continue;
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      if (Math.hypot(cx - pr.x, cy - pr.y) <= pr.splash) {
        damageEnemy(e, pr.dmg, cx < pr.x ? -1 : 1, pr.knock, pr.player, pr.weapon);
      }
    }
  } else {
    for (const e of enemies) {
      if (!e.alive) continue;
      if (rectsOverlap(pr.x - 3, pr.y - 3, 6, 6, e.x, e.y, e.w, e.h)) {
        damageEnemy(e, pr.dmg, pr.dir, pr.knock, pr.player, pr.weapon);
        break;
      }
    }
    addHitParticles(pr.x, pr.y, pr.color, 5);
  }
}

export function updateProjectiles(dt, platforms) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    pr.vy += pr.grav * dt;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.life -= dt;

    let hit = false;
    for (const p of platforms) {
      if (p.type === 'ground') {
        if (pr.x > p.x && pr.x < p.x + p.w && pr.y > p.y) { hit = true; break; }
      } else {
        if (p._crumbleState === 2) continue;
        if (pr.x > p.x && pr.x < p.x + p.w && pr.y > p.y && pr.y < p.y + p.h) { hit = true; break; }
      }
    }
    if (!hit) {
      for (const e of enemies) {
        if (!e.alive) continue;
        if (rectsOverlap(pr.x - 2, pr.y - 2, 4, 4, e.x, e.y, e.w, e.h)) { hit = true; break; }
      }
    }

    if (hit || pr.life <= 0) {
      if (hit) detonate(pr);
      projectiles.splice(i, 1);
    }
  }
}

// ─── BOSS SPECIAL ATTACKS ────────────────────────────────────────────────────
// Each boss has 3 specials that cycle in order. `_specialIdx` tracks position.
// `_specialCD` counts down every frame; fires and resets on zero.
// Rage at 50% HP cuts cooldown by 35% and minion spawn rate by 35%.

function bossFireShot(e, vx, vy, color, dmg, grav, life, r) {
  const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
  enemyShots.push({ x: ecx, y: ecy, vx, vy: vy || 0, dmg, grav: grav || 0,
                    life: life || 2.2, r: r || 7, color, boss: true, species: e.species });
}

// Per-species attack rotations — 3 attacks each, cycled in order.
// Attacks vary by ORIGIN (boss/floor/ceiling/arena-walls/near-player),
// PATTERN (fan/rain/wall/radial/converging), and PHYSICS (straight/arc/hover).
const BOSS_SPECIALS = {
  // ── Stage 0: Meadow ──────────────────────────────────────────────────────────
  // Thorn spray from boss | roots burst FROM THE FLOOR | slow drifting pollen cloud
  slime: [
    (e, pcx, pcy) => { // Thorn spray: rapid tight 5-shot burst aimed at player
      const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
      const ang = Math.atan2(pcy - ecy, pcx - ecx);
      for (let i = -2; i <= 2; i++) {
        const a = ang + i * 0.11;
        bossFireShot(e, Math.cos(a) * 520, Math.sin(a) * 520, '#2ecc71', e.dmg, 0, 1.6, 6);
      }
    },
    (e, pcx, pcy) => { // Root eruption: 3 thick roots burst UP from the floor at player's feet
      const floorY = e.baseY + e.h;
      for (let i = -1; i <= 1; i++) {
        const sx = pcx + i * 52;
        enemyShots.push({ x: sx, y: floorY, vx: 0, vy: -640, dmg: e.dmg, grav: 900, life: 1.9, r: 11, color: '#27ae60', boss: true, species: e.species });
      }
      addHitParticles(pcx, floorY, '#58b94a', 10);
    },
    (e, pcx, pcy) => { // Pollen cloud: 9 slow drifting blobs spread wide toward player
      const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
      const ang = Math.atan2(pcy - ecy, pcx - ecx);
      for (let i = -4; i <= 4; i++) {
        const a = ang + i * 0.25;
        bossFireShot(e, Math.cos(a) * 130, Math.sin(a) * 130, '#a8e063', e.dmg, 0, 3.5, 13);
      }
    },
  ],
  // ── Stage 1: Cave ────────────────────────────────────────────────────────────
  // Stalactites drop FROM THE CEILING | boulders roll at floor level | twin shockwaves
  crawler: [
    (e, pcx, pcy) => { // Stalactite drop: 4 pointed rocks fall from ceiling at player's x
      const ceilY = e.baseY - 340;
      for (let i = -1; i <= 2; i++) {
        const sx = pcx + (i - 0.5) * 58;
        enemyShots.push({ x: sx, y: ceilY, vx: 0, vy: 0, dmg: e.dmg, grav: 1500, life: 2.0, r: 10, color: '#9b9ba8', boss: true, species: e.species });
      }
    },
    (e, pcx, pcy) => { // Boulder roll: 2 massive rocks hurled along the floor toward player
      const floorY = e.baseY + e.h * 0.5;
      const dir = pcx >= e.x + e.w / 2 ? 1 : -1;
      for (let i = 0; i < 2; i++) {
        const ecx = e.x + e.w / 2;
        enemyShots.push({ x: ecx, y: floorY - i * 30, vx: dir * (420 + i * 80), vy: 0, dmg: Math.round(e.dmg * 1.3), grav: 0, life: 1.8, r: 14, color: '#7f8c8d', boss: true, species: e.species });
      }
      addHitParticles(e.x + e.w / 2, floorY, '#95a5a6', 10);
    },
    (e, pcx, pcy) => { // Cave quake: twin shockwaves roll from boss along floor in both directions
      const floorY = e.baseY + e.h * 0.6;
      const ecx = e.x + e.w / 2;
      enemyShots.push({ x: ecx, y: floorY, vx: -550, vy: 0, dmg: e.dmg, grav: 0, life: 1.7, r: 13, color: '#95a5a6', boss: true, species: e.species });
      enemyShots.push({ x: ecx, y: floorY, vx:  550, vy: 0, dmg: e.dmg, grav: 0, life: 1.7, r: 13, color: '#95a5a6', boss: true, species: e.species });
      addHitParticles(ecx, e.y + e.h, '#aaa', 16);
    },
  ],
  // ── Stage 2: Icy Peaks ───────────────────────────────────────────────────────
  // Icicle wall at player height | blizzard rains FROM ABOVE across arena | glacier dash + boulders
  slider: [
    (e, pcx, pcy) => { // Icicle wall: 5 icicles fired in a horizontal line at player's height
      const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
      const dir = pcx >= ecx ? 1 : -1;
      const targetY = pcy - ecy;
      for (let i = -2; i <= 2; i++)
        bossFireShot(e, dir * 490, targetY + i * 24, '#aee3ff', e.dmg, 0, 1.7, 8);
    },
    (e, pcx, pcy) => { // Blizzard: 8 ice shards fall from above across the whole arena
      const ceilY = e.baseY - 310;
      const arenaL = e.patrolMin, arenaW = e.patrolMax - e.patrolMin;
      for (let i = 0; i < 8; i++) {
        const sx = arenaL + (i / 7) * arenaW;
        enemyShots.push({ x: sx, y: ceilY, vx: (i % 2 === 0 ? 1 : -1) * 28, vy: 0, dmg: e.dmg, grav: 920, life: 2.6, r: 7, color: '#dff9fb', boss: true, species: e.species });
      }
    },
    (e, pcx, pcy) => { // Glacier crash: boss charges + 2 giant ice boulders aimed at player
      const dir = pcx >= e.x + e.w / 2 ? 1 : -1;
      e._sliding = true; e._slideDir = dir; e._slideT = 0.65; e._slideV = 600;
      bossFireShot(e, dir * 200, -340, '#74b9ff', Math.round(e.dmg * 1.5), 700, 2.7, 17);
      bossFireShot(e, dir * 330, -480, '#74b9ff', Math.round(e.dmg * 1.5), 700, 2.7, 17);
    },
  ],
  // ── Stage 3: Desert ──────────────────────────────────────────────────────────
  // Sand geysers FROM THE FLOOR | single massive venom blob | 5-shot tail rapid-fire
  scorpion: [
    (e, pcx, pcy) => { // Sand geyser: 3 columns of sand erupt upward from the floor at player
      const floorY = e.baseY + e.h;
      for (let i = -1; i <= 1; i++) {
        const sx = pcx + i * 50;
        enemyShots.push({ x: sx, y: floorY, vx: 0, vy: -700, dmg: e.dmg, grav: 1100, life: 2.0, r: 10, color: '#f39c12', boss: true, species: e.species });
      }
      addHitParticles(pcx, floorY, '#e67e22', 10);
    },
    (e, pcx, pcy) => { // Venom bomb: single massive poisonous blob lobbed at player
      const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
      const dx = pcx - ecx, dy = pcy - ecy;
      const dist = Math.max(80, Math.hypot(dx, dy));
      bossFireShot(e, (dx / dist) * 280, -520, '#cc8e35', Math.round(e.dmg * 1.8), 920, 2.8, 20);
    },
    (e, pcx, pcy) => { // Tail sting: 5 rapid venom bolts in a quick tight burst at player
      const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
      const ang = Math.atan2(pcy - ecy, pcx - ecx);
      for (let i = -2; i <= 2; i++) {
        const a = ang + i * 0.08;
        bossFireShot(e, Math.cos(a) * 600, Math.sin(a) * 600, '#e67e22', e.dmg, 0, 1.5, 7);
      }
    },
  ],
  // ── Stage 4: Lava ────────────────────────────────────────────────────────────
  // Lava columns erupt FROM THE FLOOR | one giant magma bomb | horizontal magma surge + explosion
  lavablob: [
    (e, pcx, pcy) => { // Lava column: 3 superheated pillars erupt from the floor at player's feet
      const floorY = e.baseY + e.h;
      for (let i = -1; i <= 1; i++) {
        const sx = pcx + i * 44;
        enemyShots.push({ x: sx, y: floorY, vx: 0, vy: -780, dmg: Math.round(e.dmg * 1.2), grav: 1200, life: 2.0, r: 13, color: '#ff6b35', boss: true, species: e.species });
      }
      addHitParticles(pcx, floorY, '#ffd32a', 12);
    },
    (e, pcx, pcy) => { // Magma bomb: one enormous molten boulder lobbed at player
      const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
      const dx = pcx - ecx, dy = pcy - ecy;
      const dist = Math.max(80, Math.hypot(dx, dy));
      bossFireShot(e, (dx / dist) * 310, -560, '#ff793f', Math.round(e.dmg * 2), 950, 2.8, 22);
    },
    (e, pcx, pcy) => { // Magma surge: fast horizontal wave aimed at player + floor explosion
      const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
      const ang = Math.atan2(pcy - ecy, pcx - ecx);
      for (let i = -1; i <= 1; i++) {
        const a = ang + i * 0.17;
        bossFireShot(e, Math.cos(a) * 420, Math.sin(a) * 420, '#ffd32a', e.dmg, 0, 1.8, 10);
      }
      addExplosion(ecx, e.y + e.h * 0.5, '#ff793f');
    },
  ],
  // ── Stage 5: Sky ─────────────────────────────────────────────────────────────
  // Instant lightning FROM THE SKY | wind blasts FROM BOTH ARENA WALLS | thunderstorm column
  bird: [
    (e, pcx, pcy) => { // Lightning strike: instant bolt falls from sky directly onto player
      const ceilY = e.baseY - 380;
      // 3 bolts: direct + slight left/right to punish dodging
      for (let i = -1; i <= 1; i++) {
        const sx = pcx + i * 38;
        enemyShots.push({ x: sx, y: ceilY, vx: 0, vy: 1200, dmg: Math.round(e.dmg * 1.4), grav: 0, life: 0.65, r: 8, color: '#fffde7', boss: true, species: e.species });
      }
      addHitParticles(pcx, e.baseY - 300, '#fff176', 8);
    },
    (e, pcx, pcy) => { // Wind wall: shots blast FROM BOTH WALLS of the arena converging on player
      const wallL = e.patrolMin - 10, wallR = e.patrolMax + 10;
      for (let i = -1; i <= 1; i++) {
        enemyShots.push({ x: wallL, y: pcy + i * 38, vx:  520, vy: 0, dmg: e.dmg, grav: 0, life: 1.8, r: 8, color: '#c8e6fa', boss: true, species: e.species });
        enemyShots.push({ x: wallR, y: pcy + i * 38, vx: -520, vy: 0, dmg: e.dmg, grav: 0, life: 1.8, r: 8, color: '#c8e6fa', boss: true, species: e.species });
      }
    },
    (e, pcx, pcy) => { // Thunderstorm: 5 lightning bolts rain from above spread around player
      const ceilY = e.baseY - 350;
      for (let i = -2; i <= 2; i++) {
        const sx = pcx + i * 55;
        enemyShots.push({ x: sx, y: ceilY, vx: 0, vy: 1100, dmg: Math.round(e.dmg * 1.2), grav: 0, life: 0.7, r: 8, color: '#fff9c4', boss: true, species: e.species });
      }
    },
  ],
  // ── Stage 6: Forest ──────────────────────────────────────────────────────────
  // Vine lash aimed at player | 12-way spore burst | mycelium FROM THE FLOOR surrounding player
  shroom: [
    (e, pcx, pcy) => { // Vine lash: 3 fast sharp tendrils aimed precisely at player
      const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
      const ang = Math.atan2(pcy - ecy, pcx - ecx);
      for (let i = -1; i <= 1; i++) {
        const a = ang + i * 0.13;
        bossFireShot(e, Math.cos(a) * 540, Math.sin(a) * 540, '#6ab04c', e.dmg, 0, 1.4, 8);
      }
    },
    (e, pcx, pcy) => { // Spore burst: 12-way slow toxic cloud erupts from boss center
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        bossFireShot(e, Math.cos(a) * 145, Math.sin(a) * 145, '#e17055', e.dmg, 0, 3.6, 12);
      }
      addExplosion(e.x + e.w / 2, e.y + e.h / 2, '#e17055');
    },
    (e, pcx, pcy) => { // Mycelium surge: 4 fungal spikes erupt FROM THE FLOOR encircling player
      const floorY = e.baseY + e.h;
      for (let i = -1; i <= 2; i++) {
        const sx = pcx + (i - 0.5) * 60;
        enemyShots.push({ x: sx, y: floorY, vx: 0, vy: -580, dmg: e.dmg, grav: 800, life: 2.1, r: 12, color: '#8e5a3a', boss: true, species: e.species });
      }
      addHitParticles(pcx, floorY, '#e17055', 10);
    },
  ],
  // ── Stage 7: Space ───────────────────────────────────────────────────────────
  // Laser lock from boss | satellite missiles FROM CEILING | ion orbs linger (zero gravity)
  drone: [
    (e, pcx, pcy) => { // Laser lock: 5 tight rapid beams fired at player from boss
      const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
      const ang = Math.atan2(pcy - ecy, pcx - ecx);
      for (let i = -2; i <= 2; i++) {
        const a = ang + i * 0.07;
        bossFireShot(e, Math.cos(a) * 680, Math.sin(a) * 680, '#00cec9', e.dmg, 0, 1.3, 6);
      }
    },
    (e, pcx, pcy) => { // Satellite strike: 4 guided missiles drop from orbit at player's position
      const ceilY = e.baseY - 360;
      for (let i = -1; i <= 2; i++) {
        const sx = pcx + (i - 0.5) * 60;
        enemyShots.push({ x: sx, y: ceilY, vx: 0, vy: 0, dmg: Math.round(e.dmg * 1.2), grav: 1100, life: 2.0, r: 9, color: '#bff4ff', boss: true, species: e.species });
      }
    },
    (e, pcx, pcy) => { // Ion sphere: 8 slow orbs radiate outward and linger with no gravity
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        bossFireShot(e, Math.cos(a) * 120, Math.sin(a) * 120, '#00d2d3', e.dmg, 0, 4.5, 11);
      }
      addHitParticles(e.x + e.w / 2, e.y + e.h / 2, '#00cec9', 8);
    },
  ],
  // ── Stage 8: Crystal ─────────────────────────────────────────────────────────
  // Crystal spires FROM THE FLOOR across arena | 10-way shard nova | tight lance at player
  golem: [
    (e, pcx, pcy) => { // Crystal spires: 5 sharp spikes erupt from the floor spread across arena
      const floorY = e.baseY + e.h;
      const arenaL = e.patrolMin, arenaW = e.patrolMax - e.patrolMin;
      for (let i = 0; i < 5; i++) {
        const sx = arenaL + (i + 0.5) * (arenaW / 5);
        enemyShots.push({ x: sx, y: floorY, vx: 0, vy: -720, dmg: Math.round(e.dmg * 1.1), grav: 1050, life: 2.0, r: 10, color: '#48dbfb', boss: true, species: e.species });
      }
    },
    (e, pcx, pcy) => { // Shard nova: 10-way burst from boss + crystal explosion
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        bossFireShot(e, Math.cos(a) * 310, Math.sin(a) * 310, '#00ffe5', e.dmg, 0, 1.9, 8);
      }
      addExplosion(e.x + e.w / 2, e.y + e.h / 2, '#48dbfb');
    },
    (e, pcx, pcy) => { // Crystal lance: 4 razor shards in a very tight aimed cone at player
      const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
      const ang = Math.atan2(pcy - ecy, pcx - ecx);
      for (let i = -1; i <= 2; i++) {
        const a = ang + (i - 0.5) * 0.1;
        bossFireShot(e, Math.cos(a) * 480, Math.sin(a) * 480, '#bff4ff', Math.round(e.dmg * 1.1), 0, 1.6, 8);
      }
    },
  ],
  // ── Stage 9: Dark Fortress ───────────────────────────────────────────────────
  // Shadow leap + burst | curse bolts FROM NEAR THE PLAYER | 8-way dark eruption + charge
  knight: [
    (e, pcx, pcy) => { // Shadow slash: leaps at player then fires 3 blades on approach
      const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
      const ang = Math.atan2(pcy - ecy, pcx - ecx);
      for (let i = -1; i <= 1; i++) {
        const a = ang + i * 0.18;
        bossFireShot(e, Math.cos(a) * 560, Math.sin(a) * 560, '#8854d0', e.dmg, 0, 1.4, 9);
      }
      const dir = pcx >= ecx ? 1 : -1;
      if (e.vy === 0) { e.vy = -500; e._vx = dir * 300; }
    },
    (e, pcx, pcy) => { // Shadow portal: dark bolts materialize FROM NEAR THE PLAYER and fire outward
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        enemyShots.push({ x: pcx, y: pcy - 16, vx: Math.cos(a) * 310, vy: Math.sin(a) * 310, dmg: e.dmg, grav: 0, life: 1.8, r: 9, color: '#6c5ce7', boss: true, species: e.species });
      }
      addHitParticles(pcx, pcy, '#8854d0', 14);
    },
    (e, pcx, pcy) => { // Dark eruption: 8-way shadow burst from boss + charging shadow dash
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        bossFireShot(e, Math.cos(a) * 370, Math.sin(a) * 370, '#a29bfe', e.dmg, 0, 2.0, 8);
      }
      addExplosion(e.x + e.w / 2, e.y + e.h / 2, '#8854d0');
      const dir = pcx >= e.x + e.w / 2 ? 1 : -1;
      e._sliding = true; e._slideDir = dir; e._slideT = 0.45; e._slideV = 520;
    },
  ],
};

function triggerBossSpecial(e, pcx, pcy) {
  const attacks = BOSS_SPECIALS[e.species];
  if (!attacks) return;
  e._atkFlash = 0.45;
  if (e._specialIdx === undefined) e._specialIdx = 0;
  attacks[e._specialIdx % attacks.length](e, pcx, pcy);
  e._specialIdx = (e._specialIdx + 1) % attacks.length;
}

// Spawns a regular-sized minion from the boss's stage roster on the opposite
// side of the arena. Capped at 4 live boss-spawned minions at once.
function spawnBossMinion(boss) {
  const t = boss._minionTemplate;
  const arena = boss._minionArena;
  if (!t || !arena) return;
  if (enemies.filter(e => e._fromBoss && e.alive).length >= 4) return;

  const air = ['fly', 'swoop', 'float', 'orbit'].includes(t.behavior);
  const sideX = boss.x > arena.x + arena.w / 2
    ? arena.x + arena.w * 0.15
    : arena.x + arena.w * 0.82 - t.w;
  const spawnY = air ? arena.y - 95 : arena.y - t.h;
  const minion = {
    ...t,
    maxHp: t.hp,
    alive: true, vy: 0, t: 0, hitFlash: 0,
    jumpTimer: t.jumpEvery ? t.jumpEvery * 0.5 : 0,
    x: Math.round(sideX),
    y: Math.round(spawnY),
    dir: boss.x > arena.x + arena.w / 2 ? 1 : -1,
    phase: Math.random() * 6.28,
    patrolMin: Math.round(arena.x + 4),
    patrolMax: Math.round(arena.x + arena.w - 4 - t.w),
    baseX: Math.round(sideX + t.w / 2),
    baseY: Math.round(spawnY),
    _fromBoss: true,
  };
  if (t.behavior === 'hop') minion.baseY = minion.y;
  if (t.behavior === 'fly') { minion.ampX = 55; minion.ampY = 24; minion.sx = 1.1; minion.sy = 1.7; }
  enemies.push(minion);
  addExplosion(minion.x + t.w / 2, minion.y + t.h / 2, t.color); // spawn flash
}

// Per-species behavior AI + player contact/stomp. Returns { playerHit }.
// Behaviors: walk (patrol), hop (bouncing patrol), fly (sine hover), swoop
// (hover→dive at player→return), float (slow homing drift), orbit (circles an
// anchor), charge (telegraph then dash), drop (falls when you pass beneath),
// spider (descends a thread, climbs back), shoot (fires bolts at the player).
export function updateEnemies(dt, platforms, player) {
  let playerHit = false;
  const pcx = player.x + player.w / 2;
  const pcy = player.y + player.h / 2;

  const hurtPlayer = (dmg, fromX) => {
    if (player.invuln > 0 || player.dead) return;
    player.hp -= dmg;
    player.invuln = INVULN_TIME;
    player.hurtFlash = 0.3;
    player.vx = (fromX >= pcx ? -1 : 1) * 260; // knock away from the source
    player.vy = -250;
    if (player.hp <= 0) { player.hp = 0; playerHit = true; }
  };

  for (const e of enemies) {
    if (!e.alive) continue;
    e.t += dt;
    if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);

    // Tick burn effect: subtract dps*dt from hp while _burn.t > 0
    if (e._burn && e._burn.t > 0) {
      e._burn.t -= dt;
      e.hp -= e._burn.dps * dt;
      if (e.hp <= 0) {
        e.alive = false;
        killEnemy(e);
        continue;
      }
      if (e._burn.t <= 0) e._burn = null;
    }

    // Tick freeze timer: decrement by dt (halves movement while > 0)
    if (e._freeze > 0) {
      e._freeze -= dt;
      if (e._freeze < 0) e._freeze = 0;
    }

    // Time Stop: full AI freeze — skip all logic while _frozenT > 0
    if ((e._frozenT || 0) > 0) {
      e._frozenT -= dt;
      if (e._frozenT < 0) e._frozenT = 0;
      continue;
    }

    if (!e.alive) continue;

    const bhv = e.behavior || LEGACY_BEHAVIOR[e.type] || 'walk';
    const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
    const freezeMul = (e._freeze && e._freeze > 0) ? 0.5 : 1;

    if (bhv === 'fly') {
      // Free-flying: pursues the player when near, otherwise hovers near home.
      const distP = Math.hypot(pcx - ecx, pcy - ecy);
      if (distP < 300 && distP > 1) {
        const sp = (e.chase || 85) * freezeMul;
        e.x += (pcx - ecx) / distP * sp * dt;
        e.y += (pcy - ecy) / distP * sp * dt + Math.sin(e.t * 3) * 10 * dt * freezeMul;
        e.dir = pcx >= ecx ? 1 : -1;
      } else {
        const hx = e.baseX + Math.sin(e.t * e.sx) * e.ampX;
        const hy = e.baseY + Math.sin(e.t * e.sy + 1.3) * e.ampY;
        e.x += (hx - e.x) * Math.min(1, dt * 2.5 * freezeMul);
        e.y += (hy - e.y) * Math.min(1, dt * 2.5 * freezeMul);
        e.dir = Math.cos(e.t * e.sx) >= 0 ? 1 : -1;
      }
    } else if (bhv === 'hop') {
      // Free-roaming hopper: real gravity + landing on any platform; hops toward
      // the player when they're near instead of staying on its home patrol.
      e.vy += E_GRAVITY * dt;
      const prevBottom = e.y + e.h;
      e.y += e.vy * dt;
      let grounded = false;
      if (e.vy >= 0) {
        for (const pl of platforms) {
          if (pl._crumbleState === 2) continue;
          if (e.x + e.w <= pl.x || e.x >= pl.x + pl.w) continue;
          if (prevBottom <= pl.y + 6 && e.y + e.h >= pl.y) {
            e.y = pl.y - e.h; e.vy = 0; grounded = true; break;
          }
        }
      }
      if (e.y > 600) { e.alive = false; continue; } // hopped into a pit
      const near = Math.abs(pcx - ecx) < 320 && Math.abs(pcy - ecy) < 240;
      if (grounded) {
        if (near) e.dir = pcx >= ecx ? 1 : -1;
        e.jumpTimer -= dt;
        if (e.jumpTimer <= 0) { e.vy = -(e.jumpForce || 480); e.jumpTimer = e.jumpEvery || 1.4; }
        e.x += e.dir * e.speed * freezeMul * dt * (near ? 1 : 0.65);
        if (!near) { // patrol the home platform while idle
          if (e.x <= e.patrolMin) { e.x = e.patrolMin; e.dir = 1; }
          else if (e.x >= e.patrolMax) { e.x = e.patrolMax; e.dir = -1; }
        }
      } else {
        e.x += e.dir * e.speed * freezeMul * dt; // carry momentum through the air
      }
    } else if (bhv === 'boss') {
      if (e._sliding) {  // slider boss: high-speed ice dash across arena
        e.dir = e._slideDir;
        e.x = Math.max(e.patrolMin, Math.min(e.patrolMax, e.x + e._slideDir * e._slideV * freezeMul * dt));
        e._slideT -= dt;
        if (e._slideT <= 0 || e.x <= e.patrolMin + 4 || e.x >= e.patrolMax - 4) {
          e._sliding = false;
          addHitParticles(ecx, ecy, '#82ccdd', 8); // ice shatter on stop
        }
      } else if (e.vy !== 0 || e.y < e.baseY) { // airborne mid-leap
        e.vy += E_GRAVITY * dt;
        e.y += e.vy * dt;
        e.x = Math.max(e.patrolMin, Math.min(e.patrolMax, e.x + (e._vx || 0) * freezeMul * dt));
        if (e.y >= e.baseY) {
          e.y = e.baseY; e.vy = 0; e._vx = 0;
          e._landShockT = 0.45;
          addLandParticles(ecx, e.y + e.h);
        }
      } else {
        if (e._cd === undefined) e._cd = 1.1;
        e._cd = Math.max(0, e._cd - dt);
        e.dir = pcx >= ecx ? 1 : -1;
        e.x = Math.max(e.patrolMin, Math.min(e.patrolMax, e.x + e.dir * e.speed * freezeMul * dt));
        if (e._cd <= 0) {
          e.vy = -e.leapForce;
          e._vx = e.dir * Math.max(120, Math.min(330, Math.abs(pcx - ecx)));
          e._cd = e.leapEvery;
        }
      }
    } else if (bhv === 'walk') {
      e.x += e.dir * e.speed * freezeMul * dt;
      if (e.x <= e.patrolMin) { e.x = e.patrolMin; e.dir = 1; }
      else if (e.x >= e.patrolMax) { e.x = e.patrolMax; e.dir = -1; }
    } else if (bhv === 'charge') {
      e._cd = Math.max(0, (e._cd || 0) - dt);
      if (e._st === 2) {            // dashing
        e.x += e.dir * e.chargeSpeed * freezeMul * dt;
        e._stT -= dt;
        if (e.x <= e.patrolMin) { e.x = e.patrolMin; e._st = 0; e._cd = 1.3; }
        else if (e.x >= e.patrolMax) { e.x = e.patrolMax; e._st = 0; e._cd = 1.3; }
        else if (e._stT <= 0) { e._st = 0; e._cd = 1.3; }
      } else if (e._st === 1) {     // telegraph windup
        e._stT -= dt;
        if (e._stT <= 0) { e._st = 2; e._stT = 0.9; }
      } else {                      // patrol + look for the player
        e.x += e.dir * e.speed * freezeMul * dt;
        if (e.x <= e.patrolMin) { e.x = e.patrolMin; e.dir = 1; }
        else if (e.x >= e.patrolMax) { e.x = e.patrolMax; e.dir = -1; }
        if (!e._cd && Math.abs(pcy - ecy) < 70 && Math.abs(pcx - ecx) < e.chargeRange) {
          e._st = 1; e._stT = 0.32; e.dir = pcx > ecx ? 1 : -1;
        }
      }
    } else if (bhv === 'swoop') {
      if (e._mode === 1) {          // diving at the snapshotted spot
        const dx = e._tx - ecx, dy = e._ty - ecy;
        const d = Math.hypot(dx, dy);
        e._stT -= dt;
        if (d < 12 || e._stT <= 0) e._mode = 2;
        else {
          e.x += dx / d * e.swoopSpeed * freezeMul * dt;
          e.y += dy / d * e.swoopSpeed * freezeMul * dt;
          e.dir = dx >= 0 ? 1 : -1;
        }
      } else if (e._mode === 2) {   // gliding back to the perch
        const dx = e.baseX - ecx, dy = e.baseY - ecy;
        const d = Math.hypot(dx, dy);
        if (d < 8) { e._mode = 0; e._cd = 1.0; }
        else {
          e.x += dx / d * e.swoopSpeed * 0.6 * freezeMul * dt;
          e.y += dy / d * e.swoopSpeed * 0.6 * freezeMul * dt;
          e.dir = dx >= 0 ? 1 : -1;
        }
      } else {                      // hovering at the perch
        e.x = e.baseX + Math.sin(e.t * 1.2) * 16 - e.w / 2;
        e.y = e.baseY + Math.sin(e.t * 1.9) * 9;
        e._cd = Math.max(0, (e._cd || 0) - dt);
        if (!e._cd && Math.hypot(pcx - ecx, pcy - ecy) < e.swoopRange) {
          e._mode = 1; e._tx = pcx; e._ty = pcy; e._stT = 1.0;
        }
      }
    } else if (bhv === 'float') {
      // Slow homing drift while the player is near; otherwise drift home.
      const near = Math.hypot(pcx - ecx, pcy - ecy) < 340;
      const tx = near ? pcx : e.baseX, ty = near ? pcy : e.baseY;
      const dx = tx - ecx, dy = ty - ecy;
      const d = Math.hypot(dx, dy) || 1;
      const sp = Math.min(e.floatSpeed, d * 2) * freezeMul;
      e.x += dx / d * sp * dt;
      e.y += dy / d * sp * dt + Math.sin(e.t * 2.2) * 12 * freezeMul * dt;
      e.dir = dx >= 0 ? 1 : -1;
    } else if (bhv === 'orbit') {
      // The anchor itself stalks the player slowly, so orbiters roam too.
      const dax = pcx - e.baseX, day = pcy - e.baseY;
      const da = Math.hypot(dax, day);
      if (da > 1 && da < 320) {
        e.baseX += dax / da * 28 * freezeMul * dt;
        e.baseY += day / da * 28 * freezeMul * dt;
      }
      const a = e.t * e.orbitSpd + (e.phase || 0);
      e.x = e.baseX + Math.cos(a) * e.orbitR * freezeMul - e.w / 2;
      e.y = e.baseY + Math.sin(a) * e.orbitR * 0.7 * freezeMul - e.h / 2;
      e.dir = -Math.sin(a) >= 0 ? 1 : -1;
    } else if (bhv === 'drop') {
      if (e._mode === 1) {          // falling
        e.vy += 2300 * dt;
        e.y += e.vy * freezeMul * dt;
        for (const pl of platforms) {
          if (pl._crumbleState === 2) continue;
          if (e.x + e.w > pl.x && e.x < pl.x + pl.w &&
              e.y + e.h >= pl.y && e.y + e.h <= pl.y + pl.h + 18) {
            e.alive = false; // shatters on impact
            addHitParticles(ecx, e.y + e.h, e.color, 10);
            break;
          }
        }
        if (e.y > 600) e.alive = false;
      } else {                      // hanging, waiting for the player below
        e.y = e.baseY + Math.sin(e.t * 1.4) * 2;
        if (Math.abs(pcx - ecx) < 30 && pcy > e.y + e.h) { e._mode = 1; e.vy = 60; }
      }
    } else if (bhv === 'spider') {
      if (e._mode === 1) {          // dropping down the thread
        e.y += e.dropSpeed * freezeMul * dt;
        if (e.y >= e.dropY) { e.y = e.dropY; e._mode = 2; e._stT = 0.65; }
      } else if (e._mode === 2) {   // lingering low
        e._stT -= dt;
        if (e._stT <= 0) e._mode = 3;
      } else if (e._mode === 3) {   // climbing back up
        e.y -= 120 * freezeMul * dt;
        if (e.y <= e.anchorY) { e.y = e.anchorY; e._mode = 0; e._cd = 0.8; }
      } else {                      // waiting at the anchor
        e.y = e.anchorY + Math.sin(e.t * 1.6) * 4;
        e._cd = Math.max(0, (e._cd || 0) - dt);
        if (!e._cd && Math.abs(pcx - ecx) < 64 && pcy > e.y) e._mode = 1;
      }
    } else if (bhv === 'shoot') {
      e.dir = pcx >= ecx ? 1 : -1;  // track the player
      if (e._cd === undefined) e._cd = e.fireEvery * 0.5;
      e._cd = Math.max(0, e._cd - dt);
      if (e._cd <= 0 && Math.abs(pcx - ecx) < e.range && Math.abs(pcy - ecy) < 90) {
        enemyShots.push({
          x: ecx + e.dir * (e.w / 2 + 6), y: e.y + 6,
          vx: e.dir * 330, dmg: e.shotDmg, life: 2.2,
        });
        e._cd = e.fireEvery;
      }
    }

    // Boss special attack system: per-species cooldown + rage at 50% HP
    if (e.boss) {
      if (!e._rage && e.hp > 0 && e.hp <= e.maxHp * 0.5) {
        e._rage = true;
        e.speed = Math.round((e.speed || 60) * 1.4);
        if (e.leapEvery) e.leapEvery = Math.max(0.9, e.leapEvery * 0.7);
        e.swoopSpeed = Math.round((e.swoopSpeed || 300) * 1.3);
        addExplosion(ecx, ecy, e.color);
        addExplosion(ecx, ecy - 24, '#ff4500');
        // slime split: spawn 2 mini-slimes on first rage entry (one-shot)
        if (e.species === 'slime' && !e._split) {
          e._split = true;
          spawnBossMinion(e);
          spawnBossMinion(e);
        }
      }
      if (e._atkFlash > 0) e._atkFlash -= dt;
      e._specialCD -= dt;
      if (e._specialCD <= 0) {
        triggerBossSpecial(e, pcx, pcy);
        e._specialCD = e._baseCD * (e._rage ? 0.65 : 1.0);
      }
      e._minionCD = Math.max(0, (e._minionCD !== undefined ? e._minionCD : 14.0) - dt);
      if (e._minionCD <= 0) {
        spawnBossMinion(e);
        e._minionCD = e._rage ? 10.0 : 14.0;
      }
      if (e._landShockT > 0) e._landShockT = Math.max(0, e._landShockT - dt);

      // ── Signature mechanics ──────────────────────────────────────────────
      const floorY = e.baseY !== undefined ? e.baseY + e.h : ecy + e.h * 0.5;
      if (e.species === 'crawler') {
        // burrow: telegraph → underground → emerge at player's last known x
        if (e._burrowState === 1) {
          e._burrowT = Math.max(0, e._burrowT - dt);
          if (e._burrowT <= 0) { e._burrowState = 2; e._burrowT = 0.55; e._burrowed = true; e.x = Math.max(e.patrolMin, Math.min(e.patrolMax, e._burrowTargetX - e.w / 2)); }
        } else if (e._burrowState === 2) {
          e._burrowT = Math.max(0, e._burrowT - dt);
          if (e._burrowT <= 0) { e._burrowState = 0; e._burrowed = false; addHitParticles(ecx, floorY, '#7f8c8d', 12); e._sigCD = 9.0; }
        } else {
          e._sigCD = Math.max(0, (e._sigCD || 7.0) - dt);
          if (e._sigCD <= 0) {
            e._burrowState = 1; e._burrowT = 0.45; e._burrowTargetX = pcx;
            sigZones.push({ kind: 'dust', x: pcx - 18, y: floorY - 24, w: 36, h: 24, life: 1.5, warn: 0.45 });
          }
        }
      } else if (e.species === 'slider') {
        // iceTrail: deposit trail zones while sliding
        if (e._sliding) {
          e._iceTrailT = (e._iceTrailT || 0) + dt;
          if (e._iceTrailT >= 0.08) {
            e._iceTrailT = 0;
            sigZones.push({ kind: 'ice', x: e.x + 4, y: floorY - 10, w: e.w - 8, h: 12, life: 2.5 });
          }
        }
      } else if (e.species === 'scorpion') {
        // poisonCloud: drop 1-2 zones on floor
        e._sigCD = Math.max(0, (e._sigCD || 6.0) - dt);
        if (e._sigCD <= 0) {
          const n = 1 + (Math.random() > 0.5 ? 1 : 0);
          for (let k = 0; k < n; k++) {
            const cx = e.patrolMin + Math.random() * (e.patrolMax - e.patrolMin);
            sigZones.push({ kind: 'poison', x: cx - 30, y: floorY - 40, w: 60, h: 44, life: 4.5, warn: 0.35, dmg: Math.round(e.dmg * 0.5) });
          }
          e._sigCD = 8.0;
        }
      } else if (e.species === 'lavablob') {
        // firePatch: mark 2-3 floor spots, then ignite
        e._sigCD = Math.max(0, (e._sigCD || 5.0) - dt);
        if (e._sigCD <= 0) {
          const n = 2 + (Math.random() > 0.5 ? 1 : 0);
          const span = e.patrolMax - e.patrolMin;
          for (let k = 0; k < n; k++) {
            const cx = e.patrolMin + (k + 1) * span / (n + 1) + (Math.random() - 0.5) * 80;
            sigZones.push({ kind: 'fire', x: cx - 28, y: floorY - 14, w: 56, h: 14, life: 4.5, warn: 0.55, dmg: Math.round(e.dmg * 0.7) });
          }
          e._sigCD = 7.0;
        }
      } else if (e.species === 'bird') {
        // windGust: telegraph lean, then push player
        if (e._windTelegraph > 0) {
          e._windTelegraph = Math.max(0, e._windTelegraph - dt);
          if (e._windTelegraph <= 0) {
            player.windPushT = 1.1;
            player.windPushDir = pcx < ecx ? -1 : 1;
            e._sigCD = 8.0;
          }
        } else {
          e._sigCD = Math.max(0, (e._sigCD || 5.5) - dt);
          if (e._sigCD <= 0) e._windTelegraph = 0.45;
        }
      } else if (e.species === 'shroom') {
        // sporeDaze: telegraph cloud, then daze on burst
        e._sigCD = Math.max(0, (e._sigCD || 6.5) - dt);
        if (e._sigCD <= 0) {
          const r = 58;
          sigZones.push({ kind: 'spore', x: ecx - r, y: e.y - 4, w: r * 2, h: e.h + 20, life: 1.4, warn: 0.45, dmg: 0, burstDone: false });
          e._sigCD = 10.0;
        }
      } else if (e.species === 'drone') {
        // shield: absorbs all damage for up to 5.5s, then cooldown
        if (e._shieldT > 0) {
          e._shieldT = Math.max(0, e._shieldT - dt);
          if (e._shieldT <= 0) { e.shieldHp = 0; e._shieldCD = 9.0; }
        } else {
          e._shieldCD = Math.max(0, (e._shieldCD || 0) - dt);
          e._sigCD = Math.max(0, (e._sigCD || 5.0) - dt);
          if (e._sigCD <= 0 && e._shieldCD <= 0) {
            e.shieldHp = Math.max(20, Math.round(e.maxHp * 0.35));
            e._shieldT = 5.5;
            e._sigCD = 12.0;
          }
        }
      } else if (e.species === 'golem') {
        // crystalFall: shadow markers then falling crystals
        e._sigCD = Math.max(0, (e._sigCD || 7.0) - dt);
        if (e._sigCD <= 0) {
          const n = 2 + Math.floor(Math.random() * 3);
          const span = e.patrolMax - e.patrolMin;
          const arenaTop = e.baseY !== undefined ? e.baseY - 160 : floorY - 160;
          for (let k = 0; k < n; k++) {
            const cx = e.patrolMin + (k + 1) * span / (n + 1) + (Math.random() - 0.5) * 60;
            sigZones.push({ kind: 'crystal', x: cx - 14, y: floorY - 10, w: 28, h: 10, life: 3.5, warn: 0.6, floorY, spawnY: arenaTop, dmg: Math.round(e.dmg * 0.9), falling: false, vy: 0 });
          }
          e._sigCD = 9.0;
        }
      } else if (e.species === 'knight') {
        // parry: raise shield for ≤1.2s, then cooldown
        if (e.parryT > 0) {
          e.parryT = Math.max(0, e.parryT - dt);
          if (e.parryT <= 0) e._parryCD = 8.0;
        } else {
          e._parryCD = Math.max(0, (e._parryCD || 0) - dt);
          e._sigCD = Math.max(0, (e._sigCD || 5.0) - dt);
          if (e._sigCD <= 0 && e._parryCD <= 0) {
            e.parryT = 0.85 + Math.random() * 0.3;
            e._sigCD = 8.0;
          }
        }
      }
    }

    if (player.dead) continue;
    if (!e._burrowed && rectsOverlap(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h)) {
      const prevBottom = player._prevY + player.h;
      const stomping = player.vy > 0 && prevBottom <= e.y + 12;
      if (stomping) {
        let stompDmg = STOMP_DAMAGE;
        if (e.boss) {
          if (e._rage) {
            stompDmg = 0;
            hurtPlayer(Math.round(e.dmg * 0.55), e.x + e.w / 2); // thorns: enraged boss punishes stompers
          } else {
            stompDmg = 1; // bosses resist stomps even in normal phase
          }
        }
        damageEnemy(e, stompDmg, player.x < e.x ? 1 : -1, 240, null, null);
        player.vy = -STOMP_BOUNCE;
        player.y = e.y - player.h;
        player._prevY = player.y;
        player.jumpsLeft = Math.max(player.jumpsLeft, 1); // regain a hop after a stomp
      } else {
        // If the player is mid-attack and facing this enemy, the weapon connects
        // and the contact deals no damage — so you can fight foes up close.
        const eCx = e.x + e.w / 2;
        const facingEnemy = player.facing > 0 ? eCx >= player.x : eCx <= player.x + player.w;
        const guarding = (player.attackCD > 0 || player.swingT > 0) && facingEnemy;
        if (!guarding) hurtPlayer(e.dmg || CONTACT_DAMAGE[e.type] || 8, eCx);
      }
    }
  }

  // Signature zone updates: warn→active, per-kind effects, expiry.
  for (let i = sigZones.length - 1; i >= 0; i--) {
    const z = sigZones[i];
    if (z.warn > 0) {
      z.warn -= dt;
      z.life -= dt;
      if (z.warn <= 0 && z.kind === 'spore' && !z.burstDone) {
        z.burstDone = true;
        if (!player.dead && rectsOverlap(player.x, player.y, player.w, player.h, z.x, z.y, z.w, z.h)) {
          player.dazeT = Math.min(1.5, player.dazeT + 1.5);
        }
      }
      if (z.warn <= 0 && z.kind === 'crystal' && !z.falling) {
        z.falling = true;
        z.y = z.spawnY;
        z.w = 18; z.h = 28;
        z.vy = 0;
      }
      if (z.life <= 0) sigZones.splice(i, 1);
      continue;
    }
    if (z.kind === 'crystal' && z.falling) {
      z.vy = (z.vy || 0) + 900 * dt;
      z.y += z.vy * dt;
      if (!player.dead && rectsOverlap(player.x, player.y, player.w, player.h, z.x, z.y, z.w, z.h)) {
        hurtPlayer(z.dmg, z.x + z.w / 2);
        addHitParticles(z.x + z.w / 2, z.y + z.h, '#48dbfb', 7);
        sigZones.splice(i, 1);
        continue;
      }
      if (z.y > z.floorY || z.y > 600) { sigZones.splice(i, 1); continue; }
      z.life -= dt;
    } else if (z.kind === 'ice') {
      z.life -= dt;
      if (!player.dead && rectsOverlap(player.x, player.y, player.w, player.h, z.x, z.y, z.w, z.h)) {
        player.iceSlipT = Math.min(2.5, Math.max(player.iceSlipT, 2.0));
      }
    } else if (z.kind === 'poison') {
      z.life -= dt;
      if (!player.dead && rectsOverlap(player.x, player.y, player.w, player.h, z.x, z.y, z.w, z.h)) {
        hurtPlayer(z.dmg, z.x + z.w / 2);
      }
    } else if (z.kind === 'fire') {
      z.life -= dt;
      if (!player.dead && rectsOverlap(player.x, player.y, player.w, player.h, z.x, z.y, z.w, z.h)) {
        hurtPlayer(z.dmg, z.x + z.w / 2);
      }
    } else {
      z.life -= dt; // dust, spore (post-burst)
    }
    if (z.life <= 0) sigZones.splice(i, 1);
  }

  // Enemy shots: turret bolts (straight) + boss specials (may arc with vy/grav).
  for (let i = enemyShots.length - 1; i >= 0; i--) {
    const s = enemyShots[i];
    s.x += s.vx * dt;
    s.y += (s.vy || 0) * dt;
    s.vy = (s.vy || 0) + (s.grav || 0) * dt;
    s.life -= dt;
    let dead = s.life <= 0;
    if (!dead) {
      for (const pl of platforms) {
        if (pl._crumbleState === 2) continue;
        if (pl.type === 'ground') {
          if (s.x > pl.x && s.x < pl.x + pl.w && s.y > pl.y) { dead = true; break; }
        } else if (s.x > pl.x && s.x < pl.x + pl.w && s.y > pl.y && s.y < pl.y + pl.h) {
          dead = true; break;
        }
      }
    }
    if (!dead && !player.dead) {
      // Boss specials use circular hit detection scaled to the projectile radius;
      // regular turret bolts keep the original simple box check.
      const sr = s.r || 3;
      const pCx = player.x + player.w / 2, pCy = player.y + player.h / 2;
      const hit = s.boss
        ? Math.hypot(s.x - pCx, s.y - pCy) < sr + player.w * 0.35
        : s.x > player.x && s.x < player.x + player.w && s.y > player.y && s.y < player.y + player.h;
      if (hit) {
        hurtPlayer(s.dmg, s.x - s.vx * 0.1);
        addHitParticles(s.x, s.y, s.color || '#7fdfff', s.boss ? 8 : 5);
        dead = true;
      }
    }
    if (dead) enemyShots.splice(i, 1);
  }

  return { playerHit };
}

// ─── ENEMY / PROJECTILE RENDERING ──────────────────────────────────────────

export function drawProjectiles(ctx, camX, W) {
  for (const pr of projectiles) {
    if (pr.x < camX - 20 || pr.x > camX + W + 20) continue;
    // trail
    ctx.strokeStyle = pr.color;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = pr.r;
    ctx.beginPath();
    ctx.moveTo(pr.x, pr.y);
    ctx.lineTo(pr.x - pr.vx * 0.02, pr.y - pr.vy * 0.02);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // glow + core
    const g = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, pr.r * 3);
    g.addColorStop(0, pr.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 0.6, 0, Math.PI * 2); ctx.fill();
  }
}

export function drawEnemies(ctx, camX, W, t, player, dt = 0) {
  // Signature zones (drawn below enemies)
  for (const z of sigZones) {
    const sx = z.x - camX;
    if (sx + z.w < -40 || sx > W + 40) continue;
    const alpha = z.warn > 0 ? 0.35 + Math.sin(t * 12) * 0.2 : 0.72;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (z.kind === 'ice') {
      ctx.fillStyle = '#aee3ff';
      ctx.fillRect(sx, z.y, z.w, z.h);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(sx + 2, z.y + 1, z.w - 4, 3);
    } else if (z.kind === 'poison') {
      const g = ctx.createRadialGradient(sx + z.w / 2, z.y + z.h / 2, 4, sx + z.w / 2, z.y + z.h / 2, z.w / 2);
      g.addColorStop(0, 'rgba(180,110,20,0.85)'); g.addColorStop(1, 'rgba(100,60,0,0)');
      ctx.fillStyle = g; ctx.fillRect(sx, z.y, z.w, z.h);
    } else if (z.kind === 'fire') {
      const g2 = ctx.createRadialGradient(sx + z.w / 2, z.y + z.h, 2, sx + z.w / 2, z.y + z.h / 2, z.w / 2);
      g2.addColorStop(0, z.warn > 0 ? 'rgba(255,200,50,0.7)' : 'rgba(255,100,0,0.9)');
      g2.addColorStop(1, 'rgba(180,40,0,0)');
      ctx.fillStyle = g2; ctx.fillRect(sx - 4, z.y - 6, z.w + 8, z.h + 8);
    } else if (z.kind === 'dust') {
      ctx.fillStyle = 'rgba(160,150,130,0.6)';
      ctx.fillRect(sx, z.y, z.w, z.h);
      // pulsing X marker
      ctx.strokeStyle = 'rgba(255,220,120,0.85)'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(sx + 4, z.y + 4); ctx.lineTo(sx + z.w - 4, z.y + z.h - 4);
      ctx.moveTo(sx + z.w - 4, z.y + 4); ctx.lineTo(sx + 4, z.y + z.h - 4);
      ctx.stroke();
    } else if (z.kind === 'spore') {
      const g3 = ctx.createRadialGradient(sx + z.w / 2, z.y + z.h / 2, 8, sx + z.w / 2, z.y + z.h / 2, z.w / 2);
      g3.addColorStop(0, 'rgba(200,100,80,0.55)'); g3.addColorStop(1, 'rgba(100,40,30,0)');
      ctx.fillStyle = g3; ctx.fillRect(sx, z.y, z.w, z.h);
    } else if (z.kind === 'crystal') {
      if (z.falling) {
        // falling crystal shard
        const g4 = ctx.createLinearGradient(sx, z.y, sx, z.y + z.h);
        g4.addColorStop(0, '#bff4ff'); g4.addColorStop(1, '#2e9cb8');
        ctx.fillStyle = g4;
        ctx.beginPath();
        ctx.moveTo(sx + z.w / 2, z.y); ctx.lineTo(sx + z.w, z.y + z.h * 0.45);
        ctx.lineTo(sx + z.w * 0.6, z.y + z.h); ctx.lineTo(sx + z.w * 0.4, z.y + z.h);
        ctx.lineTo(sx, z.y + z.h * 0.45); ctx.closePath(); ctx.fill();
      } else {
        // shadow marker on floor
        ctx.fillStyle = 'rgba(72,219,251,0.45)';
        ctx.beginPath(); ctx.ellipse(sx + z.w / 2, z.y + z.h / 2, z.w / 2, z.h / 2, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }
  for (const e of enemies) {
    if (!e.alive) {
      if (e._deathT <= 0) { continue; }
      e._deathT -= dt;
      if (e._deathT > 0 && e.x + e.w >= camX - 40 && e.x <= camX + W + 80) {
        const _cx = e.x + e.w / 2;
        const dur = e.boss ? 0.4 : 0.35;
        const frac = Math.max(0, e._deathT / dur);
        ctx.save();
        ctx.translate(_cx, e.y + e.h / 2);
        ctx.globalAlpha = frac;
        ctx.scale(1.2 - frac * 0.2, frac * 0.9 + 0.1);
        ctx.fillStyle = e.color || '#aaa';
        ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h);
        ctx.globalAlpha = 1;
        ctx.restore();
      }
      continue;
    }
    if (e.x + e.w < camX - 40 || e.x > camX + W + 80) continue;

    const cx = e.x + e.w / 2;
    ctx.save();
    ctx.translate(cx, e.y);

    const sd = SPECIES_DRAW[e.species];
    if (sd) {
      if (e.boss) { // menacing aura — expands and turns orange when enraged
        const raging = !!e._rage;
        const ar = Math.max(e.w, e.h) * (raging ? 0.95 : 0.78);
        const g = ctx.createRadialGradient(0, e.h / 2, ar * 0.3, 0, e.h / 2, ar);
        g.addColorStop(0, raging ? 'rgba(255,90,0,0.22)' : 'rgba(255,40,40,0.16)');
        g.addColorStop(1, 'rgba(255,40,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, e.h / 2, ar, 0, Math.PI * 2); ctx.fill();
        if (raging) { // pulsing ring
          const pls = 0.5 + Math.sin(e.t * 8) * 0.5;
          ctx.strokeStyle = `rgba(255,110,0,${pls * 0.65})`;
          ctx.lineWidth = 3.5;
          ctx.beginPath(); ctx.arc(0, e.h / 2, ar * 0.82, 0, Math.PI * 2); ctx.stroke();
          ctx.lineWidth = 1;
        }
      }
      ctx.save();
      if (e.dir < 0) ctx.scale(-1, 1); // species art faces +x; flip to face travel
      if (e.bossScale > 1) {
        // draw the species at its native proportions, scaled up to boss size
        ctx.scale(e.bossScale, e.bossScale);
        sd(ctx, { ...e, w: e.w / e.bossScale, h: e.h / e.bossScale }, t, player);
      } else {
        sd(ctx, e, t, player);
      }
      ctx.restore();
    } else if (e.type === 'flyer') drawFlyer(ctx, e);
    else if (e.type === 'jumper') drawJumper(ctx, e);
    else if (e.type === 'brute') drawBrute(ctx, e);
    else drawWalker(ctx, e, t);

    // hit scale-pulse then white flash
    if (e.hitFlash > 0) {
      const pulseFrac = e.hitFlash / 0.13;
      ctx.save();
      const ps = 1 + pulseFrac * 0.08;
      ctx.scale(ps, ps);
      ctx.globalAlpha = pulseFrac * 0.8;
      ctx.fillStyle = '#fff';
      ctx.fillRect(-e.w / 2, 0, e.w, e.h);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    // special attack charge flash (yellow burst when a boss special fires)
    if (e._atkFlash > 0) {
      ctx.globalAlpha = (e._atkFlash / 0.45) * 0.72;
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(-e.w / 2, 0, e.w, e.h);
      ctx.globalAlpha = 1;
    }
    // Time Stop frozen tint — blue-white crystalline overlay
    if ((e._frozenT || 0) > 0) {
      ctx.globalAlpha = 0.42 + Math.sin(t * 7) * 0.1;
      ctx.fillStyle = '#80d4ff';
      ctx.fillRect(-e.w / 2, 0, e.w, e.h);
      ctx.globalAlpha = 1;
    }

    // ── Boss close-range attack animations ──────────────────────────────────
    if (e.boss) {
      // Dash trail: ghost copies fade behind during a slide attack
      if (e._sliding && e._slideDir !== undefined) {
        const alpha = Math.min(1, (e._slideT || 0) * 3.5) * 0.5;
        for (let ti = 1; ti <= 3; ti++) {
          const ox = -e._slideDir * ti * e.w * 0.3;
          ctx.globalAlpha = alpha * (1 - ti * 0.28);
          ctx.fillStyle = e.color || '#fff';
          ctx.fillRect(-e.w / 2 + ox, 0, e.w, e.h);
        }
        ctx.globalAlpha = 1;
        // Directional speed glow in the dash direction
        const gxA = e._slideDir > 0 ? -e.w * 0.5 : e.w * 0.5;
        const gxB = e._slideDir > 0 ? e.w * 1.2 : -e.w * 1.2;
        const dashGlow = ctx.createLinearGradient(gxA, 0, gxB, 0);
        dashGlow.addColorStop(0, 'rgba(255,255,255,0)');
        dashGlow.addColorStop(1, `${e.color || '#ffffff'}88`);
        ctx.globalAlpha = alpha * 0.65;
        ctx.fillStyle = dashGlow;
        ctx.fillRect(-e.w, 0, e.w * 2.5, e.h);
        ctx.globalAlpha = 1;
      }
      // Leap speed lines: directional streaks during an aerial lunge
      if (e.vy < -60 && e._vx) {
        const lFade = Math.min(1, Math.abs(e.vy) / 360) * 0.55;
        ctx.save();
        ctx.strokeStyle = e.color || '#fff';
        ctx.lineWidth = 2;
        for (let li = 0; li < 5; li++) {
          const lx = ((li + 0.5) / 5 - 0.5) * e.w * 0.65;
          const ly = e.h * (0.2 + (li % 3) * 0.25);
          ctx.globalAlpha = lFade * (1 - li * 0.15);
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx - e._vx * 0.045, ly - e.vy * 0.022);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }
      // Landing shockwave: expanding ellipse ring on ground impact
      if (e._landShockT > 0) {
        const frac = e._landShockT / 0.45;
        const shockR = (1 - frac) * e.w * 2.2;
        ctx.save();
        ctx.globalAlpha = frac * 0.8;
        ctx.strokeStyle = e.color || '#fff';
        ctx.lineWidth = 4 * frac;
        ctx.beginPath();
        ctx.ellipse(0, e.h, shockR, shockR * 0.28, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

    ctx.restore();

    // Signature visuals (shield, parry, wind telegraph) — rendered before HP bar so HP bar is topmost
    if (e.boss) {
      const bx = e.x - camX;
      const bcx = bx + e.w / 2;
      if (e.shieldHp > 0) {
        // Drone energy shield ring
        const sr = Math.max(e.w, e.h) * 0.68;
        const sp = 0.45 + Math.sin(t * 6) * 0.25;
        ctx.save();
        ctx.strokeStyle = `rgba(0,210,211,${sp})`;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(bcx, e.y + e.h / 2, sr, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(180,255,255,${sp * 0.55})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(bcx, e.y + e.h / 2, sr * 0.82, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      if (e.parryT > 0) {
        // Knight raised-shield pose overlay
        ctx.save();
        const pAlpha = 0.6 + Math.sin(t * 8) * 0.2;
        ctx.globalAlpha = pAlpha;
        ctx.fillStyle = '#8854d0';
        ctx.fillRect(bx + e.w * 0.38, e.y + e.h * 0.28, e.w * 0.14, e.h * 0.5);
        ctx.fillStyle = '#c8d6e5';
        ctx.fillRect(bx + e.w * 0.44, e.y + e.h * 0.22, e.w * 0.18, e.h * 0.44);
        ctx.restore();
      }
      if (e._windTelegraph > 0) {
        // Bird lean telegraph: wavy lines radiating outward
        ctx.save();
        ctx.globalAlpha = (1 - e._windTelegraph / 0.45) * 0.75;
        ctx.strokeStyle = '#c0d8ff'; ctx.lineWidth = 2;
        for (let wi = 0; wi < 4; wi++) {
          const wy = e.y + e.h * (0.3 + wi * 0.15);
          ctx.beginPath();
          ctx.moveTo(bcx - e.w * 0.6, wy);
          ctx.lineTo(bcx - e.w, wy + Math.sin(t * 12 + wi) * 4);
          ctx.moveTo(bcx + e.w * 0.6, wy);
          ctx.lineTo(bcx + e.w, wy + Math.sin(t * 12 + wi) * 4);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // HP bar / pips (rendered last — on top of all other visuals)
    if (e.boss) {
      // chunky boss HP bar — turns orange in rage, shows 50% rage threshold marker
      const bw = e.w + 14;
      const bx = e.x + e.w / 2 - bw / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx - 2, e.y - 20, bw + 4, 12);
      ctx.fillStyle = e._rage ? '#ff6b35' : '#e74c3c';
      ctx.fillRect(bx, e.y - 18, bw * Math.max(0, e.hp / e.maxHp), 8);
      // rage threshold marker at 50%
      ctx.fillStyle = 'rgba(255,220,50,0.85)';
      ctx.fillRect(bx + bw * 0.5 - 1, e.y - 20, 2, 12);
      if (e._rage) {
        ctx.fillStyle = '#ff8c42';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ENRAGED', e.x + e.w / 2, e.y - 24);
        ctx.textAlign = 'left';
      }
    } else if (e.maxHp > 1) {
      // HP pips above tougher enemies
      const pw = e.w / e.maxHp;
      for (let i = 0; i < e.maxHp; i++) {
        ctx.fillStyle = i < e.hp ? '#e74c3c' : 'rgba(255,255,255,0.18)';
        ctx.fillRect(e.x + i * pw + 1, e.y - 9, pw - 2, 4);
      }
    }
  }

  // Enemy shots: boss specials and turret bolts
  for (const s of enemyShots) {
    if (s.x < camX - 30 || s.x > camX + W + 30) continue;
    if (s.boss) {
      const r = s.r || 7;
      const speed = Math.hypot(s.vx || 0, s.vy || 0);
      const ang = speed > 5 ? Math.atan2(s.vy, s.vx) : 0;
      const sp = s.species;
      ctx.save();
      ctx.translate(s.x, s.y);

      if (sp === 'slider' || sp === 'golem') {
        // ── Ice/Crystal: sharp elongated diamond rotated to velocity ──
        ctx.rotate(ang);
        const len = r * 2.2, half = r * 0.65;
        const cg = ctx.createLinearGradient(-len, 0, len, 0);
        cg.addColorStop(0, 'rgba(255,255,255,0.9)');
        cg.addColorStop(0.5, s.color || '#48dbfb');
        cg.addColorStop(1, 'rgba(255,255,255,0.9)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.moveTo(-len, 0); ctx.lineTo(0, -half);
        ctx.lineTo(len, 0); ctx.lineTo(0, half);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.beginPath();
        ctx.moveTo(-len * 0.5, 0); ctx.lineTo(0, -half * 0.35);
        ctx.lineTo(len * 0.5, 0); ctx.lineTo(0, half * 0.35);
        ctx.closePath(); ctx.fill();

      } else if (sp === 'drone') {
        // ── Space: thin laser beam with glowing core ──
        ctx.rotate(ang);
        const bLen = Math.max(r * 2.2, 26);
        const bg = ctx.createLinearGradient(-bLen, 0, bLen, 0);
        bg.addColorStop(0, 'rgba(0,210,211,0)');
        bg.addColorStop(0.5, '#bff4ff');
        bg.addColorStop(1, 'rgba(0,210,211,0)');
        ctx.fillStyle = bg;
        ctx.fillRect(-bLen, -r * 0.38, bLen * 2, r * 0.76);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-bLen * 0.35, -r * 0.14, bLen * 0.7, r * 0.28);
        // outer glow halo
        const hg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.4);
        hg.addColorStop(0, `${s.color || '#00d2d3'}55`);
        hg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(0, 0, r * 1.4, 0, Math.PI * 2); ctx.fill();

      } else if (sp === 'bird') {
        // ── Sky: lightning bolt — zigzag shape with bright glow ──
        const step = r * 0.9;
        ctx.rotate(ang);
        ctx.strokeStyle = s.color || '#fffde7';
        ctx.lineWidth = r * 0.55;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 1.8, -step * 0.35);
        ctx.lineTo(-step * 0.3, -step * 0.35);
        ctx.lineTo(-step * 0.7, step * 0.35);
        ctx.lineTo(r * 1.8, step * 0.35);
        ctx.stroke();
        ctx.lineWidth = r * 0.2;
        ctx.strokeStyle = '#fff';
        ctx.stroke(); // bright inner core
        const lg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.6);
        lg.addColorStop(0, `${s.color || '#fffde7'}55`);
        lg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = lg;
        ctx.beginPath(); ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2); ctx.fill();

      } else if (sp === 'knight') {
        // ── Dark Fortress: curved shadow blade ──
        ctx.rotate(ang);
        ctx.strokeStyle = s.color || '#8854d0';
        ctx.lineWidth = r * 0.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 1.6, -r * 0.5);
        ctx.quadraticCurveTo(0, r * 0.7, r * 1.6, -r * 0.5);
        ctx.stroke();
        ctx.lineWidth = r * 0.2;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.stroke(); // highlight edge
        const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.8);
        sg.addColorStop(0, `${s.color || '#8854d0'}55`);
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2); ctx.fill();

      } else if (sp === 'crawler') {
        // ── Cave: triangular stalactite OR chunky rock based on direction ──
        const isVertical = Math.abs(s.vy || 0) > Math.abs(s.vx || 0) * 1.5;
        if (isVertical) {
          // Stalactite: downward triangle pointing in travel direction
          const falling = (s.vy || 0) >= 0;
          ctx.fillStyle = s.color || '#9b9ba8';
          ctx.beginPath();
          ctx.moveTo(-r * 0.75, falling ? -r * 1.4 : r * 1.4);
          ctx.lineTo( r * 0.75, falling ? -r * 1.4 : r * 1.4);
          ctx.lineTo(0, falling ? r : -r);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.28)';
          ctx.beginPath();
          ctx.moveTo(-r * 0.3, falling ? -r * 1.2 : r * 1.2);
          ctx.lineTo(r * 0.15, falling ? -r * 1.2 : r * 1.2);
          ctx.lineTo(-r * 0.05, falling ? r * 0.3 : -r * 0.3);
          ctx.closePath(); ctx.fill();
        } else {
          // Boulder / shockwave: wide squashed ellipse with cracks
          ctx.rotate(ang);
          ctx.fillStyle = s.color || '#95a5a6';
          ctx.beginPath(); ctx.ellipse(0, 0, r * 1.85, r * 0.72, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-r * 0.6, -r * 0.25); ctx.lineTo(r * 0.1, r * 0.28);
          ctx.moveTo(r * 0.35, -r * 0.35); ctx.lineTo(r * 0.6, r * 0.18);
          ctx.stroke();
          const rg = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2);
          rg.addColorStop(0, `${s.color || '#95a5a6'}44`);
          rg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = rg; ctx.beginPath(); ctx.ellipse(0, 0, r * 2, r * 2, 0, 0, Math.PI * 2); ctx.fill();
        }

      } else if (sp === 'lavablob') {
        // ── Lava: dripping molten teardrop ──
        ctx.fillStyle = s.color || '#ff793f';
        ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-r * 0.42, r * 0.55);
        ctx.quadraticCurveTo(0, r * 1.85, r * 0.42, r * 0.55);
        ctx.fill();
        const mg = ctx.createRadialGradient(-r * 0.22, -r * 0.22, 0, 0, 0, r * 1.3);
        mg.addColorStop(0, '#fff59d');
        mg.addColorStop(0.45, s.color || '#ff793f');
        mg.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2); ctx.fill();

      } else if (sp === 'slime') {
        // ── Meadow: wobbly organic blob (thorns/pollen/roots) ──
        ctx.fillStyle = s.color || '#2ecc71';
        ctx.beginPath();
        const br = r * 1.05;
        ctx.moveTo(br, 0);
        ctx.bezierCurveTo(br, -br * 0.85, -br * 0.35, -br * 1.1, -br * 0.2, -br * 0.55);
        ctx.bezierCurveTo(0, -br * 0.15, -br * 0.85, br * 0.4, -br, 0);
        ctx.bezierCurveTo(-br, br * 0.7, br * 0.3, br * 1.1, br * 0.55, br * 0.5);
        ctx.bezierCurveTo(br * 0.92, 0, br, 0, br, 0);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.38)';
        ctx.beginPath(); ctx.arc(-r * 0.18, -r * 0.22, r * 0.34, 0, Math.PI * 2); ctx.fill();

      } else if (sp === 'shroom') {
        // ── Forest: soft spore with bumpy outline ──
        const fg = ctx.createRadialGradient(0, 0, r * 0.25, 0, 0, r * 1.65);
        fg.addColorStop(0, '#fff');
        fg.addColorStop(0.4, s.color || '#e17055');
        fg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0, 0, r * 1.65, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `${s.color || '#e17055'}cc`; ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let bi = 0; bi < 6; bi++) {
          const ba = (bi / 6) * Math.PI * 2;
          const bump = r * (bi % 2 === 0 ? 1.1 : 0.8);
          if (bi === 0) ctx.moveTo(Math.cos(ba) * bump, Math.sin(ba) * bump);
          else ctx.lineTo(Math.cos(ba) * bump, Math.sin(ba) * bump);
        }
        ctx.closePath(); ctx.stroke();

      } else if (sp === 'scorpion') {
        // ── Desert: venom drop — teardrop pointed in travel direction ──
        ctx.rotate(ang - Math.PI / 2);
        ctx.fillStyle = s.color || '#cc8e35';
        ctx.beginPath(); ctx.arc(0, -r * 0.38, r * 0.82, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, r * 0.22);
        ctx.quadraticCurveTo(0, r * 1.55, r * 0.5, r * 0.22);
        ctx.fill();
        const vg = ctx.createRadialGradient(0, -r * 0.25, 0, 0, r * 0.3, r * 1.2);
        vg.addColorStop(0, 'rgba(255,255,80,0.45)');
        vg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = vg; ctx.beginPath(); ctx.arc(0, 0, r * 1.2, 0, Math.PI * 2); ctx.fill();

      } else {
        // ── Default: glowing orb (fallback) ──
        const dg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.9);
        dg.addColorStop(0, '#ffffff');
        dg.addColorStop(0.3, s.color || '#ff4444');
        dg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(0, 0, r * 1.9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2); ctx.fill();
      }

      ctx.restore();
    } else {
      // turret bolt
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 9);
      g.addColorStop(0, '#bff4ff');
      g.addColorStop(0.4, '#46d5ff');
      g.addColorStop(1, 'rgba(70,213,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(s.x, s.y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(s.x - (s.vx > 0 ? 6 : 0), s.y - 1.5, 6, 3);
    }
  }
}

function eyes(ctx, w, y, dir, angry) {
  const ex = w * 0.18;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-ex, y, 4, 0, Math.PI * 2);
  ctx.arc(ex, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(-ex + dir * 1.5, y, 2, 0, Math.PI * 2);
  ctx.arc(ex + dir * 1.5, y, 2, 0, Math.PI * 2);
  ctx.fill();
  if (angry) {
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-ex - 4, y - 6); ctx.lineTo(-ex + 3, y - 3);
    ctx.moveTo(ex + 4, y - 6); ctx.lineTo(ex - 3, y - 3);
    ctx.stroke();
  }
}

function drawWalker(ctx, e, t) {
  const w = e.w, h = e.h;
  // shuffling feet
  const sh = Math.sin((t || 0) * 9 + e.x * 0.1) * 2;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-w * 0.32, h - 4 + sh, w * 0.26, 5);
  ctx.fillRect(w * 0.06, h - 4 - sh, w * 0.26, 5);
  // body
  ctx.fillStyle = e.color;
  roundRectE(ctx, -w / 2, 2, w, h - 4, 7);
  ctx.fill();
  // darker belly
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  roundRectE(ctx, -w / 2 + 3, h * 0.5, w - 6, h * 0.4, 5);
  ctx.fill();
  eyes(ctx, w, h * 0.36, e.dir, true);
  // frown
  ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, h * 0.66, 4, Math.PI + 0.3, -0.3); ctx.stroke();
}

function drawBrute(ctx, e) {
  const w = e.w, h = e.h;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-w * 0.34, h - 5, w * 0.3, 6);
  ctx.fillRect(w * 0.04, h - 5, w * 0.3, 6);
  // armored body
  ctx.fillStyle = e.color;
  roundRectE(ctx, -w / 2, 0, w, h - 3, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3;
  roundRectE(ctx, -w / 2 + 1.5, 1.5, w - 3, h - 6, 6); ctx.stroke();
  // helmet band
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(-w / 2, h * 0.22, w, 5);
  eyes(ctx, w, h * 0.42, e.dir, true);
}

function drawJumper(ctx, e) {
  const w = e.w, h = e.h;
  // spring coil
  ctx.strokeStyle = '#888'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) ctx.arc(0, h - 4 - i * 4, w * 0.28, 0, Math.PI);
  ctx.stroke();
  ctx.fillStyle = e.color;
  ctx.beginPath();
  ctx.arc(0, h * 0.42, w * 0.46, 0, Math.PI * 2);
  ctx.fill();
  eyes(ctx, w, h * 0.36, e.dir, false);
}

function drawFlyer(ctx, e) {
  const w = e.w, h = e.h;
  const flap = Math.sin(e.t * 14) * 0.5;
  // wings
  ctx.fillStyle = e.color;
  ctx.save(); ctx.translate(-w * 0.3, h * 0.4); ctx.rotate(-0.4 - flap);
  ctx.beginPath(); ctx.ellipse(-w * 0.25, 0, w * 0.4, h * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.translate(w * 0.3, h * 0.4); ctx.rotate(0.4 + flap);
  ctx.beginPath(); ctx.ellipse(w * 0.25, 0, w * 0.4, h * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // body
  ctx.fillStyle = '#2a2230';
  ctx.beginPath(); ctx.ellipse(0, h * 0.45, w * 0.3, h * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  // glowing eyes
  ctx.fillStyle = '#ff4040';
  ctx.beginPath();
  ctx.arc(-w * 0.12, h * 0.35, 2.5, 0, Math.PI * 2);
  ctx.arc(w * 0.12, h * 0.35, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

// ─── SPECIES ART ────────────────────────────────────────────────────────────
// Each species has bespoke art. Drawn in a ctx translated to the enemy's
// top-center and pre-flipped so +x is the direction the creature faces.

function drawSlime(ctx, e, t) {
  const w = e.w, h = e.h;
  const air = Math.abs(e.vy || 0) > 30;
  const sx = air ? 0.84 : 1 + Math.sin(t * 5 + e.phase) * 0.06;
  const sy = 2 - sx;
  ctx.fillStyle = '#58b94a';
  ctx.beginPath();
  ctx.ellipse(0, h - h * 0.5 * sy, w * 0.5 * sx, h * 0.5 * sy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath(); ctx.ellipse(-w * 0.15, h * 0.35, w * 0.13, h * 0.1, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#143318';
  ctx.beginPath();
  ctx.arc(w * 0.12, h * 0.5, 2.4, 0, Math.PI * 2);
  ctx.arc(-w * 0.08, h * 0.5, 2.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawBee(ctx, e, t, player) {
  const w = e.w, h = e.h;
  const chasing = player && Math.hypot(player.x + player.w / 2 - (e.x + e.w / 2), player.y + player.h / 2 - (e.y + e.h / 2)) < 300;
  const flap = Math.sin(e.t * (chasing ? 38 : 26)) * 0.6;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.save(); ctx.translate(-2, h * 0.25); ctx.rotate(-0.5 - flap);
  ctx.beginPath(); ctx.ellipse(0, -6, 5, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(4, h * 0.25); ctx.rotate(0.2 + flap);
  ctx.beginPath(); ctx.ellipse(0, -6, 5, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#f9ca24';
  ctx.beginPath(); ctx.ellipse(0, h * 0.55, w * 0.42, h * 0.36, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2d2d2d';
  ctx.fillRect(-w * 0.16, h * 0.28, 4, h * 0.54);
  ctx.fillRect(w * 0.02, h * 0.28, 4, h * 0.54);
  ctx.beginPath(); // stinger at the back
  ctx.moveTo(-w * 0.42, h * 0.55); ctx.lineTo(-w * 0.58, h * 0.55); ctx.lineTo(-w * 0.42, h * 0.45);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(w * 0.3, h * 0.42, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(w * 0.34, h * 0.42, 1.6, 0, Math.PI * 2); ctx.fill();
}

function drawCrawler(ctx, e, t) {
  const w = e.w, h = e.h;
  ctx.strokeStyle = '#444'; ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const lx = -w * 0.3 + i * w * 0.2;
    const wig = Math.sin(t * 12 + i) * 2;
    ctx.beginPath(); ctx.moveTo(lx, h - 6); ctx.lineTo(lx + wig, h); ctx.stroke();
  }
  ctx.fillStyle = '#7f8c8d';
  ctx.beginPath(); ctx.ellipse(0, h * 0.55, w * 0.5, h * 0.45, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; // shell segments
  for (let i = -1; i <= 1; i++) ctx.fillRect(i * w * 0.16 - 1.5, h * 0.14, 3, h * 0.4);
  ctx.fillStyle = '#ffeaa7';
  ctx.beginPath(); ctx.arc(w * 0.34, h * 0.5, 2.2, 0, Math.PI * 2); ctx.fill();
}

function drawBat(ctx, e, t) {
  const w = e.w, h = e.h;
  const diving = e._mode === 1;
  const flap = Math.sin(e.t * (diving ? 26 : 12)) * (diving ? 0.9 : 0.55);
  ctx.fillStyle = '#4a3f63';
  for (const s of [-1, 1]) { // membrane wings
    ctx.save(); ctx.translate(s * w * 0.12, h * 0.4); ctx.rotate(s * (0.25 + flap));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(s * w * 0.55, -h * 0.35);
    ctx.lineTo(s * w * 0.62, h * 0.15);
    ctx.lineTo(s * w * 0.3, h * 0.05);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#352c49';
  ctx.beginPath(); ctx.ellipse(0, h * 0.48, w * 0.2, h * 0.34, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); // ears
  ctx.moveTo(-w * 0.12, h * 0.2); ctx.lineTo(-w * 0.05, h * 0.02); ctx.lineTo(0, h * 0.2);
  ctx.moveTo(w * 0.12, h * 0.2); ctx.lineTo(w * 0.05, h * 0.02); ctx.lineTo(0, h * 0.2);
  ctx.fill();
  ctx.fillStyle = '#ff5e57';
  ctx.beginPath();
  ctx.arc(-w * 0.07, h * 0.4, 1.8, 0, Math.PI * 2);
  ctx.arc(w * 0.07, h * 0.4, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

function drawSlider(ctx, e, t) {
  const w = e.w, h = e.h;
  ctx.strokeStyle = 'rgba(190,230,255,0.5)'; ctx.lineWidth = 2; // speed lines
  ctx.beginPath();
  ctx.moveTo(-w * 0.7, h * 0.4); ctx.lineTo(-w * 0.45, h * 0.4);
  ctx.moveTo(-w * 0.75, h * 0.7); ctx.lineTo(-w * 0.5, h * 0.7);
  ctx.stroke();
  ctx.fillStyle = 'rgba(150,210,240,0.92)';
  roundRectE(ctx, -w / 2, 2, w, h - 2, 5); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(-w / 2 + 2, 4, w - 4, 4); // frosty top
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-w * 0.2, h * 0.3); ctx.lineTo(w * 0.05, h * 0.62); ctx.stroke();
  ctx.fillStyle = '#1c4966';
  ctx.beginPath();
  ctx.arc(w * 0.18, h * 0.42, 2.4, 0, Math.PI * 2);
  ctx.arc(w * 0.36, h * 0.42, 2.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawIcicle(ctx, e, t) {
  const w = e.w, h = e.h;
  if (e._mode !== 1) { // snowy cap while still anchored
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.ellipse(0, 1, w * 0.65, 4, 0, 0, Math.PI * 2); ctx.fill();
  }
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#d8f1ff'); grad.addColorStop(1, '#8fd0f5');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.lineTo(0, h);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.moveTo(-w * 0.18, 2); ctx.lineTo(-w * 0.05, 2); ctx.lineTo(-w * 0.1, h * 0.7); ctx.closePath(); ctx.fill();
}

function drawScorpion(ctx, e, t) {
  const w = e.w, h = e.h;
  const winding = e._st === 1, dashing = e._st === 2;
  if (winding) ctx.translate(Math.sin(t * 42) * 1.5, 0);
  ctx.strokeStyle = '#8a5a20'; ctx.lineWidth = 2; // legs
  for (let i = 0; i < 3; i++) {
    const lx = -w * 0.25 + i * w * 0.18;
    const wig = Math.sin(t * (dashing ? 26 : 9) + i) * (dashing ? 3 : 2);
    ctx.beginPath(); ctx.moveTo(lx, h - 7); ctx.lineTo(lx - 4 + wig, h); ctx.stroke();
  }
  ctx.fillStyle = winding ? '#e8a13c' : '#cc8e35';
  ctx.beginPath(); ctx.ellipse(0, h * 0.62, w * 0.38, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#b87a26'; // claws up front
  ctx.beginPath(); ctx.arc(w * 0.42, h * 0.6, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.5, h * 0.5, 3.4, 0, Math.PI * 2); ctx.fill();
  // tail arched over the back, raised while telegraphing a charge
  const lift = winding ? -4 : 0;
  ctx.strokeStyle = '#b87a26'; ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(-w * 0.34, h * 0.55);
  ctx.quadraticCurveTo(-w * 0.62, h * 0.1 + lift, -w * 0.3, lift + 2);
  ctx.stroke();
  ctx.fillStyle = '#7a4a10';
  ctx.beginPath(); ctx.arc(-w * 0.28, lift + 2, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#311b04';
  ctx.beginPath(); ctx.arc(w * 0.28, h * 0.5, 1.8, 0, Math.PI * 2); ctx.fill();
}

function drawVulture(ctx, e, t) {
  const w = e.w, h = e.h;
  const flap = Math.sin(e.t * 7) * 0.5;
  ctx.fillStyle = '#5d3a17';
  for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(s * w * 0.1, h * 0.4); ctx.rotate(s * flap * 0.8);
    ctx.beginPath(); ctx.ellipse(s * w * 0.32, -h * 0.08, w * 0.36, h * 0.16, s * 0.25, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#6d4423';
  ctx.beginPath(); ctx.ellipse(0, h * 0.5, w * 0.26, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8b4a0'; // bald head
  ctx.beginPath(); ctx.arc(w * 0.3, h * 0.3, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0c040'; // hooked beak
  ctx.beginPath(); ctx.moveTo(w * 0.42, h * 0.28); ctx.lineTo(w * 0.56, h * 0.36); ctx.lineTo(w * 0.4, h * 0.4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(w * 0.32, h * 0.27, 1.5, 0, Math.PI * 2); ctx.fill();
}

function drawLavaBlob(ctx, e, t) {
  const w = e.w, h = e.h;
  const cy = h * 0.55;
  const g = ctx.createRadialGradient(0, cy, 2, 0, cy, w * 0.85);
  g.addColorStop(0, 'rgba(255,170,60,0.55)'); g.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-w, cy - w, w * 2, w * 2);
  const _vy = e.vy || 0;
  const air = Math.abs(_vy) > 30;
  const wob = air ? (_vy < 0 ? 0.12 : -0.06) : Math.sin(e.t * 9) * 0.08;
  ctx.fillStyle = '#ff793f';
  ctx.beginPath(); ctx.ellipse(0, cy, w * 0.46 * (1 + wob), h * 0.42 * (1 - wob), 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd32a';
  ctx.beginPath(); ctx.ellipse(0, cy, w * 0.26, h * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(60,10,0,0.55)'; // crust chips
  ctx.beginPath();
  ctx.arc(-w * 0.22, cy - h * 0.2, 3, 0, Math.PI * 2);
  ctx.arc(w * 0.25, cy + h * 0.12, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawEmber(ctx, e, t, player) {
  const w = e.w, h = e.h;
  const chasing = player && Math.hypot(player.x + player.w / 2 - (e.x + e.w / 2), player.y + player.h / 2 - (e.y + e.h / 2)) < 300;
  const fl = Math.sin(e.t * (chasing ? 20 : 13)) * 2;
  ctx.fillStyle = '#ff793f';
  ctx.beginPath();
  ctx.moveTo(0, fl * 0.4);
  ctx.quadraticCurveTo(w * 0.5, h * 0.45, 0, h);
  ctx.quadraticCurveTo(-w * 0.5, h * 0.45, 0, fl * 0.4);
  ctx.fill();
  ctx.fillStyle = '#ffd32a';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.35 + fl * 0.3);
  ctx.quadraticCurveTo(w * 0.22, h * 0.6, 0, h * 0.88);
  ctx.quadraticCurveTo(-w * 0.22, h * 0.6, 0, h * 0.35 + fl * 0.3);
  ctx.fill();
  ctx.fillStyle = '#5a1500';
  ctx.beginPath();
  ctx.arc(-3, h * 0.6, 1.6, 0, Math.PI * 2);
  ctx.arc(3, h * 0.6, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawBird(ctx, e, t) {
  const w = e.w, h = e.h;
  const diving = e._mode === 1;
  const flap = Math.sin(e.t * (diving ? 18 : 9)) * 0.6;
  ctx.fillStyle = '#eef2fa';
  for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(s * w * 0.08, h * 0.42); ctx.rotate(s * flap);
    ctx.beginPath(); ctx.ellipse(s * w * 0.3, -h * 0.1, w * 0.34, h * 0.14, s * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#f5f6fa';
  ctx.beginPath(); ctx.ellipse(0, h * 0.55, w * 0.3, h * 0.26, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.26, h * 0.36, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0932b'; // beak
  ctx.beginPath(); ctx.moveTo(w * 0.4, h * 0.33); ctx.lineTo(w * 0.55, h * 0.4); ctx.lineTo(w * 0.38, h * 0.45); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(w * 0.28, h * 0.34, 1.6, 0, Math.PI * 2); ctx.fill();
}

function drawPuff(ctx, e, t) {
  const w = e.w, h = e.h;
  const bob = Math.sin(e.t * 2.4) * 1.5;
  ctx.fillStyle = 'rgba(240,245,255,0.95)';
  ctx.beginPath();
  ctx.arc(-w * 0.22, h * 0.55 + bob, h * 0.3, 0, Math.PI * 2);
  ctx.arc(0, h * 0.4 + bob, h * 0.38, 0, Math.PI * 2);
  ctx.arc(w * 0.24, h * 0.55 + bob, h * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5b7c9d'; ctx.lineWidth = 1.6; // cross brows
  ctx.beginPath();
  ctx.moveTo(-6, h * 0.42 + bob); ctx.lineTo(-2, h * 0.46 + bob);
  ctx.moveTo(6, h * 0.42 + bob); ctx.lineTo(2, h * 0.46 + bob);
  ctx.stroke();
  ctx.fillStyle = '#5b7c9d';
  ctx.beginPath();
  ctx.arc(-3.5, h * 0.52 + bob, 1.5, 0, Math.PI * 2);
  ctx.arc(3.5, h * 0.52 + bob, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpider(ctx, e, t) {
  const w = e.w, h = e.h;
  // silk thread up to the anchor
  ctx.strokeStyle = 'rgba(220,220,230,0.7)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0, (e.anchorY || e.y) - e.y); ctx.lineTo(0, h * 0.3); ctx.stroke();
  ctx.strokeStyle = '#4a3520'; ctx.lineWidth = 2; // legs
  for (let i = 0; i < 4; i++) {
    const a = -0.7 + i * 0.45 + Math.sin(t * 8 + i) * 0.08;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, h * 0.5);
      ctx.lineTo(s * Math.cos(a) * w * 0.55, h * 0.5 + Math.sin(a) * h * 0.45);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#6d4c2a';
  ctx.beginPath(); ctx.ellipse(0, h * 0.45, w * 0.26, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8d6e4a';
  ctx.beginPath(); ctx.arc(0, h * 0.72, w * 0.14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff4040';
  ctx.beginPath();
  ctx.arc(-2.5, h * 0.7, 1.3, 0, Math.PI * 2);
  ctx.arc(2.5, h * 0.7, 1.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawShroom(ctx, e, t) {
  const w = e.w, h = e.h;
  const air = Math.abs(e.vy || 0) > 30;
  const sq = air ? 1.12 : 1 + Math.sin(t * 4 + e.phase) * 0.04;
  ctx.fillStyle = '#f5e8d0'; // stem
  ctx.fillRect(-w * 0.18, h * 0.45, w * 0.36, h * 0.55);
  ctx.fillStyle = '#5a4632';
  ctx.beginPath();
  ctx.arc(-3, h * 0.68, 1.7, 0, Math.PI * 2);
  ctx.arc(3, h * 0.68, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e0574a'; // cap
  ctx.beginPath(); ctx.ellipse(0, h * 0.42, w * 0.55, h * 0.36 * sq, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-w * 0.25, h * 0.3, 2.4, 0, Math.PI * 2);
  ctx.arc(w * 0.1, h * 0.2, 2.8, 0, Math.PI * 2);
  ctx.arc(w * 0.32, h * 0.34, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawDrone(ctx, e, t) {
  const w = e.w, h = e.h;
  ctx.fillStyle = 'rgba(150,230,255,0.35)'; // rotor shimmer
  ctx.beginPath(); ctx.ellipse(0, 2, w * 0.5, 2.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a4b66';
  ctx.beginPath(); ctx.ellipse(0, h * 0.55, w * 0.5, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a7390';
  ctx.beginPath(); ctx.ellipse(0, h * 0.42, w * 0.26, h * 0.2, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = Math.sin(e.t * 6) > 0 ? '#00d2d3' : '#16505a'; // scan light
  ctx.beginPath(); ctx.arc(0, h * 0.55, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1f2c3f';
  ctx.fillRect(-w * 0.42, h * 0.52, 5, 3); ctx.fillRect(w * 0.42 - 5, h * 0.52, 5, 3);
}

function drawTurret(ctx, e, t) {
  const w = e.w, h = e.h;
  const charging = e._cd !== undefined && e._cd < 0.4;
  ctx.fillStyle = '#2c3a52'; // base
  ctx.beginPath();
  ctx.moveTo(-w / 2, h); ctx.lineTo(-w * 0.32, h * 0.45); ctx.lineTo(w * 0.32, h * 0.45); ctx.lineTo(w / 2, h);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#46608a'; // dome
  ctx.beginPath(); ctx.ellipse(0, h * 0.45, w * 0.3, h * 0.3, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#1f2c3f'; // barrel tracks the player (faces +x after flip)
  ctx.fillRect(w * 0.2, h * 0.32, w * 0.42, 5);
  ctx.fillStyle = charging ? '#46d5ff' : '#27405c'; // muzzle warms up before a shot
  ctx.beginPath(); ctx.arc(w * 0.64, h * 0.38, charging ? 3.6 : 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = Math.sin(e.t * 5) > 0 ? '#46d5ff' : '#1b3048';
  ctx.beginPath(); ctx.arc(0, h * 0.34, 2, 0, Math.PI * 2); ctx.fill();
}

function drawGolem(ctx, e, t) {
  const w = e.w, h = e.h;
  ctx.fillStyle = '#1b6f8c';
  ctx.fillRect(-w * 0.34, h - 8, w * 0.26, 8);
  ctx.fillRect(w * 0.08, h - 8, w * 0.26, 8);
  ctx.fillStyle = '#2e9cb8'; // angular crystal torso
  ctx.beginPath();
  ctx.moveTo(-w * 0.46, h * 0.85); ctx.lineTo(-w * 0.38, h * 0.18); ctx.lineTo(0, h * 0.02);
  ctx.lineTo(w * 0.38, h * 0.18); ctx.lineTo(w * 0.46, h * 0.85);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; // facets
  ctx.beginPath();
  ctx.moveTo(-w * 0.2, h * 0.1); ctx.lineTo(-w * 0.1, h * 0.8);
  ctx.moveTo(w * 0.18, h * 0.12); ctx.lineTo(w * 0.26, h * 0.78);
  ctx.stroke();
  const pulse = 0.6 + Math.sin(e.t * 3) * 0.4; // glowing core
  ctx.fillStyle = `rgba(72,219,251,${pulse})`;
  ctx.beginPath(); ctx.arc(0, h * 0.42, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#bff4ff';
  ctx.beginPath();
  ctx.arc(-w * 0.14, h * 0.22, 2.2, 0, Math.PI * 2);
  ctx.arc(w * 0.14, h * 0.22, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawShard(ctx, e, t) {
  const w = e.w, h = e.h;
  ctx.save();
  ctx.translate(0, h / 2);
  ctx.rotate(e.t * 3 + (e.phase || 0));
  const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  grad.addColorStop(0, '#bffff5'); grad.addColorStop(1, '#00c8b4');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -h / 2); ctx.lineTo(w * 0.34, 0); ctx.lineTo(0, h / 2); ctx.lineTo(-w * 0.34, 0);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(0, h / 2); ctx.stroke();
  ctx.restore();
}

function drawKnight(ctx, e, t) {
  const w = e.w, h = e.h;
  const winding = e._st === 1, dashing = e._st === 2;
  if (winding) ctx.translate(Math.sin(t * 42) * 1.5, 0);
  ctx.fillStyle = '#23233c';
  ctx.fillRect(-w * 0.3, h - 7, w * 0.22, 7);
  ctx.fillRect(w * 0.08, h - 7, w * 0.22, 7);
  ctx.fillStyle = winding ? '#6a6a96' : '#4d4d78'; // armored torso
  roundRectE(ctx, -w * 0.36, h * 0.3, w * 0.72, h * 0.62, 5); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(-w * 0.36, h * 0.38, w * 0.72, 4);
  ctx.fillStyle = '#5d5d8c'; // helmet
  ctx.beginPath(); ctx.ellipse(0, h * 0.22, w * 0.24, h * 0.18, 0, Math.PI, 0); ctx.fill();
  ctx.fillRect(-w * 0.24, h * 0.2, w * 0.48, h * 0.1);
  ctx.fillStyle = dashing ? '#ff7675' : '#a55eea'; // visor slit glow
  ctx.fillRect(w * 0.02, h * 0.21, w * 0.18, 3);
  ctx.fillStyle = '#c0392b'; // plume
  ctx.beginPath();
  ctx.moveTo(-w * 0.05, h * 0.05); ctx.quadraticCurveTo(-w * 0.3, -h * 0.06, -w * 0.4, h * 0.12);
  ctx.quadraticCurveTo(-w * 0.2, h * 0.1, -w * 0.05, h * 0.16);
  ctx.fill();
  ctx.fillStyle = '#c8d6e5'; // blade held forward
  ctx.fillRect(w * 0.36, h * 0.45, w * 0.4, 4);
}

function drawWraith(ctx, e, t) {
  const w = e.w, h = e.h;
  ctx.save();
  ctx.globalAlpha = 0.6 + Math.sin(e.t * 2.6) * 0.18;
  ctx.fillStyle = '#b08fd8';
  ctx.beginPath();
  ctx.arc(0, h * 0.32, w * 0.34, Math.PI, 0);
  const hem = h * 0.85;
  ctx.lineTo(w * 0.34, hem);
  for (let i = 2; i >= -2; i--) { // wavy hem
    const hx = (i / 2) * w * 0.34;
    const hy = hem + Math.sin(e.t * 5 + i) * 3 + (i % 2 ? 6 : 0);
    ctx.lineTo(hx, hy);
  }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2d1b4e';
  ctx.beginPath();
  ctx.ellipse(-w * 0.12, h * 0.3, 2.6, 3.4, 0, 0, Math.PI * 2);
  ctx.ellipse(w * 0.12, h * 0.3, 2.6, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const SPECIES_DRAW = {
  slime: drawSlime, bee: drawBee, crawler: drawCrawler, bat: drawBat,
  slider: drawSlider, icicle: drawIcicle, scorpion: drawScorpion, vulture: drawVulture,
  lavablob: drawLavaBlob, ember: drawEmber, bird: drawBird, puff: drawPuff,
  spider: drawSpider, shroom: drawShroom, drone: drawDrone, turret: drawTurret,
  golem: drawGolem, shard: drawShard, knight: drawKnight, wraith: drawWraith,
};

function roundRectE(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ─── PLAYER SPECIAL ATTACKS ──────────────────────────────────────────────────
// Purchased from the shop for large sums. Each has its own cooldown (managed by
// main.js on player.specialCDs). All three are especially potent against bosses.

export const playerBombs = [];

// Q — Heal Surge: restores 45 HP immediately.
export function useHeal(player) {
  player.hp = Math.min(player.maxHp, player.hp + 45);
  const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * Math.PI * 2;
    const spd = 55 + Math.random() * 110;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 50,
      life: 0.75, maxLife: 0.75,
      color: i % 2 ? '#2ecc71' : '#a8ff78', size: 4,
      gravity: 220,
    });
  }
}

// E — Mega Bomb: drops a fused bomb that explodes for 70 dmg / 250 px radius.
// Boss shields are stripped before the blast hits.
export function useBomb(player) {
  playerBombs.push({
    x: player.x + player.w / 2,
    y: player.y,
    vx: player.facing * 80,
    vy: -240,
    fuse: 2.0,
    fuseMax: 2.0,
    damage: 70,
    radius: 250,
  });
}

// Lightning bolt visual — jagged particle chain between two world points.
function addLightningBolt(x1, y1, x2, y2) {
  const steps = 9;
  let px = x1, py = y1;
  for (let i = 1; i <= steps; i++) {
    const frac = i / steps;
    const nx = x1 + (x2 - x1) * frac + (i < steps ? (Math.random() - 0.5) * 34 : 0);
    const ny = y1 + (y2 - y1) * frac + (i < steps ? (Math.random() - 0.5) * 34 : 0);
    particles.push({
      x: (px + nx) / 2, y: (py + ny) / 2,
      vx: (Math.random() - 0.5) * 28, vy: (Math.random() - 0.5) * 28,
      life: 0.28, maxLife: 0.28,
      color: i % 2 ? '#ffff80' : '#80d4ff', size: 2 + Math.random() * 2.5, gravity: 0,
    });
    px = nx; py = ny;
  }
}

// R — Nova Strike: immediate screen-wide energy burst. Hits every alive enemy for
// 35 damage (70 vs bosses). Boss shields are stripped first.
export function useNova(player) {
  const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
  // Big central flash
  addExplosion(cx, cy, '#c8aaff');
  addExplosion(cx, cy, '#ffffff');
  for (let i = 0; i < 32; i++) {
    const ang = (i / 32) * Math.PI * 2;
    const spd = 140 + Math.random() * 320;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      life: 0.9, maxLife: 0.9,
      color: i % 3 === 0 ? '#ffd700' : i % 3 === 1 ? '#c8aaff' : '#ffffff',
      size: 5 + Math.random() * 3,
      gravity: 80,
    });
  }
  for (const e of enemies) {
    if (!e.alive) continue;
    // Strip boss shield so the nova always lands
    if (e.boss && e.shieldHp > 0) e.shieldHp = 0;
    const dmg = e.boss ? 70 : 35;
    const ecx = e.x + e.w / 2;
    const knockDir = ecx < cx ? -1 : 1;
    damageEnemy(e, dmg, knockDir, 700, player, null);
    addExplosion(ecx, e.y + e.h / 2, '#c8aaff');
  }
}

// Updates fused bombs — physics, fuse countdown, and detonation.
export function updatePlayerBombs(dt, platforms) {
  for (let i = playerBombs.length - 1; i >= 0; i--) {
    const b = playerBombs[i];
    b.vy += 1600 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Land on platforms (slight bounce)
    for (const p of platforms) {
      if (p._crumbleState === 2) continue;
      const onGround = p.type === 'ground'
        ? (b.x > p.x && b.x < p.x + p.w && b.y > p.y)
        : (b.vy > 0 && b.y > p.y - 12 && b.y < p.y + 16 && b.x > p.x && b.x < p.x + p.w);
      if (onGround) {
        b.y = p.type === 'ground' ? p.y - 1 : p.y - 1;
        b.vy = b.vy > 60 ? -b.vy * 0.25 : 0;
        b.vx *= 0.7;
      }
    }

    b.fuse -= dt;
    if (b.fuse <= 0) {
      // Detonate
      addExplosion(b.x, b.y, '#ff9f43');
      addExplosion(b.x, b.y - 24, '#ffd700');
      // Extra blast particles
      for (let j = 0; j < 28; j++) {
        const ang = (j / 28) * Math.PI * 2;
        const spd = 110 + Math.random() * 240;
        particles.push({
          x: b.x, y: b.y,
          vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
          life: 0.65, maxLife: 0.65,
          color: j % 2 ? '#ff9f43' : '#ffd700', size: 5, gravity: 140,
        });
      }
      for (const e of enemies) {
        if (!e.alive) continue;
        const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
        const dist = Math.hypot(ecx - b.x, ecy - b.y);
        if (dist <= b.radius) {
          if (e.boss && e.shieldHp > 0) e.shieldHp = 0;
          const falloff = 1 - dist / b.radius;
          const dmg = Math.ceil(b.damage * (0.4 + 0.6 * falloff));
          const knockDir = ecx < b.x ? -1 : 1;
          damageEnemy(e, dmg, knockDir, 800, null, null);
        }
      }
      playerBombs.splice(i, 1);
    }
  }
}

// Draws fused bombs with a pulsing glow and countdown timer.
export function drawPlayerBombs(ctx, camX, GW) {
  for (const b of playerBombs) {
    if (b.x < camX - 60 || b.x > camX + GW + 60) continue;
    const progress = b.fuse / b.fuseMax; // 1→0 as fuse burns

    ctx.save();
    ctx.translate(b.x, b.y);

    // Outer danger glow — transitions orange → red as fuse shortens
    const glowR = progress > 0.5 ? 255 : 255;
    const glowG = Math.round(progress * 160);
    ctx.globalAlpha = 0.35 + (1 - progress) * 0.45;
    ctx.fillStyle = `rgb(${glowR},${glowG},40)`;
    ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // Bomb body
    ctx.fillStyle = '#2f3542';
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#636e72';
    ctx.beginPath(); ctx.arc(-3, -4, 4.5, 0, Math.PI * 2); ctx.fill();

    // Fuse rope
    ctx.strokeStyle = '#f39c12';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.bezierCurveTo(10, -22, 7, -32, 3, -38);
    ctx.stroke();

    // Fuse spark (flashes faster near detonation)
    const flashHz = 6 + (1 - progress) * 18;
    if (Math.sin(b.fuse * flashHz) > 0) {
      ctx.fillStyle = '#ffd700';
      ctx.beginPath(); ctx.arc(3, -38, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(3, -38, 2, 0, Math.PI * 2); ctx.fill();
    }

    // Countdown label
    ctx.fillStyle = progress < 0.4 ? '#ff4757' : '#ffffff';
    ctx.font = `bold ${progress < 0.4 ? 12 : 10}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(b.fuse.toFixed(1), 0, 26);
    ctx.textAlign = 'left';

    ctx.restore();
  }
}

// T — Shield Surge: full invulnerability for 3 s, visualised as a spinning bubble.
export function useShield(player) {
  player.invuln = 3.5;
  player._shieldT = 3.5;
  const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
  for (let i = 0; i < 22; i++) {
    const ang = (i / 22) * Math.PI * 2;
    const r = 26 + Math.random() * 10;
    particles.push({
      x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r,
      vx: Math.cos(ang) * 55, vy: Math.sin(ang) * 55 - 30,
      life: 0.7, maxLife: 0.7,
      color: i % 2 ? '#80d4ff' : '#ffffff', size: 3.5, gravity: 80,
    });
  }
}

// Y — Chain Lightning: 60 dmg on nearest enemy, chains to 3 more for 35/20/10.
// Boss shields stripped. Jumping bolt visual between each target.
export function useChainLightning(player) {
  const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
  const CHAIN_DMG = [60, 35, 20, 10];

  // Sort alive enemies by distance from player
  const sorted = enemies
    .filter(e => e.alive)
    .map(e => ({ e, dist: Math.hypot(e.x + e.w / 2 - pcx, e.y + e.h / 2 - pcy) }))
    .sort((a, b) => a.dist - b.dist);

  let fromX = pcx, fromY = pcy;
  for (let i = 0; i < Math.min(CHAIN_DMG.length, sorted.length); i++) {
    const { e, dist } = sorted[i];
    if (i > 0 && dist > 360) break; // chain falls off past 360 px
    if (e.boss && e.shieldHp > 0) e.shieldHp = 0;
    const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
    addLightningBolt(fromX, fromY, ecx, ecy);
    addHitParticles(ecx, ecy, '#ffff80', 8);
    damageEnemy(e, CHAIN_DMG[i], ecx < pcx ? -1 : 1, 500, player, null);
    fromX = ecx; fromY = ecy;
  }
  // Flash at player origin
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * Math.PI * 2;
    particles.push({
      x: pcx, y: pcy,
      vx: Math.cos(ang) * (90 + Math.random() * 110), vy: Math.sin(ang) * (90 + Math.random() * 110),
      life: 0.38, maxLife: 0.38,
      color: i % 2 ? '#ffff80' : '#80d4ff', size: 3.5, gravity: 0,
    });
  }
}

// U — Time Stop: freeze every enemy completely for 3 s (boss: 1.5 s).
export function useTimeStop(player) {
  const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
  for (const e of enemies) {
    if (!e.alive) continue;
    e._frozenT = e.boss ? 1.5 : 3.0;
    e.hitFlash = 0.08;
  }
  for (let i = 0; i < 32; i++) {
    const ang = (i / 32) * Math.PI * 2;
    const spd = 100 + Math.random() * 220;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      life: 1.1, maxLife: 1.1,
      color: i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#80d4ff' : '#c8eeff',
      size: 4 + Math.random() * 3, gravity: 18,
    });
  }
}

// I — Quake Slam: shockwave from feet — 45 dmg to all enemies (90 vs bosses, 22 vs flyers).
// Launches the player upward.
export function useQuake(player) {
  const cx = player.x + player.w / 2, cy = player.y + player.h;
  // Ground shockwave particles spreading left and right
  for (let i = 0; i < 26; i++) {
    const ang = (i / 26) * Math.PI * 2;
    particles.push({
      x: cx + Math.cos(ang) * 10, y: cy,
      vx: Math.cos(ang) * (110 + Math.random() * 200),
      vy: Math.sin(ang) * (110 + Math.random() * 200) - 90,
      life: 0.65, maxLife: 0.65,
      color: i % 3 === 0 ? '#d35400' : i % 3 === 1 ? '#e67e22' : '#f39c12',
      size: 4 + Math.random() * 3, gravity: 320,
    });
  }
  // Launch player upward and restore double-jump
  player.vy = Math.min(player.vy, -320);
  player.jumpsLeft = 2;
  // Damage all enemies
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.boss && e.shieldHp > 0) e.shieldHp = 0;
    const dmg = e.boss ? 90 : (e.air ? 22 : 45);
    const ecx = e.x + e.w / 2;
    damageEnemy(e, dmg, ecx < cx ? -1 : 1, 850, player, null);
    addHitParticles(ecx, e.y + e.h / 2, '#e67e22', 5);
  }
}
