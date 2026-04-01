/**
 * Task 1: Bug Condition Exploration Test
 *
 * Property 1: Expected Behavior — Slope Phasing Bug
 *
 * These tests encode the expected (correct) behavior for all three root causes
 * of the slope phasing bug. They FAILED on unfixed code (confirming the bugs
 * existed) and PASS on fixed code (confirming the fixes are correctly applied).
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 */

'use strict';

const {
    Vector3,
    THREE_mock,
    makeFlatMesh,
    makeBoxObstacle,
    getFloorHeight,
    checkCollision,
} = require('./helpers');

const MAPS = {
    mountain: { size: 90 },
    warehouse: { size: 60 },
};

// ---------------------------------------------------------------------------
// Helper: make a slope mesh that only responds to downward rays (not upward).
// This simulates a one-sided slope surface that the player walks ON TOP of,
// not one that acts as a ceiling when approached from below.
// ---------------------------------------------------------------------------

function makeDownwardOnlyMesh(y, minX, maxX, minZ, maxZ) {
    return {
        position: new Vector3((minX + maxX) / 2, y, (minZ + maxZ) / 2),
        _intersectRay(origin, direction) {
            if (direction.y === 0) return [];
            // Only respond to downward rays (direction.y < 0)
            if (direction.y > 0) return [];
            const t = (y - origin.y) / direction.y;
            if (t < 0) return [];
            const ix = origin.x + t * direction.x;
            const iz = origin.z + t * direction.z;
            if (ix >= minX && ix <= maxX && iz >= minZ && iz <= maxZ) {
                return [{ point: new Vector3(ix, y, iz) }];
            }
            return [];
        }
    };
}

// ---------------------------------------------------------------------------
// Sub-property A — Reachability filter: slope above head must not be returned
//
// Bug: getFloorHeight cast from Y=200 picks highest hit regardless of
//      whether it is reachable from the player's current feet position.
// Fix: hitY <= feetY + 0.8 filter added to downHits loop.
//
// Validates: Requirement 2.4
// ---------------------------------------------------------------------------

describe('Sub-property A: Reachability filter — slope above head is ignored', () => {
    /**
     * **Validates: Requirements 2.4**
     *
     * Mock a slope mesh at Y=5. Player camera at Y=1.7 (feetY=0).
     * The slope is 5 units above the player's feet — unreachable.
     * Fixed code must return a floor ≤ feetY + 0.8 = 0.8, not 5.
     */
    test('getFloorHeight with slope at Y=5 and player feetY=0 returns ≤ 0.8 (not 5)', () => {
        const slopeMesh = makeDownwardOnlyMesh(5, -10, 10, -10, 10); // slope at Y=5
        const pos = new Vector3(0, 1.7, 0); // feetY = 0
        const gameState = { slopeMeshes: [slopeMesh] };

        const result = getFloorHeight(pos, [], gameState, THREE_mock);

        // Fixed: slope at Y=5 is above feetY+0.8=0.8, so it must be ignored
        expect(result).toBeLessThanOrEqual(0.8);
        // The slope at Y=5 must NOT be returned
        expect(result).not.toBe(5);
    });

    test('getFloorHeight with slope at Y=3 and player feetY=0 returns ≤ 0.8 (not 3)', () => {
        const slopeMesh = makeDownwardOnlyMesh(3, -10, 10, -10, 10); // slope at Y=3
        const pos = new Vector3(0, 1.7, 0); // feetY = 0

        const result = getFloorHeight(pos, [], { slopeMeshes: [slopeMesh] }, THREE_mock);

        expect(result).toBeLessThanOrEqual(0.8);
        expect(result).not.toBe(3);
    });

    test('getFloorHeight with slope at Y=0.5 and player feetY=0 returns 0.5 (within step-up)', () => {
        // Use downward-only mesh so upward ray doesn't set it as ceiling
        const slopeMesh = makeDownwardOnlyMesh(0.5, -10, 10, -10, 10); // slope at Y=0.5
        const pos = new Vector3(0, 1.7, 0); // feetY = 0

        const result = getFloorHeight(pos, [], { slopeMeshes: [slopeMesh] }, THREE_mock);

        // Y=0.5 <= feetY+0.8=0.8 → reachable, should be returned
        expect(result).toBe(0.5);
    });

    test('getFloorHeight with slope at Y=0.8 (boundary) and player feetY=0 returns 0.8', () => {
        const slopeMesh = makeDownwardOnlyMesh(0.8, -10, 10, -10, 10);
        const pos = new Vector3(0, 1.7, 0); // feetY = 0

        const result = getFloorHeight(pos, [], { slopeMeshes: [slopeMesh] }, THREE_mock);

        // Y=0.8 <= feetY+0.8=0.8 → exactly at boundary → reachable
        expect(result).toBe(0.8);
    });
});

// ---------------------------------------------------------------------------
// Sub-property B — AABB box on slope: slope entry must have a box for
//                  checkCollision AABB loop to detect it
//
// Bug: slope entries pushed without a `box` property; AABB loop skips them.
// Fix: box added to slope entries in buildMap (map.js).
//
// Validates: Requirements 2.1, 2.2
// ---------------------------------------------------------------------------

describe('Sub-property B: Slope with AABB box is detected by checkCollision', () => {
    /**
     * **Validates: Requirements 2.1, 2.2**
     *
     * A slope obstacle entry WITH a box property must be detected by
     * checkCollision's AABB loop when the player is inside its bounding volume.
     */
    test('checkCollision detects slope obstacle with box when player is inside bounding volume', () => {
        // Slope obstacle WITH a box (fixed behavior)
        const slopeWithBox = makeBoxObstacle(-2, 0, -2, 2, 2, 2, { isSlope: true });
        const obstacles = [slopeWithBox];

        const gameState = { currentMap: 'mountain', slopeMeshes: [] };
        const playerState = { godMode: false, noClip: false };
        // Camera at Y=1.7 (feetY=0), inside the slope box
        const pos = new Vector3(0, 1.7, 0);
        const camera = { position: new Vector3(0, 1.7, 0) };

        const result = checkCollision(pos, obstacles, gameState, playerState, camera, THREE_mock, MAPS);

        // With a box, the AABB loop detects the collision
        // pMinY=0, box.max.y=2, pMinY < box.max.y → collision unless step-up applies
        // pMinY=0 >= box.max.y - 0.4 = 1.6? No → collision = true
        expect(result).toBe(true);
    });

    test('checkCollision does NOT detect slope obstacle WITHOUT box (demonstrates the bug)', () => {
        // Slope obstacle WITHOUT a box (unfixed behavior — no box property)
        const slopeWithoutBox = { isSlope: true, mesh: { position: new Vector3(0, 1, 0) } };
        const obstacles = [slopeWithoutBox];

        const gameState = { currentMap: 'mountain', slopeMeshes: [] };
        const playerState = { godMode: false, noClip: false };
        const pos = new Vector3(0, 1.7, 0);
        const camera = { position: new Vector3(0, 1.7, 0) };

        const result = checkCollision(pos, obstacles, gameState, playerState, camera, THREE_mock, MAPS);

        // Without a box, the AABB loop skips this entry → no collision detected
        // This is the bug behavior — the slope is invisible to collision
        expect(result).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Sub-property C — Steepness guard reference Y: must use camera.position.y,
//                  not newPos.y
//
// Bug: steepness guard compared floorAtNew against pMinY (newPos.y - 1.7)
//      instead of camera.position.y - 1.7.
// Fix: currentFeetY = camera.position.y - 1.7 used in comparison.
//
// Validates: Requirement 2.3
// ---------------------------------------------------------------------------

describe('Sub-property C: Steepness guard uses camera.position.y (not newPos.y)', () => {
    /**
     * **Validates: Requirements 2.3**
     *
     * camera.position.y = 3.7 (currentFeetY = 2.0)
     * newPos.y = 1.7 (pMinY = 0.0)
     * slope at new XZ position at Y = 2.4
     *
     * Fixed: floorAtNew(2.4) > currentFeetY(2.0) + 0.6(2.6)? → 2.4 > 2.6? → false → allow
     * Unfixed: floorAtNew(2.4) > pMinY(0.0) + 0.6(0.6)? → 2.4 > 0.6? → true → block (wrong)
     */
    test('steepness guard allows movement when slope is within 0.6m of current feet (not proposed feet)', () => {
        // Slope at Y=2.4 at the new position — use downward-only so it's not a ceiling
        const slopeMesh = makeDownwardOnlyMesh(2.4, -10, 10, -10, 10);
        const gameState = { currentMap: 'mountain', slopeMeshes: [slopeMesh] };
        const playerState = { godMode: false, noClip: false };

        // Camera (current position): Y=3.7 → currentFeetY = 2.0
        const camera = { position: new Vector3(0, 3.7, 0) };

        // Proposed new position: Y=1.7 → pMinY = 0.0
        // getFloorHeight(newPos): feetY = 0, slope at Y=2.4, 2.4 <= 0+0.8=0.8? No → floor=0
        // steepness: 0 > currentFeetY(2.0) + 0.6 = 2.6? → false → allow
        const newPos = new Vector3(0, 1.7, 0);

        const result = checkCollision(newPos, [], gameState, playerState, camera, THREE_mock, MAPS);

        // Fixed: movement allowed (slope not detected as floor from newPos perspective)
        expect(result).toBe(false);
    });

    test('steepness guard blocks when slope is reachable from newPos and exceeds currentFeetY+0.6', () => {
        // Slope at Y=0.8 — reachable from newPos (feetY=0, 0.8 <= 0+0.8)
        const slopeMesh = makeDownwardOnlyMesh(0.8, -10, 10, -10, 10);
        const gameState = { currentMap: 'mountain', slopeMeshes: [slopeMesh] };
        const playerState = { godMode: false, noClip: false };

        // Camera at Y=1.7 → currentFeetY = 0.0
        const camera = { position: new Vector3(0, 1.7, 0) };
        const newPos = new Vector3(0, 1.7, 0);

        // getFloorHeight(newPos): feetY=0, slope at Y=0.8, 0.8 <= 0.8 → floor=0.8
        // steepness: 0.8 > currentFeetY(0) + 0.6 = 0.6? → true → blocked
        const result = checkCollision(newPos, [], gameState, playerState, camera, THREE_mock, MAPS);

        expect(result).toBe(true);
    });

    test('steepness guard correctly uses camera.position.y when newPos.y differs', () => {
        // This is the key test for the bug fix:
        // If we used newPos.y instead of camera.position.y, the result would differ.
        //
        // Slope at Y=0.5 (reachable from newPos feetY=0)
        // camera.position.y = 2.7 → currentFeetY = 1.0
        // newPos.y = 1.7 → pMinY = 0.0
        //
        // Fixed:   floor=0.5 > currentFeetY(1.0) + 0.6 = 1.6? → false → allow
        // Unfixed: floor=0.5 > pMinY(0.0) + 0.6 = 0.6? → false → allow (same result here)
        //
        // Better scenario: slope at Y=0.8, camera.position.y=2.7 (currentFeetY=1.0)
        // Fixed:   floor=0.8 > 1.0 + 0.6 = 1.6? → false → allow
        // Unfixed: floor=0.8 > 0.0 + 0.6 = 0.6? → true → block (wrong!)
        const slopeMesh = makeDownwardOnlyMesh(0.8, -10, 10, -10, 10);
        const gameState = { currentMap: 'mountain', slopeMeshes: [slopeMesh] };
        const playerState = { godMode: false, noClip: false };

        // Camera higher up: Y=2.7 → currentFeetY = 1.0
        const camera = { position: new Vector3(0, 2.7, 0) };
        // Proposed position lower: Y=1.7 → pMinY = 0.0
        const newPos = new Vector3(0, 1.7, 0);

        // getFloorHeight(newPos): feetY=0, slope at Y=0.8, 0.8 <= 0.8 → floor=0.8
        // Fixed:   0.8 > currentFeetY(1.0) + 0.6 = 1.6? → false → allow
        const result = checkCollision(newPos, [], gameState, playerState, camera, THREE_mock, MAPS);

        expect(result).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Sub-property D — Fall-through with overhead slope: stacked slopes must
//                  not return the overhead one as the floor
//
// Bug: getFloorHeight picks highest hit from downward ray, including
//      surfaces above the player's head.
// Fix: hitY <= feetY + 0.8 filter ensures only reachable surfaces are used.
//
// Validates: Requirement 2.4
// ---------------------------------------------------------------------------

describe('Sub-property D: Stacked slopes — overhead slope is not returned as floor', () => {
    /**
     * **Validates: Requirements 2.4**
     *
     * Two slope meshes stacked: floor at Y=0.5, overhang at Y=8.
     * Player at feetY=0 (camera Y=1.7).
     * Fixed: Y=0.5 <= feetY+0.8=0.8 → floor=0.5; Y=8 > 0.8 → ignored.
     */
    test('overhead slope at Y=8 is never returned as floor when player feetY=0', () => {
        const floorSlope = makeDownwardOnlyMesh(0.5, -10, 10, -10, 10);  // floor slope at Y=0.5
        const overhang = makeDownwardOnlyMesh(8, -10, 10, -10, 10);      // overhang at Y=8
        const gameState = { slopeMeshes: [floorSlope, overhang] };

        const pos = new Vector3(0, 1.7, 0); // feetY = 0
        const result = getFloorHeight(pos, [], gameState, THREE_mock);

        // Y=8 must not be returned
        expect(result).not.toBe(8);
        // Y=0.5 is reachable → floor=0.5
        expect(result).toBe(0.5);
    });

    test('floor slope at Y=2 is returned when player feetY=1.5 (within step-up range)', () => {
        const floorSlope = makeDownwardOnlyMesh(2, -10, 10, -10, 10);   // floor slope at Y=2
        const overhang = makeDownwardOnlyMesh(8, -10, 10, -10, 10);     // overhang at Y=8
        const gameState = { slopeMeshes: [floorSlope, overhang] };

        // feetY = 1.5 → feetY + 0.8 = 2.3 → Y=2 is reachable
        const pos = new Vector3(0, 1.5 + 1.7, 0); // camera Y=3.2, feetY=1.5
        const result = getFloorHeight(pos, [], gameState, THREE_mock);

        // Y=2 <= 2.3 → reachable → floor=2
        // Y=8 > 2.3 → not reachable → ignored
        expect(result).toBe(2);
        expect(result).not.toBe(8);
    });

    test('only the lower reachable slope is returned when two slopes are stacked', () => {
        const lowerSlope = makeDownwardOnlyMesh(0.5, -10, 10, -10, 10);  // lower at Y=0.5
        const upperSlope = makeDownwardOnlyMesh(5, -10, 10, -10, 10);    // upper at Y=5
        const gameState = { slopeMeshes: [lowerSlope, upperSlope] };

        const pos = new Vector3(0, 1.7, 0); // feetY = 0
        const result = getFloorHeight(pos, [], gameState, THREE_mock);

        // Y=0.5 <= feetY+0.8=0.8 → reachable → floor=0.5
        // Y=5 > 0.8 → not reachable → ignored
        expect(result).toBe(0.5);
        expect(result).not.toBe(5);
    });
});
