// game.js — Pure game logic, no DOM access

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/**
 * Check if there is a winner on the board.
 * @param {Array} cells - Array of 9: null | 'X' | 'O'
 * @returns {{ winner: 'X'|'O'|null, line: number[]|null }}
 */
function checkWinner(cells) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
      return { winner: cells[a], line };
    }
  }
  return { winner: null, line: null };
}

/**
 * Check if the game is a draw.
 * @param {Array} cells - Array of 9: null | 'X' | 'O'
 * @returns {boolean}
 */
function isDraw(cells) {
  if (checkWinner(cells).winner !== null) return false;
  return cells.every((cell) => cell !== null);
}

/**
 * Get indices of empty cells.
 * @param {Array} cells - Array of 9: null | 'X' | 'O'
 * @returns {number[]}
 */
function getEmptyCells(cells) {
  return cells.reduce((acc, cell, i) => {
    if (cell === null) acc.push(i);
    return acc;
  }, []);
}

/**
 * Get a random empty cell index (easy bot).
 * @param {Array} cells - Array of 9: null | 'X' | 'O'
 * @returns {number}
 */
function getBotMoveEasy(cells) {
  const empty = getEmptyCells(cells);
  return empty[Math.floor(Math.random() * empty.length)];
}

/**
 * Minimax algorithm.
 * @param {Array} board - Array of 9: null | 'X' | 'O'
 * @param {boolean} isMaximizing - true if it's the bot's turn
 * @param {string} botSymbol - 'X' or 'O'
 * @param {string} playerSymbol - 'X' or 'O'
 * @returns {number} score (+10 bot wins, -10 player wins, 0 draw)
 */
function minimax(board, isMaximizing, botSymbol, playerSymbol) {
  const { winner } = checkWinner(board);
  if (winner === botSymbol) return 10;
  if (winner === playerSymbol) return -10;
  if (isDraw(board)) return 0;

  const empty = getEmptyCells(board);

  if (isMaximizing) {
    let best = -Infinity;
    for (const idx of empty) {
      board[idx] = botSymbol;
      best = Math.max(best, minimax(board, false, botSymbol, playerSymbol));
      board[idx] = null;
    }
    return best;
  } else {
    let best = Infinity;
    for (const idx of empty) {
      board[idx] = playerSymbol;
      best = Math.min(best, minimax(board, true, botSymbol, playerSymbol));
      board[idx] = null;
    }
    return best;
  }
}

/**
 * Get best move index for bot using minimax (hard difficulty).
 * @param {Array} cells - Array of 9: null | 'X' | 'O'
 * @param {string} botSymbol - 'X' or 'O'
 * @param {string} playerSymbol - 'X' or 'O'
 * @returns {number}
 */
function getBotMoveHard(cells, botSymbol, playerSymbol) {
  const empty = getEmptyCells(cells);
  if (empty.length === 0) return -1;

  let bestScore = -Infinity;
  let bestMove = empty[0];

  // Preferred move order: center first, then corners, then edges
  const MOVE_PRIORITY = [4, 0, 2, 6, 8, 1, 3, 5, 7];
  const orderedEmpty = MOVE_PRIORITY.filter((i) => cells[i] === null);

  for (const idx of orderedEmpty) {
    cells[idx] = botSymbol;
    const score = minimax(cells, false, botSymbol, playerSymbol);
    cells[idx] = null;
    if (score > bestScore) {
      bestScore = score;
      bestMove = idx;
    }
  }

  return bestMove;
}

if (typeof module !== 'undefined') {
  module.exports = {
    checkWinner,
    isDraw,
    getEmptyCells,
    getBotMoveEasy,
    getBotMoveHard,
    minimax,
  };
}
