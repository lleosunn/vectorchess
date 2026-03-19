const BOARD_SIZE = 8;
const MAX_HAND = 5;
const VECTOR_VALUES = [-2, -1, 0, 1, 2];
const SCALAR_VALUES = [-1, 2];
const SPECIAL_SQUARES = [[3,2],[5,3],[4,5],[2,4]];
const KING_DIRS = [[0,1],[0,-1],[1,0],[-1,0]];

let state;

function isSpecialSquare(x, y) {
  return SPECIAL_SQUARES.some(([sx, sy]) => sx === x && sy === y);
}

function createDecks() {
  const vectors = [];
  for (const x of VECTOR_VALUES) {
    for (const y of VECTOR_VALUES) {
      if (x === 0 && y === 0) continue;
      vectors.push({ type: 'vector', x, y });
    }
  }
  shuffle(vectors);

  const scalars = [];
  for (let i = 0; i < 10; i++) scalars.push({ type: 'scalar', value: -1 });
  for (let i = 0; i < 10; i++) scalars.push({ type: 'scalar', value: 2 });
  shuffle(scalars);

  return { vectors, scalars };
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

function initGame() {
  const decks = createDecks();
  state = {
    // board[row][col] stores null or { player, id }
    board: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null)),
    dead: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(false)),
    pieces: {
      white: [
        { id: 0, x: 0, y: 0, alive: true },
        { id: 1, x: 7, y: 0, alive: true }
      ],
      black: [
        { id: 0, x: 7, y: 7, alive: true },
        { id: 1, x: 0, y: 7, alive: true }
      ]
    },
    hands: { white: [], black: [] },
    decks,
    turn: 'white',
    phase: 'draw',       // 'draw' | 'move' | 'bonus-draw'
    moveMode: 'king',
    selectedPiece: 0,
    lcTerms: [],
    lastMove: null,
    log: [],
    gameOver: false
  };

  for (const player of ['white', 'black']) {
    for (const p of state.pieces[player]) {
      state.board[p.y][p.x] = { player, id: p.id };
    }
  }

  document.getElementById('game-over').classList.add('hidden');
  addLog('system', 'Game started. White goes first.');
  render();
}

function addLog(type, msg) { state.log.push({ type, msg }); }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function currentHand() { return state.hands[state.turn]; }
function opponent() { return state.turn === 'white' ? 'black' : 'white'; }
function inBounds(x, y) { return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE; }

function orientVec(vx, vy, player) {
  return player === 'white' ? { x: vx, y: vy } : { x: -vx, y: -vy };
}

function getSelectedPiece() {
  return state.pieces[state.turn][state.selectedPiece];
}

function alivePieces(player) {
  return state.pieces[player].filter(p => p.alive);
}

function isFriendly(x, y, player) {
  const cell = state.board[y][x];
  return cell && cell.player === player;
}

function getKingMoves(player, piece) {
  const moves = [];
  for (const [dx, dy] of KING_DIRS) {
    const nx = piece.x + dx, ny = piece.y + dy;
    if (inBounds(nx, ny) && !state.dead[ny][nx] && !isFriendly(nx, ny, player)) {
      moves.push({ x: nx, y: ny });
    }
  }
  return moves;
}

function computeLCTarget(player, piece, terms) {
  const hand = state.hands[player];
  let sx = 0, sy = 0;
  for (const t of terms) {
    const vc = hand[t.vecIdx];
    const scalar = t.scalarIdx !== null ? hand[t.scalarIdx].value : 1;
    const o = orientVec(vc.x, vc.y, player);
    sx += o.x * scalar;
    sy += o.y * scalar;
  }
  return { dx: sx, dy: sy, x: piece.x + sx, y: piece.y + sy };
}

function isLCMoveValid(player, piece, terms) {
  if (terms.length === 0) return false;
  const t = computeLCTarget(player, piece, terms);
  if (t.dx === 0 && t.dy === 0) return false;
  return inBounds(t.x, t.y) && !state.dead[t.y][t.x] && !isFriendly(t.x, t.y, player);
}

function getAllLegalMovesForPiece(player, piece) {
  const moves = new Set();
  for (const m of getKingMoves(player, piece)) moves.add(`${m.x},${m.y}`);

  const hand = state.hands[player];
  const vecIdxs = hand.map((c, i) => c.type === 'vector' ? i : -1).filter(i => i >= 0);
  const scalIdxs = hand.map((c, i) => c.type === 'scalar' ? i : -1).filter(i => i >= 0);

  const nv = vecIdxs.length;
  for (let mask = 1; mask < (1 << nv); mask++) {
    const selVecs = [];
    for (let b = 0; b < nv; b++) if (mask & (1 << b)) selVecs.push(vecIdxs[b]);

    (function enumerate(vi, usedScalars, terms) {
      if (vi === selVecs.length) {
        const t = computeLCTarget(player, piece, terms);
        if ((t.dx !== 0 || t.dy !== 0) && inBounds(t.x, t.y) && !state.dead[t.y][t.x] && !isFriendly(t.x, t.y, player)) {
          moves.add(`${t.x},${t.y}`);
        }
        return;
      }
      terms.push({ vecIdx: selVecs[vi], scalarIdx: null });
      enumerate(vi + 1, usedScalars, terms);
      terms.pop();

      for (const si of scalIdxs) {
        if (usedScalars.has(si)) continue;
        usedScalars.add(si);
        terms.push({ vecIdx: selVecs[vi], scalarIdx: si });
        enumerate(vi + 1, usedScalars, terms);
        terms.pop();
        usedScalars.delete(si);
      }
    })(0, new Set(), []);
  }
  return moves;
}

function getAllLegalMoves(player) {
  const all = new Set();
  for (const p of alivePieces(player)) {
    for (const m of getAllLegalMovesForPiece(player, p)) all.add(m);
  }
  return all;
}

// ---- ACTIONS ----

function drawCard(pileType) {
  if (state.gameOver) return;
  if (state.phase !== 'draw' && state.phase !== 'bonus-draw') return;
  const hand = currentHand();
  if (state.phase === 'draw' && hand.length >= MAX_HAND) return;
  const pile = pileType === 'vector' ? state.decks.vectors : state.decks.scalars;
  if (pile.length === 0) return;
  const card = pile.pop();
  hand.push(card);
  const label = card.type === 'vector' ? `[${card.x}, ${card.y}]` : `×${card.value}`;
  addLog(state.turn, `Drew ${card.type}: ${label}`);

  if (state.phase === 'bonus-draw') {
    state.phase = 'done-bonus';
    endTurn();
    return;
  }
  enterMovePhase();
}

function skipBonusDraw() {
  if (state.gameOver || state.phase !== 'bonus-draw') return;
  addLog(state.turn, 'Skipped bonus draw.');
  state.phase = 'done-bonus';
  endTurn();
}

function enterMovePhase() {
  state.phase = 'move';
  state.moveMode = 'king';
  state.lcTerms = [];
  const alive = alivePieces(state.turn);
  state.selectedPiece = alive[0].id;
  if (getAllLegalMoves(state.turn).size === 0) {
    endGame(opponent(), `${capitalize(state.turn)} has no legal moves!`);
    return;
  }
  render();
}

function selectPiece(pieceId) {
  if (state.gameOver || state.phase !== 'move') return;
  const p = state.pieces[state.turn][pieceId];
  if (!p.alive) return;
  state.selectedPiece = pieceId;
  state.lcTerms = [];
  render();
}

function setMoveMode(mode) {
  if (state.gameOver) return;
  state.moveMode = mode;
  state.lcTerms = [];
  render();
}

function lcToggleVec(vecIdx) {
  const existing = state.lcTerms.findIndex(t => t.vecIdx === vecIdx);
  if (existing >= 0) {
    state.lcTerms.splice(existing, 1);
  } else {
    state.lcTerms.push({ vecIdx, scalarIdx: null });
  }
  render();
}

function lcSetScalar(termIdx, scalarIdx) {
  state.lcTerms[termIdx].scalarIdx = scalarIdx;
  render();
}

function lcConfirm() {
  const piece = getSelectedPiece();
  if (!isLCMoveValid(state.turn, piece, state.lcTerms)) return;
  const target = computeLCTarget(state.turn, piece, state.lcTerms);
  executeMove(target.x, target.y, 'lc');
}

function tryKingMove(tx, ty) {
  if (state.gameOver || state.phase !== 'move' || state.moveMode !== 'king') return;
  const piece = getSelectedPiece();
  const moves = getKingMoves(state.turn, piece);
  if (!moves.find(m => m.x === tx && m.y === ty)) return;
  executeMove(tx, ty, 'king');
}

function executeMove(tx, ty, mode) {
  const player = state.turn;
  const piece = getSelectedPiece();
  const fx = piece.x, fy = piece.y;
  const target = state.board[ty][tx];
  const captured = target && target.player === opponent();

  state.dead[fy][fx] = true;
  state.board[fy][fx] = null;
  state.board[ty][tx] = { player, id: piece.id };
  piece.x = tx;
  piece.y = ty;

  let desc = `P${piece.id + 1} (${fx},${fy})→(${tx},${ty})`;

  if (mode === 'lc') {
    const hand = currentHand();
    const parts = [];
    const removeIdxs = new Set();
    for (const t of state.lcTerms) {
      const vc = hand[t.vecIdx];
      removeIdxs.add(t.vecIdx);
      if (t.scalarIdx !== null) {
        parts.push(`${hand[t.scalarIdx].value}·[${vc.x},${vc.y}]`);
        removeIdxs.add(t.scalarIdx);
      } else {
        parts.push(`[${vc.x},${vc.y}]`);
      }
    }
    desc += ` ${parts.join(' + ')}`;
    const sorted = [...removeIdxs].sort((a, b) => b - a);
    for (const i of sorted) hand.splice(i, 1);
  } else {
    desc += ' (king)';
  }

  if (captured) {
    const capPiece = state.pieces[opponent()].find(p => p.id === target.id);
    capPiece.alive = false;
    desc += ' ★ capture!';
  }

  addLog(player, desc);
  state.lastMove = { fx, fy, tx, ty };

  if (captured && alivePieces(opponent()).length === 0) {
    endGame(player, `${capitalize(player)} captured all of ${capitalize(opponent())}'s pieces!`);
    return;
  }

  if (isSpecialSquare(tx, ty)) {
    const canDraw = state.decks.vectors.length > 0 || state.decks.scalars.length > 0;
    if (canDraw) {
      addLog('system', `✦ Special square! ${capitalize(player)} may draw a bonus card.`);
      state.phase = 'bonus-draw';
      state.moveMode = 'king';
      state.lcTerms = [];
      render();
      return;
    }
  }

  endTurn();
}

function endTurn() {
  state.turn = opponent();
  state.phase = 'draw';
  state.moveMode = 'king';
  state.lcTerms = [];
  state.selectedPiece = alivePieces(state.turn)[0].id;

  const hand2 = currentHand();
  const canDraw = hand2.length < MAX_HAND &&
    (state.decks.vectors.length > 0 || state.decks.scalars.length > 0);
  if (!canDraw) {
    addLog(state.turn, hand2.length >= MAX_HAND ? 'Hand full — auto-skip draw.' : 'No cards left — auto-skip draw.');
    state.phase = 'move';
    state.moveMode = 'king';
    state.lcTerms = [];
    if (getAllLegalMoves(state.turn).size === 0) {
      endGame(opponent(), `${capitalize(state.turn)} has no legal moves!`);
      return;
    }
  }
  render();
}

function endGame(winner, reason) {
  state.gameOver = true;
  addLog('system', reason);
  render();
  document.getElementById('game-over-title').innerHTML =
    `<span class="winner-name ${winner}">${capitalize(winner)}</span> Wins!`;
  document.getElementById('game-over-msg').textContent = reason;
  document.getElementById('game-over').classList.remove('hidden');
}
