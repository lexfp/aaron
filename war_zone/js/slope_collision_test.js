// Standalone test for slope collision getFloorHeight logic
// Run with: node slope_collision_test.js

let passed = 0;
let failed = 0;

function assert(condition, name) {
    if (condition) {
        console.log(`  PASS: ${name}`);
        passed++;
    } else {
        console.error(`  FAIL: ${name}`);
        failed++;
    }
}

// Pure re-implementation of the slope hit filtering logic from getFloorHeight
// so we can test it without Three.js
function pickFloorFromHits(downHits, ceilingY, feetY, initialFloor) {
    let floor = initialFloor;
    for (const hit of downHits) {
        const hitY = hit.point.y;
        if (hitY < ceilingY && hitY <= feetY + 1.0) {
            if (hitY > floor) floor = hitY;
        }
    }
    return floor;
}

// --- Test 1: Surface exactly at feet level is found ---
console.log('\nTest 1: Surface at feet level');
{
    const feetY = 0;
    const hits = [{ point: { y: 0 } }];
    const floor = pickFloorFromHits(hits, Infinity, feetY, 0);
    assert(floor === 0, 'floor = 0 when surface is at feetY');
}

// --- Test 2: Surface 0.5m above feet (within 1m range) is found ---
console.log('\nTest 2: Surface 0.5m above feet');
{
    const feetY = 0;
    const hits = [{ point: { y: 0.5 } }];
    const floor = pickFloorFromHits(hits, Infinity, feetY, 0);
    assert(floor === 0.5, 'floor = 0.5 when surface is 0.5m above feet');
}

// --- Test 3: Surface exactly 1m above feet (boundary) is found ---
console.log('\nTest 3: Surface exactly 1.0m above feet (boundary)');
{
    const feetY = 0;
    const hits = [{ point: { y: 1.0 } }];
    const floor = pickFloorFromHits(hits, Infinity, feetY, 0);
    assert(floor === 1.0, 'floor = 1.0 when surface is exactly 1m above feet');
}

// --- Test 4: Surface 1.01m above feet is filtered OUT (the critical bug fix) ---
console.log('\nTest 4: Surface 1.01m above feet is filtered (bug fix)');
{
    const feetY = 0;
    const hits = [{ point: { y: 1.01 } }];
    const floor = pickFloorFromHits(hits, Infinity, feetY, 0);
    assert(floor === 0, 'floor stays 0 when surface is 1.01m above feet (out of range)');
}

// --- Test 5: Rock formation at y=8 above ground-level player is filtered ---
console.log('\nTest 5: Rock formation at y=8 filtered for ground player');
{
    const feetY = 0;
    const hits = [{ point: { y: 8 } }];
    const floor = pickFloorFromHits(hits, Infinity, feetY, 0);
    assert(floor === 0, 'floor stays 0 when rock surface is at y=8 (feetY=0)');
}

// --- Test 6: Ceiling blocks high surface but allows low surface ---
console.log('\nTest 6: Ceiling logic');
{
    const feetY = 0;
    const ceilingY = 3;
    const hits = [{ point: { y: 5 } }, { point: { y: 0.5 } }];
    const floor = pickFloorFromHits(hits, ceilingY, feetY, 0);
    assert(floor === 0.5, 'floor = 0.5 (ceiling=3 blocks y=5, allows y=0.5)');
}

// --- Test 7: Highest valid surface wins ---
console.log('\nTest 7: Highest valid surface selected');
{
    const feetY = 2;
    const hits = [{ point: { y: 2.9 } }, { point: { y: 2.4 } }, { point: { y: 1.5 } }];
    const floor = pickFloorFromHits(hits, Infinity, feetY, 0);
    assert(floor === 2.9, 'floor = 2.9 (highest within range)');
}

// --- Test 8: Surface below feet is a valid floor (falling) ---
console.log('\nTest 8: Surface below feet is valid');
{
    const feetY = 3;
    const hits = [{ point: { y: 1 } }];
    const floor = pickFloorFromHits(hits, Infinity, feetY, 0);
    assert(floor === 1, 'floor = 1 even though surface is below feet');
}

// --- Test 9: Multiple hits, only valid ones count ---
console.log('\nTest 9: Multiple hits with mix of valid/invalid');
{
    const feetY = 1;
    // y=10 is above range (10 > 1+1.0=2.0), y=0.8 is valid, y=5 is above range
    const hits = [{ point: { y: 10 } }, { point: { y: 5 } }, { point: { y: 0.8 } }];
    const floor = pickFloorFromHits(hits, Infinity, feetY, 0);
    assert(floor === 0.8, 'floor = 0.8 (only y=0.8 is within range for feetY=1)');
}

// --- Test 10: Initial floor (from AABB boxes) is respected if higher than slope hits ---
console.log('\nTest 10: Initial floor from AABB boxes respected');
{
    const feetY = 2;
    const initialFloor = 1.8; // AABB box gave floor=1.8
    const hits = [{ point: { y: 1.5 } }]; // slope hit is lower than AABB
    const floor = pickFloorFromHits(hits, Infinity, feetY, initialFloor);
    assert(floor === 1.8, 'floor stays 1.8 (AABB floor is higher than slope hit)');
}

// --- Test 11: CCD sweep logic ---
console.log('\nTest 11: CCD sweep correctly detects crossed surface');
{
    function ccdSweepHit(prevFeetY, newFeetY, hitY) {
        return hitY >= newFeetY && hitY < prevFeetY;
    }
    // Falling from feet=5 to feet=1, surface at y=3 → should be caught
    assert(ccdSweepHit(5, 1, 3) === true, 'CCD catches surface crossed during fall (5→1, surface=3)');
    // Surface above old feet → not crossed
    assert(ccdSweepHit(5, 1, 6) === false, 'CCD ignores surface above old feet');
    // Surface below new feet → already passed through (not caught by CCD)
    assert(ccdSweepHit(5, 1, 0.5) === false, 'CCD ignores surface already below new feet');
    // Exactly at new feet boundary
    assert(ccdSweepHit(5, 1, 1) === true, 'CCD catches surface exactly at new feet');
}

// --- Test 12: Slope steepness check ---
console.log('\nTest 12: Slope steepness blocking (checkCollision)');
{
    function isBlockedBySteepness(floorAtNew, pMinY) {
        return floorAtNew > pMinY + 0.6;
    }
    assert(isBlockedBySteepness(0.5, 0) === false, '0.5m rise allowed (≤0.6m)');
    assert(isBlockedBySteepness(0.6, 0) === false, '0.6m rise allowed (exactly at limit)');
    assert(isBlockedBySteepness(0.61, 0) === true, '0.61m rise blocked (>0.6m)');
    assert(isBlockedBySteepness(0, 1) === false, 'going downhill always allowed');
}

// Summary
console.log(`\n=============================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
    console.log('ALL TESTS PASSED ✓');
    process.exit(0);
} else {
    console.log('SOME TESTS FAILED ✗');
    process.exit(1);
}
