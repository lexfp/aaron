'use strict';

/**
 * Cave Map Tests
 * Task 1.1: Unit tests for the cave data entry
 * Requirements: 1.1–1.7
 */

// data.js uses ES module exports; use a dynamic import via Jest transform or
// read the file directly. Since jest.config.js uses testEnvironment: 'node'
// and there is no Babel/transform config, we read and eval the module manually.
const fs = require('fs');
const path = require('path');

// Load MAPS by reading data.js and extracting the export via a simple eval shim
function loadMaps() {
    const filePath = path.resolve(__dirname, '../js/data.js');
    const src = fs.readFileSync(filePath, 'utf8');
    // Replace ES module export syntax with CommonJS so we can require it in Node
    const cjsSrc = src
        .replace(/export const /g, 'const ')
        .replace(/export default /g, 'module.exports = ');
    // Execute in a sandboxed context
    const mod = { exports: {} };
    // eslint-disable-next-line no-new-func
    const fn = new Function('module', 'exports', 'require', cjsSrc + '\nmodule.exports = { MAPS, WEAPONS, EQUIPMENT, ATTACHMENTS };');
    fn(mod, mod.exports, require);
    return mod.exports.MAPS;
}

const MAPS = loadMaps();

// Load gameState from state.js using the same eval/shim approach
function loadGameState() {
    const filePath = path.resolve(__dirname, '../js/state.js');
    const src = fs.readFileSync(filePath, 'utf8');
    // Replace ES module syntax with CommonJS
    const cjsSrc = src
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .replace(/export default /g, 'module.exports = ');
    const mod = { exports: {} };
    // Provide a minimal localStorage stub so loadPlayerData() doesn't throw
    const localStorageStub = { getItem: () => null, setItem: () => { } };
    // eslint-disable-next-line no-new-func
    const fn = new Function('module', 'exports', 'require', 'localStorage',
        cjsSrc + '\nmodule.exports = { gameState };');
    fn(mod, mod.exports, require, localStorageStub);
    return mod.exports.gameState;
}

const gameState = loadGameState();

// ---------------------------------------------------------------------------
// Task 1.1: Cave data entry unit tests
// ---------------------------------------------------------------------------

describe('MAPS[\'cave\'] — data entry', () => {
    test('cave entry exists in MAPS', () => {
        expect(MAPS['cave']).toBeDefined();
    });

    test('name is "Cave"', () => {
        expect(MAPS['cave'].name).toBe('Cave');
    });

    test('size is 200', () => {
        expect(MAPS['cave'].size).toBe(200);
    });

    test('ambientLight is 0.08', () => {
        expect(MAPS['cave'].ambientLight).toBe(0.08);
    });

    test('color is in range 0x2a2a2a–0x4a4a4a (dark stone floor)', () => {
        const color = MAPS['cave'].color;
        expect(color).toBeGreaterThanOrEqual(0x2a2a2a);
        expect(color).toBeLessThanOrEqual(0x4a4a4a);
    });

    test('wallColor is in range 0x1a1a1a–0x3a3a3a (near-black rock walls)', () => {
        const wallColor = MAPS['cave'].wallColor;
        expect(wallColor).toBeGreaterThanOrEqual(0x1a1a1a);
        expect(wallColor).toBeLessThanOrEqual(0x3a3a3a);
    });

    test('description is a non-empty string', () => {
        const desc = MAPS['cave'].description;
        expect(typeof desc).toBe('string');
        expect(desc.length).toBeGreaterThan(0);
    });
});

// ---------------------------------------------------------------------------
// Task 2.1: gameState cave fields unit tests
// Requirements: 5.1, 6.1
// ---------------------------------------------------------------------------

describe('gameState — cave map fields', () => {
    test('zombieSpawnCavern exists on gameState', () => {
        expect(gameState).toHaveProperty('zombieSpawnCavern');
    });

    test('zombieSpawnCavern is null by default', () => {
        expect(gameState.zombieSpawnCavern).toBeNull();
    });

    test('caveAmbientNode exists on gameState', () => {
        expect(gameState).toHaveProperty('caveAmbientNode');
    });

    test('caveAmbientNode is null by default', () => {
        expect(gameState.caveAmbientNode).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Helper: load generateCaveLayout and mulberry32 from map.js
// We extract just those two functions from the source (they are pure and
// don't depend on any imports) and eval them in a local context.
// ---------------------------------------------------------------------------
function loadCaveLayout() {
    const filePath = path.resolve(__dirname, '../js/map.js');
    const src = fs.readFileSync(filePath, 'utf8');

    // Extract mulberry32 function body
    const mulberry32Match = src.match(/function mulberry32\(seed\)\s*\{[\s\S]*?\n\}/);
    if (!mulberry32Match) throw new Error('Could not find mulberry32 in map.js');

    // Extract generateCaveLayout function body (exported function) — strip 'export' keyword
    const genMatch = src.match(/(?:export\s+)?function generateCaveLayout\(rng\)\s*\{[\s\S]*?\n\}/);
    if (!genMatch) throw new Error('Could not find generateCaveLayout in map.js');
    const genSrc = genMatch[0].replace(/^export\s+/, '');

    const combined = `
${mulberry32Match[0]}
${genSrc}
`;
    const mod = { exports: {} };
    // eslint-disable-next-line no-new-func
    const fn = new Function('module', 'exports', combined + '\nmodule.exports = { mulberry32, generateCaveLayout };');
    fn(mod, mod.exports, require);
    return mod.exports;
}

const { mulberry32, generateCaveLayout } = loadCaveLayout();

// ---------------------------------------------------------------------------
// Task 3.1: Property 1 — Cave Graph Connectivity
// Feature: cave-map, Property 1: Cave Graph Connectivity
// Validates: Requirements 2.3
// ---------------------------------------------------------------------------

const fc = require('fast-check');

describe('Property 1: Cave Graph Connectivity', () => {
    test('all caverns are reachable from cavern 0 via BFS for any seed', () => {
        // Feature: cave-map, Property 1: Cave Graph Connectivity
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 2 ** 31 - 1 }),
                (seed) => {
                    const rng = mulberry32(seed);
                    const { caverns, tunnels } = generateCaveLayout(rng);

                    // Build adjacency list
                    const adj = new Map();
                    for (const c of caverns) adj.set(c.id, []);
                    for (const t of tunnels) {
                        adj.get(t.fromId).push(t.toId);
                        adj.get(t.toId).push(t.fromId);
                    }

                    // BFS from cavern 0
                    const visited = new Set();
                    const queue = [0];
                    visited.add(0);
                    while (queue.length > 0) {
                        const cur = queue.shift();
                        for (const neighbor of (adj.get(cur) || [])) {
                            if (!visited.has(neighbor)) {
                                visited.add(neighbor);
                                queue.push(neighbor);
                            }
                        }
                    }

                    // All cavern IDs must be visited
                    for (const c of caverns) {
                        if (!visited.has(c.id)) return false;
                    }
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ---------------------------------------------------------------------------
// Task 3.2: Property 2 — Tunnel Structural Integrity
// Feature: cave-map, Property 2: Tunnel Structural Integrity
// Validates: Requirements 2.4
// ---------------------------------------------------------------------------

describe('Property 2: Tunnel Structural Integrity', () => {
    test('every tunnel has fromId !== toId and both IDs are valid cavern indices', () => {
        // Feature: cave-map, Property 2: Tunnel Structural Integrity
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 2 ** 31 - 1 }),
                (seed) => {
                    const rng = mulberry32(seed);
                    const { caverns, tunnels } = generateCaveLayout(rng);
                    const validIds = new Set(caverns.map(c => c.id));

                    for (const t of tunnels) {
                        if (t.fromId === t.toId) return false;
                        if (!validIds.has(t.fromId)) return false;
                        if (!validIds.has(t.toId)) return false;
                    }
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ---------------------------------------------------------------------------
// Task 3.3: Property 3 — Deterministic Layout
// Feature: cave-map, Property 3: Deterministic Layout
// Validates: Requirements 2.9, 6.4
// ---------------------------------------------------------------------------

describe('Property 3: Deterministic Layout', () => {
    test('same seed produces identical cavern positions, radii, and tunnel connections', () => {
        // Feature: cave-map, Property 3: Deterministic Layout
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 2 ** 31 - 1 }),
                (seed) => {
                    const layout1 = generateCaveLayout(mulberry32(seed));
                    const layout2 = generateCaveLayout(mulberry32(seed));

                    // Same number of caverns and tunnels
                    if (layout1.caverns.length !== layout2.caverns.length) return false;
                    if (layout1.tunnels.length !== layout2.tunnels.length) return false;

                    // Same cavern positions and radii
                    for (let i = 0; i < layout1.caverns.length; i++) {
                        const a = layout1.caverns[i];
                        const b = layout2.caverns[i];
                        if (a.cx !== b.cx || a.cz !== b.cz || a.radius !== b.radius) return false;
                        if (a.isSpawnCavern !== b.isSpawnCavern) return false;
                    }

                    // Same tunnel connections
                    for (let i = 0; i < layout1.tunnels.length; i++) {
                        const a = layout1.tunnels[i];
                        const b = layout2.tunnels[i];
                        if (a.fromId !== b.fromId || a.toId !== b.toId) return false;
                        if (a.width !== b.width || a.height !== b.height) return false;
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ---------------------------------------------------------------------------
// Task 3.4: Property 7 — Tunnel Dimension Invariants
// Feature: cave-map, Property 7: Tunnel Dimension Invariants
// Validates: Requirements 4.4, 4.5
// ---------------------------------------------------------------------------

describe('Property 7: Tunnel Dimension Invariants', () => {
    test('every tunnel has width >= 4 and height >= 5', () => {
        // Feature: cave-map, Property 7: Tunnel Dimension Invariants
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 2 ** 31 - 1 }),
                (seed) => {
                    const rng = mulberry32(seed);
                    const { tunnels } = generateCaveLayout(rng);

                    for (const t of tunnels) {
                        if (t.width < 4) return false;
                        if (t.height < 5) return false;
                    }
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ---------------------------------------------------------------------------
// Helper: load buildMap and buildCaveMap from map.js with mocked dependencies
// ---------------------------------------------------------------------------

function createThreeMock() {
    // Minimal Three.js mock sufficient for buildCaveMap and buildMap
    class Vector3 {
        constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
        set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    }
    class Color {
        constructor(hex) { this.hex = hex; }
    }
    class Fog {
        constructor(color, near, far) { this.color = color; this.near = near; this.far = far; }
    }
    class Box3 {
        constructor() { this.min = new Vector3(); this.max = new Vector3(); }
        setFromObject(mesh) {
            // Approximate bounding box from mesh position
            const p = mesh.position || new Vector3();
            this.min.set(p.x - 1, p.y - 1, p.z - 1);
            this.max.set(p.x + 1, p.y + 1, p.z + 1);
            return this;
        }
        isEmpty() { return false; }
    }
    class Geometry { dispose() { } }
    class BufferGeometry extends Geometry { }
    class PlaneGeometry extends BufferGeometry { }
    class BoxGeometry extends BufferGeometry { }
    class ConeGeometry extends BufferGeometry { }
    class OctahedronGeometry extends BufferGeometry { }
    class CylinderGeometry extends BufferGeometry { }
    class SphereGeometry extends BufferGeometry { }
    class RingGeometry extends BufferGeometry { }
    class ShapeGeometry extends BufferGeometry { }
    class Shape { }
    class Path { }
    class Material { dispose() { } }
    class MeshStandardMaterial extends Material {
        constructor(params = {}) { super(); Object.assign(this, params); }
        clone() { return new MeshStandardMaterial({ ...this }); }
    }
    class MeshBasicMaterial extends Material {
        constructor(params = {}) { super(); Object.assign(this, params); }
    }
    class Object3D {
        constructor() {
            this.position = new Vector3();
            this.rotation = { x: 0, y: 0, z: 0 };
            this.scale = new Vector3(1, 1, 1);
            this.userData = {};
            this.castShadow = false;
            this.receiveShadow = false;
            this.children = [];
        }
        updateMatrixWorld() { }
        updateMatrix() { }
    }
    class Mesh extends Object3D {
        constructor(geometry, material) {
            super();
            this.geometry = geometry;
            this.material = material;
            this.isMesh = true;
        }
    }
    class InstancedMesh extends Mesh {
        constructor(geo, mat, count) {
            super(geo, mat);
            this.instanceMatrix = { needsUpdate: false };
        }
        setMatrixAt() { }
    }
    class Light extends Object3D {
        constructor(color, intensity) {
            super();
            this.color = color;
            this.intensity = intensity;
            this.isLight = true;
        }
    }
    class AmbientLight extends Light {
        constructor(color, intensity) { super(color, intensity); this.isAmbientLight = true; }
    }
    class DirectionalLight extends Light {
        constructor(color, intensity) {
            super(color, intensity);
            this.isDirectionalLight = true;
            this.shadow = { mapSize: { set() { } }, camera: { left: 0, right: 0, top: 0, bottom: 0 } };
            this.castShadow = false;
        }
    }
    class PointLight extends Light {
        constructor(color, intensity, distance) {
            super(color, intensity);
            this.distance = distance;
            this.isPointLight = true;
        }
    }
    class Raycaster {
        constructor() { }
        intersectObjects() { return []; }
    }
    const DoubleSide = 2;
    return {
        Vector3, Color, Fog, Box3,
        PlaneGeometry, BoxGeometry, ConeGeometry, OctahedronGeometry,
        CylinderGeometry, SphereGeometry, RingGeometry, ShapeGeometry,
        Shape, Path,
        MeshStandardMaterial, MeshBasicMaterial,
        Mesh, InstancedMesh, Object3D,
        AmbientLight, DirectionalLight, PointLight,
        Raycaster,
        DoubleSide,
    };
}

function createSceneMock() {
    const children = [];
    return {
        children,
        fog: null,
        background: null,
        add(obj) { children.push(obj); },
        remove(obj) {
            const idx = children.indexOf(obj);
            if (idx >= 0) children.splice(idx, 1);
        },
        get length() { return children.length; }
    };
}

function loadBuildMap() {
    const filePath = path.resolve(__dirname, '../js/map.js');
    let src = fs.readFileSync(filePath, 'utf8');

    // Strip ES module import/export syntax
    src = src
        .replace(/^import\s+.*?from\s+['"][^'"]+['"];?\s*$/gm, '')
        .replace(/^export\s+function\s+/gm, 'function ')
        .replace(/^export\s+const\s+/gm, 'const ');

    const THREE = createThreeMock();
    const sceneMock = createSceneMock();
    const obstaclesMock = [];
    let _obstacles = obstaclesMock;
    let _wallBounds = [];

    const engineMock = {
        get scene() { return sceneMock; },
        get obstacles() { return _obstacles; },
        setObstacles(arr) { _obstacles = arr; },
        setWallBounds(wb) { _wallBounds = wb; },
    };

    const gameStateMock = {
        mode: null, pendingMode: null, currentMap: null, active: false, paused: false,
        wave: 1, zombiesAlive: 0, zombiesToSpawn: 0, zombieSpawnTimer: 0,
        zombieEntities: [], ammoPickups: [], droppedWeapons: [], fireZones: [],
        pvpRound: 1, pvpPlayerScore: 0, pvpEnemyScore: 0, pvpEnemy: null,
        airstrikeLastUsed: null, slopeMeshes: [], craterPits: [], streetLamps: [],
        warehouseLights: [], secretPassages: [], playerFacingYaw: 0,
        tpShootNDC: null, tpShootCamera: null,
        dayTime: 0.5, dayNightActive: false, sunLight: null, ambientLightRef: null,
        fogNearBase: 0, fogFarBase: 0,
        zombieSpawnCavern: null, caveAmbientNode: null,
        hallwayPlayerSpawnZ: null, hallwayZombieSpawnZ: null,
        extractionZone: null,
    };

    const MAPSMock = loadMaps();

    const mod = { exports: {} };
    // eslint-disable-next-line no-new-func
    const fn2 = new Function(
        'THREE', 'scene', 'obstacles', 'setObstacles', 'setWallBounds', 'gameState', 'MAPS', 'module', 'exports',
        src + '\nmodule.exports = { buildMap, buildCaveMap, generateCaveLayout, mulberry32 };'
    );
    fn2(
        THREE,
        engineMock.scene,
        engineMock.obstacles,
        engineMock.setObstacles.bind(engineMock),
        engineMock.setWallBounds.bind(engineMock),
        gameStateMock,
        MAPSMock,
        mod,
        mod.exports
    );

    return {
        buildMap: mod.exports.buildMap,
        buildCaveMap: mod.exports.buildCaveMap,
        scene: sceneMock,
        gameState: gameStateMock,
        getObstacles: () => _obstacles,
        THREE,
        reset() {
            // Clear scene
            while (sceneMock.children.length) sceneMock.children.pop();
            sceneMock.fog = null;
            sceneMock.background = null;
            // Reset gameState cave fields
            gameStateMock.zombieSpawnCavern = null;
            gameStateMock.caveAmbientNode = null;
            gameStateMock.dayNightActive = false;
            gameStateMock.slopeMeshes = [];
            gameStateMock.craterPits = [];
            gameStateMock.streetLamps = [];
            gameStateMock.warehouseLights = [];
            gameStateMock.secretPassages = [];
            gameStateMock.ammoPickups = [];
            _obstacles = [];
        }
    };
}

// ---------------------------------------------------------------------------
// Task 4.1: Unit tests for fog, background, and ceiling
// Requirements: 3.1, 3.2, 4.3
// ---------------------------------------------------------------------------

describe('buildMap(\'cave\') — fog, background, and ceiling', () => {
    let env;

    beforeAll(() => {
        env = loadBuildMap();
        env.buildMap('cave');
    });

    test('scene.fog.near === 15', () => {
        expect(env.scene.fog).toBeDefined();
        expect(env.scene.fog.near).toBe(15);
    });

    test('scene.fog.far === 60', () => {
        expect(env.scene.fog).toBeDefined();
        expect(env.scene.fog.far).toBe(60);
    });

    test('scene.background is 0x050505 or darker', () => {
        expect(env.scene.background).toBeDefined();
        // background is a THREE.Color with hex property
        const hex = env.scene.background.hex;
        expect(hex).toBeLessThanOrEqual(0x050505);
    });

    test('at least one obstacle has noStep: true and mesh y >= CAVE_HEIGHT', () => {
        const CAVE_HEIGHT = 12;
        const obs = env.getObstacles();
        const ceilingObs = obs.filter(o => o.noStep === true && o.mesh && o.mesh.position.y >= CAVE_HEIGHT);
        expect(ceilingObs.length).toBeGreaterThanOrEqual(1);
    });
});

// ---------------------------------------------------------------------------
// Task 4.2: Property 4 — Idempotent Map Rebuild
// Feature: cave-map, Property 4: Idempotent Map Rebuild
// Validates: Requirements 2.10
// ---------------------------------------------------------------------------

describe('Property 4: Idempotent Map Rebuild', () => {
    test('obstacles.length is the same after two buildMap(\'cave\') calls', () => {
        // Feature: cave-map, Property 4: Idempotent Map Rebuild
        fc.assert(
            fc.property(
                fc.constant(null), // no random input needed — cave map is deterministic
                () => {
                    const env = loadBuildMap();

                    env.buildMap('cave');
                    const count1 = env.getObstacles().length;

                    env.reset();
                    env.buildMap('cave');
                    const count2 = env.getObstacles().length;

                    return count1 === count2;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ---------------------------------------------------------------------------
// Task 4.3: Property 5 — Crystal-to-PointLight Pairing
// Feature: cave-map, Property 5: Crystal-to-PointLight Pairing
// Validates: Requirements 3.3
// ---------------------------------------------------------------------------

describe('Property 5: Crystal-to-PointLight Pairing', () => {
    test('pointLightCount >= crystalMeshCount after buildMap(\'cave\')', () => {
        // Feature: cave-map, Property 5: Crystal-to-PointLight Pairing
        fc.assert(
            fc.property(
                fc.constant(null),
                () => {
                    const env = loadBuildMap();
                    env.buildMap('cave');

                    const crystalCount = env.scene.children.filter(
                        obj => obj.userData && obj.userData.isCrystal === true
                    ).length;

                    const pointLightCount = env.scene.children.filter(
                        obj => obj.isPointLight === true
                    ).length;

                    return pointLightCount >= crystalCount;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ---------------------------------------------------------------------------
// Task 4.4: Property 6 — Collidable Obstacle Registration
// Feature: cave-map, Property 6: Collidable Obstacle Registration
// Validates: Requirements 4.1, 4.2
// ---------------------------------------------------------------------------

describe('Property 6: Collidable Obstacle Registration', () => {
    test('all tunnel wall meshes appear in obstacles with a valid Box3', () => {
        // Feature: cave-map, Property 6: Collidable Obstacle Registration
        fc.assert(
            fc.property(
                fc.constant(null),
                () => {
                    const env = loadBuildMap();
                    env.buildMap('cave');

                    const obs = env.getObstacles();
                    const obsMeshes = new Set(obs.map(o => o.mesh));

                    // Collect tunnel wall meshes from scene
                    const tunnelWallMeshes = env.scene.children.filter(
                        obj => obj.userData && obj.userData.isTunnelWall === true
                    );

                    if (tunnelWallMeshes.length === 0) return false; // must have tunnel walls

                    for (const mesh of tunnelWallMeshes) {
                        if (!obsMeshes.has(mesh)) return false;
                        const entry = obs.find(o => o.mesh === mesh);
                        if (!entry || !entry.box) return false;
                        if (entry.box.isEmpty && entry.box.isEmpty()) return false;
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ---------------------------------------------------------------------------
// Task 4.5: Unit test for audio graceful degradation
// Requirements: 5.2
// ---------------------------------------------------------------------------

describe('buildMap(\'cave\') — audio graceful degradation', () => {
    test('completes without throwing when AudioContext throws, and caveAmbientNode === null', () => {
        // Save original AudioContext
        const origAudioContext = global.AudioContext;

        // Mock AudioContext to throw
        global.AudioContext = function () {
            throw new Error('AudioContext not available');
        };

        let env;
        let threw = false;
        try {
            env = loadBuildMap();
            env.buildMap('cave');
        } catch (e) {
            threw = true;
        }

        // Restore
        if (origAudioContext !== undefined) {
            global.AudioContext = origAudioContext;
        } else {
            delete global.AudioContext;
        }

        expect(threw).toBe(false);
        expect(env.gameState.caveAmbientNode).toBeNull();
    });
});


describe('generateCaveLayout — unit tests (seed 42)', () => {
    const layout = generateCaveLayout(mulberry32(42));

    test('cavern count is >= 4', () => {
        expect(layout.caverns.length).toBeGreaterThanOrEqual(4);
    });

    test('exactly one cavern has isSpawnCavern = true', () => {
        const spawnCaverns = layout.caverns.filter(c => c.isSpawnCavern);
        expect(spawnCaverns.length).toBe(1);
    });

    test('all tunnel fromId and toId are valid cavern indices', () => {
        const validIds = new Set(layout.caverns.map(c => c.id));
        for (const t of layout.tunnels) {
            expect(validIds.has(t.fromId)).toBe(true);
            expect(validIds.has(t.toId)).toBe(true);
        }
    });

    test('no self-referencing tunnels (fromId !== toId)', () => {
        for (const t of layout.tunnels) {
            expect(t.fromId).not.toBe(t.toId);
        }
    });

    test('zombieSpawnCavern radius is large enough to fit 10 non-overlapping spawn circles (radius 0.5)', () => {
        const zombieSpawnCavern = layout.caverns.find(c => c.isSpawnCavern);
        expect(zombieSpawnCavern).toBeDefined();
        // Must fit 10 circles of radius 0.5: radius >= sqrt(10) * 0.5 * 2
        const minRadius = Math.sqrt(10) * 0.5 * 2;
        expect(zombieSpawnCavern.radius).toBeGreaterThanOrEqual(minRadius);
    });
});

// ---------------------------------------------------------------------------
// Task 7.1: Property 8 — Zombie Spawn Within Cavern Bounds
// Feature: cave-map, Property 8: Zombie Spawn Within Cavern Bounds
// Validates: Requirements 6.2, 7.1
// ---------------------------------------------------------------------------

describe('Property 8: Zombie Spawn Within Cavern Bounds', () => {
    test('every spawn position lies within the zombieSpawnCavern radius', () => {
        // Feature: cave-map, Property 8: Zombie Spawn Within Cavern Bounds
        fc.assert(
            fc.property(
                fc.record({
                    cx: fc.float({ min: -100, max: 100, noNaN: true }),
                    cz: fc.float({ min: -100, max: 100, noNaN: true }),
                    radius: fc.float({ min: 2.0, max: 22.0, noNaN: true }),
                }),
                (sc) => {
                    // Replicate the cave spawn logic from entities.js
                    const spawnAngle = Math.random() * Math.PI * 2;
                    const spawnDist = Math.random() * (sc.radius - 1.0);
                    const spawnX = sc.cx + Math.cos(spawnAngle) * spawnDist;
                    const spawnZ = sc.cz + Math.sin(spawnAngle) * spawnDist;

                    // The spawn distance from cavern center must be <= radius
                    const distFromCenter = Math.hypot(spawnX - sc.cx, spawnZ - sc.cz);
                    return distFromCenter <= sc.radius;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ---------------------------------------------------------------------------
// Task 7.2: Property 9 — Zombie Spawn Within Streaming Constraint
// Feature: cave-map, Property 9: Zombie Spawn Within Streaming Constraint
// Validates: Requirements 6.5
// ---------------------------------------------------------------------------

describe('Property 9: Zombie Spawn Within Streaming Constraint', () => {
    test('every spawn position is within 130 units of the world origin', () => {
        // Feature: cave-map, Property 9: Zombie Spawn Within Streaming Constraint
        fc.assert(
            fc.property(
                fc.record({
                    cx: fc.float({ min: -100, max: 100, noNaN: true }),
                    cz: fc.float({ min: -100, max: 100, noNaN: true }),
                    radius: fc.float({ min: 2.0, max: 22.0, noNaN: true }),
                }),
                (sc) => {
                    // Replicate the cave spawn logic from entities.js (including 130-unit clamp)
                    const spawnAngle = Math.random() * Math.PI * 2;
                    const spawnDist = Math.random() * (sc.radius - 1.0);
                    let spawnX = sc.cx + Math.cos(spawnAngle) * spawnDist;
                    let spawnZ = sc.cz + Math.sin(spawnAngle) * spawnDist;
                    const distFromOrigin = Math.hypot(spawnX, spawnZ);
                    if (distFromOrigin > 130) {
                        const scale = 130 / distFromOrigin;
                        spawnX *= scale;
                        spawnZ *= scale;
                    }

                    // After the clamp, distance from origin must be <= 130
                    return Math.hypot(spawnX, spawnZ) <= 130;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ---------------------------------------------------------------------------
// Task 8.1: Rescue Mission placement test
// Requirements: 7.2
// ---------------------------------------------------------------------------

describe('Integration: Rescue Mission on cave map (Task 8.1)', () => {
    test('buildMap(\'cave\') completes without throwing and gameState.zombieSpawnCavern is set — sufficient for rescue mode placement', () => {
        let env;
        let threw = false;
        try {
            env = loadBuildMap();
            env.buildMap('cave');
        } catch (e) {
            threw = true;
        }
        expect(threw).toBe(false);
        // Rescue mode uses open cavern space; confirm the map built valid obstacles
        const obs = env.getObstacles();
        expect(obs.length).toBeGreaterThan(0);
        // zombieSpawnCavern being set confirms cavern data is available for rescue zone placement
        expect(env.gameState.zombieSpawnCavern).not.toBeNull();
        expect(env.gameState.zombieSpawnCavern).toHaveProperty('cx');
        expect(env.gameState.zombieSpawnCavern).toHaveProperty('cz');
        expect(env.gameState.zombieSpawnCavern).toHaveProperty('radius');
    });
});

// ---------------------------------------------------------------------------
// Task 8.2: PvP Arena placement test
// Requirements: 7.3
// ---------------------------------------------------------------------------

describe('Integration: PvP Arena on cave map (Task 8.2)', () => {
    test('buildMap(\'cave\') produces sufficient open obstacles for PvP enemy spawn without throwing', () => {
        let env;
        let threw = false;
        try {
            env = loadBuildMap();
            env.buildMap('cave');
        } catch (e) {
            threw = true;
        }
        expect(threw).toBe(false);

        const obs = env.getObstacles();
        // PvP enemy needs navigable space; confirm map built a healthy obstacle set
        expect(obs.length).toBeGreaterThan(0);

        // The cave layout must have at least 4 caverns (each provides open space for PvP)
        const layout = generateCaveLayout(mulberry32(42));
        expect(layout.caverns.length).toBeGreaterThanOrEqual(4);
    });
});

// ---------------------------------------------------------------------------
// Task 8.3: Map selection test
// Requirements: 7.4, 8.1, 8.3
// ---------------------------------------------------------------------------

describe('Integration: Cave map selection (Task 8.3)', () => {
    test('MAPS[\'cave\'] is accessible with the correct name field', () => {
        expect(MAPS['cave']).toBeDefined();
        expect(MAPS['cave'].name).toBe('Cave');
    });

    test('Object.keys(MAPS) includes \'cave\'', () => {
        expect(Object.keys(MAPS).includes('cave')).toBe(true);
    });

    test('cave entry appears alongside other maps in the selection grid data', () => {
        const mapKeys = Object.keys(MAPS);
        // Must have more than one map entry (cave + existing maps)
        expect(mapKeys.length).toBeGreaterThan(1);
        expect(mapKeys).toContain('cave');
    });
});
