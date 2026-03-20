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
        for (let i = 0; i < 120; i++) {
            const w = 1 + rng() * 3, h = 1 + rng() * 4, d = 1 + rng() * 3;
            const bx = (rng() - 0.5) * size * 1.5;
            const bz = (rng() - 0.5) * size * 1.5;
            if (Math.abs(bx) < 5 && Math.abs(bz) < 5) continue; // Keep spawn clear
            addObstacle(obs, obsMat, w, h, d, bx, h / 2, bz);
        }
    } else if (mapId === 'desert') {
        for (let i = 0; i < 80; i++) {
            const s = 2 + rng() * 4;
            const bx = (rng() - 0.5) * size * 1.6;
            const bz = (rng() - 0.5) * size * 1.6;
            if (Math.abs(bx) < 5 && Math.abs(bz) < 5) continue;
            addObstacle(obs, obsMat, s, s * 0.6, s, bx, s * 0.3, bz);
        }
    } else if (mapId === 'city') {
        const buildingColors = [0xaaaaaa, 0x884444, 0x445588, 0x888855, 0x55aa66];
        for (let i = 0; i < 80; i++) {
            const w = 12 + rng() * 8, h = 8 + rng() * 6, d = 12 + rng() * 8;
            const bx = (rng() - 0.5) * size * 1.5;
            const bz = (rng() - 0.5) * size * 1.5;
            if (Math.abs(bx) < 15 && Math.abs(bz) < 15) continue;

            const bMat = new THREE.MeshStandardMaterial({ color: buildingColors[Math.floor(rng() * buildingColors.length)], roughness: 0.8 });

            const thickness = 0.5;
            const doorW = 2.5, doorH = 3.5;

            // Front wall
            addObstacle(obs, bMat, (w - doorW) / 2, h, thickness, bx - w / 2 + (w - doorW) / 4, h / 2, bz + d / 2);
            addObstacle(obs, bMat, (w - doorW) / 2, h, thickness, bx + w / 2 - (w - doorW) / 4, h / 2, bz + d / 2);
            addObstacle(obs, bMat, doorW, h - doorH, thickness, bx, h - (h - doorH) / 2, bz + d / 2);

            // Back wall (50% chance for backdoor)
            if (rng() > 0.5) {
                addObstacle(obs, bMat, (w - doorW) / 2, h, thickness, bx - w / 2 + (w - doorW) / 4, h / 2, bz - d / 2);
                addObstacle(obs, bMat, (w - doorW) / 2, h, thickness, bx + w / 2 - (w - doorW) / 4, h / 2, bz - d / 2);
                addObstacle(obs, bMat, doorW, h - doorH, thickness, bx, h - (h - doorH) / 2, bz - d / 2);
            } else {
                addObstacle(obs, bMat, w, h, thickness, bx, h / 2, bz - d / 2);
            }

            // Side walls
            addObstacle(obs, bMat, thickness, h, d, bx - w / 2, h / 2, bz); // left
            addObstacle(obs, bMat, thickness, h, d, bx + w / 2, h / 2, bz); // right

            // Roof
            addObstacle(obs, new THREE.MeshStandardMaterial({ color: 0x333333 }), w, thickness, d, bx, h + thickness / 2, bz);

            // Second floor & stairs
            if (rng() > 0.3) {
                const floorH = h * 0.45;
                // Add second floor covering the back half of the building
                addObstacle(obs, bMat, w - thickness * 2, thickness, d / 2 - thickness, bx, floorH, bz - d / 4);

                // Add stairs going up the left wall
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
            }

            // External roof stairs (fire escape)
            if (rng() > 0.5) {
                const rsSteps = 12;
                const rsW = 2;
                const rsD = (d - 2) / rsSteps;
                const rsH = (h + thickness) / rsSteps;
                for (let s = 0; s < rsSteps; s++) {
                    const curH = rsH * (s + 1);
                    // Generate stairs up the right exterior wall
                    addObstacle(obs, new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.5 }), rsW, curH, rsD,
                        bx + w / 2 + rsW / 2,
                        curH / 2,
                        bz - d / 2 + 1 + rsD * s + rsD / 2);
                }
            }

            // Windows
            const winMat = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.4 });
            const windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), winMat);
            windowMesh.position.set(bx, h / 2 + 1, bz - d / 2 + thickness + 0.02);
            scene.add(windowMesh);

            // Graffiti/boxes
            if (rng() < 0.6) {
                const crateMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
                addObstacle(obs, crateMat, 1.2, 1.2, 1.2, bx + 2, 0.6, bz + 2);
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
            slope.updateMatrixWorld(true);
            scene.add(slope);
            obs.push({ mesh: slope, isSlope: true });
        }
    } else if (mapId === 'forest') {
        const treeMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f });
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x113a11 });

        scene.fog = new THREE.Fog(0x051105, size * 0.1, size * 0.5);
        scene.background = new THREE.Color(0x020802);

        for (let i = 0; i < 800; i++) {
            const x = (rng() - 0.5) * size * 1.9;
            const z = (rng() - 0.5) * size * 1.9;
            if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;

            const scale = 0.5 + rng() * 2.0;

            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * scale, 0.6 * scale, 8 * scale, 6), treeMat);
            trunk.position.set(x, 4 * scale, z);
            trunk.castShadow = true;
            scene.add(trunk);
            obs.push({ mesh: trunk, radius: 0.6 * scale, box: new THREE.Box3().setFromObject(trunk) });

            const canopy = new THREE.Mesh(new THREE.SphereGeometry(3.5 * scale, 7, 5), leafMat);
            canopy.position.set(x, 8 * scale, z);
            canopy.castShadow = true;
            canopy.updateMatrixWorld(true);
            scene.add(canopy);
            obs.push({ mesh: canopy, box: new THREE.Box3().setFromObject(canopy) });

            for (let j = 0; j < 3; j++) {
                const root = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * scale, 0.4 * scale, 2.5 * scale, 4), treeMat);
                root.rotation.x = Math.PI / 2 + rng();
                root.rotation.y = j * (Math.PI * 2 / 3) + rng();
                root.position.set(x + Math.cos(root.rotation.y) * scale * 0.8, 0, z + Math.sin(root.rotation.y) * scale * 0.8);
                root.updateMatrixWorld(true);
                scene.add(root);
                obs.push({ mesh: root, box: new THREE.Box3().setFromObject(root) });
            }
        }
    }

    setObstacles(obs);
    gameState.ammoPickups = [];
    for (let i = 0; i < 3; i++) spawnSinglePickup(size);
}

export function spawnSinglePickup(mapSize) {
    const isMedkit = Math.random() < 0.2;
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
