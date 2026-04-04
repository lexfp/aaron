# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Instructions for Claude

Do not make any changes until you have 95% confidence in what you need to build. Keep prompting until that level of confidence is reached. 
Always keep this file updated as thoroughly as possible. After any significant changes — new features, new files, architecture changes, new commands — update CLAUDE.md to reflect them. 


## Repository Overview

A collection of independent browser games and tools, each in its own directory. There is no monorepo build system — projects are self-contained. The main `index.html` is a portfolio hub hosted on GitHub Pages.

## Projects & Commands

### war_zone/ — 3D Tactical Shooter (Three.js)
No build step. Open `war_zone/war_zone.html` directly in a browser. Three.js is loaded from CDN. All game logic lives in `js/`.

### tic-tac-toe-bot/ — Bot with Minimax AI (Vanilla JS + Jest)
```bash
npm install --prefix tic-tac-toe-bot   # first time only
npm test --prefix tic-tac-toe-bot       # run tests
npm test --prefix tic-tac-toe-bot -- --watch  # watch mode
```
Open `tic-tac-toe-bot/index.html` directly in a browser to play.

### dog_clicker/ — Flutter Game
```bash
cd dog_clicker
flutter pub get   # install deps
flutter run       # run on device/emulator
flutter build web
flutter test
```

### cosmicVentures/ — Browser Game / Chrome Extension
Open any `cosmic-ventures*.html` directly in a browser. For the Chrome extension variant (`cv-ext/`): load unpacked via `chrome://extensions` with Developer Mode enabled.

### auto_clicker_extension/ — Chrome Extension (MV3)
Load unpacked via `chrome://extensions` with Developer Mode enabled.

## Architecture

### war_zone — Modular JS Game Engine
Nine JS modules loaded in order via `<script>` tags in `war_zone.html`. No bundler.

| File | Responsibility |
|------|---------------|
| `main.js` | Game loop, screen management, state updates |
| `map.js` | Terrain generation (city, mountain, crater map types) |
| `entities.js` | Enemy/NPC spawning and AI |
| `weapons.js` | Weapon definitions, ammo, reload |
| `combat.js` | Hit detection, damage, knockback |
| `ui.js` | HUD rendering (health, ammo, money, kill stats) |
| `input.js` | Keyboard (WASD/shift/space) and mouse aim |
| `data.js` | Game config constants |
| `state.js` | Shared game state object |

Map types: city (grid roads/sidewalks), mountain (all-slope terrain), crater (pit terrain). Game modes: Zombie Apocalypse, Rescue Mission, PvP Arena. Weapons: Fists, Glock, Assault Rifle, Sniper, RPG, Minigun, and melee weapons.

### tic-tac-toe-bot — Logic/UI Separation
- `game.js`: Pure functions only — no DOM access. Contains minimax algorithm (`getBotMoveHard`) and random AI (`getBotMoveEasy`). Exports to `window` for testability.
- `ui.js`: IIFE managing all DOM interaction, event listeners, and game state (`playerSymbol`, `botSymbol`, `difficulty`, `cells`).
- Tests in `tests/` use Jest 29 with no DOM dependency.

### dog_clicker — Flutter Clean Architecture + BLoC
```
lib/
  core/        # shared utilities, service locator
  data/        # repositories, data sources
  domain/      # use cases, entity models
  presentation/ # BLoC state management, pages, widgets
  injection.dart # get_it dependency injection setup
```
Key dependencies: `flutter_bloc`, `get_it`, `dartz` (Either/Option), `equatable`.

### cosmicVentures/cv-ext — Chrome Extension (MV3)
Runs entirely in an 800×580px popup. `game.js` + `game.css` are self-contained with no external dependencies.

### auto_clicker_extension — Chrome Extension (MV3)
- `popup.html/js/css`: UI for keybind configuration
- `content.js`: Injected into pages to detect and click elements
- `background.js`: Service worker handling click automation timing

## Applied Learning
When something fails repeatedly or there is a workaround/easier way to do something, add a one-line bullet point less than 15 words mentioning it to save time in the future

  -