const SAVE_KEY = 'platformer_save';

const DEFAULT = {
  coins: 0,
  upgrades: { jump: 0, speed: 0, magnet: 0, djBoost: 0, lives: 0 },
  stagesUnlocked: 1,
  levelProgress: {},
};

export let playerData = JSON.parse(JSON.stringify(DEFAULT));

export function loadPlayerData() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    playerData = { ...DEFAULT, ...saved };
    playerData.upgrades = { ...DEFAULT.upgrades, ...(saved.upgrades || {}) };
  } catch {}
}

export function savePlayerData() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(playerData)); } catch {}
}

export function resetAllProgress() {
  playerData = JSON.parse(JSON.stringify(DEFAULT));
  savePlayerData();
}

export function isLevelComplete(stage, level) {
  return !!playerData.levelProgress[`${stage}-${level}`];
}

export function isStageComplete(stage) {
  for (let l = 1; l <= 50; l++) {
    if (!playerData.levelProgress[`${stage}-${l}`]) return false;
  }
  return true;
}

export function markLevelComplete(stage, level) {
  playerData.levelProgress[`${stage}-${level}`] = true;
  if (isStageComplete(stage) && stage < 10) {
    playerData.stagesUnlocked = Math.max(playerData.stagesUnlocked, stage + 1);
  }
  savePlayerData();
}

export const UPGRADE_DEFS = [
  {
    key: 'jump', label: 'Jump Boost', max: 5,
    costs: [30, 50, 80, 120, 180],
    desc: '+8% jump height per level', icon: '↑',
  },
  {
    key: 'speed', label: 'Speed Boots', max: 5,
    costs: [25, 40, 65, 100, 150],
    desc: '+10% move speed per level', icon: '⚡',
  },
  {
    key: 'magnet', label: 'Coin Magnet', max: 3,
    costs: [50, 100, 200],
    desc: 'Larger coin attraction radius', icon: '◎',
  },
  {
    key: 'djBoost', label: 'DJ Boost', max: 3,
    costs: [40, 80, 160],
    desc: '+10% double-jump force per level', icon: '✦',
  },
  {
    key: 'lives', label: 'Extra Lives', max: 3,
    costs: [80, 160, 320],
    desc: 'Start each level with more lives', icon: '♥',
  },
];

export function getMagnetRadius() {
  const radii = [20, 45, 70, 100];
  return radii[playerData.upgrades.magnet] || 20;
}

export function getStartLives() {
  return 2 + playerData.upgrades.lives;
}

export function getJumpMult() {
  return 1 + playerData.upgrades.jump * 0.08;
}

export function getDJMult() {
  return 1 + playerData.upgrades.djBoost * 0.10;
}

export function getSpeedMult() {
  return 1 + playerData.upgrades.speed * 0.10;
}

export function getLevelCompletedCount(stage) {
  let count = 0;
  for (let l = 1; l <= 50; l++) {
    if (playerData.levelProgress[`${stage}-${l}`]) count++;
  }
  return count;
}
