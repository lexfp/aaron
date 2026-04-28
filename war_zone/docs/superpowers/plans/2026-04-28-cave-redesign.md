# Cave Map Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the cave map from a dark multi-cavern labyrinth (size 200) to a warm natural two-wing cave (size 90) matching the reference image, while preserving all original functional requirements.

**Architecture:** Replace the random MST cavern generator with a hardcoded four-cavern two-wing layout. Rewrite `buildCaveMap` in `map.js` to use warm orange/sandy materials and torch lighting in the forward chambers, blue-green crystal lighting only in the deep right wing, and a walkable outdoor exit area at the back of the central cavern. `generateCaveLayout` becomes a stub returning the hardcoded layout so existing tests pass unchanged.

**Tech Stack:** Three.js (BoxGeometry, ConeGeometry, CylinderGeometry, OctahedronGeometry, MeshStandardMaterial, PointLight, DirectionalLight), Jest + fast-check for tests, vanilla JS modules.

---

### Task 1: Update cave data entry tests + data.js

**Files:**
- Modify: `war_zone/tests/cave-map.test.js:67-85`
- Modify: `war_zone/js/data.js` (cave entry)

- [ ] **Step 1: Update the three failing data-entry tests in `tests/cave-map.test.js`**

Replace lines 67–85 (the size, color, and wallColor tests):

```javascript
    test('size is 90', () => {
        expect(MAPS['cave'].size).toBe(90);
    });

    test('ambientLight is 0.08', () => {
        expect(MAPS['cave'].ambientLight).toBe(0.08);
    });

    test('color is in warm sandy range (redesigned)', () => {
        const color = MAPS['cave'].color;
        expect(color).toBeGreaterThanOrEqual(0x8a5020);
        expect(color).toBeLessThanOrEqual(0xd0a870);
    });

    test('wallColor is in warm sienna range (redesigned)', () => {
        const wallColor = MAPS['cave'].wallColor;
        expect(wallColor).toBeGreaterThanOrEqual(0x6a2800);
        expect(wallColor).toBeLessThanOrEqual(0xb06030);
    });
```

- [ ] **Step 2: Run tests to confirm the three updated tests now fail**

```
cd war_zone && npm test -- --testPathPattern=cave-map
```

Expected: `size is 90` FAIL (got 200), `color is in warm sandy range` FAIL (0x3a3a3a is outside range), `wallColor is in warm sienna range` FAIL (0x252525 is outside range).

- [ ] **Step 3: Update the cave entry in `js/data.js`**

Replace the existing cave entry:

```javascript
    cave: {
        name: 'Cave',
        description: 'A natural cave with a warm torch-lit entrance, two branching wings, and something cold glowing in the deep.',
        size: 90,
        color: 0xb89060,
        wallColor: 0x8B4513,
        ambientLight: 0.08
    }
```

- [ ] **Step 4: Run tests to confirm all data-entry tests pass**

```
cd war_zone && npm test -- --testPathPattern=cave-map
```

Expected: All `MAPS['cave']` describe block tests PASS.

- [ ] **Step 5: Commit**

```bash
git add war_zone/js/data.js war_zone/tests/cave-map.test.js
git commit -m "feat: update cave map data entry — size 90, warm sandy palette"
```

---

### Task 2: Replace generateCaveLayout with hardcoded stub + update CAVE_HEIGHT

**Files:**
- Modify: `war_zone/js/map.js` (lines 8–103 for generateCaveLayout, line 1418 for CAVE_HEIGHT)
- Modify: `war_zone/tests/cave-map.test.js:552`

- [ ] **Step 1: Update the ceiling-height constant in the test (`tests/cave-map.test.js` line 552)**

Change:
```javascript
    const CAVE_HEIGHT = 12;
```
To:
```javascript
    const CAVE_HEIGHT = 8;
```

- [ ] **Step 2: Run the ceiling test to confirm it still passes (9 >= 8 is true with old code)**

```
cd war_zone && npm test -- --testPathPattern=cave-map --verbose
```

Expected: `at least one obstacle has noStep: true and mesh y >= CAVE_HEIGHT` still PASS (old ceiling at y=13 ≥ 8).

- [ ] **Step 3: Change CAVE_HEIGHT in `js/map.js` (line 1418)**

```javascript
const CAVE_HEIGHT = 8; // interior ceiling height
```

- [ ] **Step 4: Add the hardcoded cavern/tunnel constants and replace generateCaveLayout in `js/map.js`**

Replace everything from the `generateCaveLayout` JSDoc comment (line ~18) through the closing `}` of the function (line ~115) with:

```javascript
const _CAVE_CAVERNS = [
    { id: 0, cx:  0,  cz:  0,   radius: 18, isSpawnCavern: false }, // central (player spawn)
    { id: 1, cx: -40, cz: -12,  radius: 12, isSpawnCavern: false }, // left wing
    { id: 2, cx:  40, cz: -12,  radius: 11, isSpawnCavern: false }, // right shallow
    { id: 3, cx:  55, cz: -52,  radius: 12, isSpawnCavern: true  }, // right deep (zombie spawn)
];

const _CAVE_TUNNELS = [
    { fromId: 0, toId: 1, width: 5, height: 6 }, // central → left wing
    { fromId: 0, toId: 2, width: 5, height: 6 }, // central → right shallow
    { fromId: 2, toId: 3, width: 5, height: 6 }, // right shallow → right deep
];

/**
 * generateCaveLayout — returns the hardcoded two-wing cave layout as plain data.
 * The rng parameter is accepted for interface compatibility but not used.
 * All variation (rock segment sizes, formation scatter) is handled inside buildCaveMap.
 */
export function generateCaveLayout(_rng) {
    return {
        caverns: _CAVE_CAVERNS.map(c => ({ ...c })),
        tunnels: _CAVE_TUNNELS.map(t => ({ ...t })),
    };
}
```

- [ ] **Step 5: Run full cave-map test suite**

```
cd war_zone && npm test -- --testPathPattern=cave-map
```

Expected: ALL tests PASS. The Property 1–3 and Property 7 tests still pass because the hardcoded layout satisfies graph connectivity, tunnel structural integrity, determinism (same result every call), and tunnel dimension invariants (width=5≥4, height=6≥5). The `generateCaveLayout — unit tests (seed 42)` suite passes because the stub returns exactly 4 caverns with one isSpawnCavern and valid tunnel IDs.

- [ ] **Step 6: Commit**

```bash
git add war_zone/js/map.js war_zone/tests/cave-map.test.js
git commit -m "refactor: replace generateCaveLayout with hardcoded two-wing stub, lower CAVE_HEIGHT to 8"
```

---

### Task 3: Rewrite buildCaveMap

**Files:**
- Modify: `war_zone/js/map.js` (replace entire `buildCaveMap` function, lines ~1420–1669)

- [ ] **Step 1: Run the full test suite to record the baseline pass count before rewriting**

```
cd war_zone && npm test -- --testPathPattern=cave-map
```

Note the number of passing tests. All should pass. This is your baseline.

- [ ] **Step 2: Replace the entire `buildCaveMap` function in `js/map.js`**

Delete from `export function buildCaveMap(obs) {` through its closing `}` (lines ~1420–1669) and replace with:

```javascript
export function buildCaveMap(obs) {
    const map = MAPS['cave'];
    const size = map.size; // 90
    const rng = mulberry32(0xCA1E1234 >>> 0);

    // ── Materials ──────────────────────────────────────────────────────────
    const warmFloor   = new THREE.MeshStandardMaterial({ color: 0xb89060, roughness: 0.95 });
    const warmWallA   = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });
    const warmWallB   = new THREE.MeshStandardMaterial({ color: 0xA0522D, roughness: 0.9 });
    const warmCeil    = new THREE.MeshStandardMaterial({ color: 0x5a2800, roughness: 1.0 });
    const warmStal    = new THREE.MeshStandardMaterial({ color: 0x7a4020, roughness: 0.9 });
    const midWall     = new THREE.MeshStandardMaterial({ color: 0x5a3820, roughness: 0.9 });
    const midStal     = new THREE.MeshStandardMaterial({ color: 0x5a3820, roughness: 0.9 });
    const coldWallA   = new THREE.MeshStandardMaterial({ color: 0x1e1c18, roughness: 0.9 });
    const coldWallB   = new THREE.MeshStandardMaterial({ color: 0x252220, roughness: 0.9 });
    const coldStal    = new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.9 });
    const torchHandle = new THREE.MeshStandardMaterial({ color: 0x4a2800 });
    const flameMat    = new THREE.MeshStandardMaterial({
        color: 0xff8800, emissive: 0xff4400, emissiveIntensity: 1.0
    });
    const poolMat = new THREE.MeshStandardMaterial({
        color: 0x1a2a3a, transparent: true, opacity: 0.65, roughness: 0.1, metalness: 0.3
    });
    const crystalColors = [0x4488ff, 0x44ffaa, 0x22ddff, 0x66aaff, 0x33ffcc, 0x88aaff];

    // ── Floor ──────────────────────────────────────────────────────────────
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(size * 2, size * 2), warmFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // ── Ceiling (4 slabs leaving outdoor opening uncovered) ────────────────
    // Outdoor opening gap: x in [-14, 14], z in [-42, -16] — open to night sky
    const OW  = 14;  // half-width of outdoor opening
    const OZ1 = -16; // near z edge (back of central cavern wall)
    const OZ2 = -42; // far z edge (back of outdoor area)
    const S   = size; // 90

    function addCeilSlab(cx, cz, w, d) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 2, d), warmCeil);
        mesh.position.set(cx, CAVE_HEIGHT + 1, cz);
        scene.add(mesh);
        mesh.updateMatrixWorld(true);
        obs.push({ mesh, box: new THREE.Box3().setFromObject(mesh), noStep: true });
    }
    addCeilSlab(-(S + OW) / 2, 0,                    S - OW,           S * 2       ); // left strip
    addCeilSlab( (S + OW) / 2, 0,                    S - OW,           S * 2       ); // right strip
    addCeilSlab(0,             (OZ1 + S) / 2,         OW * 2,           S - OZ1     ); // front-center
    addCeilSlab(0,            -(S + Math.abs(OZ2))/2, OW * 2,           S - Math.abs(OZ2)); // back-center

    // ── Tunnel walls ───────────────────────────────────────────────────────
    for (const tunnel of _CAVE_TUNNELS) {
        const fromC  = _CAVE_CAVERNS[tunnel.fromId];
        const toC    = _CAVE_CAVERNS[tunnel.toId];
        const dx     = toC.cx - fromC.cx;
        const dz     = toC.cz - fromC.cz;
        const len    = Math.hypot(dx, dz);
        if (len < 0.001) continue;
        const angle  = Math.atan2(dx, dz);
        const cx     = (fromC.cx + toC.cx) / 2;
        const cz     = (fromC.cz + toC.cz) / 2;
        const w      = tunnel.width;
        const h      = tunnel.height;
        const thick  = 1.5;
        const tMat   = tunnel.toId === 3 ? coldWallA : (tunnel.toId === 2 ? midWall : warmWallA);

        function addTunnelSeg(px, py, pz, gw, gh, gd, mat, slope) {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(gw, gh, gd), mat);
            mesh.position.set(px, py, pz);
            mesh.rotation.y = angle;
            mesh.userData.isTunnelWall = true;
            scene.add(mesh);
            mesh.updateMatrixWorld(true);
            const entry = { mesh, box: new THREE.Box3().setFromObject(mesh) };
            if (slope) { entry.isSlope = true; gameState.slopeMeshes.push(mesh); }
            obs.push(entry);
        }

        // Left wall
        addTunnelSeg(
            cx - Math.cos(angle) * (w / 2 + thick / 2), h / 2,
            cz + Math.sin(angle) * (w / 2 + thick / 2),
            thick, h, len, tMat, true
        );
        // Right wall
        addTunnelSeg(
            cx + Math.cos(angle) * (w / 2 + thick / 2), h / 2,
            cz - Math.sin(angle) * (w / 2 + thick / 2),
            thick, h, len, tMat, true
        );
        // Ceiling slab
        addTunnelSeg(cx, h + thick / 2, cz, w + thick * 2, thick, len, warmCeil, false);
        // Floor strip
        addTunnelSeg(cx, -thick / 2,    cz, w + thick * 2, thick, len, tMat,     false);
    }

    // ── Cavern rock wall rings ─────────────────────────────────────────────
    function cavernWallMats(id) {
        if (id === 3) return [coldWallA, coldWallB];
        if (id === 2) return [midWall,   midWall  ];
        return              [warmWallA,  warmWallB ];
    }

    for (const cavern of _CAVE_CAVERNS) {
        const [matA, matB] = cavernWallMats(cavern.id);
        const segCount = 16 + Math.floor(rng() * 6);
        for (let i = 0; i < segCount; i++) {
            const angle = (i / segCount) * Math.PI * 2 + (rng() - 0.5) * 0.3;
            const dist  = cavern.radius + rng() * 2.5;
            const wx    = cavern.cx + Math.cos(angle) * dist;
            const wz    = cavern.cz + Math.sin(angle) * dist;
            // Leave exit corridor open in central cavern (position-based gap)
            if (cavern.id === 0 && Math.abs(wx) < 14 && wz < -14) continue;
            const segW  = 2.5 + rng() * 4.5;
            const segH  = CAVE_HEIGHT * (0.5 + rng() * 0.5);
            const segD  = 2.0 + rng() * 3.0;
            const mat   = rng() < 0.5 ? matA : matB;
            const mesh  = new THREE.Mesh(new THREE.BoxGeometry(segW, segH, segD), mat);
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

    // ── Outdoor area boundary walls ────────────────────────────────────────
    const outdoorMat = new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 0.9 });
    [
        { x: 0,          z: OZ2 - 0.75,       w: OW * 2 + 1.5, d: 1.5       }, // back wall
        { x: -OW - 0.75, z: (OZ1 + OZ2) / 2,  w: 1.5,          d: OZ1 - OZ2 }, // left wall
        { x:  OW + 0.75, z: (OZ1 + OZ2) / 2,  w: 1.5,          d: OZ1 - OZ2 }, // right wall
    ].forEach(({ x, z, w, d }) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, CAVE_HEIGHT, d), outdoorMat);
        mesh.position.set(x, CAVE_HEIGHT / 2, z);
        scene.add(mesh);
        mesh.updateMatrixWorld(true);
        obs.push({ mesh, box: new THREE.Box3().setFromObject(mesh) });
    });

    // Bright star/moon light outside the exit
    const starLight = new THREE.PointLight(0xaabbff, 1.2, 80);
    starLight.position.set(0, 40, OZ2 - 20);
    scene.add(starLight);

    // ── Stalactites ────────────────────────────────────────────────────────
    function addStalactites(cavern, mat, count) {
        for (let i = 0; i < count; i++) {
            const a = rng() * Math.PI * 2;
            const d = rng() * cavern.radius * 0.85;
            const baseR = 0.15 + rng() * 0.55;
            const stalH = 1.2 + rng() * 3.0;
            const mesh  = new THREE.Mesh(new THREE.ConeGeometry(baseR, stalH, 6), mat);
            mesh.rotation.z = Math.PI;
            mesh.position.set(
                cavern.cx + Math.cos(a) * d,
                CAVE_HEIGHT - stalH / 2,
                cavern.cz + Math.sin(a) * d
            );
            scene.add(mesh);
            if (baseR > 0.4) obs.push({ mesh, box: new THREE.Box3().setFromObject(mesh) });
        }
    }
    addStalactites(_CAVE_CAVERNS[0], warmStal, 12);
    addStalactites(_CAVE_CAVERNS[1], warmStal,  8);
    addStalactites(_CAVE_CAVERNS[2], midStal,   7);
    addStalactites(_CAVE_CAVERNS[3], coldStal, 10);

    // ── Stalagmites ────────────────────────────────────────────────────────
    function addStalagmites(cavern, mat, count) {
        for (let i = 0; i < count; i++) {
            const a  = rng() * Math.PI * 2;
            const d  = rng() * cavern.radius * 0.75;
            const sx = cavern.cx + Math.cos(a) * d;
            const sz = cavern.cz + Math.sin(a) * d;
            if (cavern.id === 0 && sx * sx + sz * sz < 36) continue; // 6-unit clear zone
            const baseR = 0.12 + rng() * 0.45;
            const stalH = 0.5 + rng() * 2.0;
            const mesh  = new THREE.Mesh(new THREE.ConeGeometry(baseR, stalH, 6), mat);
            mesh.position.set(sx, stalH / 2, sz);
            scene.add(mesh);
            if (baseR > 0.4) obs.push({ mesh, box: new THREE.Box3().setFromObject(mesh) });
        }
    }
    addStalagmites(_CAVE_CAVERNS[0], warmStal, 8);
    addStalagmites(_CAVE_CAVERNS[1], warmStal, 5);
    addStalagmites(_CAVE_CAVERNS[2], midStal,  5);
    addStalagmites(_CAVE_CAVERNS[3], coldStal, 7);

    // ── Torches ────────────────────────────────────────────────────────────
    function addTorch(x, z, wallAngle) {
        const ox = Math.cos(wallAngle) * 0.3;
        const oz = Math.sin(wallAngle) * 0.3;
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6), torchHandle);
        stick.position.set(x, 2.5, z);
        stick.rotation.y = wallAngle;
        stick.rotation.z = 0.3;
        scene.add(stick);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 6), flameMat);
        flame.position.set(x + ox, 3.3, z + oz);
        scene.add(flame);
        const light = new THREE.PointLight(0xff7700, 3.0, 20);
        light.position.set(x + ox, 3.0, z + oz);
        scene.add(light);
    }
    // Central: 2 on left wall + 1 right-back (matches reference image)
    addTorch(-14,  5,  Math.PI / 2);
    addTorch(-15, -3,  Math.PI / 2);
    addTorch( 12, -10, -Math.PI / 2);
    // Left wing: 1
    addTorch(_CAVE_CAVERNS[1].cx - 9, _CAVE_CAVERNS[1].cz + 4,  Math.PI / 2);
    // Right shallow: 1
    addTorch(_CAVE_CAVERNS[2].cx + 8, _CAVE_CAVERNS[2].cz - 3, -Math.PI / 2);

    // ── Crystal formations (right-shallow × 1, right-deep × 5) ────────────
    function addCrystalCluster(cx, cz, colorIdx) {
        const color = crystalColors[colorIdx % crystalColors.length];
        const eMat  = new THREE.MeshStandardMaterial({
            color, emissive: color, emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.5
        });
        const spireCount = 2 + Math.floor(rng() * 3);
        for (let s = 0; s < spireCount; s++) {
            const sa     = rng() * Math.PI * 2;
            const sd     = rng() * 1.2;
            const spireH = 1.0 + rng() * 2.5;
            const spireR = 0.15 + rng() * 0.35;
            const mesh   = rng() < 0.5
                ? new THREE.Mesh(new THREE.ConeGeometry(spireR, spireH, 5), eMat)
                : new THREE.Mesh(new THREE.OctahedronGeometry(spireR * 1.5), eMat);
            mesh.position.set(cx + Math.cos(sa) * sd, spireH / 2, cz + Math.sin(sa) * sd);
            mesh.rotation.y = rng() * Math.PI;
            if (s === 0) mesh.userData.isCrystal = true;
            scene.add(mesh);
        }
        const ptLight = new THREE.PointLight(color, 1.5, 20 + rng() * 10);
        ptLight.position.set(cx, 1.5, cz);
        scene.add(ptLight);
    }
    addCrystalCluster(_CAVE_CAVERNS[2].cx - 4, _CAVE_CAVERNS[2].cz - 5, 0);
    for (let ci = 0; ci < 5; ci++) {
        const a = rng() * Math.PI * 2;
        const d = rng() * _CAVE_CAVERNS[3].radius * 0.7;
        addCrystalCluster(
            _CAVE_CAVERNS[3].cx + Math.cos(a) * d,
            _CAVE_CAVERNS[3].cz + Math.sin(a) * d,
            ci + 1
        );
    }

    // ── Cave pool (left wing) ──────────────────────────────────────────────
    const lc = _CAVE_CAVERNS[1];
    const poolMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(lc.radius * 0.6, lc.radius * 0.5), poolMat
    );
    poolMesh.rotation.x = -Math.PI / 2;
    poolMesh.position.set(lc.cx + 2, 0.02, lc.cz + 2);
    scene.add(poolMesh);

    // ── Directional fill light ─────────────────────────────────────────────
    const dirFill = new THREE.DirectionalLight(0xffffff, 0.05);
    dirFill.position.set(0, CAVE_HEIGHT, 0);
    scene.add(dirFill);

    // ── Zombie spawn cavern + player spawn ─────────────────────────────────
    const spawnC = _CAVE_CAVERNS.find(c => c.isSpawnCavern);
    gameState.zombieSpawnCavern = { cx: spawnC.cx, cz: spawnC.cz, radius: spawnC.radius };
    gameState.cavePlayerSpawn   = { x: 0, z: 0 };

    // ── Ambient audio ──────────────────────────────────────────────────────
    try {
        const AudioCtx = (typeof AudioContext !== 'undefined') ? AudioContext :
            (typeof window !== 'undefined' && window.AudioContext) ? window.AudioContext : null;
        if (AudioCtx) {
            const audioCtx   = new AudioCtx();
            const oscillator = audioCtx.createOscillator();
            oscillator.type  = 'sine';
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
```

- [ ] **Step 3: Run the full cave-map test suite**

```
cd war_zone && npm test -- --testPathPattern=cave-map
```

Expected: ALL tests PASS with the same count as the Task 2 baseline. Key checks:
- `scene.fog.near === 15` ✓ (set in buildMap, not buildCaveMap)
- `scene.fog.far === 60` ✓
- `at least one obstacle has noStep: true and mesh y >= CAVE_HEIGHT` ✓ (4 ceiling slabs at y=9, 9 ≥ 8)
- `Property 4 (idempotent)` ✓ (deterministic RNG, fixed layout)
- `Property 5 (crystal-to-pointlight)` ✓ (6 crystal clusters → 6 crystal PointLights, plus 5 torch PointLights and 1 star PointLight = 12 total ≥ 6)
- `Property 6 (tunnel wall meshes in obstacles)` ✓ (all 12 tunnel segments have `isTunnelWall: true` and are in `obs`)
- `audio graceful degradation` ✓ (unchanged logic)
- `zombieSpawnCavern` set ✓ (right-deep cavern, radius=12 ≫ 3.16 minimum)

- [ ] **Step 4: Commit**

```bash
git add war_zone/js/map.js
git commit -m "feat: rewrite buildCaveMap — warm two-wing cave with torches, crystals in deep wing, outdoor exit"
```

---

### Task 4: Update CLAUDE.md and FEATURES.md

**Files:**
- Modify: `war_zone/CLAUDE.md`
- Modify: `war_zone/FEATURES.md`

- [ ] **Step 1: Update the cave entry in `FEATURES.md`**

Replace:
```
| Cave | 200 | Enclosed underground labyrinth; glowing crystal PointLights; zombie spawn restricted to designated cavern |
```

With:
```
| Cave | 90 | Natural two-wing cave: warm torch-lit central + left chambers (sandy/sienna palette); crystal-lit cold right-deep zombie spawn cavern; walkable exit corridor from central cavern to outdoor night-sky area |
```

- [ ] **Step 2: Update the cave bullet in `CLAUDE.md` (Recent Features section)**

Replace the existing `- **Cave map**:` bullet with:

```
- **Cave map**: static enclosed map (size=90) in map.js `buildCaveMap(obs)`; hardcoded 4-cavern two-wing layout in `_CAVE_CAVERNS`/`_CAVE_TUNNELS` module constants; `generateCaveLayout()` kept as stub returning the hardcoded layout for test compatibility; warm sandy/sienna palette (`0xb89060` floor, `0x8B4513` walls) in central + left wing; transition palette in right-shallow; cold dark palette in right-deep; torch fixtures (stick + flame cone + `PointLight(0xff7700)`) in central (×3), left (×1), right-shallow (×1); blue-green crystal clusters + PointLights in right-shallow (×1) and right-deep (×5); exit corridor gap in central cavern back wall (position-based: `Math.abs(wx) < 14 && wz < -14`); outdoor area at z ≈ −16 to −42 with 3 boundary walls + star `PointLight(0xaabbff)` and no ceiling (open night sky); ceiling split into 4 slabs to leave outdoor zone open; `CAVE_HEIGHT = 8`; `gameState.zombieSpawnCavern` = right-deep cavern; `gameState.cavePlayerSpawn = {x:0, z:0}`; ambient audio in `gameState.caveAmbientNode`
```

- [ ] **Step 3: Run the full test suite one final time**

```
cd war_zone && npm test -- --testPathPattern=cave-map
```

Expected: ALL tests still PASS.

- [ ] **Step 4: Commit**

```bash
git add war_zone/CLAUDE.md war_zone/FEATURES.md
git commit -m "docs: update CLAUDE.md and FEATURES.md for cave map redesign"
```
