import {
  playerData, savePlayerData, isLevelComplete, isStageComplete,
  getLevelCompletedCount, UPGRADE_DEFS, resetAllProgress,
} from './state.js';
import { STAGE_THEMES } from './renderer.js';

const SCREENS = ['main-menu', 'stage-select', 'level-select', 'game-wrap',
  'level-complete', 'shop-overlay', 'stage-complete', 'pause-menu'];

export function showScreen(id) {
  for (const s of SCREENS) {
    const el = document.getElementById(s);
    if (el) el.style.display = (s === id) ? 'flex' : 'none';
  }
}

export function initUI(callbacks) {
  // Main menu buttons
  document.getElementById('btn-play').addEventListener('click', () => callbacks.onPlay());
  document.getElementById('btn-stage-select').addEventListener('click', () => {
    buildStageSelect(callbacks);
    showScreen('stage-select');
  });
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('Reset ALL progress? This cannot be undone.')) {
      resetAllProgress();
      buildMainMenu(callbacks);
      showScreen('main-menu');
    }
  });

  // Back buttons
  document.getElementById('btn-ss-back').addEventListener('click', () => showScreen('main-menu'));
  document.getElementById('btn-ls-back').addEventListener('click', () => {
    buildStageSelect(callbacks);
    showScreen('stage-select');
  });
  document.getElementById('btn-resume').addEventListener('click', () => {
    showScreen('game-wrap');
    if (callbacks.onResume) callbacks.onResume();
  });
  document.getElementById('btn-pause-menu').addEventListener('click', () => {
    showScreen('main-menu');
    if (callbacks.onQuitToMenu) callbacks.onQuitToMenu();
  });

  buildMainMenu(callbacks);
}

export function buildMainMenu(callbacks) {
  // Find the best stage/level to continue from
  let continueStage = 1, continueLevel = 1;
  outer:
  for (let s = 1; s <= 10; s++) {
    for (let l = 1; l <= 50; l++) {
      if (!isLevelComplete(s, l)) {
        continueStage = s;
        continueLevel = l;
        break outer;
      }
    }
  }
  const btn = document.getElementById('btn-play');
  btn.textContent = `▶ Play — Stage ${continueStage}, Level ${continueLevel}`;
  btn.dataset.stage = continueStage;
  btn.dataset.level = continueLevel;
}

export function buildStageSelect(callbacks) {
  const grid = document.getElementById('stage-grid');
  grid.innerHTML = '';
  for (let s = 1; s <= 10; s++) {
    const locked = s > playerData.stagesUnlocked;
    const completed = isStageComplete(s);
    const count = getLevelCompletedCount(s);
    const theme = STAGE_THEMES[s - 1];

    const card = document.createElement('div');
    card.className = 'ss-card' + (locked ? ' locked' : '') + (completed ? ' completed' : '');
    card.style.setProperty('--accent', theme.accentColor);
    card.innerHTML = `
      <div class="ss-num">${locked ? '🔒' : s}</div>
      <div class="ss-name">${theme.name}</div>
      <div class="ss-progress">${count}/50</div>
      ${completed ? '<div class="ss-complete">✓</div>' : ''}
    `;
    if (!locked) {
      card.addEventListener('click', () => {
        buildLevelSelect(s, callbacks);
        showScreen('level-select');
      });
    }
    grid.appendChild(card);
  }
}

export function buildLevelSelect(stageIdx, callbacks) {
  const theme = STAGE_THEMES[stageIdx - 1];
  document.getElementById('ls-title').textContent = `Stage ${stageIdx}: ${theme.name}`;
  document.getElementById('ls-title').style.color = theme.accentColor;
  document.getElementById('ls-back-label').textContent = `← Stage Select`;

  const grid = document.getElementById('level-grid');
  grid.innerHTML = '';

  for (let l = 1; l <= 50; l++) {
    const done = isLevelComplete(stageIdx, l);
    const btn = document.createElement('button');
    btn.className = 'ls-level' + (done ? ' done' : '');
    btn.textContent = l;
    btn.title = done ? `Level ${l} — Complete ✓` : `Level ${l}`;
    btn.style.setProperty('--accent', theme.accentColor);
    btn.addEventListener('click', () => {
      callbacks.onStartLevel(stageIdx, l);
    });
    grid.appendChild(btn);
  }
}

export function updateHUD(stageIdx, levelIdx, coinsThisLevel, totalCoins, lives) {
  const el = id => document.getElementById(id);
  if (el('hud-stage')) el('hud-stage').textContent = `S${stageIdx}-L${levelIdx}`;
  if (el('hud-coins-level')) el('hud-coins-level').textContent = coinsThisLevel;
  if (el('hud-coins-total')) el('hud-coins-total').textContent = totalCoins;
  if (el('hud-lives')) {
    el('hud-lives').textContent = '♥'.repeat(Math.max(0, lives));
  }
}

export function showLevelComplete(stageIdx, levelIdx, coinsThisLevel, totalCoins, callbacks) {
  showScreen('level-complete');
  document.getElementById('lc-heading').textContent = 'Level Complete!';
  document.getElementById('lc-level').textContent = `Stage ${stageIdx} — Level ${levelIdx}`;
  document.getElementById('lc-coins-earned').textContent = `+${coinsThisLevel} coins`;
  document.getElementById('lc-coins-total').textContent = `Total: ${totalCoins} coins`;

  // Determine next level
  const nextLevel = levelIdx < 50 ? levelIdx + 1 : null;
  const nextStage = !nextLevel && stageIdx < 10 ? stageIdx + 1 : null;

  const btnNext = document.getElementById('btn-lc-next');
  if (nextLevel) {
    btnNext.textContent = `Next Level →`;
    btnNext.onclick = () => callbacks.onStartLevel(stageIdx, nextLevel);
  } else if (nextStage) {
    btnNext.textContent = `Next Stage →`;
    btnNext.onclick = () => callbacks.onStartLevel(nextStage, 1);
  } else {
    btnNext.textContent = `You Win! 🏆`;
    btnNext.onclick = () => showScreen('main-menu');
  }

  document.getElementById('btn-lc-shop').onclick = () => showShop(stageIdx, levelIdx, callbacks);
  document.getElementById('btn-lc-menu').onclick = () => {
    showScreen('main-menu');
    if (callbacks.onQuitToMenu) callbacks.onQuitToMenu();
  };
}

export function showStageComplete(stageIdx, callbacks) {
  showScreen('stage-complete');
  document.getElementById('sc-stage').textContent = `Stage ${stageIdx} Complete!`;
  const theme = STAGE_THEMES[stageIdx - 1];
  document.getElementById('sc-name').textContent = theme.name;
  if (stageIdx < 10) {
    const nextTheme = STAGE_THEMES[stageIdx];
    document.getElementById('sc-next').textContent = `Unlocked: Stage ${stageIdx + 1} — ${nextTheme.name}`;
  } else {
    document.getElementById('sc-next').textContent = 'All stages complete! You are a platforming legend!';
  }
  document.getElementById('btn-sc-next').onclick = () => {
    if (stageIdx < 10) callbacks.onStartLevel(stageIdx + 1, 1);
    else showScreen('main-menu');
  };
  document.getElementById('btn-sc-menu').onclick = () => showScreen('main-menu');
}

export function showShop(stageIdx, levelIdx, callbacks) {
  showScreen('shop-overlay');
  renderShop(callbacks);

  const afterClose = levelIdx !== undefined
    ? () => showLevelComplete(stageIdx, levelIdx, callbacks._lastCoins, playerData.coins, callbacks)
    : () => showScreen('main-menu');

  document.getElementById('btn-shop-close').onclick = () => afterClose();
}

function renderShop(callbacks) {
  document.getElementById('shop-coin-count').textContent = playerData.coins;
  const grid = document.getElementById('shop-grid');
  grid.innerHTML = '';

  for (const def of UPGRADE_DEFS) {
    const currentLevel = playerData.upgrades[def.key];
    const maxed = currentLevel >= def.max;
    const cost = maxed ? null : def.costs[currentLevel];
    const canAfford = !maxed && playerData.coins >= cost;

    const card = document.createElement('div');
    card.className = 'shop-card' + (maxed ? ' maxed' : '');
    card.innerHTML = `
      <div class="shop-icon">${def.icon}</div>
      <div class="shop-name">${def.label}</div>
      <div class="shop-desc">${def.desc}</div>
      <div class="shop-stars">${'★'.repeat(currentLevel)}${'☆'.repeat(def.max - currentLevel)}</div>
      ${maxed
        ? '<div class="shop-maxed">MAX</div>'
        : `<button class="shop-buy${canAfford ? '' : ' cant-afford'}" data-key="${def.key}">
            ${def.icon} ${cost} coins
           </button>`}
    `;
    const btn = card.querySelector('.shop-buy');
    if (btn && canAfford) {
      btn.addEventListener('click', () => {
        playerData.coins -= cost;
        playerData.upgrades[def.key]++;
        savePlayerData();
        renderShop(callbacks);
      });
    }
    grid.appendChild(card);
  }
}

export function showPauseMenu() {
  showScreen('pause-menu');
}
