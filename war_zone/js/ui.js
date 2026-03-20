// Screen management, shop, loadout, HUD, overlays, cheats

import { WEAPONS, EQUIPMENT, ATTACHMENTS, MAPS } from './data.js';
import { playerData, playerState, savePlayerData, gameState } from './state.js';
import { cb } from './callbacks.js';

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
    for (const [id, e] of Object.entries(EQUIPMENT)) {
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

function renderAttachmentShop() {
    const grid = document.getElementById('attachment-shop');
    grid.innerHTML = '';
    for (const [id, a] of Object.entries(ATTACHMENTS)) {
        const item = document.createElement('div');
        item.className = 'shop-item';
        item.innerHTML = `
            <h3>${a.name}</h3><div class="price">$${a.cost}</div>
            <div class="stats">${a.description}</div>
            <button class="buy-btn" onclick="buyAttachment('${id}')">BUY</button>
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
        else if (e.airstrikes) playerData.airstrikes = (playerData.airstrikes || 0) + e.airstrikes;
        else playerData.ownedEquipment.push(id);
        savePlayerData();
        showShop();
    }
};

window.buyAttachment = function (id) {
    const a = ATTACHMENTS[id];
    if (playerData.money < a.cost) return;
    const eligible = playerData.ownedWeapons.filter(wid => {
        const w = WEAPONS[wid];
        if (w.type !== 'gun') return false;
        if (id === 'scope' && w.hasScope) return false;
        return !(playerData.weaponAttachments[wid] || []).includes(id);
    });
    if (eligible.length === 0) return;
    const choice = prompt('Attach to which weapon?\n' + eligible.map((w, i) => `${i + 1}. ${WEAPONS[w].name}`).join('\n'));
    const idx = parseInt(choice) - 1;
    if (idx >= 0 && idx < eligible.length) {
        playerData.money -= a.cost;
        if (!playerData.weaponAttachments[eligible[idx]]) playerData.weaponAttachments[eligible[idx]] = [];
        playerData.weaponAttachments[eligible[idx]].push(id);
        savePlayerData();
        showShop();
    }
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
        'speed': () => { playerState.speedMult = playerState.speedMult === 1 ? 2 : 1; showCheatMsg('Speed x' + playerState.speedMult); }
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
