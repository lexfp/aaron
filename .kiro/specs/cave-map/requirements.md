# Requirements Document

## Introduction

This feature adds a cave-themed map to the WarZone 3D shooter game. The cave map is a medium-sized, enclosed underground environment with narrow tunnels, cavern chambers, stalactites/stalagmites, glowing crystal formations, and dripping water ambiance. It is designed for close-quarters combat with limited visibility, creating a tense and claustrophobic atmosphere distinct from all existing maps. The cave map is available in all three game modes (Zombie Apocalypse, Rescue Mission, PvP Arena) and integrates with the existing map selection, chunk streaming, and obstacle systems.

## Glossary

- **Cave_Map**: The new underground cave-themed map identified by the key `'cave'` in the `MAPS` data object.
- **Cavern**: A large open chamber within the cave map, providing wider combat space. Each cavern has a distinct identity (e.g., a unique name or index) used to reference it in game logic.
- **Tunnel**: A narrow passage that directly connects two distinct `Cavern` chambers, typically 4–6 units wide.
- **Zombie_Spawn_Cavern**: The single designated `Cavern` within the cave map where all zombies spawn during Zombie Apocalypse mode.
- **Stalactite**: A downward-pointing rock formation hanging from the cave ceiling.
- **Stalagmite**: An upward-pointing rock formation rising from the cave floor.
- **Crystal_Formation**: A glowing mineral cluster that emits colored light, serving as the primary light source in the cave.
- **Cave_Pool**: A shallow water-colored floor area within a cavern, purely decorative (no physics change).
- **Map_Builder**: The `buildMap` function in `map.js` responsible for constructing the scene geometry.
- **Obstacle_System**: The `obstacles` array and `setObstacles` function in `engine.js` used for collision detection.
- **Chunk_Streaming**: The system that loads and unloads terrain geometry based on player proximity.
- **Player**: The first-person camera-controlled character managed by `main.js`.
- **Game_Mode**: One of Zombie Apocalypse, Rescue Mission, or PvP Arena as defined in `war_zone.html`.

---

## Requirements

### Requirement 1: Cave Map Data Entry

**User Story:** As a player, I want to see a cave map option in the map selection screen, so that I can choose to play in an underground cave environment.

#### Acceptance Criteria

1. THE `Cave_Map` SHALL be registered in the `MAPS` object in `data.js` with the key `'cave'`.
2. THE `Cave_Map` SHALL have a `name` property set to `'Cave'`.
3. THE `Cave_Map` SHALL have a `description` property that communicates the underground, close-quarters nature of the map.
4. THE `Cave_Map` SHALL have a `size` property of `200`.
5. THE `Cave_Map` SHALL have a `color` property representing a dark stone floor color (hex value in the range `0x2a2a2a`–`0x4a4a4a`).
6. THE `Cave_Map` SHALL have a `wallColor` property representing a dark rock wall color (hex value in the range `0x1a1a1a`–`0x3a3a3a`).
7. THE `Cave_Map` SHALL have an `ambientLight` property of `0.08` to produce a near-dark underground atmosphere.

---

### Requirement 2: Cave Map Construction

**User Story:** As a player, I want the cave map to feel like a real underground cave, so that I have a visually distinct and immersive environment to fight in.

#### Acceptance Criteria

1. WHEN `buildMap('cave')` is called, THE `Map_Builder` SHALL construct a fully enclosed cave environment with a solid ceiling, floor, and boundary walls.
2. THE `Map_Builder` SHALL generate at least 4 distinct `Cavern` chambers, each with a unique index or identifier, so that individual caverns can be referenced by game logic.
3. EACH `Cavern` SHALL be connected to at least one other `Cavern` by a `Tunnel`, such that all caverns are reachable from any other cavern via tunnels.
4. EACH `Tunnel` SHALL connect exactly two distinct `Cavern` chambers and SHALL NOT pass through a third cavern.
5. THE `Map_Builder` SHALL place `Stalactite` formations hanging from the ceiling in cavern areas.
6. THE `Map_Builder` SHALL place `Stalagmite` formations rising from the floor in cavern areas.
7. THE `Map_Builder` SHALL place at least 6 `Crystal_Formation` clusters distributed across the map.
8. THE `Map_Builder` SHALL add at least one `Cave_Pool` decorative area in a cavern chamber.
9. THE `Map_Builder` SHALL use a seeded random number generator (the existing `mulberry32` function) so that the cave layout is deterministic across sessions.
10. WHEN `buildMap('cave')` is called, THE `Map_Builder` SHALL clear all previous scene objects and streaming state before constructing the cave, consistent with the behavior of all other maps.

---

### Requirement 3: Cave Lighting

**User Story:** As a player, I want the cave to be dimly lit with atmospheric colored light sources, so that the environment feels dangerous and immersive.

#### Acceptance Criteria

1. THE `Cave_Map` SHALL use a scene fog with a near distance of `15` and a far distance of `60` to simulate limited underground visibility.
2. THE `Cave_Map` SHALL set the scene background color to a near-black value (`0x050505` or darker).
3. WHEN `Crystal_Formation` clusters are placed, THE `Map_Builder` SHALL add a `THREE.PointLight` at each cluster position with a color in the blue-green spectrum (e.g., `0x4488ff`, `0x44ffaa`) and a range of `20`–`30` units.
4. THE `Cave_Map` SHALL include a directional light with intensity `0.1` or less to provide minimal fill lighting without overriding the cave atmosphere.
5. THE `Cave_Map` SHALL NOT use the day/night cycle (`gameState.dayNightActive` SHALL be set to `false` or left at its default `false` state for this map).

---

### Requirement 4: Cave Collision and Navigation

**User Story:** As a player, I want to be able to navigate the cave tunnels and chambers without clipping through walls, so that the map plays correctly.

#### Acceptance Criteria

1. WHEN the `Map_Builder` constructs `Tunnel` passages, THE `Obstacle_System` SHALL register all tunnel wall segments as collidable obstacles.
2. WHEN the `Map_Builder` constructs `Stalactite` and `Stalagmite` formations, THE `Obstacle_System` SHALL register formations with a base width greater than `0.8` units as collidable obstacles.
3. THE `Cave_Map` SHALL have a solid ceiling mesh that prevents the player from jumping above the cave roof.
4. THE `Cave_Map` SHALL maintain a minimum tunnel width of `4` units to allow the player (collision radius `0.3`) to navigate without getting stuck.
5. THE `Cave_Map` SHALL maintain a minimum tunnel height of `5` units to allow the player to move and jump freely.
6. WHEN `buildMap('cave')` is called, THE `Map_Builder` SHALL call `setWallBounds` with the cave boundary extents so that the existing boundary collision in `main.js` functions correctly.

---

### Requirement 5: Cave Ambient Audio

**User Story:** As a player, I want to hear cave-appropriate ambient sounds, so that the underground atmosphere is reinforced.

#### Acceptance Criteria

1. WHEN the cave map is active and the game is running, THE `Cave_Map` SHALL store a reference to any ambient audio node in `gameState` so that it can be stopped when the player quits to the menu.
2. IF the Web Audio API is unavailable, THEN THE `Cave_Map` SHALL start without ambient audio and continue functioning normally.

---

### Requirement 6: Zombie Spawn Cavern

**User Story:** As a player, I want all zombies in Zombie Apocalypse mode to spawn in a single designated cavern, so that the mode has a clear threat origin point and creates a distinct tactical dynamic.

#### Acceptance Criteria

1. THE `Map_Builder` SHALL designate exactly one `Cavern` as the `Zombie_Spawn_Cavern` and SHALL expose its bounds (center position and radius) in `gameState` so that the spawning system can reference it.
2. WHEN Zombie Apocalypse mode is active on the cave map, THE `Cave_Map` SHALL restrict all zombie spawn positions to within the bounds of the `Zombie_Spawn_Cavern`.
3. THE `Zombie_Spawn_Cavern` SHALL be large enough to accommodate at least 10 simultaneous zombie spawn positions without overlap, given that each zombie occupies a radius of `0.5` units.
4. WHEN the `Zombie_Spawn_Cavern` is selected by the `Map_Builder`, THE `Map_Builder` SHALL use the seeded random number generator so that the designated cavern is deterministic across sessions.
5. IF a zombie spawn position within the `Zombie_Spawn_Cavern` would fall outside the `130`-unit chunk-streaming spawn constraint, THEN THE `Cave_Map` SHALL clamp the spawn position to within `130` units of the origin.

---

### Requirement 7: Game Mode Compatibility

**User Story:** As a player, I want to play all three game modes on the cave map, so that I have full gameplay variety in the cave environment.

#### Acceptance Criteria

1. WHEN Zombie Apocalypse mode is started on the cave map, THE `Cave_Map` SHALL spawn all zombies exclusively within the `Zombie_Spawn_Cavern` bounds, consistent with Requirement 6.
2. WHEN Rescue Mission mode is started on the cave map, THE `Cave_Map` SHALL provide sufficient open space for the hostage and extraction zone to be placed without overlapping solid obstacles.
3. WHEN PvP Arena mode is started on the cave map, THE `Cave_Map` SHALL provide sufficient open space for the PvP enemy to spawn and navigate.
4. THE `Cave_Map` SHALL be listed in the map selection grid for all three game modes.

---

### Requirement 8: Map Selection Integration

**User Story:** As a player, I want the cave map to appear in the map selection screen with a name and description, so that I can identify and choose it.

#### Acceptance Criteria

1. WHEN the map selection screen is rendered, THE `Cave_Map` SHALL appear as a selectable option in the map grid alongside existing maps.
2. WHEN the player selects the cave map, THE `Map_Builder` SHALL be invoked with `'cave'` as the map identifier.
3. THE `Cave_Map` entry in the map grid SHALL display the map name `'Cave'` and its description text.
