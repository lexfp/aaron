// Main entry point: game loop, start/quit, collision, initialization

import * as THREE from 'three';
import { WEAPONS, EQUIPMENT, MAPS } from './data.js';
import { playerData, playerState, resetPlayerState, savePlayerData, gameState } from './state.js';
import { playPickup } from './audio.js';
import {
    scene, camera, renderer, controls, velocity, direction, keys,
    canJump, setCanJump, obstacles, moveSpeed, sprintMult, jumpForce, gravity,
    weaponModel, weaponSwingTime, setWeaponSwingTime
} from './engine.js';
import { buildMap, spawnSinglePickup, spawnExtractionZone, updateCityChunks, updateForestChunks, updateMountainChunks, updateDesertChunks } from './map.js';
import {
    showScreen, updateHomeStats, showShop, showLoadout,
    renderMapScreen, updateHUD, renderWeaponSlots,
    showRoundOverlay, buildCheats, initTutorial
} from './ui.js';
import { createWeaponModel, getCurrentWeapon, switchWeapon, updateReload, refillAllAmmo } from './weapons.js';
import { spawnPvPEnemy, updatePvPEnemy, killZombie, spawnZombie, updateZombies, spawnHostage } from './entities.js';
import { shoot, updateFireZones, checkPvPEnd, damagePlayer, updateTracers } from './combat.js';
import { setupInput, checkInteractionPrompt, isMouseDown } from './input.js';
import { register } from './callbacks.js';

// --- Register callbacks to break circular deps ---

register('quitToMenu', () => quitToMenu());
register('refillAllAmmo', () => refillAllAmmo());
register('killAllEnemies', () => killAllEnemies());

// --- Cheats ---

const CHEATS = buildCheats();

function killAllEnemies() {
    for (let i = gameState.zombieEntities.length - 1; i >= 0; i--) {
        killZombie(gameState.zombieEntities[i], i);
    }
    if (gameState.pvpEnemy) {
        gameState.pvpEnemy.hp = 0;
        gameState.pvpPlayerScore++;
        checkPvPEnd();
    }
}

// --- Collision ---

function checkCollision(newPos) {
    if (playerState.godMode || playerState.noClip) return false;
    const size = gameState.currentMap ? MAPS[gameState.currentMap].size * 0.95 : 50;
    if (Math.abs(newPos.x) > size || Math.abs(newPos.z) > size) return true;

    const playerCylRadius = 0.3;
    const pMinY = newPos.y - 1.7;
    const pMaxY = newPos.y + 0.2;

    const CULL = 20; // skip obstacles clearly outside this radius
    for (const obs of obstacles) {
        if (obs.passThrough) continue;
        if (obs.isSlope) continue; // slopes use steepness guard + floor snap, not AABB
        if (obs.box) {
            const b = obs.box;
            if (b.max.x < newPos.x - CULL || b.min.x > newPos.x + CULL ||
                b.max.z < newPos.z - CULL || b.min.z > newPos.z + CULL) continue;
            if (newPos.x + playerCylRadius > b.min.x && newPos.x - playerCylRadius < b.max.x &&
                newPos.z + playerCylRadius > b.min.z && newPos.z - playerCylRadius < b.max.z) {
                if (pMinY < b.max.y && pMaxY > b.min.y) {
                    if (!obs.noStep && pMinY >= b.max.y - 0.6) continue; // Allow stepping up heights up to 0.6 (except solid debris)
                    return true;
                }
            }
        }
        if (obs.radius) {
            // Skip radius collision if player is above this obstacle (e.g. standing on top of trunk)
            if (obs.box && pMinY >= obs.box.max.y - 0.1) continue;
            const dx = newPos.x - obs.mesh.position.x;
            const dz = newPos.z - obs.mesh.position.z;
            if (Math.sqrt(dx * dx + dz * dz) < obs.radius + playerCylRadius) return true;
        }
    }

    // Slope steepness/height check + side-entry block for mountain map
    if (gameState.currentMap === 'mountain') {
        const floorAtNew = getFloorHeight(newPos, true);
        const currentFeetY = camera.position.y - 1.7;
        if (floorAtNew > currentFeetY + 0.6) return true;
    }

    for (const pit of (gameState.craterPits || [])) {
        if (pMinY >= -0.05) continue;
        const dx = newPos.x - pit.cx;
        const dz = newPos.z - pit.cz;
        const distSq = dx * dx + dz * dz;
        if (distSq > pit.r * pit.r) continue;
        const wallR = pit.r * 0.88 - playerCylRadius;
        // Allow escape if player is jumping upward with enough velocity
        if (velocity.y > 3) continue;
        if (distSq > wallR * wallR) return true;
    }

    return false;
}

const downRaycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
const upRaycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
// Cached raycaster + directions for camera clip prevention
const _clipRay = new THREE.Raycaster();
const _camDirs = [
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
];
// Reusable vectors to avoid per-frame allocations
const _v3a = new THREE.Vector3();
const _v3b = new THREE.Vector3();

function getFloorHeight(pos, allowUncapped = false) {
    // Default ground is y=0. Inside a crater pit the ground is lower.
    let floor = 0;
    for (const pit of (gameState.craterPits || [])) {
        const dx = pos.x - pit.cx, dz = pos.z - pit.cz;
        if (dx * dx + dz * dz < pit.r * pit.r) { floor = -pit.depth; break; }
    }
    const feetY = pos.y - 1.7;

    // Check AABB boxes first (skip slope entries — they're handled by raycast below)
    for (const obs of obstacles) {
        if (obs.passThrough || obs.isSlope) continue;
        if (obs.box) {
            const b2 = obs.box;
            if (b2.max.x < pos.x - 20 || b2.min.x > pos.x + 20 ||
                b2.max.z < pos.z - 20 || b2.min.z > pos.z + 20) continue;
            // No lateral tolerance: only snap up to a box top when the player center is
            // actually inside its XZ footprint. A tolerance here combined with the vertical
            // snap would teleport the player on top of any obstacle they walk into from the
            // side whose top is below feetY + 0.8 (anything ~0.4–0.8 m tall).
            if (pos.x > b2.min.x && pos.x < b2.max.x &&
                pos.z > b2.min.z && pos.z < b2.max.z) {
                const obsTop = obs.box.max.y;
                if (obsTop > floor && feetY >= obsTop - 0.8) floor = obsTop;
            }
        }
    }

    // Check perfectly accurate sloped meshes via Dual Vertical Raycast
    const slopeMeshes = gameState.slopeMeshes || [];
    if (slopeMeshes.length > 0) {
        downRaycaster.set(_v3a.set(pos.x, 200, pos.z), _v3b.set(0, -1, 0));
        const downHits = downRaycaster.intersectObjects(slopeMeshes);

        upRaycaster.set(_v3a.set(pos.x, feetY + 0.65, pos.z), _v3b.set(0, 1, 0));
        const upHits = upRaycaster.intersectObjects(slopeMeshes);
        const ceilingY = upHits.length > 0 ? upHits[0].point.y : Infinity;

        if (downHits.length > 0) {
            // Pick the highest floor that is NOT above our head or blocked by a ceiling
            for (const hit of downHits) {
                const hitY = hit.point.y;
                // A surface is only a floor if:
                // - It's below any ceiling we just hit
                // - It's within a reasonable 'anti-phasing' range above our feet (e.g. 5m) OR below our feet
                if (hitY < ceilingY && (allowUncapped || hitY <= feetY + 0.8)) {
                    if (hitY > floor) floor = hitY;
                }
            }
        }
    }

    return floor;
}

// --- Third Person ---

let thirdPerson = false;
let tpYaw = Math.PI;   // orbit angle around player (starts behind)
let tpPitch = 0.4;     // vertical orbit angle
let tpRightDrag = false;
let tpDragMoved = false;
let tpMouseX = 0, tpMouseY = 0; // free cursor position (0-1 normalized)
let tpBodyYaw = 0;     // body facing direction (from movement)
let tpPunchSide = -1;    // alternates: +1 = right fist, -1 = left fist
let tpPrevSwingTime = 0; // detect new punch (weaponSwingTime jump)

// Orbit camera input
document.addEventListener('mousemove', (e) => {
    if (!thirdPerson || !gameState.active) return;
    if (tpRightDrag) {
        tpYaw -= e.movementX * 0.005;
        tpPitch += e.movementY * 0.005;
        tpPitch = Math.max(-0.2, Math.min(0.8, tpPitch));
        if (Math.abs(e.movementX) > 2 || Math.abs(e.movementY) > 2) tpDragMoved = true;
    }
    tpMouseX = e.clientX / window.innerWidth;
    tpMouseY = e.clientY / window.innerHeight;
});
document.addEventListener('mousedown', (e) => {
    if (thirdPerson && e.button === 2) { tpRightDrag = true; tpDragMoved = false; }
});
document.addEventListener('mouseup', (e) => {
    if (e.button === 2) {
        tpRightDrag = false;
        tpDragMoved = false;
    }
});

// Separate render camera for 3rd person — main camera stays at player position always
const tpCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
window.addEventListener('resize', () => {
    tpCamera.aspect = window.innerWidth / window.innerHeight;
    tpCamera.updateProjectionMatrix();
});

// Builds detailed fist meshes into `group` with fist centre at (cx, cy, cz).
// thumbDir: +1 = thumb on +x side (left hand), -1 = thumb on -x side (right hand).
function _buildDetailedFistMeshes(group, thumbDir, cx, cy, cz) {
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.6 });
    const knuckleMat = new THREE.MeshStandardMaterial({ color: 0xc49060, roughness: 0.45 });
    const grooveMat = new THREE.MeshStandardMaterial({ color: 0xb07050, roughness: 0.8 });

    // Main fist body — wider than tall
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.10), skinMat);
    body.position.set(cx, cy, cz);
    group.add(body);

    // 4 knuckle sphere bumps along the top-front edge
    [-0.052, -0.017, 0.017, 0.052].forEach(kx => {
        const k = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), knuckleMat);
        k.position.set(cx + kx, cy + 0.045, cz + 0.044);
        group.add(k);
    });

    // Thumb — angled outward from the correct side
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.072, 0.052), skinMat);
    thumb.position.set(cx + thumbDir * 0.086, cy - 0.008, cz + 0.010);
    thumb.rotation.z = -thumbDir * 0.38;
    group.add(thumb);

    // 3 finger-separation grooves on the front face
    [-0.035, 0, 0.035].forEach(gx => {
        const groove = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.09, 0.004), grooveMat);
        groove.position.set(cx + gx, cy, cz + 0.052);
        group.add(groove);
    });
}

// Player body group
const tpBody = new THREE.Group();

// Materials
const tpSkinMat = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.6 });
const tpShirtMat = new THREE.MeshStandardMaterial({ color: 0x3366cc, roughness: 0.7 });
const tpPantMat = new THREE.MeshStandardMaterial({ color: 0x222244, roughness: 0.8 });
const tpBootMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });

// Torso
const tpTorso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.3), tpShirtMat);
tpTorso.position.y = 1.05;
tpBody.add(tpTorso); // [0]

// Head
const tpHead = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.35), tpSkinMat);
tpHead.position.y = 0.565;
tpTorso.add(tpHead); // child of torso so it rotates with body lean

// Left upper arm (pivot at shoulder)
const tpArmLPivot = new THREE.Group();
tpArmLPivot.position.set(-0.35, 0.28, 0);
tpTorso.add(tpArmLPivot); // [0] child
const tpArmL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), tpShirtMat);
tpArmL.position.y = -0.27;
tpArmLPivot.add(tpArmL);

// Left fist — always visible; thumb on +x (right) side = correct for left hand
const tpLeftFist = new THREE.Group();
tpLeftFist.visible = false;
tpArmLPivot.add(tpLeftFist);
_buildDetailedFistMeshes(tpLeftFist, +1, 0, -0.55, 0.08);

// Right upper arm (pivot at shoulder) — holds gun
const tpArmRPivot = new THREE.Group();
tpArmRPivot.position.set(0.35, 0.28, 0);
tpTorso.add(tpArmRPivot); // [1] child
const tpArmR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), tpShirtMat);
tpArmR.position.y = -0.27;
tpArmRPivot.add(tpArmR);

// Right fist — always visible when NOT holding fists; thumb on -x side = correct for right hand
const tpRightFist = new THREE.Group();
tpRightFist.visible = true;
tpArmRPivot.add(tpRightFist);
_buildDetailedFistMeshes(tpRightFist, -1, 0, -0.55, 0.08);

// Gun held in right hand (dynamic — rebuilt when weapon changes)
const tpGunGroup = new THREE.Group();
tpGunGroup.position.set(0, -0.55, 0.1);
tpArmRPivot.add(tpGunGroup);
let tpCurrentWeaponId = null;

// Shield body group — parented to torso so it moves with the body.
// Only made visible when the player equips the shield.
const tpShieldGroup = new THREE.Group();
tpShieldGroup.visible = false;
tpTorso.add(tpShieldGroup);
(function () {
    const faceMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5, roughness: 0.5 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6, roughness: 0.4 });
    const bossMat = new THREE.MeshStandardMaterial({ color: 0xaa8833, metalness: 0.8, roughness: 0.2 });
    // Main face — wider and taller than the torso to cover the entire front
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.74, 1.00, 0.055), faceMat);
    face.position.set(0, -0.06, 0.22);
    tpShieldGroup.add(face);
    // Boss (centre emblem)
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.045, 10), bossMat);
    boss.rotation.x = Math.PI / 2;
    boss.position.set(0, 0.02, 0.25);
    tpShieldGroup.add(boss);
    // Rim — four border strips
    const rims = [
        { w: 0.04, h: 1.00, x: -0.37, y: -0.06 },
        { w: 0.04, h: 1.00, x: 0.37, y: -0.06 },
        { w: 0.74, h: 0.04, x: 0.00, y: 0.44 },
        { w: 0.74, h: 0.04, x: 0.00, y: -0.56 },
    ];
    rims.forEach(r => {
        const rim = new THREE.Mesh(new THREE.BoxGeometry(r.w, r.h, 0.065), rimMat);
        rim.position.set(r.x, r.y, 0.22);
        tpShieldGroup.add(rim);
    });
}());

// Left leg (pivot at hip)
const tpLegLPivot = new THREE.Group();
tpLegLPivot.position.set(-0.14, 0.68, 0);
tpBody.add(tpLegLPivot); // [1]
const tpLegLUpper = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.45, 0.22), tpPantMat);
tpLegLUpper.position.y = -0.22;
tpLegLPivot.add(tpLegLUpper);
// Left knee pivot
const tpKneeLPivot = new THREE.Group();
tpKneeLPivot.position.y = -0.45;
tpLegLPivot.add(tpKneeLPivot);
const tpLegLLower = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 0.2), tpPantMat);
tpLegLLower.position.y = -0.21;
tpKneeLPivot.add(tpLegLLower);
const tpBootL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.28), tpBootMat);
tpBootL.position.set(0, -0.44, 0.04);
tpKneeLPivot.add(tpBootL);

// Right leg (pivot at hip)
const tpLegRPivot = new THREE.Group();
tpLegRPivot.position.set(0.14, 0.68, 0);
tpBody.add(tpLegRPivot); // [2]
const tpLegRUpper = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.45, 0.22), tpPantMat);
tpLegRUpper.position.y = -0.22;
tpLegRPivot.add(tpLegRUpper);
// Right knee pivot
const tpKneeRPivot = new THREE.Group();
tpKneeRPivot.position.y = -0.45;
tpLegRPivot.add(tpKneeRPivot);
const tpLegRLower = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 0.2), tpPantMat);
tpLegRLower.position.y = -0.21;
tpKneeRPivot.add(tpLegRLower);
const tpBootR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.28), tpBootMat);
tpBootR.position.set(0, -0.44, 0.04);
tpKneeRPivot.add(tpBootR);

// --- Armor overlay meshes (added/removed based on equipped gear) ---
const tpArmorMats = {
    light: new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.3, roughness: 0.7 }),
    chainmail: new THREE.MeshStandardMaterial({ color: 0x556677, metalness: 0.6, roughness: 0.5 }),
    heavy: new THREE.MeshStandardMaterial({ color: 0x445566, metalness: 0.8, roughness: 0.3 }),
};

// Chest plate (child of torso)
let tpChestPlate = null;
// Helmet (child of head)
let tpHelmet = null;
// Leg armor (children of leg pivots)
let tpLegArmorL = null, tpLegArmorR = null;
// Boot armor (children of knee pivots)
let tpBootArmorL = null, tpBootArmorR = null;

function updateTpArmor() {
    // Remove old pieces
    if (tpChestPlate) {
        if (tpChestPlate._back) tpTorso.remove(tpChestPlate._back);
        tpTorso.remove(tpChestPlate);
        tpChestPlate = null;
    }
    if (tpHelmet) { tpHead.remove(tpHelmet); tpHelmet = null; }
    if (tpLegArmorL) { tpLegLPivot.remove(tpLegArmorL); tpLegArmorL = null; }
    if (tpLegArmorR) { tpLegRPivot.remove(tpLegArmorR); tpLegArmorR = null; }
    if (tpBootArmorL) { tpKneeLPivot.remove(tpBootArmorL); tpBootArmorL = null; }
    if (tpBootArmorR) { tpKneeRPivot.remove(tpBootArmorR); tpBootArmorR = null; }

    const armorId = playerData.equippedArmor;
    const helmetId = playerData.equippedHelmet;
    const pantsId = playerData.equippedPants;
    const bootsId = playerData.equippedBoots;

    function matFor(id) {
        if (!id) return null;
        if (id.startsWith('heavy')) return tpArmorMats.heavy;
        if (id.startsWith('chainmail')) return tpArmorMats.chainmail;
        return tpArmorMats.light;
    }

    if (armorId) {
        const mat = matFor(armorId);
        // Front plate
        tpChestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.12), mat);
        tpChestPlate.position.set(0, 0, 0.16);
        tpTorso.add(tpChestPlate);
        // Back plate
        const tpBackPlate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.12), mat);
        tpBackPlate.position.set(0, 0, -0.16);
        tpTorso.add(tpBackPlate);
        tpChestPlate._back = tpBackPlate; // track for removal
    }
    if (helmetId) {
        const mat = matFor(helmetId);
        const isHeavy = helmetId.startsWith('heavy');
        tpHelmet = new THREE.Mesh(
            isHeavy ? new THREE.BoxGeometry(0.42, 0.44, 0.42) : new THREE.BoxGeometry(0.40, 0.22, 0.40),
            mat
        );
        tpHelmet.position.set(0, isHeavy ? 0.02 : 0.1, 0);
        tpHead.add(tpHelmet);
        // Visor / peepholes for heavy helmet
        if (isHeavy) {
            const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9 });
            // Two eye slits
            const slitL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.04), darkMat);
            slitL.position.set(-0.1, 0.08, 0.22);
            tpHelmet.add(slitL);
            const slitR = slitL.clone();
            slitR.position.x = 0.1;
            tpHelmet.add(slitR);
            // Mouth grille bars
            for (let b = 0; b < 3; b++) {
                const bar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.018, 0.04), darkMat);
                bar.position.set(0, -0.06 - b * 0.04, 0.22);
                tpHelmet.add(bar);
            }
        }
    }
    if (pantsId) {
        const mat = matFor(pantsId);
        tpLegArmorL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.48, 0.25), mat);
        tpLegArmorL.position.set(0, -0.22, 0);
        tpLegLPivot.add(tpLegArmorL);
        tpLegArmorR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.48, 0.25), mat);
        tpLegArmorR.position.set(0, -0.22, 0);
        tpLegRPivot.add(tpLegArmorR);
    }
    if (bootsId) {
        const mat = matFor(bootsId);
        tpBootArmorL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.30), mat);
        tpBootArmorL.position.set(0, -0.44, 0.04);
        tpKneeLPivot.add(tpBootArmorL);
        tpBootArmorR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.30), mat);
        tpBootArmorR.position.set(0, -0.44, 0.04);
        tpKneeRPivot.add(tpBootArmorR);
    }
}
window._updateTpArmor = updateTpArmor;

// --- Third-person weapon model builders ---

// Dimensions match 1st-person GUN_CONFIGS in weapons.js; group is scaled 2× at runtime
const TP_GUN_CFGS = {
    glock: { bodyColor: 0x2a2a2a, accentColor: 0x1a1a1a, bodyLen: 0.20, bodyH: 0.035, bodyW: 0.030, barrelLen: 0.15, barrelR: 0.008 },
    revolver: { bodyColor: 0x6B6B6B, accentColor: 0x3a2010, bodyLen: 0.22, bodyH: 0.045, bodyW: 0.030, barrelLen: 0.14, barrelR: 0.012, hasCylinder: true },
    shotgun: { bodyColor: 0x2a2a2a, accentColor: 0x5a3520, bodyLen: 0.45, bodyH: 0.040, bodyW: 0.030, barrelLen: 0.20, barrelR: 0.012, woodStock: true, hasPump: true },
    assault_rifle: { bodyColor: 0x2d2d2d, accentColor: 0x3a3a3a, bodyLen: 0.50, bodyH: 0.040, bodyW: 0.035, barrelLen: 0.18, barrelR: 0.008, hasMag: true, woodStock: true },
    sniper: { bodyColor: 0x1a2a1a, accentColor: 0x2a1a10, bodyLen: 0.55, bodyH: 0.035, bodyW: 0.030, barrelLen: 0.25, barrelR: 0.006, woodStock: true, hasMag: true, hasScope: true },
    minigun: { bodyColor: 0x3a3a3a, accentColor: 0x2a2a2a, bodyLen: 0.55, bodyH: 0.060, bodyW: 0.050, barrelLen: 0.20, barrelR: 0.015, multiBarrel: true },
    rpg: { bodyColor: 0x4a5a3a, accentColor: 0x3a3a2a, bodyLen: 0.50, bodyH: 0.060, bodyW: 0.050, barrelLen: 0.15, barrelR: 0.025, hasWarhead: true },
    crossbow: { bodyColor: 0x3a2a1a, accentColor: 0x2a1a0a, bodyLen: 0.30, bodyH: 0.030, bodyW: 0.030, barrelLen: 0.10, barrelR: 0.008, hasBow: true },
};

function _tpClearWeapon() {
    while (tpGunGroup.children.length > 0) tpGunGroup.remove(tpGunGroup.children[0]);
}

function rebuildTpWeapon(weaponId, wDef) {
    _tpClearWeapon();
    // 2× scale so weapons are clearly visible from the orbit camera distance
    tpGunGroup.scale.setScalar(!wDef || weaponId === 'compass' || weaponId === 'fists' ? 1.0 : 2.0);
    if (!wDef) return;
    if (weaponId === 'compass') {
        _buildTpCompassModel();
        return;
    }
    if (wDef.type === 'melee' || weaponId === 'fists') {
        _buildTpMeleeModel(weaponId);
    } else if (wDef.type === 'throwable') {
        const col = weaponId === 'molotov' ? 0x884400 : 0x445544;
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8),
            new THREE.MeshStandardMaterial({ color: col }));
        mesh.position.set(0, 0, 0.05);
        tpGunGroup.add(mesh);
    } else if (weaponId === 'flashlight') {
        // Flashlight cylinder model
        const mat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.3 });
        const lensMat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffff88, emissiveIntensity: 2.0 });
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.28, 8), mat);
        body.rotation.x = Math.PI / 2;
        body.position.set(0, 0, 0.1);
        tpGunGroup.add(body);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.04, 8), lensMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(0, 0, 0.26);
        tpGunGroup.add(lens);
    } else {
        _buildTpGunModel(weaponId);
    }
}

function _buildTpCompassModel() {
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8 });
    const dialMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const needleMat = new THREE.MeshStandardMaterial({ color: 0xff2222 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16), baseMat);
    base.position.set(0, 0, 0.05);
    tpGunGroup.add(base);

    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.022, 16), dialMat);
    dial.position.set(0, 0, 0.05);
    tpGunGroup.add(dial);

    const needleGeo = new THREE.ConeGeometry(0.012, 0.08, 4);
    needleGeo.rotateX(Math.PI / 2);
    needleGeo.translate(0, 0, 0.035);
    const needle = new THREE.Mesh(needleGeo, needleMat);
    needle.position.set(0, 0.015, 0.05);
    needle.name = "tp_needle";
    tpGunGroup.add(needle);
}

function _buildTpGunModel(weaponId) {
    const cfg = TP_GUN_CFGS[weaponId] || {};
    const bodyLen = cfg.bodyLen || 0.30;
    const bodyH = cfg.bodyH || 0.040;
    const bodyW = cfg.bodyW || 0.030;
    const bodyColor = cfg.bodyColor || 0x333333;
    const accentColor = cfg.accentColor || 0x4a3520;
    const barrelLen = cfg.barrelLen || 0.15;
    const barrelR = cfg.barrelR || 0.008;

    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.4, metalness: 0.6 });
    const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.7 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.2, metalness: 0.8 });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyLen), bodyMat);
    body.position.set(0, 0, 0.05);
    tpGunGroup.add(body);

    // Grip — accent material to match 1st-person style
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.08, 0.025), accentMat);
    grip.position.set(0, -bodyH / 2 - 0.04, 0.02);
    grip.rotation.x = -0.3;
    tpGunGroup.add(grip);

    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(barrelR, barrelR, barrelLen, 8), metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, bodyH * 0.1, 0.05 + bodyLen / 2 + barrelLen / 2);
    tpGunGroup.add(barrel);

    // Revolver cylinder
    if (cfg.hasCylinder) {
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 8), metalMat);
        cyl.position.set(0, bodyH * 0.1, 0.01);
        tpGunGroup.add(cyl);
    }

    // Shotgun pump
    if (cfg.hasPump) {
        const pump = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 1.4, bodyH * 0.65, 0.08), accentMat);
        pump.position.set(0, -bodyH * 0.2, 0.05 + bodyLen * 0.12);
        tpGunGroup.add(pump);
    }

    // Magazine
    if (cfg.hasMag) {
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.05, 0.02), bodyMat);
        mag.position.set(0, -bodyH / 2 - 0.025, 0.05);
        mag.rotation.x = -0.1;
        tpGunGroup.add(mag);
    }

    // Stock (long guns)
    if (cfg.woodStock) {
        const stock = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.85, bodyH * 1.2, 0.10), accentMat);
        stock.position.set(0, 0, 0.05 - bodyLen / 2 - 0.05);
        tpGunGroup.add(stock);
    }

    // Scope (sniper)
    if (cfg.hasScope) {
        const scope = new THREE.Mesh(
            new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8),
            new THREE.MeshStandardMaterial({ color: 0x111111 })
        );
        scope.position.set(0, bodyH / 2 + 0.012, 0.05);
        tpGunGroup.add(scope);
    }

    // Minigun — full M134-style assembly
    if (weaponId === 'minigun') {
        const housingMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.35, metalness: 0.75 });
        // Cylindrical rotating-barrel housing (replaces the generic box body visually)
        const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, bodyLen * 0.84, 14), housingMat);
        housing.rotation.x = Math.PI / 2;
        housing.position.set(0, bodyH * 0.1, 0.05);
        tpGunGroup.add(housing);
        // 6 barrels in hexagonal arrangement
        const mgBarrelLen = barrelLen * 1.4;
        for (let b = 0; b < 6; b++) {
            const ang = (b / 6) * Math.PI * 2;
            const eb = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, mgBarrelLen, 6), metalMat);
            eb.rotation.x = Math.PI / 2;
            eb.position.set(Math.cos(ang) * 0.022, bodyH * 0.1 + Math.sin(ang) * 0.022,
                0.05 + bodyLen / 2 + mgBarrelLen / 2);
            tpGunGroup.add(eb);
        }
        // Muzzle cluster plate
        const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.016, 12), housingMat);
        muzzle.rotation.x = Math.PI / 2;
        muzzle.position.set(0, bodyH * 0.1, 0.05 + bodyLen / 2 + mgBarrelLen + 0.008);
        tpGunGroup.add(muzzle);
        // Gun sight
        const sightPost = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.026, 0.006), metalMat);
        sightPost.position.set(0, bodyH / 2 + 0.013, 0.05);
        tpGunGroup.add(sightPost);
        // Ammo feed belt
        const beltMat = new THREE.MeshStandardMaterial({ color: 0x888833, metalness: 0.4 });
        for (let i = 0; i < 7; i++) {
            const link = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.013, 0.022), beltMat);
            link.position.set(-i * 0.008, -bodyH / 2 - 0.014 - i * 0.022, 0.05 - bodyLen * 0.2 + i * 0.01);
            link.rotation.z = i * 0.18;
            tpGunGroup.add(link);
        }
    } else if (cfg.multiBarrel) {
        // Fallback for any other multi-barrel weapon
        for (let b = 0; b < 4; b++) {
            const ang = (b / 4) * Math.PI * 2;
            const eb = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, barrelLen, 6), metalMat);
            eb.rotation.x = Math.PI / 2;
            eb.position.set(Math.cos(ang) * 0.015, bodyH * 0.1 + Math.sin(ang) * 0.015,
                0.05 + bodyLen / 2 + barrelLen / 2);
            tpGunGroup.add(eb);
        }
    }

    // RPG warhead tube
    if (cfg.hasWarhead) {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.08, 8), metalMat);
        tube.rotation.x = Math.PI / 2;
        tube.position.set(0, bodyH * 0.1, 0.05 + bodyLen / 2 + barrelLen + 0.04);
        tpGunGroup.add(tube);
    }

    // Crossbow arms
    if (cfg.hasBow) {
        const armMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.5 });
        const zA = 0.05 + bodyLen / 2 - 0.08;
        [-0.075, 0.075].forEach(xOff => {
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.008, 0.008), armMat);
            arm.position.set(xOff, 0, zA);
            arm.rotation.z = xOff < 0 ? 0.2 : -0.2;
            tpGunGroup.add(arm);
        });
    }
}

function _buildTpMeleeModel(weaponId) {
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.6 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xc8c8c8, metalness: 0.9, roughness: 0.1 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.85 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });

    if (weaponId === 'fists') {
        // tpGunGroup is already at (0, -0.55, 0.08) in arm-pivot space, so centre = (0,0,0)
        // thumbDir = -1 → thumb on -x side (correct for right hand)
        _buildDetailedFistMeshes(tpGunGroup, -1, 0, 0, 0);

    } else if (weaponId === 'knife') {
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.12, 8), darkMat);
        handle.rotation.x = Math.PI / 2;
        handle.position.set(0, 0.02, 0.00);
        tpGunGroup.add(handle);
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.010, 0.24), metalMat);
        blade.position.set(0, 0.02, 0.18);
        tpGunGroup.add(blade);

    } else if (weaponId === 'chainsaw') {
        const motorMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.5 });
        const barMat = new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8 });
        const motor = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.09, 0.18), motorMat);
        motor.position.set(0, 0, 0.02);
        tpGunGroup.add(motor);
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.40), barMat);
        bar.position.set(0, 0, 0.30);
        tpGunGroup.add(bar);

    } else if (weaponId === 'katana') {
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xdcdcdc, metalness: 0.95, roughness: 0.04 });
        const guardMat = new THREE.MeshStandardMaterial({ color: 0xcc9920, metalness: 0.6 });
        const kWood = new THREE.MeshStandardMaterial({ color: 0x2a1a08, roughness: 0.85 });
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.020, 0.24, 8), kWood);
        handle.rotation.x = Math.PI / 2;
        handle.position.set(0, 0.02, -0.05);
        tpGunGroup.add(handle);
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.018, 0.018), guardMat);
        guard.position.set(0, 0.02, 0.09);
        tpGunGroup.add(guard);
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.011, 0.90), bladeMat);
        blade.position.set(0, 0.02, 0.55);
        tpGunGroup.add(blade);

    } else if (weaponId === 'longsword') {
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xc8c8c8, metalness: 0.88, roughness: 0.12 });
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xcc9933, metalness: 0.75 });
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.28, 8), woodMat);
        handle.rotation.x = Math.PI / 2;
        handle.position.set(0, 0, -0.05);
        tpGunGroup.add(handle);
        const crossGuard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.028, 0.028), goldMat);
        crossGuard.position.set(0, 0, 0.10);
        tpGunGroup.add(crossGuard);
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.052, 0.72), bladeMat);
        blade.position.set(0, 0, 0.50);
        tpGunGroup.add(blade);

    } else if (weaponId === 'axe') {
        const axeMetalMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.82 });
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.50, 8), woodMat);
        handle.rotation.x = Math.PI / 2;
        handle.position.set(0, 0, 0.10);
        tpGunGroup.add(handle);
        const axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.068), axeMetalMat);
        axeHead.position.set(0, 0, 0.40);
        tpGunGroup.add(axeHead);

    } else if (weaponId === 'shield') {
        const shieldMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 });
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xaa8833, metalness: 0.8 });
        const shield = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.60, 0.05), shieldMat);
        shield.position.set(0, 0, 0.15);
        tpGunGroup.add(shield);
        const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 8), goldMat);
        boss.rotation.x = Math.PI / 2;
        boss.position.set(0, 0, 0.19);
        tpGunGroup.add(boss);

    } else {
        // Generic melee fallback
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.30, 8), woodMat);
        handle.rotation.x = Math.PI / 2;
        handle.position.set(0, 0, 0.00);
        tpGunGroup.add(handle);
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.50), metalMat);
        blade.position.set(0, 0, 0.35);
        tpGunGroup.add(blade);
    }
}

function startGame(mode, mapId) {
    gameState.mode = mode || 'zombie';
    gameState.currentMap = mapId in MAPS ? mapId : 'warehouse';
    if (!playerData.equippedLoadout?.length) playerData.equippedLoadout = ['fists'];

    ['homepage', 'shop-screen', 'loadout-screen', 'map-screen'].forEach(s =>
        document.getElementById(s).style.display = 'none'
    );
    document.getElementById('hud').style.display = 'block';

    buildMap(mapId);
    // City uses dense fog — clip camera at fog.far so GPU skips invisible geometry
    camera.far = (mapId === 'city') ? 220 : 500;
    camera.updateProjectionMatrix();
    scene.add(tpBody);
    tpBody.visible = false;
    updateTpArmor();

    const loadoutSlots = mode === 'rescue' ? 5 : (mode === 'pvp' ? 3 : 4);
    const inGameSlots = mode === 'pvp' ? 3 : 9; // allow picking up to 9 weapons in-game
    let initialWeapons = playerData.equippedLoadout.slice(0, loadoutSlots);
    if (mode === 'rescue') {
        initialWeapons = initialWeapons.filter(w => w !== 'shield');
        if (!initialWeapons.includes('compass')) {
            if (initialWeapons.length === 5) initialWeapons[4] = 'compass';
            else initialWeapons.push('compass');
        }
    }

    const bonusHp = (playerData.stats?.health || 0) * 5;
    const bonusStamina = (playerData.stats?.stamina || 0) * 10;
    resetPlayerState({
        weapons: initialWeapons,
        maxSlots: inGameSlots,
        hp: 100 + bonusHp,
        maxHp: 100 + bonusHp,
        stamina: 100 + bonusStamina,
        maxStamina: 100 + bonusStamina,
        speedMult: 1 + (playerData.stats?.speed || 0) * 0.02
    });

    for (const wid of playerState.weapons) {
        const w = WEAPONS[wid];
        playerState.weaponStates[wid] = {
            ammo: w.maxAmmo, reserveAmmo: w.reserveAmmo,
            lastFired: 0, reloading: false, reloadStart: 0
        };
    }

    if (playerData.equippedArmor) {
        const eq = EQUIPMENT[playerData.equippedArmor];
        playerState.armor += eq.armor;
        playerState.maxArmor += eq.armor;
        playerState.damageReduction += eq.damageReduction || 0;
    }
    if (playerData.equippedHelmet) {
        const eq = EQUIPMENT[playerData.equippedHelmet];
        playerState.armor += eq.armor;
        playerState.maxArmor += eq.armor;
        playerState.headshotReduction = eq.headshotReduction || 0;
    }
    if (playerData.equippedPants) {
        const eq = EQUIPMENT[playerData.equippedPants];
        if (eq) {
            playerState.armor += eq.armor || 0;
            playerState.maxArmor += eq.armor || 0;
            playerState.damageReduction = Math.min(0.9, playerState.damageReduction + (eq.damageReduction || 0));
        }
    }
    if (playerData.equippedBoots) {
        const eq = EQUIPMENT[playerData.equippedBoots];
        if (eq) {
            playerState.armor += eq.armor || 0;
            playerState.maxArmor += eq.armor || 0;
            playerState.damageReduction = Math.min(0.9, playerState.damageReduction + (eq.damageReduction || 0));
        }
    }
    // Med kits and adrenaline are used in-game via Q/Y; don't consume at match start

    camera.position.set(0, 1.7, 0);
    camera.rotation.set(0, 0, 0); // reset look direction
    velocity.set(0, 0, 0);
    // Hallway map: spawn at the south end, facing north (toward zombies)
    if (gameState.currentMap === 'hallway' && gameState.hallwayPlayerSpawnZ != null) {
        camera.position.set(0, 1.7, gameState.hallwayPlayerSpawnZ);
        camera.rotation.set(0, Math.PI, 0); // face north (-z)
    }
    const spawnFloor = getFloorHeight(camera.position);
    camera.position.y = spawnFloor + 1.7;
    scene.add(controls.getObject());
    createWeaponModel(playerState.weapons[0]);
    renderWeaponSlots();

    // Set up player flashlight spot light (attached to camera, active when flashlight is equipped)
    if (gameState.playerFlashlight) {
        camera.remove(gameState.playerFlashlight);
        camera.remove(gameState.playerFlashlight.target);
    }
    const _flashlightSpot = new THREE.SpotLight(0xffeedd, 18, 120, Math.PI / 7, 0.4, 1);
    _flashlightSpot.position.set(0, -0.1, -0.3);
    _flashlightSpot.target.position.set(0, -0.1, -20);
    _flashlightSpot.visible = false;
    camera.add(_flashlightSpot);
    camera.add(_flashlightSpot.target);
    gameState.playerFlashlight = _flashlightSpot;

    gameState.zombieEntities = [];
    gameState.droppedWeapons = [];
    // Spawn flashlight as a world pickup near spawn
    {
        const _flMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, emissive: 0xffaa00, emissiveIntensity: 0.6 });
        const _flMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.45, 8), _flMat);
        _flMesh.rotation.z = Math.PI / 2;
        _flMesh.position.set(4, 0.5, 2);
        scene.add(_flMesh);
        gameState.droppedWeapons.push({ mesh: _flMesh, weaponId: 'flashlight' });
    }
    gameState.fireZones = [];
    gameState.pickupSpawnTimer = 0;
    gameState.medkitSpawnTimer = 180;

    gameState.airstrikeLastUsed = null;

    if (mode === 'zombie') {
        gameState.wave = 1;
        gameState.zombiesAlive = 0;
        gameState.zombiesToSpawn = 100;
        gameState.zombieSpawnTimer = 0;
        gameState.zombieKillCredit = 0;
        gameState.zombieTotalKills = 0;
        document.getElementById('wave-hud').style.display = 'block';
        document.getElementById('wave-hud').textContent = 'Kills: 0';
    } else if (mode === 'rescue') {
        spawnHostage(MAPS[mapId].size);
        gameState.zombiesAlive = 0;
        gameState.zombiesToSpawn = 80;
        gameState.zombieSpawnTimer = 0;
        document.getElementById('wave-hud').style.display = 'block';
        document.getElementById('wave-hud').textContent = 'Find the Hostage!';
    } else if (mode === 'pvp') {
        gameState.pvpRound = 1;
        gameState.pvpPlayerScore = 0;
        gameState.pvpEnemyScore = 0;
        document.getElementById('wave-hud').style.display = 'block';
        document.getElementById('wave-hud').textContent = 'Round 1 | 0-0';
        spawnPvPEnemy();
    }

    gameState.active = true;
    gameState.paused = false;
    updateHUD();
    controls.lock();
}
window.startGame = startGame;

window._toggleThirdPerson = function () {
    thirdPerson = !thirdPerson;
    tpBody.visible = thirdPerson;
    if (weaponModel) weaponModel.visible = !thirdPerson;
    if (thirdPerson) {
        controls.unlock();
        const lookDir = new THREE.Vector3();
        camera.getWorldDirection(lookDir);
        tpYaw = Math.atan2(lookDir.x, lookDir.z) + Math.PI;
    } else {
        // Reset tpCamera fov in case it was zoomed
        tpCamera.fov = 75;
        tpCamera.updateProjectionMatrix();
        controls.lock();
    }
};
window._isThirdPerson = () => thirdPerson;
window._tpCamera = tpCamera;

// --- Quit / Resume ---

function quitToMenu() {
    gameState.active = false;
    gameState.paused = false;
    controls.unlock();
    document.getElementById('hud').style.display = 'none';
    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('round-overlay').style.display = 'none';
    document.getElementById('consumables-panel').style.display = 'none';
    gameState.zombieEntities = [];
    gameState.droppedWeapons = [];
    gameState.fireZones = [];
    gameState.ammoPickups = [];
    gameState.pvpEnemy = null;
    gameState.craterPits = [];
    showScreen('homepage');
}
window.quitToMenu = quitToMenu;

function resumeGame() {
    gameState.paused = false;
    document.getElementById('pause-menu').style.display = 'none';
    controls.lock();
}
window.resumeGame = resumeGame;

window.returnToMenu = function () {
    document.getElementById('round-overlay').style.display = 'none';
    quitToMenu();
};

// --- Game Loop ---

let prevTime = performance.now();
let _cityChunkTimer = 0;
let _forestChunkTimer = 0;
let _mountainChunkTimer = 0;
let _desertChunkTimer = 0;

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    const dt = Math.min((time - prevTime) / 1000, 0.033);
    prevTime = time;

    // Update player facing direction for shield direction check
    if (gameState.active) {
        if (thirdPerson) {
            gameState.playerFacingYaw = tpBodyYaw;
        } else {
            const _fwd = new THREE.Vector3();
            camera.getWorldDirection(_fwd);
            gameState.playerFacingYaw = Math.atan2(_fwd.x, _fwd.z);
        }
    }

    // Stream city building chunks — load/unload every 0.5s based on player position
    if (gameState.active && gameState.currentMap === 'city') {
        _cityChunkTimer += dt;
        if (_cityChunkTimer >= 0.5) {
            _cityChunkTimer = 0;
            updateCityChunks(camera.position.x, camera.position.z);
        }
    }
    if (gameState.active && gameState.currentMap === 'forest') {
        _forestChunkTimer += dt;
        if (_forestChunkTimer >= 0.5) {
            _forestChunkTimer = 0;
            updateForestChunks(camera.position.x, camera.position.z);
        }
    }
    if (gameState.active && gameState.currentMap === 'mountain') {
        _mountainChunkTimer += dt;
        if (_mountainChunkTimer >= 0.5) {
            _mountainChunkTimer = 0;
            updateMountainChunks(camera.position.x, camera.position.z);
        }
    }
    if (gameState.active && gameState.currentMap === 'desert') {
        _desertChunkTimer += dt;
        if (_desertChunkTimer >= 0.5) {
            _desertChunkTimer = 0;
            updateDesertChunks(camera.position.x, camera.position.z);
        }
    }

    // Animate street lamp flicker (emissive only — PointLights are at intersections, not per-lamp)
    if (gameState.streetLamps.length > 0) {
        const t = time * 0.001;
        for (const sl of gameState.streetLamps) {
            const shouldFlicker = Math.sin(t * 0.5 + sl.phase) > 0.82;
            sl.mat.emissiveIntensity = shouldFlicker ? (Math.sin(t * 28 + sl.phase) > 0 ? 1.0 : 0.0) : 1.0;
        }
    }

    // Animate warehouse ceiling light flicker
    if (gameState.warehouseLights && gameState.warehouseLights.length > 0) {
        const t = time * 0.001;
        for (const wl of gameState.warehouseLights) {
            // Occasional flicker burst — each light has its own phase so they're independent
            const bursting = Math.sin(t * 0.4 + wl.phase) > 0.75;
            const on = bursting ? (Math.sin(t * 40 + wl.phase) > -0.3 ? 1.0 : 0.0) : 1.0;
            wl.mat.emissiveIntensity = on * 1.5;
            wl.light.intensity = on * 1.2;
        }
    }

    // Day/Night cycle — gradual 7.5-min full cycle, 30-sec dawn/dusk transitions
    if (gameState.dayNightActive && gameState.sunLight && gameState.ambientLightRef) {
        gameState.dayTime = (gameState.dayTime + dt / 450) % 1.0; // 450s = 7.5 min full cycle
        const dn = gameState.dayTime;
        // dayFactor: 0=midnight, 1=noon — smooth sine curve
        const dayFactor = Math.max(0, Math.sin(dn * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5);

        // Ambient light colour: night=deep blue, dawn/dusk=orange, day=white
        let ambR, ambG, ambB;
        if (dayFactor < 0.15) {
            // Night → dawn
            const f = dayFactor / 0.15;
            ambR = 0.04 + f * (1.0 - 0.04); ambG = 0.04 + f * (0.53 - 0.04); ambB = 0.12 + f * (0.27 - 0.12);
        } else if (dayFactor < 0.3) {
            // Dawn → day
            const f = (dayFactor - 0.15) / 0.15;
            ambR = 1.0; ambG = 0.53 + f * (1.0 - 0.53); ambB = 0.27 + f * (1.0 - 0.27);
        } else if (dayFactor > 0.85) {
            // Day → dusk → night
            const f = (dayFactor - 0.85) / 0.15;
            ambR = 1.0 - f * (1.0 - 0.04); ambG = 1.0 - f * (1.0 - 0.04); ambB = 1.0 - f * (1.0 - 0.12);
        } else if (dayFactor > 0.7) {
            // Day → dusk
            const f = (dayFactor - 0.7) / 0.15;
            ambR = 1.0; ambG = 1.0 - f * (1.0 - 0.53); ambB = 1.0 - f * (1.0 - 0.27);
        } else {
            ambR = 1.0; ambG = 1.0; ambB = 1.0; // full day
        }
        const mapAmbBase = MAPS[gameState.currentMap]?.ambientLight || 0.5;
        const ambIntensity = mapAmbBase * 0.15 + dayFactor * mapAmbBase * 1.3;
        gameState.ambientLightRef.color.setRGB(ambR, ambG, ambB);
        gameState.ambientLightRef.intensity = ambIntensity;

        // Sun directional light — arc across sky
        // Offset by -PI/2 so that dn=0.5 (noon, dayFactor=1) places sun overhead (+Y)
        const mapSize = MAPS[gameState.currentMap]?.size || 150;
        const sunAngle = dn * Math.PI * 2 - Math.PI / 2;
        gameState.sunLight.position.set(Math.cos(sunAngle) * mapSize, Math.sin(sunAngle) * mapSize, mapSize / 3);
        gameState.sunLight.intensity = dayFactor < 0.08 ? 0 : dayFactor * 0.85;
        // Sun colour: orange at horizon, white at zenith
        const isHorizon = dayFactor < 0.35 || dayFactor > 0.65;
        gameState.sunLight.color.setRGB(1.0, isHorizon ? 0.55 : 1.0, isHorizon ? 0.2 : 1.0);

        // Sky/fog colour — night is pure black, day is blue sky
        // dayFactor=0 → black, dayFactor=1 → sky blue
        const skyR = dayFactor * 0.53, skyG = dayFactor * 0.81, skyB = dayFactor < 0.05 ? 0 : dayFactor * 0.92;
        if (scene.background instanceof THREE.Color) {
            scene.background.setRGB(skyR, skyG, skyB);
        }
        if (scene.fog && gameState.fogNearBase) {
            scene.fog.color.setRGB(skyR, skyG, skyB);
            // Fog always stays at the map horizon — darkness limits night visibility, not close fog
            scene.fog.near = mapSize * 1.1;
            scene.fog.far = mapSize * 1.8;
        }
    }

    if (gameState.active && !gameState.paused) {
        try {
            direction.z = Number(keys.w) - Number(keys.s);
            direction.x = Number(keys.d) - Number(keys.a);
            direction.normalize();

            let isSprinting = false;
            if (keys.shift && playerState.stamina > 0 && (direction.x !== 0 || direction.z !== 0)) {
                isSprinting = true;
                playerState.stamina -= dt * 20;
                if (playerState.stamina < 0) playerState.stamina = 0;
            } else if (!keys.shift) {
                playerState.stamina += dt * 10 * (1 + (playerData.stats?.staminaRegen || 0) * 0.1);
                if (playerState.stamina > playerState.maxStamina) playerState.stamina = playerState.maxStamina;
            }

            // Each piece contributes 1/4 of its full-set penalty (light=5%, chainmail=10%, heavy=40%)
            let armorPenalty = 0;
            for (const slot of [playerData.equippedHelmet, playerData.equippedArmor, playerData.equippedPants, playerData.equippedBoots]) {
                if (!slot) continue;
                if (slot.startsWith('heavy_')) armorPenalty += 0.10;
                else if (slot.startsWith('chainmail_')) armorPenalty += 0.025;
                else if (slot.startsWith('light_')) armorPenalty += 0.0125;
            }
            const armorSpeedMult = 1 - armorPenalty;
            const speed = moveSpeed * (isSprinting ? sprintMult : 1) * playerState.speedMult * armorSpeedMult;
            velocity.x -= velocity.x * 10.0 * dt;
            velocity.z -= velocity.z * 10.0 * dt;

            if (playerState.flyMode) {
                // Fly mode: no gravity, Space=up, Shift=down
                velocity.y = keys.space ? 6 : (keys.shift ? -6 : velocity.y * 0.85);
            } else {
                velocity.y -= gravity * dt;
            }

            if (direction.z !== 0) velocity.z -= direction.z * speed * dt * 15;
            if (direction.x !== 0) velocity.x -= direction.x * speed * dt * 15;
            if (keys.space && !playerState.flyMode) {
                if (canJump) {
                    let jForce = jumpForce * (1 + (playerData.stats?.jump || 0) * 0.05);
                    // Inside a crater: boost jump just enough to clear the rim
                    for (const pit of (gameState.craterPits || [])) {
                        const _dx = camera.position.x - pit.cx;
                        const _dz = camera.position.z - pit.cz;
                        if (_dx * _dx + _dz * _dz < pit.r * pit.r) {
                            // v = sqrt(2 * g * h), h = depth + rimLip(0.45) + tiny clearance
                            jForce = Math.sqrt(2 * gravity * (pit.depth + 0.1));
                            break;
                        }
                    }
                    velocity.y = jForce;
                    setCanJump(false);
                } else if (gameState.currentMap === 'forest') {
                    // Tree scaling: holding Space near a trunk climbs it
                    const nearTrunk = obstacles.some(o => o.isTrunk &&
                        Math.abs(o.mesh.position.x - camera.position.x) < 1.1 &&
                        Math.abs(o.mesh.position.z - camera.position.z) < 1.1);
                    if (nearTrunk) velocity.y = 5;
                }
            }

            const rightDir = new THREE.Vector3();
            const forwardDir = new THREE.Vector3();
            if (thirdPerson) {
                // In 3rd person, forward = direction the orbit camera is looking (toward player)
                forwardDir.set(-Math.sin(tpYaw), 0, -Math.cos(tpYaw)).normalize();
            } else {
                camera.getWorldDirection(forwardDir);
                forwardDir.y = 0; forwardDir.normalize();
            }
            rightDir.crossVectors(forwardDir, camera.up).normalize();

            const moveVec = new THREE.Vector3();
            moveVec.addScaledVector(rightDir, -velocity.x * dt);
            moveVec.addScaledVector(forwardDir, -velocity.z * dt);

            const origX = camera.position.x;
            const origZ = camera.position.z;

            // Swept collision: sub-step movement so thin walls can't be tunneled through
            const STEP = 0.15; // max units per sub-step (smaller than thinnest wall = 0.5)
            const totalDist = Math.sqrt(moveVec.x * moveVec.x + moveVec.z * moveVec.z);
            if (totalDist > 0) {
                const steps = Math.ceil(totalDist / STEP);
                const dx = moveVec.x / steps;
                const dz = moveVec.z / steps;
                for (let _s = 0; _s < steps; _s++) {
                    const px = camera.position.x;
                    camera.position.x += dx;
                    if (checkCollision(camera.position)) camera.position.x = px;
                    const pz = camera.position.z;
                    camera.position.z += dz;
                    if (checkCollision(camera.position)) camera.position.z = pz;
                }
            }

            // Side-entry slope check: raycast in move direction (only when actually moving)
            if (gameState.currentMap === 'mountain') {
                const slopeMeshes = gameState.slopeMeshes || [];
                const moveDist = Math.sqrt(moveVec.x * moveVec.x + moveVec.z * moveVec.z);
                if (slopeMeshes.length > 0 && moveDist > 0.001) {
                    const dirX = moveVec.x / moveDist;
                    const dirZ = moveVec.z / moveDist;
                    const ox = camera.position.x - dirX * 0.5;
                    const oz = camera.position.z - dirZ * 0.5;
                    const checkDist = moveDist + 0.85;
                    const feetY = camera.position.y - 1.7;
                    const floorAhead = getFloorHeight(camera.position);
                    if (floorAhead <= feetY + 0.6) {
                        // Only cast one ray at mid-body — reduces 3 raycasts to 1
                        const sideRay = new THREE.Raycaster(
                            _v3a.set(ox, camera.position.y - 0.85, oz),
                            _v3b.set(dirX, 0, dirZ)
                        );
                        const hits = sideRay.intersectObjects(slopeMeshes);
                        for (const hit of hits) {
                            if (hit.distance > checkDist) break;
                            if (hit.face) {
                                const wn = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
                                if (Math.abs(wn.y) > 0.7) continue;
                                if (hit.point.y <= feetY + 0.6) continue;
                            }
                            camera.position.x = origX;
                            camera.position.z = origZ;
                            break;
                        }
                    }
                }
            }

            // After horizontal move, check if we've walked into the side of a slope:
            // if the floor at the new position is more than 0.6m above our feet, push back.
            if (gameState.currentMap === 'mountain') {
                const feetY = camera.position.y - 1.7;
                const floorHere = getFloorHeight(camera.position);
                if (floorHere > feetY + 0.6) {
                    camera.position.x = origX;
                    camera.position.z = origZ;
                }
            }

            const prevCamY = camera.position.y;
            camera.position.y += velocity.y * dt;

            // Ceiling collision — stop upward movement if head hits a solid obstacle from below
            if (velocity.y > 0) {
                const pHead = camera.position.y + 0.2;
                for (const obs of obstacles) {
                    if (obs.passThrough || obs.isSlope) continue;
                    if (!obs.box) continue;
                    const b = obs.box;
                    if (camera.position.x + 0.3 < b.min.x || camera.position.x - 0.3 > b.max.x) continue;
                    if (camera.position.z + 0.3 < b.min.z || camera.position.z - 0.3 > b.max.z) continue;
                    // Head entered the bottom of this box from below
                    if (pHead > b.min.y && (prevCamY + 0.2) <= b.min.y) {
                        camera.position.y = b.min.y - 0.2;
                        velocity.y = 0;
                        break;
                    }
                }
            }

            // CCD: if falling on mountain map, sweep the full vertical path for slope surfaces
            // so the player can't phase through them when moving fast
            if (gameState.currentMap === 'mountain' && velocity.y < 0) {
                const prevFeetY = prevCamY - 1.7;
                const newFeetY = camera.position.y - 1.7;
                // Cast from previous camera Y (not feet) to cover the full swept path
                downRaycaster.set(
                    _v3a.set(camera.position.x, prevCamY, camera.position.z),
                    _v3b.set(0, -1, 0)
                );
                const sweepHits = downRaycaster.intersectObjects(gameState.slopeMeshes || []);
                for (const hit of sweepHits) {
                    // Surface was crossed: it was above new feet but below old feet
                    if (hit.point.y >= newFeetY && hit.point.y < prevFeetY) {
                        camera.position.y = hit.point.y + 1.7;
                        velocity.y = 0;
                        setCanJump(true);
                        break;
                    }
                }
            }

            let targetFloorY = getFloorHeight(camera.position) + 1.7;

            if (!playerState.flyMode && camera.position.y < targetFloorY) {
                if (velocity.y < -15) {
                    damagePlayer(Math.floor((-velocity.y - 15) * 1.5));
                }
                camera.position.y = targetFloorY;
                velocity.y = 0;
                setCanJump(true);
            }


            // Camera wall clip prevention — throttled to every 3 frames, cached mesh list
            if (!window._clipFrame) window._clipFrame = 0;
            window._clipFrame++;
            if (window._clipFrame % 3 === 0) {
                if (!window._camObsMeshes || window._camObsMeshesLen !== obstacles.length) {
                    window._camObsMeshes = obstacles.filter(o => o.mesh && !o.passThrough && !o.isSlope).map(o => o.mesh);
                    window._camObsMeshesLen = obstacles.length;
                }
                const PUSH_DIST = 0.3;
                const camObsMeshes = window._camObsMeshes;
                for (const dir of _camDirs) {
                    _clipRay.set(camera.position, dir);
                    _clipRay.far = PUSH_DIST;
                    const hits = _clipRay.intersectObjects(camObsMeshes);
                    if (hits.length > 0) {
                        const push = PUSH_DIST - hits[0].distance;
                        camera.position.x -= dir.x * push;
                        camera.position.z -= dir.z * push;
                    }
                }
            }

            const { def } = getCurrentWeapon();
            if (isMouseDown() && def.fireRate <= 0.15) shoot();

            updateReload();
            updateFireZones(dt);
            updateTracers();

            if (gameState.mode === 'zombie' || gameState.mode === 'rescue') updateZombies(dt);
            else if (gameState.mode === 'pvp') updatePvPEnemy(dt);

            if (gameState.mode === 'rescue') {
                if (gameState.hostage && !gameState.hostage.rescued) {
                    if (camera.position.distanceTo(gameState.hostage.mesh.position) < 4 && keys.e) {
                        gameState.hostage.rescued = true;
                        scene.remove(gameState.hostage.mesh);
                        spawnExtractionZone(MAPS[gameState.currentMap].size);
                        for (let i = 0; i < 3; i++) spawnZombie(false, true, 7.0);
                        document.getElementById('wave-hud').textContent = 'Get to Extraction (Green Pillar)!';
                        gameState.zombiesToSpawn += 100;
                        playPickup();
                    }
                } else if (gameState.extractionZone) {
                    const ex = gameState.extractionZone;
                    const dist = Math.sqrt(Math.pow(camera.position.x - ex.x, 2) + Math.pow(camera.position.z - ex.z, 2));
                    if (dist < 5 && gameState.active) {
                        gameState.active = false;
                        controls.unlock();
                        playerData.missions++;
                        playerData.money += 3000;
                        savePlayerData();
                        showRoundOverlay('MISSION ACCOMPLISHED', 'Hostage Extracted! +$3000', 0, true);
                    }
                }
            }

            gameState.pickupSpawnTimer = (gameState.pickupSpawnTimer || 0) + dt;
            if (gameState.pickupSpawnTimer > 20) {
                const size = MAPS[gameState.currentMap].size;
                // Ammo crates spawn regularly; medkits much less often (separate slower timer)
                spawnSinglePickup(size, false);
                gameState.pickupSpawnTimer = 0;
            }
            gameState.medkitSpawnTimer = (gameState.medkitSpawnTimer || 120) - dt;
            if (gameState.medkitSpawnTimer <= 0) {
                spawnSinglePickup(MAPS[gameState.currentMap].size, true);
                gameState.medkitSpawnTimer = 150 + Math.random() * 60;
            }

            // Cactus damage (desert map)
            if (gameState.currentMap === 'desert') {
                for (const obs of obstacles) {
                    if (!obs.isCactus) continue;
                    const cdx = camera.position.x - obs.mesh.position.x;
                    const cdz = camera.position.z - obs.mesh.position.z;
                    if (Math.sqrt(cdx * cdx + cdz * cdz) < (obs.radius || 0.5) + 0.35) {
                        damagePlayer(5 * dt);
                        break;
                    }
                }
            }

            for (const pickup of gameState.ammoPickups) {
                if (pickup.collected) continue;
                pickup.mesh.rotation.y += dt * 2;
                if (camera.position.distanceTo(pickup.mesh.position) < 2) {
                    pickup.collected = true;
                    scene.remove(pickup.mesh);
                    if (pickup.isMedkit) {
                        playerState.hp = Math.min(playerState.maxHp, playerState.hp + 50);
                        playPickup();
                        updateHUD();
                    } else {
                        const state = playerState.weaponStates[playerState.weapons[playerState.currentWeaponIndex]];
                        if (state) { state.reserveAmmo += 20; playPickup(); updateHUD(); }
                    }
                }
            }

            for (const dw of gameState.droppedWeapons) dw.mesh.rotation.y += dt * 1.5;
            checkInteractionPrompt();

            if (weaponModel) {
                weaponModel.visible = !thirdPerson;
                const currentWep = playerState.weapons[playerState.currentWeaponIndex];
                if (gameState.playerFlashlight) {
                    gameState.playerFlashlight.visible = (currentWep === 'flashlight');
                    // In 3rd person, reposition flashlight to shine from player body forward
                    if (thirdPerson && currentWep === 'flashlight') {
                        const fl = gameState.playerFlashlight;
                        if (fl.parent === camera) {
                            camera.remove(fl);
                            camera.remove(fl.target);
                            scene.add(fl);
                            scene.add(fl.target);
                        }
                        const fwdX = Math.sin(tpBodyYaw);
                        const fwdZ = Math.cos(tpBodyYaw);
                        fl.position.set(
                            camera.position.x + fwdX * 0.5,
                            camera.position.y - 0.3,
                            camera.position.z + fwdZ * 0.5
                        );
                        fl.target.position.set(
                            camera.position.x + fwdX * 20,
                            camera.position.y - 0.3,
                            camera.position.z + fwdZ * 20
                        );
                        fl.updateMatrixWorld();
                        fl.target.updateMatrixWorld();
                    } else if (!thirdPerson) {
                        const fl = gameState.playerFlashlight;
                        if (fl.parent !== camera) {
                            scene.remove(fl);
                            scene.remove(fl.target);
                            fl.position.set(0, -0.1, -0.3);
                            fl.target.position.set(0, -0.1, -20);
                            camera.add(fl);
                            camera.add(fl.target);
                        }
                    }
                    // Push fog far out while flashlight is on so the beam actually shows distant geometry
                    // (day/night cycle manages fog.near/far when flashlight is off)
                    if (scene.fog && currentWep === 'flashlight') {
                        const mapSize = MAPS[gameState.currentMap]?.size ?? 160;
                        scene.fog.far = mapSize * 6;
                    }
                    if (currentWep === 'flashlight' && gameState.zombieEntities.length > 0) {
                        const _flDir = new THREE.Vector3();
                        if (thirdPerson) {
                            _flDir.set(Math.sin(tpBodyYaw), 0, Math.cos(tpBodyYaw));
                        } else {
                            camera.getWorldDirection(_flDir);
                        }
                        const _flCos = Math.cos(Math.PI / 6);
                        const _flCamPos = camera.position;
                        for (const z of gameState.zombieEntities) {
                            if (z.dead) continue;
                            const _toZ = new THREE.Vector3().subVectors(z.mesh.position, _flCamPos);
                            const dist = _toZ.length();
                            if (dist > 900) continue;
                            if (_toZ.divideScalar(dist).dot(_flDir) > _flCos) z.attracted = true;
                        }
                    }
                }
                if (currentWep === 'compass') {
                    const targetPos = (gameState.hostage && !gameState.hostage.rescued) ?
                        gameState.hostage.mesh.position :
                        (gameState.extractionZone ? new THREE.Vector3(gameState.extractionZone.x, camera.position.y, gameState.extractionZone.z) : null);

                    if (targetPos) {
                        const needle = weaponModel.getObjectByName("needle");
                        const tpNeedle = tpGunGroup.getObjectByName("tp_needle");
                        if (needle || tpNeedle) {
                            const dirToTarget = new THREE.Vector3(
                                targetPos.x - camera.position.x,
                                0,
                                targetPos.z - camera.position.z
                            ).normalize();
                            if (needle) {
                                camera.updateMatrixWorld();
                                const invMatrix = new THREE.Matrix4().copy(camera.matrixWorld).invert();
                                const localDir = dirToTarget.clone().transformDirection(invMatrix);
                                needle.rotation.y = Math.atan2(localDir.x, localDir.z);
                            }
                            if (tpNeedle) {
                                tpGunGroup.updateMatrixWorld();
                                const invMatrix = new THREE.Matrix4().copy(tpGunGroup.matrixWorld).invert();
                                const localDir = dirToTarget.clone().transformDirection(invMatrix);
                                tpNeedle.rotation.y = Math.atan2(localDir.x, localDir.z);
                            }
                        }
                    }
                }

                const bobSpeed = keys.shift ? 12 : 8;
                const bobAmt = keys.shift ? 0.015 : 0.008;
                if (direction.x !== 0 || direction.z !== 0) {
                    weaponModel.position.y = Math.sin(time * 0.001 * bobSpeed) * bobAmt;
                    weaponModel.position.x = Math.cos(time * 0.001 * bobSpeed * 0.5) * bobAmt * 0.5;
                }
                if (weaponSwingTime > 0) {
                    setWeaponSwingTime(weaponSwingTime - dt);
                    weaponModel.rotation.x = -weaponSwingTime * 3;
                } else {
                    weaponModel.rotation.x = 0;
                }
            }
            updateHUD();
        } catch (e) { console.error('Game loop error:', e); }
    } // end if (gameState.active && !gameState.paused)

    // 3rd person camera positioning + render (always runs when game is active)
    if (thirdPerson && gameState.active) {
        const t = performance.now() * 0.001;
        const isMoving = keys.w || keys.a || keys.s || keys.d;
        const isSprint = isMoving && keys.shift;

        // Update body facing from WASD movement direction (relative to orbit camera)
        if (isMoving) {
            const fwd = new THREE.Vector3(-Math.sin(tpYaw), 0, -Math.cos(tpYaw));
            const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
            const moveDir = new THREE.Vector3();
            if (keys.w) moveDir.add(fwd);
            if (keys.s) moveDir.sub(fwd);
            if (keys.d) moveDir.add(right);
            if (keys.a) moveDir.sub(right);
            if (moveDir.lengthSq() > 0) {
                moveDir.normalize();
                const targetYaw = Math.atan2(moveDir.x, moveDir.z);
                let diff = targetYaw - tpBodyYaw;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                tpBodyYaw += diff * 0.2;
            }
        }

        // Place body at player's feet
        tpBody.position.set(camera.position.x, camera.position.y - 1.7, camera.position.z);
        tpBody.rotation.y = tpBodyYaw;

        // Aim torso toward mouse cursor horizontal position
        const aimOffset = (tpMouseX - 0.5) * Math.PI * 0.5;
        tpTorso.rotation.y = aimOffset;

        // Stride animation
        const strideSpeed = isSprint ? 8 : 5;
        const strideAmt = isSprint ? 0.9 : 0.65;
        const phase = isMoving ? t * strideSpeed : 0;
        const hipL = Math.sin(phase) * strideAmt;
        const hipR = -Math.sin(phase) * strideAmt;
        tpLegLPivot.rotation.x = hipL;
        tpLegRPivot.rotation.x = hipR;
        tpKneeLPivot.rotation.x = Math.max(0, -Math.sin(phase)) * strideAmt * 0.7;
        tpKneeRPivot.rotation.x = Math.max(0, Math.sin(phase)) * strideAmt * 0.7;
        // Resolve current weapon
        const curWep = playerState.weapons[playerState.currentWeaponIndex];
        const wDef = WEAPONS[curWep];
        const isMeleeWep = !!(wDef && (wDef.type === 'melee' || curWep === 'fists'));
        const isShieldWep = curWep === 'shield';
        const isRpgWep = curWep === 'rpg';
        const isMinigun = curWep === 'minigun';
        const isTwoHand = ['shotgun', 'assault_rifle', 'sniper', 'crossbow'].includes(curWep);

        // Rebuild 3rd-person weapon mesh when weapon changes
        if (curWep !== tpCurrentWeaponId) {
            tpCurrentWeaponId = curWep;
            rebuildTpWeapon(curWep, wDef);
        }

        // ── Per-weapon arm poses & weapon group transform ──────────────────────
        // hipR / hipL are already 0 when idle, so walk swing is baked in naturally.
        let armRX, armRZ = -0.08, armLX, armLZ = 0.12, gunRotX, gunPosY = -0.55, gunPosZ = 0.10;

        if (isShieldWep) {
            // Right arm in combat guard; left arm braces the torso-mounted shield
            armRX = -0.90 + (-hipR * 0.20);
            armLX = -0.65 + (-hipL * 0.15);
            armLZ = 0.22;
            gunRotX = 1.0;

        } else if (isRpgWep) {
            // Over-shoulder carry: arm swings backward so the tube rests on the shoulder
            armRX = 0.65 + (hipR * 0.15);   // positive = arm goes back/up
            armRZ = -0.18;
            armLX = -0.55 + (-hipL * 0.30);   // left arm steadying from front
            armLZ = 0.18;
            gunRotX = -0.65;                    // cancels arm tilt → tube stays horizontal
            gunPosY = -0.18;                    // slide weapon up toward the shoulder
            gunPosZ = -0.02;

        } else if (isMinigun) {
            // Hip-fire: both arms lower, barrel roughly horizontal at waist
            armRX = -0.68 + (-hipR * 0.18);
            armLX = -0.62 + (-hipL * 0.18);
            armLZ = 0.20;
            gunRotX = 0.68;                     // barrel more horizontal than default

        } else if (isTwoHand) {
            // Two-handed shoulder mount: both arms raised and forward
            armRX = -1.12 + (-hipR * 0.18);
            armLX = -1.08 + (-hipL * 0.22);   // left hand supporting under handguard
            armLZ = 0.08;
            gunRotX = 1.05;

        } else if (curWep === 'fists') {
            // Detect new punch: weaponSwingTime jumped back up
            if (weaponSwingTime > tpPrevSwingTime + 0.1) {
                tpPunchSide = -tpPunchSide; // alternate right/left
            }
            tpPrevSwingTime = weaponSwingTime;
            // punchAmt: 0.2→0 maps to 0.5→0 extension on the punching arm
            const punchAmt = weaponSwingTime * 2.5;
            // Boxing stance — both arms raised; punching arm extends forward
            armRX = -1.15 + (-hipR * 0.25) - (tpPunchSide === 1 ? punchAmt : 0);
            armRZ = -0.18;
            armLX = -1.15 + (-hipL * 0.25) - (tpPunchSide === -1 ? punchAmt : 0);
            armLZ = 0.18;
            gunRotX = 0.0;
            gunPosY = -0.55;
            gunPosZ = 0.08;

        } else if (isMeleeWep) {
            // Weapon at side ready to strike; off-hand swings naturally
            armRX = -0.88 + (-hipR * 0.45);
            armLX = -0.35 + (-hipL * 0.55);
            armLZ = 0.14;
            gunRotX = 1.0;

        } else {
            // Pistol / one-handed: raised forward aim, off-hand loose
            armRX = -1.32 + (-hipR * 0.25);
            armLX = -0.35 + (-hipL * 0.55);
            armLZ = 0.12;
            gunRotX = 1.12;
        }

        tpArmRPivot.rotation.x = armRX;
        tpArmRPivot.rotation.z = armRZ;
        tpArmLPivot.rotation.x = armLX;
        tpArmLPivot.rotation.z = armLZ;
        tpGunGroup.rotation.x = gunRotX;
        tpGunGroup.position.set(0, gunPosY, gunPosZ);
        tpTorso.position.y = 1.05 + (isMoving ? Math.abs(Math.sin(phase)) * 0.04 : 0);

        // Visibility: shield gets its own torso-mounted group
        tpShieldGroup.visible = isShieldWep;
        tpGunGroup.visible = !!(wDef && !isShieldWep);
        tpLeftFist.visible = true;
        tpRightFist.visible = (curWep !== 'fists'); // fists weapon uses tpGunGroup's own fist

        // Store shoot NDC for combat.js
        gameState.tpShootNDC = new THREE.Vector2(tpMouseX * 2 - 1, -(tpMouseY * 2 - 1));
        gameState.tpShootCamera = tpCamera;

        // Orbit camera around player using tpYaw/tpPitch
        const orbitDist = 4;
        tpCamera.position.set(
            camera.position.x + Math.sin(tpYaw) * Math.cos(tpPitch) * orbitDist,
            camera.position.y + Math.sin(tpPitch) * orbitDist + 0.5,
            camera.position.z + Math.cos(tpYaw) * Math.cos(tpPitch) * orbitDist
        );
        tpCamera.lookAt(camera.position.x, camera.position.y + 0.5, camera.position.z);

        renderer.render(scene, tpCamera);
    } else {
        gameState.tpShootNDC = null;
        gameState.tpShootCamera = null;
        renderer.render(scene, camera);
    }
}

// --- Initialize ---

renderMapScreen(startGame);

document.getElementById('btn-zombie').addEventListener('click', () => { gameState.pendingMode = 'zombie'; showScreen('map-screen'); });
document.getElementById('btn-rescue').addEventListener('click', () => {
    if (playerData.level < 10) {
        const overlay = document.getElementById('rescue-warning-overlay');
        document.getElementById('rescue-warn-level').textContent = `Level ${playerData.level}`;
        document.getElementById('rescue-warn-proceed').onclick = () => {
            overlay.style.display = 'none';
            startGame('rescue', 'mountain');
        };
        overlay.style.display = 'flex';
    } else {
        startGame('rescue', 'mountain');
    }
});
document.getElementById('btn-pvp').addEventListener('click', () => { gameState.pendingMode = 'pvp'; showScreen('map-screen'); });
document.getElementById('btn-shop').addEventListener('click', showShop);
document.getElementById('btn-loadout').addEventListener('click', showLoadout);
setupInput(CHEATS, resumeGame);
updateHomeStats();
initTutorial();
animate();
