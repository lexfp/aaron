// tests/integration.test.js — Integration tests for Tic-Tac-Toe game logic

const {
  checkWinner,
  isDraw,
  getEmptyCells,
  getBotMoveEasy,
  getBotMoveHard,
} = require('../game.js');

// ── 1. Player (X) wins via top row ───────────────────────────────────────────

test('Player (X) wins via top row after simulated sequence', () => {
  const cells = Array(9).fill(null);

  // player takes 0
  cells[0] = 'X';
  // bot takes 4
  cells[4] = 'O';
  // player takes 1
  cells[1] = 'X';
  // bot takes 8
  cells[8] = 'O';
  // player takes 2
  cells[2] = 'X';

  const result = checkWinner(cells);
  expect(result.winner).toBe('X');
  expect(result.line).toEqual([0, 1, 2]);
});

// ── 2. Bot (Hard, X) wins in one ─────────────────────────────────────────────

test('Hard bot (X) picks winning move when it can win in one', () => {
  // X has positions 0 and 1; index 2 is the winning move
  const cells = ['X', 'X', null, 'O', 'O', null, null, null, null];
  // Note: O also threatens at 5, but X wins first — bot should pick 2
  const move = getBotMoveHard(cells, 'X', 'O');
  expect(move).toBe(2);
});

// ── 3. Bot (Hard) blocks player ───────────────────────────────────────────────

test('Hard bot (X) blocks player (O) from winning', () => {
  // O has positions 3 and 4; would win at 5
  // X must block at 5
  const cells = ['X', null, null, 'O', 'O', null, null, null, null];
  const move = getBotMoveHard(cells, 'X', 'O');
  expect(move).toBe(5);
});

// ── 4. Full game draw with two optimal players ────────────────────────────────

test('Two optimal (Hard) players eventually draw', () => {
  const cells = Array(9).fill(null);
  let currentSymbol = 'X';
  const botSymbol = 'X';
  const playerSymbol = 'O';
  let turnCount = 0;
  const maxTurns = 9;

  while (turnCount < maxTurns) {
    const { winner } = checkWinner(cells);
    if (winner) break;
    if (isDraw(cells)) break;

    let move;
    if (currentSymbol === botSymbol) {
      move = getBotMoveHard(cells, botSymbol, playerSymbol);
    } else {
      move = getBotMoveHard(cells, playerSymbol, botSymbol);
    }

    if (move === -1 || move === undefined) break;
    cells[move] = currentSymbol;
    currentSymbol = currentSymbol === 'X' ? 'O' : 'X';
    turnCount++;
  }

  expect(isDraw(cells)).toBe(true);
});

// ── 5. Player chooses O, bot moves first ─────────────────────────────────────

test('When player is O, bot (X) can make a valid first move on empty board', () => {
  const cells = Array(9).fill(null);
  const botSymbol = 'X';
  const playerSymbol = 'O';

  const move = getBotMoveHard(cells, botSymbol, playerSymbol);

  expect(move).toBeGreaterThanOrEqual(0);
  expect(move).toBeLessThanOrEqual(8);
  expect(cells[move]).toBeNull(); // cell was empty before the move
});

// ── 6. Easy bot loses to perfect minimax player ───────────────────────────────

test('Perfect player (X, minimax) can beat easy bot (O)', () => {
  // Run multiple trials; at least one should result in X winning
  let xWon = false;

  for (let trial = 0; trial < 20; trial++) {
    const cells = Array(9).fill(null);
    let currentSymbol = 'X';
    const xSymbol = 'X';
    const oSymbol = 'O';
    let turnCount = 0;

    while (turnCount < 9) {
      const { winner } = checkWinner(cells);
      if (winner) {
        if (winner === xSymbol) xWon = true;
        break;
      }
      if (isDraw(cells)) break;

      let move;
      if (currentSymbol === xSymbol) {
        // Perfect player uses hard minimax
        move = getBotMoveHard(cells, xSymbol, oSymbol);
      } else {
        // Easy bot is random
        move = getBotMoveEasy(cells);
      }

      if (move === -1 || move === undefined) break;
      cells[move] = currentSymbol;
      currentSymbol = currentSymbol === 'X' ? 'O' : 'X';
      turnCount++;
    }

    if (xWon) break;
  }

  // Perfect player should win (or at worst draw) against random; should win at least once
  expect(xWon).toBe(true);
});
