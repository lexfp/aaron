// Map building: terrain, obstacles, ammo pickups

import * as THREE from 'three';
import { MAPS } from './data.js';
import { scene, obstacles, setObstacles, setWallBounds } from './engine.js';
import { gameState } from './state.js';

function mulberry32(seed) {
    return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function addObstacle(obstacleList, mat, w, h, d, x, y, z) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    obstacleList.push({ mesh, box: new THREE.Box3().setFromObject(mesh) });
}

export function buildMap(mapId) {
    while (scene.children.length) scene.remove(scene.children[0]);
    const obs = [];
    setObstacles(obs);
    setWallBounds([]);
    gameState.slopeMeshes = [];

    const map = MAPS[mapId];
    const size = map.size;

    scene.fog = new THREE.Fog(0x000000, size * 0.3, size * 0.9);
    scene.background = new THREE.Color(0x111111);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, map.ambientLight));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(size / 2, size, size / 3);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.left = -size;
    dirLight.shadow.camera.right = size;
    dirLight.shadow.camera.top = size;
    dirLight.shadow.camera.bottom = -size;
    scene.add(dirLight);

    // Ground
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(size * 2, size * 2),
        new THREE.MeshStandardMaterial({ color: map.color, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Boundary walls
    const wallH = 8;
    const wallMat = new THREE.MeshStandardMaterial({ color: map.wallColor, roughness: 0.7 });
    const positions = [
        { x: 0, z: -size }, { x: 0, z: size },
        { x: -size, z: 0, ry: Math.PI / 2 }, { x: size, z: 0, ry: Math.PI / 2 }
    ];
    for (const p of positions) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(size * 2, wallH, 1), wallMat);
        mesh.position.set(p.x, wallH / 2, p.z);
        if (p.ry) mesh.rotation.y = p.ry;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
    }
    setWallBounds([
        { min: -size, max: size, axis: 'x' },
        { min: -size, max: size, axis: 'z' }
    ]);

    // Map-specific obstacles
    const obsMat = new THREE.MeshStandardMaterial({ color: map.wallColor, roughness: 0.6 });
    const rng = mulberry32(mapId.length * 12345);

    if (mapId === 'warehouse') {
        const metalObsMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.5, roughness: 0.6 });
        const woodPalletMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.9 });
        const barrelMat = new THREE.MeshStandardMaterial({ color: 0x334455, metalness: 0.5 });
        // Main shelf/crate stacks
        for (let i = 0; i < 120; i++) {
            const w = 1 + rng() * 3, h = 1 + rng() * 4, d = 1 + rng() * 3;
            const bx = (rng() - 0.5) * size * 1.5;
            const bz = (rng() - 0.5) * size * 1.5;
            if (Math.abs(bx) < 5 && Math.abs(bz) < 5) continue;
            addObstacle(obs, obsMat, w, h, d, bx, h / 2, bz);
        }
        // Metal shelving units
        for (let i = 0; i < 20; i++) {
            const sx = (rng() - 0.5) * size * 1.4;
            const sz = (rng() - 0.5) * size * 1.4;
            if (Math.abs(sx) < 6 && Math.abs(sz) < 6) continue;
            addObstacle(obs, metalObsMat, 0.15, 3.5, 4, sx, 1.75, sz);
            for (let shelf = 0; shelf < 3; shelf++) {
                addObstacle(obs, metalObsMat, 3, 0.1, 4, sx, 0.8 + shelf * 1.1, sz);
            }
        }
        // Wooden pallets on floor
        for (let i = 0; i < 30; i++) {
            const px = (rng() - 0.5) * size * 1.3;
            const pz = (rng() - 0.5) * size * 1.3;
            if (Math.abs(px) < 5 && Math.abs(pz) < 5) continue;
            addObstacle(obs, woodPalletMat, 1.2, 0.15, 0.9, px, 0.075, pz);
        }
        // Oil barrels in clusters
        for (let i = 0; i < 15; i++) {
            const bx2 = (rng() - 0.5) * size * 1.3;
            const bz2 = (rng() - 0.5) * size * 1.3;
            if (Math.abs(bx2) < 5 && Math.abs(bz2) < 5) continue;
            addObstacle(obs, barrelMat, 0.65, 1.1, 0.65, bx2, 0.55, bz2);
            if (rng() < 0.6) addObstacle(obs, barrelMat, 0.65, 1.1, 0.65, bx2 + 0.9, 0.55, bz2);
            if (rng() < 0.4) addObstacle(obs, barrelMat, 0.65, 1.1, 0.65, bx2 + 0.45, 0.55, bz2 + 0.85);
        }
        // Concrete pillars
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 });
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const r = size * 0.35;
            addObstacle(obs, pillarMat, 0.8, 6, 0.8, Math.cos(angle) * r, 3, Math.sin(angle) * r);
        }
    } else if (mapId === 'desert') {
        const cactusMat = new THREE.MeshStandardMaterial({ color: 0x3a8c3a, roughness: 0.85 });
        const sandRockMat = new THREE.MeshStandardMaterial({ color: 0xb89050, roughness: 0.95 });
        for (let i = 0; i < 90; i++) {
            const s = 0.6 + rng() * 1.4;
            const bx = (rng() - 0.5) * size * 1.6;
            const bz = (rng() - 0.5) * size * 1.6;
            if (Math.abs(bx) < 5 && Math.abs(bz) < 5) continue;
            // Cactus body
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * s, 0.38 * s, 2.8 * s, 7), cactusMat);
            body.position.set(bx, 1.4 * s, bz);
            body.castShadow = true;
            scene.add(body);
            obs.push({ mesh: body, radius: 0.4 * s, isCactus: true });
            // Left arm horizontal
            const lArmH = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.16 * s, 0.75 * s, 6), cactusMat);
            lArmH.rotation.z = Math.PI / 2;
            lArmH.position.set(bx - 0.55 * s, 1.4 * s, bz);
            scene.add(lArmH);
            // Left arm vertical
            const lArmV = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.15 * s, 0.65 * s, 6), cactusMat);
            lArmV.position.set(bx - 0.92 * s, 1.8 * s, bz);
            scene.add(lArmV);
            // Right arm (bigger cacti only)
            if (s > 1.0) {
                const rArmH = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.14 * s, 0.65 * s, 6), cactusMat);
                rArmH.rotation.z = -Math.PI / 2;
                rArmH.position.set(bx + 0.52 * s, 1.55 * s, bz);
                scene.add(rArmH);
                const rArmV = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * s, 0.13 * s, 0.55 * s, 6), cactusMat);
                rArmV.position.set(bx + 0.84 * s, 1.85 * s, bz);
                scene.add(rArmV);
            }
        }
        // Scattered rocks
        for (let i = 0; i < 50; i++) {
            const rs = 1 + rng() * 3;
            const rx = (rng() - 0.5) * size * 1.7;
            const rz = (rng() - 0.5) * size * 1.7;
            if (Math.abs(rx) < 5 && Math.abs(rz) < 5) continue;
            addObstacle(obs, sandRockMat, rs, rs * 0.5, rs * 0.9, rx, rs * 0.25, rz);
        }
        // Debris / broken crates
        const debrisMat = new THREE.MeshStandardMaterial({ color: 0x7a5a30, roughness: 0.9 });
        for (let i = 0; i < 20; i++) {
            const dx = (rng() - 0.5) * size * 1.5;
            const dz = (rng() - 0.5) * size * 1.5;
            if (Math.abs(dx) < 8 && Math.abs(dz) < 8) continue;
            addObstacle(obs, debrisMat, 0.8 + rng() * 1.2, 0.4 + rng() * 0.5, 0.8 + rng(), dx, 0.3, dz);
        }
    } else if (mapId === 'city') {
        // Ruined city atmosphere — smoky orange haze
        scene.fog = new THREE.Fog(0x3a2510, size * 0.15, size * 0.65);
        scene.background = new THREE.Color(0x1a1008);

        const buildingColors = [0x887766, 0x6a4040, 0x3a4a60, 0x706050, 0x446050, 0x604030, 0x806040];
        const winMat = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.35 });
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6 });
        const crateMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 });
        const graffitiColors = [0xff2222, 0x22ff22, 0x2222ff, 0xffff22, 0xff22ff];

        for (let i = 0; i < 80; i++) {
            const w = 12 + rng() * 10, h = 8 + rng() * 8, d = 12 + rng() * 10;
            const bx = (rng() - 0.5) * size * 1.5;
            const bz = (rng() - 0.5) * size * 1.5;
            if (Math.abs(bx) < 15 && Math.abs(bz) < 15) continue;

            const bMat = new THREE.MeshStandardMaterial({ color: buildingColors[Math.floor(rng() * buildingColors.length)], roughness: 0.8 });
            const thickness = 0.5;
            const doorW = 2.5, doorH = 3.5;
            // Jumpable window gap: bottom at 1.5m, top at 3.8m
            const winBottom = 1.5, winTop = 3.8, winGapW = 2.2;

            // Front wall with door — side panels sometimes breached
            const fPanelW = (w - doorW) / 2;
            const fPanelXL = bx - w / 2 + fPanelW / 2;
            const fPanelXR = bx + w / 2 - fPanelW / 2;
            const fWallZ = bz + d / 2;
            if (fPanelW > 3 && rng() < 0.5) {
                // Breach in left front panel
                const fbH = 1.5 + rng() * 2.0;
                const fbBot = fbH * 0.3;
                addObstacle(obs, bMat, fPanelW, fbBot, thickness, fPanelXL, fbBot / 2, fWallZ);
                const fbTop = h - fbH;
                if (fbTop > 0.3) addObstacle(obs, bMat, fPanelW, fbTop, thickness, fPanelXL, fbH + fbTop / 2, fWallZ);
            } else {
                addObstacle(obs, bMat, fPanelW, h, thickness, fPanelXL, h / 2, fWallZ);
            }
            if (fPanelW > 3 && rng() < 0.5) {
                // Breach in right front panel
                const fbH2 = 1.5 + rng() * 2.0;
                const fbBot2 = fbH2 * 0.3;
                addObstacle(obs, bMat, fPanelW, fbBot2, thickness, fPanelXR, fbBot2 / 2, fWallZ);
                const fbTop2 = h - fbH2;
                if (fbTop2 > 0.3) addObstacle(obs, bMat, fPanelW, fbTop2, thickness, fPanelXR, fbH2 + fbTop2 / 2, fWallZ);
            } else {
                addObstacle(obs, bMat, fPanelW, h, thickness, fPanelXR, h / 2, fWallZ);
            }
            addObstacle(obs, bMat, doorW, h - doorH, thickness, bx, h - (h - doorH) / 2, fWallZ);
            // Front windows (decorative)
            for (let fw = -1; fw <= 1; fw += 2) {
                const wm = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.8), winMat);
                wm.position.set(bx + fw * w * 0.28, h * 0.55, bz + d / 2 + 0.02);
                scene.add(wm);
            }

            // Back wall (50% backdoor)
            if (rng() > 0.5) {
                addObstacle(obs, bMat, (w - doorW) / 2, h, thickness, bx - w / 2 + (w - doorW) / 4, h / 2, bz - d / 2);
                addObstacle(obs, bMat, (w - doorW) / 2, h, thickness, bx + w / 2 - (w - doorW) / 4, h / 2, bz - d / 2);
                addObstacle(obs, bMat, doorW, h - doorH, thickness, bx, h - (h - doorH) / 2, bz - d / 2);
            } else {
                addObstacle(obs, bMat, w, h, thickness, bx, h / 2, bz - d / 2);
                // Back window (decorative)
                const bwm = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.8), winMat);
                bwm.position.set(bx, h * 0.55, bz - d / 2 - 0.02);
                bwm.rotation.y = Math.PI;
                scene.add(bwm);
            }

            // Side walls — with jumpable window openings
            const sideWallZ = [bx - w / 2, bx + w / 2];
            const sideSign = [-1, 1];
            for (let sw = 0; sw < 2; sw++) {
                const swx = sideWallZ[sw];
                if (d > winGapW + 3) {
                    // Bottom sill
                    addObstacle(obs, bMat, thickness, winBottom, d, swx, winBottom / 2, bz);
                    // Top lintel — sometimes blown out
                    if (h > winTop) {
                        const lintelH = h - winTop;
                        if (lintelH > 1.5 && rng() < 0.65) {
                            const brW3 = 1.5 + rng() * 2.5;
                            const brZ3 = bz + (rng() - 0.5) * (d - brW3 - 1.0);
                            const ljD3 = (brZ3 - brW3 / 2) - (bz - d / 2);
                            const rjD3 = (bz + d / 2) - (brZ3 + brW3 / 2);
                            if (ljD3 > 0.3) addObstacle(obs, bMat, thickness, lintelH, ljD3, swx, winTop + lintelH / 2, bz - d / 2 + ljD3 / 2);
                            if (rjD3 > 0.3) addObstacle(obs, bMat, thickness, lintelH, rjD3, swx, winTop + lintelH / 2, bz + d / 2 - rjD3 / 2);
                            for (let r = 0; r < 3; r++) {
                                const rc = new THREE.Mesh(new THREE.BoxGeometry(0.4 + rng() * 0.8, 0.3 + rng() * 0.5, 0.4 + rng() * 0.7), bMat);
                                rc.position.set(swx + sideSign[sw] * (0.3 + rng() * 1.5), winTop + 0.3 + rng() * 0.5, brZ3 + (rng() - 0.5) * brW3 * 0.8);
                                rc.rotation.y = rng() * Math.PI; rc.rotation.x = (rng() - 0.5) * 0.6;
                                scene.add(rc);
                            }
                        } else {
                            addObstacle(obs, bMat, thickness, lintelH, d, swx, winTop + lintelH / 2, bz);
                        }
                    }
                    // Left jamb — sometimes breached
                    const lJambD = (d - winGapW) / 2;
                    const lJambZ = bz - winGapW / 2 - lJambD / 2;
                    if (lJambD > 2.0 && rng() < 0.5) {
                        const brD4 = 0.8 + rng() * (lJambD * 0.6);
                        const brZ4 = lJambZ + (rng() - 0.5) * (lJambD - brD4) * 0.6;
                        const b4L = (brZ4 - brD4 / 2) - (lJambZ - lJambD / 2);
                        const b4R = (lJambZ + lJambD / 2) - (brZ4 + brD4 / 2);
                        if (b4L > 0.2) addObstacle(obs, bMat, thickness, winTop - winBottom, b4L, swx, winBottom + (winTop - winBottom) / 2, lJambZ - lJambD / 2 + b4L / 2);
                        if (b4R > 0.2) addObstacle(obs, bMat, thickness, winTop - winBottom, b4R, swx, winBottom + (winTop - winBottom) / 2, lJambZ + lJambD / 2 - b4R / 2);
                    } else {
                        addObstacle(obs, bMat, thickness, winTop - winBottom, lJambD, swx, winBottom + (winTop - winBottom) / 2, lJambZ);
                    }
                    // Right jamb
                    addObstacle(obs, bMat, thickness, winTop - winBottom, (d - winGapW) / 2, swx, winBottom + (winTop - winBottom) / 2, bz + winGapW / 2 + (d - winGapW) / 4);
                    // Glass pane (visual, no collision)
                    const sideGlass = new THREE.Mesh(new THREE.PlaneGeometry(winGapW, winTop - winBottom), winMat);
                    sideGlass.rotation.y = Math.PI / 2 * (sw === 0 ? -1 : 1);
                    sideGlass.position.set(swx, winBottom + (winTop - winBottom) / 2, bz);
                    scene.add(sideGlass);
                } else if (rng() < 0.8) {
                    // Breach: blown-out hole in wall
                    const brH = 1.8 + rng() * 2.2;
                    const brD = 1.8 + rng() * 2.5;
                    const brZ = bz + (rng() - 0.5) * d * 0.4;
                    // Bottom sill
                    addObstacle(obs, bMat, thickness, brH * 0.35, d, swx, brH * 0.175, bz);
                    // Top section
                    const topH = h - brH;
                    if (topH > 0.4) addObstacle(obs, bMat, thickness, topH, d, swx, brH + topH / 2, bz);
                    // Left jamb
                    const lJambD = (brZ - brD / 2) - (bz - d / 2);
                    if (lJambD > 0.3) addObstacle(obs, bMat, thickness, brH, lJambD, swx, brH / 2, bz - d / 2 + lJambD / 2);
                    // Right jamb
                    const rJambD = (bz + d / 2) - (brZ + brD / 2);
                    if (rJambD > 0.3) addObstacle(obs, bMat, thickness, brH, rJambD, swx, brH / 2, bz + d / 2 - rJambD / 2);
                    // Rubble spilled through breach
                    for (let r = 0; r < 4; r++) {
                        const rChunk = new THREE.Mesh(new THREE.BoxGeometry(0.4 + rng() * 0.8, 0.25 + rng() * 0.5, 0.4 + rng() * 0.7), bMat);
                        rChunk.position.set(swx + sideSign[sw] * (0.3 + rng() * 2.0), 0.2 + rng() * 0.2, brZ + (rng() - 0.5) * brD);
                        rChunk.rotation.y = rng() * Math.PI;
                        rChunk.rotation.x = (rng() - 0.5) * 0.6;
                        scene.add(rChunk);
                    }
                } else {
                    addObstacle(obs, bMat, thickness, h, d, swx, h / 2, bz);
                }
            }

            // Roof — sometimes damaged with holes
            if (rng() < 0.6) {
                addObstacle(obs, roofMat, w, thickness, d, bx, h + thickness / 2, bz);
            } else {
                const hx = bx + (rng() - 0.5) * w * 0.4;
                const hz = bz + (rng() - 0.5) * d * 0.4;
                const holeW = 2.5 + rng() * 3.5;
                const holeD = 2.5 + rng() * 3.5;
                const lw = (hx - holeW / 2) - (bx - w / 2);
                if (lw > 0.4) addObstacle(obs, roofMat, lw, thickness, d, bx - w / 2 + lw / 2, h + thickness / 2, bz);
                const rw2 = (bx + w / 2) - (hx + holeW / 2);
                if (rw2 > 0.4) addObstacle(obs, roofMat, rw2, thickness, d, bx + w / 2 - rw2 / 2, h + thickness / 2, bz);
                const fd = (hz - holeD / 2) - (bz - d / 2);
                if (fd > 0.4) addObstacle(obs, roofMat, holeW, thickness, fd, hx, h + thickness / 2, bz - d / 2 + fd / 2);
                const bd = (bz + d / 2) - (hz + holeD / 2);
                if (bd > 0.4) addObstacle(obs, roofMat, holeW, thickness, bd, hx, h + thickness / 2, bz + d / 2 - bd / 2);
                // Jagged chunks around the hole edge
                for (let e = 0; e < 6; e++) {
                    const angle = (e / 6) * Math.PI * 2;
                    const ex = hx + Math.cos(angle) * (holeW / 2 + rng() * 0.6);
                    const ez = hz + Math.sin(angle) * (holeD / 2 + rng() * 0.6);
                    const ew = 0.3 + rng() * 0.8;
                    const chunk = new THREE.Mesh(new THREE.BoxGeometry(ew, thickness + rng() * 0.5, ew), roofMat);
                    chunk.position.set(ex, h + thickness * 0.7, ez);
                    chunk.rotation.y = rng() * Math.PI;
                    chunk.rotation.z = (rng() - 0.5) * 0.9;
                    scene.add(chunk);
                }
            }
            // Roof details: AC unit
            if (rng() > 0.5) {
                addObstacle(obs, new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.4 }), 2, 1.2, 1.5, bx + (rng() - 0.5) * (w - 3), h + thickness + 0.6, bz + (rng() - 0.5) * (d - 3));
            }
            // Roof parapet
            addObstacle(obs, bMat, w, 0.8, thickness * 1.5, bx, h + thickness + 0.4, bz + d / 2);
            addObstacle(obs, bMat, w, 0.8, thickness * 1.5, bx, h + thickness + 0.4, bz - d / 2);
            addObstacle(obs, bMat, thickness * 1.5, 0.8, d, bx - w / 2, h + thickness + 0.4, bz);
            addObstacle(obs, bMat, thickness * 1.5, 0.8, d, bx + w / 2, h + thickness + 0.4, bz);

            // Second floor & interior stairs
            if (rng() > 0.35) {
                const floorH = h * 0.45;
                addObstacle(obs, bMat, w - thickness * 2, thickness, d / 2 - thickness, bx, floorH, bz - d / 4);
                // Interior stairs
                const steps = 8;
                const stepW = 2.5;
                const stepD = (d / 2 - 1) / steps;
                const stepH = floorH / steps;
                for (let s = 0; s < steps; s++) {
                    const curH = stepH * (s + 1);
                    addObstacle(obs, bMat, stepW, curH, stepD,
                        bx - w / 2 + thickness + stepW / 2,
                        curH / 2,
                        bz + d / 2 - thickness - 0.5 - stepD * s - stepD / 2);
                }
                // Second floor furniture
                const furnitureMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 });
                addObstacle(obs, furnitureMat, 2.5, 0.8, 1.2, bx, floorH + 0.4, bz - d / 4 + 1.5);
            }

            // External fire escape stairs
            if (rng() > 0.5) {
                const rsSteps = 12, rsW = 2;
                const rsD = (d - 2) / rsSteps;
                const rsH = (h + thickness) / rsSteps;
                for (let s = 0; s < rsSteps; s++) {
                    const curH = rsH * (s + 1);
                    addObstacle(obs, metalMat, rsW, curH, rsD,
                        bx + w / 2 + rsW / 2, curH / 2,
                        bz - d / 2 + 1 + rsD * s + rsD / 2);
                }
            }

            // Interior furniture
            const furnitureMat2 = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.9 });
            if (rng() < 0.7) addObstacle(obs, furnitureMat2, 1.5, 0.75, 0.8, bx + (rng() - 0.5) * (w - 3), 0.375, bz + (rng() - 0.5) * (d - 3));
            if (rng() < 0.5) addObstacle(obs, furnitureMat2, 0.8, 1.5, 0.5, bx + (rng() - 0.5) * (w - 3), 0.75, bz + (rng() - 0.5) * (d - 3));

            // Exterior crates & barrels
            const numCrates = Math.floor(rng() * 4) + 1;
            for (let c = 0; c < numCrates; c++) {
                const cx = bx + (rng() - 0.5) * (w + 4);
                const cz = bz + d / 2 + 1 + rng() * 3;
                addObstacle(obs, crateMat, 1.0 + rng() * 0.5, 1.0 + rng() * 0.5, 1.0 + rng() * 0.5, cx, 0.6, cz);
            }
            // Barrels
            if (rng() < 0.5) {
                const barrelMat = new THREE.MeshStandardMaterial({ color: 0x334455, metalness: 0.4 });
                const barX = bx + (rng() - 0.5) * (w + 2);
                const barZ = bz - d / 2 - 1.5 - rng() * 2;
                addObstacle(obs, barrelMat, 0.7, 1.1, 0.7, barX, 0.55, barZ);
                if (rng() < 0.5) addObstacle(obs, barrelMat, 0.7, 1.1, 0.7, barX + 1.0, 0.55, barZ);
            }
            // Street trash / debris
            if (rng() < 0.4) {
                const trashMat = new THREE.MeshStandardMaterial({ color: 0x555533, roughness: 1.0 });
                addObstacle(obs, trashMat, 0.4, 0.6, 0.4, bx - w / 2 - 1, 0.3, bz + rng() * d - d / 2);
            }

            // Graffiti decals on exterior walls
            const grafMat = new THREE.MeshBasicMaterial({
                color: graffitiColors[Math.floor(rng() * graffitiColors.length)],
                transparent: true, opacity: 0.7
            });
            const grafMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5 + rng() * 2, 0.8 + rng() * 1.2), grafMat);
            grafMesh.position.set(bx + (rng() - 0.5) * (w - 2), 1.5 + rng() * 2, bz + d / 2 + 0.03);
            scene.add(grafMesh);
        }

        // Street lights
        const lightPoleMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6 });
        for (let l = 0; l < 20; l++) {
            const lx = (rng() - 0.5) * size * 1.4;
            const lz = (rng() - 0.5) * size * 1.4;
            addObstacle(obs, lightPoleMat, 0.15, 5.5, 0.15, lx, 2.75, lz);
            // Lamp head
            const lampMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.3),
                new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0x443300 }));
            lampMesh.position.set(lx, 5.7, lz);
            scene.add(lampMesh);
        }

        // Scattered rubble piles
        const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x665544, roughness: 1.0 });
        const concChunkMat = new THREE.MeshStandardMaterial({ color: 0x887766, roughness: 0.95 });
        for (let i = 0; i < 80; i++) {
            const rx = (rng() - 0.5) * size * 1.5;
            const rz = (rng() - 0.5) * size * 1.5;
            if (Math.abs(rx) < 8 && Math.abs(rz) < 8) continue;
            const rw = 0.3 + rng() * 1.8, rh = 0.15 + rng() * 0.7, rd = 0.3 + rng() * 1.4;
            const chunk = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, rd), rng() < 0.5 ? rubbleMat : concChunkMat);
            chunk.position.set(rx, rh / 2, rz);
            chunk.rotation.y = rng() * Math.PI * 2;
            chunk.rotation.x = (rng() - 0.5) * 0.45;
            chunk.rotation.z = (rng() - 0.5) * 0.45;
            chunk.castShadow = true;
            scene.add(chunk);
            if (rw > 1.0 || rh > 0.45) obs.push({ mesh: chunk, box: new THREE.Box3().setFromObject(chunk) });
        }

        // Impact craters
        const craterGroundMat = new THREE.MeshStandardMaterial({ color: 0x111008, roughness: 1.0 });
        const craterRimMat = new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 1.0 });
        for (let i = 0; i < 12; i++) {
            const cx = (rng() - 0.5) * size * 1.3;
            const cz = (rng() - 0.5) * size * 1.3;
            if (Math.abs(cx) < 10 && Math.abs(cz) < 10) continue;
            const craterR = 1.8 + rng() * 3.5;
            // Scorched disc on ground
            const disc = new THREE.Mesh(new THREE.CylinderGeometry(craterR, craterR * 1.15, 0.04, 10), craterGroundMat);
            disc.position.set(cx, 0.02, cz);
            scene.add(disc);
            // Rubble ring around crater edge
            const numChunks = 5 + Math.floor(rng() * 5);
            for (let c = 0; c < numChunks; c++) {
                const angle = (c / numChunks) * Math.PI * 2 + rng() * 0.6;
                const dist = craterR * (0.85 + rng() * 0.55);
                const cw = 0.3 + rng() * 1.1, ch = 0.2 + rng() * 0.6, cd = 0.3 + rng() * 0.9;
                const rim = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cd), craterRimMat);
                rim.position.set(cx + Math.cos(angle) * dist, ch / 2, cz + Math.sin(angle) * dist);
                rim.rotation.y = rng() * Math.PI * 2;
                rim.rotation.x = (rng() - 0.5) * 0.7;
                rim.castShadow = true;
                scene.add(rim);
            }
        }
    } else if (mapId === 'mountain') {
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x505050, roughness: 0.95 });
        for (let i = 0; i < 240; i++) {
            const w = 10 + rng() * 20, h = 10 + rng() * 25, d = 10 + rng() * 20;
            const bx = (rng() - 0.5) * size * 1.8;
            const bz = (rng() - 0.5) * size * 1.8;
            if (Math.abs(bx) < 20 && Math.abs(bz) < 20) continue;

            addObstacle(obs, rockMat, w, h, d, bx, h / 2, bz);
            const slope = new THREE.Mesh(new THREE.BoxGeometry(w * 1.5, h * 0.5, d * 1.5), rockMat);
            slope.rotation.x = (rng() - 0.5); slope.rotation.z = (rng() - 0.5);
            slope.position.set(bx, h / 4, bz);
            scene.add(slope);
            obs.push({ mesh: slope, isSlope: true });
            gameState.slopeMeshes.push(slope);
        }
    } else if (mapId === 'forest') {
        const treeMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f });
        const leafColors = [0x113a11, 0x0d3010, 0x1a4a1a, 0x0a2a0a];
        const mossColors = [0x2a4a1a, 0x3a5a2a];

        scene.fog = new THREE.Fog(0x051105, size * 0.08, size * 0.38);
        scene.background = new THREE.Color(0x020802);

        // Dense Poisson-disk-style tree placement — min 2.5m apart
        const treePositions = [];
        const minDist = 2.5;
        let attempts = 0;
        while (treePositions.length < 1800 && attempts < 80000) {
            attempts++;
            const tx = (rng() - 0.5) * size * 1.88;
            const tz = (rng() - 0.5) * size * 1.88;
            if (Math.abs(tx) < 9 && Math.abs(tz) < 9) continue;
            let tooClose = false;
            for (const p of treePositions) {
                const pdx = tx - p[0], pdz = tz - p[1];
                if (pdx * pdx + pdz * pdz < minDist * minDist) { tooClose = true; break; }
            }
            if (!tooClose) treePositions.push([tx, tz]);
        }

        const leafMat = new THREE.MeshStandardMaterial({ color: leafColors[0] });
        for (const [x, z] of treePositions) {
            const scale = 0.4 + rng() * 1.8;
            const leafColor = leafColors[Math.floor(rng() * leafColors.length)];
            const thisLeafMat = new THREE.MeshStandardMaterial({ color: leafColor });

            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * scale, 0.55 * scale, 8 * scale, 6), treeMat);
            trunk.position.set(x, 4 * scale, z);
            trunk.castShadow = true;
            scene.add(trunk);
            obs.push({ mesh: trunk, radius: 0.55 * scale, box: new THREE.Box3().setFromObject(trunk), isTrunk: true });

            // Canopy (sometimes layered for large trees)
            const canopy = new THREE.Mesh(new THREE.SphereGeometry(3.2 * scale, 7, 5), thisLeafMat);
            canopy.position.set(x, 8.5 * scale, z);
            canopy.scale.y = 0.85;
            canopy.castShadow = true;
            scene.add(canopy);
            obs.push({ mesh: canopy, box: new THREE.Box3().setFromObject(canopy), passThrough: true });

            if (scale > 1.2) {
                const canopy2 = new THREE.Mesh(new THREE.SphereGeometry(2.2 * scale, 6, 4), thisLeafMat);
                canopy2.position.set(x + (rng() - 0.5) * scale, 10.5 * scale, z + (rng() - 0.5) * scale);
                scene.add(canopy2);
            }

            // Roots (only for larger trees to save drawcalls)
            if (scale > 1.0) {
                for (let j = 0; j < 3; j++) {
                    const rootAngle = j * (Math.PI * 2 / 3) + rng() * 0.5;
                    const root = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.35 * scale, 2.2 * scale, 4), treeMat);
                    root.rotation.x = Math.PI / 2 + 0.4 + rng() * 0.3;
                    root.rotation.y = rootAngle;
                    root.position.set(x + Math.cos(rootAngle) * scale * 0.75, 0.1, z + Math.sin(rootAngle) * scale * 0.75);
                    root.updateMatrixWorld(true);
                    scene.add(root);
                }
            }

            // Moss patches on ground around trunk
            if (rng() < 0.3) {
                const mossMat = new THREE.MeshStandardMaterial({ color: mossColors[Math.floor(rng() * mossColors.length)], roughness: 1.0 });
                const moss = new THREE.Mesh(new THREE.CylinderGeometry(1.2 * scale, 1.4 * scale, 0.08, 8), mossMat);
                moss.position.set(x, 0.04, z);
                scene.add(moss);
            }
        }

        // Fallen logs
        for (let l = 0; l < 60; l++) {
            const lx = (rng() - 0.5) * size * 1.8;
            const lz = (rng() - 0.5) * size * 1.8;
            if (Math.abs(lx) < 8 && Math.abs(lz) < 8) continue;
            const logScale = 0.5 + rng() * 1.2;
            const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * logScale, 0.28 * logScale, 4 * logScale, 6), treeMat);
            log.rotation.z = Math.PI / 2;
            log.rotation.y = rng() * Math.PI;
            log.position.set(lx, 0.22 * logScale, lz);
            log.castShadow = true;
            scene.add(log);
            obs.push({ mesh: log, box: new THREE.Box3().setFromObject(log) });
        }
    }

    setObstacles(obs);
    gameState.ammoPickups = [];
    // Start with only 1 ammo crate and 0 medkits; more spawn in over time
    spawnSinglePickup(size, false);
}

export function spawnSinglePickup(mapSize, forceMedkit = null) {
    // Medkits are rare (8% chance); most timed spawns are ammo
    const isMedkit = forceMedkit !== null ? forceMedkit : Math.random() < 0.20;
    const mat = new THREE.MeshStandardMaterial({ color: isMedkit ? 0x00ff00 : 0xffff00, emissive: isMedkit ? 0x004400 : 0x888800 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat);

    const sx = (Math.random() - 0.5) * mapSize * 1.5;
    const sz = (Math.random() - 0.5) * mapSize * 1.5;

    let spawnY = 0;
    const ray = new THREE.Raycaster(new THREE.Vector3(sx, 100, sz), new THREE.Vector3(0, -1, 0));
    const hits = ray.intersectObjects(obstacles.filter(o => o.mesh).map(o => o.mesh));
    if (hits.length > 0) spawnY = hits[0].point.y;

    mesh.position.set(sx, spawnY + 0.4, sz);
    gameState.ammoPickups.push({ mesh, collected: false, isMedkit });
    scene.add(mesh);
}

export function spawnExtractionZone(mapSize) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 20, 16), mat);

    let x, z;
    for (let attempts = 0; attempts < 50; attempts++) {
        x = (Math.random() - 0.5) * mapSize * 0.8;
        z = (Math.random() - 0.5) * mapSize * 0.8;
        let isClear = true;
        for (const obs of obstacles) {
            if (obs.box) {
                if (x + 3 > obs.box.min.x && x - 3 < obs.box.max.x &&
                    z + 3 > obs.box.min.z && z - 3 < obs.box.max.z) {
                    isClear = false;
                    break;
                }
            }
        }
        if (isClear) break;
    }

    let spawnY = 0;
    const ray = new THREE.Raycaster(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0));
    const hits = ray.intersectObjects(obstacles.filter(o => o.mesh).map(o => o.mesh));
    if (hits.length > 0) spawnY = hits[0].point.y;

    mesh.position.set(x, spawnY + 10, z);
    scene.add(mesh);
    gameState.extractionZone = { mesh, x, z };
}
