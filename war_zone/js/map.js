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

let _noShadowMap = false; // set true for maps where shadows are disabled

function addObstacle(obstacleList, mat, w, h, d, x, y, z, opts = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    const shadow = !opts.noShadow && !_noShadowMap;
    mesh.castShadow = shadow;
    mesh.receiveShadow = shadow;
    scene.add(mesh);
    if (!opts.noCollide) {
        obstacleList.push({ mesh, box: new THREE.Box3().setFromObject(mesh) });
    }
}

// --- City chunk streaming ---
const _cityChunks = new Map();  // key → { meshes[], chunkObs[] }
let _cityObs = null;            // live reference to the active obstacles array
let _cityBlockCenters = [];     // flat [x0,z0, x1,z1, ...] of all block centers
let _cityMats = null;           // shared materials passed to chunk builder
const CHUNK_LOAD_DIST = 150;
const CHUNK_UNLOAD_DIST = 240;

// --- Forest chunk streaming ---
const _forestChunks = new Map();
let _forestObs = null;
let _forestChunkCenters = [];
let _forestMats = null;
const FOREST_CHUNK_SIZE = 60;

// --- Mountain chunk streaming ---
const _mountainChunks = new Map();
let _mountainObs = null;
let _mountainChunkCenters = [];
let _mountainMats = null;
const MOUNTAIN_TILE_STEP = 44;

// --- Desert chunk streaming ---
const _desertChunks = new Map();
let _desertObs = null;
let _desertChunkCenters = [];
let _desertMats = null;
const DESERT_CHUNK_SIZE = 60;

const TERRAIN_LOAD_DIST = 150;
const TERRAIN_UNLOAD_DIST = 240;

function _buildCityChunkMeshes(bcx, bcz) {
    const seed = Math.abs(Math.imul(bcx | 0, 73856093) ^ Math.imul(bcz | 0, 19349663));
    const rng = mulberry32((seed % 0x7fffffff) + 1);
    const meshes = [];
    const chunkObs = [];
    const { bMats, winMat, roofMat, metalMat, crateMat, furnitureMat, furnitureMat2, acMat, barrelMat, trashMat, grafMats } = _cityMats;

    const addObs = (mat, w, h, d, x, y, z, opts = {}) => {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        scene.add(mesh);
        meshes.push(mesh);
        if (!opts.noCollide) chunkObs.push({ mesh, box: new THREE.Box3().setFromObject(mesh) });
    };
    const addVis = (mesh) => { scene.add(mesh); meshes.push(mesh); };

    for (const rowOff of [-7, 7]) {
        for (const colOff of [-9, 9]) {
            const bx = bcx + colOff;
            const bz = bcz + rowOff;
            if (Math.abs(bx) < 14 && Math.abs(bz) < 14) continue;

            const w = 12 + rng() * 5, h = 8 + rng() * 8, d = 10 + rng() * 3;
            const bMat = bMats[Math.floor(rng() * bMats.length)];
            const thickness = 0.5;
            const doorW = 2.5, doorH = 3.5;
            const winBottom = 1.5, winTop = 3.8, winGapW = 2.2;

            // Front wall with door — side panels sometimes breached
            const fPanelW = (w - doorW) / 2;
            const fPanelXL = bx - w / 2 + fPanelW / 2;
            const fPanelXR = bx + w / 2 - fPanelW / 2;
            const fWallZ = bz + d / 2;
            if (fPanelW > 3 && rng() < 0.5) {
                const fbH = 1.5 + rng() * 2.0;
                const fbBot = fbH * 0.3;
                addObs(bMat, fPanelW, fbBot, thickness, fPanelXL, fbBot / 2, fWallZ);
                const fbTop = h - fbH;
                if (fbTop > 0.3) addObs(bMat, fPanelW, fbTop, thickness, fPanelXL, fbH + fbTop / 2, fWallZ);
            } else {
                addObs(bMat, fPanelW, h, thickness, fPanelXL, h / 2, fWallZ);
            }
            if (fPanelW > 3 && rng() < 0.5) {
                const fbH2 = 1.5 + rng() * 2.0;
                const fbBot2 = fbH2 * 0.3;
                addObs(bMat, fPanelW, fbBot2, thickness, fPanelXR, fbBot2 / 2, fWallZ);
                const fbTop2 = h - fbH2;
                if (fbTop2 > 0.3) addObs(bMat, fPanelW, fbTop2, thickness, fPanelXR, fbH2 + fbTop2 / 2, fWallZ);
            } else {
                addObs(bMat, fPanelW, h, thickness, fPanelXR, h / 2, fWallZ);
            }
            addObs(bMat, doorW, h - doorH, thickness, bx, h - (h - doorH) / 2, fWallZ);
            for (let fw = -1; fw <= 1; fw += 2) {
                const wm = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.8), winMat);
                wm.position.set(bx + fw * w * 0.28, h * 0.55, bz + d / 2 + 0.02);
                addVis(wm);
            }

            // Back wall (50% backdoor)
            if (rng() > 0.5) {
                addObs(bMat, (w - doorW) / 2, h, thickness, bx - w / 2 + (w - doorW) / 4, h / 2, bz - d / 2);
                addObs(bMat, (w - doorW) / 2, h, thickness, bx + w / 2 - (w - doorW) / 4, h / 2, bz - d / 2);
                addObs(bMat, doorW, h - doorH, thickness, bx, h - (h - doorH) / 2, bz - d / 2);
            } else {
                addObs(bMat, w, h, thickness, bx, h / 2, bz - d / 2);
                const bwm = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.8), winMat);
                bwm.position.set(bx, h * 0.55, bz - d / 2 - 0.02);
                bwm.rotation.y = Math.PI;
                addVis(bwm);
            }

            // Side walls — with jumpable window openings
            const sideWallX = [bx - w / 2, bx + w / 2];
            const sideSign = [-1, 1];
            for (let sw = 0; sw < 2; sw++) {
                const swx = sideWallX[sw];
                if (d > winGapW + 3) {
                    addObs(bMat, thickness, winBottom, d, swx, winBottom / 2, bz);
                    if (h > winTop) {
                        const lintelH = h - winTop;
                        if (lintelH > 1.5 && rng() < 0.65) {
                            const brW3 = 1.5 + rng() * 2.5;
                            const brZ3 = bz + (rng() - 0.5) * (d - brW3 - 1.0);
                            const ljD3 = (brZ3 - brW3 / 2) - (bz - d / 2);
                            const rjD3 = (bz + d / 2) - (brZ3 + brW3 / 2);
                            if (ljD3 > 0.3) addObs(bMat, thickness, lintelH, ljD3, swx, winTop + lintelH / 2, bz - d / 2 + ljD3 / 2);
                            if (rjD3 > 0.3) addObs(bMat, thickness, lintelH, rjD3, swx, winTop + lintelH / 2, bz + d / 2 - rjD3 / 2);
                            for (let r = 0; r < 3; r++) {
                                const rc = new THREE.Mesh(new THREE.BoxGeometry(0.4 + rng() * 0.8, 0.3 + rng() * 0.5, 0.4 + rng() * 0.7), bMat);
                                rc.position.set(swx + sideSign[sw] * (0.3 + rng() * 1.5), winTop + 0.3 + rng() * 0.5, brZ3 + (rng() - 0.5) * brW3 * 0.8);
                                rc.rotation.y = rng() * Math.PI; rc.rotation.x = (rng() - 0.5) * 0.6;
                                addVis(rc);
                            }
                        } else {
                            addObs(bMat, thickness, lintelH, d, swx, winTop + lintelH / 2, bz);
                        }
                    }
                    const lJambD = (d - winGapW) / 2;
                    const lJambZ = bz - winGapW / 2 - lJambD / 2;
                    if (lJambD > 2.0 && rng() < 0.5) {
                        const brD4 = 0.8 + rng() * (lJambD * 0.6);
                        const brZ4 = lJambZ + (rng() - 0.5) * (lJambD - brD4) * 0.6;
                        const b4L = (brZ4 - brD4 / 2) - (lJambZ - lJambD / 2);
                        const b4R = (lJambZ + lJambD / 2) - (brZ4 + brD4 / 2);
                        if (b4L > 0.2) addObs(bMat, thickness, winTop - winBottom, b4L, swx, winBottom + (winTop - winBottom) / 2, lJambZ - lJambD / 2 + b4L / 2);
                        if (b4R > 0.2) addObs(bMat, thickness, winTop - winBottom, b4R, swx, winBottom + (winTop - winBottom) / 2, lJambZ + lJambD / 2 - b4R / 2);
                    } else {
                        addObs(bMat, thickness, winTop - winBottom, lJambD, swx, winBottom + (winTop - winBottom) / 2, lJambZ);
                    }
                    addObs(bMat, thickness, winTop - winBottom, (d - winGapW) / 2, swx, winBottom + (winTop - winBottom) / 2, bz + winGapW / 2 + (d - winGapW) / 4);
                    const sideGlass = new THREE.Mesh(new THREE.PlaneGeometry(winGapW, winTop - winBottom), winMat);
                    sideGlass.rotation.y = Math.PI / 2 * (sw === 0 ? -1 : 1);
                    sideGlass.position.set(swx, winBottom + (winTop - winBottom) / 2, bz);
                    addVis(sideGlass);
                } else if (rng() < 0.8) {
                    const brH = 1.8 + rng() * 2.2;
                    const brD = 1.8 + rng() * 2.5;
                    const brZ = bz + (rng() - 0.5) * d * 0.4;
                    addObs(bMat, thickness, brH * 0.35, d, swx, brH * 0.175, bz);
                    const topH = h - brH;
                    if (topH > 0.4) addObs(bMat, thickness, topH, d, swx, brH + topH / 2, bz);
                    const lJambD2 = (brZ - brD / 2) - (bz - d / 2);
                    if (lJambD2 > 0.3) addObs(bMat, thickness, brH, lJambD2, swx, brH / 2, bz - d / 2 + lJambD2 / 2);
                    const rJambD = (bz + d / 2) - (brZ + brD / 2);
                    if (rJambD > 0.3) addObs(bMat, thickness, brH, rJambD, swx, brH / 2, bz + d / 2 - rJambD / 2);
                    for (let r = 0; r < 4; r++) {
                        const rChunk = new THREE.Mesh(new THREE.BoxGeometry(0.4 + rng() * 0.8, 0.25 + rng() * 0.5, 0.4 + rng() * 0.7), bMat);
                        rChunk.position.set(swx + sideSign[sw] * (0.3 + rng() * 2.0), 0.2 + rng() * 0.2, brZ + (rng() - 0.5) * brD);
                        rChunk.rotation.y = rng() * Math.PI;
                        rChunk.rotation.x = (rng() - 0.5) * 0.6;
                        addVis(rChunk);
                    }
                } else {
                    addObs(bMat, thickness, h, d, swx, h / 2, bz);
                }
            }

            // Roof — sometimes damaged with holes
            if (rng() < 0.6) {
                addObs(roofMat, w, thickness, d, bx, h + thickness / 2, bz);
            } else {
                const hx = bx + (rng() - 0.5) * w * 0.4;
                const hz = bz + (rng() - 0.5) * d * 0.4;
                const holeW = 2.5 + rng() * 3.5;
                const holeD = 2.5 + rng() * 3.5;
                const lw = (hx - holeW / 2) - (bx - w / 2);
                if (lw > 0.4) addObs(roofMat, lw, thickness, d, bx - w / 2 + lw / 2, h + thickness / 2, bz);
                const rw2 = (bx + w / 2) - (hx + holeW / 2);
                if (rw2 > 0.4) addObs(roofMat, rw2, thickness, d, bx + w / 2 - rw2 / 2, h + thickness / 2, bz);
                const fd = (hz - holeD / 2) - (bz - d / 2);
                if (fd > 0.4) addObs(roofMat, holeW, thickness, fd, hx, h + thickness / 2, bz - d / 2 + fd / 2);
                const bd = (bz + d / 2) - (hz + holeD / 2);
                if (bd > 0.4) addObs(roofMat, holeW, thickness, bd, hx, h + thickness / 2, bz + d / 2 - bd / 2);
                for (let e = 0; e < 6; e++) {
                    const angle = (e / 6) * Math.PI * 2;
                    const ex = hx + Math.cos(angle) * (holeW / 2 + rng() * 0.6);
                    const ez = hz + Math.sin(angle) * (holeD / 2 + rng() * 0.6);
                    const ew = 0.3 + rng() * 0.8;
                    const chunk = new THREE.Mesh(new THREE.BoxGeometry(ew, thickness + rng() * 0.5, ew), roofMat);
                    chunk.position.set(ex, h + thickness * 0.7, ez);
                    chunk.rotation.y = rng() * Math.PI;
                    chunk.rotation.z = (rng() - 0.5) * 0.9;
                    addVis(chunk);
                }
            }
            if (rng() > 0.5) {
                addObs(acMat, 2, 1.2, 1.5, bx + (rng() - 0.5) * (w - 3), h + thickness + 0.6, bz + (rng() - 0.5) * (d - 3));
            }
            addObs(bMat, w, 0.8, thickness * 1.5, bx, h + thickness + 0.4, bz + d / 2);
            addObs(bMat, w, 0.8, thickness * 1.5, bx, h + thickness + 0.4, bz - d / 2);
            addObs(bMat, thickness * 1.5, 0.8, d, bx - w / 2, h + thickness + 0.4, bz);
            addObs(bMat, thickness * 1.5, 0.8, d, bx + w / 2, h + thickness + 0.4, bz);

            // Second floor & interior stairs
            if (rng() > 0.35) {
                const floorH = h * 0.45;
                addObs(bMat, w - thickness * 2, thickness, d / 2 - thickness, bx, floorH, bz - d / 4);
                const steps = 8;
                const stepW = 2.5;
                const stepD = (d / 2 - 1) / steps;
                const stepH = floorH / steps;
                for (let s = 0; s < steps; s++) {
                    const curH = stepH * (s + 1);
                    addObs(bMat, stepW, curH, stepD,
                        bx - w / 2 + thickness + stepW / 2,
                        curH / 2,
                        bz + d / 2 - thickness - 0.5 - stepD * s - stepD / 2);
                }
                addObs(furnitureMat, 2.5, 0.8, 1.2, bx, floorH + 0.4, bz - d / 4 + 1.5);
            }

            // External fire escape stairs
            if (rng() > 0.5) {
                const rsSteps = 12, rsW = 2;
                const rsD = (d - 2) / rsSteps;
                const rsH = (h + thickness) / rsSteps;
                for (let s = 0; s < rsSteps; s++) {
                    const curH = rsH * (s + 1);
                    addObs(metalMat, rsW, curH, rsD,
                        bx + w / 2 + rsW / 2, curH / 2,
                        bz - d / 2 + 1 + rsD * s + rsD / 2);
                }
            }

            // Interior furniture
            if (rng() < 0.7) addObs(furnitureMat2, 1.5, 0.75, 0.8, bx + (rng() - 0.5) * (w - 3), 0.375, bz + (rng() - 0.5) * (d - 3));
            if (rng() < 0.5) addObs(furnitureMat2, 0.8, 1.5, 0.5, bx + (rng() - 0.5) * (w - 3), 0.75, bz + (rng() - 0.5) * (d - 3));

            // Exterior crates & barrels
            const numCrates = Math.floor(rng() * 4) + 1;
            for (let c = 0; c < numCrates; c++) {
                const cx2 = bx + (rng() - 0.5) * (w + 4);
                const cz2 = bz + d / 2 + 1 + rng() * 3;
                addObs(crateMat, 1.0 + rng() * 0.5, 1.0 + rng() * 0.5, 1.0 + rng() * 0.5, cx2, 0.6, cz2);
            }
            if (rng() < 0.5) {
                const barX = bx + (rng() - 0.5) * (w + 2);
                const barZ = bz - d / 2 - 1.5 - rng() * 2;
                addObs(barrelMat, 0.7, 1.1, 0.7, barX, 0.55, barZ);
                if (rng() < 0.5) addObs(barrelMat, 0.7, 1.1, 0.7, barX + 1.0, 0.55, barZ);
            }
            if (rng() < 0.4) {
                addObs(trashMat, 0.4, 0.6, 0.4, bx - w / 2 - 1, 0.3, bz + rng() * d - d / 2);
            }

            // Graffiti decal
            const grafMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5 + rng() * 2, 0.8 + rng() * 1.2), grafMats[Math.floor(rng() * grafMats.length)]);
            grafMesh.position.set(bx + (rng() - 0.5) * (w - 2), 1.5 + rng() * 2, bz + d / 2 + 0.03);
            addVis(grafMesh);
        }
    }
    return { meshes, chunkObs };
}

export function updateCityChunks(px, pz) {
    if (!_cityBlockCenters.length || !_cityObs) return;
    for (let i = 0; i < _cityBlockCenters.length; i += 2) {
        const bcx = _cityBlockCenters[i], bcz = _cityBlockCenters[i + 1];
        const dist = Math.hypot(px - bcx, pz - bcz);
        const key = `${bcx},${bcz}`;
        if (dist < CHUNK_LOAD_DIST && !_cityChunks.has(key)) {
            const { meshes, chunkObs } = _buildCityChunkMeshes(bcx, bcz);
            _cityChunks.set(key, { meshes, chunkObs });
            for (const o of chunkObs) _cityObs.push(o);
        } else if (dist > CHUNK_UNLOAD_DIST && _cityChunks.has(key)) {
            const chunk = _cityChunks.get(key);
            for (const m of chunk.meshes) { scene.remove(m); if (m.geometry) m.geometry.dispose(); }
            for (const o of chunk.chunkObs) {
                const idx = _cityObs.indexOf(o);
                if (idx >= 0) _cityObs.splice(idx, 1);
            }
            _cityChunks.delete(key);
        }
    }
}

// ─── Forest chunk builder ────────────────────────────────────────────────────
function _buildForestChunkMeshes(cx, cz) {
    const seed = Math.abs(Math.imul(Math.round(cx) | 0, 73856093) ^ Math.imul(Math.round(cz) | 0, 19349663));
    const rng = mulberry32((seed % 0x7fffffff) + 1);
    const meshes = [], chunkObs = [];
    const { treeMat, leafMats, mossMats } = _forestMats;

    const treePositions = [];
    const minDist = 2.5;
    let attempts = 0;
    while (treePositions.length < 28 && attempts < 2000) {
        attempts++;
        const tx = cx + (rng() - 0.5) * FOREST_CHUNK_SIZE;
        const tz = cz + (rng() - 0.5) * FOREST_CHUNK_SIZE;
        if (Math.abs(tx) < 9 && Math.abs(tz) < 9) continue;
        let tooClose = false;
        for (const p of treePositions) {
            const pdx = tx - p[0], pdz = tz - p[1];
            if (pdx * pdx + pdz * pdz < minDist * minDist) { tooClose = true; break; }
        }
        if (!tooClose) treePositions.push([tx, tz]);
    }

    for (const [x, z] of treePositions) {
        const scale = 0.4 + rng() * 1.8;
        const thisLeafMat = leafMats[Math.floor(rng() * leafMats.length)];

        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * scale, 0.55 * scale, 8 * scale, 6), treeMat);
        trunk.position.set(x, 4 * scale, z);
        scene.add(trunk); meshes.push(trunk);
        chunkObs.push({ mesh: trunk, radius: 0.55 * scale, box: new THREE.Box3().setFromObject(trunk), isTrunk: true });

        const canopy = new THREE.Mesh(new THREE.SphereGeometry(3.2 * scale, 7, 5), thisLeafMat);
        canopy.position.set(x, 8.5 * scale, z); canopy.scale.y = 0.85;
        scene.add(canopy); meshes.push(canopy);
        chunkObs.push({ mesh: canopy, box: new THREE.Box3().setFromObject(canopy), passThrough: true });

        if (scale > 1.2) {
            const canopy2 = new THREE.Mesh(new THREE.SphereGeometry(2.2 * scale, 6, 4), thisLeafMat);
            canopy2.position.set(x + (rng() - 0.5) * scale, 10.5 * scale, z + (rng() - 0.5) * scale);
            scene.add(canopy2); meshes.push(canopy2);
        }

        if (scale > 1.0) {
            for (let j = 0; j < 3; j++) {
                const rootAngle = j * (Math.PI * 2 / 3) + rng() * 0.5;
                const root = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.35 * scale, 2.2 * scale, 4), treeMat);
                root.rotation.x = Math.PI / 2 + 0.4 + rng() * 0.3;
                root.rotation.y = rootAngle;
                root.position.set(x + Math.cos(rootAngle) * scale * 0.75, 0.1, z + Math.sin(rootAngle) * scale * 0.75);
                root.updateMatrixWorld(true);
                scene.add(root); meshes.push(root);
            }
        }

        if (rng() < 0.3) {
            const mossMat = mossMats[Math.floor(rng() * mossMats.length)];
            const moss = new THREE.Mesh(new THREE.CylinderGeometry(1.2 * scale, 1.4 * scale, 0.08, 8), mossMat);
            moss.position.set(x, 0.04, z);
            scene.add(moss); meshes.push(moss);
        }
    }

    const logCount = 1 + Math.floor(rng() * 3);
    for (let l = 0; l < logCount; l++) {
        const lx = cx + (rng() - 0.5) * FOREST_CHUNK_SIZE;
        const lz = cz + (rng() - 0.5) * FOREST_CHUNK_SIZE;
        if (Math.abs(lx) < 8 && Math.abs(lz) < 8) continue;
        const logScale = 0.5 + rng() * 1.2;
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * logScale, 0.28 * logScale, 4 * logScale, 6), treeMat);
        log.rotation.z = Math.PI / 2;
        log.rotation.y = rng() * Math.PI;
        log.position.set(lx, 0.22 * logScale, lz);
        scene.add(log); meshes.push(log);
        chunkObs.push({ mesh: log, box: new THREE.Box3().setFromObject(log) });
    }

    return { meshes, chunkObs };
}

export function updateForestChunks(px, pz) {
    if (!_forestChunkCenters.length || !_forestObs) return;
    for (let i = 0; i < _forestChunkCenters.length; i += 2) {
        const cx = _forestChunkCenters[i], cz = _forestChunkCenters[i + 1];
        const dist = Math.hypot(px - cx, pz - cz);
        const key = `${cx},${cz}`;
        if (dist < TERRAIN_LOAD_DIST && !_forestChunks.has(key)) {
            const { meshes, chunkObs } = _buildForestChunkMeshes(cx, cz);
            _forestChunks.set(key, { meshes, chunkObs });
            for (const o of chunkObs) _forestObs.push(o);
        } else if (dist > TERRAIN_UNLOAD_DIST && _forestChunks.has(key)) {
            const chunk = _forestChunks.get(key);
            for (const m of chunk.meshes) { scene.remove(m); if (m.geometry) m.geometry.dispose(); }
            for (const o of chunk.chunkObs) {
                const idx = _forestObs.indexOf(o);
                if (idx >= 0) _forestObs.splice(idx, 1);
            }
            _forestChunks.delete(key);
        }
    }
}

// ─── Mountain chunk builder ───────────────────────────────────────────────────
function _buildMountainChunkMeshes(cx, cz) {
    const seed = Math.abs(Math.imul(Math.round(cx) | 0, 73856093) ^ Math.imul(Math.round(cz) | 0, 19349663));
    const rng = mulberry32((seed % 0x7fffffff) + 1);
    const meshes = [], chunkObs = [], chunkSlopes = [];
    const { rockMat, rockMat2 } = _mountainMats;

    // One terrain tile per chunk (skip flat spawn zone)
    if (Math.abs(cx) >= 22 || Math.abs(cz) >= 22) {
        const ty = rng() * 3.5;
        const rotX = (rng() - 0.5) * 0.65;
        const rotZ = (rng() - 0.5) * 0.65;
        const mat = rng() < 0.5 ? rockMat : rockMat2;
        const tile = new THREE.Mesh(new THREE.BoxGeometry(48, 5, 48), mat);
        tile.rotation.x = rotX; tile.rotation.z = rotZ;
        tile.position.set(cx, ty, cz);
        tile.receiveShadow = true;
        scene.add(tile); tile.updateMatrixWorld(true);
        meshes.push(tile); chunkSlopes.push(tile);
    }

    // Rock formations within this chunk area
    const rockCount = 2 + Math.floor(rng() * 4);
    for (let i = 0; i < rockCount; i++) {
        const bx = cx + (rng() - 0.5) * MOUNTAIN_TILE_STEP * 0.9;
        const bz = cz + (rng() - 0.5) * MOUNTAIN_TILE_STEP * 0.9;
        if (Math.abs(bx) < 20 && Math.abs(bz) < 20) continue;
        const w = 10 + rng() * 20, h = 10 + rng() * 25, d = 10 + rng() * 20;

        const hasGap = rng() < 0.40;
        if (hasGap && w > 8 && d > 8) {
            const gapSize = 3.0 + rng() * 1.5;
            if (rng() < 0.5) {
                const halfD = (d - gapSize) / 2;
                if (halfD > 1) {
                    const m1 = new THREE.Mesh(new THREE.BoxGeometry(w, h, halfD), rockMat);
                    m1.position.set(bx, h / 2, bz - gapSize / 2 - halfD / 2);
                    scene.add(m1); meshes.push(m1);
                    chunkObs.push({ mesh: m1, box: new THREE.Box3().setFromObject(m1) });
                    const m2 = new THREE.Mesh(new THREE.BoxGeometry(w, h, halfD), rockMat);
                    m2.position.set(bx, h / 2, bz + gapSize / 2 + halfD / 2);
                    scene.add(m2); meshes.push(m2);
                    chunkObs.push({ mesh: m2, box: new THREE.Box3().setFromObject(m2) });
                } else {
                    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rockMat);
                    m.position.set(bx, h / 2, bz); scene.add(m); meshes.push(m);
                    chunkObs.push({ mesh: m, box: new THREE.Box3().setFromObject(m) });
                }
            } else {
                const halfW = (w - gapSize) / 2;
                if (halfW > 1) {
                    const m1 = new THREE.Mesh(new THREE.BoxGeometry(halfW, h, d), rockMat);
                    m1.position.set(bx - gapSize / 2 - halfW / 2, h / 2, bz);
                    scene.add(m1); meshes.push(m1);
                    chunkObs.push({ mesh: m1, box: new THREE.Box3().setFromObject(m1) });
                    const m2 = new THREE.Mesh(new THREE.BoxGeometry(halfW, h, d), rockMat);
                    m2.position.set(bx + gapSize / 2 + halfW / 2, h / 2, bz);
                    scene.add(m2); meshes.push(m2);
                    chunkObs.push({ mesh: m2, box: new THREE.Box3().setFromObject(m2) });
                } else {
                    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rockMat);
                    m.position.set(bx, h / 2, bz); scene.add(m); meshes.push(m);
                    chunkObs.push({ mesh: m, box: new THREE.Box3().setFromObject(m) });
                }
            }
        } else {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rockMat);
            m.position.set(bx, h / 2, bz); scene.add(m); meshes.push(m);
            chunkObs.push({ mesh: m, box: new THREE.Box3().setFromObject(m) });
        }
        const slope = new THREE.Mesh(new THREE.BoxGeometry(w * 1.5, h * 0.5, d * 1.5), rockMat);
        slope.rotation.x = (rng() - 0.5); slope.rotation.z = (rng() - 0.5);
        slope.position.set(bx, h / 4, bz);
        scene.add(slope); slope.updateMatrixWorld(true);
        meshes.push(slope);
        chunkObs.push({ mesh: slope, isSlope: true, box: new THREE.Box3().setFromObject(slope) });
        chunkSlopes.push(slope);
    }

    return { meshes, chunkObs, chunkSlopes };
}

export function updateMountainChunks(px, pz) {
    if (!_mountainChunkCenters.length || !_mountainObs) return;
    for (let i = 0; i < _mountainChunkCenters.length; i += 2) {
        const cx = _mountainChunkCenters[i], cz = _mountainChunkCenters[i + 1];
        const dist = Math.hypot(px - cx, pz - cz);
        const key = `${cx},${cz}`;
        if (dist < TERRAIN_LOAD_DIST && !_mountainChunks.has(key)) {
            const { meshes, chunkObs, chunkSlopes } = _buildMountainChunkMeshes(cx, cz);
            _mountainChunks.set(key, { meshes, chunkObs, chunkSlopes });
            for (const o of chunkObs) _mountainObs.push(o);
            for (const s of chunkSlopes) gameState.slopeMeshes.push(s);
        } else if (dist > TERRAIN_UNLOAD_DIST && _mountainChunks.has(key)) {
            const chunk = _mountainChunks.get(key);
            for (const m of chunk.meshes) { scene.remove(m); if (m.geometry) m.geometry.dispose(); }
            for (const o of chunk.chunkObs) {
                const idx = _mountainObs.indexOf(o);
                if (idx >= 0) _mountainObs.splice(idx, 1);
            }
            for (const s of chunk.chunkSlopes) {
                const idx = gameState.slopeMeshes.indexOf(s);
                if (idx >= 0) gameState.slopeMeshes.splice(idx, 1);
            }
            _mountainChunks.delete(key);
        }
    }
}

// ─── Desert chunk builder ─────────────────────────────────────────────────────
function _buildDesertChunkMeshes(cx, cz) {
    const seed = Math.abs(Math.imul(Math.round(cx) | 0, 73856093) ^ Math.imul(Math.round(cz) | 0, 19349663));
    const rng = mulberry32((seed % 0x7fffffff) + 1);
    const meshes = [], chunkObs = [];
    const { cactusMat, sandRockMat, debrisMat } = _desertMats;

    // Cacti
    const cactiCount = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < cactiCount; i++) {
        const bx = cx + (rng() - 0.5) * DESERT_CHUNK_SIZE;
        const bz = cz + (rng() - 0.5) * DESERT_CHUNK_SIZE;
        if (Math.abs(bx) < 5 && Math.abs(bz) < 5) continue;
        const s = 0.6 + rng() * 1.4;

        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * s, 0.38 * s, 2.8 * s, 7), cactusMat);
        body.position.set(bx, 1.4 * s, bz);
        body.castShadow = true; scene.add(body); meshes.push(body);
        body.updateMatrixWorld(true);
        chunkObs.push({ mesh: body, radius: 0.4 * s, isCactus: true, box: new THREE.Box3().setFromObject(body) });

        const lArmH = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.16 * s, 0.75 * s, 6), cactusMat);
        lArmH.rotation.z = Math.PI / 2; lArmH.position.set(bx - 0.55 * s, 1.4 * s, bz);
        scene.add(lArmH); meshes.push(lArmH);
        const lArmV = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.15 * s, 0.65 * s, 6), cactusMat);
        lArmV.position.set(bx - 0.92 * s, 1.8 * s, bz);
        scene.add(lArmV); meshes.push(lArmV);

        if (s > 1.0) {
            const rArmH = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.14 * s, 0.65 * s, 6), cactusMat);
            rArmH.rotation.z = -Math.PI / 2; rArmH.position.set(bx + 0.52 * s, 1.55 * s, bz);
            scene.add(rArmH); meshes.push(rArmH);
            const rArmV = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * s, 0.13 * s, 0.55 * s, 6), cactusMat);
            rArmV.position.set(bx + 0.84 * s, 1.85 * s, bz);
            scene.add(rArmV); meshes.push(rArmV);
        }
    }

    // Rocks
    const rockCount = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < rockCount; i++) {
        const rs = 1 + rng() * 3;
        const rx = cx + (rng() - 0.5) * DESERT_CHUNK_SIZE;
        const rz = cz + (rng() - 0.5) * DESERT_CHUNK_SIZE;
        if (Math.abs(rx) < 5 && Math.abs(rz) < 5) continue;
        const m = new THREE.Mesh(new THREE.BoxGeometry(rs, rs * 0.5, rs * 0.9), sandRockMat);
        m.position.set(rx, rs * 0.25, rz); scene.add(m); meshes.push(m);
        chunkObs.push({ mesh: m, box: new THREE.Box3().setFromObject(m) });
    }

    // Debris
    if (rng() < 0.5) {
        const dx = cx + (rng() - 0.5) * DESERT_CHUNK_SIZE;
        const dz = cz + (rng() - 0.5) * DESERT_CHUNK_SIZE;
        if (!(Math.abs(dx) < 8 && Math.abs(dz) < 8)) {
            const dh = 0.7 + rng() * 0.6;
            const dm = new THREE.Mesh(new THREE.BoxGeometry(0.8 + rng() * 1.2, dh, 0.8 + rng()), debrisMat);
            dm.position.set(dx, dh / 2, dz); scene.add(dm); meshes.push(dm);
            chunkObs.push({ mesh: dm, box: new THREE.Box3().setFromObject(dm), noStep: true });
        }
    }

    return { meshes, chunkObs };
}

export function updateDesertChunks(px, pz) {
    if (!_desertChunkCenters.length || !_desertObs) return;
    for (let i = 0; i < _desertChunkCenters.length; i += 2) {
        const cx = _desertChunkCenters[i], cz = _desertChunkCenters[i + 1];
        const dist = Math.hypot(px - cx, pz - cz);
        const key = `${cx},${cz}`;
        if (dist < TERRAIN_LOAD_DIST && !_desertChunks.has(key)) {
            const { meshes, chunkObs } = _buildDesertChunkMeshes(cx, cz);
            _desertChunks.set(key, { meshes, chunkObs });
            for (const o of chunkObs) _desertObs.push(o);
        } else if (dist > TERRAIN_UNLOAD_DIST && _desertChunks.has(key)) {
            const chunk = _desertChunks.get(key);
            for (const m of chunk.meshes) { scene.remove(m); if (m.geometry) m.geometry.dispose(); }
            for (const o of chunk.chunkObs) {
                const idx = _desertObs.indexOf(o);
                if (idx >= 0) _desertObs.splice(idx, 1);
            }
            _desertChunks.delete(key);
        }
    }
}

export function buildMap(mapId) {
    while (scene.children.length) scene.remove(scene.children[0]);
    const obs = [];
    setObstacles(obs);
    setWallBounds([]);
    gameState.slopeMeshes = [];
    gameState.craterPits = [];
    gameState.streetLamps = [];
    gameState.warehouseLights = [];

    // Clear streaming chunk state from previous map
    _forestChunks.clear(); _forestObs = null; _forestChunkCenters = []; _forestMats = null;
    _mountainChunks.clear(); _mountainObs = null; _mountainChunkCenters = []; _mountainMats = null;
    _desertChunks.clear(); _desertObs = null; _desertChunkCenters = []; _desertMats = null;

    const map = MAPS[mapId];
    const size = map.size;

    scene.fog = new THREE.Fog(0x000000, size * 0.3, size * 0.9);
    scene.background = new THREE.Color(0x111111);
    gameState.fogNearBase = scene.fog.near;
    gameState.fogFarBase = scene.fog.far;

    // Lighting
    const ambLight = new THREE.AmbientLight(0xffffff, map.ambientLight);
    scene.add(ambLight);
    gameState.ambientLightRef = ambLight;

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
    gameState.sunLight = dirLight;
    gameState.dayNightActive = true;
    gameState.dayTime = 0.5; // start at noon

    // Ground — city map defers ground creation until after craters are placed (ShapeGeometry with holes)
    if (mapId !== 'city') {
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(size * 2, size * 2),
            new THREE.MeshStandardMaterial({ color: map.color, roughness: 0.9 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);
    }

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
        // Roof
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8, metalness: 0.4, side: THREE.DoubleSide });
        const roof = new THREE.Mesh(new THREE.PlaneGeometry(size * 2, size * 2), roofMat);
        roof.rotation.x = Math.PI / 2;
        roof.position.set(0, wallH, 0);
        roof.receiveShadow = true;
        scene.add(roof);
        // Industrial ceiling light fixtures (flickering)
        gameState.warehouseLights = [];
        const ceilLightGeo = new THREE.BoxGeometry(0.8, 0.15, 2.5);
        const lightSpots = [
            [-size * 0.4, -size * 0.4], [-size * 0.4, 0], [-size * 0.4, size * 0.4],
            [0, -size * 0.4], [0, 0], [0, size * 0.4],
            [size * 0.4, -size * 0.4], [size * 0.4, 0], [size * 0.4, size * 0.4],
        ];
        for (const [lx, lz] of lightSpots) {
            const mat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffaa, emissiveIntensity: 1.5 });
            const fixture = new THREE.Mesh(ceilLightGeo, mat);
            fixture.position.set(lx, wallH - 0.1, lz);
            scene.add(fixture);
            const ptLight = new THREE.PointLight(0xffffdd, 1.2, size * 0.55);
            ptLight.position.set(lx, wallH - 0.5, lz);
            scene.add(ptLight);
            gameState.warehouseLights.push({ mat, light: ptLight, phase: Math.random() * Math.PI * 2 });
        }
    } else if (mapId === 'desert') {
        scene.fog = new THREE.Fog(0x000000, 90, 200);
        gameState.fogNearBase = scene.fog.near;
        gameState.fogFarBase = scene.fog.far;
        _desertChunks.clear();
        _desertObs = obs;
        _desertMats = {
            cactusMat: new THREE.MeshStandardMaterial({ color: 0x3a8c3a, roughness: 0.85 }),
            sandRockMat: new THREE.MeshStandardMaterial({ color: 0xb89050, roughness: 0.95 }),
            debrisMat: new THREE.MeshStandardMaterial({ color: 0x7a5a30, roughness: 0.9 }),
        };
        const halfD = Math.ceil(size * 1.1 / DESERT_CHUNK_SIZE) * DESERT_CHUNK_SIZE;
        _desertChunkCenters = [];
        for (let dx = -halfD; dx <= halfD; dx += DESERT_CHUNK_SIZE)
            for (let dz = -halfD; dz <= halfD; dz += DESERT_CHUNK_SIZE)
                _desertChunkCenters.push(dx, dz);
        updateDesertChunks(0, 0);
    } else if (mapId === 'city') {
        _noShadowMap = true;
        // Ruined city atmosphere — dense ash fog hides distant geometry (matched to camera.far)
        scene.fog = new THREE.Fog(0x060402, 100, 220);
        scene.background = new THREE.Color(0x030201);
        gameState.fogNearBase = scene.fog.near;
        gameState.fogFarBase = scene.fog.far;

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
        const numGridRoads = Math.floor(mapR / blockPitch); // number of roads on each side of center

        // --- Road & sidewalk materials ---
        const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.95 });
        const curbMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.85 });
        const markingMat = new THREE.MeshBasicMaterial({ color: 0xddcc00 });

        // N-S roads (parallel to Z axis)
        const nsDashPos = [];
        for (let rxi = -numGridRoads; rxi <= numGridRoads; rxi++) {
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

        // E-W roads (parallel to X axis)
        const ewDashPos = [];
        for (let rzi = -numGridRoads; rzi <= numGridRoads; rzi++) {
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
            for (let ri = -numGridRoads; ri <= numGridRoads; ri++) {
                const rc = ri * blockPitch;
                if (Math.abs(px - rc) < halfCorridor) return true;
                if (Math.abs(pz - rc) < halfCorridor) return true;
            }
            return false;
        };

        // === BUILDING GRID (streamed by chunk) ===
        // Shared materials created once — reused across all chunks to minimise GPU state changes
        const bMats = buildingColors.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
        const furnitureMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 });
        const furnitureMat2 = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.9 });
        const acMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.4 });
        const barrelMat = new THREE.MeshStandardMaterial({ color: 0x334455, metalness: 0.4 });
        const trashMat = new THREE.MeshStandardMaterial({ color: 0x555533, roughness: 1.0 });
        const grafMats = graffitiColors.map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.7 }));

        // Register all block centers as a flat [x,z, x,z, ...] array for streaming
        _cityChunks.clear();
        _cityObs = obs;
        _cityMats = { bMats, winMat, roofMat, metalMat, crateMat, furnitureMat, furnitureMat2, acMat, barrelMat, trashMat, grafMats };
        const allBlockCenters = [];
        allBlockCenters.push((-numGridRoads - 0.5) * blockPitch); // outer left/top
        for (let i = -numGridRoads; i < numGridRoads; i++) allBlockCenters.push((i + 0.5) * blockPitch);
        allBlockCenters.push((numGridRoads + 0.5) * blockPitch);  // outer right/bottom
        _cityBlockCenters = [];
        for (const bcx of allBlockCenters) for (const bcz of allBlockCenters) _cityBlockCenters.push(bcx, bcz);

        // Load only chunks near the player start; the rest stream in as the player moves
        updateCityChunks(0, 0);

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
        const SMALL_COUNT = Math.min(2000, Math.round(400 * (size / 160) ** 2));
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
        for (let i = 0; i < Math.round(35 * (size / 160)); i++) {
            const rx = (rng() - 0.5) * size * 1.5;
            const rz = (rng() - 0.5) * size * 1.5;
            if (Math.abs(rx) < 8 && Math.abs(rz) < 8) continue;
            if (onRoad(rx, rz)) continue;
            const rw = 1.1 + rng() * 0.9, rh = 0.7 + rng() * 0.5, rd = 0.9 + rng() * 0.7; // min height 0.7 for solid collision
            const chunk = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, rd), rng() < 0.5 ? rubbleMat : concChunkMat);
            chunk.position.set(rx, rh / 2, rz);
            chunk.rotation.y = rng() * Math.PI * 2;
            chunk.castShadow = true;
            scene.add(chunk);
            obs.push({ mesh: chunk, box: new THREE.Box3().setFromObject(chunk), noStep: true });
        }

        // Impact craters — actual traversable pits the player can fall into
        const craterFloorMat = new THREE.MeshStandardMaterial({ color: 0x4a2e12, roughness: 1.0 }); // dark damp dirt
        const craterWallMat = new THREE.MeshStandardMaterial({ color: 0x6b3d1a, roughness: 1.0, side: THREE.DoubleSide }); // earth brown walls
        const craterDirtFloorMat = new THREE.MeshStandardMaterial({ color: 0x7a5030, roughness: 1.0 }); // lighter dirt for floor disc
        const craterRimMat = new THREE.MeshStandardMaterial({ color: 0x7a5a35, roughness: 1.0 }); // dirt-coloured rim chunks
        const craterWarnMat = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0x441100, roughness: 0.8 });
        const craterRockMat = new THREE.MeshStandardMaterial({ color: 0x4a4035, roughness: 0.95 }); // embedded rocks

        for (let i = 0; i < Math.round(12 * (size / 160)); i++) {
            const cx = (rng() - 0.5) * size * 1.3;
            const cz = (rng() - 0.5) * size * 1.3;
            if (Math.abs(cx) < 10 && Math.abs(cz) < 10) continue;
            // Skip craters on/near roads and sidewalks — those flat planes don't have holes
            if (onRoad(cx, cz)) continue;

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

            // Orange warning ring around the pit edge — clearly visible
            const ringGeo = new THREE.RingGeometry(craterR * 0.88, craterR * 1.3, 24);
            const ring = new THREE.Mesh(ringGeo, craterWarnMat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(cx, 0.025, cz);
            scene.add(ring);

            // Outer scorch ring (charred dirt, slightly darker)
            const outerRingGeo = new THREE.RingGeometry(craterR * 1.3, craterR * 1.9, 24);
            const outerRing = new THREE.Mesh(outerRingGeo, craterRimMat);
            outerRing.rotation.x = -Math.PI / 2;
            outerRing.position.set(cx, 0.015, cz);
            scene.add(outerRing);

            // Dirt floor disc at the bottom of the pit
            const floorDisc = new THREE.Mesh(
                new THREE.CylinderGeometry(craterR * 0.82, craterR * 1.0, 0.08, 16),
                craterDirtFloorMat
            );
            floorDisc.position.set(cx, -depth + 0.04, cz);
            scene.add(floorDisc);

            // Mid-depth soil layer ring (shows layered earth cross-section)
            const soilRingGeo = new THREE.RingGeometry(craterR * 0.6, craterR * 0.82, 20);
            const soilRing = new THREE.Mesh(soilRingGeo, craterRimMat);
            soilRing.rotation.x = -Math.PI / 2;
            soilRing.position.set(cx, -depth + 0.05, cz);
            scene.add(soilRing);

            // Small rocks/stones scattered on the crater floor
            const numFloorRocks = 3 + Math.floor(rng() * 4);
            for (let r = 0; r < numFloorRocks; r++) {
                const angle = rng() * Math.PI * 2;
                const dist = rng() * craterR * 0.65;
                const rw = 0.15 + rng() * 0.35, rh = 0.08 + rng() * 0.18, rd = 0.15 + rng() * 0.3;
                const rock = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, rd), craterRockMat);
                rock.position.set(cx + Math.cos(angle) * dist, -depth + rh / 2 + 0.08, cz + Math.sin(angle) * dist);
                rock.rotation.y = rng() * Math.PI;
                scene.add(rock);
            }

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

        // City ground with holes punched out for each crater pit so you can see into them
        {
            const groundShape = new THREE.Shape();
            const s = size;
            groundShape.moveTo(-s, -s);
            groundShape.lineTo(s, -s);
            groundShape.lineTo(s, s);
            groundShape.lineTo(-s, s);
            groundShape.closePath();
            for (const pit of gameState.craterPits) {
                const hole = new THREE.Path();
                // rotateX(-PI/2) maps shape-Y → world -Z, so negate cz to place hole at world (cx,0,cz)
                hole.absarc(pit.cx, -pit.cz, pit.r * 0.9, 0, Math.PI * 2, true); // CW winding for hole in CCW outer shape
                groundShape.holes.push(hole);
            }
            const cityGroundGeo = new THREE.ShapeGeometry(groundShape, 12);
            cityGroundGeo.rotateX(-Math.PI / 2); // XY → XZ plane (Y becomes depth axis)
            const cityGround = new THREE.Mesh(cityGroundGeo,
                new THREE.MeshStandardMaterial({ color: map.color, roughness: 0.9, side: THREE.DoubleSide }));
            cityGround.receiveShadow = true;
            scene.add(cityGround);
        }
    } else if (mapId === 'mountain') {
        scene.fog = new THREE.Fog(0x000000, 90, 200);
        gameState.fogNearBase = scene.fog.near;
        gameState.fogFarBase = scene.fog.far;
        _mountainChunks.clear();
        _mountainObs = obs;
        _mountainMats = {
            rockMat: new THREE.MeshStandardMaterial({ color: 0x505050, roughness: 0.95 }),
            rockMat2: new THREE.MeshStandardMaterial({ color: 0x3d3d3d, roughness: 0.98 }),
        };
        const halfM = Math.ceil(size * 1.1 / MOUNTAIN_TILE_STEP) * MOUNTAIN_TILE_STEP;
        _mountainChunkCenters = [];
        for (let mx = -halfM; mx <= halfM; mx += MOUNTAIN_TILE_STEP)
            for (let mz = -halfM; mz <= halfM; mz += MOUNTAIN_TILE_STEP)
                _mountainChunkCenters.push(mx, mz);
        updateMountainChunks(0, 0);
    } else if (mapId === 'forest') {
        scene.fog = new THREE.Fog(0x060402, 80, 190);
        scene.background = new THREE.Color(0x030201);
        gameState.fogNearBase = scene.fog.near;
        gameState.fogFarBase = scene.fog.far;
        _forestChunks.clear();
        _forestObs = obs;
        _forestMats = {
            treeMat: new THREE.MeshStandardMaterial({ color: 0x3d2b1f }),
            leafMats: [0x113a11, 0x0d3010, 0x1a4a1a, 0x0a2a0a].map(c => new THREE.MeshStandardMaterial({ color: c })),
            mossMats: [0x2a4a1a, 0x3a5a2a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1.0 })),
        };
        const halfF = Math.ceil(size * 1.1 / FOREST_CHUNK_SIZE) * FOREST_CHUNK_SIZE;
        _forestChunkCenters = [];
        for (let fx = -halfF; fx <= halfF; fx += FOREST_CHUNK_SIZE)
            for (let fz = -halfF; fz <= halfF; fz += FOREST_CHUNK_SIZE)
                _forestChunkCenters.push(fx, fz);
        updateForestChunks(0, 0);
    }

    setObstacles(obs);
    _noShadowMap = false;
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
