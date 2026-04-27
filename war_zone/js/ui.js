// Screen management, shop, loadout, HUD, overlays, cheats

import { WEAPONS, EQUIPMENT, ATTACHMENTS, MAPS, DAMAGE_THRESHOLD, DEFAULT_KEYBINDS, keybinds, saveKeybinds } from './data.js';
import { playerData, playerState, savePlayerData, gameState, xpToNextLevel, setAwardXPImpl, awardXP } from './state.js';
import { cb } from './callbacks.js';
import { checkAchievements } from './achievements.js';

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
            el.style.display = 'flex';
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
    const airstrikeRow = document.getElementById('home-airstrike-row');
    if (playerData.airstrikes > 0) {
        document.getElementById('home-airstrikes').textContent = playerData.airstrikes;
        airstrikeRow.style.display = '';
    } else {
        airstrikeRow.style.display = 'none';
    }
}

// --- Shop ---

let _shopActiveTab = 'weapons';

window.shopTab = function(id, btn) {
    _shopActiveTab = id;
    document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.shop-panel').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const panel = document.getElementById('shop-panel-' + id);
    if (panel) panel.classList.add('active');
};

export function showShop() {
    showScreen('shop-screen');
    document.getElementById('shop-money').textContent = '$' + playerData.money;
    renderWeaponShop();
    renderEquipmentShop();
    renderConsumableShop();
    renderAttachmentShop();
    renderXPShop();
    const activeBtn = document.querySelector(`.shop-tab[data-tab="${_shopActiveTab}"]`);
    window.shopTab(_shopActiveTab, activeBtn);
}
window.showShop = showShop;

function renderWeaponShop() {
    const grid = document.getElementById('weapon-shop');
    grid.innerHTML = '';
    for (const [id, w] of Object.entries(WEAPONS)) {
        if (w.starter) continue;
        const owned = playerData.ownedWeapons.includes(id);
        const needsRepair = (playerData.weaponUsage[id] || 0) >= DAMAGE_THRESHOLD;
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
            <button class="buy-btn ${owned ? 'owned' : ''}" ${(owned || playerData.money < w.cost) ? 'disabled' : ''} onclick="buyWeapon('${id}')">${owned ? 'OWNED' : playerData.money >= w.cost ? 'BUY' : "Can't afford"}</button>
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
    ];

    for (const { title, filter } of sections) {
        const entries = Object.entries(EQUIPMENT).filter(([, e]) => filter(e));
        if (entries.length === 0) continue;
        const header = document.createElement('div');
        header.className = 'shop-section-header';
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
                <h3>${e.name}</h3><div class="price">$${e.cost.toLocaleString()}</div>
                <div class="stats">${desc}</div>
                <button class="buy-btn" ${playerData.money < e.cost ? 'disabled' : ''} onclick="buyEquipment('${id}')">${playerData.money >= e.cost ? 'BUY' : "Can't afford"}</button>
            `;
            grid.appendChild(item);
        }
    }
}

function renderConsumableShop() {
    const grid = document.getElementById('consumable-shop');
    grid.innerHTML = '';
    const consumables = Object.entries(EQUIPMENT).filter(([, e]) => e.type === 'consumable');
    for (const [id, e] of consumables) {
        let desc = '';
        if (e.hpRestore) desc += `Restores ${e.hpRestore} HP`;
        if (e.hpBoost) desc += `+${e.hpBoost} Temporary HP`;
        if (e.airstrikes) desc += `Call an airstrike — kills all zombies (+${e.airstrikes} use)`;
        const item = document.createElement('div');
        item.className = 'shop-item';
        item.innerHTML = `
            <h3>${e.name}</h3>
            <div class="price">$${e.cost.toLocaleString()}</div>
            <div class="stats">${desc}</div>
            <button class="buy-btn" ${playerData.money < e.cost ? 'disabled' : ''} onclick="buyEquipment('${id}')">${playerData.money >= e.cost ? 'BUY' : "Can't afford"}</button>
        `;
        grid.appendChild(item);
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
            ? eligible.map(wid => `<button class="buy-btn" style="margin-top:4px" onclick="attachToWeapon('${id}','${wid}')">Attach to ${WEAPONS[wid].name}</button>`).join('')
            : eligible.length === 0 ? '<div style="color:#442222;font-size:10px;letter-spacing:1px">No eligible weapons owned</div>'
                : '<div style="color:#662222;font-size:10px;letter-spacing:1px">Not enough money</div>';
        item.innerHTML = `
            <h3>${a.name}</h3><div class="price">$${a.cost}</div>
            <div class="stats">${a.description}</div>
            ${weaponBtns}
        `;
        grid.appendChild(item);
    }
}

const XP_PACKAGES = [
    { xp: 100, cost: 2500 },
    { xp: 300, cost: 6000 },
    { xp: 750, cost: 12500 },
    { xp: 2000, cost: 25000 },
    { xp: 6000, cost: 50000 },
];

function renderXPShop() {
    const container = document.getElementById('xp-shop');
    container.innerHTML = '';
    const needed = xpToNextLevel(playerData.level);

    const infoCard = document.createElement('div');
    infoCard.className = 'xp-info-card';
    infoCard.innerHTML = `
        <div class="xp-info-label">Current Level</div>
        <div class="xp-info-val">Level ${playerData.level} — ${playerData.xp.toLocaleString()} / ${needed.toLocaleString()} XP to next level</div>
    `;
    container.appendChild(infoCard);

    const grid = document.createElement('div');
    grid.className = 'xp-grid';
    for (const pkg of XP_PACKAGES) {
        const canAfford = playerData.money >= pkg.cost;
        const card = document.createElement('div');
        card.className = 'xp-card';
        card.innerHTML = `
            <div class="xp-amount">+${pkg.xp.toLocaleString()}</div>
            <div class="xp-unit">XP</div>
            <div class="xp-cost">$${pkg.cost.toLocaleString()}</div>
            <button class="buy-btn" ${!canAfford ? 'disabled' : ''} onclick="buyXP(${pkg.xp},${pkg.cost})">${canAfford ? 'BUY' : "Can't afford"}</button>
        `;
        grid.appendChild(card);
    }
    container.appendChild(grid);
}

window.buyXP = function (xp, cost) {
    if (playerData.money < cost) return;
    playerData.money -= cost;
    awardXP(xp);
    showShop();
};

window.buyWeapon = function (id) {
    const w = WEAPONS[id];
    if (playerData.money >= w.cost && !playerData.ownedWeapons.includes(id)) {
        playerData.money -= w.cost;
        playerData.ownedWeapons.push(id);
        playerData.weaponUsage[id] = 0;
        savePlayerData();
        checkAchievements();
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
    const isArmor = ['armor', 'head', 'pants', 'boots'].includes(e.type);
    // Don't charge again if already owned
    if (isArmor && playerData.ownedArmor.includes(id)) { showShop(); return; }
    if (playerData.money >= e.cost) {
        playerData.money -= e.cost;
        if (isArmor) {
            playerData.ownedArmor.push(id);
            // Auto-equip new armor piece
            if (e.type === 'armor') playerData.equippedArmor = id;
            else if (e.type === 'head') playerData.equippedHelmet = id;
            else if (e.type === 'pants') playerData.equippedPants = id;
            else if (e.type === 'boots') playerData.equippedBoots = id;
        } else if (e.airstrikes) {
            playerData.airstrikes = (playerData.airstrikes || 0) + e.airstrikes;
        } else {
            playerData.ownedEquipment.push(id);
        }
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

// --- Armor SVG Graphics ---

function getArmorSVG(type, name, small = false) {
    const s = small ? 44 : 64;
    const tier = name ? (name.toLowerCase().includes('heavy') ? 'heavy' : name.toLowerCase().includes('chain') ? 'chain' : 'light') : 'empty';
    const fill = tier === 'heavy' ? '#4a4a4a' : tier === 'chain' ? '#7a7a7a' : tier === 'light' ? '#b0b8c0' : '#2a2a2a';
    const stroke = tier === 'heavy' ? '#777' : tier === 'chain' ? '#aaa' : tier === 'light' ? '#dde' : '#444';
    const shine = tier === 'heavy' ? '#666' : tier === 'chain' ? '#bbb' : '#e8f0f8';

    if (type === 'head') {
        // Medieval helmet: dome with visor slit and cheek guards
        return `<svg width="${s}" height="${s}" viewBox="0 0 64 64" style="display:block;margin:0 auto">
            <ellipse cx="32" cy="28" rx="18" ry="16" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
            <path d="M14 36 Q16 50 20 52 L44 52 Q48 50 50 36" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
            <rect x="18" y="34" width="28" height="4" rx="2" fill="#111" opacity="0.8"/>
            <line x1="28" y1="34" x2="28" y2="38" stroke="${stroke}" stroke-width="1"/>
            <line x1="36" y1="34" x2="36" y2="38" stroke="${stroke}" stroke-width="1"/>
            <ellipse cx="32" cy="22" rx="8" ry="5" fill="${shine}" opacity="0.2"/>
            ${tier === 'heavy' ? '<rect x="20" y="48" width="24" height="6" rx="2" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.5"/>' : ''}
        </svg>`;
    } else if (type === 'armor') {
        // Breastplate: central ridge, pauldron hints
        return `<svg width="${s}" height="${s}" viewBox="0 0 64 64" style="display:block;margin:0 auto">
            <path d="M12 18 Q10 12 20 10 L32 8 L44 10 Q54 12 52 18 L50 50 Q48 56 32 58 Q16 56 14 50 Z" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
            <line x1="32" y1="8" x2="32" y2="58" stroke="${stroke}" stroke-width="1.5" opacity="0.6"/>
            <path d="M20 20 Q24 16 32 15 Q40 16 44 20" fill="none" stroke="${shine}" stroke-width="1.5" opacity="0.4"/>
            <path d="M18 30 Q22 26 32 25 Q42 26 46 30" fill="none" stroke="${shine}" stroke-width="1" opacity="0.3"/>
            ${tier === 'heavy' ? '<rect x="14" y="38" width="36" height="8" rx="3" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.5" opacity="0.9"/>' : ''}
            ${tier === 'chain' ? '<path d="M20 22 Q32 18 44 22 Q32 26 20 22Z" fill="' + shine + '" opacity="0.15"/>' : ''}
        </svg>`;
    } else if (type === 'pants') {
        // Leg armour with knee guards
        return `<svg width="${s}" height="${s}" viewBox="0 0 64 64" style="display:block;margin:0 auto">
            <rect x="14" y="8" width="14" height="32" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
            <rect x="36" y="8" width="14" height="32" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
            <rect x="13" y="36" width="16" height="10" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
            <rect x="35" y="36" width="16" height="10" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
            <rect x="12" y="44" width="18" height="14" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
            <rect x="34" y="44" width="18" height="14" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
            <ellipse cx="21" cy="39" rx="5" ry="3" fill="${shine}" opacity="0.25"/>
            <ellipse cx="43" cy="39" rx="5" ry="3" fill="${shine}" opacity="0.25"/>
        </svg>`;
    } else if (type === 'boots') {
        // Sabatons: horizontal plate lines on foot armour
        return `<svg width="${s}" height="${s}" viewBox="0 0 64 64" style="display:block;margin:0 auto">
            <rect x="16" y="6" width="32" height="34" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
            <path d="M14 40 L50 40 L54 52 Q54 58 32 58 Q10 58 10 52 Z" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
            <line x1="16" y1="18" x2="48" y2="18" stroke="${stroke}" stroke-width="1.5" opacity="0.6"/>
            <line x1="16" y1="26" x2="48" y2="26" stroke="${stroke}" stroke-width="1.5" opacity="0.6"/>
            <line x1="16" y1="34" x2="48" y2="34" stroke="${stroke}" stroke-width="1.5" opacity="0.6"/>
            <line x1="14" y1="46" x2="50" y2="46" stroke="${stroke}" stroke-width="1.5" opacity="0.5"/>
            <line x1="13" y1="52" x2="51" y2="52" stroke="${stroke}" stroke-width="1.5" opacity="0.5"/>
            <ellipse cx="32" cy="12" rx="10" ry="3" fill="${shine}" opacity="0.2"/>
        </svg>`;
    }
    // Empty slot placeholder
    return `<svg width="${s}" height="${s}" viewBox="0 0 64 64" style="display:block;margin:0 auto;opacity:0.25">
        <rect x="12" y="12" width="40" height="40" rx="6" fill="none" stroke="#666" stroke-width="2" stroke-dasharray="4,4"/>
        <text x="32" y="37" text-anchor="middle" font-size="20" fill="#666">?</text>
    </svg>`;
}

// --- Loadout ---

export function showLoadout() {
    showScreen('loadout-screen');
    const maxSlots = gameState.pendingMode === 'pvp' ? 3 : 4;

    // ── Header meta ──
    const modeNames = { zombie: 'Zombie Apocalypse', rescue: 'Rescue Mission', pvp: 'PvP Arena' };
    document.getElementById('lo-meta-mode').textContent = modeNames[gameState.pendingMode] || '—';
    document.getElementById('lo-meta-slots').textContent = `${playerData.equippedLoadout.length} / ${maxSlots}`;
    document.getElementById('lo-meta-pts').textContent = playerData.statPoints;
    document.getElementById('lo-weapons-sub').textContent = `Click to equip · max ${maxSlots} slots`;

    // ── WEAPONS ──
    const weaponsBody = document.getElementById('lo-col-weapons-body');
    weaponsBody.innerHTML = '';

    for (const id of playerData.ownedWeapons) {
        const w = WEAPONS[id];
        if (w.type === 'utility') continue;
        const equipped = playerData.equippedLoadout.includes(id);
        const needsRepair = (playerData.weaponUsage[id] || 0) >= DAMAGE_THRESHOLD;

        const card = document.createElement('div');
        card.className = 'lo-w-card' +
            (equipped ? ' lo-equipped' : '') +
            (needsRepair ? ' lo-damaged' : '');

        const ammoText = w.type === 'melee' ? 'Melee' : `${w.maxAmmo} / ${w.maxAmmo}`;
        let badgeClass, badgeText, badgeTag;
        if (needsRepair) {
            badgeClass = 'lo-badge-rep'; badgeText = '⚠ REPAIR $50'; badgeTag = 'button';
        } else if (equipped) {
            badgeClass = 'lo-badge-on'; badgeText = 'EQUIPPED'; badgeTag = 'div';
        } else {
            badgeClass = 'lo-badge-off'; badgeText = 'equip'; badgeTag = 'div';
        }

        card.innerHTML = `
            <div class="lo-w-icon">⚔</div>
            <div class="lo-w-info">
                <div class="lo-w-name">${w.name}</div>
                <div class="lo-w-ammo">${ammoText}</div>
            </div>
            <${badgeTag} class="lo-w-badge ${badgeClass}">${badgeText}</${badgeTag}>
        `;

        if (needsRepair) {
            card.querySelector('.lo-w-badge').onclick = (e) => {
                e.stopPropagation();
                if (playerData.money >= 50) {
                    playerData.money -= 50;
                    playerData.weaponUsage[id] = 0;
                    savePlayerData();
                    showLoadout();
                }
            };
        } else {
            card.onclick = () => {
                if (equipped) {
                    playerData.equippedLoadout = playerData.equippedLoadout.filter(x => x !== id);
                } else {
                    if (playerData.equippedLoadout.length >= maxSlots) return;
                    playerData.equippedLoadout.push(id);
                }
                savePlayerData();
                showLoadout();
            };
        }
        weaponsBody.appendChild(card);
    }

    // ── ARMOR ──
    const armorBody = document.getElementById('lo-col-armor-body');
    armorBody.innerHTML = '';

    // Retroactively sync equipped armor into ownedArmor (legacy data support)
    for (const eqKey of ['equippedHelmet', 'equippedArmor', 'equippedPants', 'equippedBoots']) {
        const id = playerData[eqKey];
        if (id && !playerData.ownedArmor.includes(id)) playerData.ownedArmor.push(id);
    }

    const slotDefs = [
        { key: 'equippedHelmet', label: 'Helmet', slotType: 'head' },
        { key: 'equippedArmor',  label: 'Chest',  slotType: 'armor' },
        { key: 'equippedPants',  label: 'Legs',   slotType: 'pants' },
        { key: 'equippedBoots',  label: 'Boots',  slotType: 'boots' }
    ];

    const slotsGrid = document.createElement('div');
    slotsGrid.className = 'lo-armor-slots';

    for (const { key, label, slotType } of slotDefs) {
        const eq = playerData[key] ? EQUIPMENT[playerData[key]] : null;
        const slotDiv = document.createElement('div');
        slotDiv.className = 'lo-a-slot' + (eq ? ' lo-a-filled' : '');
        slotDiv.dataset.slotType = slotType;

        let statsHtml = '';
        if (eq) {
            const parts = [];
            if (eq.armor) parts.push(`${eq.armor} armor`);
            if (eq.damageReduction) parts.push(`${Math.round(eq.damageReduction * 100)}% DR`);
            if (parts.length) statsHtml = `<div class="lo-a-slot-stats">${parts.join(' · ')}</div>`;
        }

        slotDiv.innerHTML = `
            <div class="lo-a-slot-label">${label}</div>
            <div class="lo-a-slot-name">${eq ? eq.name : '— empty —'}</div>
            ${statsHtml}
            ${eq ? `<button class="lo-a-remove">✕ remove</button>` : ''}
        `;

        if (eq) {
            slotDiv.querySelector('.lo-a-remove').onclick = (e) => {
                e.stopPropagation();
                playerData[key] = null;
                savePlayerData();
                showLoadout();
            };
        }

        slotDiv.addEventListener('dragover', e => {
            e.preventDefault();
            slotDiv.style.borderStyle = 'solid';
            slotDiv.style.background = 'rgba(255,255,255,0.05)';
        });
        slotDiv.addEventListener('dragleave', () => {
            slotDiv.style.borderStyle = playerData[key] ? 'solid' : 'dashed';
            slotDiv.style.background = playerData[key] ? 'rgba(204,34,0,0.04)' : '';
        });
        slotDiv.addEventListener('drop', e => {
            e.preventDefault();
            slotDiv.style.borderStyle = playerData[key] ? 'solid' : 'dashed';
            slotDiv.style.background = playerData[key] ? 'rgba(204,34,0,0.04)' : '';
            const armorId = e.dataTransfer.getData('armorId');
            const armorType = e.dataTransfer.getData('armorType');
            if (armorType === slotType) {
                playerData[key] = armorId;
                savePlayerData();
                window._updateTpArmor?.();
                showLoadout();
            } else {
                slotDiv.style.borderColor = '#ff2222';
                setTimeout(() => { slotDiv.style.borderColor = ''; }, 600);
            }
        });

        slotsGrid.appendChild(slotDiv);
    }
    armorBody.appendChild(slotsGrid);

    const divider = document.createElement('div');
    divider.className = 'lo-divider';
    armorBody.appendChild(divider);

    const invLabel = document.createElement('div');
    invLabel.className = 'lo-inv-label';
    invLabel.textContent = 'Owned Armor — drag to equip';
    armorBody.appendChild(invLabel);

    const typeToKey = { head: 'equippedHelmet', armor: 'equippedArmor', pants: 'equippedPants', boots: 'equippedBoots' };
    const typeLabel = { head: 'Head', armor: 'Chest', pants: 'Legs', boots: 'Boots' };

    if (playerData.ownedArmor.length > 0) {
        for (const id of playerData.ownedArmor) {
            const eq = EQUIPMENT[id];
            if (!eq) continue;
            const eqKey = typeToKey[eq.type];
            const isEquipped = playerData[eqKey] === id;

            const card = document.createElement('div');
            card.className = 'lo-a-inv-card' + (isEquipped ? ' lo-inv-equipped' : '');
            card.draggable = true;

            const parts = [];
            if (eq.armor) parts.push(`${eq.armor} arm`);
            if (eq.damageReduction) parts.push(`${Math.round(eq.damageReduction * 100)}% DR`);

            card.innerHTML = `
                <div class="lo-a-inv-type">${typeLabel[eq.type] || eq.type}</div>
                <div class="lo-a-inv-name">${eq.name}</div>
                <div class="lo-a-inv-stat">${parts.join(' · ')}</div>
            `;

            card.addEventListener('dragstart', e => {
                e.dataTransfer.setData('armorId', id);
                e.dataTransfer.setData('armorType', eq.type);
                card.style.opacity = '0.5';
            });
            card.addEventListener('dragend', () => { card.style.opacity = ''; });

            armorBody.appendChild(card);
        }
    } else {
        const empty = document.createElement('div');
        empty.style.cssText = 'color:#555;font-size:12px;font-style:italic;padding:4px 0;';
        empty.textContent = 'No armor owned — visit the Shop to purchase.';
        armorBody.appendChild(empty);
    }

    // ── STATS ──
    const statsBody = document.getElementById('lo-col-stats-body');
    statsBody.innerHTML = '';

    const ptsBanner = document.createElement('div');
    ptsBanner.className = 'lo-pts-banner';
    ptsBanner.innerHTML = `
        <div class="lo-pts-label">Available Points</div>
        <div class="lo-pts-val" id="lo-stat-pts-val">${playerData.statPoints}</div>
    `;
    statsBody.appendChild(ptsBanner);

    const statDefs = [
        { key: 'health',       label: 'Health',       color: '#00ff88', desc: '+5 max HP per point' },
        { key: 'speed',        label: 'Speed',         color: '#00aaff', desc: '+2% sprint speed per point' },
        { key: 'damage',       label: 'Damage',        color: '#ff4444', desc: '+2% dmg · +5% headshot per point' },
        { key: 'stamina',      label: 'Stamina',       color: '#ffaa00', desc: '+10 max stamina per point' },
        { key: 'staminaRegen', label: 'Stamina Regen', color: '#ffcc44', desc: '+10% regen rate per point' },
        { key: 'jump',         label: 'Jump Height',   color: '#aa66ff', desc: '+charge height per point' },
        { key: 'reload',       label: 'Reload Time',   color: '#00ddff', desc: '-5% reload time per point' }
    ];

    for (const { key, label, color, desc } of statDefs) {
        const pts = playerData.stats[key];
        const barPct = Math.min(100, (pts / 10) * 100);

        const row = document.createElement('div');
        row.className = 'lo-stat-row';
        row.innerHTML = `
            <div class="lo-stat-top">
                <div class="lo-stat-name">${label}</div>
                <div class="lo-stat-controls">
                    <button class="lo-stat-btn lo-btn-rem" ${pts < 1 ? 'disabled' : ''}>−</button>
                    <div class="lo-stat-val">${pts}</div>
                    <button class="lo-stat-btn lo-btn-add" ${playerData.statPoints < 1 ? 'disabled' : ''}>+</button>
                </div>
            </div>
            <div class="lo-stat-bar-wrap">
                <div class="lo-stat-bar" style="background:${color};width:${barPct}%"></div>
            </div>
            <div class="lo-stat-effect">${desc}</div>
        `;

        const remBtn = row.querySelector('.lo-btn-rem');
        const addBtn = row.querySelector('.lo-btn-add');
        const valEl  = row.querySelector('.lo-stat-val');
        const barEl  = row.querySelector('.lo-stat-bar');

        remBtn.onclick = () => {
            if (playerData.stats[key] < 1) return;
            playerData.stats[key]--;
            playerData.statPoints++;
            savePlayerData();
            valEl.textContent = playerData.stats[key];
            barEl.style.width = `${Math.min(100, (playerData.stats[key] / 10) * 100)}%`;
            document.getElementById('lo-stat-pts-val').textContent = playerData.statPoints;
            document.getElementById('lo-meta-pts').textContent = playerData.statPoints;
            remBtn.disabled = playerData.stats[key] < 1;
            addBtn.disabled = false;
        };

        addBtn.onclick = () => {
            if (playerData.statPoints < 1) return;
            playerData.stats[key]++;
            playerData.statPoints--;
            savePlayerData();
            valEl.textContent = playerData.stats[key];
            barEl.style.width = `${Math.min(100, (playerData.stats[key] / 10) * 100)}%`;
            document.getElementById('lo-stat-pts-val').textContent = playerData.statPoints;
            document.getElementById('lo-meta-pts').textContent = playerData.statPoints;
            addBtn.disabled = playerData.statPoints < 1;
            remBtn.disabled = false;
        };

        statsBody.appendChild(row);
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
        else if (id === 'fortress') bgUrl = 'linear-gradient(135deg, #5a4a3c, #887868)';
        else if (id === 'hallway') bgUrl = 'linear-gradient(135deg, #111, #222)';

        card.style.background = bgUrl;

        const mapImages = {
            warehouse: 'Pictures/warehouse.png',
            desert: 'Pictures/desert.png',
            city: 'Pictures/city.png',
            forest: 'Pictures/forest.png',
            mountain: 'Pictures/mountains.png',
            fortress: 'Pictures/fortress.png',
            hallway: 'Pictures/hallway.png',
        };
        const imgHtml = mapImages[id]
            ? `<img src="${mapImages[id]}" alt="${m.name}" style="width:100%; border-radius:5px; margin-top:10px; display:block; object-fit:cover; max-height:120px;">`
            : '';
        card.innerHTML = `
            <div style="background:rgba(0,0,0,0.6); padding: 15px; border-radius: 8px; height: 100%;">
                <h3 style="color:#fff; text-shadow: 1px 1px 2px #000;">${m.name}</h3>
                <p style="color:#ddd;">${m.description}</p>
                ${imgHtml}
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
        'money': () => { const amt = parseInt(prompt('How much money?', '10000')); if (!isNaN(amt) && amt > 0) { playerData.money += amt; showCheatMsg('+$' + amt.toLocaleString()); } },
        'ammo': () => { const amt = prompt('How much ammo? (leave blank for full refill)', ''); if (amt === null) return; const n = parseInt(amt); if (!isNaN(n) && n > 0) { setAllAmmo(n); showCheatMsg('Ammo set to ' + n); } else { cb.refillAllAmmo(); showCheatMsg('Ammo refilled'); } },
        'noclip': () => { playerState.noClip = !playerState.noClip; showCheatMsg('NoClip ' + (playerState.noClip ? 'ON' : 'OFF')); },
        'fly': () => { playerState.flyMode = !playerState.flyMode; showCheatMsg('Fly Mode ' + (playerState.flyMode ? 'ON (Space=up, Shift=down)' : 'OFF')); },
        'kill': () => { cb.killAllEnemies(); showCheatMsg('All enemies killed'); },
        'heal': () => { playerState.hp = playerState.maxHp; showCheatMsg('Healed'); },
        'speed': () => { playerState.speedMult = playerState.speedMult === 1 ? 2 : 1; showCheatMsg('Speed x' + playerState.speedMult); },
        'levelup': () => { const lvls = parseInt(prompt('How many levels?', '1')); if (!isNaN(lvls) && lvls > 0) { playerData.level += lvls; playerData.statPoints += lvls * 5; savePlayerData(); showCheatMsg(`+${lvls} Levels! Now LVL ${playerData.level} (+${lvls * 5} pts)`); } },
        'nightvision': () => {
            playerState.nightVision = !playerState.nightVision;
            const canvas = document.querySelector('canvas');
            let nvDiv = document.getElementById('nv-overlay');
            if (playerState.nightVision) {
                if (canvas) canvas.style.filter = 'saturate(0) sepia(1) hue-rotate(90deg) saturate(3) brightness(1.8)';
                if (!nvDiv) {
                    nvDiv = document.createElement('div');
                    nvDiv.id = 'nv-overlay';
                    nvDiv.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:50;background:radial-gradient(ellipse at 50% 50%,transparent 35%,rgba(0,30,0,0.65) 100%);';
                    document.body.appendChild(nvDiv);
                }
                nvDiv.style.display = 'block';
                showCheatMsg('Night Vision ON');
            } else {
                if (canvas) canvas.style.filter = '';
                if (nvDiv) nvDiv.style.display = 'none';
                showCheatMsg('Night Vision OFF');
            }
        },
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

    const kd = (v) => v === ' ' ? 'Space' : v.toUpperCase();
    panel.innerHTML = `
        <div style="font-size:20px;font-weight:bold;color:#ffaa00;margin-bottom:12px;border-bottom:1px solid #555;padding-bottom:8px">Consumables [${kd(keybinds.interact)}]</div>
        <div style="margin:8px 0"><span style="color:#00ff88">Med Kit</span> &times;${medkits} &nbsp;<span style="color:#888">${kd(keybinds.medkit)} to use</span></div>
        <div style="margin:8px 0"><span style="color:#ff88ff">Adrenaline</span> &times;${adrenalines} &nbsp;<span style="color:#888">${kd(keybinds.adrenaline)} to use</span></div>
        <div style="margin:8px 0"><span style="color:#ff4444">Airstrike</span> &times;${airstrikes}${airstrikeStatus} &nbsp;<span style="color:#888">${kd(keybinds.airstrike)} to use</span></div>
        <div style="margin-top:12px;color:#666;font-size:13px">Press ${kd(keybinds.interact)} to close</div>
    `;
}

// --- Tutorial ---

const TUTORIAL_STEPS = [
    { title: 'Welcome to Warzone!', body: "You're a soldier fighting for survival. This tutorial will teach you the basics." },
    { title: 'Movement', body: '<b>WASD</b> to move &bull; <b>Shift</b> to sprint &bull; <b>Space</b> to jump<br>On forest maps, hold <b>Space</b> near a tree trunk to climb it.' },
    { title: 'Combat', body: '<b>Left Click</b> to shoot &bull; <b>Right Click</b> or <b>Z</b> to zoom<br><b>R</b> to reload &bull; Aim for the head for bonus damage!' },
    { title: 'Weapons & Utility', body: '<b>1&ndash;9</b> or <b>mouse wheel</b> to switch weapons &bull; <b>C</b> = next, <b>Q</b> = prev (or use med kit if you have one)<br><b>X</b> drops your current weapon &bull; <b>E</b> picks up dropped weapons<br><b>Compass</b> needle points to your objective &bull; <b>Flashlight</b> spawns near you each match — equip it to light dark areas' },
    { title: 'Consumables', body: '<b>Q</b> &ndash; Use Med Kit (restores 50 HP)<br><b>Y</b> &ndash; Use Adrenaline (temp HP boost)<br><b>F</b> &ndash; Call Airstrike (once per 5 min)<br><b>E</b> &ndash; View your consumables list' },
    { title: 'Armor & Shop', body: 'Buy weapons, armor (helmet, breastplate, pants, boots), and consumables in the <b>Shop</b> for an up to 90% damage reduction.<br>Equip your gear before a mission in <b>Loadout</b>.<br><b>Weapons degrade</b> after 10 uses — repair for $50 in the Shop.' },
    { title: 'Progression', body: 'Kill enemies to earn <b>XP</b> and level up. Each level grants <b>5 stat points</b> to spend in <b>Loadout → Stats</b> on:<br>Health &bull; Speed &bull; Damage &bull; Stamina &bull; Jump &bull; Reload speed<br>Buy <b>XP packages</b> in the Shop to level up faster.' },
    { title: 'Game Modes', body: '<b>Zombie Apocalypse</b> &ndash; Survive waves. Boss and Giga Zombies operate in coordinated squads.<br><b>Rescue Mission</b> &ndash; Find the hostage with your compass, press <b>E</b> to rescue, then reach the extraction zone.<br><b>PvP Arena</b> &ndash; Fight an AI opponent (3-weapon loadout limit).' },
    { title: 'Tips & Settings', body: '<b>Tab</b> &ndash; Toggle first / third person view<br><b>Backtick (`)</b> &ndash; Open chat (type to say something; prefix with ` for cheats)<br><b>Keybinds</b> &ndash; Rebind every key from the main menu or pause screen<br><b>Esc</b> &ndash; Pause / resume' },
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

// --- Keybinds Menu ---

const KB_LABELS = {
    moveForward: 'Move Forward', moveBack: 'Move Back',
    moveLeft: 'Move Left', moveRight: 'Move Right',
    jump: 'Jump', sprint: 'Sprint',
    reload: 'Reload', interact: 'Interact', dropWeapon: 'Drop Weapon',
    medkit: 'Use Medkit', adrenaline: 'Use Adrenaline', cycleWeapon: 'Cycle Weapon',
    airstrike: 'Call Airstrike', zoom: 'Toggle Zoom',
    thirdPerson: 'Third-Person View', chat: 'Open Chat',
};

function kbDisplay(val) {
    if (val === ' ') return 'Space';
    if (val === 'shift') return 'Shift';
    if (val === 'tab') return 'Tab';
    if (val === 'escape') return 'Escape';
    if (val === 'enter') return 'Enter';
    if (val === 'arrowup') return '↑';
    if (val === 'arrowdown') return '↓';
    if (val === 'arrowleft') return '←';
    if (val === 'arrowright') return '→';
    return val.toUpperCase();
}

let _kbListening = null;
let _kbOnKey = null; // module-level ref so closeKeybindsMenu can remove stale listeners

function _kbDebug(msg) {
    let el = document.getElementById('_kb_debug');
    if (!el) {
        el = document.createElement('div');
        el.id = '_kb_debug';
        el.style.cssText = 'position:fixed;bottom:10px;right:10px;background:#000;color:#0f0;font-size:13px;padding:8px 12px;border-radius:6px;z-index:99999;font-family:monospace;pointer-events:none;';
        document.body.appendChild(el);
    }
    el.textContent = msg;
}

function startKbCapture(action, btn) {
    _kbDebug('clicked: ' + action + ((_kbListening) ? ' (busy!)' : ''));
    if (_kbListening) return;
    _kbListening = action;
    btn.textContent = '...';
    btn.style.borderColor = '#ffaa00';
    btn.style.color = '#ffaa00';
    document.getElementById('keybinds-list').focus();

    function onKey(ev) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        const raw = ev.key;
        _kbOnKey = null;
        document.removeEventListener('keydown', onKey, true);
        if (raw === 'Escape') {
            _kbDebug('cancelled');
            _kbListening = null;
            renderKBList();
            return;
        }
        _kbDebug('set ' + action + ' = ' + raw);
        keybinds[action] = raw.toLowerCase();
        saveKeybinds();
        _kbListening = null;
        renderKBList();
    }
    _kbOnKey = onKey;
    document.addEventListener('keydown', onKey, true);
}

function renderKBList() {
    const list = document.getElementById('keybinds-list');
    list.innerHTML = '';
    list.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;';
    for (const [action, label] of Object.entries(KB_LABELS)) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.05);border:1px solid #333;border-radius:8px;padding:10px 14px;gap:8px;';

        const span = document.createElement('span');
        span.style.cssText = 'color:#ccc;font-size:0.88rem;flex:1;';
        span.textContent = label;

        const btn = document.createElement('button');
        btn.dataset.action = action;
        btn.className = 'kb-btn';
        btn.style.cssText = 'min-width:76px;padding:5px 8px;border:1px solid #00aaff;background:rgba(0,170,255,0.1);color:#00aaff;border-radius:6px;cursor:pointer;font-size:0.82rem;font-family:inherit;';
        btn.textContent = kbDisplay(keybinds[action]);
        // mousedown never fires from keyboard (Enter/Space), so no phantom re-trigger is possible
        btn.addEventListener('mousedown', () => {
            startKbCapture(action, btn);
        });

        row.appendChild(span);
        row.appendChild(btn);
        list.appendChild(row);
    }
}

export function setupKeybindsMenu() {
    document.getElementById('keybinds-reset-btn').addEventListener('click', () => {
        Object.assign(keybinds, DEFAULT_KEYBINDS);
        saveKeybinds();
        renderKBList();
    });

    document.getElementById('keybinds-close-btn').addEventListener('click', closeKeybindsMenu);
    renderKBList();
}

export function openKeybindsMenu() {
    window._keybindsMenuOpen = true;
    renderKBList();
    document.getElementById('keybinds-overlay').style.display = 'flex';
}
window.openKeybindsMenu = openKeybindsMenu;

export function closeKeybindsMenu() {
    window._keybindsMenuOpen = false;
    _kbListening = null;
    if (_kbOnKey) { document.removeEventListener('keydown', _kbOnKey, true); _kbOnKey = null; }
    document.getElementById('keybinds-overlay').style.display = 'none';
}
window.closeKeybindsMenu = closeKeybindsMenu;
