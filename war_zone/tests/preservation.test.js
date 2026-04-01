/**
 * Task 2: Preservation Property Tests (BEFORE implementing fix)
 *
 * Property 2: Preservation — Non-Slope and Non-Mountain Behavior
 *
 * These tests MUST PASS on UNFIXED code.
 * They document the baseline behavior that the fix must preserve.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.6
 */

'use strict';

const {
    Vector3,
    THREE_mock,
    makeFlatMesh,
    makeBoxObstacle,
    getFloorHeight,
    checkCollision,
    forAll,
} = require('./helpers');

// ---------------------------------------------------------------------------
// Shared MAPS stub (non-mountain maps only)
// ---------------------------------------------------------------------------

const MAPS = {
    warehouse: { size: 60 },
    desert: { size: 80 },
    city: { size: 100 },
    forest: { size: 70 },
    mountain: { size: 90 },
};

// ---------------------------------------------------------------------------
// Random generators
// ---------------------------------------------------------------------------

function randomFloat(min, max) {
    return min + Math.random() * (max - min);
}

/** Random (x, z) position within a reasonable play area */
function randomXZ(range = 40) {
    return {
        x: randomFloat(-range, range),
        z: randomFloat(-range, range),
    };
}

/** Random camera Y above ground (1.7 = standing on flat ground) */
function randomCameraY(minY = 1.7, maxY = 10) {
    return randomFloat(minY, maxY);
}

// ---------------------------------------------------------------------------
// Observation 1: flat ground with no slope meshes returns 0
// ---------------------------------------------------------------------------

describe('Observation: getFloorHeight with no slope meshes and flat ground returns 0', () => {
    test('returns 0 at origin with empty obstacles and no slopeMeshes', () => {
        const pos = new Vector3(0, 1.7, 0);
        const obstacles = [];
        const gameState = { slopeMeshes: [] };
        const result = getFloorHeight(pos, obstacles, gameState, THREE_mock);
        expect(result).toBe(0);
    });

    test('returns 0 at various positions with empty obstacles', () => {
        const positions = [
            new Vector3(5, 1.7, 5),
            new Vector3(-10, 3.0, 7),
            new Vector3(20, 5.0, -15),
            new Vector3(0, 1.7, 0),
        ];
        for (const pos of positions) {
            const result = getFloorHeight(pos, [], { slopeMeshes: [] }, THREE_mock);
            expect(result).toBe(0);
        }
    });
});

// ---------------------------------------------------------------------------
// Observation 2: getFloorHeight above a box obstacle returns obs.box.max.y
// ---------------------------------------------------------------------------

describe('Observation: getFloorHeight above a box obstacle returns obs.box.max.y', () => {
    test('returns box top when player is standing on a crate (height 1.0)', () => {
        // Crate: 2x1x2 box centered at origin, top at y=1.0
        const obs = makeBoxObstacle(-1, 0, -1, 1, 1.0, 1);
        const pos = new Vector3(0, 1.0 + 1.7, 0); // feetY = 1.0 (exactly on top)
        const result = getFloorHeight(pos, [obs], { slopeMeshes: [] }, THREE_mock);
        expect(result).toBe(1.0);
    });

    test('returns box top when player is slightly above a box (feetY within 0.8 of top)', () => {
        const boxTop = 2.0;
        const obs = makeBoxObstacle(-1, 0, -1, 1, boxTop, 1);
        // feetY = boxTop + 0.5 (within 0.8 step-up tolerance)
        const pos = new Vector3(0, boxTop + 0.5 + 1.7, 0);
        const result = getFloorHeight(pos, [obs], { slopeMeshes: [] }, THREE_mock);
        expect(result).toBe(boxTop);
    });

    test('returns box top even when player is high above it (feetY >= obsTop - 0.8 is always true when above)', () => {
        // The condition is: feetY >= obsTop - 0.8
        // When player is ABOVE the box, feetY > obsTop, so feetY >= obsTop - 0.8 is always true.
        // The 0.8 tolerance only prevents returning the box top when the player is BELOW it
        // (i.e. feetY < obsTop - 0.8 means player is more than 0.8m below the box top).
        const boxTop = 1.0;
        const obs = makeBoxObstacle(-1, 0, -1, 1, boxTop, 1);
        // feetY = boxTop + 1.5 (well above the box)
        const pos = new Vector3(0, boxTop + 1.5 + 1.7, 0);
        const result = getFloorHeight(pos, [obs], { slopeMeshes: [] }, THREE_mock);
        // Observed behavior: box top IS returned even when player is high above it
        expect(result).toBe(boxTop);
    });
});

// ---------------------------------------------------------------------------
// Observation 3: checkCollision returns false immediately when godMode/noClip
// ---------------------------------------------------------------------------

describe('Observation: checkCollision returns false immediately when godMode or noClip is set', () => {
    // Set up a solid wall that would normally block movement
    const wallObs = makeBoxObstacle(-5, 0, -5, 5, 5, 5);
    const obstacles = [wallObs];
    const gameState = { currentMap: 'warehouse', slopeMeshes: [] };
    const camera = { position: new Vector3(0, 1.7, 0) };

    test('godMode=true returns false even when inside a wall', () => {
        const playerState = { godMode: true, noClip: false };
        const pos = new Vector3(0, 1.7, 0); // inside the wall
        const result = checkCollision(pos, obstacles, gameState, playerState, camera, THREE_mock, MAPS);
        expect(result).toBe(false);
    });

    test('noClip=true returns false even when inside a wall', () => {
        const playerState = { godMode: false, noClip: true };
        const pos = new Vector3(0, 1.7, 0); // inside the wall
        const result = checkCollision(pos, obstacles, gameState, playerState, camera, THREE_mock, MAPS);
        expect(result).toBe(false);
    });

    test('godMode=true returns false at out-of-bounds position', () => {
        const playerState = { godMode: true, noClip: false };
        const pos = new Vector3(1000, 1.7, 1000); // way out of bounds
        const result = checkCollision(pos, obstacles, gameState, playerState, camera, THREE_mock, MAPS);
        expect(result).toBe(false);
    });

    test('noClip=true returns false at out-of-bounds position', () => {
        const playerState = { godMode: false, noClip: true };
        const pos = new Vector3(1000, 1.7, 1000);
        const result = checkCollision(pos, obstacles, gameState, playerState, camera, THREE_mock, MAPS);
        expect(result).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Observation 4: checkCollision on non-mountain map never enters slope guard
// ---------------------------------------------------------------------------

describe('Observation: checkCollision on non-mountain map never enters slope steepness guard', () => {
    const nonMountainMaps = ['warehouse', 'desert', 'city', 'forest'];

    for (const mapId of nonMountainMaps) {
        test(`map=${mapId}: checkCollision does not use slope guard (no false positives from slope logic)`, () => {
            // Even if slopeMeshes were populated (shouldn't be for non-mountain),
            // the guard is gated on currentMap === 'mountain'
            const slopeMesh = makeFlatMesh(5, -10, 10, -10, 10); // slope at Y=5
            const gameState = { currentMap: mapId, slopeMeshes: [slopeMesh] };
            const playerState = { godMode: false, noClip: false };
            const camera = { position: new Vector3(0, 1.7, 0) };
            const obstacles = [];

            // Player at Y=1.7 (feetY=0), slope at Y=5 — on mountain this would block
            // On non-mountain maps, the slope guard is skipped → should NOT block
            const pos = new Vector3(0, 1.7, 0);
            const result = checkCollision(pos, obstacles, gameState, playerState, camera, THREE_mock, MAPS);
            expect(result).toBe(false);
        });
    }
});

// ---------------------------------------------------------------------------
// Property 2a: For all random (x,z) with no slope meshes, getFloorHeight = 0
//
// Validates: Requirements 3.1, 3.4
// ---------------------------------------------------------------------------

describe('Property 2a: getFloorHeight with slopeMeshes=[] returns 0 for flat ground', () => {
    /**
     * **Validates: Requirements 3.1, 3.4**
     *
     * For any camera position with no slope meshes and no box obstacles,
     * getFloorHeight returns 0 (flat ground level).
     * This is the baseline behavior that must be preserved after the fix.
     */
    test('property: forAll random positions with no obstacles, getFloorHeight returns 0', () => {
        forAll(200, () => {
            const { x, z } = randomXZ(40);
            const y = randomCameraY(1.7, 15);
            return new Vector3(x, y, z);
        }, (pos) => {
            const result = getFloorHeight(pos, [], { slopeMeshes: [] }, THREE_mock);
            expect(result).toBe(0);
        });
    });

    test('property: forAll random positions with slopeMeshes=[], getFloorHeight returns 0', () => {
        forAll(200, () => {
            const { x, z } = randomXZ(40);
            const y = randomCameraY(1.7, 15);
            return new Vector3(x, y, z);
        }, (pos) => {
            // Explicitly set slopeMeshes to empty (non-mountain scenario)
            const gameState = { slopeMeshes: [] };
            const result = getFloorHeight(pos, [], gameState, THREE_mock);
            expect(result).toBe(0);
        });
    });
});

// ---------------------------------------------------------------------------
// Property 2b: For all random positions above box obstacles, getFloorHeight
//              returns obs.box.max.y
//
// Validates: Requirements 3.2
// ---------------------------------------------------------------------------

describe('Property 2b: getFloorHeight above box obstacles returns obs.box.max.y', () => {
    /**
     * **Validates: Requirements 3.2**
     *
     * For any position directly above a box obstacle where the player's feet
     * are within the step-up tolerance (0.8m), getFloorHeight returns the
     * box's top surface (obs.box.max.y).
     */
    test('property: forAll random positions on top of box obstacles, returns box top', () => {
        forAll(200, () => {
            // Random box: 2x2 footprint, random height between 0.5 and 4
            const cx = randomFloat(-20, 20);
            const cz = randomFloat(-20, 20);
            const boxTop = randomFloat(0.5, 4.0);
            const obs = makeBoxObstacle(cx - 1, 0, cz - 1, cx + 1, boxTop, cz + 1);

            // Player standing exactly on top: feetY = boxTop (within 0.8 tolerance)
            const cameraY = boxTop + 1.7;
            const pos = new Vector3(cx, cameraY, cz);
            return { pos, obs, boxTop };
        }, ({ pos, obs, boxTop }) => {
            const result = getFloorHeight(pos, [obs], { slopeMeshes: [] }, THREE_mock);
            expect(result).toBe(boxTop);
        });
    });

    test('property: forAll random positions slightly above box obstacles (within 0.8m), returns box top', () => {
        forAll(200, () => {
            const cx = randomFloat(-20, 20);
            const cz = randomFloat(-20, 20);
            const boxTop = randomFloat(0.5, 4.0);
            const obs = makeBoxObstacle(cx - 1, 0, cz - 1, cx + 1, boxTop, cz + 1);

            // Player slightly above: feetY = boxTop + random(0, 0.79)
            const feetOffset = randomFloat(0, 0.79);
            const cameraY = boxTop + feetOffset + 1.7;
            const pos = new Vector3(cx, cameraY, cz);
            return { pos, obs, boxTop };
        }, ({ pos, obs, boxTop }) => {
            const result = getFloorHeight(pos, [obs], { slopeMeshes: [] }, THREE_mock);
            expect(result).toBe(boxTop);
        });
    });

    test('property: forAll positions NOT above any box, getFloorHeight returns 0', () => {
        forAll(200, () => {
            // Box at a fixed location far from player
            const obs = makeBoxObstacle(50, 0, 50, 52, 2.0, 52);
            const { x, z } = randomXZ(30); // player within [-30, 30] — never near box at 50,50
            const y = randomCameraY(1.7, 10);
            const pos = new Vector3(x, y, z);
            return { pos, obs };
        }, ({ pos, obs }) => {
            const result = getFloorHeight(pos, [obs], { slopeMeshes: [] }, THREE_mock);
            expect(result).toBe(0);
        });
    });
});

// ---------------------------------------------------------------------------
// Property 2c: For non-mountain maps, checkCollision and getFloorHeight
//              return identical results before and after the fix
//
// Validates: Requirements 3.3, 3.4
// ---------------------------------------------------------------------------

describe('Property 2c: Non-mountain maps — checkCollision and getFloorHeight are unaffected by slope logic', () => {
    /**
     * **Validates: Requirements 3.3, 3.4**
     *
     * For any map other than 'mountain', the slope steepness guard in
     * checkCollision is never entered. Results must be identical before
     * and after the fix (since the fix only touches slope-related code paths).
     */
    const nonMountainMaps = ['warehouse', 'desert', 'city', 'forest'];

    for (const mapId of nonMountainMaps) {
        test(`property [${mapId}]: forAll random positions, getFloorHeight ignores slopeMeshes`, () => {
            forAll(100, () => {
                const { x, z } = randomXZ(30);
                const y = randomCameraY(1.7, 10);
                return new Vector3(x, y, z);
            }, (pos) => {
                // With slopeMeshes empty (non-mountain scenario)
                const gameState = { currentMap: mapId, slopeMeshes: [] };
                const result = getFloorHeight(pos, [], gameState, THREE_mock);
                // Must equal the flat-ground baseline (0)
                expect(result).toBe(0);
            });
        });

        test(`property [${mapId}]: forAll random positions, checkCollision never blocks due to slope guard`, () => {
            forAll(100, () => {
                const { x, z } = randomXZ(20); // stay within map bounds
                const y = randomCameraY(1.7, 10);
                return new Vector3(x, y, z);
            }, (pos) => {
                const gameState = { currentMap: mapId, slopeMeshes: [] };
                const playerState = { godMode: false, noClip: false };
                const camera = { position: new Vector3(pos.x, pos.y, pos.z) };
                const result = checkCollision(pos, [], gameState, playerState, camera, THREE_mock, MAPS);
                // No obstacles, within bounds → must be false
                expect(result).toBe(false);
            });
        });
    }
});

// ---------------------------------------------------------------------------
// Property 2d: checkCollision returns false for all positions when
//              godMode or noClip is true
//
// Validates: Requirements 3.6
// ---------------------------------------------------------------------------

describe('Property 2d: checkCollision returns false for all positions when godMode or noClip is true', () => {
    /**
     * **Validates: Requirements 3.6**
     *
     * When godMode or noClip is enabled, checkCollision must return false
     * immediately, regardless of position, obstacles, or map.
     * This bypass must be preserved after the fix.
     */
    test('property: forAll random positions with godMode=true, checkCollision returns false', () => {
        // Dense obstacles to ensure we'd normally get collisions
        const obstacles = [
            makeBoxObstacle(-50, 0, -50, 50, 10, 50), // giant floor-to-ceiling box
        ];
        const gameState = { currentMap: 'mountain', slopeMeshes: [] };
        const playerState = { godMode: true, noClip: false };
        const camera = { position: new Vector3(0, 1.7, 0) };

        forAll(200, () => {
            const x = randomFloat(-100, 100);
            const z = randomFloat(-100, 100);
            const y = randomCameraY(1.7, 20);
            return new Vector3(x, y, z);
        }, (pos) => {
            const result = checkCollision(pos, obstacles, gameState, playerState, camera, THREE_mock, MAPS);
            expect(result).toBe(false);
        });
    });

    test('property: forAll random positions with noClip=true, checkCollision returns false', () => {
        const obstacles = [
            makeBoxObstacle(-50, 0, -50, 50, 10, 50),
        ];
        const gameState = { currentMap: 'mountain', slopeMeshes: [] };
        const playerState = { godMode: false, noClip: true };
        const camera = { position: new Vector3(0, 1.7, 0) };

        forAll(200, () => {
            const x = randomFloat(-100, 100);
            const z = randomFloat(-100, 100);
            const y = randomCameraY(1.7, 20);
            return new Vector3(x, y, z);
        }, (pos) => {
            const result = checkCollision(pos, obstacles, gameState, playerState, camera, THREE_mock, MAPS);
            expect(result).toBe(false);
        });
    });

    test('property: forAll random positions with both godMode and noClip true, checkCollision returns false', () => {
        const obstacles = [
            makeBoxObstacle(-50, 0, -50, 50, 10, 50),
        ];
        const gameState = { currentMap: 'warehouse', slopeMeshes: [] };
        const playerState = { godMode: true, noClip: true };
        const camera = { position: new Vector3(0, 1.7, 0) };

        forAll(200, () => {
            const x = randomFloat(-100, 100);
            const z = randomFloat(-100, 100);
            const y = randomCameraY(1.7, 20);
            return new Vector3(x, y, z);
        }, (pos) => {
            const result = checkCollision(pos, obstacles, gameState, playerState, camera, THREE_mock, MAPS);
            expect(result).toBe(false);
        });
    });

    test('property: godMode/noClip bypass works on all map types', () => {
        const allMaps = ['warehouse', 'desert', 'city', 'forest', 'mountain'];
        const obstacles = [makeBoxObstacle(-10, 0, -10, 10, 5, 10)];

        for (const mapId of allMaps) {
            forAll(50, () => {
                const x = randomFloat(-5, 5);
                const z = randomFloat(-5, 5);
                const y = randomCameraY(1.7, 5);
                return new Vector3(x, y, z);
            }, (pos) => {
                const gameState = { currentMap: mapId, slopeMeshes: [] };
                const camera = { position: pos.clone ? pos.clone() : new Vector3(pos.x, pos.y, pos.z) };

                // godMode
                const r1 = checkCollision(pos, obstacles, gameState, { godMode: true, noClip: false }, camera, THREE_mock, MAPS);
                expect(r1).toBe(false);

                // noClip
                const r2 = checkCollision(pos, obstacles, gameState, { godMode: false, noClip: true }, camera, THREE_mock, MAPS);
                expect(r2).toBe(false);
            });
        }
    });
});

// ---------------------------------------------------------------------------
// Additional: Box collision still works correctly (regression guard)
// ---------------------------------------------------------------------------

describe('Regression guard: box obstacle collision still works on non-mountain maps', () => {
    test('checkCollision returns true when player walks into a wall (warehouse)', () => {
        // Wall from x=5 to x=6, full height
        const wall = makeBoxObstacle(5, 0, -5, 6, 5, 5);
        const gameState = { currentMap: 'warehouse', slopeMeshes: [] };
        const playerState = { godMode: false, noClip: false };
        const camera = { position: new Vector3(0, 1.7, 0) };

        // Player at x=4.8 (within 0.3 radius of wall at x=5)
        const pos = new Vector3(4.8, 1.7, 0);
        const result = checkCollision(pos, [wall], gameState, playerState, camera, THREE_mock, MAPS);
        expect(result).toBe(true);
    });

    test('checkCollision returns false when player is clear of all obstacles', () => {
        const wall = makeBoxObstacle(10, 0, -5, 11, 5, 5);
        const gameState = { currentMap: 'warehouse', slopeMeshes: [] };
        const playerState = { godMode: false, noClip: false };
        const camera = { position: new Vector3(0, 1.7, 0) };

        const pos = new Vector3(0, 1.7, 0); // far from wall
        const result = checkCollision(pos, [wall], gameState, playerState, camera, THREE_mock, MAPS);
        expect(result).toBe(false);
    });

    test('checkCollision returns false when player is on top of a box (step-up)', () => {
        // Box top at y=0.3 — player can step up onto it
        const box = makeBoxObstacle(-1, 0, -1, 1, 0.3, 1);
        const gameState = { currentMap: 'warehouse', slopeMeshes: [] };
        const playerState = { godMode: false, noClip: false };
        const camera = { position: new Vector3(0, 1.7, 0) };

        // pMinY = 1.7 - 1.7 = 0; box.max.y = 0.3; pMinY >= box.max.y - 0.4 → 0 >= -0.1 → true → step-up allowed
        const pos = new Vector3(0, 1.7, 0);
        const result = checkCollision(pos, [box], gameState, playerState, camera, THREE_mock, MAPS);
        expect(result).toBe(false);
    });
});
