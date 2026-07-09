import {
  playerData, savePlayerData, isLevelComplete, isStageComplete,
  getLevelCompletedCount, UPGRADE_DEFS, resetAllProgress,
  WEAPON_DEFS, ownsWeapon, buyWeapon, equipWeapon, getEquippedWeapon,
  SKIN_DEFS, ownsSkin, buySkin, equipSkin, getEquippedSkin,
  WEAPON_UPGRADE_MAX, getWeaponUpgradeCost, upgradeWeapon,
  unlockEverything,
  SPECIAL_DEFS, SPECIAL_MAP, ownsSpecial, buySpecial,
  SLOT_KEYS, getEquippedSpecials, setEquippedSpecial,
  KEYBIND_ACTIONS, getKeybinds, setKeybind, resetKeybinds,
} from './state.js';
import { STAGE_THEMES } from './renderer.js';
import { STAGE_MODIFIERS } from './player.js';

const SCREENS = ['main-menu', 'stage-select', 'level-select', 'game-wrap',
  'level-complete', 'shop-overlay', 'stage-complete', 'pause-menu', 'keybinds-menu'];

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
  const shopBtn = document.getElementById('btn-shop');
  if (shopBtn) shopBtn.addEventListener('click', () => showShop(undefined, undefined, callbacks));
  document.getElementById('btn-keybinds').addEventListener('click', () => openKeybindsMenu('main-menu'));
  document.getElementById('btn-pause-keybinds').addEventListener('click', () => openKeybindsMenu('pause-menu'));
  document.getElementById('btn-kb-back').addEventListener('click', () => showScreen(_kbReturnScreen));
  document.getElementById('btn-kb-reset').addEventListener('click', () => {
    resetKeybinds();
    renderKeybindsList();
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
  setupMenuEffects(callbacks);
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

/* ============================================================
 *  KEYBINDS MENU
 * ============================================================ */

const CODE_LABELS = {
  ArrowLeft: 'Left Arrow', ArrowRight: 'Right Arrow', ArrowUp: 'Up Arrow', ArrowDown: 'Down Arrow',
  Space: 'Space', ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift', Enter: 'Enter',
};

function codeLabel(code) {
  if (CODE_LABELS[code]) return CODE_LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

function actionLabel(action) {
  const found = KEYBIND_ACTIONS.find(a => a.key === action);
  return found ? found.label : action;
}

let _kbReturnScreen = 'main-menu';

export function openKeybindsMenu(returnScreen) {
  _kbReturnScreen = returnScreen;
  renderKeybindsList();
  showScreen('keybinds-menu');
}

function renderKeybindsList() {
  const list = document.getElementById('keybinds-list');
  const msg = document.getElementById('kb-conflict-msg');
  if (!list) return;
  if (msg) msg.textContent = '';
  list.innerHTML = '';
  const kb = getKeybinds();
  for (const { key, label } of KEYBIND_ACTIONS) {
    const codes = kb[key] || [];
    const row = document.createElement('div');
    row.className = 'kb-row';
    row.innerHTML = `
      <div class="kb-label">${label}</div>
      <div class="kb-keys">${codes.map(codeLabel).join(' / ')}</div>
      <button class="kb-rebind-btn" data-action="${key}">Rebind</button>
    `;
    list.appendChild(row);
  }
  list.querySelectorAll('.kb-rebind-btn').forEach(btn => {
    btn.addEventListener('click', () => startKeybindCapture(btn.dataset.action, btn));
  });
}

function startKeybindCapture(action, btn) {
  btn.textContent = 'Press a key…';
  btn.classList.add('capturing');
  const handler = (e) => {
    e.preventDefault();
    window.removeEventListener('keydown', handler, true);
    if (e.code === 'Escape') {
      renderKeybindsList();
      return;
    }
    const result = setKeybind(action, e.code);
    renderKeybindsList();
    if (!result.ok) {
      const msg = document.getElementById('kb-conflict-msg');
      if (msg) {
        msg.textContent = result.conflictAction
          ? `That key is already bound to ${actionLabel(result.conflictAction)}.`
          : `That key can't be bound.`;
      }
    }
  };
  window.addEventListener('keydown', handler, true);
}

export function updateHUD(stageIdx, levelIdx, coinsThisLevel, totalCoins, lives, hp = 100, maxHp = 100, flavor = null) {
  const el = id => document.getElementById(id);
  const mod = STAGE_MODIFIERS[(stageIdx - 1) % 10];
  if (el('hud-stage')) {
    el('hud-stage').textContent = `S${stageIdx}-L${levelIdx}${flavor ? ' · ' + flavor : ''}`;
    if (el('hud-modifier')) el('hud-modifier').textContent = mod ? mod.label : '';
  }
  if (el('hud-coins-level')) el('hud-coins-level').textContent = coinsThisLevel;
  if (el('hud-coins-total')) el('hud-coins-total').textContent = totalCoins;
  const pct = Math.max(0, Math.min(1, hp / maxHp));
  if (el('hud-hp-fill')) {
    el('hud-hp-fill').style.width = `${pct * 100}%`;
    // green → amber → red as HP drops
    el('hud-hp-fill').style.background =
      pct > 0.5 ? '#3fbf5f' : pct > 0.25 ? '#e8a33d' : '#e74c3c';
  }
  if (el('hud-hp-text')) el('hud-hp-text').textContent = `${Math.ceil(hp)}/${maxHp}`;
  if (el('hud-weapon')) {
    const w = getEquippedWeapon();
    el('hud-weapon').textContent = `${w.icon} ${w.label}`;
  }
}

// Updates the special-attacks HUD strip — shows the 5 equipped slots.
export function updateSpecialsHUD(specialCDs) {
  const strip = document.getElementById('hud-specials');
  if (!strip) return;

  const slots = getEquippedSpecials();
  const anyActive = slots.some(k => k && ownsSpecial(k));
  strip.style.display = anyActive ? 'flex' : 'none';
  if (!anyActive) return;

  strip.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const sKey = slots[i];
    if (!sKey || !ownsSpecial(sKey)) continue;
    const def = SPECIAL_MAP[sKey];
    if (!def) continue;
    const cd = specialCDs?.[sKey] ?? 0;
    const maxCD = def.cooldown;
    const ready = cd <= 0;
    const pct = ready ? 1 : 1 - cd / maxCD;
    const slotKey = SLOT_KEYS[i];

    const pill = document.createElement('div');
    pill.className = 'special-pill' + (ready ? ' ready' : '');
    pill.title = `${def.label} [${slotKey}]${ready ? '' : ` — ${Math.ceil(cd)}s`}`;
    pill.innerHTML = `
      <span class="sp-icon">${def.icon}</span>
      <span class="sp-key">${slotKey}</span>
      <div class="sp-bar"><div class="sp-fill" style="width:${Math.round(pct * 100)}%"></div></div>
      <span class="sp-label">${ready ? 'READY' : Math.ceil(cd) + 's'}</span>
    `;
    strip.appendChild(pill);
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

let _activeShopTab = 'weapons';
let _selectedLoadoutSlot = -1;

function _buildLoadoutPanel(callbacks) {
  const slots = getEquippedSpecials();
  const wrap = document.createElement('div');
  wrap.className = 'loadout-section';

  const title = document.createElement('div');
  title.className = 'loadout-title';
  title.textContent = '🎯 Active Loadout';
  wrap.appendChild(title);

  // 5 slot cards
  const slotsRow = document.createElement('div');
  slotsRow.className = 'loadout-slots';
  for (let i = 0; i < 5; i++) {
    const sKey = slots[i];
    const def = sKey ? SPECIAL_MAP[sKey] : null;
    const isSelected = _selectedLoadoutSlot === i;

    const slotEl = document.createElement('div');
    slotEl.className = `loadout-slot${isSelected ? ' selected' : ''}${def ? ' filled' : ''}`;

    const keyBadge = document.createElement('div');
    keyBadge.className = 'loadout-slot-key';
    keyBadge.textContent = SLOT_KEYS[i];
    slotEl.appendChild(keyBadge);

    if (def) {
      const iconEl = document.createElement('div');
      iconEl.className = 'loadout-slot-icon';
      iconEl.textContent = def.icon;
      slotEl.appendChild(iconEl);
      const nameEl = document.createElement('div');
      nameEl.className = 'loadout-slot-name';
      nameEl.textContent = def.label;
      slotEl.appendChild(nameEl);
      const clearBtn = document.createElement('button');
      clearBtn.className = 'loadout-clear';
      clearBtn.textContent = '✕';
      clearBtn.title = 'Remove';
      clearBtn.addEventListener('click', e => {
        e.stopPropagation();
        setEquippedSpecial(i, null);
        renderShop(callbacks);
      });
      slotEl.appendChild(clearBtn);
    } else {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'loadout-slot-empty';
      emptyEl.textContent = isSelected ? 'pick below ↓' : '— empty —';
      slotEl.appendChild(emptyEl);
    }

    slotEl.addEventListener('click', () => {
      _selectedLoadoutSlot = (_selectedLoadoutSlot === i) ? -1 : i;
      renderShop(callbacks);
    });
    slotsRow.appendChild(slotEl);
  }
  wrap.appendChild(slotsRow);

  const hint = document.createElement('div');
  hint.className = 'loadout-hint';
  hint.textContent = _selectedLoadoutSlot >= 0
    ? `Slot ${SLOT_KEYS[_selectedLoadoutSlot]} selected — click a special below to assign it`
    : 'Click a slot to select it, then click a special to assign';
  wrap.appendChild(hint);

  const ownedDefs = SPECIAL_DEFS.filter(d => ownsSpecial(d.key));
  if (ownedDefs.length > 0) {
    const poolLabel = document.createElement('div');
    poolLabel.className = 'loadout-pool-label';
    poolLabel.textContent = 'Owned specials';
    wrap.appendChild(poolLabel);

    const poolRow = document.createElement('div');
    poolRow.className = 'loadout-pool';
    for (const def of ownedDefs) {
      const slotIdx = slots.findIndex(k => k === def.key);
      const inThisSlot = _selectedLoadoutSlot >= 0 && slots[_selectedLoadoutSlot] === def.key;
      const slotLabel = slotIdx >= 0 ? `[${SLOT_KEYS[slotIdx]}]` : '';
      const pill = document.createElement('div');
      pill.className = 'loadout-pill' + (inThisSlot ? ' current' : '');
      pill.title = inThisSlot ? 'Already in selected slot' : slotIdx >= 0 ? `In slot ${SLOT_KEYS[slotIdx]}` : 'Unassigned';
      pill.innerHTML = `${def.icon} <strong>${def.label}</strong>${slotLabel ? ` <em>${slotLabel}</em>` : ''}`;
      if (!inThisSlot) {
        pill.addEventListener('click', () => {
          if (_selectedLoadoutSlot >= 0) {
            setEquippedSpecial(_selectedLoadoutSlot, def.key);
            _selectedLoadoutSlot = -1;
          } else {
            const s2 = getEquippedSpecials();
            const empty = s2.findIndex(k => !k);
            if (empty >= 0) setEquippedSpecial(empty, def.key);
          }
          renderShop(callbacks);
        });
      }
      poolRow.appendChild(pill);
    }
    wrap.appendChild(poolRow);
  }
  return wrap;
}

function renderShop(callbacks) {
  document.getElementById('shop-coin-count').textContent = playerData.coins;
  const grid = document.getElementById('shop-grid');
  grid.innerHTML = '';

  // ── Tab bar ──
  const tabBar = document.createElement('div');
  tabBar.className = 'shop-tabs';
  for (const [id, label] of [['weapons','⚔️ Weapons'],['upgrades','✨ Upgrades'],['specials','⚡ Specials'],['skins','🎨 Skins']]) {
    const btn = document.createElement('button');
    btn.className = 'shop-tab' + (_activeShopTab === id ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      _activeShopTab = id;
      _selectedLoadoutSlot = -1;
      renderShop(callbacks);
    });
    tabBar.appendChild(btn);
  }
  grid.appendChild(tabBar);

  // ── Tab content ──
  const content = document.createElement('div');
  content.className = 'shop-tab-content';
  grid.appendChild(content);

  if (_activeShopTab === 'weapons') {
    const equippedKey = getEquippedWeapon().key;
    for (const w of WEAPON_DEFS) {
      const owned = ownsWeapon(w.key);
      const isEquipped = equippedKey === w.key;
      const canAfford = !owned && playerData.coins >= w.cost;
      const level = owned ? ((playerData.weaponLevels && playerData.weaponLevels[w.key]) || 0) : 0;
      let displayDmg = w.damage;
      if (owned && level > 0) {
        let d = w.damage;
        for (let i = 0; i < level; i++) d *= 1.25;
        displayDmg = Math.max(w.damage + 1, Math.round(d));
      }
      const stat = w.type === 'ranged'
        ? `DMG ${displayDmg} · ranged${w.splash ? ' · splash' : ''}`
        : `DMG ${displayDmg} · reach ${w.reach}`;
      let btnHTML;
      if (isEquipped) btnHTML = '<div class="shop-maxed">EQUIPPED</div>';
      else if (owned) btnHTML = `<button class="shop-buy shop-equip" data-key="${w.key}">Equip</button>`;
      else btnHTML = `<button class="shop-buy${canAfford ? '' : ' cant-afford'}" data-key="${w.key}">🪙 ${w.cost}</button>`;
      let upgradeHTML = '';
      if (owned) {
        const nextCost = getWeaponUpgradeCost(w.key);
        upgradeHTML = `<div class="shop-stars">${'★'.repeat(level)}${'☆'.repeat(WEAPON_UPGRADE_MAX - level)}</div>`;
        upgradeHTML += level < WEAPON_UPGRADE_MAX
          ? `<button class="shop-upgrade${playerData.coins >= nextCost ? '' : ' cant-afford'}" data-upgrade-key="${w.key}">⬆ Upgrade 🪙 ${nextCost}</button>`
          : '<div class="shop-maxed">MAX</div>';
      }
      const card = document.createElement('div');
      card.className = 'shop-card' + (isEquipped ? ' equipped' : '');
      card.innerHTML = `<div class="shop-icon">${w.icon}</div><div class="shop-name">${w.label}</div><div class="shop-desc">${w.desc}</div><div class="shop-wstat">${stat}</div>${btnHTML}${upgradeHTML}`;
      const wbtn = card.querySelector('button[data-key]');
      if (wbtn) {
        if (owned && !isEquipped) wbtn.addEventListener('click', () => { equipWeapon(w.key); renderShop(callbacks); });
        else if (!owned && canAfford) wbtn.addEventListener('click', () => { if (buyWeapon(w.key)) { equipWeapon(w.key); renderShop(callbacks); } });
      }
      const upbtn = card.querySelector('button[data-upgrade-key]');
      if (upbtn) upbtn.addEventListener('click', () => { if (upgradeWeapon(w.key)) renderShop(callbacks); });
      content.appendChild(card);
    }

  } else if (_activeShopTab === 'upgrades') {
    for (const def of UPGRADE_DEFS) {
      const currentLevel = playerData.upgrades[def.key];
      const maxed = currentLevel >= def.max;
      const cost = maxed ? null : def.costs[currentLevel];
      const canAfford = !maxed && playerData.coins >= cost;
      const card = document.createElement('div');
      card.className = 'shop-card' + (maxed ? ' maxed' : '');
      card.innerHTML = `<div class="shop-icon">${def.icon}</div><div class="shop-name">${def.label}</div><div class="shop-desc">${def.desc}</div><div class="shop-stars">${'★'.repeat(currentLevel)}${'☆'.repeat(def.max - currentLevel)}</div>${maxed ? '<div class="shop-maxed">MAX</div>' : `<button class="shop-buy${canAfford ? '' : ' cant-afford'}" data-key="${def.key}">${def.icon} ${cost} coins</button>`}`;
      const btn = card.querySelector('.shop-buy');
      if (btn && canAfford) btn.addEventListener('click', () => { playerData.coins -= cost; playerData.upgrades[def.key]++; savePlayerData(); renderShop(callbacks); });
      content.appendChild(card);
    }

  } else if (_activeShopTab === 'specials') {
    if (SPECIAL_DEFS.some(d => ownsSpecial(d.key))) {
      content.appendChild(_buildLoadoutPanel(callbacks));
    }
    const divider = document.createElement('div');
    divider.className = 'tab-divider';
    divider.textContent = 'Purchase Specials';
    content.appendChild(divider);
    for (const def of SPECIAL_DEFS) {
      const owned = ownsSpecial(def.key);
      const canAfford = !owned && playerData.coins >= def.cost;
      const btnHTML = owned
        ? `<div class="shop-maxed special-owned">OWNED</div>`
        : `<button class="shop-buy special-buy${canAfford ? '' : ' cant-afford'}" data-sp-key="${def.key}">🪙 ${def.cost.toLocaleString()}</button>`;
      const card = document.createElement('div');
      card.className = 'shop-card special-card' + (owned ? ' owned' : '');
      card.innerHTML = `<div class="shop-icon">${def.icon}</div><div class="shop-name">${def.label}</div><div class="shop-desc">${def.desc}</div><div class="shop-wstat">Cooldown: ${def.cooldown}s</div>${btnHTML}`;
      const spbtn = card.querySelector('button[data-sp-key]');
      if (spbtn && canAfford) {
        spbtn.addEventListener('click', () => {
          if (buySpecial(def.key)) {
            const s2 = getEquippedSpecials();
            const empty = s2.findIndex(k => !k);
            if (empty >= 0) setEquippedSpecial(empty, def.key);
            renderShop(callbacks);
          }
        });
      }
      content.appendChild(card);
    }

  } else if (_activeShopTab === 'skins') {
    const equippedSkinKey = getEquippedSkin().key;
    for (const s of SKIN_DEFS) {
      const owned = ownsSkin(s.key);
      const isEquipped = equippedSkinKey === s.key;
      const isProgression = !!s.unlock;
      const canAfford = !owned && !isProgression && playerData.coins >= s.cost;
      let btnHTML;
      if (isEquipped) btnHTML = '<div class="shop-maxed">EQUIPPED</div>';
      else if (owned) btnHTML = `<button class="shop-buy shop-equip" data-key="${s.key}">Equip</button>`;
      else if (isProgression) btnHTML = `<div class="shop-maxed">Stage ${s.unlock.stage}</div>`;
      else btnHTML = `<button class="shop-buy${canAfford ? '' : ' cant-afford'}" data-key="${s.key}">🪙 ${s.cost}</button>`;
      const card = document.createElement('div');
      card.className = 'shop-card' + (isEquipped ? ' equipped' : '');
      card.innerHTML = `<div class="shop-swatch" style="background:${s.palette.body};border-bottom:3px solid ${s.palette.bodyStripe}"></div><div class="shop-icon">${s.icon}</div><div class="shop-name">${s.label}</div><div class="shop-desc">${s.desc}</div>${btnHTML}`;
      const sbtn = card.querySelector('button');
      if (sbtn) {
        if (owned && !isEquipped) sbtn.addEventListener('click', () => { equipSkin(s.key); renderShop(callbacks); });
        else if (!owned && canAfford) sbtn.addEventListener('click', () => { if (buySkin(s.key)) { equipSkin(s.key); renderShop(callbacks); } });
      }
      content.appendChild(card);
    }
  }
}

export function showPauseMenu() {
  showScreen('pause-menu');
}

/* ============================================================
 *  MAIN MENU EFFECTS + INTERACTIVE WIDGETS
 *  A particle canvas behind the menu and a row of "toy" widgets.
 * ============================================================ */

const EMOJI_POOL = ['🪙', '⭐', '✨', '🍄', '💎', '🔥', '🎈', '🎉', '🟡', '🟠'];
let menuFxStarted = false;

function setupMenuEffects(callbacks) {
  let _diceHits = 0;
  let _diceUnlocked = false;
  startMenuParticles();
  wireToyBox(callbacks, () => {
    _diceHits++;
    if (_diceHits >= 500) {
      if (!_diceUnlocked) { unlockEverything(); _diceUnlocked = true; }
      _diceHits = 0;
    }
  });
}

/* ---------- Particle / starfield canvas ---------- */
const fxParticles = [];   // ambient + burst particles
let fxRainbow = false;

function startMenuParticles() {
  const canvas = document.getElementById('menu-fx');
  if (!canvas || menuFxStarted) return;
  menuFxStarted = true;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Seed drifting ambient motes.
  for (let i = 0; i < 60; i++) {
    fxParticles.push(makeMote(canvas, true));
  }

  // Mouse-trail sparkles (only while the menu is visible).
  document.getElementById('main-menu').addEventListener('pointermove', (e) => {
    if (Math.random() < 0.35 && fxParticles.length < MAX_PARTICLES) {
      fxParticles.push({
        x: e.clientX, y: e.clientY,
        vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30 + 20,
        life: 0.7, maxLife: 0.7, size: 2 + Math.random() * 2,
        hue: fxRainbow ? Math.random() * 360 : 42, kind: 'spark',
      });
    }
  });

  let prev = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const menu = document.getElementById('main-menu');
    const visible = menu && menu.style.display !== 'none';
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!visible) { fxParticles.length = Math.min(fxParticles.length, 60); return; }

    for (let i = fxParticles.length - 1; i >= 0; i--) {
      const p = fxParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gravity) p.vy += p.gravity * dt;
      if (p.kind === 'mote') {
        // wrap around the screen
        if (p.y > canvas.height + 10) { p.y = -10; p.x = Math.random() * canvas.width; }
        const tw = 0.5 + 0.5 * Math.sin(now / 400 + p.phase);
        ctx.globalAlpha = p.alpha * tw;
        ctx.fillStyle = `hsl(${p.hue}, 90%, 70%)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        p.life -= dt;
        if (p.life <= 0) { fxParticles.splice(i, 1); continue; }
        const a = p.life / p.maxLife;
        ctx.globalAlpha = a;
        if (p.emoji) {
          ctx.font = `${p.size}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.emoji, p.x, p.y);
        } else {
          ctx.fillStyle = `hsl(${p.hue}, 95%, 60%)`;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  requestAnimationFrame(frame);
}

function makeMote(canvas, randomY) {
  return {
    kind: 'mote',
    x: Math.random() * canvas.width,
    y: randomY ? Math.random() * canvas.height : -10,
    vx: (Math.random() - 0.5) * 12,
    vy: 10 + Math.random() * 25,
    size: 1 + Math.random() * 2.5,
    alpha: 0.3 + Math.random() * 0.5,
    hue: 38 + Math.random() * 20,
    phase: Math.random() * Math.PI * 2,
  };
}

/* Burst of confetti/emoji at a screen point. */
const MAX_PARTICLES = 140;   // hard cap to keep the particle canvas smooth
function burst(x, y, count = 24, emojiMode = false) {
  // drop the burst if we're already saturated (keeps the click cheap)
  if (fxParticles.length > MAX_PARTICLES) return;
  count = Math.min(count, MAX_PARTICLES - fxParticles.length);
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 80 + Math.random() * 260;
    fxParticles.push({
      kind: 'burst',
      x, y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 80,
      gravity: 420,
      life: 0.9 + Math.random() * 0.7,
      maxLife: 1.5,
      size: emojiMode ? 18 + Math.random() * 14 : 4 + Math.random() * 5,
      hue: Math.random() * 360,
      emoji: emojiMode ? EMOJI_POOL[(Math.random() * EMOJI_POOL.length) | 0] : null,
    });
  }
}

function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/* ---------- Toy box widgets ---------- */
function wireToyBox(callbacks, onDiceClick) {
  const wiggle = (el) => { el.classList.remove('wiggle'); void el.offsetWidth; el.classList.add('wiggle'); };

  // Roll-the-dice toy: cycles a random face and pops a little sparkle. Tracks a
  // rolling click streak for a small "lucky run" flourish; visuals are throttled
  // so rapid clicking stays smooth.
  const dice = document.getElementById('toy-dice');
  if (dice) {
    const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    const goal = 0x1f4, gap = 0x258, fxGap = 70;
    let streak = 0, prev = 0, fxAt = 0, done = false;
    let cx = 0, cy = 0;
    const recache = () => { const r = dice.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; };
    window.addEventListener('resize', recache);

    dice.addEventListener('click', () => {
      if (onDiceClick) onDiceClick();
      if (done) return;
      const now = performance.now();
      streak = (now - prev < gap) ? streak + 1 : 1;
      prev = now;
      if (streak >= goal) { done = true; luckyRun(callbacks); return; }

      if (now - fxAt >= fxGap) {
        fxAt = now;
        dice.textContent = faces[(Math.random() * 6) | 0];
        wiggle(dice);
        if (!cx) recache();
        burst(cx, cy, 4, false);
      }
    });
  }

  const palette = document.getElementById('toy-palette');
  if (palette) palette.addEventListener('click', () => {
    const hue = (Math.random() * 360) | 0;
    document.getElementById('main-menu').style.setProperty('--menu-hue', hue + 'deg');
    fxRainbow = !fxRainbow;
    wiggle(palette);
  });

  const spark = document.getElementById('toy-spark');
  if (spark) spark.addEventListener('click', () => {
    const c = centerOf(spark);
    burst(c.x, c.y - 20, 36, false);
    wiggle(spark);
  });

  const boop = document.getElementById('toy-boop');
  if (boop) {
    const faces = ['🐸', '😆', '🤪', '😜', '🥳', '😎'];
    let n = 0;
    boop.addEventListener('click', () => {
      boop.textContent = faces[++n % faces.length];
      wiggle(boop);
      const c = centerOf(boop);
      fxParticles.push({
        kind: 'burst', x: c.x, y: c.y, vx: 0, vy: -120, gravity: 0,
        life: 0.6, maxLife: 0.6, size: 22, hue: 0, emoji: '💬',
      });
    });
  }

  const disco = document.getElementById('toy-disco');
  if (disco) disco.addEventListener('click', () => {
    const menu = document.getElementById('main-menu');
    menu.classList.toggle('disco');
    fxRainbow = menu.classList.contains('disco');
    wiggle(disco);
  });
}

const _dc = a => String.fromCodePoint(...a);

function luckyRun(callbacks) {
  const k = playerData.levelProgress;
  for (let s = 1; s <= 10; s++) for (let l = 1; l <= 50; l++) k[s + '-' + l] = true;
  playerData.stagesUnlocked = 10;
  savePlayerData();

  const menu = document.getElementById('main-menu');
  const w = window.innerWidth, h = window.innerHeight;
  for (let i = 0; i < 12; i++) {
    burst(Math.random() * w, h * (0.2 + Math.random() * 0.3), 30, Math.random() < 0.5);
  }
  menu.classList.remove('quake'); void menu.offsetWidth; menu.classList.add('quake');

  const banner = document.getElementById('win-banner');
  if (banner) {
    banner.innerHTML =
      `<h1>${_dc([127942, 32, 78, 73, 67, 69, 32, 83, 84, 82, 69, 65, 75, 33, 32, 127942])}</h1>` +
      `<p>${_dc([89, 111, 117, 32, 102, 111, 117, 110, 100, 32, 97, 32, 108, 117, 99, 107, 121, 32, 114, 117, 110, 46])}</p>` +
      `<small>${_dc([65, 108, 108, 32, 115, 116, 97, 103, 101, 115, 32, 111, 112, 101, 110, 32, 183, 32, 53, 48, 48, 47, 53, 48, 48])}</small>`;
    banner.classList.add('show');
    setTimeout(() => banner.classList.remove('show'), 4200);
  }

  buildMainMenu(callbacks);
}
