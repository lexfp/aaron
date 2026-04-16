# Implementation Plan: Cave Map

## Overview

Add a fully enclosed, medium-sized underground cave map to WarZone. The implementation touches four source files (`data.js`, `map.js`, `state.js`, `entities.js`), adds tests in `war_zone/tests/`, and updates the two documentation files (`war_zone/FEATURES.md`, `CLAUDE.md`). All geometry is static (no chunk streaming), generated deterministically from a seeded RNG.

## Tasks

- [x] 1. Add cave entry to MAPS in data.js
  - Add `cave` key to the `MAPS` object in `war_zone/js/data.js` with the following fields:
    - `name: 'Cave'`
    - `description: 'A dripping underground labyrinth. Tight tunnels, glowing crystals, and nowhere to run.'`
    - `size: 200`
    - `color: 0x3a3a3a` (dark stone floor, within required range `0x2a2a2a`–`0x4a4a4a`)
    - `wallColor: 0x252525` (near-black rock walls, within required range `0x1a1a1a`–`0x3a3a3a`)
    - `ambientLight: 0.08`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 8.1, 8.3_

  - [x] 1.1 Write unit tests for the cave data entry
    - Assert `MAPS['cave']` exists with correct `name`, `size`, `ambientLight`
    - Assert `color` is in range `0x2a2a2a`–`0x4a4a4a`
    - Assert `wallColor` is in range `0x1a1a1a`–`0x3a3a3a`
    - Assert `description` is a non-empty string
    - Test file: `war_zone/tests/cave-map.test.js`
    - _Requirements: 1.1–1.7_

- [x] 2. Add gameState fields in state.js
  - Add `zombieSpawnCavern: null` to the `gameState` object literal in `war_zone/js/state.js`
  - Add `caveAmbientNode: null` to the `gameState` object literal in `war_zone/js/state.js`
  - _Requirements: 5.1, 6.1_

  - [x] 2.1 Write unit tests for gameState cave fields
    - Import `gameState` from `state.js` and assert both new fields exist and are `null` by default
    - Test file: `war_zone/tests/cave-map.test.js`
    - _Requirements: 5.1, 6.1_

- [x] 3. Implement generateCaveLayout(rng) in map.js
  - Add the `generateCaveLayout(rng)` function to `war_zone/js/map.js`
  - Place 5 caverns using the seeded RNG (minimum 4 guaranteed); enforce minimum separation of `radius_a + radius_b + 8` units between cavern centers; fall back to a fixed grid if placement fails after N attempts
  - Build a minimum spanning tree (Euclidean distance) over the 5 caverns to guarantee full connectivity
  - Add 1–2 extra tunnels chosen by RNG to create loops
  - Each tunnel: `width >= 4`, `height >= 5`, `fromId !== toId`
  - Designate the cavern with the largest radius as `isSpawnCavern: true` (exactly one)
  - Return `{ caverns: [...], tunnels: [...] }` — pure data, no Three.js objects
  - _Requirements: 2.2, 2.3, 2.4, 2.9, 4.4, 4.5, 6.1, 6.3, 6.4_

  - [x] 3.1 Write property test — Property 1: Graph Connectivity
    - **Property 1: Cave Graph Connectivity**
    - For random seeds, call `generateCaveLayout`, run BFS from cavern 0, assert all cavern IDs are visited
    - Tag: `// Feature: cave-map, Property 1: Cave Graph Connectivity`
    - Use `fast-check` with at least 100 iterations
    - Test file: `war_zone/tests/cave-map.test.js`
    - **Validates: Requirements 2.3**

  - [x] 3.2 Write property test — Property 2: Tunnel Structural Integrity
    - **Property 2: Tunnel Structural Integrity**
    - For random seeds, call `generateCaveLayout`, assert every tunnel has `fromId !== toId` and both IDs are valid cavern indices
    - Tag: `// Feature: cave-map, Property 2: Tunnel Structural Integrity`
    - Use `fast-check` with at least 100 iterations
    - Test file: `war_zone/tests/cave-map.test.js`
    - **Validates: Requirements 2.4**

  - [x] 3.3 Write property test — Property 3: Deterministic Layout
    - **Property 3: Deterministic Layout**
    - For random seeds, call `generateCaveLayout` twice with the same seed, assert cavern positions, radii, and tunnel connections are identical
    - Tag: `// Feature: cave-map, Property 3: Deterministic Layout`
    - Use `fast-check` with at least 100 iterations
    - Test file: `war_zone/tests/cave-map.test.js`
    - **Validates: Requirements 2.9, 6.4**

  - [x] 3.4 Write property test — Property 7: Tunnel Dimension Invariants
    - **Property 7: Tunnel Dimension Invariants**
    - For random seeds, call `generateCaveLayout`, assert every tunnel has `width >= 4` and `height >= 5`
    - Tag: `// Feature: cave-map, Property 7: Tunnel Dimension Invariants`
    - Use `fast-check` with at least 100 iterations
    - Test file: `war_zone/tests/cave-map.test.js`
    - **Validates: Requirements 4.4, 4.5**

  - [x] 3.5 Write unit tests for layout data
    - Call `generateCaveLayout(mulberry32(42))` and assert: cavern count >= 4, exactly one `isSpawnCavern`, all tunnel IDs valid, no self-referencing tunnels
    - Assert `zombieSpawnCavern.radius >= Math.sqrt(10) * 0.5 * 2` (fits 10 non-overlapping spawn circles)
    - Test file: `war_zone/tests/cave-map.test.js`
    - _Requirements: 2.2, 6.3_

- [x] 4. Implement buildCaveMap(obs) in map.js
  - Add `buildCaveMap(obs)` to `war_zone/js/map.js`; call `generateCaveLayout(rng)` internally
  - **Floor:** single `PlaneGeometry(size*2, size*2)` at y=0 using `map.color`
  - **Ceiling:** `BoxGeometry(size*2, 2, size*2)` slab at `y = CAVE_HEIGHT + 1`; set `noStep: true`; register as collidable obstacle
  - **Tunnel walls:** for each tunnel, place four `BoxGeometry` slabs (left wall, right wall, ceiling slab, floor strip) aligned along the tunnel axis; register all four as collidable obstacles
  - **Cavern rock walls:** ring of irregular `BoxGeometry` segments at each cavern perimeter; register segments with width > 0.8 as collidable obstacles
  - **Stalactites:** `ConeGeometry` meshes hanging from ceiling (y-flipped) in cavern areas; register those with base radius > 0.4 as collidable
  - **Stalagmites:** `ConeGeometry` meshes rising from floor in cavern areas; same collision rule
  - **Crystal formations:** at least 6 `ConeGeometry` or `OctahedronGeometry` clusters with emissive material; each cluster gets a `THREE.PointLight` (blue-green spectrum, range 20–30 units)
  - **Cave pool:** one `PlaneGeometry` disc with semi-transparent blue-grey material at floor level in one cavern; decorative only
  - **Lighting:** one `DirectionalLight` with intensity 0.05; ambient light handled by existing `buildMap` setup
  - **Expose spawn cavern:** set `gameState.zombieSpawnCavern = { cx, cz, radius }` from the `isSpawnCavern` cavern
  - **Ambient audio:** wrap `AudioContext` creation in `try/catch`; store node in `gameState.caveAmbientNode`; continue normally if unavailable
  - _Requirements: 2.1–2.9, 3.3, 3.4, 4.1, 4.2, 4.3, 5.1, 5.2, 6.1_

  - [x] 4.1 Write unit tests for fog, background, and ceiling
    - After `buildMap('cave')`, assert `scene.fog.near === 15` and `scene.fog.far === 60`
    - Assert `scene.background` equals `0x050505` or darker
    - Assert at least one obstacle has `noStep: true` and its mesh is positioned at `y >= CAVE_HEIGHT`
    - Test file: `war_zone/tests/cave-map.test.js`
    - _Requirements: 3.1, 3.2, 4.3_

  - [x] 4.2 Write property test — Property 4: Idempotent Map Rebuild
    - **Property 4: Idempotent Map Rebuild**
    - Call `buildMap('cave')` twice (resetting scene and state between calls), assert `obstacles.length` is the same both times
    - Tag: `// Feature: cave-map, Property 4: Idempotent Map Rebuild`
    - Use `fast-check` with at least 100 iterations
    - Test file: `war_zone/tests/cave-map.test.js`
    - **Validates: Requirements 2.10**

  - [x] 4.3 Write property test — Property 5: Crystal-to-PointLight Pairing
    - **Property 5: Crystal-to-PointLight Pairing**
    - After `buildMap('cave')`, count crystal formation meshes and `PointLight` instances in the scene; assert `pointLightCount >= crystalCount`
    - Tag: `// Feature: cave-map, Property 5: Crystal-to-PointLight Pairing`
    - Use `fast-check` with at least 100 iterations
    - Test file: `war_zone/tests/cave-map.test.js`
    - **Validates: Requirements 3.3**

  - [x] 4.4 Write property test — Property 6: Collidable Obstacle Registration
    - **Property 6: Collidable Obstacle Registration**
    - After `buildMap('cave')`, collect all tunnel wall meshes and large formation meshes; assert each appears in `obstacles` with a valid `Box3`
    - Tag: `// Feature: cave-map, Property 6: Collidable Obstacle Registration`
    - Use `fast-check` with at least 100 iterations
    - Test file: `war_zone/tests/cave-map.test.js`
    - **Validates: Requirements 4.1, 4.2**

  - [x] 4.5 Write unit test for audio graceful degradation
    - Mock `AudioContext` to throw; assert `buildMap('cave')` completes without throwing and `gameState.caveAmbientNode === null`
    - Test file: `war_zone/tests/cave-map.test.js`
    - _Requirements: 5.2_

- [x] 5. Wire buildCaveMap into buildMap in map.js
  - Add a `'cave'` branch in the `buildMap` function in `war_zone/js/map.js`
  - At the top of the branch: clear all scene objects and streaming state (matching the existing pattern for other maps)
  - Set `scene.fog = new THREE.Fog(0x050505, 15, 60)`
  - Set `scene.background = new THREE.Color(0x050505)`
  - Set `gameState.dayNightActive = false`
  - Reset `gameState.zombieSpawnCavern = null` before calling `buildCaveMap`
  - Call `buildCaveMap(obs)`
  - Call `setWallBounds` with `±size` extents (size = 200)
  - Call `setObstacles(obs)`
  - _Requirements: 2.1, 2.10, 3.1, 3.2, 3.5, 4.6, 8.2_

- [x] 6. Checkpoint — Ensure all tests pass
  - Run `npm test --prefix war_zone` and confirm all cave-map unit and property tests pass.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Add cave spawn branch in entities.js
  - In `spawnZombie` in `war_zone/js/entities.js`, add a new branch before the existing generic spawn logic:
    ```js
    } else if (gameState.currentMap === 'cave' && gameState.mode === 'zombie' && gameState.zombieSpawnCavern) {
        const sc = gameState.zombieSpawnCavern;
        const spawnAngle = Math.random() * Math.PI * 2;
        const spawnDist = Math.random() * (sc.radius - 1.0);
        spawnX = sc.cx + Math.cos(spawnAngle) * spawnDist;
        spawnZ = sc.cz + Math.sin(spawnAngle) * spawnDist;
        const distFromOrigin = Math.hypot(spawnX, spawnZ);
        if (distFromOrigin > 130) {
            const scale = 130 / distFromOrigin;
            spawnX *= scale;
            spawnZ *= scale;
        }
    }
    ```
  - _Requirements: 6.1, 6.2, 6.5, 7.1_

  - [x] 7.1 Write property test — Property 8: Zombie Spawn Within Cavern Bounds
    - **Property 8: Zombie Spawn Within Cavern Bounds**
    - Generate many random spawn calls via the cave spawn logic; assert each position satisfies `Math.hypot(x - sc.cx, z - sc.cz) <= sc.radius`
    - Tag: `// Feature: cave-map, Property 8: Zombie Spawn Within Cavern Bounds`
    - Use `fast-check` with at least 100 iterations
    - Test file: `war_zone/tests/cave-map.test.js`
    - **Validates: Requirements 6.2, 7.1**

  - [x] 7.2 Write property test — Property 9: Zombie Spawn Within Streaming Constraint
    - **Property 9: Zombie Spawn Within Streaming Constraint**
    - Same setup as Property 8; assert `Math.hypot(spawnX, spawnZ) <= 130` for every generated spawn position
    - Tag: `// Feature: cave-map, Property 9: Zombie Spawn Within Streaming Constraint`
    - Use `fast-check` with at least 100 iterations
    - Test file: `war_zone/tests/cave-map.test.js`
    - **Validates: Requirements 6.5**

  - [x] 7.3 Write unit test for spawn cavern size
    - Assert `zombieSpawnCavern.radius` is large enough to fit 10 non-overlapping circles of radius 0.5 (i.e., `radius >= Math.sqrt(10) * 0.5 * 2`)
    - Test file: `war_zone/tests/cave-map.test.js`
    - _Requirements: 6.3_

- [x] 8. Write integration tests
  - Add integration tests to `war_zone/tests/cave-map.test.js`

  - [x] 8.1 Rescue Mission placement test
    - Start rescue mode on cave map; assert hostage and extraction zone are placed without throwing
    - _Requirements: 7.2_

  - [x] 8.2 PvP Arena placement test
    - Start PvP mode on cave map; assert PvP enemy spawns without throwing
    - _Requirements: 7.3_

  - [x] 8.3 Map selection test
    - Assert `MAPS['cave']` is accessible and has the correct `name` field; assert it appears in the map selection grid data
    - _Requirements: 7.4, 8.1, 8.3_

- [x] 9. Checkpoint — Ensure all tests pass
  - Run `npm test --prefix war_zone` and confirm all tests (unit, property, integration) pass.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Update war_zone/FEATURES.md
  - Add a `Cave` row to the Maps table:
    ```
    | Cave | 200 | Enclosed underground labyrinth; glowing crystal PointLights; zombie spawn restricted to designated cavern |
    ```
  - Add a note under the Maps section describing the zombie spawn cavern mechanic: all zombies in Zombie Apocalypse mode spawn within a single designated cavern (`gameState.zombieSpawnCavern`), creating a clear threat origin point.
  - _Requirements: (documentation)_

- [x] 11. Update CLAUDE.md
  - Add a bullet point to the **Recent Features (war_zone)** section:
    ```
    - **Cave map**: static enclosed map (size=200) in map.js `buildCaveMap(obs)`; `generateCaveLayout(rng)` returns pure data (caverns + MST tunnels); crystal clusters each get a `THREE.PointLight` (blue-green, range 20–30); ceiling slab has `noStep:true`; `gameState.zombieSpawnCavern` holds `{cx,cz,radius}` of the largest cavern; zombie spawns clamped to 130-unit streaming constraint; ambient audio in `gameState.caveAmbientNode` with graceful degradation if Web Audio unavailable
    ```
  - _Requirements: (documentation)_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use `fast-check` (install with `npm install --save-dev fast-check --prefix war_zone` if not already present)
- Property tests validate universal correctness properties; unit tests validate specific examples and edge cases
- `generateCaveLayout(rng)` is pure data — no Three.js — making it directly testable in Node.js without mocks
- The cave map is static (no chunk streaming), matching the warehouse and fortress patterns
