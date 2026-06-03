import { loadPlayerData, playerData, markLevelComplete, getMagnetRadius, getStartLives, isStageComplete } from './state.js';
import { initInput, consumeJump, consumeEsc, isAttack, clearAll } from './input.js';
import { player, initPlayer, updatePlayer, drawPlayer } from './player.js';
import {
  generateLevel, drawPlatforms, drawHazards, getPlayerSpawn,
  resetDynamics, updateDynamics, hazardHit, GW, GH,
} from './level.js';
import {
  initEntities, updateEntities, drawEntities, exitDoor,
  updateEnemies, updateProjectiles, drawEnemies, drawProjectiles,
  playerMeleeAttack, spawnProjectile,
} from './entities.js';
import { drawBackground, getTheme } from './renderer.js';
import {
  initUI, showScreen, updateHUD, showLevelComplete,
  showStageComplete, buildMainMenu, buildStageSelect, buildLevelSelect, showPauseMenu,
} from './ui.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let currentStage = 1;
let currentLevel = 1;
let levelData = null;
let camX = 0;
let lives = 2;
let coinsThisLevel = 0;
let gameTime = 0;
let gameActive = false;
let paused = false;
let prevTimestamp = null;
let deathTimer = 0;

// UI callbacks object
const callbacks = {
  onPlay() {
    const btn = document.getElementById('btn-play');
    const s = parseInt(btn.dataset.stage) || 1;
    const l = parseInt(btn.dataset.level) || 1;
    startLevel(s, l);
  },
  onStartLevel(s, l) { startLevel(s, l); },
  onResume() {
    paused = false;
    prevTimestamp = null;
    gameActive = true;
  },
  onQuitToMenu() {
    gameActive = false;
    paused = false;
    buildMainMenu(callbacks);
  },
};

function startLevel(stage, level) {
  currentStage = stage;
  currentLevel = level;
  levelData = generateLevel(stage - 1, level - 1);

  const spawn = getPlayerSpawn(levelData);
  initPlayer(spawn.x, spawn.y);
  initEntities(levelData);
  resetDynamics(levelData);

  camX = 0;
  coinsThisLevel = 0;
  lives = getStartLives();
  gameTime = 0;
  paused = false;
  deathTimer = 0;
  gameActive = true;
  prevTimestamp = null;

  callbacks._lastCoins = 0;

  updateHUD(stage, level, 0, playerData.coins, lives);
  showScreen('game-wrap');
}

function respawnPlayer() {
  const spawn = getPlayerSpawn(levelData);
  initPlayer(spawn.x, spawn.y);
  initEntities(levelData); // reset coins for this attempt
  resetDynamics(levelData); // reset moving/crumbling platforms
  camX = 0;
  coinsThisLevel = 0;
}

function onPlayerDeath() {
  lives--;
  if (lives <= 0) {
    // Game over — restart from level start
    lives = getStartLives();
    respawnPlayer();
  } else {
    respawnPlayer();
  }
  updateHUD(currentStage, currentLevel, coinsThisLevel, playerData.coins, lives);
}

function onLevelComplete() {
  gameActive = false;
  markLevelComplete(currentStage, currentLevel);

  callbacks._lastCoins = coinsThisLevel;

  const stageJustDone = isStageComplete(currentStage);
  if (stageJustDone && currentLevel === 50) {
    showStageComplete(currentStage, callbacks);
  } else {
    showLevelComplete(currentStage, currentLevel, coinsThisLevel, playerData.coins, callbacks);
  }
}

function updateCamera(dt) {
  const targetX = player.x + player.w / 2 - GW / 2;
  const maxCam = Math.max(0, levelData.width - GW);
  const clampedTarget = Math.max(0, Math.min(targetX, maxCam));
  camX += (clampedTarget - camX) * Math.min(dt * 9, 1);
}

function checkExit() {
  if (!exitDoor) return false;
  const { x, y, w, h } = exitDoor;
  return (
    player.x < x + w && player.x + player.w > x &&
    player.y < y + h && player.y + player.h > y
  );
}

function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);

  if (!prevTimestamp) { prevTimestamp = timestamp; return; }
  const dt = Math.min((timestamp - prevTimestamp) / 1000, 0.033);
  prevTimestamp = timestamp;

  // ESC to pause/unpause
  if (consumeEsc()) {
    if (gameActive && !paused) {
      paused = true;
      gameActive = false;
      showPauseMenu();
      return;
    }
  }

  if (!gameActive || paused) return;

  gameTime += dt;

  // Handle death timer
  if (deathTimer > 0) {
    deathTimer -= dt;
    if (deathTimer <= 0) onPlayerDeath();
    renderFrame();
    return;
  }

  // Update game logic
  updateDynamics(dt, levelData);
  const jumpPressed = consumeJump();
  updatePlayer(dt, levelData.platforms, jumpPressed);
  updateCamera(dt);

  // Combat: attack first so a kill removes the enemy before contact is checked.
  if (isAttack() && player.attackCD <= 0 && !player.dead) {
    const weapon = player.weapon;
    if (weapon.type === 'ranged') spawnProjectile(player, weapon);
    else playerMeleeAttack(player, weapon);
    player.attackCD = weapon.cooldown;
    player.swingT = player.swingDur;
  }
  updateProjectiles(dt, levelData.platforms);
  const enemyRes = updateEnemies(dt, levelData.platforms, player);

  const collected = updateEntities(dt, player, getMagnetRadius());
  if (collected > 0) {
    coinsThisLevel += collected;
    playerData.coins += collected;
    callbacks._lastCoins = coinsThisLevel;
    updateHUD(currentStage, currentLevel, coinsThisLevel, playerData.coins, lives);
  }

  // Check death (fell off bottom, touched a hazard, or hit by an enemy)
  if (player.y > GH + 100 || hazardHit(player, levelData.hazards) || enemyRes.playerHit) {
    deathTimer = 0.35;
  }

  // Check exit
  if (checkExit()) {
    onLevelComplete();
    return;
  }

  renderFrame();
}

function renderFrame() {
  ctx.clearRect(0, 0, GW, GH);

  // Background (screen space)
  drawBackground(ctx, GW, GH, camX, currentStage, gameTime);

  // World space
  ctx.save();
  ctx.translate(-Math.round(camX), 0);

  drawPlatforms(ctx, levelData.platforms, currentStage, gameTime);
  drawHazards(ctx, levelData.hazards, currentStage);
  drawEntities(ctx, camX, currentStage, gameTime);
  drawEnemies(ctx, camX, GW, gameTime);
  drawPlayer(ctx, gameTime);
  drawProjectiles(ctx, camX, GW);

  ctx.restore();

  // Death flash overlay
  if (deathTimer > 0) {
    ctx.fillStyle = `rgba(255,50,50,${deathTimer / 0.35 * 0.45})`;
    ctx.fillRect(0, 0, GW, GH);
  }
}

// Bootstrap
loadPlayerData();
initInput();

initUI(callbacks);

buildMainMenu(callbacks);
showScreen('main-menu');

requestAnimationFrame(gameLoop);
