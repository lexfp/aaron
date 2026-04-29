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

/**
 * generateCaveLayout(rng) — pure data function, no Three.js objects.
 * Returns { caverns: [...], tunnels: [...] }
 *
 * Cavern: { id, cx, cz, radius, isSpawnCavern }
 * Tunnel: { fromId, toId, width, height }
 */
export function generateCaveLayout(rng) {
    const TARGET_COUNT = 5;
    const MIN_RADIUS = 12;
    const MAX_RADIUS = 22;
    const MAP_RANGE = 80; // cavern centers within ±80 of origin
    const MAX_ATTEMPTS = 200;

    // --- Fallback grid positions (used if random placement fails) ---
    const FALLBACK_POSITIONS = [
        [0, 0],
        [55, 55],
        [-55, 55],
        [55, -55],
        [-55, -55],
    ];

    // --- Place caverns with minimum separation ---
    const caverns = [];
    for (let i = 0; i < TARGET_COUNT; i++) {
        const radius = MIN_RADIUS + rng() * (MAX_RADIUS - MIN_RADIUS);
        let placed = false;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            const cx = (rng() * 2 - 1) * MAP_RANGE;
            const cz = (rng() * 2 - 1) * MAP_RANGE;
            let tooClose = false;
            for (const c of caverns) {
                const minSep = c.radius + radius + 8;
                if (Math.hypot(cx - c.cx, cz - c.cz) < minSep) {
                    tooClose = true;
                    break;
                }
            }
            if (!tooClose) {
                caverns.push({ id: i, cx, cz, radius, isSpawnCavern: false });
                placed = true;
                break;
            }
        }
        if (!placed) {
            // Fall back to fixed grid position for this cavern
            const [fcx, fcz] = FALLBACK_POSITIONS[i] || [i * 40 - 80, 0];
            caverns.push({ id: i, cx: fcx, cz: fcz, radius, isSpawnCavern: false });
        }
    }

    // --- Designate spawn cavern: largest radius ---
    let spawnIdx = 0;
    for (let i = 1; i < caverns.length; i++) {
        if (caverns[i].radius > caverns[spawnIdx].radius) spawnIdx = i;
    }
    caverns[spawnIdx].isSpawnCavern = true;

    // --- Build Minimum Spanning Tree (Prim's algorithm, Euclidean distance) ---
    const n = caverns.length;
    const inMST = new Array(n).fill(false);
    const minEdge = new Array(n).fill(Infinity);
    const parent = new Array(n).fill(-1);
    minEdge[0] = 0;

    for (let iter = 0; iter < n; iter++) {
        // Pick the vertex with minimum edge weight not yet in MST
        let u = -1;
        for (let v = 0; v < n; v++) {
            if (!inMST[v] && (u === -1 || minEdge[v] < minEdge[u])) u = v;
        }
        inMST[u] = true;
        // Update neighbors
        for (let v = 0; v < n; v++) {
            if (!inMST[v]) {
                const dist = Math.hypot(caverns[u].cx - caverns[v].cx, caverns[u].cz - caverns[v].cz);
                if (dist < minEdge[v]) {
                    minEdge[v] = dist;
                    parent[v] = u;
                }
            }
        }
    }

    // Collect MST edges as tunnels
    const tunnels = [];
    const tunnelSet = new Set();
    for (let v = 1; v < n; v++) {
        const u = parent[v];
        const key = `${Math.min(u, v)}-${Math.max(u, v)}`;
        if (!tunnelSet.has(key)) {
            tunnelSet.add(key);
            tunnels.push({
                fromId: u,
                toId: v,
                width: 4 + rng() * 4,   // 4–8 units
                height: 5 + rng() * 3,  // 5–8 units
            });
        }
    }

    // --- Add 1–2 extra tunnels (loops) ---
    const extraCount = 1 + Math.floor(rng() * 2); // 1 or 2
    let extraAdded = 0;
    // Collect all possible non-MST pairs
    const candidates = [];
    for (let a = 0; a < n; a++) {
        for (let b = a + 1; b < n; b++) {
            const key = `${a}-${b}`;
            if (!tunnelSet.has(key)) candidates.push([a, b]);
        }
    }
    // Shuffle candidates using rng
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    for (const [a, b] of candidates) {
        if (extraAdded >= extraCount) break;
        const key = `${a}-${b}`;
        if (!tunnelSet.has(key)) {
            tunnelSet.add(key);
            tunnels.push({
                fromId: a,
                toId: b,
                width: 4 + rng() * 4,
                height: 5 + rng() * 3,
            });
            extraAdded++;
        }
    }

    return { caverns, tunnels };
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
    const { treeMat, leafMats, mossMats, boulderMat, shroomMat, shroomCapMat } = _forestMats;

    const treePositions = [];
    const minDist = 2.5;
    let attempts = 0;
    while (treePositions.length < 84 && attempts < 2000) {
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

    // Boulders — large mossy stones for cover and navigation variety
    const boulderCount = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < boulderCount; i++) {
        const bx = cx + (rng() - 0.5) * FOREST_CHUNK_SIZE;
        const bz = cz + (rng() - 0.5) * FOREST_CHUNK_SIZE;
        if (Math.abs(bx) < 8 && Math.abs(bz) < 8) continue;
        const bs = 1.2 + rng() * 2.2;
        const boulder = new THREE.Mesh(new THREE.BoxGeometry(bs * 1.3, bs * 0.85, bs * 1.1), boulderMat);
        boulder.rotation.y = rng() * Math.PI;
        boulder.rotation.x = (rng() - 0.5) * 0.25;
        boulder.position.set(bx, bs * 0.38, bz);
        boulder.castShadow = true; scene.add(boulder); meshes.push(boulder);
        chunkObs.push({ mesh: boulder, box: new THREE.Box3().setFromObject(boulder) });
        // Occasional moss patch on top of boulder
        if (rng() < 0.5) {
            const mossMat2 = mossMats[Math.floor(rng() * mossMats.length)];
            const mossCap = new THREE.Mesh(new THREE.BoxGeometry(bs * 0.9, 0.12, bs * 0.85), mossMat2);
            mossCap.position.set(bx, bs * 0.85 + 0.06, bz);
            mossCap.rotation.y = rng() * Math.PI;
            scene.add(mossCap); meshes.push(mossCap);
        }
    }

    // Mushroom clusters — atmospheric floor detail, no collision
    if (rng() < 0.55) {
        const mx = cx + (rng() - 0.5) * FOREST_CHUNK_SIZE;
        const mz = cz + (rng() - 0.5) * FOREST_CHUNK_SIZE;
        if (!(Math.abs(mx) < 8 && Math.abs(mz) < 8)) {
            const count = 3 + Math.floor(rng() * 5);
            for (let j = 0; j < count; j++) {
                const msx = mx + (rng() - 0.5) * 2.5, msz = mz + (rng() - 0.5) * 2.5;
                const mh = 0.25 + rng() * 0.45;
                const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, mh, 5), shroomMat);
                stem.position.set(msx, mh / 2, msz);
                scene.add(stem); meshes.push(stem);
                const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1 + rng() * 0.09, 6, 4), shroomCapMat);
                cap.scale.y = 0.45;
                cap.position.set(msx, mh + 0.05, msz);
                scene.add(cap); meshes.push(cap);
            }
        }
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
    const { rockMat, rockMat2, snowMat } = _mountainMats;

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

        // Snow cap on tall peaks (h > 22)
        if (h > 22) {
            const capH = 2.5 + rng() * 3.5;
            const snow = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, capH, d * 0.6), snowMat);
            snow.position.set(bx + (rng() - 0.5) * 2, h + capH / 2 - 1.5, bz + (rng() - 0.5) * 2);
            scene.add(snow); meshes.push(snow);
            // Small snow drift at base of peak
            if (rng() < 0.5) {
                const drift = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.8, d * 0.9), snowMat);
                drift.rotation.x = (rng() - 0.5) * 0.3; drift.rotation.z = (rng() - 0.5) * 0.2;
                drift.position.set(bx, h * 0.7, bz);
                scene.add(drift); meshes.push(drift);
            }
        }
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
    const { cactusMat, sandRockMat, debrisMat, duneMat, ruinMat } = _desertMats;

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

    // Sand dunes — sweeping low mounds for cover and atmosphere
    const duneCount = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < duneCount; i++) {
        const dunex = cx + (rng() - 0.5) * DESERT_CHUNK_SIZE;
        const dunez = cz + (rng() - 0.5) * DESERT_CHUNK_SIZE;
        if (Math.abs(dunex) < 8 && Math.abs(dunez) < 8) continue;
        const dw = 10 + rng() * 16, dd = 8 + rng() * 12, dh = 0.5 + rng() * 1.6;
        const dune = new THREE.Mesh(new THREE.BoxGeometry(dw, dh, dd), duneMat);
        dune.rotation.y = rng() * Math.PI;
        dune.rotation.x = (rng() - 0.5) * 0.18;
        dune.position.set(dunex, dh * 0.22, dunez);
        dune.castShadow = true;
        scene.add(dune); meshes.push(dune);
        chunkObs.push({ mesh: dune, box: new THREE.Box3().setFromObject(dune), isSlope: true });
    }

    // Ruined outpost wall fragments — 30% chance per chunk
    if (rng() < 0.30) {
        const rwx = cx + (rng() - 0.5) * DESERT_CHUNK_SIZE * 0.7;
        const rwz = cz + (rng() - 0.5) * DESERT_CHUNK_SIZE * 0.7;
        if (!(Math.abs(rwx) < 10 && Math.abs(rwz) < 10)) {
            const wh = 1.2 + rng() * 2.0, wlen = 4 + rng() * 6;
            const wall1 = new THREE.Mesh(new THREE.BoxGeometry(wlen, wh, 0.65), ruinMat);
            wall1.position.set(rwx, wh / 2, rwz);
            wall1.rotation.y = rng() * Math.PI;
            wall1.castShadow = true; scene.add(wall1); meshes.push(wall1);
            chunkObs.push({ mesh: wall1, box: new THREE.Box3().setFromObject(wall1) });
            // 50% chance: second wall segment at right angle forming an L-corner
            if (rng() < 0.5) {
                const wh2 = 0.9 + rng() * 1.4, wlen2 = 3 + rng() * 4;
                const wall2 = new THREE.Mesh(new THREE.BoxGeometry(0.65, wh2, wlen2), ruinMat);
                const angle = wall1.rotation.y;
                wall2.position.set(rwx + Math.cos(angle) * wlen / 2, wh2 / 2, rwz + Math.sin(angle) * wlen / 2);
                wall2.castShadow = true; scene.add(wall2); meshes.push(wall2);
                chunkObs.push({ mesh: wall2, box: new THREE.Box3().setFromObject(wall2) });
            }
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

function buildHallwayMap(obs) {
    // A single corridor: 8 units wide, 10 units tall, 380 units long along Z axis.
    // Player spawns at z=+180 (south end). Zombies spawn at z=-180 (north end).
    // The map size is 200, so boundary walls sit at ±200.

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.95 });
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1.0 });
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffaa, emissiveIntensity: 3.0 });
    const torchMat = new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 1.0 });
    const flameMat = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 2.5 });

    const LENGTH = 380; // total hallway length along Z
    const WIDTH = 8;   // interior width (X)
    const HEIGHT = 10;  // interior height — tall enough to see giga zombie heads (~8 units)
    const THICK = 1.0; // wall/floor thickness
    const CEIL_THICK = 10; // thick ceiling — prevents phasing through top

    // Floor
    addObstacle(obs, floorMat, WIDTH + THICK * 2, THICK, LENGTH, 0, -THICK / 2, 0);
    // Ceiling — thick slab, bottom at y=HEIGHT; noStep so floor-snap never teleports player on top
    addObstacle(obs, ceilMat, WIDTH + THICK * 2, CEIL_THICK, LENGTH, 0, HEIGHT + CEIL_THICK / 2, 0, { noStep: true });
    // Left wall (x = -WIDTH/2 - THICK/2)
    addObstacle(obs, wallMat, THICK, HEIGHT + THICK * 2, LENGTH, -(WIDTH / 2 + THICK / 2), HEIGHT / 2, 0);
    // Right wall (x = +WIDTH/2 + THICK/2)
    addObstacle(obs, wallMat, THICK, HEIGHT + THICK * 2, LENGTH, (WIDTH / 2 + THICK / 2), HEIGHT / 2, 0);
    // South end wall (player spawn side, z = +LENGTH/2)
    addObstacle(obs, wallMat, WIDTH + THICK * 2, HEIGHT + THICK * 2, THICK, 0, HEIGHT / 2, LENGTH / 2 + THICK / 2);
    // North end wall (zombie spawn side, z = -LENGTH/2)
    addObstacle(obs, wallMat, WIDTH + THICK * 2, HEIGHT + THICK * 2, THICK, 0, HEIGHT / 2, -LENGTH / 2 - THICK / 2);

    // Ceiling light strips every 20 units — bright white lights
    for (let lz = -LENGTH / 2 + 10; lz < LENGTH / 2; lz += 20) {
        const fixture = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 3), lightMat);
        fixture.position.set(0, HEIGHT - 0.08, lz);
        scene.add(fixture);
        const ptLight = new THREE.PointLight(0xffffff, 12.0, 30);
        ptLight.position.set(0, HEIGHT - 0.3, lz);
        scene.add(ptLight);
    }

    // Wall torches near the zombie end (atmosphere)
    for (let tz = -LENGTH / 2 + 5; tz < -LENGTH / 2 + 60; tz += 15) {
        for (const tx of [-(WIDTH / 2 - 0.3), (WIDTH / 2 - 0.3)]) {
            const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 6), torchMat);
            handle.position.set(tx, HEIGHT * 0.65, tz);
            scene.add(handle);
            const flame = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), flameMat);
            flame.position.set(tx, HEIGHT * 0.65 + 0.25, tz);
            scene.add(flame);
            const tLight = new THREE.PointLight(0xff6600, 3.6, 10);
            tLight.position.set(tx, HEIGHT * 0.65 + 0.3, tz);
            scene.add(tLight);
        }
    }

    // A few low cover crates scattered along the hallway for gameplay variety
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 });
    const coverPositions = [
        [-2, -60], [2, -40], [-2.5, -10], [2.5, 30], [-2, 70], [2, 110]
    ];
    for (const [cx, cz] of coverPositions) {
        addObstacle(obs, crateMat, 1.2, 1.0, 1.2, cx, 0.5, cz);
    }

    // Store spawn ends on gameState so entities.js can read them
    gameState.hallwayPlayerSpawnZ = LENGTH / 2 - 3;  // +187
    gameState.hallwayZombieSpawnZ = -LENGTH / 2 + 3;  // -187
}

function buildFortressMap(obs) {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x887868, roughness: 0.9 });
    const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3c, roughness: 0.9 });
    const mossStoneMat = new THREE.MeshStandardMaterial({ color: 0x6b7a54, roughness: 0.95 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4c2a, roughness: 1.0 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x2e1a0a, roughness: 1.0 });
    const torchMat = new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 1.0 });
    const flameMat = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 2.5 });
    const slitMat = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 1.0 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1a, roughness: 1.0 });

    // All heights 50% of original. Outer walls: 6 (was 12). Inner keep: 10 (was 20).
    // Outer towers: 10 (was 20). Inner towers: 13 (was 26). Gatehouse: 9 (was 18).
    // Barracks: 5.5 (was 11). Watchtower: 18 (was 36).

    function addTorch(x, y, z) {
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 6), torchMat);
        handle.position.set(x, y, z);
        scene.add(handle);
        const flame = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), flameMat);
        flame.position.set(x, y + 0.28, z);
        scene.add(flame);
        const light = new THREE.PointLight(0xff8833, 1.8, 14);
        light.position.set(x, y + 0.3, z);
        scene.add(light);
    }

    // Cylindrical tower with AABB collision
    function addCylinder(mat, radius, height, x, y, z) {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 16), mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        scene.add(mesh);
        obs.push({ mesh, box: new THREE.Box3().setFromObject(mesh) });
    }

    // Decorative battlements along X-running wall face
    function addMerlonsX(mat, zPos, xFrom, xTo, topY, mw, mh, md) {
        const step = mw * 2;
        for (let x = xFrom + mw / 2; x <= xTo - mw / 2 + 0.01; x += step) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(mw, mh, md), mat);
            m.position.set(x, topY + mh / 2, zPos);
            scene.add(m);
        }
    }

    // Decorative battlements along Z-running wall face
    function addMerlonsZ(mat, xPos, zFrom, zTo, topY, mw, mh, md) {
        const step = md * 2;
        for (let z = zFrom + md / 2; z <= zTo - md / 2 + 0.01; z += step) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(mw, mh, md), mat);
            m.position.set(xPos, topY + mh / 2, z);
            scene.add(m);
        }
    }

    // Secret passage obstacle
    function addPassage(x, y, z, w, h, d, label = 'passage') {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stoneMat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        scene.add(mesh);
        const passage = { mesh, box: new THREE.Box3().setFromObject(mesh), passThrough: false, isSecretPassage: true, label };
        obs.push(passage);
        gameState.secretPassages.push(passage);
    }

    // Paved stone path material for wall walkway tops
    const pathMat = new THREE.MeshStandardMaterial({ color: 0x5c4e40, roughness: 0.8 });

    // Outer wall staircase: 12 steps × 0.5h × 0.8d = 6 rise (halved from 24 steps)
    function addStaircase(x0, z0, dir) {
        const steps = 12, stepH = 0.5, stepD = 0.8, stairW = 3.5;
        for (let i = 0; i < steps; i++) {
            const cH = (i + 1) * stepH;
            const offset = (i + 0.5) * stepD;
            const sx = (dir === 'E') ? x0 + offset : (dir === 'W') ? x0 - offset : x0;
            const sz = (dir === 'N') ? z0 - offset : (dir === 'S') ? z0 + offset : z0;
            const w = (dir === 'N' || dir === 'S') ? stairW : stepD;
            const d = (dir === 'E' || dir === 'W') ? stairW : stepD;
            addObstacle(obs, stoneMat, w, cH, d, sx, cH / 2, sz);
        }
    }

    // --- Outer perimeter walls (±85, 6 tall, 4 thick) ---
    // North (z=-85): underground tunnel at x=0 + existing passage at x=35 + right bulk
    addObstacle(obs, stoneMat, 81, 6, 4, -44.5, 3, -85);   // x=-85 to x=-4
    addObstacle(obs, stoneMat, 8, 3, 4, 0, 4.5, -85);       // arch above underground N tunnel (y=3–6)
    addPassage(0, 1.5, -85, 8, 3, 4, 'tunnel');             // underground tunnel N (x=-4 to x=4)
    addObstacle(obs, stoneMat, 29, 6, 4, 18.5, 3, -85);     // x=4 to x=33
    addPassage(35, 1.5, -85, 4, 3, 4);                       // existing passage at x=35
    addObstacle(obs, stoneMat, 4, 3, 4, 35, 4.5, -85);       // arch above existing passage
    addObstacle(obs, stoneMat, 48, 6, 4, 61, 3, -85);        // x=37 to x=85
    addTorch(-3, 2.5, -83); addTorch(3, 2.5, -83);           // N tunnel — inner wall face
    addTorch(-3, 2.5, -87); addTorch(3, 2.5, -87);           // N tunnel — outer wall face
    // South (z=+85): left bulk + split right bulk for underground tunnel at x=55
    addObstacle(obs, darkStoneMat, 73, 6, 4, -48.5, 3, 85);  // x=-85 to x=-12
    addObstacle(obs, darkStoneMat, 40, 6, 4, 32, 3, 85);      // x=12 to x=52
    addObstacle(obs, darkStoneMat, 6, 3, 4, 55, 4.5, 85);     // arch above underground S tunnel
    addPassage(55, 1.5, 85, 6, 3, 4, 'tunnel');               // underground tunnel S (x=52–58)
    addObstacle(obs, darkStoneMat, 27, 6, 4, 71.5, 3, 85);    // x=58 to x=85
    addTorch(52, 2.5, 83); addTorch(58, 2.5, 83);             // S tunnel — inner wall face
    addTorch(52, 2.5, 87); addTorch(58, 2.5, 87);             // S tunnel — outer wall face
    // East (x=+85): split upper section for underground tunnel at z=0 + existing passage at z=10
    addObstacle(obs, stoneMat, 4, 6, 82, 85, 3, -44);         // z=-85 to z=-3
    addObstacle(obs, stoneMat, 4, 3, 6, 85, 4.5, 0);          // arch above underground E tunnel
    addPassage(85, 1.5, 0, 4, 3, 6, 'tunnel');                // underground tunnel E (z=-3 to z=3)
    addObstacle(obs, stoneMat, 4, 6, 5, 85, 3, 5.5);          // z=3 to z=8
    addPassage(85, 1.5, 10, 4, 3, 4);                          // existing passage at z=10
    addObstacle(obs, stoneMat, 4, 3, 4, 85, 4.5, 10);          // arch above existing passage
    addObstacle(obs, stoneMat, 4, 6, 73, 85, 3, 48.5);         // z=12 to z=85
    addTorch(83, 2.5, -3); addTorch(83, 2.5, 3);              // E tunnel — inner wall face
    addTorch(87, 2.5, -3); addTorch(87, 2.5, 3);              // E tunnel — outer wall face
    // West (x=-85): top + existing passage at z=-35 + section + underground tunnel at z=0 + bottom
    addObstacle(obs, stoneMat, 4, 6, 48, -85, 3, -61);        // z=-85 to z=-37
    addPassage(-85, 1.5, -35, 4, 3, 4);                        // existing passage at z=-35
    addObstacle(obs, stoneMat, 4, 3, 4, -85, 4.5, -35);        // arch above existing passage
    addObstacle(obs, stoneMat, 4, 6, 30, -85, 3, -18);         // z=-33 to z=-3
    addObstacle(obs, stoneMat, 4, 3, 6, -85, 4.5, 0);          // arch above underground W tunnel
    addPassage(-85, 1.5, 0, 4, 3, 6, 'tunnel');                // underground tunnel W (z=-3 to z=3)
    addObstacle(obs, stoneMat, 4, 6, 82, -85, 3, 44);          // z=3 to z=85
    addTorch(-83, 2.5, -3); addTorch(-83, 2.5, 3);            // W tunnel — inner wall face
    addTorch(-87, 2.5, -3); addTorch(-87, 2.5, 3);            // W tunnel — outer wall face

    // Walkway on top of outer walls (y=6)
    addObstacle(obs, pathMat, 148, 0.15, 3.6, 0, 6.075, -85, { noCollide: true });
    addObstacle(obs, pathMat, 71, 0.15, 3.6, -46.5, 6.075, 85, { noCollide: true });
    addObstacle(obs, pathMat, 71, 0.15, 3.6, 46.5, 6.075, 85, { noCollide: true });
    addObstacle(obs, pathMat, 3.6, 0.15, 148, 85, 6.075, 0, { noCollide: true });
    addObstacle(obs, pathMat, 3.6, 0.15, 148, -85, 6.075, 0, { noCollide: true });

    // --- Secret Corridor A: alongside north outer wall interior (x=-75 to x=-15, z=-83 to z=-79.5) ---
    // Inner wall (1 thick, 6 tall) running parallel 3.5 units inside the north wall face
    addObstacle(obs, stoneMat, 11, 6, 1, -69.5, 3, -79.5); // x=-75–-64
    addPassage(-61, 3, -79.5, 6, 6, 1, 'corridor');         // door 1 (x=-64–-58)
    addObstacle(obs, stoneMat, 30, 6, 1, -43,   3, -79.5);  // x=-58–-28
    addPassage(-25, 3, -79.5, 6, 6, 1, 'corridor');         // door 2 (x=-28–-22)
    addObstacle(obs, stoneMat,  7, 6, 1, -18.5, 3, -79.5);  // x=-22–-15
    addObstacle(obs, stoneMat, 1, 6, 3.5, -75.5, 3, -81.25); // west end cap
    addObstacle(obs, stoneMat, 1, 6, 3.5, -14.5, 3, -81.25); // east end cap
    addObstacle(obs, stoneMat, 62, 1, 4, -45, 6.5, -81, { noCollide: true }); // roof slab
    addObstacle(obs, pathMat, 60, 0.1, 3.5, -45, 0.05, -81.25, { noCollide: true }); // floor slab
    addTorch(-68, 4, -81); addTorch(-43, 4, -81); addTorch(-20, 4, -81);

    // --- Secret Corridor B: alongside east outer wall interior (z=-75 to z=-20, x=79.5 to x=83) ---
    addObstacle(obs, stoneMat, 1, 6, 11, 79.5, 3, -69.5); // z=-75–-64
    addPassage(79.5, 3, -61, 1, 6, 6, 'corridor');         // door 1 (z=-64–-58)
    addObstacle(obs, stoneMat, 1, 6, 30, 79.5, 3, -43);    // z=-58–-28
    addPassage(79.5, 3, -25, 1, 6, 6, 'corridor');         // door 2 (z=-28–-22)
    addObstacle(obs, stoneMat, 1, 6,  2, 79.5, 3, -21);    // z=-22–-20
    addObstacle(obs, stoneMat, 3.5, 6, 1, 81.25, 3, -75.5); // north end cap
    addObstacle(obs, stoneMat, 3.5, 6, 1, 81.25, 3, -19.5); // south end cap
    addObstacle(obs, stoneMat, 4, 1, 57, 81, 6.5, -47.5, { noCollide: true }); // roof slab
    addObstacle(obs, pathMat, 3.5, 0.1, 55, 81.25, 0.05, -47.5, { noCollide: true }); // floor slab
    addTorch(81, 4, -68); addTorch(81, 4, -43); addTorch(81, 4, -22);

    // --- Underground Network: Central Room + 4 Tunnel Corridors ---
    // Rectangular zones tell getFloorHeight the floor is 8 units below ground in these areas
    gameState.undergroundZones.push({minX:-6,  maxX:6,   minZ:-6,  maxZ:6,   depth:8}); // central room
    gameState.undergroundZones.push({minX:-3,  maxX:3,   minZ:-83, maxZ:-6,  depth:8}); // north corridor
    gameState.undergroundZones.push({minX:6,   maxX:85,  minZ:-3,  maxZ:3,   depth:8}); // east corridor
    gameState.undergroundZones.push({minX:-85, maxX:-6,  minZ:-3,  maxZ:3,   depth:8}); // west corridor
    gameState.undergroundZones.push({minX:52,  maxX:58,  minZ:3,   maxZ:83,  depth:8}); // south corridor

    // — Central room (12×12, floor y=-8, enclosed by stone walls + columns) —
    // Walls h=8, center y=-4 (tops flush with surface at y=0)
    addObstacle(obs, stoneMat, 3, 8, 1, -4.5, -4, -6);    // north wall west of N-opening
    addObstacle(obs, stoneMat, 3, 8, 1,  4.5, -4, -6);    // north wall east of N-opening
    addObstacle(obs, stoneMat, 12, 8, 1, 0, -4,  6);      // south wall (closed — south corridor enters via east corridor)
    addObstacle(obs, stoneMat, 1, 8, 3, 6, -4, -4.5);    // east wall north of E-opening
    addObstacle(obs, stoneMat, 1, 8, 3, 6, -4,  4.5);    // east wall south of E-opening
    addObstacle(obs, stoneMat, 1, 8, 3, -6, -4, -4.5);   // west wall north of W-opening
    addObstacle(obs, stoneMat, 1, 8, 3, -6, -4,  4.5);   // west wall south of W-opening
    // Floor + Ceiling (noCollide, purely visual)
    addObstacle(obs, stoneMat, 12, 0.1, 12, 0, -8.05, 0, { noCollide: true }); // floor
    addObstacle(obs, stoneMat, 14, 0.4, 14, 0, -3, 0, { noCollide: true });    // ceiling
    // Columns (r=1, h=8, standing floor-to-ceiling)
    addCylinder(stoneMat, 1.0, 8, -4, -4, -4);
    addCylinder(stoneMat, 1.0, 8,  4, -4, -4);
    addCylinder(stoneMat, 1.0, 8, -4, -4,  4);
    addCylinder(stoneMat, 1.0, 8,  4, -4,  4);
    // Ambient point light + column torches
    { const rl = new THREE.PointLight(0xff8833, 2.5, 35); rl.position.set(0, -2, 0); scene.add(rl); }
    addTorch(-4, -2, -4); addTorch(4, -2, -4);
    addTorch(-4, -2,  4); addTorch(4, -2,  4);

    // — North corridor (x=-3 to x=3, z=-83 to z=-6) —
    addObstacle(obs, stoneMat, 1, 8, 77, -3, -4, -44.5);  // west wall
    addObstacle(obs, stoneMat, 1, 8, 77,  3, -4, -44.5);  // east wall
    addObstacle(obs, stoneMat, 6, 0.4, 77, 0, -3, -44.5, { noCollide: true }); // ceiling
    // Descending stairs: 16 steps × 0.5 drop × 1.2 depth, south from z=-83
    for (let i = 0; i < 16; i++) {
        addObstacle(obs, stoneMat, 6, 0.5, 1.2, 0, -i * 0.5 - 0.25, -83 + (i + 0.5) * 1.2);
    }
    // Corridor torches mounted on east wall
    for (const tz of [-68, -50, -32, -16]) addTorch(2.5, -6, tz);

    // — East corridor (x=6 to x=85, z=-3 to z=3) —
    addObstacle(obs, stoneMat, 79, 8, 1, 45.5, -4, -3);    // north wall
    addObstacle(obs, stoneMat, 46, 8, 1, 29,   -4,  3);    // south wall west of S-corridor junction
    addObstacle(obs, stoneMat, 27, 8, 1, 71.5, -4,  3);    // south wall east of S-corridor junction
    addObstacle(obs, stoneMat, 79, 0.4, 6, 45.5, -3, 0, { noCollide: true }); // ceiling
    // Descending stairs: west from x=83
    for (let i = 0; i < 16; i++) {
        addObstacle(obs, stoneMat, 1.2, 0.5, 6, 83 - (i + 0.5) * 1.2, -i * 0.5 - 0.25, 0);
    }
    // Corridor torches mounted on north wall
    for (const tx of [70, 50, 30, 15]) addTorch(tx, -6, -2.5);

    // — West corridor (x=-85 to x=-6, z=-3 to z=3) —
    addObstacle(obs, stoneMat, 79, 8, 1, -45.5, -4, -3);   // north wall
    addObstacle(obs, stoneMat, 79, 8, 1, -45.5, -4,  3);   // south wall
    addObstacle(obs, stoneMat, 79, 0.4, 6, -45.5, -3, 0, { noCollide: true }); // ceiling
    // Descending stairs: east from x=-83
    for (let i = 0; i < 16; i++) {
        addObstacle(obs, stoneMat, 1.2, 0.5, 6, -83 + (i + 0.5) * 1.2, -i * 0.5 - 0.25, 0);
    }
    // Corridor torches mounted on south wall
    for (const tx of [-70, -50, -30, -15]) addTorch(tx, -6, 2.5);

    // — South corridor (x=52–58, z=3 to z=83) — T-junctions into east corridor at z=3 —
    addObstacle(obs, stoneMat, 1, 8, 80, 52, -4, 43);      // west wall
    addObstacle(obs, stoneMat, 1, 8, 80, 58, -4, 43);      // east wall
    addObstacle(obs, stoneMat, 6, 0.4, 80, 55, -3, 43, { noCollide: true }); // ceiling
    // Descending stairs: north from z=83
    for (let i = 0; i < 16; i++) {
        addObstacle(obs, stoneMat, 6, 0.5, 1.2, 55, -i * 0.5 - 0.25, 83 - (i + 0.5) * 1.2);
    }
    // Corridor torches mounted on west wall
    for (const tz of [68, 50, 32, 14]) addTorch(52.5, -6, tz);

    // Staircases to outer wall tops (12 steps, rise 6)
    addStaircase(-55, -73.4, 'N');
    addStaircase(55, 73.4, 'S');
    addStaircase(73.4, 50, 'E');
    addStaircase(-73.4, -50, 'W');

    // --- Outer wall battlements (top y=6, mh=1.2) ---
    addMerlonsX(stoneMat, -85, -77, 31, 6, 2, 1.2, 4);
    addMerlonsX(stoneMat, -85, 39, 77, 6, 2, 1.2, 4);
    addMerlonsZ(stoneMat, 85, -77, 6, 6, 4, 1.2, 2);
    addMerlonsZ(stoneMat, 85, 14, 77, 6, 4, 1.2, 2);
    addMerlonsZ(stoneMat, -85, -77, -39, 6, 4, 1.2, 2);
    addMerlonsZ(stoneMat, -85, -31, 77, 6, 4, 1.2, 2);
    addMerlonsX(darkStoneMat, 85, -77, -14, 6, 2, 1.2, 4);
    addMerlonsX(darkStoneMat, 85, 14, 77, 6, 2, 1.2, 4);

    // Corner towers (r=9, h=10, centre y=5)
    addCylinder(darkStoneMat, 9, 10, -85, 5, -85);
    addCylinder(darkStoneMat, 9, 10, 85, 5, -85);
    addCylinder(darkStoneMat, 9, 10, -85, 5, 85);
    addCylinder(darkStoneMat, 9, 10, 85, 5, 85);

    for (const [cx, cz] of [[-85, -85], [85, -85], [-85, 85], [85, 85]]) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.5, 2.5), darkStoneMat);
            m.position.set(cx + Math.cos(a) * 7.5, 11.25, cz + Math.sin(a) * 7.5);
            scene.add(m);
        }
    }

    // Gatehouse towers (h=9, was 18)
    addObstacle(obs, darkStoneMat, 12, 9, 12, -18, 4.5, 85);
    addObstacle(obs, darkStoneMat, 12, 9, 12, 18, 4.5, 85);
    addMerlonsX(darkStoneMat, 85, -24, -12, 9, 2, 1.2, 4);
    addMerlonsX(darkStoneMat, 85, 12, 24, 9, 2, 1.2, 4);

    // Portcullis frame (scaled to h=6 gate)
    const portMat = new THREE.MeshStandardMaterial({ color: 0x1a0f05, roughness: 1.0 });
    const pTop = new THREE.Mesh(new THREE.BoxGeometry(24, 1.5, 1.2), portMat);
    pTop.position.set(0, 5.75, 84.4);
    scene.add(pTop);
    const pLeft = new THREE.Mesh(new THREE.BoxGeometry(2, 5.5, 1.2), portMat);
    pLeft.position.set(-11, 2.75, 84.4);
    scene.add(pLeft);
    const pRight = new THREE.Mesh(new THREE.BoxGeometry(2, 5.5, 1.2), portMat);
    pRight.position.set(11, 2.75, 84.4);
    scene.add(pRight);

    // --- Inner keep walls (40×40, 4 thick, now 10 tall) ---
    // North wall — sealed (no doorway)
    addObstacle(obs, darkStoneMat, 40, 10, 4, 0, 5, -20); // N sealed
    addObstacle(obs, darkStoneMat, 18.5, 10, 4, -10.75, 5, 20); // S left
    addObstacle(obs, darkStoneMat, 18.5, 10, 4, 10.75, 5, 20); // S right
    addObstacle(obs, darkStoneMat, 4, 10, 40, 20, 5, 0); // E sealed
    addObstacle(obs, darkStoneMat, 4, 10, 40, -20, 5, 0); // W sealed
    addObstacle(obs, darkStoneMat, 36, 0.1, 36, 0, 0.05, 0, { noCollide: true }); // inner courtyard floor

    // Inner keep corner towers (r=3.5, h=13, centre y=6.5)
    addCylinder(mossStoneMat, 3.5, 13, -20, 6.5, -20);
    addCylinder(mossStoneMat, 3.5, 13, 20, 6.5, -20);
    addCylinder(mossStoneMat, 3.5, 13, -20, 6.5, 20);
    addCylinder(mossStoneMat, 3.5, 13, 20, 6.5, 20);

    // Conical roofs on inner keep towers
    const slateMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.7 });
    for (const [cx, cz] of [[-20, -20], [20, -20], [-20, 20], [20, 20]]) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(4.2, 5, 16), slateMat);
        cone.position.set(cx, 13 + 2.5, cz);
        scene.add(cone);
    }

    // Merlon ring on inner keep towers (at y=13)
    for (const [cx, cz] of [[-20, -20], [20, -20], [-20, 20], [20, 20]]) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), mossStoneMat);
            m.position.set(cx + Math.cos(a) * 3.2, 13.6, cz + Math.sin(a) * 3.2);
            scene.add(m);
        }
    }

    // Keep wall walkway — continuous loop (top y=10, wall 4 thick)
    const keepWalkMat = new THREE.MeshStandardMaterial({ color: 0x5a4e3c, roughness: 0.85 });
    addObstacle(obs, keepWalkMat, 40, 0.4, 4, 0, 10.2, -20); // N
    addObstacle(obs, keepWalkMat, 40, 0.4, 4, 0, 10.2, 20); // S
    addObstacle(obs, keepWalkMat, 4, 0.4, 40, 20, 10.2, 0); // E
    addObstacle(obs, keepWalkMat, 4, 0.4, 40, -20, 10.2, 0); // W

    // Outer merlons on walkway (top y=10)
    addMerlonsX(darkStoneMat, -22, -18, 18, 10, 1.5, 1.8, 2);
    addMerlonsX(darkStoneMat, 22, -18, 18, 10, 1.5, 1.8, 2);
    addMerlonsZ(darkStoneMat, 22, -18, 18, 10, 2, 1.8, 1.5);
    addMerlonsZ(darkStoneMat, -22, -18, 18, 10, 2, 1.8, 1.5);

    // Inner parapet lip (courtyard side, y=10)
    addMerlonsX(darkStoneMat, -18, -18, 18, 10, 1.5, 0.8, 2);
    addMerlonsX(darkStoneMat, 18, -18, 18, 10, 1.5, 0.8, 2);
    addMerlonsZ(darkStoneMat, 18, -18, 18, 10, 2, 0.8, 1.5);
    addMerlonsZ(darkStoneMat, -18, -18, 18, 10, 2, 0.8, 1.5);

    // Single staircase to keep wall top — NW corner, rises southward along W wall inside
    // 20 steps × 0.5h × 0.8d = 10 rise, 16 run. Starts at (-17, 0, -8), ends at (-17, 10, +8)
    {
        const steps = 20, stepH = 0.5, stepD = 0.8, stairW = 2.5;
        for (let i = 0; i < steps; i++) {
            const cH = (i + 1) * stepH;
            const sz = -8 + (i + 0.5) * stepD;
            addObstacle(obs, stoneMat, stairW, cH, stepD, -17, cH / 2, sz);
        }
        addObstacle(obs, keepWalkMat, 2.5, 0.4, 2, -18.75, 10.2, 8);
    }

    // Walkway torches (y=10.6, sitting on walkway top surface at y=10.4)
    for (const tx of [-12, -4, 4, 12]) {
        addTorch(tx, 10.6, -22);
        addTorch(tx, 10.6, 22);
    }
    for (const tz of [-12, -4, 4, 12]) {
        addTorch(22, 10.6, tz);
        addTorch(-22, 10.6, tz);
    }

    // Arrow slits on inner keep exterior (scaled to new height)
    for (const sx of [-14, -7, 7, 14]) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.2), slitMat);
        s.position.set(sx, 6, -22.1);
        scene.add(s);
        const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.2), slitMat);
        s2.position.set(sx, 6, 22.1);
        scene.add(s2);
    }
    for (const sz of [-14, -7, 7, 14]) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.5, 0.5), slitMat);
        s.position.set(22.1, 6, sz);
        scene.add(s);
        const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.5, 0.5), slitMat);
        s2.position.set(-22.1, 6, sz);
        scene.add(s2);
    }

    // Wooden gate at south keep entrance (scaled to h=5 gate)
    const gatePanel = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.5), darkWoodMat);
    gatePanel.position.set(0, 2, 20.3);
    scene.add(gatePanel);
    for (const gy of [0.8, 2, 3.2]) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.3, 0.6), woodMat);
        plank.position.set(0, gy, 20.3);
        scene.add(plank);
    }

    // --- Barracks (4 quadrant buildings — hollowed, roofed, furnished) ---
    // 24w × 5.5h × 10d, walls 0.6 thick to prevent phasing
    function addBarracks(cx, cz, facingSouth) {
        const wallT = 0.6;
        const bw = 24, bh = 5.5, bd = 10;
        const doorW = 3, doorH = 3.5;
        const fy = bh / 2;
        const backZ = facingSouth ? cz + bd / 2 : cz - bd / 2;
        const frontZ = facingSouth ? cz - bd / 2 : cz + bd / 2;

        // Walls
        addObstacle(obs, woodMat, bw, bh, wallT, cx, fy, backZ);
        const panelW = (bw - doorW) / 2;
        addObstacle(obs, woodMat, panelW, bh, wallT, cx - (doorW / 2 + panelW / 2), fy, frontZ);
        addObstacle(obs, woodMat, panelW, bh, wallT, cx + (doorW / 2 + panelW / 2), fy, frontZ);
        addObstacle(obs, woodMat, doorW, bh - doorH, wallT, cx, doorH + (bh - doorH) / 2, frontZ);
        addObstacle(obs, woodMat, wallT, bh, bd, cx - bw / 2, fy, cz);
        addObstacle(obs, woodMat, wallT, bh, bd, cx + bw / 2, fy, cz);

        // Gabled roof — solid stepped slabs (AABB-collidable, approximate the slope)
        // Each side: 5 slabs stepping up toward the ridge. Rise 1.5 over half-depth (5 units).
        // Slab thickness 0.4, so they overlap and leave no gap.
        const roofSteps = 5;
        const halfD = bd / 2;
        for (const side of [-1, 1]) {
            for (let i = 0; i < roofSteps; i++) {
                const t = (i + 0.5) / roofSteps;           // 0.1 → 0.9
                const slabZ = cz + side * halfD * (1 - t);  // moves inward toward ridge
                const slabY = bh + 1.5 * t;                 // rises toward ridge height
                const slabD = (halfD / roofSteps) + 0.15;   // slightly overlapping depth
                addObstacle(obs, roofMat, bw + 0.4, 0.4, slabD, cx, slabY, slabZ);
            }
        }
        // Ridge cap
        addObstacle(obs, roofMat, bw + 0.4, 0.4, 0.5, cx, bh + 1.5, cz);
        // Gable end caps (decorative only — too thin to phase through)
        for (const gz of [backZ, frontZ]) {
            const cap = new THREE.Mesh(new THREE.ConeGeometry(bd / 2 * 0.72, 1.6, 4), roofMat);
            cap.rotation.y = Math.PI / 4;
            cap.position.set(cx, bh + 0.8, gz);
            scene.add(cap);
        }

        // Furniture
        const bedMat = darkWoodMat;
        const bedZ = backZ + (facingSouth ? -1.2 : 1.2);
        for (const bx of [-8, 0, 8]) {
            const lower = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 0.9), bedMat);
            lower.position.set(cx + bx, 0.5, bedZ);
            scene.add(lower);
            const upper = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 0.9), bedMat);
            upper.position.set(cx + bx, 1.6, bedZ);
            scene.add(upper);
            for (const px of [-0.8, 0.8]) for (const pz of [-0.35, 0.35]) {
                const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, 0.1), bedMat);
                post.position.set(cx + bx + px, 0.9, bedZ + pz);
                scene.add(post);
            }
        }
        const tableTop = new THREE.Mesh(new THREE.BoxGeometry(4, 0.15, 1.5), woodMat);
        tableTop.position.set(cx, 2.0, cz);
        scene.add(tableTop);
        for (const lx of [-1.7, 1.7]) for (const lz of [-0.55, 0.55]) {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.0, 0.12), woodMat);
            leg.position.set(cx + lx, 1.0, cz + lz);
            scene.add(leg);
        }
        for (const sx of [-1.5, 0, 1.5]) {
            const st = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.55), woodMat);
            st.position.set(cx + sx, 1.2, cz + (facingSouth ? 1.3 : -1.3));
            scene.add(st);
            for (const slx of [-0.18, 0.18]) for (const slz of [-0.18, 0.18]) {
                const sl = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.2, 0.07), woodMat);
                sl.position.set(cx + sx + slx, 0.6, cz + (facingSouth ? 1.3 : -1.3) + slz);
                scene.add(sl);
            }
        }
        const rackX = cx + bw / 2 - 0.8;
        const rackZ = cz + (facingSouth ? -1.5 : 1.5);
        const rackBar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.5), woodMat);
        rackBar.position.set(rackX, 2.8, rackZ);
        scene.add(rackBar);
        for (const rz of [rackZ - 1.0, rackZ + 1.0]) {
            const rp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.1), woodMat);
            rp.position.set(rackX, 2.3, rz);
            scene.add(rp);
        }
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 10), woodMat);
        barrel.position.set(cx - bw / 2 + 0.8, 0.45, frontZ + (facingSouth ? 0.8 : -0.8));
        scene.add(barrel);
        addTorch(cx, bh - 0.5, cz);
    }

    addBarracks(-50, -50, true);
    addBarracks(50, -50, true);
    addBarracks(-50, 50, false);
    addBarracks(50, 50, false);

    // Watchtower (h=18, was 36)
    addObstacle(obs, darkStoneMat, 7, 18, 7, 62, 9, -62);

    // Stone rubble
    const rng = mulberry32(0xf047be55);
    for (let i = 0; i < 30; i++) {
        const rx = (rng() - 0.5) * 140;
        const rz = (rng() - 0.5) * 140;
        if (Math.abs(rx) < 25 && Math.abs(rz) < 25) continue;
        if (Math.abs(rx) > 80 || Math.abs(rz) > 80) continue;
        const w = 0.4 + rng() * 1.2, h = 0.2 + rng() * 0.7, d = 0.4 + rng() * 1.2;
        addObstacle(obs, stoneMat, w, h, d, rx, h / 2, rz);
    }

    // Torches along inner wall faces (y=6.2, sitting on outer wall top surface at y=6)
    for (const tx of [-60, -30, 0, 30, 65]) addTorch(tx, 6.2, -81);
    for (const tx of [-60, -30, 0, 30, 60]) addTorch(tx, 6.2, 81);
    for (const tz of [-60, -30, -5, 30, 60]) addTorch(81, 6.2, tz);
    for (const tz of [-65, 0, 30, 60]) addTorch(-81, 6.2, tz);
}

// ─── Cave map ─────────────────────────────────────────────────────────────────
const CAVE_HEIGHT = 12; // interior ceiling height (floor y=0, ceiling bottom at CAVE_HEIGHT)

export function buildCaveMap(obs) {
    const map = MAPS['cave'];
    const size = map.size;
    const seed = 0xCA1E1234; // deterministic seed for cave map
    const rng = mulberry32(seed >>> 0);

    const { caverns, tunnels } = generateCaveLayout(rng);

    // --- Determine player spawn cavern early so geometry can clear space around it ---
    const _playerCavern = caverns
        .filter(c => !c.isSpawnCavern)
        .reduce((best, c) => (!best || c.radius < best.radius) ? c : best, null)
        || caverns[0];
    const PLAYER_CLEAR_R = 5; // no stalagmites within this radius of spawn center

    // --- Materials ---
    const floorMat = new THREE.MeshStandardMaterial({ color: map.color, roughness: 0.95 });
    const wallMat = new THREE.MeshStandardMaterial({ color: map.wallColor, roughness: 0.9 });
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1.0 });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x2a2520, roughness: 1.0 });
    const rockMat2 = new THREE.MeshStandardMaterial({ color: 0x1e1c18, roughness: 1.0 });
    const stalMat = new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.9 });
    const poolMat = new THREE.MeshStandardMaterial({
        color: 0x1a2a3a, transparent: true, opacity: 0.65, roughness: 0.1, metalness: 0.3
    });

    // --- Floor ---
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(size * 2, size * 2), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // --- Ceiling slab (noStep so floor-snap never teleports player on top) ---
    {
        const ceilGeo = new THREE.BoxGeometry(size * 2, 2, size * 2);
        const ceilMesh = new THREE.Mesh(ceilGeo, ceilMat);
        ceilMesh.position.set(0, CAVE_HEIGHT + 1, 0);
        scene.add(ceilMesh);
        obs.push({ mesh: ceilMesh, box: new THREE.Box3().setFromObject(ceilMesh), noStep: true });
    }

    // --- Tunnel walls ---
    for (const tunnel of tunnels) {
        const fromC = caverns[tunnel.fromId];
        const toC = caverns[tunnel.toId];
        const dx = toC.cx - fromC.cx;
        const dz = toC.cz - fromC.cz;
        const len = Math.hypot(dx, dz);
        if (len < 0.001) continue;
        const angle = Math.atan2(dx, dz); // rotation around Y axis

        const cx = (fromC.cx + toC.cx) / 2;
        const cz = (fromC.cz + toC.cz) / 2;
        const w = tunnel.width;
        const h = tunnel.height;
        const wallThick = 1.5;

        // Left wall — isSlope so inflated AABB doesn't cover cavern interiors; raycast handles collision
        const lwMesh = new THREE.Mesh(new THREE.BoxGeometry(wallThick, h, len), wallMat);
        lwMesh.position.set(cx - Math.cos(angle) * (w / 2 + wallThick / 2), h / 2, cz + Math.sin(angle) * (w / 2 + wallThick / 2));
        lwMesh.rotation.y = angle;
        lwMesh.userData.isTunnelWall = true;
        scene.add(lwMesh);
        lwMesh.updateMatrixWorld(true);
        obs.push({ mesh: lwMesh, box: new THREE.Box3().setFromObject(lwMesh), isSlope: true });
        gameState.slopeMeshes.push(lwMesh);

        // Right wall
        const rwMesh = new THREE.Mesh(new THREE.BoxGeometry(wallThick, h, len), wallMat);
        rwMesh.position.set(cx + Math.cos(angle) * (w / 2 + wallThick / 2), h / 2, cz - Math.sin(angle) * (w / 2 + wallThick / 2));
        rwMesh.rotation.y = angle;
        rwMesh.userData.isTunnelWall = true;
        scene.add(rwMesh);
        rwMesh.updateMatrixWorld(true);
        obs.push({ mesh: rwMesh, box: new THREE.Box3().setFromObject(rwMesh), isSlope: true });
        gameState.slopeMeshes.push(rwMesh);

        // Ceiling slab
        const tcMesh = new THREE.Mesh(new THREE.BoxGeometry(w + wallThick * 2, wallThick, len), ceilMat);
        tcMesh.position.set(cx, h + wallThick / 2, cz);
        tcMesh.rotation.y = angle;
        tcMesh.userData.isTunnelWall = true;
        scene.add(tcMesh);
        obs.push({ mesh: tcMesh, box: new THREE.Box3().setFromObject(tcMesh) });

        // Floor strip
        const tfMesh = new THREE.Mesh(new THREE.BoxGeometry(w + wallThick * 2, wallThick, len), floorMat);
        tfMesh.position.set(cx, -wallThick / 2, cz);
        tfMesh.rotation.y = angle;
        tfMesh.userData.isTunnelWall = true;
        scene.add(tfMesh);
        obs.push({ mesh: tfMesh, box: new THREE.Box3().setFromObject(tfMesh) });
    }

    // --- Cavern rock walls (ring of irregular BoxGeometry segments) ---
    for (const cavern of caverns) {
        const segCount = 14 + Math.floor(rng() * 8);
        for (let i = 0; i < segCount; i++) {
            const angle = (i / segCount) * Math.PI * 2 + (rng() - 0.5) * 0.4;
            const dist = cavern.radius + rng() * 2.5;
            const segW = 2.5 + rng() * 4.5;
            const segH = CAVE_HEIGHT * (0.5 + rng() * 0.5);
            const segD = 2.0 + rng() * 3.0;
            const wx = cavern.cx + Math.cos(angle) * dist;
            const wz = cavern.cz + Math.sin(angle) * dist;
            const mat = rng() < 0.5 ? rockMat : rockMat2;
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(segW, segH, segD), mat);
            mesh.position.set(wx, segH / 2, wz);
            mesh.rotation.y = angle + Math.PI / 2 + (rng() - 0.5) * 0.5;
            scene.add(mesh);
            if (segW > 0.8) {
                mesh.updateMatrixWorld(true);
                obs.push({ mesh, box: new THREE.Box3().setFromObject(mesh), isSlope: true });
                gameState.slopeMeshes.push(mesh);
            }
        }
    }

    // --- Stalactites (hanging from ceiling, y-flipped) ---
    for (const cavern of caverns) {
        const count = 6 + Math.floor(rng() * 10);
        for (let i = 0; i < count; i++) {
            const angle = rng() * Math.PI * 2;
            const dist = rng() * cavern.radius * 0.85;
            const sx = cavern.cx + Math.cos(angle) * dist;
            const sz = cavern.cz + Math.sin(angle) * dist;
            const baseR = 0.15 + rng() * 0.55;
            const stalH = 1.5 + rng() * 3.5;
            const mesh = new THREE.Mesh(new THREE.ConeGeometry(baseR, stalH, 6), stalMat);
            mesh.rotation.z = Math.PI; // y-flip: tip points down
            mesh.position.set(sx, CAVE_HEIGHT - stalH / 2, sz);
            scene.add(mesh);
            if (baseR > 0.4) {
                obs.push({ mesh, box: new THREE.Box3().setFromObject(mesh) });
            }
        }
    }

    // --- Stalagmites (rising from floor) ---
    for (const cavern of caverns) {
        const count = 5 + Math.floor(rng() * 8);
        for (let i = 0; i < count; i++) {
            const angle = rng() * Math.PI * 2;
            const dist = rng() * cavern.radius * 0.8;
            const sx = cavern.cx + Math.cos(angle) * dist;
            const sz = cavern.cz + Math.sin(angle) * dist;
            const baseR = 0.12 + rng() * 0.5;
            const stalH = 0.8 + rng() * 2.5;
            // Skip stalagmites too close to the player spawn point
            const dxP = sx - _playerCavern.cx, dzP = sz - _playerCavern.cz;
            if (dxP * dxP + dzP * dzP < PLAYER_CLEAR_R * PLAYER_CLEAR_R) continue;
            const mesh = new THREE.Mesh(new THREE.ConeGeometry(baseR, stalH, 6), stalMat);
            mesh.position.set(sx, stalH / 2, sz);
            scene.add(mesh);
            if (baseR > 0.4) {
                obs.push({ mesh, box: new THREE.Box3().setFromObject(mesh) });
            }
        }
    }

    // --- Crystal formations (at least 6 clusters) ---
    const crystalColors = [0x4488ff, 0x44ffaa, 0x22ddff, 0x66aaff, 0x33ffcc, 0x88aaff];
    const crystalCount = Math.max(6, caverns.length + 1);
    for (let ci = 0; ci < crystalCount; ci++) {
        const cavern = caverns[ci % caverns.length];
        const angle = rng() * Math.PI * 2;
        const dist = rng() * cavern.radius * 0.7;
        const cx = cavern.cx + Math.cos(angle) * dist;
        const cz = cavern.cz + Math.sin(angle) * dist;
        const color = crystalColors[ci % crystalColors.length];
        const emissiveMat = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.8,
            roughness: 0.2,
            metalness: 0.5
        });

        // Cluster of 2-4 crystal spires
        const spireCount = 2 + Math.floor(rng() * 3);
        for (let s = 0; s < spireCount; s++) {
            const sa = rng() * Math.PI * 2;
            const sd = rng() * 1.2;
            const spireH = 1.0 + rng() * 2.5;
            const spireR = 0.15 + rng() * 0.35;
            let mesh;
            if (rng() < 0.5) {
                mesh = new THREE.Mesh(new THREE.ConeGeometry(spireR, spireH, 5), emissiveMat);
            } else {
                mesh = new THREE.Mesh(new THREE.OctahedronGeometry(spireR * 1.5), emissiveMat);
            }
            mesh.position.set(cx + Math.cos(sa) * sd, spireH / 2, cz + Math.sin(sa) * sd);
            mesh.rotation.y = rng() * Math.PI;
            // Tag only the first spire as the cluster representative (1 tag per 1 PointLight)
            if (s === 0) mesh.userData.isCrystal = true;
            scene.add(mesh);
        }

        // PointLight for this crystal cluster
        const lightColor = crystalColors[ci % crystalColors.length];
        const ptLight = new THREE.PointLight(lightColor, 1.5, 20 + rng() * 10);
        ptLight.position.set(cx, 1.5, cz);
        scene.add(ptLight);
    }

    // --- Cave pool (decorative, in first cavern) ---
    {
        const poolCavern = caverns[0];
        const poolMesh = new THREE.Mesh(new THREE.PlaneGeometry(poolCavern.radius * 0.6, poolCavern.radius * 0.5), poolMat);
        poolMesh.rotation.x = -Math.PI / 2;
        poolMesh.position.set(poolCavern.cx + 2, 0.02, poolCavern.cz + 2);
        scene.add(poolMesh);
    }

    // --- Directional fill light (intensity 0.05) ---
    const dirFill = new THREE.DirectionalLight(0xffffff, 0.05);
    dirFill.position.set(0, CAVE_HEIGHT, 0);
    scene.add(dirFill);

    // --- Expose spawn cavern ---
    const spawnCavern = caverns.find(c => c.isSpawnCavern);
    if (spawnCavern) {
        gameState.zombieSpawnCavern = { cx: spawnCavern.cx, cz: spawnCavern.cz, radius: spawnCavern.radius };
    }

    // --- Player start: center of the pre-selected non-zombie cavern (clear of stalagmites) ---
    gameState.cavePlayerSpawn = { x: _playerCavern.cx, z: _playerCavern.cz };

    // --- Ambient audio (graceful degradation) ---
    try {
        const AudioCtx = (typeof AudioContext !== 'undefined') ? AudioContext :
            (typeof window !== 'undefined' && window.AudioContext) ? window.AudioContext : null;
        if (AudioCtx) {
            const audioCtx = new AudioCtx();
            const oscillator = audioCtx.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(60, audioCtx.currentTime);
            const gainNode = audioCtx.createGain();
            gainNode.gain.setValueAtTime(0.02, audioCtx.currentTime);
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start();
            gameState.caveAmbientNode = gainNode;
        } else {
            gameState.caveAmbientNode = null;
        }
    } catch (e) {
        gameState.caveAmbientNode = null;
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
    gameState.secretPassages = [];
    gameState.undergroundZones = [];
    gameState.indoorCeilY = null;
    gameState.hallwayPlayerSpawnZ = null;
    gameState.hallwayZombieSpawnZ = null;
    gameState.cavePlayerSpawn = null;

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
        gameState.indoorCeilY = wallH;
        // Industrial ceiling light fixtures (flickering)
        gameState.warehouseLights = [];
        const ceilLightGeo = new THREE.BoxGeometry(0.8, 0.15, 2.5);
        const lightSpots = [
            [-size * 0.4, -size * 0.4], [-size * 0.4, 0], [-size * 0.4, size * 0.4],
            [0, -size * 0.4], [0, 0], [0, size * 0.4],
            [size * 0.4, -size * 0.4], [size * 0.4, 0], [size * 0.4, size * 0.4],
        ];
        for (const [lx, lz] of lightSpots) {
            const mat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffaa, emissiveIntensity: 7.5 });
            const fixture = new THREE.Mesh(ceilLightGeo, mat);
            fixture.position.set(lx, wallH - 0.1, lz);
            scene.add(fixture);
            const ptLight = new THREE.PointLight(0xffffdd, 6.0, size * 0.55);
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
            duneMat: new THREE.MeshStandardMaterial({ color: 0xd4a855, roughness: 1.0 }),
            ruinMat: new THREE.MeshStandardMaterial({ color: 0x9a8060, roughness: 0.95 }),
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
            snowMat: new THREE.MeshStandardMaterial({ color: 0xf2f4f8, roughness: 0.88 }),
        };
        const halfM = Math.ceil(size * 1.1 / MOUNTAIN_TILE_STEP) * MOUNTAIN_TILE_STEP;
        _mountainChunkCenters = [];
        for (let mx = -halfM; mx <= halfM; mx += MOUNTAIN_TILE_STEP)
            for (let mz = -halfM; mz <= halfM; mz += MOUNTAIN_TILE_STEP)
                _mountainChunkCenters.push(mx, mz);
        updateMountainChunks(0, 0);
    } else if (mapId === 'fortress') {
        buildFortressMap(obs);
    } else if (mapId === 'hallway') {
        buildHallwayMap(obs);
    } else if (mapId === 'cave') {
        scene.fog = new THREE.Fog(0x050505, 15, 60);
        scene.background = new THREE.Color(0x050505);
        gameState.fogNearBase = scene.fog.near;
        gameState.fogFarBase = scene.fog.far;
        gameState.dayNightActive = false;
        gameState.zombieSpawnCavern = null;
        buildCaveMap(obs);
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
            boulderMat: new THREE.MeshStandardMaterial({ color: 0x606258, roughness: 0.96 }),
            shroomMat: new THREE.MeshStandardMaterial({ color: 0xbb3311, roughness: 0.8 }),
            shroomCapMat: new THREE.MeshStandardMaterial({ color: 0xdd6633, roughness: 0.7 }),
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
