// Cube Clean - 파랑은 밟고, 빨강은 피하고, 초록에서 숨기
(() => {
  const COLS = 6;
  const ROWS = 8;
  const MAX_LIVES = 3;
  const INVINCIBLE_TIME = 1.2;
  const BLUE_SHUFFLE_TIME = 5;  // 남은 파랑을 다른 칸으로 옮기는 주기 (초)
  const BLUE_SHUFFLE_WARN = 1;
  const MODAL_GUARD_MS = 400;
  const WALL_ROOM = 28;         // 판 바깥 벽이 들어갈 여백 (px, 양쪽 합)
  const FALL_MS = 700;          // 판 밖으로 떨어지는 연출 시간
  const DRAG_STEP = 0.075;      // 공을 끌 때 한 칸 이동 간격 (초)
  const DRAG_GRAB = 1.0;        // 공 중심에서 이 칸 수 안을 터치하면 '공 잡기'
  const DRAG_HYSTERESIS = 0.15; // 목표 칸이 바뀌려면 칸 경계를 이만큼(칸 비율) 더 넘어야 함 → 경계에서 안 떨림   // 창이 뜬 뒤 이 시간 동안은 버튼이 안 눌림  // 옮기기 전에 깜빡이는 시간 (초)
  const SAVE_KEY = 'cybercube.progress';

  const $ = (id) => document.getElementById(id);
  const t = window.I18N.t;
  const stageScreen = $('stageScreen');
  const demoScreen = $('demoScreen');
  const privacyScreen = $('privacyScreen');
  const gameScreen = $('gameScreen');
  const boardWrap = $('boardWrap');
  const board = $('board');
  const playerEl = $('player');
  const countdownEl = $('countdown');
  const clearBanner = $('clearBanner');
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
    if (!state && demoScreen.classList.contains('hidden') && privacyScreen.classList.contains('hidden')) showStages();
  }

  // 기록 = 클리어 시간 + 피격당 5초 (firestore.rules와 같은 계산)
  const HIT_PENALTY_MS = 5000;
  const fmt = (ms) => `${(ms / 1000).toFixed(2)}s`;
  const playerName = () => {
    if (!progress.name) { progress.name = `PLAYER${Math.floor(1000 + Math.random() * 9000)}`; save(); }
    return progress.name;
  };

  // ── 사운드 (sound.js에서 합성) ──
  const sfx = window.Sound.create(() => progress.sound);
  const vibrate = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* 무시 */ } };

  // ── 게임 상태 ──
  let state = null;
  let cells = [];        // 칸 DOM
  let cellClass = [];    // 칸별 현재 클래스 (바뀐 칸만 갱신)
  let lastTime = 0;
  let rafId = 0;

  // 난이도: 스테이지 번호(0~35) ↔ 난이도 탭 + 그 안의 번호
  const tierStart = (ti) => TIERS.slice(0, ti).reduce((sum, t) => sum + t.stages.length, 0);
  function tierOf(n) {
    let ti = 0;
    while (ti < TIERS.length - 1 && n >= tierStart(ti + 1)) ti++;
    return { tier: ti, num: n - tierStart(ti) + 1 };
  }
  const stageLabel = (n) => { const { tier, num } = tierOf(n); return t('stageLabel', { tier: t(`tier${TIERS[tier].name}`), n: num }); };

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
    // 초록이 있으면 원래 시작 지점에서 가장 가까운 초록 칸에서 시작 (떨어져도 여기서 다시)
    let bestG = -1, bestD = Infinity;
    tiles.forEach((t, i) => {
      if (t !== 'G') return;
      const d = Math.hypot(i % COLS - px, Math.floor(i / COLS) - py) - Math.floor(i / COLS) * 0.001; // 같으면 아래 줄 쪽
      if (d < bestD) { bestD = d; bestG = i; }
    });
    if (bestG >= 0) { px = bestG % COLS; py = Math.floor(bestG / COLS); }

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
      shuffleSpec: def.shuffle ?? BLUE_SHUFFLE_TIME,     // 숫자 = 고정 주기, [최소, 최대] = 매번 랜덤
      shuffleLeft: nextShuffleTime(def.shuffle ?? BLUE_SHUFFLE_TIME), // 파랑이 옮겨지기까지 남은 시간
      startX: px, startY: py,      // 시작 지점 (떨어지면 여기서 다시 시작)
      tiltX: 0, tiltY: 0,          // 지금 기울기(°): tiltX +는 오른쪽이 낮음, tiltY +는 아래쪽이 낮음
      rollAcc: 0,                  // 기울기로 굴러가는 진행도 (1이 되면 한 칸)
    };
    setupWalls(n);
    setupTilt(n);

    stopCelebration();
    $('stageName').textContent = stageLabel(n);
    restorePlayer();
    progress.tab = tierOf(n).tier; // 나가면 이 스테이지의 난이도 탭이 보이게
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
  const canStep = (x, y) => inside(x, y) && state.tiles[idx(x, y)] !== '#';

  // ── 공 끌기: 손가락 아래 칸(목표)으로 한 칸씩 따라감 ──
  // 대각선 칸이 구멍이면 가로/세로 중 갈 수 있는 쪽으로 비켜 감. 손을 떼면 마지막 목표까지 가서 멈춤
  function dragStep() {
    const d = state.drag;
    if (state.px === d.tx && state.py === d.ty) {
      if (!d.active) state.drag = null;
      return;
    }
    const sx = Math.sign(d.tx - state.px);
    const sy = Math.sign(d.ty - state.py);
    const tries = sx && sy ? [[sx, sy], [sx, 0], [0, sy]] : [[sx, sy]];
    const step = tries.find(([x, y]) => canStep(state.px + x, state.py + y));
    if (step) move(step[0], step[1]);
    else if (!d.active) state.drag = null; // 막혀서 더 못 감
  }

  // glide: 기울기로 굴러갈 때 한 칸 걸리는 시간(초). 주면 칸 사이에서 멈추지 않고 이어서 굴러감
  function move(dx, dy, glide = 0) {
    if (!state || state.phase !== 'play') return;
    const nx = state.px + dx;
    const ny = state.py + dy;
    if (!inside(nx, ny)) {
      if (wallBlocks(dx, dy)) wallHit(dx, dy);
      else fallOff(dx, dy);
      return;
    }
    if (!canStep(nx, ny)) { bumpPlayer(dx, dy); return; }
    playerEl.classList.toggle('diag', dx !== 0 && dy !== 0); // 대각선은 거리가 길어서 애니메이션도 조금 길게
    playerEl.classList.toggle('glide', glide > 0);
    if (glide > 0) playerEl.style.setProperty('--move', `${glide.toFixed(3)}s`);
    else playerEl.style.removeProperty('--move');
    state.resting = false;
    if (!glide && !state.tiltX && !state.tiltY) state.rollVel = 0; // 평평할 때 직접 움직이면 굴러가던 힘은 멈춤
    window.Orb.roll(playerEl, dx, dy, glide > 0 ? glide * 1000 : dx && dy ? 280 : 230);
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
      // 마지막 파랑이면 같은 칸에 빨강이 있어도 클리어가 먼저
      if (state.blueLeft === 0) { if (state.phase === 'play') clearStage(); render(); return; }
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
    sfx.hit();
    loseLife();
  }

  // 생명 1개 잃기 (빨강에 닿음 / 판 밖으로 떨어짐)
  // fell = 판 밖으로 떨어져서 잃음 (마지막 생명이면 볼이 이미 안 보이므로 깨지는 연출 없이 실패)
  function loseLife(fell = false) {
    state.lives--;
    state.hits++;
    state.invincible = INVINCIBLE_TIME;
    vibrate([60, 40, 60]);
    board.classList.remove('shake');
    void board.offsetWidth;
    board.classList.add('shake');
    updateHud();
    if (state.lives <= 0) {
      state.phase = 'breaking';
      if (!fell) shatterPlayer();
      setTimeout(() => { if (state && state.phase === 'breaking') failStage('outOfLife'); }, fell ? 300 : 1050);
    } else {
      sfx.crack();
    }
  }

  // 다음 파랑 이동까지 시간: 숫자면 그대로, [최소, 최대]면 그 사이 랜덤, 0이면 이동 없음
  function nextShuffleTime(spec) {
    if (Array.isArray(spec)) return spec[0] + Math.random() * (spec[1] - spec[0]);
    return spec;
  }

  // 아직 안 밟은 파랑을 빈 칸(바닥·밟은 칸)으로 순간이동
  // 플레이어 칸, 지금 빨간 칸, 깜빡이 칸, 원래 파랑 칸으로는 안 옮김
  function shuffleBlue() {
    const red = redMap();
    const pool = [];
    state.tiles.forEach((t, i) => {
      if ((t === '.' || t === 'D') && red[i] === 0 && i !== idx(state.px, state.py)) pool.push(i);
    });
    const from = [];
    state.tiles.forEach((t, i) => { if (t === 'B') from.push(i); });
    from.forEach((i) => {
      if (!pool.length) return;
      const to = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      state.tiles[i] = '.';
      state.tiles[to] = 'B';
      state.pops.add(to);
      setTimeout(() => state && state.pops.delete(to), 350);
    });
    if (from.length) sfx.shuffle();
  }

  // ── 육각형 금·깨짐 (모양 계산과 조각은 crack.js) ──
  function shatterPlayer() {
    sfx.shatter();
    vibrate([30, 30, 120]);
    // 충격 순간: 금이 꽉 찬 채로 번쩍 → 금선을 따라 조각
    playerEl.dataset.crack = '2';
    playerEl.classList.add('crack-flash');
    setTimeout(() => {
      if (state && state.phase === 'breaking') window.Crack.shatter(playerEl);
    }, 90);
  }

  // 조각 치우고 새 금 모양 준비 (판 시작·이어하기)
  function restorePlayer() {
    window.Crack.reset(playerEl);
    playerEl.classList.remove('falling'); // 떨어져서 끝난 판이면 다시 보이게
  }

  // 막힌 방향으로 밀면 그쪽으로 살짝 툭 부딪힘 (입력은 받았다는 표시)
  function bumpPlayer(dx, dy) {
    sfx.bump();
    playerEl.style.setProperty('--bx', dx);
    playerEl.style.setProperty('--by', dy);
    playerEl.classList.remove('bump');
    void playerEl.offsetWidth;
    playerEl.classList.add('bump');
  }

  // 크리스탈 볼 굴리기: 이동 방향으로 굴러간 각도만큼 3D로 회전 (orb.js)
  function rollPlayer(el, dx, dy) {
    window.Orb.roll(el, dx, dy, dx && dy ? 280 : 230); // 이동보다 조금 길게 돌아서 회전이 눈에 보이게
  }
  window.rollPlayer = rollPlayer; // 시연 화면에서도 같이 씀

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
        countdownEl.textContent = t('go');
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
      if (state.drag) {
        state.drag.acc += dt;
        if (state.drag.acc >= DRAG_STEP) { state.drag.acc = 0; dragStep(); }
      }
      updateTilt(dt);
      if (state.shuffleLeft > 0) {
        state.shuffleLeft -= dt;
        if (state.shuffleLeft <= 0) { shuffleBlue(); state.shuffleLeft += nextShuffleTime(state.shuffleSpec); }
      }
      if (state.blueLeft === 0) clearStage(); // 혹시 파랑이 0인 채로 진행되면 바로 클리어 (광고로 이어한 뒤 등)
      else checkHit();
      if (state.phase === 'play' && state.timeLeft <= 0) failStage('timeUp');
      updateHud();
    }
    render();
    if (state.phase === 'ready' || state.phase === 'play' || state.phase === 'falling') rafId = requestAnimationFrame(loop);
  }

  // ── 그리기 ──
  function render() {
    const red = redMap();
    const moving = state.phase === 'play' && state.shuffleLeft > 0 && state.shuffleLeft <= BLUE_SHUFFLE_WARN;
    for (let i = 0; i < cells.length; i++) {
      const t = state.tiles[i];
      let cls = 'cell';
      if (t === '#') cls += ' hole';
      else if (t === 'G') cls += ' green';
      else if (red[i] === 2) cls += ' red';
      else if (red[i] === 1) cls += ' warn';
      else if (t === 'B') cls += moving ? ' blue moving' : ' blue';
      else if (t === 'D') cls += ' done';
      if (state.pops.has(i)) cls += ' pop';
      if (state.drag && i === idx(state.drag.tx, state.drag.ty) && i !== idx(state.px, state.py)) cls += ' target';
      if (cls !== cellClass[i]) { cells[i].className = cls; cellClass[i] = cls; }
    }
    if (state.phase !== 'falling') playerEl.style.transform = `translate(${state.px * 100}%, ${state.py * 100}%)`; // 떨어지는 중엔 판 밖 자리 그대로
    playerEl.classList.toggle('invincible', state.invincible > 0);
    const crack = String(Math.min(2, MAX_LIVES - state.lives));
    if (playerEl.dataset.crack !== crack) {
      if (Number(crack) > Number(playerEl.dataset.crack || 0)) {
        playerEl.classList.remove('crack-flash');
        void playerEl.offsetWidth;
        playerEl.classList.add('crack-flash');
      }
      playerEl.dataset.crack = crack;
    }
  }

  function updateHud() {
    $('blueLeft').textContent = state.blueLeft;
    $('timeLeft').textContent = Math.max(0, Math.ceil(state.timeLeft));
    $('lives').textContent = '♥'.repeat(state.lives) + '♡'.repeat(MAX_LIVES - state.lives);
    const ratio = Math.min(1, Math.max(0, state.timeLeft / state.def.time));
    const fill = $('timeFill');
    fill.style.width = `${ratio * 100}%`;
    fill.classList.toggle('low', ratio < 0.25);
  }

  function resizeBoard() {
    const w = boardWrap.clientWidth;
    const h = boardWrap.clientHeight;
    const size = Math.min((w - WALL_ROOM) / COLS, (h - WALL_ROOM) / ROWS); // 바깥 벽 자리
    board.style.width = `${size * COLS}px`;
    board.style.height = `${size * ROWS}px`;
  }

  // ── 클리어 / 실패 / 일시정지 ──
  function clearStage() {
    state.phase = 'clear';
    levelBoard(); // 기울어 있었으면 평평하게
    updateHud(); // 마지막 파랑까지 0으로
    window.Ads.countResult();
    const n = state.n;
    const ms = Math.max(3000, Math.round(state.clock * 1000));
    const score = ms + state.hits * HIT_PENALTY_MS;
    vibrate(80);

    // 광고 보고 이어한 판: 별 1개, 기록·랭킹에는 안 남김
    if (state.continued) {
      progress.stars[n] = Math.max(progress.stars[n] || 0, 1);
      save();
      celebrate(() => showModal(t('clear'), `${fmt(score)} · ${t('continued')}`, 1, resultButtons(n)));
      return;
    }

    const stars = Math.max(1, 3 - state.hits);
    const prevBest = progress.best[n];
    const newBest = prevBest == null || score < prevBest;
    progress.stars[n] = Math.max(progress.stars[n] || 0, stars);
    if (newBest) progress.best[n] = score; // 기록은 바로 저장 (연출 중에 나가도 남음)
    save();
    const penalty = state.hits ? ` (+${state.hits * 5}s)` : '';
    const hits = state.hits;
    const submitted = window.cloud ? window.cloud.submit(n, { name: playerName(), score, ms, hits }) : null;

    celebrate(() => {
      showModal(t('clear'), `${fmt(score)}${penalty}${newBest ? ` · ${t('newBest')}` : ''}`, stars, resultButtons(n));
      // 랭킹 순위 표시
      if (!submitted) return;
      const token = rankToken;
      const body = $('modalBody');
      body.innerHTML = `<p class="rank-line">${t('rank')} …</p>`;
      submitted.then((rank) => {
        if (token !== rankToken) return; // 그새 다른 화면으로 바뀜
        body.innerHTML = rank ? `<p class="rank-line">${t('rank')} <b>#${rank}</b></p>` : '';
      });
    });
  }

  // ── 판 둘레 벽 ──
  // 위·아래 각 COLS개, 왼쪽·오른쪽 각 ROWS개 조각. 스테이지마다 정해진 자리가 뚫려 있음 (같은 판은 늘 같은 모양)
  // 시작 위치 바로 옆 벽은 항상 막음 (시작하자마자 떨어지지 않게)
  const wallEls = { top: [], bottom: [], left: [], right: [] };
  function buildWalls() {
    Object.keys(wallEls).forEach((side) => {
      const count = side === 'top' || side === 'bottom' ? COLS : ROWS;
      for (let i = 0; i < count; i++) {
        const w = document.createElement('div');
        w.className = `wall ${side}`;
        w.style.setProperty('--i', i);
        board.appendChild(w);
        wallEls[side].push(w);
      }
    });
  }

  // 스테이지 번호로 정해지는 난수 (같은 스테이지는 늘 같은 벽)
  function seeded(seed) {
    let t = seed * 2654435761 >>> 0;
    return () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  }

  function setupWalls(n) {
    const { tier, num } = tierOf(n);
    const k = (num - 1) / Math.max(1, TIERS[tier].stages.length - 1);
    const [from, to] = TIERS[tier].walls || [1, 1];
    const keep = from + (to - from) * k; // 남길 벽 비율
    const all = [];
    Object.keys(wallEls).forEach((side) => wallEls[side].forEach((_, i) => all.push([side, i])));
    const isProtected = ([side, i]) =>
      (side === 'bottom' && state.py === ROWS - 1 && Math.abs(i - state.px) <= 1) ||
      (side === 'top' && state.py === 0 && Math.abs(i - state.px) <= 1) ||
      (side === 'left' && state.px === 0 && Math.abs(i - state.py) <= 1) ||
      (side === 'right' && state.px === COLS - 1 && Math.abs(i - state.py) <= 1);
    const rand = seeded(n + 7);
    const removable = all.filter((w) => !isProtected(w));
    for (let i = removable.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [removable[i], removable[j]] = [removable[j], removable[i]]; }
    const gaps = new Set(removable.slice(0, Math.round(all.length * (1 - keep))).map(([s, i]) => `${s}${i}`));
    state.walls = { top: [], bottom: [], left: [], right: [] };
    Object.keys(wallEls).forEach((side) => wallEls[side].forEach((el, i) => {
      const solid = !gaps.has(`${side}${i}`);
      state.walls[side][i] = solid;
      el.classList.toggle('gap', !solid);
    }));
  }

  function wallHit(dx, dy) {
    sfx.wall();
    vibrate(25);
    playerEl.style.setProperty('--bx', dx);
    playerEl.style.setProperty('--by', dy);
    playerEl.style.setProperty('--sqx', dx ? 0.78 : 1.12); // 부딪힌 방향으로 납작해지고 옆으로 퍼짐
    playerEl.style.setProperty('--sqy', dy ? 0.78 : 1.12);
    playerEl.classList.remove('wallhit', 'bump');
    void playerEl.offsetWidth;
    playerEl.classList.add('wallhit');
    // 부딪힌 벽 조각
    const nx = state.px + dx;
    const ny = state.py + dy;
    const segs = [];
    if (nx < 0 || nx >= COLS) segs.push(wallEls[nx < 0 ? 'left' : 'right'][state.py]);
    if (ny < 0 || ny >= ROWS) segs.push(wallEls[ny < 0 ? 'top' : 'bottom'][state.px]);
    segs.forEach((w) => {
      if (!w || w.classList.contains('gap')) return;
      w.classList.remove('hit');
      void w.offsetWidth;
      w.classList.add('hit');
    });
  }

  // 판 밖으로 나가려 할 때 막히는지. 모서리를 대각선으로 나가면 두 벽이 모두 뚫려 있어야 떨어짐
  function wallBlocks(dx, dy) {
    const nx = state.px + dx;
    const ny = state.py + dy;
    const outX = nx < 0 || nx >= COLS;
    const outY = ny < 0 || ny >= ROWS;
    const solidX = outX && state.walls[nx < 0 ? 'left' : 'right'][state.py];
    const solidY = outY && state.walls[ny < 0 ? 'top' : 'bottom'][state.px];
    if (outX && outY) return solidX || solidY;
    return outX ? solidX : solidY;
  }

  // 뚫린 벽으로 나가면: 판 밖으로 굴러 나가 아래로 떨어지듯 사라짐 → 생명 1개 잃고 스테이지 시작 지점에서 다시 나타남
  function fallOff(dx, dy) {
    const st = state;
    st.phase = 'falling';
    st.drag = null;
    st.rollVel = 0; // 다시 나타나면 처음부터
    st.rollAcc = 0;
    sfx.drop();
    playerEl.style.setProperty('--fdx', dx);
    playerEl.style.setProperty('--fdy', dy);
    playerEl.classList.remove('glide', 'wallhit', 'bump', 'respawn'); // 떨어짐 애니메이션을 가리지 않게
    playerEl.style.removeProperty('--move');
    playerEl.style.transform = `translate(${(st.px + dx * 0.85) * 100}%, ${(st.py + dy * 0.85) * 100}%)`; // 가장자리 밖으로 굴러 나감
    window.Orb.roll(playerEl, dx, dy, 700); // 떨어지면서도 굴러감
    playerEl.classList.add('falling');
    setTimeout(() => {
      if (state !== st || st.phase !== 'falling') return;
      // 마지막 생명이면 다시 나타나지 않고 떨어진 채로 끝 (시작 지점에서 깨지지 않게)
      if (st.lives <= 1) { loseLife(true); return; }
      playerEl.classList.remove('falling');
      playerEl.classList.add('snap'); // 시작 지점으로는 미끄러지지 않고 바로
      st.px = st.startX;
      st.py = st.startY;
      st.phase = 'play';
      render();
      void playerEl.offsetWidth;
      playerEl.classList.remove('snap');
      playerEl.classList.remove('respawn');
      void playerEl.offsetWidth;
      playerEl.classList.add('respawn');
      loseLife();
      lastTime = performance.now();
    }, FALL_MS);
  }

  // ── 판 기울기 (중급·고급·특급) ──
  // 평평 → (랜덤 시간 뒤) 왼쪽 또는 오른쪽으로 기울어짐 → (랜덤 시간 뒤) 다시 평평 … 반복
  // 기울어 있는 동안 볼은 낮은 쪽으로 저절로 한 칸씩 굴러감 (많이 기울수록 빠르게)
  // 굴러가다 파랑을 밟고, 빨강에 맞고, 뚫린 벽이면 떨어짐. 벽·구멍에 막히면 그 자리에서 멈춤
  const rand = (a, b) => a + Math.random() * (b - a);
  function setupTilt(n) {
    const tl = TIERS[tierOf(n).tier].tilt || null;
    state.tiltCfg = tl;
    state.tiltPhase = 'flat';
    state.tiltLeft = tl ? rand(tl.flat[0], tl.flat[1]) : 0;
    if (tl) {
      const { tier, num } = tierOf(n);
      state.tiltBonus = ((num - 1) / Math.max(1, TIERS[tier].stages.length - 1)) * (tl.stepUp || 0); // 뒤 스테이지일수록 더 기울어짐
    }
    levelBoard();
  }

  // 기울기 모습: 화면에서는 실제 각도의 2.4배(최대 30°) → 작은 각도도 기울어진 게 확실히 보임
  // ax: +는 오른쪽이 낮음, ay: +는 아래쪽이 낮음. 낮아진 쪽은 멀어져 작고 어둡게, 판 그림자도 그쪽으로 (style.css의 .tilted)
  // 시연 화면에서도 같이 씀
  function tiltVisual(el, ax, ay) {
    const sx = Math.max(-30, Math.min(30, ax * 2.4));
    const sy = Math.max(-30, Math.min(30, ay * 2.4));
    const on = ax !== 0 || ay !== 0;
    el.style.transform = on ? `perspective(700px) rotateX(${(-sy).toFixed(1)}deg) rotateY(${sx.toFixed(1)}deg)` : '';
    el.classList.toggle('tilted', on);
    if (!on) return;
    el.style.setProperty('--tilt-amt', Math.min(1, Math.hypot(sx, sy) / 24).toFixed(2));
    el.style.setProperty('--tilt-dir', `${Math.round((Math.atan2(ax, -ay) * 180) / Math.PI)}deg`); // 그라데이션: 높은 쪽 → 낮은 쪽
    el.style.setProperty('--tsx', Math.sign(ax));
    el.style.setProperty('--tsy', Math.sign(ay));
  }
  window.tiltVisual = tiltVisual;
  window.__cc = () => state; // 시험용 (자동 시험에서 상태 확인)

  function setTilt(ax, ay) {
    state.tiltX = ax;
    state.tiltY = ay;
    tiltVisual(board, ax, ay);
  }

  function levelBoard() {
    if (state) { state.tiltX = 0; state.tiltY = 0; state.rollAcc = 0; state.rollVel = 0; }
    tiltVisual(board, 0, 0);
  }

  // 굴러갈 수 있는 한 칸 (판 밖이면 뚫린 벽일 때만 = 떨어짐)
  const rollable = (dx, dy) => {
    const nx = state.px + dx;
    const ny = state.py + dy;
    return inside(nx, ny) ? canStep(nx, ny) : !wallBlocks(dx, dy);
  };

  function updateTilt(dt) {
    const tl = state.tiltCfg;
    if (!tl) return;
    state.tiltLeft -= dt;
    if (state.tiltLeft <= 0) {
      if (state.tiltPhase === 'flat') {
        state.tiltPhase = 'tilted';
        const deg = rand(tl.angle[0], tl.angle[1]) + state.tiltBonus;
        const kinds = tl.dirs || ['h'];
        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        const sx = Math.random() < 0.5 ? -1 : 1;
        const sy = Math.random() < 0.5 ? -1 : 1;
        if (kind === 'h') setTilt(sx * deg, 0);
        else if (kind === 'v') setTilt(0, sy * deg);
        else setTilt(sx * deg * 0.75, sy * deg * 0.75); // 대각선: 두 방향으로 나눠서 (전체 기울기는 비슷하게)
        state.tiltLeft = rand(tl.tilted[0], tl.tilted[1]);
        state.rollAcc = 0;
        state.rollVel = 0;
        state.rollWait = 0.45; // 판이 기울어지는 동안은 잠깐 기다렸다 굴러감
        state.resting = false;
        sfx.tilt();
      } else {
        state.tiltPhase = 'flat';
        setTilt(0, 0); // 굴러가던 힘(rollVel)은 남겨서 조금 더 굴러가다 멈춤 (coast)
        state.tiltLeft = rand(tl.flat[0], tl.flat[1]);
      }
    }
    if (!state.tiltX && !state.tiltY) { coast(dt); return; }
    if (state.rollWait > 0) { state.rollWait -= dt; return; }
    // 중력처럼 점점 빨라짐: 작은 기울기도 금방 굴러가게 (3° → 최고 약 3칸/초, 10° → 5칸/초, 최대 6칸/초)
    const a = Math.hypot(state.tiltX, state.tiltY);
    const sx = Math.sign(state.tiltX);
    const sy = Math.sign(state.tiltY);
    // 낮은 쪽으로 한 칸. 대각선이 막히면 벽을 따라 미끄러지듯 가로·세로 중 갈 수 있는 쪽
    const tries = sx && sy ? [[sx, sy], [sx, 0], [0, sy]] : [[sx, sy]];
    const step = tries.find(([dx, dy]) => rollable(dx, dy));
    if (!step) {
      // 벽·막힌 블록: 굴러오던 힘이 있으면 한 번 부딪혀 튕기고, 그다음엔 기대어 멈춤
      if (!state.resting && state.rollVel > 0.6) {
        const [dx, dy] = tries[0];
        if (!inside(state.px + dx, state.py + dy)) wallHit(dx, dy); else bumpPlayer(dx, dy);
      }
      state.resting = true;
      state.rollVel = 0;
      state.rollAcc = 0;
      return;
    }
    state.rollVel = Math.min(Math.min(6, 2 + a * 0.3), state.rollVel + (2 + a * 0.4) * dt);
    state.rollDir = step;
    rollOn(step, dt);
  }

  // 굴러가는 힘만큼 앞으로. 한 칸만큼 모이면 다음 칸으로 (판 밖이고 벽이 없으면 떨어짐)
  function rollOn([dx, dy], dt) {
    state.rollAcc += state.rollVel * dt;
    if (state.rollAcc < 1) return;
    state.rollAcc -= 1;
    if (!inside(state.px + dx, state.py + dy)) fallOff(dx, dy);
    else move(dx, dy, Math.min(0.7, Math.max(0.12, 1 / state.rollVel))); // 다음 칸까지 이어서 굴러감
  }

  // 판이 평평해진 뒤: 굴러가던 방향으로 마찰에 점점 느려지며 조금 더 굴러감
  function coast(dt) {
    if (!(state.rollVel > 0) || !state.rollDir) return;
    state.rollVel -= 4 * dt;
    const [dx, dy] = state.rollDir;
    if (state.rollVel <= 0.3 || !rollable(dx, dy)) { state.rollVel = 0; state.rollAcc = 0; return; }
    rollOn(state.rollDir, dt);
  }


  // ── 클리어 연출: 바닥 전체가 아래 → 위로 한 번 차오르며 옅은 파랑 → 짙은 파랑 (약 3초) → "클리어!" → 결과 창 ──
  // 연출 중에 판을 탭하면 바로 결과 창으로
  const WAVE_MS = 3000;
  const WAVE_ROW = 0.15; // 줄 사이 시차 (초)
  const BANNER_MS = 1000;
  let celebration = null; // { timers, finish }
  // fail = true: 생명을 다 잃었을 때 (빨간색, "실패")
  function celebrate(done, fail = false) {
    // 칸마다 시작 시각: 아래 줄부터 한 줄에 WAVE_ROW초씩 늦게 → 한 번 아래에서 위로 차오름
    cells.forEach((c, i) => {
      c.style.setProperty('--wd', `${((ROWS - 1 - Math.floor(i / COLS)) * WAVE_ROW).toFixed(3)}s`);
    });
    board.classList.add('wave');
    board.classList.toggle('wave-fail', fail);
    if (!fail) sfx.wave(); // 실패는 "삐———"가 대신함
    const finish = () => {
      if (!celebration) return;
      stopCelebration();
      done();
    };
    celebration = {
      finish,
      timers: [
        setTimeout(() => {
          board.classList.remove('wave');
          clearBanner.textContent = t(fail ? 'failed' : 'clear');
          clearBanner.classList.toggle('fail', fail);
          clearBanner.classList.remove('hidden');
          if (!fail) sfx.clear();
        }, WAVE_MS),
        setTimeout(finish, WAVE_MS + BANNER_MS),
      ],
    };
  }

  function stopCelebration() {
    if (!celebration) return;
    celebration.timers.forEach(clearTimeout);
    celebration = null;
    board.classList.remove('wave', 'wave-fail');
    clearBanner.classList.add('hidden');
  }

  // ── 랭킹 ──
  let rankToken = 0; // 모달이 바뀔 때마다 증가 → 늦게 온 응답이 다른 화면을 덮어쓰지 않게
  function showRanking(n) {
    const back = state && state.phase === 'clear' ? clearModalBack : closeModal;
    showModal(t('ranking'), '', null, [[t('close'), back, true]]);
    const token = rankToken;
    const body = $('modalBody');
    body.innerHTML = `
      <div class="rank-nav">
        <button class="secondary icon" id="rankPrev" ${n === 0 ? 'disabled' : ''}>◀</button>
        <b>${stageLabel(n)}</b>
        <button class="secondary icon" id="rankNext" ${n === STAGES.length - 1 ? 'disabled' : ''}>▶</button>
      </div>
      <ol class="rank-list" id="rankList"><li class="empty">${t('loading')}</li></ol>
      <p class="rank-me" id="rankMe"></p>
      <label class="name-label" for="nameInput">${t('nameLabel')}</label>
      <div class="name-row">
        <input id="nameInput" maxlength="12" placeholder="${t('name')}" autocomplete="off">
        <button id="nameBtn" class="secondary" disabled>${t('save')}</button>
      </div>
      <p class="name-status" id="nameStatus"></p>`;
    $('rankPrev').onclick = () => showRanking(n - 1);
    $('rankNext').onclick = () => showRanking(n + 1);
    // 닉네임 저장: 바꿨을 때만 버튼이 눌림, 엔터로도 저장, 저장하면 목록의 내 이름도 바로 바꿈
    const input = $('nameInput');
    const nameBtn = $('nameBtn');
    input.value = progress.name;
    input.oninput = () => {
      const v = input.value.trim();
      nameBtn.disabled = !v || v === progress.name;
      $('nameStatus').textContent = '';
    };
    input.onkeydown = (e) => { if (e.key === 'Enter' && !nameBtn.disabled) nameBtn.click(); };
    nameBtn.onclick = () => {
      const name = input.value.trim().slice(0, 12);
      if (!name || name === progress.name) return;
      progress.name = name;
      save();
      nameBtn.disabled = true;
      input.blur();
      $('nameStatus').textContent = t('saved');
      document.querySelectorAll('#rankList li.me span:nth-child(2)').forEach((s) => { s.textContent = name; });
      window.cloud?.rename(name, Object.keys(progress.best)); // 서버 기록의 이름은 뒤에서 바꿈
    };

    const myBest = progress.best[n];
    $('rankMe').textContent = myBest == null ? `${t('myBest')} —` : `${t('myBest')} ${fmt(myBest)}`;
    if (!window.cloud) { $('rankList').innerHTML = `<li class="empty">${t('offline')}</li>`; return; }
    Promise.all([
      window.cloud.top(n, 10),
      myBest == null ? null : window.cloud.rank(n, myBest),
    ]).then(([list, myRank]) => {
      if (token !== rankToken) return;
      const ol = $('rankList');
      ol.innerHTML = '';
      if (!list) { ol.innerHTML = `<li class="empty">${t('offline')}</li>`; return; }
      if (!list.length) { ol.innerHTML = `<li class="empty">${t('noRecords')}</li>`; return; }
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
      if (myRank) $('rankMe').textContent = `${t('myBest')} ${fmt(myBest)} · #${myRank}`;
    });
  }

  function closeModal() {
    rankToken++;
    modal.classList.add('hidden');
  }

  // 클리어 화면에서 랭킹을 열었다가 닫으면 클리어 화면으로 돌아감
  function clearModalBack() {
    const n = state.n;
    const best = progress.best[n];
    showModal(t('clear'), best == null ? '' : `${t('myBest')} ${fmt(best)}`, progress.stars[n], resultButtons(n));
  }

  // 결과 화면 버튼: 다음 행동 전에 전면 광고 차례면 먼저 보여줌 (출시 모드만)
  const afterAd = (fn) => () => window.Ads.beforeNext().then(fn);
  function resultButtons(n) {
    const hasNext = n + 1 < STAGES.length;
    return [
      hasNext && [t('next'), afterAd(() => startStage(n + 1))],
      [`🏆 ${t('ranking')}`, () => showRanking(n), true],
      [t('retry'), afterAd(() => startStage(n)), true],
      [t('stages'), afterAd(showStages), true],
    ];
  }

  function failStage(reason) {
    state.phase = 'fail';
    levelBoard();
    state.failReason = reason;
    window.Ads.countResult();
    // 죽음(생명 0): 깨진 뒤 긴 "삐———" + 클리어와 같은 연출을 빨간색으로 → 실패 창
    // 시간 초과: "삐삐" 하고 바로 실패 창
    if (reason === 'outOfLife') {
      sfx.flatline();
      celebrate(showFailModal, true);
    } else {
      sfx.timeUp();
      showFailModal();
    }
  }

  function showFailModal() {
    const n = state.n;
    const life = state.failReason === 'outOfLife';
    const cfg = window.ADS_CONFIG || {};
    // 보상형 광고 이어하기: 출시 모드에서 실패할 때마다
    const canContinue = window.Ads.isRelease(); // 이어한 뒤 또 실패해도 다시 광고로 이어할 수 있음
    showModal(t('failed'), t(state.failReason), null, [
      canContinue && [
        life ? t('watchAdLife', { n: cfg.rewardedLife ?? 3 }) : t('watchAdTime', { n: cfg.rewardedTime ?? 60 }),
        async () => {
          const ok = await window.Ads.showRewarded();
          if (ok) continueStage(life);
          else showFailModal(); // 끝까지 안 봤으면 그대로
        },
      ],
      [t('retry'), afterAd(() => startStage(n)), canContinue],
      [t('stages'), afterAd(showStages), true],
    ], true);
  }

  // 광고 보상: 생명이나 시간을 받고 카운트다운 후 이어서
  function continueStage(life) {
    const cfg = window.ADS_CONFIG || {};
    state.continued = true;
    if (life) {
      restorePlayer();
      state.lives = Math.min(MAX_LIVES, cfg.rewardedLife ?? 3);
      state.invincible = 2; // 이어하자마자 맞지 않게
    } else {
      state.timeLeft += cfg.rewardedTime ?? 60;
    }
    // 이어할 때는 시작 지점(초록)에서 다시. 미끄러지지 않고 바로 옮김
    state.px = state.startX;
    state.py = state.startY;
    state.drag = null;
    state.rollVel = 0;
    state.rollAcc = 0;
    playerEl.classList.remove('falling'); // 떨어져서 끝났으면 다시 보이게
    playerEl.classList.add('snap');
    render();
    void playerEl.offsetWidth;
    playerEl.classList.remove('snap');
    closeModal();
    updateHud();
    state.phase = 'ready';
    state.countdown = 1.2;
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function pause() {
    if (!state || (state.phase !== 'play' && state.phase !== 'ready')) return;
    state.resumePhase = state.phase;
    state.phase = 'paused';
    cancelAnimationFrame(rafId);
    showModal(t('paused'), '', null, [
      [t('resume'), resume],
      [t('retry'), () => startStage(state.n), true],
      [t('stages'), showStages, true],
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
    // 창이 뜬 직후의 터치는 무시: 판을 탭해서 클리어하면 손을 뗀 자리로 클릭이 한 번 더 들어와서
    // 마침 그 자리에 있는 '다음' 버튼이 눌려 창을 보기도 전에 넘어가는 일이 있었음
    const openedAt = performance.now();
    buttons.filter(Boolean).forEach(([label, fn, secondary]) => {
      const b = document.createElement('button');
      // 문구 속 ♥는 빨간 하트로
      label.split('♥').forEach((part, k) => {
        if (k > 0) {
          const heart = document.createElement('span');
          heart.className = 'heart';
          heart.textContent = '♥';
          b.appendChild(heart);
        }
        if (part) b.appendChild(document.createTextNode(part));
      });
      if (secondary) b.className = 'secondary';
      b.onclick = () => {
        if (performance.now() - openedAt < MODAL_GUARD_MS) return;
        box.querySelectorAll('button').forEach((x) => { x.disabled = true; });
        fn();
      };
      box.appendChild(b);
    });
    modal.classList.remove('hidden');
  }

  // ── 스테이지 선택 ──
  function showStages() {
    stopCelebration();
    levelBoard();
    cancelAnimationFrame(rafId);
    state = null;
    closeModal();
    window.Demo.stop();
    gameScreen.classList.add('hidden');
    demoScreen.classList.add('hidden');
    privacyScreen.classList.add('hidden');
    stageScreen.classList.remove('hidden');
    const unlocked = (i) => i === 0 || (progress.stars[i - 1] || 0) > 0;
    const starsOf = (i) => progress.stars[i] || 0;

    // 처음 열 때는 아직 안 깬 스테이지가 있는 난이도 탭
    if (progress.tab == null) {
      const firstOpen = STAGES.findIndex((_, i) => unlocked(i) && !starsOf(i));
      progress.tab = tierOf(firstOpen < 0 ? STAGES.length - 1 : firstOpen).tier;
    }

    // 난이도 탭 (앞 난이도를 다 깨야 다음 난이도 첫 스테이지가 열림)
    const tabs = $('tierTabs');
    tabs.innerHTML = '';
    TIERS.forEach((tier, ti) => {
      const start = tierStart(ti);
      const got = tier.stages.reduce((sum, _, k) => sum + starsOf(start + k), 0);
      const b = document.createElement('button');
      b.className = 'tab' + (ti === progress.tab ? ' active' : '') + (unlocked(start) ? '' : ' locked');
      b.innerHTML = `${t(`tier${tier.name}`)}<small>${unlocked(start) ? '' : '🔒 '}★ ${got}/${tier.stages.length * 3}</small>`; // 잠금 표시는 아래 줄에 (이름이 한 줄로 유지되게)
      b.onclick = () => { progress.tab = ti; showStages(); };
      tabs.appendChild(b);
    });

    const grid = $('stageGrid');
    grid.innerHTML = '';
    const start = tierStart(progress.tab);
    TIERS[progress.tab].stages.forEach((_, k) => {
      const i = start + k;
      const stars = starsOf(i);
      const b = document.createElement('button');
      b.className = 'stage-btn' + (unlocked(i) ? '' : ' locked');
      b.innerHTML = unlocked(i)
        ? `${k + 1}<small>${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</small>`
        : `🔒<small>${k + 1}</small>`;
      if (unlocked(i)) b.onclick = () => startStage(i);
      grid.appendChild(b);
    });
    $('totalStars').textContent = `★ ${STAGES.reduce((sum, _, i) => sum + starsOf(i), 0)}`;
  }

  // ── 입력 ──
  // 공 끌기: 공(또는 바로 옆 칸)을 누른 채 끌면 손가락 아래 칸으로 따라감 (가장 정확)
  // 스와이프: 공이 아닌 곳에서 밀기. 손을 떼지 않고 계속 끌면 여러 칸 이동 (8방향)
  // 짧게 민 것도 스와이프: 손가락이 TAP_SLOP 이상 움직였으면 민 방향으로 (탭한 위치 쪽으로 가지 않음)
  // 탭: 손가락이 거의 안 움직였을 때만 탭한 칸 방향으로 한 칸 이동
  const SWIPE = 26;
  const TAP_SLOP = 10;
  // 대각선으로 인정하는 각도 (수평에서 몇 도). 끌던 방향을 유지해서 엉뚱한 방향이 섞이지 않게
  //   처음:              25°~65°
  //   직선으로 끌던 중:  32°~58° (살짝 휘어도 계속 직선)
  //   대각선으로 끌던 중: 15°~75° (손가락이 조금 흔들려도 계속 대각선)
  const DIAGONAL_BAND = { first: [25, 65], straight: [32, 58], diagonal: [15, 75] };
  function move8(dx, dy, last = 'first') {
    const [min, max] = DIAGONAL_BAND[last];
    const angle = Math.atan2(Math.abs(dy), Math.abs(dx)) * 180 / Math.PI;
    if (angle < min) { move(Math.sign(dx), 0); return 'straight'; }
    if (angle > max) { move(0, Math.sign(dy)); return 'straight'; }
    move(Math.sign(dx), Math.sign(dy));
    return 'diagonal';
  }
  // touch: 시작점(sx, sy), 다음 칸 기준점(x, y), 이동했는지, 마지막 방향 종류
  let touch = null;
  // 손가락 위치 → 판 위 칸 좌표 (소수, 칸 단위)
  function fingerCell(e) {
    const r = board.getBoundingClientRect();
    return [(e.clientX - r.left) / (r.width / COLS), (e.clientY - r.top) / (r.height / ROWS)];
  }
  boardWrap.addEventListener('pointerdown', (e) => {
    if (celebration) { celebration.finish(); return; } // 클리어 연출 건너뛰기
    boardWrap.setPointerCapture(e.pointerId);
    if (state && (state.phase === 'play' || state.phase === 'ready')) {
      const [fx, fy] = fingerCell(e);
      if (Math.abs(fx - (state.px + 0.5)) <= DRAG_GRAB && Math.abs(fy - (state.py + 0.5)) <= DRAG_GRAB) {
        // 공 잡기: 처음 목표는 손가락 아래 칸 (바로 옆 칸을 눌렀으면 그 칸으로 감)
        const tx = Math.max(0, Math.min(COLS - 1, Math.floor(fx)));
        const ty = Math.max(0, Math.min(ROWS - 1, Math.floor(fy)));
        state.drag = { tx, ty, active: true, acc: DRAG_STEP };
        touch = { mode: 'drag' };
        render();
        return;
      }
    }
    touch = { sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, moved: false, last: 'first' };
  });
  boardWrap.addEventListener('pointermove', (e) => {
    if (!touch) return;
    if (touch.mode === 'drag') {
      if (!state || !state.drag) return;
      const [fx, fy] = fingerCell(e);
      const d = state.drag;
      // 지금 목표 칸 중심에서 0.5 + 여유 이상 벗어나야 목표를 바꿈
      if (Math.abs(fx - (d.tx + 0.5)) > 0.5 + DRAG_HYSTERESIS) d.tx = Math.max(0, Math.min(COLS - 1, Math.floor(fx)));
      if (Math.abs(fy - (d.ty + 0.5)) > 0.5 + DRAG_HYSTERESIS) d.ty = Math.max(0, Math.min(ROWS - 1, Math.floor(fy)));
      return;
    }
    const dx = e.clientX - touch.x;
    const dy = e.clientY - touch.y;
    if (Math.hypot(dx, dy) < SWIPE) return;
    touch.last = move8(dx, dy, touch.last);
    touch.x = e.clientX;
    touch.y = e.clientY;
    touch.moved = true;
  });
  boardWrap.addEventListener('pointerup', (e) => {
    if (touch && touch.mode === 'drag') {
      if (state && state.drag) state.drag.active = false; // 마지막 목표까지 가서 멈춤
      touch = null;
      return;
    }
    const sdx = touch ? e.clientX - touch.sx : 0;
    const sdy = touch ? e.clientY - touch.sy : 0;
    if (touch && !touch.moved && state && Math.hypot(sdx, sdy) >= TAP_SLOP) {
      move8(sdx, sdy); // 짧게 민 스와이프
    } else if (touch && !touch.moved && state) {
      const r = board.getBoundingClientRect();
      const cx = (e.clientX - r.left) / (r.width / COLS) - 0.5;
      const cy = (e.clientY - r.top) / (r.height / ROWS) - 0.5;
      const dx = cx - state.px;
      const dy = cy - state.py;
      if (Math.max(Math.abs(dx), Math.abs(dy)) >= 0.5) move8(dx, dy);
    }
    touch = null;
  });
  boardWrap.addEventListener('pointercancel', () => {
    if (touch && touch.mode === 'drag' && state && state.drag) state.drag.active = false;
    touch = null;
  });
  // 판에서 손을 뗄 때 브라우저가 덧붙이는 클릭을 막음 (이동은 pointer 이벤트로 이미 처리)
  boardWrap.addEventListener('touchend', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });

  const KEYS = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
    q: [-1, -1], e: [1, -1], z: [-1, 1], c: [1, 1], // 대각선
  };
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return; // 닉네임 입력 중
    const k = KEYS[e.key] || KEYS[e.key.toLowerCase()];
    if (k) { e.preventDefault(); move(k[0], k[1]); }
    else if (e.key === 'Escape' || e.key === 'p') { state && state.phase === 'paused' ? resume() : pause(); }
  });

  $('backBtn').onclick = showStages;
  $('pauseBtn').onclick = pause;
  $('helpBtn').onclick = () => showDemo(showStages, false);

  // 언어 선택 (data-i18n 글자는 I18N.apply가 바꾸고, 스테이지 화면은 다시 그림)
  const langBtn = $('langBtn');
  const updateLangBtn = () => { langBtn.textContent = `🌐 ${window.I18N.LANGS[window.I18N.lang]}`; };
  langBtn.onclick = () => {
    showModal(t('language'), '', null, [
      ...Object.entries(window.I18N.LANGS).map(([code, label]) => [label, () => {
        window.I18N.setLang(code);
        updateLangBtn();
        showStages();
      }, code !== window.I18N.lang]),
      [t('close'), closeModal, true],
    ]);
  };
  updateLangBtn();

  // 광고 모드 전환 (TEST = 광고 없음, RELEASE = 광고 있음)
  const modeBtn = $('modeBtn');
  const updateModeBtn = () => {
    const release = window.Ads.isRelease();
    modeBtn.dataset.i18n = release ? 'adRelease' : 'adTest';
    modeBtn.textContent = t(modeBtn.dataset.i18n);
    modeBtn.classList.toggle('release', release);
  };
  modeBtn.classList.toggle('hidden', !window.Ads.showToggle);
  modeBtn.onclick = () => { window.Ads.setMode(window.Ads.isRelease() ? 'test' : 'release'); updateModeBtn(); };
  updateModeBtn();
  $('rankBtn').onclick = () => {
    const played = Object.keys(progress.best).map(Number);
    showRanking(played.length ? Math.max(...played) : 0);
  };
  const soundBtn = $('soundBtn');
  const updateSoundBtn = () => {
    soundBtn.dataset.i18n = progress.sound ? 'soundOn' : 'soundOff';
    soundBtn.textContent = t(soundBtn.dataset.i18n);
  };
  soundBtn.onclick = () => { progress.sound = !progress.sound; save(); updateSoundBtn(); };
  updateSoundBtn();

  window.addEventListener('resize', () => { if (state) resizeBoard(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  // ── 시연 화면 ──
  // ── 시작 안내: 앱을 열 때마다 개인정보처리방침 → 게임 방법 시연 ──
  // '다음부터 표시하지 않기'를 체크하면 다음 실행부터는 바로 스테이지 화면 (기기별 설정)
  const HIDE_INTRO_KEY = 'cybercube.hideIntro';
  const introHidden = () => { try { return localStorage.getItem(HIDE_INTRO_KEY) === '1'; } catch (e) { return false; } };
  const hideBoxes = document.querySelectorAll('.hide-intro');
  hideBoxes.forEach((box) => {
    box.onchange = () => {
      try { localStorage.setItem(HIDE_INTRO_KEY, box.checked ? '1' : '0'); } catch (e) { /* 이번 실행 동안만 */ }
      hideBoxes.forEach((other) => { other.checked = box.checked; }); // 두 화면의 체크 상자는 같은 설정
    };
  });

  // withCheck: 시작 안내로 열 때만 체크 상자 표시 (? 버튼으로 열면 숨김)
  function showDemo(done, withCheck) {
    stageScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    privacyScreen.classList.add('hidden');
    demoScreen.classList.remove('hidden');
    demoScreen.querySelector('.intro-check').classList.toggle('hidden', !withCheck);
    window.Demo.start(done);
  }

  function showPrivacy(done) {
    stageScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    demoScreen.classList.add('hidden');
    privacyScreen.classList.remove('hidden');
    $('privacyFrame').src = `privacy.html?lang=${encodeURIComponent(window.I18N.lang)}&embed=1`;
    $('privacyOk').onclick = done;
  }

  function showIntro() {
    hideBoxes.forEach((box) => { box.checked = introHidden(); });
    showPrivacy(() => showDemo(showStages, true));
  }

  window.Orb.mount(playerEl);
  // 한 번만 재생하는 효과(벽 튕김·부딪힘·다시 나타남)는 끝나면 표시를 지움 → 다음 효과를 가리지 않게
  playerEl.addEventListener('animationend', (e) => {
    if (e.target === playerEl && ['wallhit', 'bump', 'respawn'].includes(e.animationName)) playerEl.classList.remove(e.animationName);
  });
  buildBoard();
  buildWalls();
  if (introHidden()) showStages();
  else showIntro();
  window.cloud?.start(JSON.parse(JSON.stringify(progress)), applyCloudProgress);
})();
