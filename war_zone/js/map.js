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
        for (let i = 0; i < 30; i++) {
            const w = 1 + rng() * 3, h = 1 + rng() * 4, d = 1 + rng() * 3;
            addObstacle(obs, obsMat, w, h, d,
                (rng() - 0.5) * size * 1.5, h / 2, (rng() - 0.5) * size * 1.5);
        }
    } else if (mapId === 'desert') {
        for (let i = 0; i < 20; i++) {
            const s = 2 + rng() * 4;
            addObstacle(obs, obsMat, s, s * 0.6, s,
                (rng() - 0.5) * size * 1.6, s * 0.3, (rng() - 0.5) * size * 1.6);
        }
    } else if (mapId === 'city') {
        const stairMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.8 });
        for (let i = 0; i < 15; i++) {
            const w = 4 + rng() * 8, h = 4 + rng() * 12, d = 4 + rng() * 8;
            const bx = (rng() - 0.5) * size * 1.4;
            const bz = (rng() - 0.5) * size * 1.4;
            addObstacle(obs, obsMat, w, h, d, bx, h / 2, bz);

            const stairWidth = 1.2, stepH = 0.5, stepD = 0.6;
            const numSteps = Math.ceil(h / stepH);
            const side = rng() > 0.5 ? 1 : -1;
            for (let s = 0; s < numSteps; s++) {
                addObstacle(obs, stairMat, stairWidth, stepH, stepD,
                    bx + side * (w / 2 + stairWidth / 2 + 0.1),
                    s * stepH + stepH / 2,
                    bz - d / 2 + (s / numSteps) * d);
            }
        }
    } else if (mapId === 'forest') {
        const treeMat = new THREE.MeshStandardMaterial({ color: 0x4a3520 });
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x1a5a0a });
        for (let i = 0; i < 50; i++) {
            const x = (rng() - 0.5) * size * 1.6;
            const z = (rng() - 0.5) * size * 1.6;
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 6, 8), treeMat);
            trunk.position.set(x, 3, z);
            trunk.castShadow = true;
            scene.add(trunk);
            obs.push({ mesh: trunk, radius: 0.4 });
            const canopy = new THREE.Mesh(new THREE.SphereGeometry(2.5, 8, 6), leafMat);
            canopy.position.set(x, 7, z);
            canopy.castShadow = true;
            scene.add(canopy);
        }
    }

    setObstacles(obs);
    spawnAmmoPickups(size);
}

function spawnAmmoPickups(mapSize) {
    gameState.ammoPickups = [];
    const mat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0x888800 });
    for (let i = 0; i < 15; i++) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat);
        mesh.position.set(
            (Math.random() - 0.5) * mapSize * 1.4, 0.4,
            (Math.random() - 0.5) * mapSize * 1.4
        );
        scene.add(mesh);
        gameState.ammoPickups.push({ mesh, collected: false });
    }
}
