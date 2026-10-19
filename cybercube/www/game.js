// Cyber Cube - 파랑은 밟고, 빨강은 피하고, 초록에서 숨기
(() => {
  const COLS = 6;
  const ROWS = 8;
  const MAX_LIVES = 3;
  const INVINCIBLE_TIME = 1.2;
  const SAVE_KEY = 'cybercube.progress';

  const $ = (id) => document.getElementById(id);
  const stageScreen = $('stageScreen');
  const gameScreen = $('gameScreen');
  const boardWrap = $('boardWrap');
  const board = $('board');
  const playerEl = $('player');
  const countdownEl = $('countdown');
  const modal = $('modal');

  // ── 저장 ──
  // stars: 스테이지별 별, best: 스테이지별 최고 기록 (ms, 낮을수록 좋음), name: 랭킹 닉네임
  let progress = { stars: {}, best: {}, name: '', sound: true, updated: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (saved) progress = { ...progress, ...saved };
  } catch (e) { /* 저장소를 못 쓰면 새로 시작 */ }

  function save() {
    progress.updated = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch (e) { /* 무시 */ }
    window.cloud?.save(progress); // 클라우드 백업 (cloud.js, 없으면 무시)
  }

  // 클라우드 기록과 합친 결과 반영 (다른 기기·재접속에서 더 좋은 기록이 있으면 가져옴)
  function applyCloudProgress(merged) {
    Object.assign(progress.stars, merged.stars);
    Object.assign(progress.best, merged.best);
    progress.name = merged.name || progress.name;
    progress.updated = merged.updated;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch (e) { /* 무시 */ }
    if (!state) showStages();
  }

  // 기록 = 클리어 시간 + 피격당 5초 (firestore.rules와 같은 계산)
  const HIT_PENALTY_MS = 5000;
  const fmt = (ms) => `${(ms / 1000).toFixed(2)}s`;
  const playerName = () => {
    if (!progress.name) { progress.name = `PLAYER${Math.floor(1000 + Math.random() * 9000)}`; save(); }
    return progress.name;
  };

  // ── 사운드 (WebAudio로 간단한 전자음) ──
  let audio = null;
  function beep(freq, dur = 0.08, type = 'square', vol = 0.06, delay = 0) {
    if (!progress.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime + delay;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + dur);
    } catch (e) { /* 소리 없이 진행 */ }
  }
  const sfx = {
    step: () => beep(220, 0.04, 'triangle', 0.04),
    blue: () => { beep(660, 0.06); beep(990, 0.08, 'square', 0.05, 0.05); },
    hit: () => beep(90, 0.3, 'sawtooth', 0.12),
    tick: () => beep(440, 0.08, 'sine', 0.08),
    go: () => beep(880, 0.15, 'sine', 0.08),
    clear: () => [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.12, 'square', 0.06, i * 0.09)),
    fail: () => [300, 220, 150].forEach((f, i) => beep(f, 0.18, 'sawtooth', 0.08, i * 0.15)),
  };
  const vibrate = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* 무시 */ } };

  // ── 게임 상태 ──
  let state = null;
  let cells = [];        // 칸 DOM
  let cellClass = [];    // 칸별 현재 클래스 (바뀐 칸만 갱신)
  let lastTime = 0;
  let rafId = 0;

  const idx = (x, y) => y * COLS + x;
  const inside = (x, y) => x >= 0 && x < COLS && y >= 0 && y < ROWS;

  function buildBoard() {
    board.querySelectorAll('.cell').forEach((c) => c.remove());
    cells = [];
    cellClass = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      const c = document.createElement('div');
      c.className = 'cell';
      board.insertBefore(c, playerEl);
      cells.push(c);
      cellClass.push('cell');
    }
  }

  function startStage(n) {
    const def = STAGES[n];
    const tiles = [];
    let px = 0, py = 0;
    def.map.forEach((row, y) => {
      for (let x = 0; x < COLS; x++) {
        const ch = row[x] || '.';
        if (ch === 'P') { px = x; py = y; }
        tiles.push(ch === 'P' ? '.' : ch);
      }
    });

    state = {
      n,
      def,
      tiles,                       // 'B' 파랑, 'D' 밟은 파랑, 'G' 초록, '#' 구멍, 'a'/'b' 깜빡임, '.' 바닥
      blueLeft: tiles.filter((t) => t === 'B').length,
      px, py,
      lives: MAX_LIVES,
      hits: 0,
      timeLeft: def.time,
      clock: 0,                    // 시작 후 흐른 시간 (깜빡임 주기 계산용)
      invincible: 0,
      countdown: 1.8,
      phase: 'ready',              // ready → play → paused / clear / fail
      hazards: def.hazards.map((h) => ({ ...h, acc: 0 })),
      pops: new Set(),
    };

    $('stageName').textContent = `STAGE ${n + 1}`;
    stageScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    closeModal();
    resizeBoard();
    updateHud();
    render();
    lastTime = performance.now();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  // ── 빨강 계산 ──
  const hazardWalkable = (x, y) => inside(x, y) && state.tiles[idx(x, y)] !== '#' && state.tiles[idx(x, y)] !== 'G';

  function blinkState() {
    // 반환: { a: 'on'|'warn'|'', b: 'on'|'warn'|'' }
    const bl = state.def.blink;
    if (!bl) return { a: '', b: '' };
    const half = bl.period / 2;
    const t = state.clock % bl.period;
    const aOn = t < half;
    const timeToSwitch = aOn ? half - t : bl.period - t;
    const warnNext = timeToSwitch <= bl.warn;
    return {
      a: aOn ? 'on' : (warnNext ? 'warn' : ''),
      b: !aOn ? 'on' : (warnNext ? 'warn' : ''),
    };
  }

  function hazardCells(h) {
    if (h.type === 'sweep') {
      const out = [];
      const len = h.axis === 'row' ? COLS : ROWS;
      for (let i = 0; i < len; i++) {
        const x = h.axis === 'row' ? i : h.pos;
        const y = h.axis === 'row' ? h.pos : i;
        if (hazardWalkable(x, y)) out.push(idx(x, y));
      }
      return out;
    }
    return [idx(h.x, h.y)];
  }

  function redMap() {
    // 칸별: 0 = 없음, 1 = 경고, 2 = 빨강
    const map = new Uint8Array(COLS * ROWS);
    const bs = blinkState();
    state.tiles.forEach((t, i) => {
      if (t === 'a' || t === 'b') map[i] = bs[t] === 'on' ? 2 : bs[t] === 'warn' ? 1 : 0;
    });
    state.hazards.forEach((h) => hazardCells(h).forEach((i) => { map[i] = 2; }));
    return map;
  }

  function stepHazard(h) {
    if (h.type === 'bounce') {
      const tries = [[h.dx, h.dy], [-h.dx, h.dy], [h.dx, -h.dy], [-h.dx, -h.dy]];
      for (const [dx, dy] of tries) {
        if ((dx || dy) && hazardWalkable(h.x + dx, h.y + dy)) {
          h.dx = dx; h.dy = dy; h.x += dx; h.y += dy;
          return;
        }
      }
    } else if (h.type === 'chase') {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .filter(([dx, dy]) => hazardWalkable(h.x + dx, h.y + dy));
      if (!dirs.length) return;
      let pick;
      if (state.tiles[idx(state.px, state.py)] === 'G') {
        // 플레이어가 초록에 숨으면 배회
        pick = dirs[Math.floor(Math.random() * dirs.length)];
      } else {
        const dist = ([dx, dy]) => Math.abs(h.x + dx - state.px) + Math.abs(h.y + dy - state.py);
        const best = Math.min(...dirs.map(dist));
        const bests = dirs.filter((d) => dist(d) === best);
        pick = bests[Math.floor(Math.random() * bests.length)];
      }
      h.x += pick[0]; h.y += pick[1];
    } else if (h.type === 'sweep') {
      const max = (h.axis === 'row' ? ROWS : COLS) - 1;
      if (h.pos + h.dir < 0 || h.pos + h.dir > max) h.dir = -h.dir;
      h.pos += h.dir;
    }
  }

  // ── 플레이어 ──
  function move(dx, dy) {
    if (!state || state.phase !== 'play') return;
    const nx = state.px + dx;
    const ny = state.py + dy;
    if (!inside(nx, ny) || state.tiles[idx(nx, ny)] === '#') return;
    state.px = nx;
    state.py = ny;
    const i = idx(nx, ny);
    if (state.tiles[i] === 'B') {
      state.tiles[i] = 'D';
      state.blueLeft--;
      state.pops.add(i);
      setTimeout(() => state && state.pops.delete(i), 350);
      sfx.blue();
      vibrate(10);
      if (state.blueLeft === 0) { checkHit(); if (state.phase === 'play') clearStage(); render(); return; }
    } else {
      sfx.step();
    }
    checkHit();
    render();
  }

  function checkHit() {
    if (state.phase !== 'play' || state.invincible > 0) return;
    const i = idx(state.px, state.py);
    if (state.tiles[i] === 'G') return;
    if (redMap()[i] !== 2) return;
    state.lives--;
    state.hits++;
    state.invincible = INVINCIBLE_TIME;
    sfx.hit();
    vibrate([60, 40, 60]);
    board.classList.remove('shake');
    void board.offsetWidth;
    board.classList.add('shake');
    updateHud();
    if (state.lives <= 0) failStage('OUT OF LIFE');
  }

  // ── 루프 ──
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    if (state.phase === 'ready') {
      const before = Math.ceil(state.countdown / 0.6);
      state.countdown -= dt;
      const after = Math.ceil(state.countdown / 0.6);
      if (state.countdown <= 0) {
        state.phase = 'play';
        countdownEl.textContent = 'GO';
        sfx.go();
        setTimeout(() => countdownEl.classList.add('hidden'), 400);
      } else {
        countdownEl.classList.remove('hidden');
        countdownEl.textContent = after;
        if (after !== before) sfx.tick();
      }
    } else if (state.phase === 'play') {
      state.clock += dt;
      state.timeLeft -= dt;
      if (state.invincible > 0) state.invincible = Math.max(0, state.invincible - dt);
      state.hazards.forEach((h) => {
        h.acc += dt * h.speed;
        while (h.acc >= 1) { h.acc -= 1; stepHazard(h); }
      });
      checkHit();
      if (state.phase === 'play' && state.timeLeft <= 0) failStage('TIME UP');
      updateHud();
    }
    render();
    if (state.phase === 'ready' || state.phase === 'play') rafId = requestAnimationFrame(loop);
  }

  // ── 그리기 ──
  function render() {
    const red = redMap();
    for (let i = 0; i < cells.length; i++) {
      const t = state.tiles[i];
      let cls = 'cell';
      if (t === '#') cls += ' hole';
      else if (t === 'G') cls += ' green';
      else if (red[i] === 2) cls += ' red';
      else if (red[i] === 1) cls += ' warn';
      else if (t === 'B') cls += ' blue';
      else if (t === 'D') cls += ' done';
      if (state.pops.has(i)) cls += ' pop';
      if (cls !== cellClass[i]) { cells[i].className = cls; cellClass[i] = cls; }
    }
    playerEl.style.transform = `translate(${state.px * 100}%, ${state.py * 100}%)`;
    playerEl.classList.toggle('invincible', state.invincible > 0);
  }

  function updateHud() {
    $('blueLeft').textContent = state.blueLeft;
    $('timeLeft').textContent = Math.max(0, Math.ceil(state.timeLeft));
    $('lives').textContent = '♥'.repeat(state.lives) + '♡'.repeat(MAX_LIVES - state.lives);
    const ratio = Math.max(0, state.timeLeft / state.def.time);
    const fill = $('timeFill');
    fill.style.width = `${ratio * 100}%`;
    fill.classList.toggle('low', ratio < 0.25);
  }

  function resizeBoard() {
    const w = boardWrap.clientWidth;
    const h = boardWrap.clientHeight;
    const size = Math.min(w / COLS, h / ROWS);
    board.style.width = `${size * COLS}px`;
    board.style.height = `${size * ROWS}px`;
  }

  // ── 클리어 / 실패 / 일시정지 ──
  function clearStage() {
    state.phase = 'clear';
    const n = state.n;
    const stars = Math.max(1, 3 - state.hits);
    const ms = Math.max(3000, Math.round(state.clock * 1000));
    const score = ms + state.hits * HIT_PENALTY_MS;
    const prevBest = progress.best[n];
    const newBest = prevBest == null || score < prevBest;
    progress.stars[n] = Math.max(progress.stars[n] || 0, stars);
    if (newBest) progress.best[n] = score;
    save();
    sfx.clear();
    vibrate(80);
    const hasNext = n + 1 < STAGES.length;
    const penalty = state.hits ? ` (+${state.hits * 5}s)` : '';
    showModal('CLEAR!', `${fmt(score)}${penalty}${newBest ? ' · NEW BEST' : ''}`, stars, [
      hasNext && ['NEXT ▶', () => startStage(n + 1)],
      ['🏆 RANKING', () => showRanking(n), true],
      ['RETRY', () => startStage(n), true],
      ['STAGES', showStages, true],
    ]);

    // 랭킹에 올리고 순위 표시
    if (!window.cloud) return;
    const token = rankToken;
    const body = $('modalBody');
    body.innerHTML = '<p class="rank-line">RANK …</p>';
    window.cloud.submit(n, { name: playerName(), score, ms, hits: state.hits }).then((rank) => {
      if (token !== rankToken) return; // 그새 다른 화면으로 바뀜
      body.innerHTML = rank ? `<p class="rank-line">RANK <b>#${rank}</b></p>` : '';
    });
  }

  // ── 랭킹 ──
  let rankToken = 0; // 모달이 바뀔 때마다 증가 → 늦게 온 응답이 다른 화면을 덮어쓰지 않게
  function showRanking(n) {
    const back = state && state.phase === 'clear' ? clearModalBack : closeModal;
    showModal('RANKING', '', null, [['CLOSE', back, true]]);
    const token = rankToken;
    const body = $('modalBody');
    body.innerHTML = `
      <div class="rank-nav">
        <button class="secondary icon" id="rankPrev" ${n === 0 ? 'disabled' : ''}>◀</button>
        <b>STAGE ${n + 1}</b>
        <button class="secondary icon" id="rankNext" ${n === STAGES.length - 1 ? 'disabled' : ''}>▶</button>
      </div>
      <ol class="rank-list" id="rankList"><li class="empty">LOADING…</li></ol>
      <p class="rank-me" id="rankMe"></p>
      <div class="name-row">
        <input id="nameInput" maxlength="12" placeholder="NAME" autocomplete="off">
        <button id="nameBtn" class="secondary">OK</button>
      </div>`;
    $('rankPrev').onclick = () => showRanking(n - 1);
    $('rankNext').onclick = () => showRanking(n + 1);
    const input = $('nameInput');
    input.value = progress.name;
    $('nameBtn').onclick = () => {
      const name = input.value.trim().slice(0, 12);
      if (!name || name === progress.name) return;
      progress.name = name;
      save();
      window.cloud?.rename(name, Object.keys(progress.best));
      input.blur();
      setTimeout(() => token === rankToken && showRanking(n), 300);
    };

    const myBest = progress.best[n];
    $('rankMe').textContent = myBest == null ? 'MY BEST —' : `MY BEST ${fmt(myBest)}`;
    if (!window.cloud) { $('rankList').innerHTML = '<li class="empty">OFFLINE</li>'; return; }
    Promise.all([
      window.cloud.top(n, 10),
      myBest == null ? null : window.cloud.rank(n, myBest),
    ]).then(([list, myRank]) => {
      if (token !== rankToken) return;
      const ol = $('rankList');
      ol.innerHTML = '';
      if (!list) { ol.innerHTML = '<li class="empty">OFFLINE</li>'; return; }
      if (!list.length) { ol.innerHTML = '<li class="empty">NO RECORDS YET</li>'; return; }
      list.forEach((r, i) => {
        const li = document.createElement('li');
        if (r.uid === window.cloud.uid) li.className = 'me';
        // 이름은 다른 사람이 입력한 값이라 textContent로만 넣음
        [`${i + 1}`, r.name, fmt(r.score)].forEach((t) => {
          const s = document.createElement('span');
          s.textContent = t;
          li.appendChild(s);
        });
        ol.appendChild(li);
      });
      if (myRank) $('rankMe').textContent = `MY BEST ${fmt(myBest)} · #${myRank}`;
    });
  }

  function closeModal() {
    rankToken++;
    modal.classList.add('hidden');
  }

  // 클리어 화면에서 랭킹을 열었다가 닫으면 클리어 화면으로 돌아감
  function clearModalBack() {
    const n = state.n;
    const hasNext = n + 1 < STAGES.length;
    showModal('CLEAR!', `MY BEST ${fmt(progress.best[n])}`, progress.stars[n], [
      hasNext && ['NEXT ▶', () => startStage(n + 1)],
      ['🏆 RANKING', () => showRanking(n), true],
      ['RETRY', () => startStage(n), true],
      ['STAGES', showStages, true],
    ]);
  }

  function failStage(reason) {
    state.phase = 'fail';
    sfx.fail();
    showModal('FAILED', reason, null, [
      ['RETRY', () => startStage(state.n)],
      ['STAGES', showStages, true],
    ], true);
  }

  function pause() {
    if (!state || (state.phase !== 'play' && state.phase !== 'ready')) return;
    state.resumePhase = state.phase;
    state.phase = 'paused';
    cancelAnimationFrame(rafId);
    showModal('PAUSED', '', null, [
      ['RESUME', resume],
      ['RETRY', () => startStage(state.n), true],
      ['STAGES', showStages, true],
    ]);
  }

  function resume() {
    closeModal();
    state.phase = state.resumePhase;
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function showModal(title, text, stars, buttons, fail = false) {
    rankToken++;
    $('modalBody').innerHTML = '';
    const h = $('modalTitle');
    h.textContent = title;
    h.classList.toggle('fail', fail);
    $('modalText').textContent = text;
    $('modalStars').innerHTML = stars == null ? ''
      : '★'.repeat(stars) + `<span class="off">${'★'.repeat(3 - stars)}</span>`;
    const box = $('modalButtons');
    box.innerHTML = '';
    buttons.filter(Boolean).forEach(([label, fn, secondary]) => {
      const b = document.createElement('button');
      b.textContent = label;
      if (secondary) b.className = 'secondary';
      b.onclick = fn;
      box.appendChild(b);
    });
    modal.classList.remove('hidden');
  }

  // ── 스테이지 선택 ──
  function showStages() {
    cancelAnimationFrame(rafId);
    state = null;
    closeModal();
    gameScreen.classList.add('hidden');
    stageScreen.classList.remove('hidden');
    const grid = $('stageGrid');
    grid.innerHTML = '';
    let total = 0;
    STAGES.forEach((_, i) => {
      const stars = progress.stars[i] || 0;
      total += stars;
      const unlocked = i === 0 || (progress.stars[i - 1] || 0) > 0;
      const b = document.createElement('button');
      b.className = 'stage-btn' + (unlocked ? '' : ' locked');
      b.innerHTML = unlocked
        ? `${i + 1}<small>${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</small>`
        : `🔒<small>${i + 1}</small>`;
      if (unlocked) b.onclick = () => startStage(i);
      grid.appendChild(b);
    });
    $('totalStars').textContent = `★ ${total}`;
  }

  // ── 입력 ──
  // 스와이프: 손을 떼지 않고 계속 끌면 여러 칸 이동
  // 탭: 탭한 칸 방향으로 한 칸 이동
  const SWIPE = 26;
  let touch = null;
  boardWrap.addEventListener('pointerdown', (e) => {
    touch = { x: e.clientX, y: e.clientY, moved: false };
    boardWrap.setPointerCapture(e.pointerId);
  });
  boardWrap.addEventListener('pointermove', (e) => {
    if (!touch) return;
    const dx = e.clientX - touch.x;
    const dy = e.clientY - touch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return;
    if (Math.abs(dx) > Math.abs(dy)) move(Math.sign(dx), 0);
    else move(0, Math.sign(dy));
    touch = { x: e.clientX, y: e.clientY, moved: true };
  });
  boardWrap.addEventListener('pointerup', (e) => {
    if (touch && !touch.moved && state) {
      const r = board.getBoundingClientRect();
      const cx = (e.clientX - r.left) / (r.width / COLS) - 0.5;
      const cy = (e.clientY - r.top) / (r.height / ROWS) - 0.5;
      const dx = cx - state.px;
      const dy = cy - state.py;
      if (Math.max(Math.abs(dx), Math.abs(dy)) >= 0.5) {
        if (Math.abs(dx) > Math.abs(dy)) move(Math.sign(dx), 0);
        else move(0, Math.sign(dy));
      }
    }
    touch = null;
  });
  boardWrap.addEventListener('pointercancel', () => { touch = null; });

  const KEYS = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
  };
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return; // 닉네임 입력 중
    const k = KEYS[e.key] || KEYS[e.key.toLowerCase()];
    if (k) { e.preventDefault(); move(k[0], k[1]); }
    else if (e.key === 'Escape' || e.key === 'p') { state && state.phase === 'paused' ? resume() : pause(); }
  });

  $('backBtn').onclick = showStages;
  $('pauseBtn').onclick = pause;
  $('rankBtn').onclick = () => {
    const played = Object.keys(progress.best).map(Number);
    showRanking(played.length ? Math.max(...played) : 0);
  };
  const soundBtn = $('soundBtn');
  const updateSoundBtn = () => { soundBtn.textContent = progress.sound ? '♪ ON' : '♪ OFF'; };
  soundBtn.onclick = () => { progress.sound = !progress.sound; save(); updateSoundBtn(); };
  updateSoundBtn();

  window.addEventListener('resize', () => { if (state) resizeBoard(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  buildBoard();
  showStages();
  window.cloud?.start(JSON.parse(JSON.stringify(progress)), applyCloudProgress);
})();
