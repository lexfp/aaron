// Shooting, damage calculation, throwables, explosions, fire zones

import * as THREE from 'three';
import { WEAPONS } from './data.js';
import { playerData, playerState, savePlayerData, gameState } from './state.js';
import { scene, camera, controls, raycaster, setWeaponSwingTime } from './engine.js';
import { playSound, playGunshot, playHit, playExplosion } from './audio.js';
import { updateHUD, addKillFeed, showRoundOverlay } from './ui.js';
import { getCurrentWeapon, hasSilencer, hasScope, reload } from './weapons.js';
import { killZombie, attractZombies, spawnPvPEnemy } from './entities.js';
import { cb } from './callbacks.js';

export function shoot() {
    const { id, def, state } = getCurrentWeapon();
    const now = performance.now() / 1000;

    if (state.reloading || now - state.lastFired < def.fireRate) return;

    if (def.type === 'melee') {
        state.lastFired = now;
        setWeaponSwingTime(0.2);
        playSound(200, 0.05, 'triangle', 0.1);
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const hits = raycaster.intersectObjects(getEnemyMeshes(), true);
        if (hits.length > 0 && hits[0].distance < (def.reach || 1.5)) {
            applyDamageToEnemy(hits[0], calculateDamage(def, hits[0]));
        }
        return;
    }

    if (def.type === 'throwable') {
        if (state.ammo <= 0) { if (state.reserveAmmo > 0) reload(); return; }
        state.ammo--;
        state.lastFired = now;
        throwProjectile(def);
        updateHUD();
        return;
    }

    // Gun
    if (state.ammo <= 0) { if (state.reserveAmmo > 0) reload(); return; }
    state.ammo--;
    state.lastFired = now;
    setWeaponSwingTime(0.1);

    if (def.makesNoise && !hasSilencer(id)) attractZombies(camera.position, 50);
    if (hasSilencer(id)) playSound(100, 0.05, 'sine', 0.05);
    else playGunshot();

    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    if (def.explosive) {
        createExplosion(
            camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(15)),
            def.radius || 5, def.damage
        );
    } else {
        const hits = raycaster.intersectObjects(getEnemyMeshes(), true);
        if (hits.length > 0) applyDamageToEnemy(hits[0], calculateDamage(def, hits[0]));
        createMuzzleFlash();
    }
    updateHUD();
}

function getEnemyMeshes() {
    const meshes = [];
    for (const z of gameState.zombieEntities) { if (z.hp > 0) meshes.push(z.mesh); }
    if (gameState.pvpEnemy?.hp > 0) meshes.push(gameState.pvpEnemy.mesh);
    return meshes;
}

function calculateDamage(def, hit) {
    let dmg = def.damage;
    const isZoomed = playerState.isZoomed;
    if (isZoomed && def.zoomedDamage) dmg = def.zoomedDamage;

    const wid = playerState.weapons[playerState.currentWeaponIndex];
    if (isZoomed && hasScope(wid) && !def.hasScope) dmg += 20;
    if (def.closeDamageBonus && hit.distance < 5) dmg += def.closeDamageBonus;
    if (def.range === 'middle' && (hit.distance > 20 || hit.distance < 2)) dmg *= 0.9;

    const hitEntity = findEntityFromHit(hit);
    if (hitEntity) {
        const localY = hit.point.y - hitEntity.mesh.position.y;
        const entityHeight = hitEntity.isBoss ? 2.2 : 1.8;
        if (localY > entityHeight * 0.75) {
            const hasActiveScope = def.hasScope || hasScope(wid);
            dmg += (hasActiveScope && isZoomed) ? 40 : 10;
            addKillFeed('HEADSHOT!', '#ff4444');
        } else if (localY > entityHeight * 0.5 && (hit.point.x - hitEntity.mesh.position.x) > 0.2) {
            dmg = Math.max(0, dmg - 5);
        }
    }
    return Math.floor(dmg);
}

function findEntityFromHit(hit) {
    for (const z of gameState.zombieEntities) {
        if (z.hp <= 0) continue;
        let parent = hit.object;
        while (parent) { if (parent === z.mesh) return z; parent = parent.parent; }
    }
    if (gameState.pvpEnemy?.hp > 0) {
        let parent = hit.object;
        while (parent) { if (parent === gameState.pvpEnemy.mesh) return gameState.pvpEnemy; parent = parent.parent; }
    }
    return null;
}

function applyDamageToEnemy(hit, dmg) {
    const entity = findEntityFromHit(hit);
    if (!entity) return;
    entity.hp -= dmg;
    playHit();
    showDamageNumber(hit.point, dmg);

    if (entity.hp <= 0) {
        if (gameState.mode === 'zombie') {
            const idx = gameState.zombieEntities.indexOf(entity);
            if (idx >= 0) killZombie(entity, idx);
        } else if (gameState.mode === 'pvp') {
            gameState.pvpPlayerScore++;
            addKillFeed('Enemy eliminated!', '#00ff88');
            document.getElementById('wave-hud').textContent =
                `Round ${gameState.pvpRound} | ${gameState.pvpPlayerScore}-${gameState.pvpEnemyScore}`;
            checkPvPEnd();
        }
    }
}

export function damagePlayer(amount) {
    if (playerState.godMode) return;
    const { def } = getCurrentWeapon();
    if (def.damageReduction) amount *= (1 - def.damageReduction);
    amount *= (1 - playerState.damageReduction);

    if (playerState.armor > 0) {
        const absorbed = Math.min(playerState.armor, amount * 0.5);
        playerState.armor -= absorbed;
        amount -= absorbed;
    }
    playerState.hp = Math.max(0, playerState.hp - Math.floor(amount));

    const overlay = document.getElementById('damage-overlay');
    overlay.style.opacity = '0.6';
    setTimeout(() => overlay.style.opacity = '0', 150);
    playSound(100, 0.1, 'sawtooth', 0.1);
    updateHUD();

    if (playerState.hp <= 0) gameOver();
}

// --- Throwables & Explosions ---

function throwProjectile(def) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const start = camera.position.clone();
    if (def.explosive) createExplosion(start.clone().add(dir.clone().multiplyScalar(20)), def.radius, def.damage);
    if (def.fire) createFireZone(start.clone().add(dir.clone().multiplyScalar(15)), def.radius, def.damage, def.duration);
}

function createExplosion(pos, radius, damage) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.7 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 12), mat);
    mesh.position.copy(pos);
    scene.add(mesh);
    playExplosion();

    for (const z of gameState.zombieEntities) {
        if (z.hp > 0 && z.mesh.position.distanceTo(pos) < radius) {
            z.hp -= damage;
            if (z.hp <= 0) { const idx = gameState.zombieEntities.indexOf(z); if (idx >= 0) killZombie(z, idx); }
        }
    }
    if (gameState.pvpEnemy?.hp > 0 && gameState.pvpEnemy.mesh.position.distanceTo(pos) < radius) {
        gameState.pvpEnemy.hp -= damage;
    }
    if (camera.position.distanceTo(pos) < radius) damagePlayer(damage * 0.5);

    let t = 0;
    const fadeInt = setInterval(() => {
        t += 0.05;
        mesh.scale.setScalar(1 + t * 2);
        mat.opacity -= 0.05;
        if (mat.opacity <= 0) { scene.remove(mesh); clearInterval(fadeInt); }
    }, 30);
}

function createFireZone(pos, radius, dps, duration) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.4 });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.3, 16), mat);
    mesh.position.copy(pos);
    mesh.position.y = 0.15;
    scene.add(mesh);
    gameState.fireZones.push({ position: pos, radius, dps, mesh, endTime: performance.now() / 1000 + duration });
}

export function updateFireZones(dt) {
    const now = performance.now() / 1000;
    for (let i = gameState.fireZones.length - 1; i >= 0; i--) {
        const fz = gameState.fireZones[i];
        if (now > fz.endTime) { scene.remove(fz.mesh); gameState.fireZones.splice(i, 1); continue; }
        fz.mesh.material.opacity = 0.3 + Math.sin(now * 10) * 0.15;
        if (camera.position.distanceTo(fz.position) < fz.radius) damagePlayer(fz.dps * dt);
    }
}

function createMuzzleFlash() {
    const flash = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );
    flash.position.set(0.15, -0.1, -0.65);
    camera.add(flash);
    setTimeout(() => camera.remove(flash), 50);
}

function showDamageNumber(pos, dmg) {
    const div = document.createElement('div');
    div.style.color = '#ffaa00';
    div.textContent = `-${dmg}`;
    document.getElementById('kill-feed').appendChild(div);
    setTimeout(() => div.remove(), 1000);
}

// --- PvP End ---

export function checkPvPEnd() {
    if (gameState.pvpPlayerScore >= 3) {
        playerData.money += 200;
        savePlayerData();
        showRoundOverlay('YOU WIN!', '+$200', 3000);
        setTimeout(() => cb.quitToMenu(), 3500);
    } else if (gameState.pvpEnemyScore >= 3) {
        showRoundOverlay('YOU LOSE', '', 3000);
        setTimeout(() => cb.quitToMenu(), 3500);
    } else {
        gameState.pvpRound++;
        showRoundOverlay('Round ' + gameState.pvpRound, `${gameState.pvpPlayerScore} - ${gameState.pvpEnemyScore}`, 2000);
        setTimeout(() => {
            camera.position.set(0, 1.7, 0);
            spawnPvPEnemy();
            playerState.hp = playerState.maxHp;
            updateHUD();
        }, 2500);
    }
}

// --- Game Over ---

function gameOver() {
    gameState.active = false;
    controls.unlock();

    playerData.missions++;
    for (const wid of playerState.weapons) {
        if (wid === 'fists') continue;
        if (!playerData.weaponUsage[wid]) playerData.weaponUsage[wid] = 0;
        playerData.weaponUsage[wid]++;
    }
    savePlayerData();
    showRoundOverlay('GAME OVER', `Wave ${gameState.wave} | $${playerData.money}`, 0, true);
}
