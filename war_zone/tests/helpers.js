/**
 * Test helpers: minimal Three.js mock + injectable versions of
 * getFloorHeight and checkCollision extracted from main.js.
 *
 * These helpers let us test the collision/floor logic in Node.js
 * without a browser or real Three.js renderer.
 */

// ---------------------------------------------------------------------------
// Minimal Three.js mock
// ---------------------------------------------------------------------------

class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    clone() { return new Vector3(this.x, this.y, this.z); }
}

class Box3 {
    constructor() {
        this.min = new Vector3(Infinity, Infinity, Infinity);
        this.max = new Vector3(-Infinity, -Infinity, -Infinity);
    }
    setFromObject(mesh) {
        // For our test meshes, we store explicit min/max
        if (mesh._box3) {
            this.min = mesh._box3.min.clone();
            this.max = mesh._box3.max.clone();
        }
        return this;
    }
}

/**
 * A minimal Raycaster that supports intersectObjects against our mock meshes.
 * Each mock mesh must implement _intersectRay(origin, direction) → [{point: Vector3}] | []
 */
class Raycaster {
    constructor(origin, direction) {
        this.origin = origin ? origin.clone() : new Vector3();
        this.direction = direction ? direction.clone() : new Vector3(0, -1, 0);
    }
    set(origin, direction) {
        this.origin = origin.clone();
        this.direction = direction.clone();
        return this;
    }
    intersectObjects(meshes) {
        const hits = [];
        for (const mesh of meshes) {
            if (mesh._intersectRay) {
                const result = mesh._intersectRay(this.origin, this.direction);
                hits.push(...result);
            }
        }
        // Sort by distance from origin (closest first)
        hits.sort((a, b) => {
            const da = Math.abs(a.point.y - this.origin.y);
            const db = Math.abs(b.point.y - this.origin.y);
            return da - db;
        });
        return hits;
    }
}

// ---------------------------------------------------------------------------
// Mock mesh factories
// ---------------------------------------------------------------------------

/**
 * Create a flat horizontal plane mesh at a given Y.
 * The ray (vertical, from above or below) intersects it at that Y
 * if the XZ position is within [minX, maxX] x [minZ, maxZ].
 */
function makeFlatMesh(y, minX, maxX, minZ, maxZ) {
    return {
        position: new Vector3((minX + maxX) / 2, y, (minZ + maxZ) / 2),
        _intersectRay(origin, direction) {
            // Only handle vertical rays (direction.y != 0)
            if (direction.y === 0) return [];
            // Ray: P = origin + t * direction; find t where P.y = y
            const t = (y - origin.y) / direction.y;
            if (t < 0) return []; // intersection is behind the ray
            const ix = origin.x + t * direction.x;
            const iz = origin.z + t * direction.z;
            if (ix >= minX && ix <= maxX && iz >= minZ && iz <= maxZ) {
                return [{ point: new Vector3(ix, y, iz) }];
            }
            return [];
        }
    };
}

/**
 * Create a box obstacle entry (like the real obstacles array entries).
 * box.min / box.max define the AABB.
 */
function makeBoxObstacle(minX, minY, minZ, maxX, maxY, maxZ, opts = {}) {
    return {
        box: {
            min: new Vector3(minX, minY, minZ),
            max: new Vector3(maxX, maxY, maxZ),
        },
        passThrough: opts.passThrough || false,
        ...opts,
    };
}

// ---------------------------------------------------------------------------
// Injectable getFloorHeight (mirrors main.js logic exactly)
// ---------------------------------------------------------------------------

/**
 * @param {Vector3} pos - camera position
 * @param {Array}   obstacles - array of obstacle entries
 * @param {Object}  gameState - { slopeMeshes: [] }
 * @param {Object}  THREE_mock - { Raycaster, Vector3 }
 */
function getFloorHeight(pos, obstacles, gameState, THREE_mock) {
    const { Raycaster: RC, Vector3: V3 } = THREE_mock;
    let floor = 0;
    const feetY = pos.y - 1.7;

    // Check AABB boxes first
    for (const obs of obstacles) {
        if (obs.passThrough) continue;
        if (obs.box) {
            if (pos.x >= obs.box.min.x - 0.3 && pos.x <= obs.box.max.x + 0.3 &&
                pos.z >= obs.box.min.z - 0.3 && pos.z <= obs.box.max.z + 0.3) {
                const obsTop = obs.box.max.y;
                if (obsTop > floor && feetY >= obsTop - 0.8) floor = obsTop;
            }
        }
    }

    // Check slope meshes via Dual Vertical Raycast
    const slopeMeshes = gameState.slopeMeshes || [];
    if (slopeMeshes.length > 0) {
        const downRaycaster = new RC(new V3(pos.x, 200, pos.z), new V3(0, -1, 0));
        const downHits = downRaycaster.intersectObjects(slopeMeshes);

        const upRaycaster = new RC(new V3(pos.x, feetY + 0.1, pos.z), new V3(0, 1, 0));
        const upHits = upRaycaster.intersectObjects(slopeMeshes);
        const ceilingY = upHits.length > 0 ? upHits[0].point.y : Infinity;

        if (downHits.length > 0) {
            for (const hit of downHits) {
                const hitY = hit.point.y;
                if (hitY < ceilingY && hitY <= feetY + 0.8) {
                    if (hitY > floor) floor = hitY;
                }
            }
        }
    }

    return floor;
}

/**
 * @param {Vector3} newPos - proposed camera position
 * @param {Array}   obstacles - array of obstacle entries
 * @param {Object}  gameState - { currentMap, slopeMeshes }
 * @param {Object}  playerState - { godMode, noClip }
 * @param {Object}  camera - { position: Vector3 }
 * @param {Object}  THREE_mock - { Raycaster, Vector3 }
 * @param {Object}  MAPS - map size lookup
 */
function checkCollision(newPos, obstacles, gameState, playerState, camera, THREE_mock, MAPS) {
    if (playerState.godMode || playerState.noClip) return false;

    const size = gameState.currentMap ? (MAPS[gameState.currentMap] || { size: 50 }).size * 0.95 : 50;
    if (Math.abs(newPos.x) > size || Math.abs(newPos.z) > size) return true;

    const playerCylRadius = 0.3;
    const pMinY = newPos.y - 1.7;
    const pMaxY = newPos.y + 0.2;

    for (const obs of obstacles) {
        if (obs.passThrough) continue;
        if (obs.box) {
            const b = obs.box;
            if (newPos.x + playerCylRadius > b.min.x && newPos.x - playerCylRadius < b.max.x &&
                newPos.z + playerCylRadius > b.min.z && newPos.z - playerCylRadius < b.max.z) {
                if (pMinY < b.max.y && pMaxY > b.min.y) {
                    if (pMinY >= b.max.y - 0.4) continue;
                    return true;
                }
            }
        }
        if (obs.radius) {
            if (obs.box && pMinY >= obs.box.max.y - 0.1) continue;
            const dx = newPos.x - obs.mesh.position.x;
            const dz = newPos.z - obs.mesh.position.z;
            if (Math.sqrt(dx * dx + dz * dz) < obs.radius + playerCylRadius) return true;
        }
    }

    // Slope steepness/height check (mountain map only)
    if (gameState.currentMap === 'mountain') {
        const floorAtNew = getFloorHeight(newPos, obstacles, gameState, THREE_mock);
        const currentFeetY = camera.position.y - 1.7;
        if (floorAtNew > currentFeetY + 0.6) return true;
    }

    return false;
}

// ---------------------------------------------------------------------------
// Simple property-based test runner (no external library needed)
// ---------------------------------------------------------------------------

/**
 * Run a property test with `count` random samples.
 * generator() → input value
 * property(input) → void (throws on failure)
 */
function forAll(count, generator, property) {
    for (let i = 0; i < count; i++) {
        const input = generator();
        property(input);
    }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    Vector3,
    Box3,
    Raycaster,
    THREE_mock: { Vector3, Box3, Raycaster },
    makeFlatMesh,
    makeBoxObstacle,
    getFloorHeight,
    checkCollision,
    forAll,
};
