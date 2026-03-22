// Weapon view models, switching, dropping, picking up, zoom, reload

import * as THREE from 'three';
import { WEAPONS } from './data.js';
import { playerData, playerState, savePlayerData, gameState } from './state.js';
import { scene, camera, weaponModel, setWeaponModel } from './engine.js';
import { playPickup } from './audio.js';
import { updateHUD, renderWeaponSlots } from './ui.js';

export function createWeaponModel(weaponId) {
    if (weaponModel) camera.remove(weaponModel);
    const w = WEAPONS[weaponId];
    const group = new THREE.Group();

    if (weaponId === 'compass') {
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8 });
        const dialMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const needleMat = new THREE.MeshStandardMaterial({ color: 0xff2222 });

        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16), baseMat);
        base.position.set(0.15, -0.15, -0.3);
        group.add(base);

        const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.022, 16), dialMat);
        dial.position.set(0.15, -0.15, -0.3);
        group.add(dial);

        const needleGeo = new THREE.ConeGeometry(0.012, 0.08, 4);
        needleGeo.rotateX(Math.PI / 2);
        needleGeo.translate(0, 0, 0.035);
        const needle = new THREE.Mesh(needleGeo, needleMat);
        needle.position.set(0.15, -0.135, -0.3);
        needle.name = "needle";
        group.add(needle);
    } else if (w.type === 'melee') {
        buildMeleeModel(group, weaponId, w);
    } else if (w.type === 'throwable') {
        const mat = new THREE.MeshStandardMaterial({ color: weaponId === 'molotov' ? 0x884400 : 0x445544 });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), mat);
        mesh.position.set(0.15, -0.12, -0.3);
        group.add(mesh);
    } else {
        buildGunModel(group, weaponId, w);
    }

    camera.add(group);
    setWeaponModel(group);
}

function buildMeleeModel(group, weaponId, w) {
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.6 });
    if (weaponId === 'fists') {
        const fist = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), skinMat);
        fist.position.set(0.15, -0.12, -0.3);
        group.add(fist);
        const fist2 = fist.clone();
        fist2.position.x = -0.15;
        group.add(fist2);
    } else if (weaponId === 'shield') {
        const shieldMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 });
        const shield = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.05), shieldMat);
        shield.position.set(0.0, -0.1, -0.4);
        group.add(shield);
        // Shield boss (center emblem)
        const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 8), new THREE.MeshStandardMaterial({ color: 0xaa8833, metalness: 0.8 }));
        boss.rotation.x = Math.PI / 2;
        boss.position.set(0.0, -0.1, -0.38);
        group.add(boss);
        const hand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), skinMat);
        hand.position.set(0.1, -0.1, -0.35);
        group.add(hand);
    } else if (weaponId === 'knife') {
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xc8c8c8, metalness: 0.9, roughness: 0.1 });
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.12, 8), handleMat);
        handle.position.set(0.15, -0.15, -0.3);
        handle.rotation.x = -Math.PI / 4;
        group.add(handle);
        // Guard
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.012), new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.7 }));
        guard.position.set(0.15, -0.09, -0.345);
        guard.rotation.x = -Math.PI / 4;
        group.add(guard);
        // Single-edged blade (tapered)
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.24, 0.038), bladeMat);
        blade.position.set(0.15, -0.02, -0.395);
        blade.rotation.x = -Math.PI / 4;
        group.add(blade);
        const hand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), skinMat);
        hand.position.set(0.15, -0.15, -0.3);
        group.add(hand);
    } else if (weaponId === 'chainsaw') {
        const motorMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.5 });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
        const barMat = new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8 });
        const chainMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9 });
        // Motor body
        const motor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.18), motorMat);
        motor.position.set(0.15, -0.18, -0.3);
        group.add(motor);
        // Air vents on motor
        for (let v = 0; v < 3; v++) {
            const vent = new THREE.Mesh(new THREE.BoxGeometry(0.101, 0.01, 0.025), darkMat);
            vent.position.set(0.15, -0.14 + v * 0.025, -0.3);
            group.add(vent);
        }
        // Guide bar
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.44), barMat);
        bar.position.set(0.15, -0.18, -0.53);
        group.add(bar);
        // Chain links along the bar
        for (let c = 0; c < 10; c++) {
            const link = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.006, 4, 5), chainMat);
            link.position.set(0.15, -0.163, -0.315 - c * 0.045);
            link.rotation.x = Math.PI / 2;
            link.rotation.z = (c % 2 === 0) ? 0 : Math.PI / 4;
            group.add(link);
        }
        // Rear handle
        const rearHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 6), darkMat);
        rearHandle.rotation.x = Math.PI / 2;
        rearHandle.position.set(0.15, -0.13, -0.17);
        group.add(rearHandle);
        const hand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), skinMat);
        hand.position.set(0.15, -0.15, -0.25);
        group.add(hand);
    } else if (weaponId === 'katana') {
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x2a1a08, roughness: 0.85 });
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xdcdcdc, metalness: 0.95, roughness: 0.04 });
        const guardMat = new THREE.MeshStandardMaterial({ color: 0xcc9920, metalness: 0.6 });
        // Long thin blade
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.92, 0.032), bladeMat);
        blade.position.set(0.15, 0.22, -0.67);
        blade.rotation.x = -Math.PI / 4;
        group.add(blade);
        // Blood groove (darker strip on blade)
        const groove = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.85, 0.008), new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.7 }));
        groove.position.set(0.151, 0.22, -0.67);
        groove.rotation.x = -Math.PI / 4;
        group.add(groove);
        // Tsuba (guard)
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.018, 0.018), guardMat);
        guard.position.set(0.15, -0.095, -0.355);
        guard.rotation.x = -Math.PI / 4;
        group.add(guard);
        // Tsuka (handle) with wrap
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.24, 8), woodMat);
        handle.position.set(0.15, -0.225, -0.275);
        handle.rotation.x = -Math.PI / 4;
        group.add(handle);
        // Handle wrap lines
        for (let r = 0; r < 4; r++) {
            const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 4, 8), new THREE.MeshStandardMaterial({ color: 0x111111 }));
            wrap.rotation.y = Math.PI / 2;
            wrap.position.set(0.15, -0.19 - r * 0.032, -0.3 + r * 0.032);
            wrap.rotation.x = -Math.PI / 4;
            group.add(wrap);
        }
        const hand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), skinMat);
        hand.position.set(0.15, -0.18, -0.28);
        group.add(hand);
    } else if (weaponId === 'longsword') {
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.8 });
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xc8c8c8, metalness: 0.88, roughness: 0.12 });
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xcc9933, metalness: 0.75 });
        // Wide long blade with fuller
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.72, 0.14), bladeMat);
        blade.position.set(0.15, 0.1, -0.58);
        blade.rotation.x = -Math.PI / 4;
        group.add(blade);
        // Fuller (groove down center of blade)
        const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.6, 0.025), new THREE.MeshStandardMaterial({ color: 0xaaaaaa }));
        fuller.position.set(0.15, 0.1, -0.58);
        fuller.rotation.x = -Math.PI / 4;
        group.add(fuller);
        // Cross-guard
        const crossGuard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.028, 0.028), goldMat);
        crossGuard.position.set(0.15, -0.1, -0.375);
        crossGuard.rotation.x = -Math.PI / 4;
        group.add(crossGuard);
        // Cross-guard ends (spheres)
        for (const xOff of [-0.13, 0.13]) {
            const tip = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), goldMat);
            tip.position.set(0.15 + xOff, -0.1, -0.375);
            group.add(tip);
        }
        // Handle
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.28, 8), woodMat);
        handle.position.set(0.15, -0.225, -0.278);
        handle.rotation.x = -Math.PI / 4;
        group.add(handle);
        // Pommel
        const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.038, 7, 7), goldMat);
        pommel.position.set(0.15, -0.31, -0.225);
        group.add(pommel);
        const hand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), skinMat);
        hand.position.set(0.15, -0.18, -0.29);
        group.add(hand);
    } else if (weaponId === 'axe') {
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.85 });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.82 });
        // Handle
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.5, 8), woodMat);
        handle.position.set(0.15, -0.1, -0.44);
        handle.rotation.x = -Math.PI / 4;
        group.add(handle);
        // Axe head (wide blade)
        const axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.24, 0.12), metalMat);
        axeHead.position.set(0.15, 0.16, -0.63);
        axeHead.rotation.x = -Math.PI / 4;
        group.add(axeHead);
        // Edge bevel
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.22, 0.04), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.95 }));
        edge.position.set(0.15, 0.16, -0.69);
        edge.rotation.x = -Math.PI / 4;
        group.add(edge);
        const hand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), skinMat);
        hand.position.set(0.15, -0.18, -0.3);
        group.add(hand);
    } else {
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x4a3520 }));
        handle.position.set(0.15, -0.2, -0.35);
        handle.rotation.x = -Math.PI / 4;
        group.add(handle);
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.08), new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.7 }));
        blade.position.set(0.15, 0.05, -0.55);
        blade.rotation.x = -Math.PI / 4;
        group.add(blade);
        const hand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), skinMat);
        hand.position.set(0.15, -0.15, -0.32);
        group.add(hand);
    }
}

// Gun model config per weapon type
const GUN_CONFIGS = {
    glock: { bodyColor: 0x2a2a2a, accentColor: 0x1a1a1a, bodyLen: 0.2, bodyH: 0.035 },
    revolver: { bodyColor: 0x6B6B6B, accentColor: 0x3a2010, metalColor: 0x888888, bodyLen: 0.22, bodyH: 0.045, barrelRadius: 0.012 },
    shotgun: { bodyColor: 0x2a2a2a, accentColor: 0x5a3520, bodyLen: 0.45, barrelLen: 0.2, barrelRadius: 0.012 },
    assault_rifle: { bodyColor: 0x2d2d2d, accentColor: 0x3a3a3a, bodyLen: 0.5, bodyW: 0.035, barrelLen: 0.18 },
    sniper: { bodyColor: 0x1a2a1a, accentColor: 0x2a1a10, bodyLen: 0.55, bodyH: 0.035, barrelLen: 0.25, barrelRadius: 0.006 },
    minigun: { bodyColor: 0x3a3a3a, accentColor: 0x2a2a2a, metalColor: 0x666666, bodyLen: 0.55, bodyH: 0.06, bodyW: 0.05, barrelLen: 0.2, barrelRadius: 0.015 },
    rpg: { bodyColor: 0x4a5a3a, accentColor: 0x3a3a2a, bodyLen: 0.5, bodyH: 0.06, bodyW: 0.05, barrelLen: 0.15, barrelRadius: 0.025 },
    crossbow: { bodyColor: 0x3a2a1a, accentColor: 0x2a1a0a, bodyLen: 0.3, bodyH: 0.03 },
};

function buildGunModel(group, weaponId, w) {
    const cfg = GUN_CONFIGS[weaponId] || {};
    const bodyColor = cfg.bodyColor || 0x333333;
    const accentColor = cfg.accentColor || 0x4a3520;
    const metalColor = cfg.metalColor || 0x555555;
    const bodyLen = cfg.bodyLen || 0.3;
    const bodyH = cfg.bodyH || 0.04;
    const bodyW = cfg.bodyW || 0.03;
    const barrelLen = cfg.barrelLen || 0.15;
    const barrelRadius = cfg.barrelRadius || 0.008;

    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.4, metalness: 0.6 });
    const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.7 });
    const metalMat = new THREE.MeshStandardMaterial({ color: metalColor, roughness: 0.2, metalness: 0.8 });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyLen), bodyMat);
    body.position.set(0.15, -0.12, -0.35);
    group.add(body);

    // Grip
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.08, 0.025), accentMat);
    handle.position.set(0.15, -0.18, -0.25);
    handle.rotation.x = -0.3;
    group.add(handle);

    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(barrelRadius, barrelRadius, barrelLen, 8), metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.15, -0.11, -0.35 - bodyLen / 2 - barrelLen / 2);
    group.add(barrel);

    // Hand
    const handMat = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.6 });
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), handMat);
    hand.position.set(0.15, -0.16, -0.22);
    group.add(hand);

    // Weapon-specific details
    buildGunDetails(group, weaponId, bodyMat, accentMat, metalMat);

    // Silencer visual
    if ((playerData.weaponAttachments[weaponId] || []).includes('silencer')) {
        const silencer = new THREE.Mesh(
            new THREE.CylinderGeometry(0.015, 0.015, 0.1, 8),
            new THREE.MeshStandardMaterial({ color: 0x222222 })
        );
        silencer.rotation.x = Math.PI / 2;
        silencer.position.set(0.15, -0.11, -0.68);
        group.add(silencer);
    }

    // Scope visual
    if (w.hasScope || (playerData.weaponAttachments[weaponId] || []).includes('scope')) {
        const scope = new THREE.Mesh(
            new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8),
            new THREE.MeshStandardMaterial({ color: 0x111111 })
        );
        scope.position.set(0.15, -0.075, -0.35);
        group.add(scope);
    }
}

function buildGunDetails(group, weaponId, bodyMat, accentMat, metalMat) {
    if (weaponId === 'shotgun') {
        const pump = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 0.08), accentMat);
        pump.position.set(0.15, -0.13, -0.48);
        group.add(pump);
    } else if (weaponId === 'assault_rifle') {
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.025), bodyMat);
        mag.position.set(0.15, -0.17, -0.35);
        mag.rotation.x = -0.1;
        group.add(mag);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.04, 0.1), accentMat);
        stock.position.set(0.15, -0.12, -0.12);
        group.add(stock);
    } else if (weaponId === 'sniper') {
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.045, 0.12), accentMat);
        stock.position.set(0.15, -0.12, -0.1);
        group.add(stock);
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.05, 0.02), bodyMat);
        mag.position.set(0.15, -0.16, -0.35);
        group.add(mag);
    } else if (weaponId === 'minigun') {
        for (let b = 0; b < 4; b++) {
            const angle = (b / 4) * Math.PI * 2;
            const extraBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 6), metalMat);
            extraBarrel.rotation.x = Math.PI / 2;
            extraBarrel.position.set(0.15 + Math.cos(angle) * 0.015, -0.11 + Math.sin(angle) * 0.015, -0.68);
            group.add(extraBarrel);
        }
    } else if (weaponId === 'rpg') {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.08, 8), metalMat);
        tube.rotation.x = Math.PI / 2;
        tube.position.set(0.15, -0.11, -0.63);
        group.add(tube);
    } else if (weaponId === 'crossbow') {
        const armMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.5 });
        const leftCBArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.008, 0.008), armMat);
        leftCBArm.position.set(0.08, -0.11, -0.5);
        leftCBArm.rotation.z = 0.2;
        group.add(leftCBArm);
        const rightCBArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.008, 0.008), armMat);
        rightCBArm.position.set(0.22, -0.11, -0.5);
        rightCBArm.rotation.z = -0.2;
        group.add(rightCBArm);
    } else if (weaponId === 'revolver') {
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 8), metalMat);
        cyl.position.set(0.15, -0.11, -0.32);
        group.add(cyl);
    }
}

// --- Weapon state helpers ---

export function getCurrentWeapon() {
    if (!playerState.weapons || playerState.weapons.length === 0) {
        playerState.weapons = ['fists'];
        playerState.currentWeaponIndex = 0;
    }
    const id = playerState.weapons[playerState.currentWeaponIndex] || playerState.weapons[0];
    const def = WEAPONS[id] || WEAPONS.fists;
    if (!playerState.weaponStates[id]) {
        playerState.weaponStates[id] = {
            ammo: def.maxAmmo || Infinity, reserveAmmo: def.reserveAmmo || 0,
            lastFired: 0, reloading: false, reloadStart: 0
        };
    }
    return { id, def, state: playerState.weaponStates[id] };
}

export function hasSilencer(weaponId) {
    return (playerData.weaponAttachments[weaponId] || []).includes('silencer');
}

export function hasScope(weaponId) {
    return WEAPONS[weaponId].hasScope || (playerData.weaponAttachments[weaponId] || []).includes('scope');
}

export function switchWeapon(index) {
    if (index < 0 || index >= playerState.weapons.length) return;
    playerState.currentWeaponIndex = index;
    if (playerState.isZoomed) toggleZoom();
    createWeaponModel(playerState.weapons[index]);
    updateHUD();
    renderWeaponSlots();
}

export function toggleZoom() {
    const { id, def } = getCurrentWeapon();
    if (playerState.isZoomed) {
        playerState.isZoomed = false;
        camera.fov = 75;
        document.getElementById('scope-overlay').style.display = 'none';
        document.getElementById('crosshair').style.display = 'block';
        camera.updateProjectionMatrix();
        return;
    }
    if (!hasScope(id) && !def.hasScope) return;
    playerState.isZoomed = true;
    camera.fov = 20;
    document.getElementById('scope-overlay').style.display = 'block';
    document.getElementById('crosshair').style.display = 'none';
    camera.updateProjectionMatrix();
}

export function reload() {
    const { id, def, state } = getCurrentWeapon();
    if (def.type === 'melee' || state.reloading) return;
    if (state.ammo === def.maxAmmo || state.reserveAmmo <= 0) return;
    state.reloading = true;
    state.reloadStart = performance.now() / 1000;
    document.querySelector('#weapon-hud .reload-text').style.display = 'block';
}

export function updateReload() {
    for (const wid of playerState.weapons) {
        const state = playerState.weaponStates[wid];
        if (!state.reloading) continue;
        const def = WEAPONS[wid];
        if (performance.now() / 1000 - state.reloadStart >= def.reloadTime) {
            const needed = def.maxAmmo - state.ammo;
            const available = Math.min(needed, state.reserveAmmo);
            state.ammo += available;
            state.reserveAmmo -= available;
            state.reloading = false;
            if (wid === playerState.weapons[playerState.currentWeaponIndex]) {
                document.querySelector('#weapon-hud .reload-text').style.display = 'none';
            }
            updateHUD();
        }
    }
}

export function refillAllAmmo() {
    for (const wid of playerState.weapons) {
        const def = WEAPONS[wid];
        const state = playerState.weaponStates[wid];
        state.ammo = def.maxAmmo;
        state.reserveAmmo = def.reserveAmmo;
    }
    updateHUD();
}

export function dropCurrentWeapon() {
    if (playerState.weapons.length <= 1) return;
    const id = playerState.weapons[playerState.currentWeaponIndex];
    if (id === 'fists' || id === 'compass') return;

    const pos = camera.position.clone();
    pos.y = 0.3;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    pos.add(dir.multiplyScalar(2));
    dropWeapon(id, pos);

    playerState.weapons.splice(playerState.currentWeaponIndex, 1);
    delete playerState.weaponStates[id];
    playerState.currentWeaponIndex = Math.min(playerState.currentWeaponIndex, playerState.weapons.length - 1);
    switchWeapon(playerState.currentWeaponIndex);
}

export function dropWeapon(weaponId, position) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x888888, emissive: 0x222222 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.15), mat);
    mesh.position.copy(position);
    mesh.position.y = 0.3;
    scene.add(mesh);
    gameState.droppedWeapons.push({ mesh, weaponId });
}

export function pickupWeapon(dropped) {
    if (gameState.mode === 'rescue' && dropped.weaponId === 'shield') return;
    if (playerState.weapons.length >= playerState.maxSlots) return;
    if (playerState.weapons.includes(dropped.weaponId)) return;

    playerState.weapons.push(dropped.weaponId);
    const def = WEAPONS[dropped.weaponId];
    playerState.weaponStates[dropped.weaponId] = {
        ammo: def.maxAmmo, reserveAmmo: Math.floor(def.reserveAmmo / 2),
        lastFired: 0, reloading: false, reloadStart: 0
    };
    scene.remove(dropped.mesh);
    gameState.droppedWeapons.splice(gameState.droppedWeapons.indexOf(dropped), 1);
    playPickup();
    renderWeaponSlots();
    updateHUD();
}
