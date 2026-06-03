import { isLeft, isRight } from './input.js';
import { resolveX, resolveY } from './level.js';
import { addDJParticles, addLandParticles } from './entities.js';
import { getJumpMult, getDJMult, getSpeedMult, getEquippedWeapon } from './state.js';

function lerp(a, b, t) { return a + (b - a) * t; }

const BASE_JUMP = 555;
const BASE_DJ = 495;
const BASE_SPEED = 280;
const GRAVITY = 1850;
const TERMINAL_VEL = 950;
const COYOTE_TIME = 0.1;
const FRICTION = 0.72;

export const player = {
  x: 80, y: 380,
  w: 28, h: 42,
  vx: 0, vy: 0,
  _prevY: 380,
  onGround: false,
  jumpsLeft: 2,
  coyoteTimer: 0,
  jumpBufferTimer: 0,
  facing: 1,
  distanceTraveled: 0,
  animState: 'idle',
  animTimer: 0,
  landSquash: 0,
  djFlash: 0,
  dead: false,
  // Combat
  attackCD: 0,        // seconds until the next attack is allowed
  swingT: 0,          // remaining swing-animation time
  swingDur: 0.16,
  weapon: null,       // equipped weapon def (for drawing)
  // Computed from upgrades each level
  jumpForce: BASE_JUMP,
  djForce: BASE_DJ,
  speed: BASE_SPEED,
};

export function initPlayer(spawnX, spawnY) {
  player.x = spawnX;
  player.y = spawnY;
  player._prevY = spawnY - 1; // slightly above to trigger landing on first frame
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  player.jumpsLeft = 2;
  player.coyoteTimer = COYOTE_TIME;
  player.jumpBufferTimer = 0;
  player.facing = 1;
  player.distanceTraveled = 0;
  player.animState = 'idle';
  player.animTimer = 0;
  player.landSquash = 0;
  player.djFlash = 0;
  player.dead = false;
  player.attackCD = 0;
  player.swingT = 0;
  player.weapon = getEquippedWeapon();

  player.jumpForce = BASE_JUMP * getJumpMult();
  player.djForce = BASE_DJ * getDJMult();
  player.speed = BASE_SPEED * getSpeedMult();
}

export function updatePlayer(dt, platforms, jumpJustPressed) {
  if (player.dead) return;

  // Ride moving platforms: if grounded on one last frame, inherit its motion
  // this frame so the player stays attached instead of sliding off.
  if (player.onGround && player._groundPlat && player._groundPlat.type === 'move') {
    player.x += player._groundPlat._dx || 0;
    player.y += player._groundPlat._dy || 0;
  }

  // Jump buffer
  if (jumpJustPressed) player.jumpBufferTimer = 0.085;
  else if (player.jumpBufferTimer > 0) player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt);

  // Coyote timer decrement
  if (!player.onGround) {
    player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);
  }

  // Jump logic
  if (player.jumpBufferTimer > 0) {
    if (player.coyoteTimer > 0 && player.jumpsLeft === 2) {
      // Ground / coyote jump
      player.vy = -player.jumpForce;
      player.coyoteTimer = 0;
      player.jumpBufferTimer = 0;
      player.jumpsLeft = 1; // first jump used
      player.animState = 'jump';
    } else if (player.jumpsLeft > 0 && player.coyoteTimer <= 0) {
      // Double jump
      player.vy = -player.djForce;
      player.jumpsLeft = 0;
      player.jumpBufferTimer = 0;
      player.djFlash = 0.28;
      player.animState = 'jump';
      addDJParticles(player.x + player.w / 2, player.y + player.h);
    }
  }

  // Horizontal movement
  const targetVx = isLeft() ? -player.speed : isRight() ? player.speed : 0;
  if (targetVx !== 0) {
    player.vx = targetVx;
    player.facing = targetVx > 0 ? 1 : -1;
  } else {
    player.vx *= FRICTION;
    if (Math.abs(player.vx) < 8) player.vx = 0;
  }

  // Gravity
  player.vy = Math.min(player.vy + GRAVITY * dt, TERMINAL_VEL);

  // Store prevY for collision resolution
  player._prevY = player.y;

  // Move X → resolve X (uses current y, before y-move)
  player.x += player.vx * dt;
  player.x = Math.max(0, player.x); // left wall clamp
  resolveX(player, platforms);

  // Move Y → resolve Y (uses _prevY to determine landing direction)
  player._prevY = player.y;
  player.y += player.vy * dt;

  const wasOnGround = player.onGround;
  player.onGround = resolveY(player, platforms);

  if (player.onGround) {
    player.jumpsLeft = 2;
    player.coyoteTimer = COYOTE_TIME;
    if (!wasOnGround) {
      // Just landed
      player.landSquash = 0.18;
      addLandParticles(player.x + player.w / 2, player.y + player.h);
    }
  }

  // Update timers
  player.landSquash = Math.max(0, player.landSquash - dt * 5.5);
  player.djFlash = Math.max(0, player.djFlash - dt);
  player.attackCD = Math.max(0, player.attackCD - dt);
  player.swingT = Math.max(0, player.swingT - dt);

  // Walk distance for leg swing animation
  if (player.onGround && Math.abs(player.vx) > 15) {
    player.distanceTraveled += Math.abs(player.vx) * dt;
  }

  // Animation state
  if (!player.onGround) {
    player.animState = player.vy > 80 ? 'fall' : 'jump';
  } else if (Math.abs(player.vx) > 15) {
    player.animState = 'walk';
  } else {
    player.animState = 'idle';
  }

  player.animTimer += dt;
}

export function drawPlayer(ctx, t) {
  const { x, y, w, h, facing, animState, animTimer, landSquash, djFlash, distanceTraveled } = player;

  const centerX = x + w / 2;
  const centerY = y + h / 2;

  ctx.save();
  ctx.translate(centerX, centerY);
  if (facing < 0) ctx.scale(-1, 1);

  // Squash/stretch transform
  let sx = 1, sy = 1;
  if (landSquash > 0) {
    const n = landSquash / 0.18;
    sx = 1 + 0.42 * n;
    sy = 1 - 0.38 * n;
  } else if (animState === 'jump') {
    sx = 0.82; sy = 1.22;
  } else if (animState === 'fall') {
    sx = 1.12; sy = 0.83;
  } else if (animState === 'idle') {
    sy = 1 + Math.sin(animTimer * 3.2) * 0.028;
  }
  ctx.scale(sx, sy);

  const hw = w / 2;
  const hh = h / 2;

  // --- Legs ---
  const legSwing = animState === 'walk' ? Math.sin(distanceTraveled * 0.048) * 0.55 : 0;
  drawLimb(ctx, -hw * 0.38, hh * 0.25, legSwing, '#1a252f', 6, hh * 0.48);
  drawLimb(ctx, hw * 0.38, hh * 0.25, -legSwing, '#1a252f', 6, hh * 0.48);

  // --- Body (shirt) ---
  ctx.fillStyle = '#2980b9';
  roundRect(ctx, -hw * 0.72, -hh * 0.22, w * 0.72, h * 0.52, 5);
  ctx.fill();
  // Shirt detail (stripe)
  ctx.fillStyle = '#1a6fa8';
  ctx.fillRect(-hw * 0.72, hh * 0.06, w * 0.72, 4);

  // --- Arms ---
  const armSwing = animState === 'walk' ? -legSwing * 0.85 : 0;
  const armFall = animState === 'fall' ? 0.75 : 0;
  drawLimb(ctx, hw * 0.72, -hh * 0.1, armFall + armSwing, '#f0a070', 5, hh * 0.38, true);
  drawLimb(ctx, -hw * 0.72, -hh * 0.1, armFall - armSwing, '#f0a070', 5, hh * 0.38, true);

  // --- Head ---
  ctx.fillStyle = '#f5cba7';
  ctx.beginPath();
  ctx.arc(0, -hh * 0.42, hw * 0.85, 0, Math.PI * 2);
  ctx.fill();

  // Ear
  ctx.fillStyle = '#e8b898';
  ctx.beginPath();
  ctx.arc(hw * 0.78, -hh * 0.38, 4, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = '#5d4037';
  ctx.beginPath();
  ctx.arc(-hw * 0.08, -hh * 0.78, 7.5, 0, Math.PI * 2);
  ctx.arc(hw * 0.18, -hh * 0.82, 6.5, 0, Math.PI * 2);
  ctx.arc(hw * 0.5, -hh * 0.75, 5.5, 0, Math.PI * 2);
  ctx.fill();
  // Hair band
  ctx.strokeStyle = '#3e2723';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -hh * 0.42, hw * 0.8, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();

  // Eyes (right eye is front when facing right)
  const eyeY = -hh * 0.42;
  // Whites
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.ellipse(hw * 0.28, eyeY, 5, 5.5, 0, 0, Math.PI * 2);
  ctx.ellipse(-hw * 0.12, eyeY, 4, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Pupils
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(hw * 0.34, eyeY, 2.5, 0, Math.PI * 2);
  ctx.arc(-hw * 0.08, eyeY, 2, 0, Math.PI * 2);
  ctx.fill();
  // Eye shine
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(hw * 0.38, eyeY - 1.5, 1, 0, Math.PI * 2);
  ctx.arc(-hw * 0.05, eyeY - 1.5, 0.9, 0, Math.PI * 2);
  ctx.fill();

  // Smile
  ctx.strokeStyle = '#c0624a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(hw * 0.1, eyeY + 9, 5, 0.1, Math.PI - 0.1);
  ctx.stroke();

  // Weapon swing / attack
  if (player.swingT > 0 && player.weapon) {
    drawWeaponSwing(ctx, hw, hh, player.weapon, 1 - player.swingT / player.swingDur);
  }

  // Double-jump flash outline
  if (djFlash > 0) {
    const flashAlpha = djFlash / 0.28;
    ctx.strokeStyle = `rgba(0,255,229,${flashAlpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -hh * 0.1, hw * 1.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  ctx.restore();
}

// Draws the equipped weapon mid-swing in front of the player. Called inside the
// player's translated+facing-flipped context, so +x is always "forward".
function drawWeaponSwing(ctx, hw, hh, weapon, prog) {
  ctx.save();
  ctx.translate(hw * 0.55, -hh * 0.05); // shoulder pivot

  if (weapon.type === 'ranged') {
    // Hold the weapon level and forward, with a muzzle flash early in the swing.
    ctx.fillStyle = '#2a2a33';
    ctx.fillRect(0, -3.5, 18, 7);
    ctx.fillStyle = weapon.color;
    ctx.fillRect(15, -2.5, 7, 5);
    if (prog < 0.55) {
      ctx.globalAlpha = 1 - prog / 0.55;
      ctx.fillStyle = weapon.color;
      ctx.beginPath();
      ctx.arc(26, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    return;
  }

  // Melee: arc the arm + weapon from overhead down through forward.
  const reach = weapon.reach || 26;
  const ang = lerp(-1.0, 1.05, prog);
  ctx.rotate(ang);

  // swoosh trail
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, reach * 0.85, -0.55, 0.55);
  ctx.stroke();

  // arm
  ctx.strokeStyle = '#f0a070';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(reach * 0.45, 0);
  ctx.stroke();

  ctx.translate(reach * 0.45, 0);
  if (weapon.key === 'fists') {
    ctx.fillStyle = weapon.color;
    ctx.beginPath();
    ctx.arc(4, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (weapon.key === 'hammer') {
    ctx.fillStyle = '#5a4632';
    ctx.fillRect(0, -2.5, reach * 0.45, 5);
    ctx.fillStyle = weapon.color;
    ctx.fillRect(reach * 0.45 - 3, -9, 13, 18);
  } else {
    // sword (and any other blade)
    ctx.fillStyle = '#8a8a96';
    ctx.fillRect(-3, -5, 5, 10); // guard
    ctx.fillStyle = weapon.color;
    ctx.fillRect(2, -2.5, reach * 0.75, 5); // blade
  }
  ctx.restore();
}

function drawLimb(ctx, x, y, angle, color, w, length, isArm = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  if (isArm) {
    ctx.fillRect(0, -w / 2, length, w);
  } else {
    ctx.fillRect(-w / 2, 0, w, length);
    // Shoe
    ctx.fillStyle = '#212121';
    ctx.fillRect(-w / 2 - 1, length - 5, w + 4, 7);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
