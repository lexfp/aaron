# Tic-Tac-Toe vs. Bot

A browser-based Tic-Tac-Toe game where you play against an AI bot with two difficulty levels.

## How to Play

1. Open `index.html` in any modern web browser — no build step or server required.
2. On the selection screen, choose whether you want to play as **X** or **O**.
3. Select your preferred difficulty (Easy or Hard) using the toggle.
4. Click a cell to make your move. The bot will respond automatically.
5. The game ends when someone wins or all cells are filled (draw).
6. Click **Play Again** to return to the selection screen and start a new game.

## Difficulty Modes

| Mode  | Behaviour |
|-------|-----------|
| Easy  | Bot picks a random empty cell — beatable with any strategy. |
| Hard  | Bot uses the **minimax** algorithm and plays perfectly. The best you can do is a draw. |

> **Note:** X always moves first. If you choose O, the bot (playing X) will make the first move automatically after a short delay.

## Project Structure

```
tic-tac-toe-bot/
├── index.html          # Main entry point
├── style.css           # All styling
├── game.js             # Pure game logic (no DOM), exports for Node/browser
├── ui.js               # DOM manipulation and game loop
├── jest.config.js      # Jest configuration
├── package.json        # npm scripts & dev dependencies
└── tests/
    ├── game.test.js        # Unit tests for all game.js functions
    └── integration.test.js # Full-sequence integration tests
```

## Running Tests

```bash
# Install dependencies (first time only)
npm install

# Run all tests
npm test
```

All tests run in Node via Jest — no browser needed.

## Tech Stack

- **Vanilla HTML / CSS / JavaScript** — zero runtime dependencies, no frameworks.
- **Jest 29** — unit and integration testing.
- **Minimax algorithm** — optimal AI decision-making for Hard difficulty.
