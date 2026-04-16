# Design Document: Cave Map

## Overview

The cave map is a fully enclosed, medium-sized underground environment (size 200) added to the WarZone 3D shooter. It is built as a static map (no chunk streaming) consisting of a fixed set of cavern chambers connected by narrow tunnels. The layout is generated deterministically from a seeded RNG so every session produces the same map.

The design integrates with the existing architecture without modifying any shared interfaces:

- `data.js` — adds the `'cave'` entry to `MAPS`
- `map.js` — adds `buildCaveMap(obs)` and a branch in `buildMap('cave')`
- `state.js` — adds `zombieSpawnCavern` and `caveAmbientNode` fields to `gameState`
- `entities.js` — adds a branch in `spawnZombie` for cave-map zombie mode

No changes are required to `engine.js`, `main.js`, `combat.js`, `ui.js`, or `audio.js`.

---

## Architecture

```
buildMap('cave')
  │
  ├─ clears scene + streaming state (existing pattern)
  ├─ sets scene.fog (near=15, far=60)
  ├─ sets scene.background (0x050505)
  ├─ sets gameState.dayNightActive = false
  │
  ├─ buildCaveMap(obs)
  │    ├─ generateCaveLayout(rng)  → { caverns[], tunnels[] }
  │    ├─ buildFloorAndCeiling(caverns, tunnels)
  │    ├─ buildTunnelWalls(tunnels, obs)
  │    ├─ buildCavernDetails(caverns, obs)
  │    │    ├─ stalactites / stalagmites
  │    │    ├─ crystal formations + PointLights
  │    │    └─ cave pool
  │    ├─ buildLighting()
  │    └─ exposeSpawnCavern(caverns)  → gameState.zombieSpawnCavern
  │
  ├─ setWallBounds([...])
  └─ setObstacles(obs)

spawnZombie (entities.js)
  └─ if currentMap === 'cave' && mode === 'zombie'
       → sample position within zombieSpawnCavern bounds
```

The cave map is **static** — all geometry is built once at `buildMap` time and never streamed. This matches the warehouse and fortress patterns and is appropriate for a size-200 enclosed map.

---

## Components and Interfaces

### 1. `MAPS['cave']` entry (data.js)

```js
cave: {
  name: 'Cave',
  description: 'A dripping underground labyrinth. Tight tunnels, glowing crystals, and nowhere to run.',
  size: 200,
  color: 0x3a3a3a,        // dark stone floor
  wallColor: 0x252525,    // near-black rock walls
  ambientLight: 0.08
}
```

### 2. `generateCaveLayout(rng)` (map.js)

Returns a plain data structure describing the logical layout. No Three.js objects are created here — this is pure data so it can be tested independently.

```js
// Cavern descriptor
{
  id: number,           // 0-based index
  cx: number,           // world-space center X
  cz: number,           // world-space center Z
  radius: number,       // approximate circular radius (12–22 units)
  isSpawnCavern: bool   // true for exactly one cavern
}

// Tunnel descriptor
{
  fromId: number,       // cavern id
  toId: number,         // cavern id (fromId !== toId)
  width: number,        // >= 4 units
  height: number,       // >= 5 units
  // derived geometry: start/end points computed from cavern centers
}
```

**Layout algorithm:**

1. Place 5 caverns using the seeded RNG (minimum 4 guaranteed). Cavern centers are distributed across the map with a minimum separation of `radius_a + radius_b + 8` units to prevent overlap.
2. Build a minimum spanning tree over the cavern graph (using Euclidean distance as edge weight) to guarantee full connectivity with the minimum number of tunnels.
3. Add 1–2 extra tunnels (chosen by RNG) to create loops and avoid a purely linear layout.
4. Designate the cavern with the largest radius as `Zombie_Spawn_Cavern` (deterministic given the seeded RNG).

The MST approach guarantees:
- All caverns are reachable from any other cavern (connectivity).
- No tunnel passes through a third cavern (tunnels connect only their two endpoints).

### 3. `buildCaveMap(obs)` (map.js)

Orchestrates geometry construction. Calls `generateCaveLayout`, then builds all meshes.

**Floor:** A single large `PlaneGeometry(size*2, size*2)` at y=0, using `map.color`.

**Ceiling:** A `BoxGeometry(size*2, 2, size*2)` slab at y=`CAVE_HEIGHT + 1`, with `noStep: true` so the floor-snap raycaster never teleports the player on top. Registered as a collidable obstacle.

**Boundary walls:** Built by the existing `buildMap` boundary-wall loop (unchanged). `setWallBounds` is called with `±size` extents.

**Tunnel walls:** For each tunnel, four `BoxGeometry` wall slabs are placed (left wall, right wall, ceiling slab, floor strip) aligned along the tunnel axis. All four are registered as collidable obstacles.

**Cavern rock walls:** Each cavern is surrounded by a ring of irregular `BoxGeometry` rock segments placed at the cavern perimeter. Segments with width > 0.8 are registered as collidable obstacles.

**Stalactites:** `ConeGeometry` meshes hanging from the ceiling (y-flipped). Placed in clusters within cavern areas. Base radius > 0.4 units → registered as collidable.

**Stalagmites:** `ConeGeometry` meshes rising from the floor. Same collision rule.

**Crystal formations:** `ConeGeometry` or `OctahedronGeometry` clusters with an emissive material. Each cluster gets a `THREE.PointLight` (color in blue-green spectrum, range 20–30 units). At least 6 clusters distributed across all caverns.

**Cave pool:** A `PlaneGeometry` disc with a semi-transparent blue-grey material placed at floor level in one cavern. Purely decorative — no physics change.

### 4. `buildLighting()` (inside buildCaveMap)

- `AmbientLight` with intensity `map.ambientLight` (0.08) — set by the existing `buildMap` ambient light setup.
- One `DirectionalLight` with intensity 0.05, positioned overhead, to provide minimal fill without overriding the cave atmosphere.
- Per-crystal `PointLight` instances (see above).
- `gameState.dayNightActive` is left at its default `false` — no day/night cycle.

### 5. `gameState` additions (state.js)

```js
// Added to the gameState object literal:
zombieSpawnCavern: null,  // { cx, cz, radius } — set by buildCaveMap, read by spawnZombie
caveAmbientNode: null,    // AudioNode reference for cave drip/ambient sound; null if Web Audio unavailable
```

`zombieSpawnCavern` is reset to `null` at the top of `buildMap` alongside the other map-specific state resets.

### 6. `spawnZombie` modification (entities.js)

A new branch is added before the existing generic spawn logic:

```js
} else if (gameState.currentMap === 'cave' && gameState.mode === 'zombie' && gameState.zombieSpawnCavern) {
    const sc = gameState.zombieSpawnCavern;
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnDist = Math.random() * (sc.radius - 1.0);  // keep 1 unit from cavern edge
    spawnX = sc.cx + Math.cos(spawnAngle) * spawnDist;
    spawnZ = sc.cz + Math.sin(spawnAngle) * spawnDist;
    // Clamp to 130-unit streaming constraint
    const distFromOrigin = Math.hypot(spawnX, spawnZ);
    if (distFromOrigin > 130) {
        const scale = 130 / distFromOrigin;
        spawnX *= scale;
        spawnZ *= scale;
    }
}
```

---

## Data Models

### Cave Layout (runtime, not persisted)

```
CaveLayout {
  caverns: Cavern[]     // length >= 3, exactly one has isSpawnCavern = true
  tunnels: Tunnel[]     // MST edges + optional extra edges
}

Cavern {
  id:             int       // 0-based
  cx:             float     // world X center
  cz:             float     // world Z center
  radius:         float     // 12–22 units
  isSpawnCavern:  bool
}

Tunnel {
  fromId:   int     // cavern index
  toId:     int     // cavern index, fromId !== toId
  width:    float   // >= 4.0 units
  height:   float   // >= 5.0 units
}
```

### gameState additions

```
gameState.zombieSpawnCavern: null | { cx: float, cz: float, radius: float }
gameState.caveAmbientNode:   null | AudioNode
```

### Obstacle registration

All collidable cave geometry follows the existing obstacle format:

```js
{ mesh: THREE.Mesh, box: THREE.Box3() }
```

The ceiling slab additionally carries `{ noStep: true }` to prevent floor-snap from placing the player on top of it.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Cave Graph Connectivity

*For any* cave layout produced by `generateCaveLayout`, every cavern must be reachable from every other cavern by traversing tunnels. That is, the undirected graph where caverns are nodes and tunnels are edges must be connected.

**Validates: Requirements 2.3**

---

### Property 2: Tunnel Structural Integrity

*For any* tunnel in the cave layout, the tunnel must connect exactly two distinct caverns: `tunnel.fromId !== tunnel.toId`, and both IDs must be valid indices into the caverns array.

**Validates: Requirements 2.4**

---

### Property 3: Deterministic Layout

*For any* call to `generateCaveLayout` with the same seed, the resulting cavern positions, radii, and tunnel connections must be identical. Two independent calls with the same seed must produce structurally equivalent layouts.

**Validates: Requirements 2.9, 6.4**

---

### Property 4: Idempotent Map Rebuild

*For any* prior game state, calling `buildMap('cave')` twice must result in the same number of obstacles as calling it once. The second call must not accumulate duplicate geometry from the first call.

**Validates: Requirements 2.10**

---

### Property 5: Crystal-to-PointLight Pairing

*For any* cave map build, the number of `THREE.PointLight` instances added to the scene must be greater than or equal to the number of crystal formation clusters placed. Every crystal cluster must have at least one corresponding light source.

**Validates: Requirements 3.3**

---

### Property 6: Collidable Obstacle Registration

*For any* tunnel wall segment constructed by `buildTunnelWalls`, and *for any* stalactite or stalagmite formation with base width greater than 0.8 units, the corresponding mesh must appear in the `obstacles` array with a valid `Box3` bounding box.

**Validates: Requirements 4.1, 4.2**

---

### Property 7: Tunnel Dimension Invariants

*For any* tunnel in the cave layout, the tunnel width must be at least 4 units and the tunnel height must be at least 5 units. These constraints must hold regardless of which caverns the tunnel connects or how many tunnels exist.

**Validates: Requirements 4.4, 4.5**

---

### Property 8: Zombie Spawn Within Cavern Bounds

*For any* zombie spawned in Zombie Apocalypse mode on the cave map, the spawn position must lie within the `zombieSpawnCavern` radius. That is, `hypot(spawnX - sc.cx, spawnZ - sc.cz) <= sc.radius` for every generated spawn position.

**Validates: Requirements 6.2, 7.1**

---

### Property 9: Zombie Spawn Within Streaming Constraint

*For any* zombie spawned on the cave map, the spawn position must be within 130 units of the world origin. That is, `hypot(spawnX, spawnZ) <= 130` for every generated spawn position, ensuring spawns never appear in unloaded terrain.

**Validates: Requirements 6.5**

---

## Error Handling

| Scenario | Handling |
|---|---|
| Web Audio API unavailable | `try/catch` around ambient audio creation; `gameState.caveAmbientNode` remains `null`; map loads normally |
| Cavern placement fails to find non-overlapping position after N attempts | Fall back to a fixed fallback grid of cavern positions (still seeded, still deterministic) |
| Zombie spawn cavern not yet set when `spawnZombie` is called | Guard: `if (gameState.zombieSpawnCavern)` — falls through to generic spawn logic |
| `buildMap('cave')` called while a previous cave map is active | Existing `while (scene.children.length) scene.remove(...)` clears all prior geometry; `zombieSpawnCavern` is reset to `null` before `buildCaveMap` runs |

---

## Testing Strategy

### Unit Tests

Unit tests cover specific examples and edge cases using the existing Jest setup in `war_zone/`.

- **Data entry tests**: Assert all required fields on `MAPS['cave']` (name, size, color range, ambientLight, description).
- **Layout data tests**: Call `generateCaveLayout(mulberry32(seed))` directly and assert: cavern count >= 3, exactly one `isSpawnCavern`, all tunnel IDs valid, no self-referencing tunnels.
- **Fog and background tests**: After `buildMap('cave')`, assert `scene.fog.near === 15`, `scene.fog.far === 60`, `scene.background` is near-black.
- **Ceiling test**: After `buildMap('cave')`, assert at least one obstacle has `noStep: true` and its mesh is positioned at `y >= CAVE_HEIGHT`.
- **setWallBounds test**: After `buildMap('cave')`, assert `wallBounds` contains entries for both x and z axes with `±200` extents.
- **gameState fields test**: After `buildMap('cave')`, assert `gameState.zombieSpawnCavern` is non-null with `cx`, `cz`, `radius` fields; assert `gameState.dayNightActive === false`.
- **Spawn cavern size test**: Assert `zombieSpawnCavern.radius` is large enough to fit 10 non-overlapping circles of radius 0.5 (i.e., `radius >= sqrt(10) * 0.5 * packingFactor`).
- **Audio graceful degradation test**: Mock `AudioContext` to throw; assert `buildMap('cave')` completes without throwing and `gameState.caveAmbientNode === null`.

### Property-Based Tests

Property-based tests use [fast-check](https://github.com/dubzzz/fast-check) (already available in the JS ecosystem) with a minimum of 100 iterations per property.

Each test is tagged with a comment referencing the design property:
```js
// Feature: cave-map, Property N: <property text>
```

- **Property 1 — Graph Connectivity**: Generate random seeds, call `generateCaveLayout`, run BFS from cavern 0, assert all cavern IDs are visited.
- **Property 2 — Tunnel Structural Integrity**: Generate random seeds, call `generateCaveLayout`, for each tunnel assert `fromId !== toId` and both are valid indices.
- **Property 3 — Deterministic Layout**: Generate random seeds, call `generateCaveLayout` twice with the same seed, assert cavern positions and tunnel connections are identical.
- **Property 4 — Idempotent Rebuild**: Call `buildMap('cave')` twice (with scene/state reset between), assert `obstacles.length` is the same both times.
- **Property 5 — Crystal-to-PointLight Pairing**: After `buildMap('cave')`, count crystal formation meshes and PointLight instances in the scene; assert `pointLightCount >= crystalCount`.
- **Property 6 — Collidable Obstacle Registration**: After `buildMap('cave')`, collect all tunnel wall meshes and large formation meshes; assert each appears in `obstacles` with a valid `Box3`.
- **Property 7 — Tunnel Dimension Invariants**: Generate random seeds, call `generateCaveLayout`, for each tunnel assert `width >= 4` and `height >= 5`.
- **Property 8 — Zombie Spawn Within Cavern Bounds**: Generate many random spawn calls via `spawnZombie` on cave map in zombie mode; assert each spawn position satisfies `hypot(x - sc.cx, z - sc.cz) <= sc.radius`.
- **Property 9 — Zombie Spawn Within Streaming Constraint**: Same setup as Property 8; assert `hypot(spawnX, spawnZ) <= 130` for every spawn.

### Integration Tests

- **Rescue Mission placement**: Start rescue mode on cave map; assert hostage and extraction zone are placed without throwing.
- **PvP Arena placement**: Start PvP mode on cave map; assert PvP enemy spawns without throwing.
- **Map selection**: Assert `MAPS['cave']` is accessible from the map selection grid (reads from `MAPS` object).
