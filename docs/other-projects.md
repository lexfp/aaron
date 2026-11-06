# tic-tac-toe-bot, dog_clicker, cosmicVentures, auto_clicker_extension — reference

Moved out of `CLAUDE.md` (which keeps only the rules): commands and architecture for the smaller projects.

## tic-tac-toe-bot/ — Bot with Minimax AI (Vanilla JS + Jest)

```bash
npm install --prefix tic-tac-toe-bot   # first time only
npm test --prefix tic-tac-toe-bot       # run tests
npm test --prefix tic-tac-toe-bot -- --watch  # watch mode
```
Open `tic-tac-toe-bot/index.html` directly in a browser to play.

### Architecture — logic/UI separation

- `game.js`: Pure functions only — no DOM access. Contains minimax algorithm (`getBotMoveHard`) and random AI (`getBotMoveEasy`). Exports to `window` for testability.
- `ui.js`: IIFE managing all DOM interaction, event listeners, and game state (`playerSymbol`, `botSymbol`, `difficulty`, `cells`).
- Tests in `tests/` use Jest 29 with no DOM dependency.

See also `tic-tac-toe-bot/README.md`.

## dog_clicker/ — Flutter game

```bash
cd dog_clicker
flutter pub get   # install deps
flutter run       # run on device/emulator
flutter build web
flutter test
```

### Architecture — Flutter clean architecture + BLoC

```
lib/
  core/        # shared utilities, service locator
  data/        # repositories, data sources
  domain/      # use cases, entity models
  presentation/ # BLoC state management, pages, widgets
  injection.dart # get_it dependency injection setup
```
Key dependencies: `flutter_bloc`, `get_it`, `dartz` (Either/Option), `equatable`.

## cosmicVentures/ — browser game / Chrome extension

Open any `cosmic-ventures*.html` directly in a browser. For the Chrome extension variant (`cv-ext/`): load unpacked via `chrome://extensions` with Developer Mode enabled.

### cv-ext — Chrome extension (MV3)

Runs entirely in an 800×580px popup. `game.js` + `game.css` are self-contained with no external dependencies.

See also `cosmicVentures/cv-ext/README.md`.

## auto_clicker_extension/ — Chrome extension (MV3)

Load unpacked via `chrome://extensions` with Developer Mode enabled.

- `popup.html/js/css`: UI for keybind configuration
- `content.js`: Injected into pages to detect and click elements
- `background.js`: Service worker handling click automation timing
