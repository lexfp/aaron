# Bugfix Requirements Document

## Introduction

Players can phase through sloped geometry on the mountain map, walking or falling through slope meshes as if they were not solid. The slopes are visually present but their collision is unreliable — the player's vertical position is not correctly snapped to the slope surface, allowing them to pass through it. This breaks traversal on the mountain map and can cause players to fall out of bounds or skip intended terrain.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the player moves horizontally onto a slope mesh on the mountain map THEN the system fails to snap the player's Y position to the slope surface, allowing the player to pass through it

1.2 WHEN the player falls onto a slope mesh THEN the system does not detect the slope as a valid floor, causing the player to fall through the slope geometry

1.3 WHEN the player stands on a slope and moves toward a steeper part THEN the system's `checkCollision` steepness guard uses `getFloorHeight` at the new position before the player has moved there, producing an incorrect height comparison that may incorrectly block or allow movement

1.4 WHEN `getFloorHeight` casts a downward ray from Y=200 and finds multiple slope hits THEN the system picks the highest hit regardless of whether it is actually reachable from the player's current feet position, potentially snapping the player to a surface above them

### Expected Behavior (Correct)

2.1 WHEN the player moves horizontally onto a slope mesh THEN the system SHALL snap the player's Y position to the slope surface so the player walks along it without phasing through

2.2 WHEN the player falls onto a slope mesh THEN the system SHALL detect the slope surface as a valid floor and stop the player's downward velocity at the slope's surface height

2.3 WHEN the player moves toward a steeper slope section THEN the system SHALL correctly evaluate whether the slope height change exceeds the step-up threshold and block or allow movement accordingly

2.4 WHEN `getFloorHeight` finds multiple slope hits THEN the system SHALL only consider hits that are at or below the player's current feet position plus a small step-up tolerance, ignoring surfaces above the player's head

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the player walks on flat ground (non-slope surfaces) THEN the system SHALL CONTINUE TO keep the player grounded at Y=1.7 above the ground plane

3.2 WHEN the player collides with box obstacles (crates, walls, buildings) THEN the system SHALL CONTINUE TO block horizontal movement correctly

3.3 WHEN the player jumps THEN the system SHALL CONTINUE TO apply jump force and gravity normally, landing correctly on both flat and sloped surfaces

3.4 WHEN the player is on a non-mountain map THEN the system SHALL CONTINUE TO use the existing floor detection logic without any change in behavior

3.5 WHEN zombies use their own floor-tracking raycasts on the mountain map THEN the system SHALL CONTINUE TO snap zombie Y positions to slope surfaces as before

3.6 WHEN the player has noClip or godMode enabled THEN the system SHALL CONTINUE TO bypass all collision checks
