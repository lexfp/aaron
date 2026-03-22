// tests/game.test.js — Unit tests for game.js

const {
  checkWinner,
  isDraw,
  getEmptyCells,
  getBotMoveEasy,
  getBotMoveHard,
  minimax,
} = require('../game.js');

// ── checkWinner ──────────────────────────────────────────────────────────────

describe('checkWinner', () => {
  // Rows
  test('detects top row winner (X)', () => {
    const cells = ['X','X','X', null,null,null, null,null,null];
    const result = checkWinner(cells);
    expect(result.winner).toBe('X');
    expect(result.line).toEqual([0,1,2]);
  });

  test('detects middle row winner (O)', () => {
    const cells = [null,null,null, 'O','O','O', null,null,null];
    const result = checkWinner(cells);
    expect(result.winner).toBe('O');
    expect(result.line).toEqual([3,4,5]);
  });

  test('detects bottom row winner (X)', () => {
    const cells = [null,null,null, null,null,null, 'X','X','X'];
    const result = checkWinner(cells);
    expect(result.winner).toBe('X');
    expect(result.line).toEqual([6,7,8]);
  });

  // Columns
  test('detects left column winner (O)', () => {
    const cells = ['O',null,null, 'O',null,null, 'O',null,null];
    const result = checkWinner(cells);
    expect(result.winner).toBe('O');
    expect(result.line).toEqual([0,3,6]);
  });

  test('detects middle column winner (X)', () => {
    const cells = [null,'X',null, null,'X',null, null,'X',null];
    const result = checkWinner(cells);
    expect(result.winner).toBe('X');
    expect(result.line).toEqual([1,4,7]);
  });

  test('detects right column winner (O)', () => {
    const cells = [null,null,'O', null,null,'O', null,null,'O'];
    const result = checkWinner(cells);
    expect(result.winner).toBe('O');
    expect(result.line).toEqual([2,5,8]);
  });

  // Diagonals
  test('detects top-left to bottom-right diagonal (X)', () => {
    const cells = ['X',null,null, null,'X',null, null,null,'X'];
    const result = checkWinner(cells);
    expect(result.winner).toBe('X');
    expect(result.line).toEqual([0,4,8]);
  });

  test('detects top-right to bottom-left diagonal (O)', () => {
    const cells = [null,null,'O', null,'O',null, 'O',null,null];
    const result = checkWinner(cells);
    expect(result.winner).toBe('O');
    expect(result.line).toEqual([2,4,6]);
  });

  // No winner cases
  test('returns null winner on empty board', () => {
    const cells = Array(9).fill(null);
    const result = checkWinner(cells);
    expect(result.winner).toBeNull();
    expect(result.line).toBeNull();
  });

  test('returns null on full board with no winner (draw)', () => {
    // X O X / O O X / X X O — no winner
    const cells = ['X','O','X', 'O','O','X', 'X','X','O'];
    const result = checkWinner(cells);
    expect(result.winner).toBeNull();
    expect(result.line).toBeNull();
  });
});

// ── isDraw ───────────────────────────────────────────────────────────────────

describe('isDraw', () => {
  test('returns true on full board with no winner', () => {
    const cells = ['X','O','X', 'O','O','X', 'X','X','O'];
    expect(isDraw(cells)).toBe(true);
  });

  test('returns false when board has empty cells', () => {
    const cells = ['X','O',null, null,null,null, null,null,null];
    expect(isDraw(cells)).toBe(false);
  });

  test('returns false when there is a winner (even all cells filled)', () => {
    // X wins top row; rest filled
    const cells = ['X','X','X', 'O','O','X', 'O','X','O'];
    expect(isDraw(cells)).toBe(false);
  });
});

// ── getEmptyCells ────────────────────────────────────────────────────────────

describe('getEmptyCells', () => {
  test('returns all 9 indices on empty board', () => {
    const cells = Array(9).fill(null);
    expect(getEmptyCells(cells)).toEqual([0,1,2,3,4,5,6,7,8]);
  });

  test('returns correct subset after some cells are filled', () => {
    const cells = ['X', null, 'O', null, 'X', null, null, null, null];
    expect(getEmptyCells(cells)).toEqual([1,3,5,6,7,8]);
  });

  test('returns empty array on full board', () => {
    const cells = ['X','O','X','O','X','O','O','X','O'];
    expect(getEmptyCells(cells)).toEqual([]);
  });
});

// ── getBotMoveEasy ───────────────────────────────────────────────────────────

describe('getBotMoveEasy', () => {
  test('returns an empty cell index', () => {
    const cells = ['X','O','X', null,'O',null, null,null,null];
    const move = getBotMoveEasy(cells);
    expect(cells[move]).toBeNull();
  });

  test('never returns an occupied cell index', () => {
    // Run many times to account for randomness
    const cells = ['X','O','X', null,'O',null, null,null,null];
    for (let i = 0; i < 50; i++) {
      const move = getBotMoveEasy(cells);
      expect(cells[move]).toBeNull();
    }
  });

  test('returns a value between 0 and 8 inclusive', () => {
    const cells = Array(9).fill(null);
    for (let i = 0; i < 20; i++) {
      const move = getBotMoveEasy(cells);
      expect(move).toBeGreaterThanOrEqual(0);
      expect(move).toBeLessThanOrEqual(8);
    }
  });
});

// ── getBotMoveHard ───────────────────────────────────────────────────────────

describe('getBotMoveHard', () => {
  test('picks the winning move when bot can win in one move (X)', () => {
    // X has 0,1 — taking 2 wins
    const cells = ['X','X',null, 'O','O',null, null,null,null];
    // bot = X, but O also wins at 5 — X should take 2 first
    // Actually bot = 'X', player = 'O': X wins at 2
    const move = getBotMoveHard(cells, 'X', 'O');
    expect(move).toBe(2);
  });

  test('blocks player winning move', () => {
    // O has 3,4 — would win at 5; bot is X
    const cells = ['X',null,null, 'O','O',null, null,null,null];
    const move = getBotMoveHard(cells, 'X', 'O');
    expect(move).toBe(5);
  });

  test('returns center (4) on empty board', () => {
    const cells = Array(9).fill(null);
    const move = getBotMoveHard(cells, 'X', 'O');
    expect(move).toBe(4);
  });

  test('never returns an occupied cell index', () => {
    const cells = ['X','O',null, null,'X',null, null,null,'O'];
    const move = getBotMoveHard(cells, 'X', 'O');
    expect(cells[move]).toBeNull();
  });

  test('returns a valid index between 0 and 8', () => {
    const cells = Array(9).fill(null);
    const move = getBotMoveHard(cells, 'O', 'X');
    expect(move).toBeGreaterThanOrEqual(0);
    expect(move).toBeLessThanOrEqual(8);
  });
});

// ── minimax ──────────────────────────────────────────────────────────────────

describe('minimax', () => {
  test('returns positive score when bot (X) has already won', () => {
    // X wins top row
    const board = ['X','X','X', 'O','O',null, null,null,null];
    // Board already has a winner; minimax should detect it immediately
    const score = minimax(board, false, 'X', 'O');
    expect(score).toBeGreaterThan(0);
  });

  test('returns negative score when player (O) has already won', () => {
    // O wins top row
    const board = ['O','O','O', 'X','X',null, null,null,null];
    const score = minimax(board, true, 'X', 'O');
    expect(score).toBeLessThan(0);
  });

  test('returns 0 for a draw board', () => {
    // Full board, no winner
    const board = ['X','O','X', 'O','O','X', 'X','X','O'];
    const score = minimax(board, true, 'X', 'O');
    expect(score).toBe(0);
  });
});
