// ui.js — All DOM manipulation for Tic-Tac-Toe vs. Bot

(function () {
  // Pull game functions from window (loaded via script tag in index.html)
  const { checkWinner, isDraw, getEmptyCells, getBotMoveEasy, getBotMoveHard } = window;

  // --- State ---
  let playerSymbol = 'X';
  let botSymbol = 'O';
  let difficulty = 'hard';
  let cells = Array(9).fill(null);
  let currentTurn = 'X'; // X always goes first
  let gameActive = false;

  // --- Element refs ---
  const selectionScreen = document.getElementById('selection-screen');
  const gameScreen = document.getElementById('game-screen');
  const playXBtn = document.getElementById('play-x');
  const playOBtn = document.getElementById('play-o');
  const difficultyToggle = document.getElementById('difficulty-toggle');
  const difficultyLabel = document.getElementById('difficulty-label');
  const boardEl = document.getElementById('board');
  const turnIndicator = document.getElementById('turn-indicator');
  const assignmentLabel = document.getElementById('assignment-label');
  const resultMessage = document.getElementById('result-message');
  const playAgainBtn = document.getElementById('play-again');

  // --- Difficulty toggle ---
  difficultyToggle.addEventListener('change', () => {
    difficulty = difficultyToggle.checked ? 'hard' : 'easy';
    difficultyLabel.textContent = difficultyToggle.checked ? 'Hard' : 'Easy';
  });

  // --- Symbol selection ---
  playXBtn.addEventListener('click', () => startGame('X'));
  playOBtn.addEventListener('click', () => startGame('O'));

  function startGame(chosenSymbol) {
    playerSymbol = chosenSymbol;
    botSymbol = chosenSymbol === 'X' ? 'O' : 'X';
    cells = Array(9).fill(null);
    currentTurn = 'X';
    gameActive = true;

    selectionScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');

    assignmentLabel.textContent = `You: ${playerSymbol}  |  Bot: ${botSymbol}  |  ${difficulty === 'hard' ? 'Hard' : 'Easy'}`;
    resultMessage.textContent = '';
    resultMessage.classList.add('hidden');
    playAgainBtn.classList.add('hidden');

    renderBoard();
    updateTurnIndicator();

    // If player chose O, bot (X) moves first
    if (playerSymbol === 'O') {
      setTurnIndicator('Bot is thinking...');
      setTimeout(doBotMove, 400);
    }
  }

  // --- Board rendering ---
  function renderBoard() {
    boardEl.innerHTML = '';
    cells.forEach((val, i) => {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.index = i;
      if (val) {
        cell.textContent = val;
        cell.classList.add('filled');
      }
      cell.addEventListener('click', handleCellClick);
      boardEl.appendChild(cell);
    });
  }

  function highlightWinningCells(line) {
    if (!line) return;
    const cellEls = boardEl.querySelectorAll('.cell');
    line.forEach((i) => cellEls[i].classList.add('winning'));
  }

  // --- Turn indicator ---
  function setTurnIndicator(text) {
    turnIndicator.textContent = text;
  }

  function updateTurnIndicator() {
    if (currentTurn === playerSymbol) {
      setTurnIndicator('Your turn');
    } else {
      setTurnIndicator('Bot is thinking...');
    }
  }

  // --- Player click ---
  function handleCellClick(e) {
    if (!gameActive) return;
    if (currentTurn !== playerSymbol) return;

    const idx = parseInt(e.currentTarget.dataset.index, 10);
    if (cells[idx] !== null) return;

    makeMove(idx, playerSymbol);

    if (!gameActive) return;

    // Bot's turn
    currentTurn = botSymbol;
    setTurnIndicator('Bot is thinking...');
    setTimeout(doBotMove, 400);
  }

  // --- Bot move ---
  function doBotMove() {
    if (!gameActive) return;
    const idx =
      difficulty === 'hard'
        ? getBotMoveHard(cells.slice(), botSymbol, playerSymbol)
        : getBotMoveEasy(cells.slice());

    if (idx === -1 || idx === undefined) return;
    makeMove(idx, botSymbol);

    if (gameActive) {
      currentTurn = playerSymbol;
      updateTurnIndicator();
    }
  }

  // --- Make a move ---
  function makeMove(idx, symbol) {
    cells[idx] = symbol;
    renderBoard();

    const { winner, line } = checkWinner(cells);
    if (winner) {
      gameActive = false;
      highlightWinningCells(line);
      showResult(winner === playerSymbol ? 'You win!' : 'Bot wins!');
      return;
    }
    if (isDraw(cells)) {
      gameActive = false;
      showResult("It's a draw!");
      return;
    }
  }

  // --- Result ---
  function showResult(msg) {
    resultMessage.textContent = msg;
    resultMessage.classList.remove('hidden');
    playAgainBtn.classList.remove('hidden');
    setTurnIndicator('');
  }

  // --- Play Again ---
  playAgainBtn.addEventListener('click', () => {
    gameScreen.classList.add('hidden');
    selectionScreen.classList.remove('hidden');
    cells = Array(9).fill(null);
    gameActive = false;
    boardEl.innerHTML = '';
    resultMessage.textContent = '';
    turnIndicator.textContent = '';
  });
})();
