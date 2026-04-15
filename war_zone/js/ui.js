// Screen management, shop, loadout, HUD, overlays, cheats

import { WEAPONS, EQUIPMENT, ATTACHMENTS, MAPS, DAMAGE_THRESHOLD } from './data.js';
import { playerData, playerState, savePlayerData, gameState, xpToNextLevel, setAwardXPImpl, awardXP } from './state.js';
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
    renderXPShop();
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

const XP_PACKAGES = [
    { xp: 100, cost: 2500 },
    { xp: 300, cost: 6000 },
    { xp: 750, cost: 12500 },
    { xp: 2000, cost: 25000 },
    { xp: 6000, cost: 50000 },
];

function renderXPShop() {
    const grid = document.getElementById('xp-shop');
    grid.innerHTML = '';
    const needed = xpToNextLevel(playerData.level);
    const header = document.createElement('p');
    header.style.cssText = 'color:#aaa;font-size:13px;width:100%;margin:0 0 10px;';
    header.textContent = `LVL ${playerData.level} — ${playerData.xp}/${needed} XP to next level`;
    grid.appendChild(header);
    for (const pkg of XP_PACKAGES) {
        const canAfford = playerData.money >= pkg.cost;
        const item = document.createElement('div');
        item.className = 'shop-item';
        item.innerHTML = `
            <h3>+${pkg.xp} XP</h3>
            <div class="price">$${pkg.cost.toLocaleString()}</div>
            <div class="stats">Instantly grants ${pkg.xp} XP</div>
            <button class="buy-btn" ${!canAfford ? 'disabled' : ''} onclick="buyXP(${pkg.xp},${pkg.cost})">${canAfford ? 'BUY' : 'Too expensive'}</button>
        `;
        grid.appendChild(item);
    }
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
    document.getElementById('slots-info').textContent =
        `Select up to ${maxSlots} weapons (${playerData.equippedLoadout.length}/${maxSlots} equipped)`;
    const grid = document.getElementById('loadout-grid');
    grid.innerHTML = '';
    for (const id of playerData.ownedWeapons) {
        const w = WEAPONS[id];
        if (w.type === 'utility') continue; // hide utility items (compass, flashlight) from loadout
        const equipped = playerData.equippedLoadout.includes(id);
        const needsRepair = (playerData.weaponUsage[id] || 0) >= DAMAGE_THRESHOLD;
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

    // --- Armor equip slots (drag-drop targets) ---
    document.getElementById('loadout-armor-section')?.remove();
    const armorSection = document.createElement('div');
    armorSection.id = 'loadout-armor-section';
    armorSection.style.cssText = 'max-width:760px;margin:30px auto 0;';
    armorSection.innerHTML = '<h3 style="color:#00aaff;font-size:22px;text-align:center;margin-bottom:6px">Armor Slots</h3><p style="color:#666;font-size:12px;text-align:center;margin:0 0 14px">Drag armor from your inventory below into a slot, or click Remove to unequip</p>';

    const armorSlotContainer = document.createElement('div');
    armorSlotContainer.style.cssText = 'display:flex;gap:16px;justify-content:center;flex-wrap:wrap;';

    const armorSlots = [
        { key: 'equippedHelmet', label: 'HELMET', color: '#aa88ff', slotType: 'head' },
        { key: 'equippedArmor', label: 'BREASTPLATE', color: '#00aaff', slotType: 'armor' },
        { key: 'equippedPants', label: 'PANTS', color: '#00cc66', slotType: 'pants' },
        { key: 'equippedBoots', label: 'BOOTS', color: '#ffaa00', slotType: 'boots' }
    ];

    for (const { key, label, color, slotType } of armorSlots) {
        const slotDiv = document.createElement('div');
        slotDiv.style.cssText = `background:rgba(0,0,0,0.55);border:2px dashed ${color};border-radius:10px;padding:14px 20px;text-align:center;min-width:170px;transition:border-style 0.15s,background 0.15s;`;
        const eq = playerData[key] ? EQUIPMENT[playerData[key]] : null;
        let statsHtml = '';
        if (eq) {
            if (eq.armor) statsHtml += `<div style="color:#aaa;font-size:12px;margin-top:3px">+${eq.armor} armor</div>`;
            if (eq.damageReduction) statsHtml += `<div style="color:#aaa;font-size:12px">-${eq.damageReduction * 100}% dmg</div>`;
            if (eq.headshotReduction) statsHtml += `<div style="color:#aaa;font-size:12px">-${eq.headshotReduction * 100}% headshots</div>`;
        }
        const svg = getArmorSVG(slotType, eq ? eq.name : null);
        slotDiv.innerHTML = `
            <div style="font-size:10px;color:#888;letter-spacing:1px;margin-bottom:6px">${label}</div>
            ${svg}
            <div style="font-weight:700;font-size:14px;color:${eq ? color : '#444'};margin-top:6px">${eq ? eq.name : '— Empty —'}</div>
            ${statsHtml}
            <div style="margin-top:8px">
                ${eq
                ? `<button data-remove-key="${key}" style="background:#cc2222;color:#fff;border:none;border-radius:5px;padding:5px 12px;font-size:12px;cursor:pointer">Remove</button>`
                : `<div style="color:#555;font-size:11px;margin-top:2px">Drop armor here</div>`}
            </div>`;
        const removeBtn = slotDiv.querySelector('[data-remove-key]');
        if (removeBtn) {
            removeBtn.onclick = () => {
                playerData[key] = null;
                savePlayerData();
                showLoadout();
            };
        }

        // Drag-drop target
        slotDiv.addEventListener('dragover', e => {
            e.preventDefault();
            slotDiv.style.borderStyle = 'solid';
            slotDiv.style.background = 'rgba(255,255,255,0.08)';
        });
        slotDiv.addEventListener('dragleave', () => {
            slotDiv.style.borderStyle = 'dashed';
            slotDiv.style.background = 'rgba(0,0,0,0.55)';
        });
        slotDiv.addEventListener('drop', e => {
            e.preventDefault();
            slotDiv.style.borderStyle = 'dashed';
            slotDiv.style.background = 'rgba(0,0,0,0.55)';
            const armorId = e.dataTransfer.getData('armorId');
            const armorType = e.dataTransfer.getData('armorType');
            if (armorType === slotType) {
                playerData[key] = armorId;
                savePlayerData();
                window._updateTpArmor?.();
                showLoadout();
            } else {
                // Flash red to indicate wrong slot
                slotDiv.style.borderColor = '#ff2222';
                setTimeout(() => { slotDiv.style.borderColor = color; }, 600);
            }
        });
        armorSlotContainer.appendChild(slotDiv);
    }

    armorSection.appendChild(armorSlotContainer);

    // --- Owned Armor Inventory ---
    // Retroactively add any currently-equipped armor that might pre-date ownedArmor tracking
    for (const [eqKey, slotType] of [['equippedHelmet', 'head'], ['equippedArmor', 'armor'], ['equippedPants', 'pants'], ['equippedBoots', 'boots']]) {
        const id = playerData[eqKey];
        if (id && !playerData.ownedArmor.includes(id)) playerData.ownedArmor.push(id);
    }

    if (playerData.ownedArmor.length > 0) {
        const invSection = document.createElement('div');
        invSection.style.cssText = 'margin-top:22px;';
        invSection.innerHTML = '<h4 style="color:#aaa;font-size:16px;text-align:center;margin:0 0 10px">INVENTORY — Drag to equip</h4>';
        const invGrid = document.createElement('div');
        invGrid.style.cssText = 'display:flex;gap:12px;justify-content:center;flex-wrap:wrap;';

        const typeGroups = { head: [], armor: [], pants: [], boots: [] };
        for (const id of playerData.ownedArmor) {
            const eq = EQUIPMENT[id];
            if (eq && typeGroups[eq.type]) typeGroups[eq.type].push(id);
        }

        for (const [type, ids] of Object.entries(typeGroups)) {
            for (const id of ids) {
                const eq = EQUIPMENT[id];
                if (!eq) continue;
                const equippedKey = type === 'head' ? 'equippedHelmet' : type === 'armor' ? 'equippedArmor' : type === 'pants' ? 'equippedPants' : 'equippedBoots';
                const isEquipped = playerData[equippedKey] === id;
                const slotColor = type === 'head' ? '#aa88ff' : type === 'armor' ? '#00aaff' : type === 'pants' ? '#00cc66' : '#ffaa00';

                const card = document.createElement('div');
                card.draggable = true;
                card.style.cssText = `background:rgba(0,0,0,0.6);border:2px solid ${isEquipped ? slotColor : '#555'};border-radius:8px;padding:12px 16px;text-align:center;min-width:130px;cursor:grab;transition:border-color 0.15s,transform 0.1s;`;
                const svg = getArmorSVG(type, eq.name, true);
                let statsHtml2 = '';
                if (eq.armor) statsHtml2 += `<div style="color:#aaa;font-size:11px">+${eq.armor} arm</div>`;
                if (eq.damageReduction) statsHtml2 += `<div style="color:#aaa;font-size:11px">-${eq.damageReduction * 100}% dmg</div>`;
                card.innerHTML = `
                    ${svg}
                    <div style="font-size:13px;font-weight:700;color:${slotColor};margin-top:4px">${eq.name}</div>
                    ${statsHtml2}
                    ${isEquipped ? `<div style="color:${slotColor};font-size:10px;margin-top:4px">✓ EQUIPPED</div>` : ''}
                `;
                card.addEventListener('dragstart', e => {
                    e.dataTransfer.setData('armorId', id);
                    e.dataTransfer.setData('armorType', type);
                    card.style.opacity = '0.5';
                });
                card.addEventListener('dragend', () => { card.style.opacity = '1'; });
                // Also allow click-to-equip as fallback
                card.addEventListener('click', () => {
                    const eqKey = type === 'head' ? 'equippedHelmet' : type === 'armor' ? 'equippedArmor' : type === 'pants' ? 'equippedPants' : 'equippedBoots';
                    playerData[eqKey] = isEquipped ? null : id;
                    savePlayerData();
                    window._updateTpArmor?.();
                    showLoadout();
                });
                invGrid.appendChild(card);
            }
        }
        invSection.appendChild(invGrid);
        armorSection.appendChild(invSection);
    } else {
        const noArmor = document.createElement('p');
        noArmor.style.cssText = 'color:#555;text-align:center;margin-top:12px;font-size:13px;';
        noArmor.textContent = 'No armor owned — visit the Shop to purchase armor.';
        armorSection.appendChild(noArmor);
    }

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
            <span data-pts-label style="color:#ffdd00;margin-left:10px">${playerData.statPoints > 0 ? `${playerData.statPoints} point${playerData.statPoints !== 1 ? 's' : ''} to spend` : ''}</span>
        </div>`;

    const statDefs = [
        { key: 'health', label: 'Health', color: '#00ff88', desc: '+5 max HP per point' },
        { key: 'speed', label: 'Speed', color: '#00aaff', desc: '+2% move speed per point' },
        { key: 'damage', label: 'Damage', color: '#ff4444', desc: '+2% damage & +5% headshot bonus per point' },
        { key: 'stamina', label: 'Stamina', color: '#ffaa00', desc: '+10 max stamina per point' },
        { key: 'staminaRegen', label: 'Stamina Regen', color: '#ffcc44', desc: '+10% regen rate per point' },
        { key: 'jump', label: 'Jump Height', color: '#aa66ff', desc: '+5% jump height per point' },
        { key: 'reload', label: 'Reload Time', color: '#00ddff', desc: '-5% reload time per point' }
    ];

    const statGrid = document.createElement('div');
    statGrid.style.cssText = 'display:flex;gap:16px;justify-content:center;flex-wrap:wrap;';

    for (const { key, label, color, desc } of statDefs) {
        const pts = playerData.stats[key];
        let effectiveLine = '';
        if (key === 'reload' && pts > 0) {
            const mult = Math.max(0.2, 1 - pts * 0.05);
            effectiveLine = `<div style="font-size:11px;color:${color};margin-bottom:4px">${Math.round((1 - mult) * 100)}% faster (${(mult * 100).toFixed(0)}% of base)</div>`;
        }
        const card = document.createElement('div');
        card.style.cssText = `background:rgba(0,0,0,0.5);border:2px solid ${color};border-radius:10px;padding:18px 28px;text-align:center;min-width:170px;`;
        card.innerHTML = `
            <div style="font-size:11px;color:#888;letter-spacing:1px;margin-bottom:6px">${label.toUpperCase()}</div>
            <div data-stat-val style="font-size:28px;font-weight:700;color:${color}">${pts}</div>
            <div style="font-size:11px;color:#666;margin:4px 0 6px">${desc}</div>
            ${effectiveLine}
            <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:4px;">
                <input data-stat-input="${key}" type="number" min="1" max="${Math.max(1, playerData.statPoints)}" value="1"
                    ${playerData.statPoints < 1 ? 'disabled' : ''}
                    style="width:52px;padding:4px 6px;border-radius:5px;border:1px solid ${color};background:#111;color:#fff;font-size:14px;font-weight:700;text-align:center;">
                <button data-stat="${key}" ${playerData.statPoints < 1 ? 'disabled' : ''}
                    style="background:${playerData.statPoints > 0 ? color : '#333'};color:${playerData.statPoints > 0 ? '#000' : '#555'};border:none;border-radius:5px;padding:6px 14px;font-size:14px;font-weight:700;cursor:${playerData.statPoints > 0 ? 'pointer' : 'default'}">
                    + Add
                </button>
            </div>`;
        const btn = card.querySelector('[data-stat]');
        const input = card.querySelector(`[data-stat-input="${key}"]`);
        const ptDisplay = card.querySelector('[data-stat-pts]');
        if (btn && playerData.statPoints > 0) {
            btn.onclick = () => {
                const amount = Math.min(Math.max(1, parseInt(input.value) || 1), playerData.statPoints);
                playerData.statPoints -= amount;
                playerData.stats[key] += amount;
                savePlayerData();

                // Update this card in-place
                card.querySelector('[data-stat-val]').textContent = playerData.stats[key];
                input.max = Math.max(1, playerData.statPoints);
                if (playerData.statPoints < 1) {
                    input.disabled = true;
                    btn.disabled = true;
                    btn.style.background = '#333';
                    btn.style.color = '#555';
                    btn.style.cursor = 'default';
                }

                // Update the reload effective line if needed
                if (key === 'reload') {
                    const mult = Math.max(0.2, 1 - playerData.stats[key] * 0.05);
                    let el = card.querySelector('[data-reload-eff]');
                    if (!el) {
                        el = document.createElement('div');
                        el.dataset.reloadEff = '1';
                        el.style.cssText = `font-size:11px;color:${color};margin-bottom:4px`;
                        card.querySelector('[data-stat-val]').after(el);
                    }
                    el.textContent = `${Math.round((1 - mult) * 100)}% faster (${(mult * 100).toFixed(0)}% of base)`;
                }

                // Update the global points-to-spend label
                const header = document.querySelector('#loadout-stats-section [data-pts-label]');
                if (header) {
                    header.textContent = playerData.statPoints > 0
                        ? `${playerData.statPoints} point${playerData.statPoints !== 1 ? 's' : ''} to spend`
                        : '';
                }
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
        else if (id === 'fortress') bgUrl = 'linear-gradient(135deg, #5a4a3c, #887868)';

        card.style.background = bgUrl;

        const mapImages = {
            warehouse: 'Pictures/warehouse.png',
            desert: 'Pictures/desert.png',
            city: 'Pictures/city.png',
            forest: 'Pictures/forest.png',
            mountain: 'Pictures/mountains.png',
            fortress: 'Pictures/fortress.png',
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
        'ammo': () => { cb.refillAllAmmo(); showCheatMsg('Ammo refilled'); },
        'noclip': () => { playerState.noClip = !playerState.noClip; showCheatMsg('NoClip ' + (playerState.noClip ? 'ON' : 'OFF')); },
        'fly': () => { playerState.flyMode = !playerState.flyMode; showCheatMsg('Fly Mode ' + (playerState.flyMode ? 'ON (Space=up, Shift=down)' : 'OFF')); },
        'kill': () => { cb.killAllEnemies(); showCheatMsg('All enemies killed'); },
        'heal': () => { playerState.hp = playerState.maxHp; showCheatMsg('Healed'); },
        'speed': () => { playerState.speedMult = playerState.speedMult === 1 ? 2 : 1; showCheatMsg('Speed x' + playerState.speedMult); },
        'levelup': () => { const lvls = parseInt(prompt('How many levels?', '1')); if (!isNaN(lvls) && lvls > 0) { playerData.level += lvls; playerData.statPoints += lvls * 5; savePlayerData(); showCheatMsg(`+${lvls} Levels! Now LVL ${playerData.level} (+${lvls * 5} pts)`); } },
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
    { title: 'Combat', body: '<b>Left Click</b> to shoot &bull; <b>Right Click</b> or <b>Z</b> to zoom<br><b>R</b> to reload &bull; Aim for the head for bonus damage!' },
    { title: 'Weapons', body: '<b>1&ndash;9</b> or <b>mouse wheel</b> to switch weapons &bull; <b>C</b> switches forward<br><b>X</b> drops your current weapon &bull; <b>E</b> picks up dropped weapons.' },
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
