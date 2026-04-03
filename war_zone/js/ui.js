// Screen management, shop, loadout, HUD, overlays, cheats

import { WEAPONS, EQUIPMENT, ATTACHMENTS, MAPS } from './data.js';
import { playerData, playerState, savePlayerData, gameState, xpToNextLevel, setAwardXPImpl } from './state.js';
import { cb } from './callbacks.js';

// Wire up level-up notification (avoids circular dep: state -> ui)
setAwardXPImpl((didLevelUp) => {
    if (didLevelUp) addKillFeed(`LEVEL UP! Now LVL ${playerData.level} (+5 stat pts)`, '#ffdd00');
    updateHUD();
});

// --- Screen Management ---

export function showScreen(id) {
    ['homepage', 'shop-screen', 'loadout-screen', 'map-screen'].forEach(s => {
        const el = document.getElementById(s);
        if (s === id) {
            el.style.display = (s === 'shop-screen' || s === 'loadout-screen') ? 'block' : 'flex';
        } else {
            el.style.display = 'none';
        }
    });
    if (id === 'homepage') updateHomeStats();
}
window.showScreen = showScreen;

export function updateHomeStats() {
    document.getElementById('home-money').textContent = '$' + playerData.money;
    document.getElementById('home-missions').textContent = playerData.missions;
    document.getElementById('home-level').textContent = playerData.level;
    if (playerData.airstrikes > 0) {
        document.getElementById('home-missions').innerHTML += `<br>Airstrikes: <span style="color:#ff4444">${playerData.airstrikes}</span>`;
    }
}

// --- Shop ---

export function showShop() {
    showScreen('shop-screen');
    document.getElementById('shop-money').textContent = '$' + playerData.money;
    renderWeaponShop();
    renderEquipmentShop();
    renderAttachmentShop();
}
window.showShop = showShop;

function renderWeaponShop() {
    const grid = document.getElementById('weapon-shop');
    grid.innerHTML = '';
    for (const [id, w] of Object.entries(WEAPONS)) {
        if (w.starter) continue;
        const owned = playerData.ownedWeapons.includes(id);
        const needsRepair = (playerData.weaponUsage[id] || 0) >= 5;
        let statsHtml = `Damage: ${w.damage}`;
        if (w.zoomedDamage) statsHtml += ` (${w.zoomedDamage} zoomed)`;
        statsHtml += `<br>Range: ${w.range}`;
        if (w.type === 'gun' || w.type === 'throwable') statsHtml += `<br>Ammo: ${w.maxAmmo} | Reload: ${w.reloadTime}s`;
        statsHtml += `<br>Fire rate: ${w.fireRate}s`;

        const item = document.createElement('div');
        item.className = 'shop-item';
        item.innerHTML = `
            <h3>${w.name}</h3>
            <div class="price">$${w.cost}</div>
            <div class="stats">${statsHtml}</div>
            <button class="buy-btn ${owned ? 'owned' : ''}" ${owned ? 'disabled' : ''} onclick="buyWeapon('${id}')">${owned ? 'OWNED' : 'BUY'}</button>
            ${owned && needsRepair ? `<button class="repair-btn" onclick="repairWeapon('${id}')">Repair ($50)</button>` : ''}
        `;
        grid.appendChild(item);
    }
}

function renderEquipmentShop() {
    const grid = document.getElementById('equipment-shop');
    grid.innerHTML = '';

    const sections = [
        { title: 'Helmets', filter: e => e.type === 'head' },
        { title: 'Breastplates', filter: e => e.type === 'armor' },
        { title: 'Pants', filter: e => e.type === 'pants' },
        { title: 'Boots', filter: e => e.type === 'boots' },
        { title: 'Consumables', filter: e => e.type === 'consumable' }
    ];

    for (const { title, filter } of sections) {
        const entries = Object.entries(EQUIPMENT).filter(([, e]) => filter(e));
        if (entries.length === 0) continue;
        const header = document.createElement('h4');
        header.style.cssText = 'color:#ffaa00;width:100%;margin:18px 0 8px;font-size:18px;';
        header.textContent = title;
        grid.appendChild(header);
        for (const [id, e] of entries) {
            let desc = '';
            if (e.armor) desc += `Armor: +${e.armor}<br>`;
            if (e.damageReduction) desc += `Damage Reduction: ${e.damageReduction * 100}%<br>`;
            if (e.headshotReduction) desc += `Headshot Reduction: ${e.headshotReduction * 100}%<br>`;
            if (e.hpRestore) desc += `Restores ${e.hpRestore} HP<br>`;
            if (e.hpBoost) desc += `+${e.hpBoost} Temp HP<br>`;
            if (e.airstrikes) desc += `Press F to kill all zombies (+${e.airstrikes} use)<br>`;
            const item = document.createElement('div');
            item.className = 'shop-item';
            item.innerHTML = `
                <h3>${e.name}</h3><div class="price">$${e.cost}</div>
                <div class="stats">${desc}</div>
                <button class="buy-btn" onclick="buyEquipment('${id}')">BUY</button>
            `;
            grid.appendChild(item);
        }
    }
}

function renderAttachmentShop() {
    const grid = document.getElementById('attachment-shop');
    grid.innerHTML = '';
    for (const [id, a] of Object.entries(ATTACHMENTS)) {
        const eligible = playerData.ownedWeapons.filter(wid => {
            const w = WEAPONS[wid];
            if (w.type !== 'gun') return false;
            if (id === 'scope' && w.hasScope) return false;
            return !(playerData.weaponAttachments[wid] || []).includes(id);
        });
        const item = document.createElement('div');
        item.className = 'shop-item';
        const canAfford = playerData.money >= a.cost;
        const weaponBtns = eligible.length > 0 && canAfford
            ? eligible.map(wid => `<button class="buy-btn" style="font-size:11px;margin:2px" onclick="attachToWeapon('${id}','${wid}')">Attach to ${WEAPONS[wid].name}</button>`).join('')
            : eligible.length === 0 ? '<div style="color:#888;font-size:11px">No eligible weapons</div>'
                : '<div style="color:#f88;font-size:11px">Not enough money</div>';
        item.innerHTML = `
            <h3>${a.name}</h3><div class="price">$${a.cost}</div>
            <div class="stats">${a.description}</div>
            ${weaponBtns}
        `;
        grid.appendChild(item);
    }
}

window.buyWeapon = function (id) {
    const w = WEAPONS[id];
    if (playerData.money >= w.cost && !playerData.ownedWeapons.includes(id)) {
        playerData.money -= w.cost;
        playerData.ownedWeapons.push(id);
        playerData.weaponUsage[id] = 0;
        savePlayerData();
        showShop();
    }
};

window.repairWeapon = function (id) {
    if (playerData.money >= 50) {
        playerData.money -= 50;
        playerData.weaponUsage[id] = 0;
        savePlayerData();
        showShop();
    }
};

window.buyEquipment = function (id) {
    const e = EQUIPMENT[id];
    if (playerData.money >= e.cost) {
        playerData.money -= e.cost;
        if (e.type === 'armor') playerData.equippedArmor = id;
        else if (e.type === 'head') playerData.equippedHelmet = id;
        else if (e.type === 'pants') playerData.equippedPants = id;
        else if (e.type === 'boots') playerData.equippedBoots = id;
        else if (e.airstrikes) playerData.airstrikes = (playerData.airstrikes || 0) + e.airstrikes;
        else playerData.ownedEquipment.push(id);
        savePlayerData();
        window._updateTpArmor?.();
        showShop();
    }
};

window.attachToWeapon = function (attachId, weaponId) {
    const a = ATTACHMENTS[attachId];
    if (playerData.money < a.cost) return;
    if (!playerData.weaponAttachments[weaponId]) playerData.weaponAttachments[weaponId] = [];
    if (playerData.weaponAttachments[weaponId].includes(attachId)) return;
    playerData.money -= a.cost;
    playerData.weaponAttachments[weaponId].push(attachId);
    savePlayerData();
    showShop();
};

// --- Loadout ---

export function showLoadout() {
    showScreen('loadout-screen');
    const maxSlots = gameState.pendingMode === 'pvp' ? 3 : 4;
    document.getElementById('slots-info').textContent =
        `Select up to ${maxSlots} weapons (${playerData.equippedLoadout.length}/${maxSlots} equipped)`;
    const grid = document.getElementById('loadout-grid');
    grid.innerHTML = '';
    for (const id of playerData.ownedWeapons) {
        const w = WEAPONS[id];
        const equipped = playerData.equippedLoadout.includes(id);
        const needsRepair = (playerData.weaponUsage[id] || 0) >= 5;
        const attachments = (playerData.weaponAttachments[id] || []).map(a => ATTACHMENTS[a].name).join(', ');

        const item = document.createElement('div');
        item.className = 'loadout-item' + (equipped ? ' equipped' : '') + (needsRepair ? ' needs-repair' : '');
        item.innerHTML = `
            <h4>${w.name}</h4>
            <div class="ammo-info">${w.type === 'melee' ? 'Melee' : `Ammo: ${w.maxAmmo}`}</div>
            ${attachments ? `<div class="ammo-info" style="color:#ff88ff">${attachments}</div>` : ''}
            ${needsRepair ? '<div style="color:#ff4444;font-size:12px">NEEDS REPAIR</div>' : ''}
            ${needsRepair ? `<button class="repair-btn" style="width:100%;padding:8px;margin-top:6px;background:#ff8800;color:#000;border:none;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer" data-repair-id="${id}">Repair ($50)</button>` : ''}
            <div style="margin-top:6px;font-size:12px;color:#888">${equipped ? 'EQUIPPED' : 'Click to equip'}</div>
        `;
        const repairBtn = item.querySelector('[data-repair-id]');
        if (repairBtn) {
            repairBtn.onclick = (e) => {
                e.stopPropagation();
                if (playerData.money >= 50) {
                    playerData.money -= 50;
                    playerData.weaponUsage[id] = 0;
                    savePlayerData();
                    showLoadout();
                }
            };
        }
        item.onclick = () => {
            if (needsRepair) return;
            if (equipped) {
                if (playerData.equippedLoadout.length <= 1) return; // Prevent unequipping last weapon
                playerData.equippedLoadout = playerData.equippedLoadout.filter(x => x !== id);
            } else {
                if (playerData.equippedLoadout.length >= maxSlots) return;
                playerData.equippedLoadout.push(id);
            }
            savePlayerData();
            showLoadout();
        };
        grid.appendChild(item);
    }

    // --- Armor equip slots ---   
    document.getElementById('loadout-armor-section')?.remove();
    const armorSection = document.createElement('div');
    armorSection.id = 'loadout-armor-section';
    armorSection.style.cssText = 'max-width:700px;margin:30px auto 0;';
    armorSection.innerHTML = '<h3 style="color:#00aaff;font-size:22px;text-align:center;margin-bottom:15px">Armor Slots</h3>';

    const armorSlotContainer = document.createElement('div');
    armorSlotContainer.style.cssText = 'display:flex;gap:16px;justify-content:center;flex-wrap:wrap;';

    const armorSlots = [
        { key: 'equippedHelmet', label: 'HELMET', color: '#aa88ff' },
        { key: 'equippedArmor', label: 'BREASTPLATE', color: '#00aaff' },
        { key: 'equippedPants', label: 'PANTS', color: '#00cc66' },
        { key: 'equippedBoots', label: 'BOOTS', color: '#ffaa00' }
    ];

    for (const { key, label, color } of armorSlots) {
        const slotDiv = document.createElement('div');
        slotDiv.style.cssText = `background:rgba(0,0,0,0.5);border:2px solid ${color};border-radius:10px;padding:18px 24px;text-align:center;min-width:180px;`;
        const eq = playerData[key] ? EQUIPMENT[playerData[key]] : null;
        let statsHtml = '';
        if (eq) {
            if (eq.armor) statsHtml += `<div style="color:#aaa;font-size:12px;margin-top:4px">+${eq.armor} armor</div>`;
            if (eq.damageReduction) statsHtml += `<div style="color:#aaa;font-size:12px">-${eq.damageReduction * 100}% dmg</div>`;
            if (eq.headshotReduction) statsHtml += `<div style="color:#aaa;font-size:12px">-${eq.headshotReduction * 100}% headshots</div>`;
        }
        slotDiv.innerHTML = `
            <div style="font-size:11px;color:#888;letter-spacing:1px;margin-bottom:8px">${label}</div>
            <div style="font-weight:700;font-size:16px;color:${eq ? color : '#444'}">${eq ? eq.name : 'None'}</div>
            ${statsHtml}
            <div style="margin-top:10px">
                ${eq
                ? `<button data-remove-key="${key}" style="background:#cc2222;color:#fff;border:none;border-radius:5px;padding:6px 14px;font-size:13px;cursor:pointer">Remove</button>`
                : `<div style="color:#555;font-size:12px;margin-top:4px">Purchase in Shop</div>`}
            </div>`;
        const removeBtn = slotDiv.querySelector('[data-remove-key]');
        if (removeBtn) {
            removeBtn.onclick = () => {
                playerData[key] = null;
                savePlayerData();
                showLoadout();
            };
        }
        armorSlotContainer.appendChild(slotDiv);
    }

    armorSection.appendChild(armorSlotContainer);
    const loadoutScreen = document.getElementById('loadout-screen');
    const backBtn = loadoutScreen.querySelector('.back-btn');
    loadoutScreen.insertBefore(armorSection, backBtn);

    // --- Stats section ---
    document.getElementById('loadout-stats-section')?.remove();
    const statsSection = document.createElement('div');
    statsSection.id = 'loadout-stats-section';
    statsSection.style.cssText = 'max-width:700px;margin:30px auto 0;';

    const needed = xpToNextLevel(playerData.level);
    const xpPct = Math.floor((playerData.xp / needed) * 10);
    const xpBar = '█'.repeat(xpPct) + '░'.repeat(10 - xpPct);
    statsSection.innerHTML = `
        <h3 style="color:#ffdd00;font-size:22px;text-align:center;margin-bottom:6px">Stats</h3>
        <div style="text-align:center;color:#aaa;font-size:13px;margin-bottom:14px">
            LVL ${playerData.level} &nbsp; ${xpBar} &nbsp; ${playerData.xp}/${needed} XP
            ${playerData.statPoints > 0 ? `<span style="color:#ffdd00;margin-left:10px">${playerData.statPoints} point${playerData.statPoints !== 1 ? 's' : ''} to spend</span>` : ''}
        </div>`;

    const statDefs = [
        { key: 'health', label: 'Health', color: '#00ff88', desc: '+5 max HP per point' },
        { key: 'speed', label: 'Speed', color: '#00aaff', desc: '+2% move speed per point' },
        { key: 'damage', label: 'Damage', color: '#ff4444', desc: '+2% damage per point' }
    ];

    const statGrid = document.createElement('div');
    statGrid.style.cssText = 'display:flex;gap:16px;justify-content:center;flex-wrap:wrap;';

    for (const { key, label, color, desc } of statDefs) {
        const pts = playerData.stats[key];
        const card = document.createElement('div');
        card.style.cssText = `background:rgba(0,0,0,0.5);border:2px solid ${color};border-radius:10px;padding:18px 28px;text-align:center;min-width:170px;`;
        card.innerHTML = `
            <div style="font-size:11px;color:#888;letter-spacing:1px;margin-bottom:6px">${label.toUpperCase()}</div>
            <div style="font-size:28px;font-weight:700;color:${color}">${pts}</div>
            <div style="font-size:11px;color:#666;margin:4px 0 10px">${desc}</div>
            <button data-stat="${key}" ${playerData.statPoints < 1 ? 'disabled' : ''}
                style="background:${playerData.statPoints > 0 ? color : '#333'};color:${playerData.statPoints > 0 ? '#000' : '#555'};border:none;border-radius:5px;padding:6px 18px;font-size:14px;font-weight:700;cursor:${playerData.statPoints > 0 ? 'pointer' : 'default'}">
                + Add Point
            </button>`;
        const btn = card.querySelector('[data-stat]');
        if (btn && playerData.statPoints > 0) {
            btn.onclick = () => {
                playerData.statPoints--;
                playerData.stats[key]++;
                savePlayerData();
                showLoadout();
            };
        }
        statGrid.appendChild(card);
    }

    statsSection.appendChild(statGrid);
    loadoutScreen.insertBefore(statsSection, backBtn);
}
window.showLoadout = showLoadout;

// --- Map Screen ---

export function renderMapScreen(startGameFn) {
    const grid = document.getElementById('map-grid');
    grid.innerHTML = '';
    for (const [id, m] of Object.entries(MAPS)) {
        const card = document.createElement('div');
        card.className = 'map-card';

        let bgUrl = '';
        if (id === 'warehouse') bgUrl = 'linear-gradient(135deg, #222, #444)';
        else if (id === 'desert') bgUrl = 'linear-gradient(135deg, #c2a645, #dcb95e)';
        else if (id === 'city') bgUrl = 'linear-gradient(135deg, #555, #888)';
        else if (id === 'forest') bgUrl = 'linear-gradient(135deg, #1d3a1e, #2d5a2e)';
        else if (id === 'mountain') bgUrl = 'linear-gradient(135deg, #444, #777)';

        card.style.background = bgUrl;

        card.innerHTML = `
            <div style="background:rgba(0,0,0,0.6); padding: 15px; border-radius: 8px; height: 100%;">
                <h3 style="color:#fff; text-shadow: 1px 1px 2px #000;">${m.name}</h3>
                <p style="color:#ddd;">${m.description}</p>
            </div>
        `;
        card.onclick = () => startGameFn(gameState.pendingMode, id);
        grid.appendChild(card);
    }
}

// --- HUD ---

export function updateHUD() {
    if (!playerState.weapons || playerState.weapons.length === 0) return;
    const id = playerState.weapons[playerState.currentWeaponIndex] || playerState.weapons[0];
    const def = WEAPONS[id] || WEAPONS.fists;
    const state = playerState.weaponStates[id];
    if (!state) return;

    const hpPct = (playerState.hp / playerState.maxHp) * 100;
    document.querySelector('#hp-bar .fill').style.width = hpPct + '%';
    document.querySelector('#hp-bar .label').textContent = Math.floor(playerState.hp) + ' HP';

    if (playerState.maxArmor > 0) {
        document.querySelector('#armor-bar .fill').style.width = (playerState.armor / playerState.maxArmor) * 100 + '%';
        document.querySelector('#armor-bar .label').textContent = Math.floor(playerState.armor) + ' Armor';
        document.getElementById('armor-bar').style.display = 'block';
    } else {
        document.getElementById('armor-bar').style.display = 'none';
    }

    if (playerState.maxStamina > 0) {
        document.querySelector('#stamina-bar .fill').style.width = (playerState.stamina / playerState.maxStamina) * 100 + '%';
        document.querySelector('#stamina-bar .label').textContent = Math.floor(playerState.stamina) + ' Stamina';
    }

    document.querySelector('#weapon-hud .weapon-name').textContent = def.name;
    if (def.type === 'melee') {
        document.querySelector('#weapon-hud .ammo-display .current').textContent = '--';
        document.querySelector('#weapon-hud .ammo-display .reserve').textContent = '--';
    } else {
        document.querySelector('#weapon-hud .ammo-display .current').textContent = state.ammo;
        document.querySelector('#weapon-hud .ammo-display .reserve').textContent = state.reserveAmmo;
    }
    document.getElementById('money-hud').textContent = '$' + playerData.money;

    const xpEl = document.getElementById('xp-hud');
    if (xpEl) {
        const needed = xpToNextLevel(playerData.level);
        const pct = Math.floor((playerData.xp / needed) * 10);
        const bar = '█'.repeat(pct) + '░'.repeat(10 - pct);
        xpEl.textContent = `LVL ${playerData.level}  ${bar}  ${playerData.xp}/${needed} XP`;
        if (playerData.statPoints > 0) {
            xpEl.textContent += `  (${playerData.statPoints} pts available)`;
        }
    }
}

export function renderWeaponSlots() {
    const container = document.getElementById('weapon-slots');
    container.innerHTML = '';
    playerState.weapons.forEach((wid, i) => {
        const div = document.createElement('div');
        div.className = 'slot-box' + (i === playerState.currentWeaponIndex ? ' active' : '');
        div.textContent = (i + 1) + '\n' + WEAPONS[wid].name.substring(0, 6);
        container.appendChild(div);
    });
}

export function addKillFeed(text, color = '#fff') {
    const div = document.createElement('div');
    div.style.color = color;
    div.textContent = text;
    const feed = document.getElementById('kill-feed');
    feed.appendChild(div);
    setTimeout(() => div.remove(), 3000);
    while (feed.children.length > 6) feed.removeChild(feed.firstChild);
}

export function showRoundOverlay(text, sub, duration = 2000, showReturn = false) {
    const el = document.getElementById('round-overlay');
    document.getElementById('round-text').textContent = text;
    document.getElementById('round-sub').textContent = sub || '';
    document.getElementById('return-home-btn').style.display = showReturn ? 'block' : 'none';
    el.style.display = 'flex';
    if (duration > 0) setTimeout(() => { if (!showReturn) el.style.display = 'none'; }, duration);
}

// --- Cheats ---

function showCheatMsg(msg) {
    const el = document.getElementById('cheat-msg');
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 2000);
}

export function buildCheats() {
    return {
        'godmode': () => { playerState.godMode = true; showCheatMsg('God Mode ON'); },
        'money': () => { playerData.money += 10000; showCheatMsg('+$10,000'); },
        'ammo': () => { cb.refillAllAmmo(); showCheatMsg('Ammo refilled'); },
        'noclip': () => { playerState.noClip = !playerState.noClip; showCheatMsg('NoClip ' + (playerState.noClip ? 'ON' : 'OFF')); },
        'kill': () => { cb.killAllEnemies(); showCheatMsg('All enemies killed'); },
        'heal': () => { playerState.hp = playerState.maxHp; showCheatMsg('Healed'); },
        'speed': () => { playerState.speedMult = playerState.speedMult === 1 ? 2 : 1; showCheatMsg('Speed x' + playerState.speedMult); },
        'levelup': () => { playerData.level++; playerData.statPoints += 5; savePlayerData(); showCheatMsg(`Level Up! Now LVL ${playerData.level} (+5 pts)`); },
        'reset': () => { window.startGame(gameState.mode, gameState.currentMap); showCheatMsg('Game Reset!'); }
    };
}

export function showCheatMenu(CHEATS) {
    const el = document.getElementById('cheat-menu');
    const buttons = document.getElementById('cheat-buttons');
    buttons.innerHTML = '';
    Object.keys(CHEATS).forEach(code => {
        const btn = document.createElement('button');
        btn.className = 'cheat-btn';
        btn.textContent = code;
        btn.onclick = () => {
            CHEATS[code]();
            updateHomeStats();
            updateHUD();
            savePlayerData();
            showCheatMsg(`${code} activated`);
        };
        buttons.appendChild(btn);
    });
    el.style.display = 'flex';
}

export function hideCheatMenu() {
    document.getElementById('cheat-menu').style.display = 'none';
}
window.hideCheatMenu = hideCheatMenu;

// --- Consumables Panel ---

export function updateConsumablesPanel() {
    const panel = document.getElementById('consumables-panel');
    if (!panel) return;
    const medkits = playerData.ownedEquipment.filter(e => e === 'med_kit').length;
    const adrenalines = playerData.ownedEquipment.filter(e => e === 'adrenaline').length;
    const airstrikes = playerData.airstrikes || 0;

    const AIRSTRIKE_COOLDOWN = 5 * 60 * 1000;
    let airstrikeStatus = '';
    if (gameState.airstrikeLastUsed !== null) {
        const remaining = Math.max(0, Math.ceil((AIRSTRIKE_COOLDOWN - (performance.now() - gameState.airstrikeLastUsed)) / 1000));
        airstrikeStatus = remaining > 0 ? ` <span style="color:#ff4444">(cooldown: ${remaining}s)</span>` : ' <span style="color:#00ff88">(ready)</span>';
    }

    panel.innerHTML = `
        <div style="font-size:20px;font-weight:bold;color:#ffaa00;margin-bottom:12px;border-bottom:1px solid #555;padding-bottom:8px">Consumables [E]</div>
        <div style="margin:8px 0"><span style="color:#00ff88">Med Kit</span> &times;${medkits} &nbsp;<span style="color:#888">Q to use</span></div>
        <div style="margin:8px 0"><span style="color:#ff88ff">Adrenaline</span> &times;${adrenalines} &nbsp;<span style="color:#888">Y to use</span></div>
        <div style="margin:8px 0"><span style="color:#ff4444">Airstrike</span> &times;${airstrikes}${airstrikeStatus} &nbsp;<span style="color:#888">F to use</span></div>
        <div style="margin-top:12px;color:#666;font-size:13px">Press E to close</div>
    `;
}

// --- Tutorial ---

const TUTORIAL_STEPS = [
    { title: 'Welcome to Warzone!', body: "You're a soldier fighting for survival. This tutorial will teach you the basics." },
    { title: 'Movement', body: '<b>WASD</b> to move &bull; <b>Shift</b> to sprint &bull; <b>Space</b> to jump<br>On forest maps, hold <b>Space</b> near a tree trunk to climb it.' },
    { title: 'Combat', body: '<b>Left Click</b> to shoot &bull; <b>Right Click</b> or <b>Z</b> to zoom<br><b>G</b> to reload &bull; Aim for the head for bonus damage!' },
    { title: 'Weapons', body: '<b>1&ndash;9</b> or <b>mouse wheel</b> to switch weapons &bull; <b>C</b> switches forward<br><b>R</b> drops your current weapon &bull; <b>E</b> picks up dropped weapons.' },
    { title: 'Consumables', body: '<b>Q</b> &ndash; Use Med Kit (restores 50 HP)<br><b>Y</b> &ndash; Use Adrenaline (temp HP boost)<br><b>F</b> &ndash; Call Airstrike (once per 5 min)<br><b>E</b> &ndash; View your consumables list' },
    { title: 'Armor & Shop', body: 'Buy weapons, armor (helmet, breastplate, pants, boots), and consumables in the <b>Shop</b> for an up to 90% damage reduction.<br>Equip your gear before a mission in <b>Loadout</b>.' },
    { title: 'Game Modes', body: '<b>Zombie Apocalypse</b> &ndash; Survive waves of zombies. Bosses & Giga Zombies spawn later.<br><b>Rescue Mission</b> &ndash; Find and extract the hostage.<br><b>PvP Arena</b> &ndash; Fight an AI opponent.' },
    { title: 'Other', body: '<b>Tab</b> to switch between first and third person point of view. <br> <b>More coming soon!</b>' },
    { title: "You're Ready!", body: "Kill zombies to earn money. Spend it in the shop between matches. Good luck!" },
];

let tutorialStep = 0;

export function initTutorial() {
    if (localStorage.getItem('warzone_tutorial_seen')) return;
    showTutorial();
}

export function showTutorial() {
    tutorialStep = 0;
    renderTutorialStep();
    document.getElementById('tutorial-overlay').style.display = 'flex';
}
window.showTutorial = showTutorial;

function renderTutorialStep() {
    const step = TUTORIAL_STEPS[tutorialStep];
    const overlay = document.getElementById('tutorial-overlay');
    const isLast = tutorialStep === TUTORIAL_STEPS.length - 1;
    overlay.innerHTML = `
        <div id="tutorial-box">
            <div style="color:#888;font-size:13px;margin-bottom:6px">Step ${tutorialStep + 1} / ${TUTORIAL_STEPS.length}</div>
            <h2 style="color:#ffaa00;margin:0 0 14px;font-size:26px">${step.title}</h2>
            <p style="color:#ddd;font-size:16px;line-height:1.7;margin:0 0 24px">${step.body}</p>
            <div style="display:flex;gap:12px;justify-content:center">
                ${tutorialStep > 0 ? '<button class="menu-btn" style="font-size:15px;padding:8px 20px" onclick="tutorialPrev()">Back</button>' : ''}
                <button class="menu-btn" style="font-size:15px;padding:8px 20px" onclick="tutorialSkip()">Skip</button>
                <button class="menu-btn" style="font-size:15px;padding:8px 28px;background:#ffaa00;color:#000" onclick="tutorialNext()">${isLast ? 'Done' : 'Next'}</button>
            </div>
        </div>
    `;
}

window.tutorialNext = function () {
    if (tutorialStep < TUTORIAL_STEPS.length - 1) {
        tutorialStep++;
        renderTutorialStep();
    } else {
        tutorialSkip();
    }
};
window.tutorialPrev = function () {
    if (tutorialStep > 0) { tutorialStep--; renderTutorialStep(); }
};
window.tutorialSkip = function () {
    localStorage.setItem('warzone_tutorial_seen', '1');
    document.getElementById('tutorial-overlay').style.display = 'none';
};
