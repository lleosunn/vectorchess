function render() {
  renderSide('white');
  renderSide('black');
  renderCenter();
  renderLog();
}

function renderSide(player) {
  const container = document.getElementById(`side-${player}`);
  const isActive = state.turn === player && !state.gameOver;
  const hand = state.hands[player];

  let html = '';

  let badgeClass = 'waiting';
  let badgeText = 'Waiting';
  if (isActive) {
    if (state.phase === 'draw') { badgeClass = 'active-draw'; badgeText = 'Draw Phase'; }
    else if (state.phase === 'bonus-draw') { badgeClass = 'active-draw'; badgeText = 'Bonus Draw!'; }
    else { badgeClass = 'active-move'; badgeText = 'Move Phase'; }
  }
  html += `<div class="side-header">
    <div class="player-label ${player}">${capitalize(player)}</div>
    <div class="phase-badge ${badgeClass}">${badgeText}</div>
  </div>`;

  html += renderBoardHTML(player, isActive);

  html += `<div class="panel">
    <h3>${capitalize(player)}'s Hand (${hand.length}/${MAX_HAND})</h3>
    <div class="hand-area">${renderHandHTML(player, isActive)}</div>
  </div>`;

  container.innerHTML = html;
}

function renderBoardHTML(player, isActive) {
  const isMyMove = isActive && state.phase === 'move';
  const piece = isMyMove ? getSelectedPiece() : null;
  let moveSet = new Set();

  if (isMyMove && state.moveMode === 'king' && piece) {
    for (const m of getKingMoves(player, piece)) moveSet.add(`${m.x},${m.y}`);
  }
  if (isMyMove && state.moveMode === 'lc' && piece && isLCMoveValid(player, piece, state.lcTerms)) {
    const t = computeLCTarget(player, piece, state.lcTerms);
    moveSet.add(`${t.x},${t.y}`);
  }

  const flipped = player === 'black';
  let h = '<div class="board-wrapper"><div class="board">';

  for (let ri = 0; ri < BOARD_SIZE; ri++) {
    for (let ci = 0; ci < BOARD_SIZE; ci++) {
      const row = flipped ? ri : (BOARD_SIZE - 1 - ri);
      const col = flipped ? (BOARD_SIZE - 1 - ci) : ci;
      const isLight = (row + col) % 2 === 0;
      let cls = `cell ${isLight ? 'light' : 'dark'}`;

      const isSpecial = isSpecialSquare(col, row);
      if (isSpecial && !state.dead[row][col]) cls += ' special';

      if (state.dead[row][col]) cls += ' dead';

      if (state.lastMove) {
        if (col === state.lastMove.tx && row === state.lastMove.ty) cls += ' last-to';
        if (col === state.lastMove.fx && row === state.lastMove.fy) cls += ' last-from';
      }

      const cell = state.board[row][col];
      let inner = '';
      let clickHandler = '';

      if (cell) {
        const icon = cell.player === 'white' ? '♔' : '♚';
        inner = `<span class="king ${cell.player}">${icon}</span>`;

        if (isMyMove && cell.player === player) {
          if (cell.id === state.selectedPiece) {
            cls += ' selected-piece';
          } else {
            cls += ' selectable-piece';
            clickHandler = `onclick="selectPiece(${cell.id})"`;
          }
        }
      }

      const isMovable = moveSet.has(`${col},${row}`);
      if (isMovable) {
        cls += ' movable';
        if (cell && cell.player !== player) cls += ' has-piece';

        if (state.moveMode === 'king') {
          clickHandler = `onclick="tryKingMove(${col},${row})"`;
        }
      }

      h += `<div class="${cls}" ${clickHandler}>${inner}</div>`;
    }
  }

  h += '</div></div>';
  return h;
}

function renderHandHTML(player, isActive) {
  const hand = state.hands[player];
  if (hand.length === 0) return '<div class="empty-hand">No cards</div>';

  const isLCMode = isActive && state.phase === 'move' && state.moveMode === 'lc';
  const lcVecIdxs = new Set(state.lcTerms.map(t => t.vecIdx));
  const lcScalIdxs = new Set(state.lcTerms.filter(t => t.scalarIdx !== null).map(t => t.scalarIdx));

  let h = '';
  hand.forEach((card, idx) => {
    let cls = `card ${card.type}`;
    let click = '';

    if (isLCMode && card.type === 'vector') {
      cls += ' clickable';
      if (lcVecIdxs.has(idx)) cls += ' selected-card';
      click = `onclick="lcToggleVec(${idx})"`;
    }

    if (card.type === 'vector') {
      h += `<div class="${cls}" ${click}>
        <div class="card-tag">VEC</div>
        <div class="card-val">[${card.x}]<br>[${card.y}]</div>
      </div>`;
    } else {
      let selCls = '';
      if (isLCMode && lcScalIdxs.has(idx)) selCls = ' selected-card';
      h += `<div class="${cls}${selCls}">
        <div class="card-tag">×</div>
        <div class="card-val">${card.value}</div>
      </div>`;
    }
  });
  return h;
}

function renderCenter() {
  const di = document.getElementById('deck-info');
  di.innerHTML = `<h3>Decks</h3>
    <span>Vectors: ${state.decks.vectors.length}</span>
    <span>Scalars: ${state.decks.scalars.length}</span>`;

  const mp = document.getElementById('move-panel');
  const player = state.turn;
  const isActive = !state.gameOver;
  const hand = state.hands[player];

  let phaseLabel = 'Draw Phase';
  if (state.phase === 'move') phaseLabel = 'Move Phase';
  else if (state.phase === 'bonus-draw') phaseLabel = 'Bonus Draw!';

  let html = `<div class="turn-banner">
    <div class="turn-label ${player}">${capitalize(player)}'s Turn</div>
    <div class="turn-phase">${phaseLabel}</div>
  </div>`;

  if (isActive && state.phase === 'bonus-draw') {
    const full = hand.length >= MAX_HAND;
    const noVec = state.decks.vectors.length === 0;
    const noScal = state.decks.scalars.length === 0;
    html += `<div class="bonus-draw-msg">✦ Landed on a special square!</div>`;
    html += `<h3>Bonus Draw</h3>
    <div class="draw-row">
      <button class="draw-btn" onclick="drawCard('vector')" ${full || noVec ? 'disabled' : ''}>
        Vector<span class="pile-ct">${state.decks.vectors.length} left</span>
      </button>
      <button class="draw-btn" onclick="drawCard('scalar')" ${full || noScal ? 'disabled' : ''}>
        Scalar<span class="pile-ct">${state.decks.scalars.length} left</span>
      </button>
    </div>
    <button class="mode-btn" style="width:100%;margin-top:6px" onclick="skipBonusDraw()">Skip Bonus</button>`;
  } else if (isActive && state.phase === 'move') {
    const alive = alivePieces(player);
    const hasVecs = hand.some(c => c.type === 'vector');

    if (alive.length > 1) {
      html += `<h3>Select Piece</h3>
      <div class="piece-select-row">`;
      alive.forEach((p, i) => {
        const active = state.selectedPiece === p.id ? ' active' : '';
        html += `<button class="piece-btn${active}" onclick="selectPiece(${p.id})">
          Piece ${p.id + 1}<span class="piece-pos">(${p.x},${p.y})</span>
        </button>`;
      });
      html += '</div>';
    }

    html += `<h3>Move</h3>
    <div class="mode-row">
      <button class="mode-btn ${state.moveMode === 'king' ? 'active' : ''}" onclick="setMoveMode('king')">
        King Move<span class="mode-sub">↑↓←→</span>
      </button>
      <button class="mode-btn ${state.moveMode === 'lc' ? 'active' : ''}" onclick="setMoveMode('lc')" ${hasVecs ? '' : 'disabled'}>
        Linear Combo<span class="mode-sub">Σ aᵢvᵢ</span>
      </button>
    </div>
    ${state.moveMode === 'lc' ? renderLCBuilder(player) : ''}`;
  } else if (isActive && state.phase === 'draw') {
    const full = hand.length >= MAX_HAND;
    const noVec = state.decks.vectors.length === 0;
    const noScal = state.decks.scalars.length === 0;
    html += `<h3>Draw a Card</h3>
    <div class="draw-row">
      <button class="draw-btn" onclick="drawCard('vector')" ${full || noVec ? 'disabled' : ''}>
        Vector<span class="pile-ct">${state.decks.vectors.length} left</span>
      </button>
      <button class="draw-btn" onclick="drawCard('scalar')" ${full || noScal ? 'disabled' : ''}>
        Scalar<span class="pile-ct">${state.decks.scalars.length} left</span>
      </button>
    </div>`;
  }

  mp.innerHTML = html;
}

function renderLCBuilder(player) {
  const hand = state.hands[player];
  const piece = getSelectedPiece();
  const terms = state.lcTerms;
  if (terms.length === 0) {
    return `<div class="lc-hint">Click vector cards in ${capitalize(player)}'s hand to build the combination.</div>`;
  }

  const usedScalarIdxs = new Set(terms.filter(t => t.scalarIdx !== null).map(t => t.scalarIdx));
  const availScalars = hand.map((c, i) => ({ c, i })).filter(x => x.c.type === 'scalar');

  let h = '<div class="lc-builder">';

  terms.forEach((term, ti) => {
    const vc = hand[term.vecIdx];
    const oriented = orientVec(vc.x, vc.y, player);

    let scalarOptions = `<option value="-1" ${term.scalarIdx === null ? 'selected' : ''}>1</option>`;
    for (const s of availScalars) {
      if (s.i === term.scalarIdx || !usedScalarIdxs.has(s.i)) {
        scalarOptions += `<option value="${s.i}" ${term.scalarIdx === s.i ? 'selected' : ''}>×${s.c.value}</option>`;
      }
    }

    h += `<div class="lc-term">
      <select class="lc-scalar-select" onchange="lcSetScalar(${ti}, this.value === '-1' ? null : +this.value)">
        ${scalarOptions}
      </select>
      <span class="lc-vec-label">· [${oriented.x}, ${oriented.y}]</span>
      <button class="lc-remove" onclick="lcToggleVec(${term.vecIdx})">✕</button>
    </div>`;
  });

  const target = computeLCTarget(player, piece, terms);
  const valid = isLCMoveValid(player, piece, terms);
  const zeroVec = target.dx === 0 && target.dy === 0;

  let statusText, statusCls;
  if (zeroVec) {
    statusText = 'zero vector';
    statusCls = 'invalid';
  } else if (!inBounds(target.x, target.y)) {
    statusText = 'out of bounds';
    statusCls = 'invalid';
  } else if (state.dead[target.y][target.x]) {
    statusText = 'dead square';
    statusCls = 'invalid';
  } else if (isFriendly(target.x, target.y, player)) {
    statusText = 'own piece';
    statusCls = 'invalid';
  } else {
    const tcell = state.board[target.y][target.x];
    statusText = (tcell && tcell.player === opponent()) ? '★ capture!' : 'valid';
    statusCls = 'valid';
  }

  h += `<div class="lc-result">
    <span class="lc-eq">Σ =</span>
    <span class="lc-sum">[${target.dx}, ${target.dy}]</span>
    <span class="lc-status ${statusCls}">${statusText}</span>
  </div>`;

  h += `<button class="lc-confirm-btn" onclick="lcConfirm()" ${valid ? '' : 'disabled'}>
    Confirm Move → (${target.x}, ${target.y})
  </button>`;

  h += '</div>';
  return h;
}

function renderLog() {
  const el = document.getElementById('game-log');
  el.innerHTML = state.log.map(e =>
    `<div class="log-entry ${e.type}">${e.msg}</div>`
  ).join('');
  el.scrollTop = el.scrollHeight;
}
