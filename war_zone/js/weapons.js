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
    } else if (weaponId === 'flashlight') {
        const _flBodyMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.3 });
        const _flLensMat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffff88, emissiveIntensity: 3.0 });
        const _flBody = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.2, 8), _flBodyMat);
        _flBody.rotation.x = Math.PI / 2;
        _flBody.position.set(0.15, -0.15, -0.35);
        group.add(_flBody);
        const _flLens = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.024, 0.018, 8), _flLensMat);
        _flLens.rotation.x = Math.PI / 2;
        _flLens.position.set(0.15, -0.15, -0.46);
        group.add(_flLens);
        const _flHand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.6 }));
        _flHand.position.set(0.15, -0.15, -0.27);
        group.add(_flHand);
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
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xb8b8b8, metalness: 0.92, roughness: 0.08 });
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
        const tsubaMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.5 });
        // Blade — thin but with substantial Z so the flat face shows in first-person
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.66, 0.08), bladeMat);
        blade.position.set(0.15, 0.08, -0.58);
        blade.rotation.x = -Math.PI / 4;
        group.add(blade);
        // Tsuba — flat disc, rotation.x = -PI/4 aligns it perpendicular to blade length
        const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.050, 0.050, 0.014, 12), tsubaMat);
        guard.position.set(0.15, -0.10, -0.36);
        guard.rotation.x = -Math.PI / 4;
        group.add(guard);
        // Handle
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.020, 0.22, 8), handleMat);
        handle.position.set(0.15, -0.22, -0.27);
        handle.rotation.x = -Math.PI / 4;
        group.add(handle);
        // Wrap rings
        for (let r = 0; r < 5; r++) {
            const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.005, 4, 8),
                new THREE.MeshStandardMaterial({ color: r % 2 === 0 ? 0x333333 : 0x000000 }));
            wrap.rotation.y = Math.PI / 2;
            wrap.position.set(0.15, -0.155 - r * 0.028, -0.310 + r * 0.028);
            wrap.rotation.x = -Math.PI / 4;
            group.add(wrap);
        }
        // Pommel
        const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), tsubaMat);
        pommel.position.set(0.15, -0.335, -0.215);
        group.add(pommel);
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
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.7 });
        const stockMat = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.85 }); // dark wood stock

        // Cheekrest / rear stock (wood-tone)
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.06, 0.18), stockMat);
        stock.position.set(0.15, -0.105, -0.06);
        group.add(stock);

        // Buttstock flare
        const butt = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.075, 0.04), stockMat);
        butt.position.set(0.15, -0.108, 0.04);
        group.add(butt);

        // Detachable box magazine (large, curved)
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.075, 0.038), darkMat);
        mag.position.set(0.15, -0.185, -0.30);
        mag.rotation.x = -0.12;
        group.add(mag);

        // Bolt handle (sticks out to the right)
        const boltShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.045, 6), darkMat);
        boltShaft.rotation.z = Math.PI / 2;
        boltShaft.position.set(0.185, -0.095, -0.28);
        group.add(boltShaft);
        const boltKnob = new THREE.Mesh(new THREE.SphereGeometry(0.010, 6, 6), darkMat);
        boltKnob.position.set(0.200, -0.095, -0.28);
        group.add(boltKnob);

        // Large tactical scope body
        const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.20, 10), darkMat);
        scopeBody.rotation.x = Math.PI / 2;
        scopeBody.position.set(0.15, -0.065, -0.32);
        group.add(scopeBody);

        // Scope objective lens (front bell)
        const scopeFront = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.04, 10), darkMat);
        scopeFront.rotation.x = Math.PI / 2;
        scopeFront.position.set(0.15, -0.065, -0.44);
        group.add(scopeFront);

        // Scope ocular (rear bell)
        const scopeRear = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.03, 10), darkMat);
        scopeRear.rotation.x = Math.PI / 2;
        scopeRear.position.set(0.15, -0.065, -0.21);
        group.add(scopeRear);

        // Scope mount rail rings (2)
        for (const mz of [-0.26, -0.38]) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.020, 0.005, 6, 12), darkMat);
            ring.rotation.y = Math.PI / 2;
            ring.position.set(0.15, -0.065, mz);
            group.add(ring);
        }

        // Bipod legs (folded forward, angling down)
        const bipodMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.5 });
        for (const bx of [0.128, 0.172]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.10, 6), bipodMat);
            leg.rotation.z = (bx < 0.15 ? 0.5 : -0.5);
            leg.position.set(bx, -0.16, -0.55);
            group.add(leg);
            // Foot tip
            const tip = new THREE.Mesh(new THREE.SphereGeometry(0.006, 4, 4), bipodMat);
            tip.position.set(bx + (bx < 0.15 ? -0.04 : 0.04), -0.205, -0.55);
            group.add(tip);
        }

        // Muzzle brake at end of barrel
        const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.010, 0.035, 8), darkMat);
        muzzle.rotation.x = Math.PI / 2;
        muzzle.position.set(0.15, -0.11, -0.76);
        group.add(muzzle);
    } else if (weaponId === 'minigun') {
        const housingMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.35, metalness: 0.75 });
        // Cylindrical rotating-barrel housing (replaces the boxy body visually)
        const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.48, 14), housingMat);
        housing.rotation.x = Math.PI / 2;
        housing.position.set(0.15, -0.11, -0.37);
        group.add(housing);
        // 6 barrels in hexagonal arrangement
        for (let b = 0; b < 6; b++) {
            const angle = (b / 6) * Math.PI * 2;
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.28, 6), metalMat);
            barrel.rotation.x = Math.PI / 2;
            barrel.position.set(0.15 + Math.cos(angle) * 0.022, -0.11 + Math.sin(angle) * 0.022, -0.71);
            group.add(barrel);
        }
        // Muzzle cluster plate
        const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.040, 0.040, 0.016, 12), housingMat);
        muzzle.rotation.x = Math.PI / 2;
        muzzle.position.set(0.15, -0.11, -0.858);
        group.add(muzzle);
        // Rear sight base + post
        const sightBase = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.010, 0.04), metalMat);
        sightBase.position.set(0.15, -0.063, -0.35);
        group.add(sightBase);
        const sightPost = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.022, 0.005), metalMat);
        sightPost.position.set(0.15, -0.046, -0.35);
        group.add(sightPost);
        // Front sight
        const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.018, 0.005), metalMat);
        frontSight.position.set(0.15, -0.050, -0.58);
        group.add(frontSight);
        // Ammo belt/chute draping down
        const beltMat = new THREE.MeshStandardMaterial({ color: 0x888833, metalness: 0.4 });
        for (let i = 0; i < 8; i++) {
            const link = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.013, 0.022), beltMat);
            link.position.set(0.15 + i * 0.005, -0.20 - i * 0.022, -0.30 - i * 0.006);
            link.rotation.z = i * 0.18;
            group.add(link);
        }
    } else if (weaponId === 'rpg') {
        const oliveMat = new THREE.MeshStandardMaterial({ color: 0x7a6a2a, roughness: 0.75 });
        const dkMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.6 });
        // Main cylindrical tube (overlays the generic box body)
        const mainTube = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.50, 10), oliveMat);
        mainTube.rotation.x = Math.PI / 2;
        mainTube.position.set(0.15, -0.11, -0.35);
        group.add(mainTube);
        // Rear exhaust bell — wider at back
        const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.028, 0.18, 12), oliveMat);
        bell.rotation.x = Math.PI / 2;
        bell.position.set(0.15, -0.11, -0.01);
        group.add(bell);
        // Trigger housing + pistol grip
        const trigHousing = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.024, 0.052), dkMat);
        trigHousing.position.set(0.15, -0.136, -0.46);
        group.add(trigHousing);
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.058, 0.022), dkMat);
        grip.position.set(0.15, -0.172, -0.47);
        grip.rotation.x = -0.22;
        group.add(grip);
        // Reinforcement bands
        for (const bz of [-0.24, -0.44]) {
            const band = new THREE.Mesh(new THREE.TorusGeometry(0.030, 0.006, 6, 12), dkMat);
            band.rotation.y = Math.PI / 2;
            band.position.set(0.15, -0.11, bz);
            group.add(band);
        }
        // Rear iron sight (base + post)
        const sBase = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.010, 0.028), dkMat);
        sBase.position.set(0.15, -0.076, -0.37);
        group.add(sBase);
        const sPost = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.022, 0.004), dkMat);
        sPost.position.set(0.15, -0.057, -0.37);
        group.add(sPost);
        // Front sight
        const fSight = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.016, 0.004), dkMat);
        fSight.position.set(0.15, -0.078, -0.60);
        group.add(fSight);
        // Warhead / rocket tip
        const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.10, 8), oliveMat);
        warhead.rotation.x = Math.PI / 2;
        warhead.position.set(0.15, -0.11, -0.80);
        group.add(warhead);
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
        // Restore 3rd person if we were in it before zooming
        if (window._wasThirdPersonBeforeZoom) {
            window._wasThirdPersonBeforeZoom = false;
            window._toggleThirdPerson?.();
        }
        return;
    }
    if (!hasScope(id) && !def.hasScope) return;
    playerState.isZoomed = true;
    // If in 3rd person, temporarily switch to 1st person for the scope view
    if (window._isThirdPerson?.()) {
        window._wasThirdPersonBeforeZoom = true;
        window._toggleThirdPerson?.();
    }
    camera.fov = 20;
    document.getElementById('scope-overlay').style.display = 'block';
    document.getElementById('crosshair').style.display = 'none';
    camera.updateProjectionMatrix();
}
window._toggleZoom = toggleZoom;

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
        const reloadMult = Math.max(0.2, 1 - (playerData.stats?.reload || 0) * 0.05);
        if (performance.now() / 1000 - state.reloadStart >= def.reloadTime * reloadMult) {
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
    if (id === 'fists' || id === 'compass' || id === 'flashlight') return;

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

// ── Dropped-weapon model builders ────────────────────────────────────────────
// Parts are centred at local origin; body runs along the Z axis.
// The group is placed in world space by dropWeapon with a random Y rotation.

function _buildDroppedGunGroup(group, weaponId) {
    const cfg = GUN_CONFIGS[weaponId] || {};
    const bodyColor = cfg.bodyColor || 0x333333;
    const accentColor = cfg.accentColor || 0x4a3520;
    const metalColor = cfg.metalColor || 0x555555;
    const bodyLen = cfg.bodyLen || 0.30;
    const bodyH = cfg.bodyH || 0.040;
    const bodyW = cfg.bodyW || 0.030;
    const barrelLen = cfg.barrelLen || 0.15;
    const barrelR = cfg.barrelRadius || 0.008;

    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.4, metalness: 0.6 });
    const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.7 });
    const metalMat = new THREE.MeshStandardMaterial({ color: metalColor, roughness: 0.2, metalness: 0.8 });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyLen), bodyMat);
    group.add(body);

    // Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.08, 0.025), accentMat);
    grip.position.set(0, -bodyH / 2 - 0.04, bodyLen * 0.1);
    grip.rotation.x = -0.3;
    group.add(grip);

    // Main barrel
    if (weaponId !== 'minigun') {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(barrelR, barrelR, barrelLen, 8), metalMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0, bodyLen / 2 + barrelLen / 2);
        group.add(barrel);
    }

    // Per-weapon extras
    if (weaponId === 'shotgun') {
        const pump = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 1.4, bodyH * 0.65, 0.08), accentMat);
        pump.position.set(0, -bodyH * 0.2, bodyLen * 0.12);
        group.add(pump);
    } else if (weaponId === 'assault_rifle') {
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.07, 0.025), bodyMat);
        mag.position.set(0, -bodyH / 2 - 0.035, bodyLen * 0.1);
        group.add(mag);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.85, bodyH * 1.2, 0.10), accentMat);
        stock.position.set(0, 0, -bodyLen / 2 - 0.05);
        group.add(stock);
    } else if (weaponId === 'sniper') {
        const stock = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.85, bodyH * 1.2, 0.12), accentMat);
        stock.position.set(0, 0, -bodyLen / 2 - 0.06);
        group.add(stock);
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.05, 0.02), bodyMat);
        mag.position.set(0, -bodyH / 2 - 0.025, bodyLen * 0.1);
        group.add(mag);
        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8),
            new THREE.MeshStandardMaterial({ color: 0x111111 }));
        scope.position.set(0, bodyH / 2 + 0.012, 0);
        group.add(scope);
    } else if (weaponId === 'minigun') {
        const housingMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.35, metalness: 0.75 });
        const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, bodyLen * 0.82, 14), housingMat);
        housing.rotation.x = Math.PI / 2;
        group.add(housing);
        for (let b = 0; b < 6; b++) {
            const angle = (b / 6) * Math.PI * 2;
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, barrelLen, 6), metalMat);
            barrel.rotation.x = Math.PI / 2;
            barrel.position.set(Math.cos(angle) * 0.022, Math.sin(angle) * 0.022, bodyLen / 2 + barrelLen / 2);
            group.add(barrel);
        }
        const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.040, 0.040, 0.016, 12), housingMat);
        muzzle.rotation.x = Math.PI / 2;
        muzzle.position.set(0, 0, bodyLen / 2 + barrelLen + 0.008);
        group.add(muzzle);
        const beltMat = new THREE.MeshStandardMaterial({ color: 0x888833, metalness: 0.4 });
        for (let i = 0; i < 6; i++) {
            const link = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.013, 0.022), beltMat);
            link.position.set(-i * 0.008, -0.06 - i * 0.022, -bodyLen * 0.2 + i * 0.01);
            link.rotation.z = i * 0.18;
            group.add(link);
        }
    } else if (weaponId === 'rpg') {
        const oliveMat = new THREE.MeshStandardMaterial({ color: 0x7a6a2a, roughness: 0.75 });
        const dkMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.6 });
        // Main tube
        const mainTube = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, bodyLen, 10), oliveMat);
        mainTube.rotation.x = Math.PI / 2;
        group.add(mainTube);
        // Rear exhaust bell
        const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.028, 0.18, 12), oliveMat);
        bell.rotation.x = Math.PI / 2;
        bell.position.set(0, 0, -bodyLen / 2 - 0.09);
        group.add(bell);
        // Reinforcement bands
        for (const bz of [bodyLen * 0.2, -bodyLen * 0.15]) {
            const band = new THREE.Mesh(new THREE.TorusGeometry(0.030, 0.006, 6, 12), dkMat);
            band.rotation.y = Math.PI / 2;
            band.position.set(0, 0, bz);
            group.add(band);
        }
        // Grip
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.055, 0.022), dkMat);
        grip.position.set(0, -0.05, bodyLen * 0.15);
        grip.rotation.x = -0.22;
        group.add(grip);
        // Warhead tip at front
        const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.10, 8), oliveMat);
        warhead.rotation.x = Math.PI / 2;
        warhead.position.set(0, 0, bodyLen / 2 + barrelLen + 0.05);
        group.add(warhead);
    } else if (weaponId === 'revolver') {
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 8), metalMat);
        cyl.position.set(0, 0, 0);
        group.add(cyl);
    } else if (weaponId === 'crossbow') {
        const armMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.5 });
        [-0.075, 0.075].forEach(xOff => {
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.008, 0.008), armMat);
            arm.position.set(xOff, 0, bodyLen / 2 - 0.08);
            arm.rotation.z = xOff < 0 ? 0.2 : -0.2;
            group.add(arm);
        });
    }
}

function _buildDroppedMeleeGroup(group, weaponId) {
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xc8c8c8, metalness: 0.9, roughness: 0.1 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.85 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.6 });

    if (weaponId === 'fists') {
        group.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.10, 0.10), skinMat));
    } else if (weaponId === 'knife') {
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.12, 8),
            new THREE.MeshStandardMaterial({ color: 0x111111 }));
        handle.rotation.x = Math.PI / 2; handle.position.z = -0.06; group.add(handle);
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.010, 0.24), metalMat);
        blade.position.z = 0.12; group.add(blade);
    } else if (weaponId === 'chainsaw') {
        const motorMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.5 });
        const motor = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.09, 0.18), motorMat);
        motor.position.z = -0.10; group.add(motor);
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.40),
            new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8 }));
        bar.position.z = 0.20; group.add(bar);
    } else if (weaponId === 'katana') {
        const kHandleMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
        const kTsubaMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.4 });
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.021, 0.24, 8), kHandleMat);
        handle.rotation.x = Math.PI / 2; handle.position.z = -0.25; group.add(handle);
        // Wrap rings
        for (let r = 0; r < 5; r++) {
            const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 4, 8),
                new THREE.MeshStandardMaterial({ color: r % 2 === 0 ? 0x222222 : 0x000000 }));
            wrap.rotation.y = Math.PI / 2; wrap.position.z = -0.15 - r * 0.042; group.add(wrap);
        }
        // Tsuba — round dark disc
        const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.012, 12), kTsubaMat);
        guard.rotation.z = Math.PI / 2; guard.position.z = -0.10; group.add(guard);
        // Pommel
        const pommel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.022, 8), kTsubaMat);
        pommel.rotation.x = Math.PI / 2; pommel.position.z = -0.38; group.add(pommel);
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.011, 0.90),
            new THREE.MeshStandardMaterial({ color: 0xb8b8b8, metalness: 0.92, roughness: 0.08 }));
        blade.position.z = 0.35; group.add(blade);
    } else if (weaponId === 'longsword') {
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xcc9933, metalness: 0.75 });
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.28, 8), woodMat);
        handle.rotation.x = Math.PI / 2; handle.position.z = -0.27; group.add(handle);
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.028, 0.028), goldMat);
        guard.position.z = -0.10; group.add(guard);
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.052, 0.72), metalMat);
        blade.position.z = 0.27; group.add(blade);
    } else if (weaponId === 'axe') {
        const axeMetal = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.82 });
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.50, 8), woodMat);
        handle.rotation.x = Math.PI / 2; group.add(handle);
        const axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.068), axeMetal);
        axeHead.position.z = 0.30; group.add(axeHead);
    } else if (weaponId === 'shield') {
        const face = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.60, 0.05),
            new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 }));
        group.add(face);
        const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 8),
            new THREE.MeshStandardMaterial({ color: 0xaa8833, metalness: 0.8 }));
        boss.rotation.x = Math.PI / 2; boss.position.z = 0.05; group.add(boss);
    } else {
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.30, 8), woodMat);
        handle.rotation.x = Math.PI / 2; handle.position.z = -0.15; group.add(handle);
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.50), metalMat);
        blade.position.z = 0.25; group.add(blade);
    }
}

function _buildDroppedThrowableGroup(group, weaponId) {
    const col = weaponId === 'molotov' ? 0x884400 : 0x445544;
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8),
        new THREE.MeshStandardMaterial({ color: col })));
}

function buildDroppedWeaponGroup(weaponId) {
    const w = WEAPONS[weaponId];
    const group = new THREE.Group();
    if (!w) return group;
    if (w.type === 'melee' || weaponId === 'fists') {
        _buildDroppedMeleeGroup(group, weaponId);
    } else if (w.type === 'throwable') {
        _buildDroppedThrowableGroup(group, weaponId);
    } else {
        _buildDroppedGunGroup(group, weaponId);
    }
    return group;
}

export function dropWeapon(weaponId, position) {
    const group = buildDroppedWeaponGroup(weaponId);
    group.position.copy(position);
    group.position.y = 0.08;                        // float just above ground
    group.rotation.y = Math.random() * Math.PI * 2; // random facing direction
    group.rotation.z = (Math.random() - 0.5) * 0.25; // slight tilt as if dropped
    scene.add(group);
    gameState.droppedWeapons.push({ mesh: group, weaponId });
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
