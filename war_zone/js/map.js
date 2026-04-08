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
    gameState.craterPits = [];
    gameState.streetLamps = [];

    const map = MAPS[mapId];
    const size = map.size;

    scene.fog = new THREE.Fog(0x000000, size * 0.3, size * 0.9);
    scene.background = new THREE.Color(0x111111);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, map.ambientLight));
    const dirLight = new THREE.DirectionalLight(0xffffff, mapId === 'city' ? 0.1 : 0.6);
    dirLight.position.set(size / 2, size, size / 3);
    // City uses dynamic flashlights; skip expensive shadow map there
    dirLight.castShadow = mapId !== 'city';
    dirLight.shadow.mapSize.set(1024, 1024);
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
        // Ruined city atmosphere — pitch black with faint ash haze
        scene.fog = new THREE.Fog(0x060402, size * 0.25, size * 0.65);
        scene.background = new THREE.Color(0x030201);

        const buildingColors = [0x887766, 0x6a4040, 0x3a4a60, 0x706050, 0x446050, 0x604030, 0x806040];
        const winMat = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.35 });
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6 });
        const crateMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 });
        const graffitiColors = [0xff2222, 0x22ff22, 0x2222ff, 0xffff22, 0xff22ff];

        // === CITY GRID LAYOUT ===
        const blockPitch = 50;      // center-to-center spacing between city block rows/cols
        const roadSurfW = 10;       // asphalt road width
        const swalkW = 2.5;         // sidewalk width on each side of road
        const mapR = size * 0.95;   // how far roads extend (near boundary)
        // Roads at x,z = {-50, 0, +50}; Block centers at x,z = {-75, -25, +25, +75}

        // --- Road & sidewalk materials ---
        const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.95 });
        const curbMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.85 });
        const markingMat = new THREE.MeshBasicMaterial({ color: 0xddcc00 });

        // N-S roads (parallel to Z axis, at x = -50, 0, +50)
        const nsDashPos = [];
        for (let rxi = -1; rxi <= 1; rxi++) {
            const rx = rxi * blockPitch;
            const rMesh = new THREE.Mesh(new THREE.PlaneGeometry(roadSurfW, mapR * 2), asphaltMat);
            rMesh.rotation.x = -Math.PI / 2;
            rMesh.position.set(rx, 0.01, 0);
            scene.add(rMesh);
            // Collect dash positions (drawn later as one InstancedMesh)
            for (let dz = -mapR + 3; dz < mapR; dz += 7) nsDashPos.push(rx, dz);
            // Sidewalks + curb strips on each side
            for (const side of [-1, 1]) {
                const swx = rx + side * (roadSurfW / 2 + swalkW / 2);
                const sw = new THREE.Mesh(new THREE.PlaneGeometry(swalkW, mapR * 2), curbMat);
                sw.rotation.x = -Math.PI / 2;
                sw.position.set(swx, 0.05, 0);
                scene.add(sw);
                const curb = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, mapR * 2), curbMat);
                curb.position.set(rx + side * (roadSurfW / 2), 0.06, 0);
                scene.add(curb);
            }
        }

        // E-W roads (parallel to X axis, at z = -50, 0, +50)
        const ewDashPos = [];
        for (let rzi = -1; rzi <= 1; rzi++) {
            const rz = rzi * blockPitch;
            const rMesh = new THREE.Mesh(new THREE.PlaneGeometry(mapR * 2, roadSurfW), asphaltMat);
            rMesh.rotation.x = -Math.PI / 2;
            rMesh.position.set(0, 0.01, rz);
            scene.add(rMesh);
            // Collect dash positions
            for (let dx = -mapR + 3; dx < mapR; dx += 7) ewDashPos.push(dx, rz);
            // Sidewalks + curb strips
            for (const side of [-1, 1]) {
                const swz = rz + side * (roadSurfW / 2 + swalkW / 2);
                const sw = new THREE.Mesh(new THREE.PlaneGeometry(mapR * 2, swalkW), curbMat);
                sw.rotation.x = -Math.PI / 2;
                sw.position.set(0, 0.05, swz);
                scene.add(sw);
                const curb = new THREE.Mesh(new THREE.BoxGeometry(mapR * 2, 0.12, 0.15), curbMat);
                curb.position.set(0, 0.06, rz + side * (roadSurfW / 2));
                scene.add(curb);
            }
        }

        // Draw all road dashes as two InstancedMeshes (one per orientation) — big draw-call saving
        const _dashDummy = new THREE.Object3D();
        _dashDummy.rotation.x = -Math.PI / 2;
        const nsDashGeo = new THREE.PlaneGeometry(0.2, 3);
        const nsDashInst = new THREE.InstancedMesh(nsDashGeo, markingMat, nsDashPos.length / 2);
        for (let i = 0; i < nsDashPos.length / 2; i++) {
            _dashDummy.position.set(nsDashPos[i * 2], 0.015, nsDashPos[i * 2 + 1]);
            _dashDummy.updateMatrix();
            nsDashInst.setMatrixAt(i, _dashDummy.matrix);
        }
        nsDashInst.instanceMatrix.needsUpdate = true;
        scene.add(nsDashInst);

        const ewDashGeo = new THREE.PlaneGeometry(3, 0.2);
        const ewDashInst = new THREE.InstancedMesh(ewDashGeo, markingMat, ewDashPos.length / 2);
        for (let i = 0; i < ewDashPos.length / 2; i++) {
            _dashDummy.position.set(ewDashPos[i * 2], 0.015, ewDashPos[i * 2 + 1]);
            _dashDummy.updateMatrix();
            ewDashInst.setMatrixAt(i, _dashDummy.matrix);
        }
        ewDashInst.instanceMatrix.needsUpdate = true;
        scene.add(ewDashInst);

        // Helper: returns true if point (px, pz) falls within any road or sidewalk corridor
        const halfCorridor = roadSurfW / 2 + swalkW + 1.5;
        const onRoad = (px, pz) => {
            for (const rc of [-blockPitch, 0, blockPitch]) {
                if (Math.abs(px - rc) < halfCorridor) return true;
                if (Math.abs(pz - rc) < halfCorridor) return true;
            }
            return false;
        };

        // Pre-create one shared material per building colour (avoids 64 new allocations)
        const bMats = buildingColors.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));

        // === BUILDING GRID ===
        // 4 × 4 city blocks, each block has 2 rows × 2 columns of buildings
        const blockCenters = [
            -blockPitch * 1.5,  // -75
            -blockPitch * 0.5,  // -25
            blockPitch * 0.5,  //  25
            blockPitch * 1.5,  //  75
        ];

        for (const bcx of blockCenters) {
            for (const bcz of blockCenters) {
                // 2 rows (±7 from block centre Z) × 2 columns (±9 from block centre X)
                for (const rowOff of [-7, 7]) {
                    for (const colOff of [-9, 9]) {
                        const bx = bcx + colOff;
                        const bz = bcz + rowOff;

                        if (Math.abs(bx) < 14 && Math.abs(bz) < 14) continue;

                        const w = 12 + rng() * 5, h = 8 + rng() * 8, d = 10 + rng() * 3;

                        const bMat = bMats[Math.floor(rng() * bMats.length)];
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
                    }   // end colOff loop
                }   // end rowOff loop
            }   // end bcz loop
        }   // end bcx loop

        // Street lights — placed along roads on the sidewalks (each gets its own material for independent flicker)
        const lightPoleMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6 });
        const _lampBase = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0x443300, emissiveIntensity: 1.0 });
        // Lamp meshes are emissive-only — no per-lamp PointLight (45+ lights = severe lag).
        // Instead, one PointLight per road intersection (9 total) gives atmospheric pools of light.
        const _addLamp = (geo, lx, lz) => {
            const mat = _lampBase.clone();
            const lamp = new THREE.Mesh(geo, mat);
            lamp.position.set(lx, 5.7, lz);
            scene.add(lamp);
            gameState.streetLamps.push({ mat, phase: Math.random() * Math.PI * 2 });
        };
        // Along each N-S road
        for (const rx of [-blockPitch, 0, blockPitch]) {
            for (let lz = -mapR + 10; lz < mapR; lz += 22) {
                const lx = rx + roadSurfW / 2 + swalkW * 0.5;
                addObstacle(obs, lightPoleMat, 0.15, 5.5, 0.15, lx, 2.75, lz);
                _addLamp(new THREE.BoxGeometry(1.2, 0.3, 0.3), lx, lz);
            }
        }
        // Along each E-W road
        for (const rz of [-blockPitch, 0, blockPitch]) {
            for (let lx = -mapR + 10; lx < mapR; lx += 22) {
                const lz = rz + roadSurfW / 2 + swalkW * 0.5;
                addObstacle(obs, lightPoleMat, 0.15, 5.5, 0.15, lx, 2.75, lz);
                _addLamp(new THREE.BoxGeometry(0.3, 0.3, 1.2), lx, lz);
            }
        }
        // One PointLight per intersection (9 crossings) — pools of amber light on the asphalt
        for (const ix of [-blockPitch, 0, blockPitch]) {
            for (const iz of [-blockPitch, 0, blockPitch]) {
                const iLight = new THREE.PointLight(0xffaa44, 6, 22, 2);
                iLight.position.set(ix, 5.5, iz);
                scene.add(iLight);
            }
        }

        // Rubble everywhere — small visual pieces use InstancedMesh (1 draw call each material),
        // larger collision pieces are individual meshes kept off roads.
        const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x665544, roughness: 1.0 });
        const concChunkMat = new THREE.MeshStandardMaterial({ color: 0x887766, roughness: 0.95 });

        // Small decorative rubble: InstancedMesh, appears everywhere including roads (realistic)
        const SMALL_COUNT = 400;
        const _rDummy = new THREE.Object3D();
        const smallRubbleInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), rubbleMat, SMALL_COUNT);
        const smallConcInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), concChunkMat, SMALL_COUNT);
        for (let i = 0; i < SMALL_COUNT; i++) {
            for (const inst of [smallRubbleInst, smallConcInst]) {
                let px = (rng() - 0.5) * size * 1.5;
                let pz = (rng() - 0.5) * size * 1.5;
                // Push away from the exact spawn point but keep everywhere else
                if (Math.abs(px) < 6 && Math.abs(pz) < 6) { px += 10; pz += 10; }
                _rDummy.position.set(px, rng() * 0.15, pz);
                _rDummy.scale.set(0.2 + rng() * 1.2, 0.08 + rng() * 0.3, 0.2 + rng() * 0.9);
                _rDummy.rotation.set((rng() - 0.5) * 0.5, rng() * Math.PI * 2, (rng() - 0.5) * 0.5);
                _rDummy.updateMatrix();
                inst.setMatrixAt(i, _rDummy.matrix);
            }
        }
        smallRubbleInst.instanceMatrix.needsUpdate = true;
        smallConcInst.instanceMatrix.needsUpdate = true;
        scene.add(smallRubbleInst);
        scene.add(smallConcInst);

        // Medium collision rubble: off-road only, individual meshes for AABB collision
        for (let i = 0; i < 35; i++) {
            const rx = (rng() - 0.5) * size * 1.5;
            const rz = (rng() - 0.5) * size * 1.5;
            if (Math.abs(rx) < 8 && Math.abs(rz) < 8) continue;
            if (onRoad(rx, rz)) continue;
            const rw = 1.1 + rng() * 0.9, rh = 0.35 + rng() * 0.45, rd = 0.9 + rng() * 0.7;
            const chunk = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, rd), rng() < 0.5 ? rubbleMat : concChunkMat);
            chunk.position.set(rx, rh / 2, rz);
            chunk.rotation.y = rng() * Math.PI * 2;
            chunk.castShadow = true;
            scene.add(chunk);
            obs.push({ mesh: chunk, box: new THREE.Box3().setFromObject(chunk) });
        }

        // Impact craters — actual traversable pits the player can fall into
        const craterFloorMat = new THREE.MeshStandardMaterial({ color: 0x0d0b06, roughness: 1.0 });
        const craterWallMat = new THREE.MeshStandardMaterial({ color: 0x1e1208, roughness: 1.0, side: THREE.DoubleSide });
        const craterRimMat = new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 1.0 });
        const craterWarnMat = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0x441100, roughness: 0.8 });

        for (let i = 0; i < 12; i++) {
            const cx = (rng() - 0.5) * size * 1.3;
            const cz = (rng() - 0.5) * size * 1.3;
            if (Math.abs(cx) < 10 && Math.abs(cz) < 10) continue;

            const craterR = 1.8 + rng() * 3.5;
            // Depth scales with radius: ~2.2m for small craters, ~3.5m for large ones.
            // jumpForce=12, gravity=30 → max jump height ≈ 2.4m.
            // Small craters (depth<2.4m): player can jump out. Large: player is trapped.
            const depth = 1.6 + craterR * 0.35;

            // Register pit so getFloorHeight lowers the ground inside the crater
            gameState.craterPits.push({ cx, cz, r: craterR, depth });

            // Pit walls — cylinder extends rimLip metres ABOVE ground so it's visible from far away,
            // and down to -depth for the hole walls (DoubleSide so both inside & outside render).
            const rimLip = 0.45;
            const wallTotalH = depth + rimLip;
            const wallGeo = new THREE.CylinderGeometry(craterR * 0.88, craterR * 1.1, wallTotalH, 16, 1, true);
            const wall = new THREE.Mesh(wallGeo, craterWallMat);
            wall.position.set(cx, -(depth - rimLip) / 2, cz);
            scene.add(wall);

            // Black hole opening — clearly visible dark disc
            const holeCover = new THREE.Mesh(
                new THREE.CircleGeometry(craterR * 0.89, 20),
                craterFloorMat
            );
            holeCover.rotation.x = -Math.PI / 2;
            holeCover.position.set(cx, 0.022, cz);
            scene.add(holeCover);

            // Orange warning ring around the pit edge — clearly visible
            const ringGeo = new THREE.RingGeometry(craterR * 0.88, craterR * 1.3, 24);
            const ring = new THREE.Mesh(ringGeo, craterWarnMat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(cx, 0.025, cz);
            scene.add(ring);

            // Outer scorch ring
            const outerRingGeo = new THREE.RingGeometry(craterR * 1.3, craterR * 1.9, 24);
            const outerRing = new THREE.Mesh(outerRingGeo, craterFloorMat);
            outerRing.rotation.x = -Math.PI / 2;
            outerRing.position.set(cx, 0.015, cz);
            scene.add(outerRing);

            // Scorched floor disc at the bottom of the pit
            const floorDisc = new THREE.Mesh(
                new THREE.CylinderGeometry(craterR * 0.82, craterR * 1.0, 0.06, 16),
                craterFloorMat
            );
            floorDisc.position.set(cx, -depth + 0.04, cz);
            scene.add(floorDisc);

            // Rim rubble — collision obstacles that require jumping to clear,
            // blocking casual walk-through while still letting the player fall in from above
            const numRimChunks = 8 + Math.floor(rng() * 5);
            for (let c = 0; c < numRimChunks; c++) {
                const angle = (c / numRimChunks) * Math.PI * 2 + rng() * 0.4;
                const dist = craterR * (0.88 + rng() * 0.28);
                const cw = 0.5 + rng() * 0.8, ch = 0.45 + rng() * 0.55, cd = 0.5 + rng() * 0.7;
                addObstacle(obs, craterRimMat, cw, ch, cd,
                    cx + Math.cos(angle) * dist, ch / 2,
                    cz + Math.sin(angle) * dist
                );
                obs[obs.length - 1].isRimRubble = true;
            }
        }
    } else if (mapId === 'mountain') {
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x505050, roughness: 0.95 });
        const rockMat2 = new THREE.MeshStandardMaterial({ color: 0x3d3d3d, roughness: 0.98 });

        // Dense terrain grid — sloped tiles cover the entire map so there is NO flat ground.
        // Each tile is a thick slab tilted 12–28 degrees in a random direction.
        const tileStep = 44;
        const tileW = 48, tileThick = 5, tileD = 48;
        const halfSpan = Math.ceil(size * 1.05 / tileStep) * tileStep;
        for (let tx = -halfSpan; tx <= halfSpan; tx += tileStep) {
            for (let tz = -halfSpan; tz <= halfSpan; tz += tileStep) {
                if (Math.abs(tx) < 22 && Math.abs(tz) < 22) continue; // keep spawn flat
                const ty = rng() * 3.5;                        // 0–3.5 m elevation
                const rotX = (rng() - 0.5) * 0.65;              // ±0.32 rad ≈ ±18°
                const rotZ = (rng() - 0.5) * 0.65;
                const mat = rng() < 0.5 ? rockMat : rockMat2;
                const tile = new THREE.Mesh(new THREE.BoxGeometry(tileW, tileThick, tileD), mat);
                tile.rotation.x = rotX;
                tile.rotation.z = rotZ;
                tile.position.set(tx, ty, tz);
                tile.receiveShadow = true;
                scene.add(tile);
                tile.updateMatrixWorld(true);
                gameState.slopeMeshes.push(tile);
            }
        }

        // Large rock formations on top of the sloped terrain
        for (let i = 0; i < 240; i++) {
            const w = 10 + rng() * 20, h = 10 + rng() * 25, d = 10 + rng() * 20;
            const bx = (rng() - 0.5) * size * 1.8;
            const bz = (rng() - 0.5) * size * 1.8;
            if (Math.abs(bx) < 20 && Math.abs(bz) < 20) continue;

            // ~40% of rocks have a passage cut through them so no area is fully sealed off
            const hasGap = rng() < 0.40;
            if (hasGap && w > 8 && d > 8) {
                const gapSize = 3.0 + rng() * 1.5; // 3–4.5 m passage
                // Alternate gap orientation per rock
                if (rng() < 0.5) {
                    // Gap along X — split into front and back slabs
                    const halfD = (d - gapSize) / 2;
                    if (halfD > 1) {
                        addObstacle(obs, rockMat, w, h, halfD, bx, h / 2, bz - gapSize / 2 - halfD / 2);
                        addObstacle(obs, rockMat, w, h, halfD, bx, h / 2, bz + gapSize / 2 + halfD / 2);
                    } else { addObstacle(obs, rockMat, w, h, d, bx, h / 2, bz); }
                } else {
                    // Gap along Z — split into left and right slabs
                    const halfW = (w - gapSize) / 2;
                    if (halfW > 1) {
                        addObstacle(obs, rockMat, halfW, h, d, bx - gapSize / 2 - halfW / 2, h / 2, bz);
                        addObstacle(obs, rockMat, halfW, h, d, bx + gapSize / 2 + halfW / 2, h / 2, bz);
                    } else { addObstacle(obs, rockMat, w, h, d, bx, h / 2, bz); }
                }
            } else {
                addObstacle(obs, rockMat, w, h, d, bx, h / 2, bz);
            }
            const slope = new THREE.Mesh(new THREE.BoxGeometry(w * 1.5, h * 0.5, d * 1.5), rockMat);
            slope.rotation.x = (rng() - 0.5); slope.rotation.z = (rng() - 0.5);
            slope.position.set(bx, h / 4, bz);
            scene.add(slope);
            slope.updateMatrixWorld(true);
            obs.push({ mesh: slope, isSlope: true, box: new THREE.Box3().setFromObject(slope) });
            gameState.slopeMeshes.push(slope);
        }
    } else if (mapId === 'forest') {
        const treeMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f });
        const leafColors = [0x113a11, 0x0d3010, 0x1a4a1a, 0x0a2a0a];
        const mossColors = [0x2a4a1a, 0x3a5a2a];

        scene.fog = new THREE.Fog(0x060402, size * 0.25, size * 0.65);
        scene.background = new THREE.Color(0x030201);

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
    // Start with 5 ammo crates; more spawn in over time
    for (let _ai = 0; _ai < 5; _ai++) spawnSinglePickup(size, false);
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
