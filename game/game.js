// 2048 Drop — 숫자가 하나씩 위에서 떨어지는 머지 게임
// - 2 계열(2, 4, 8, 16…)과 3 계열(3, 6, 12, 24…)이 랜덤으로 나옴
// - 같은 숫자끼리 붙으면 합쳐짐 (x2)
// - 더해서 끝자리 0이 하나 늘어나면 그 합으로 합쳐짐
//   (4+6=10, 8+12=20 → 30+70=100 → 300+700=1000 …)
const COLS = 6;
const ROWS = 9;
const MOVE_MS = 120; // 합치기/중력 애니메이션 시간
const FALL_SPEED = 0.6; // 기본 낙하 속도 (행/초, 일정)

const COLORS = {
  // 2 계열: 따뜻한 색
  2: ['#eee4da', '#776e65'], 4: ['#ede0c8', '#776e65'],
  8: ['#f2b179', '#fff'], 16: ['#f59563', '#fff'],
  32: ['#f67c5f', '#fff'], 64: ['#f65e3b', '#fff'],
  128: ['#edcf72', '#fff'], 256: ['#edcc61', '#fff'],
  512: ['#edc850', '#fff'], 1024: ['#edc53f', '#fff'],
  2048: ['#edc22e', '#fff'],
  // 3 계열: 차가운 색
  3: ['#dbeafe', '#1e3a5f'], 6: ['#bfdbfe', '#1e3a5f'],
  12: ['#93c5fd', '#1e3a5f'], 24: ['#60a5fa', '#fff'],
  48: ['#3b82f6', '#fff'], 96: ['#2563eb', '#fff'],
  192: ['#8b5cf6', '#fff'], 384: ['#7c3aed', '#fff'],
  768: ['#6d28d9', '#fff'], 1536: ['#5b21b6', '#fff'],
  3072: ['#4c1d95', '#fff'],
};

// 끝자리 0 숫자: 초록 계열, 클수록 진해짐
const TEN_COLORS = [
  ['#d1fae5', '#065f46'], ['#a7f3d0', '#065f46'], ['#6ee7b7', '#065f46'],
  ['#34d399', '#fff'], ['#10b981', '#fff'], ['#059669', '#fff'],
  ['#047857', '#fff'], ['#065f46', '#fff'], ['#064e3b', '#fff'],
];

function tileColors(v) {
  if (v % 10 === 0) {
    const level = Math.floor(Math.log2(v / 10));
    return TEN_COLORS[Math.min(level, TEN_COLORS.length - 1)];
  }
  return COLORS[v] || [v % 3 === 0 ? '#2e1065' : '#3c3a32', '#fff'];
}

const $ = (id) => document.getElementById(id);
const board = $('board');
const bgLayer = $('bg');
const tilesLayer = $('tiles');

let grid = [];        // grid[r][c] = tile | null (r=0이 맨 위)
let current = null;   // 떨어지는 중인 블록 { t, c, y }
let nextValue = 2;
let score = 0;
let best = loadBest();
let state = 'ready';  // ready | playing | resolving | paused | over
let lastCol = Math.floor(COLS / 2);
let drops = 0;
let fast = false;     // 즉시 낙하
let soft = false;     // 빠르게 내리기(↓ 누르는 중)
let gameId = 0;
let ghost;

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

function loadBest() {
  try { return Number(localStorage.getItem('drop2048-best')) || 0; } catch { return 0; }
}
function saveBest() {
  try { localStorage.setItem('drop2048-best', String(best)); } catch {}
}

// ---------- 렌더링 ----------

function place(el, r, c) {
  // 화면상 행 = r + 1 (맨 윗줄은 생성 대기 줄)
  el.style.transform = `translate(${c * 100}%, ${(r + 1) * 100}%)`;
}

function formatValue(v) {
  return v < 100000 ? String(v) : Math.round(v / 1000) + 'K';
}

function paint(el, v) {
  const inner = el.querySelector('.inner');
  const text = formatValue(v);
  const [bg, fg] = tileColors(v);
  inner.textContent = text;
  inner.style.background = bg;
  inner.style.color = fg;
  inner.dataset.len = Math.min(text.length, 5);
}

function newTile(value, r, c) {
  const el = document.createElement('div');
  el.className = 'tile';
  el.innerHTML = '<div class="inner"></div>';
  paint(el, value);
  place(el, r, c);
  tilesLayer.append(el);
  return { value, r, c, el, alive: true };
}

function setupBoard() {
  board.style.setProperty('--cols', COLS);
  board.style.setProperty('--rows', ROWS);
  board.style.aspectRatio = `${COLS} / ${ROWS + 1}`;
  bgLayer.innerHTML = '';
  for (let r = -1; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell' + (r < 0 ? ' spawn' : '');
      place(cell, r, c);
      bgLayer.append(cell);
    }
  }
  ghost = document.createElement('div');
  ghost.className = 'ghost';
  bgLayer.append(ghost);
  resize();
}

function resize() {
  board.style.setProperty('--cell', bgLayer.clientWidth / COLS + 'px');
}

function updateGhost() {
  if (!current) { ghost.style.display = 'none'; return; }
  ghost.style.display = 'block';
  place(ghost, landingRow(current.c), current.c);
}

function drawCurrent() {
  current.t.el.style.transform =
    `translate(${current.c * 100}%, ${(current.y + 1) * 100}%)`;
}

function renderNext() {
  const el = $('next');
  el.innerHTML = '<div class="inner"></div>';
  paint(el, nextValue);
}

function updateScore() {
  if (score > best) { best = score; saveBest(); }
  $('score').textContent = score;
  $('best').textContent = best;
}

function showOverlay(title, text, btnText, action) {
  $('ovTitle').textContent = title;
  $('ovText').textContent = text;
  $('ovBtn').textContent = btnText;
  $('ovBtn').onclick = action;
  $('overlay').classList.remove('hidden');
}
function hideOverlay() { $('overlay').classList.add('hidden'); }

// ---------- 게임 로직 ----------

// 해당 열에서 블록이 멈출 행 (열이 꽉 찼으면 -1)
function landingRow(c) {
  for (let r = 0; r < ROWS; r++) if (grid[r][c]) return r - 1;
  return ROWS - 1;
}

// 다음 숫자: 2 계열(2~32) / 3 계열(3~48) 중 하나를 반반 확률로 고름.
// 작은 숫자가 더 자주 나옴 (가중치 5:4:3:2:1)
const SPAWN_TIERS = 5;
function genNext() {
  const base = Math.random() < 0.5 ? 2 : 3;
  const pool = [];
  for (let i = 0; i < SPAWN_TIERS; i++) pool.push(base * 2 ** i);
  const weights = pool.map((_, i) => pool.length - i);
  let pick = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    pick -= weights[i];
    if (pick < 0) return pool[i];
  }
  return pool[0];
}

function fallSpeed() {
  if (fast) return 28;
  if (soft) return 10;
  return FALL_SPEED;
}

function spawn() {
  let c = lastCol;
  if (landingRow(c) < 0) {
    c = -1;
    for (let d = 1; d < COLS && c < 0; d++) {
      for (const nc of [lastCol - d, lastCol + d]) {
        if (nc >= 0 && nc < COLS && landingRow(nc) >= 0) { c = nc; break; }
      }
    }
    if (c < 0) return gameOver();
  }
  const t = newTile(nextValue, -1, c);
  t.el.classList.add('falling', 'spawn');
  current = { t, c, y: -1 };
  fast = false;
  nextValue = genNext();
  renderNext();
  updateGhost();
}

function move(dir) {
  if (state !== 'playing' || !current) return;
  const nc = current.c + dir;
  if (nc < 0 || nc >= COLS) return;
  const land = landingRow(nc);
  // 옆 열의 블록에 걸리면 이동 불가
  if (land < 0 || land < Math.ceil(current.y - 1e-6)) return;
  current.c = nc;
  drawCurrent();
  updateGhost();
}

function moveTo(col) {
  while (current && current.c !== col) {
    const before = current.c;
    move(Math.sign(col - current.c));
    if (current.c === before) break;
  }
}

function land() {
  const { t, c } = current;
  const r = landingRow(c);
  grid[r][c] = t;
  t.r = r;
  t.c = c;
  t.el.classList.remove('falling', 'spawn');
  current = null;
  lastCol = c;
  drops++;
  fast = false;
  updateGhost();

  state = 'resolving';
  const id = gameId;
  resolve(t).then(() => {
    if (id !== gameId || state !== 'resolving') return;
    state = 'playing';
    spawn();
  });
}

// 상하좌우 이웃 중 조건에 맞는 타일 (아래쪽 우선)
function neighborsWhere(t, match) {
  const out = [];
  for (const [dr, dc] of [[1, 0], [0, -1], [0, 1], [-1, 0]]) {
    const r = t.r + dr, c = t.c + dc;
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
    const n = grid[r][c];
    if (n && match(n)) out.push(n);
  }
  return out;
}

// 끝자리 0의 개수 (예: 7 → 0, 30 → 1, 400 → 2)
function trailingZeros(v) {
  let z = 0;
  while (v % 10 === 0) { v /= 10; z++; }
  return z;
}

const sameNeighbors = (t) => neighborsWhere(t, (n) => n.value === t.value);
// 끝자리 0의 개수가 같은 두 숫자를 더해 0이 하나 이상 늘어나면 합쳐짐
// (예: 4+6=10, 30+70=100, 300+700=1000). 0의 개수가 다르면 더해도 늘어날 수 없음
const tenNeighbors = (t) => {
  const z = trailingZeros(t.value);
  return neighborsWhere(t, (n) =>
    trailingZeros(n.value) === z && trailingZeros(n.value + t.value) > z);
};

// 이웃 타일들을 t로 흡수하고 t의 값을 value로 바꿈
async function mergeInto(t, neighbors, value) {
  for (const n of neighbors) {
    grid[n.r][n.c] = null;
    n.alive = false;
    place(n.el, t.r, t.c);
  }
  await sleep(MOVE_MS);
  neighbors.forEach((n) => n.el.remove());
  t.value = value;
  paint(t.el, t.value);
  t.el.classList.remove('pop');
  void t.el.offsetWidth; // 애니메이션 재시작
  t.el.classList.add('pop');
  score += t.value;
  updateScore();
  await sleep(MOVE_MS);
}

// 빈 칸 아래로 블록 떨어뜨리기. 움직인 타일 목록 반환
async function gravity() {
  const moved = [];
  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      const t = grid[r][c];
      if (!t) continue;
      if (r !== write) {
        grid[write][c] = t;
        grid[r][c] = null;
        t.r = write;
        place(t.el, write, c);
        moved.push(t);
      }
      write--;
    }
  }
  if (moved.length) await sleep(MOVE_MS + 20);
  return moved;
}

// 연쇄 처리: 변화가 생긴 타일들을 계속 검사. 같은 숫자 합치기가 끝자리 0 합치기보다 우선
async function resolve(start) {
  const id = gameId;
  let active = [start];
  while (true) {
    active = active.filter((t) => t.alive).sort((a, b) => b.r - a.r);
    const t = active.find((x) => sameNeighbors(x).length || tenNeighbors(x).length);
    if (!t) return;
    const same = sameNeighbors(t);
    if (same.length) {
      // 같은 숫자 1개면 x2, 2개면 x4, 3개면 x8
      await mergeInto(t, same, t.value * 2 ** same.length);
    } else {
      const n = tenNeighbors(t)[0];
      await mergeInto(t, [n], t.value + n.value);
    }
    if (id !== gameId) return;
    const moved = await gravity();
    if (id !== gameId) return;
    active = [...new Set([t, ...moved, ...active])];
  }
}

function gameOver() {
  state = 'over';
  current = null;
  updateGhost();
  updateScore();
  showOverlay('게임 오버', `점수 ${score}`, '다시 하기', newGame);
}

function newGame() {
  gameId++;
  tilesLayer.innerHTML = '';
  grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  current = null;
  score = 0;
  drops = 0;
  lastCol = Math.floor(COLS / 2);
  fast = soft = false;
  nextValue = genNext();
  updateScore();
  hideOverlay();
  state = 'playing';
  spawn();
}

function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    showOverlay('일시정지', '', '계속하기', togglePause);
  } else if (state === 'paused') {
    state = 'playing';
    hideOverlay();
  }
}

// ---------- 메인 루프 ----------

let lastTs = 0;
function loop(ts) {
  const dt = Math.min((ts - lastTs) / 1000, 0.05);
  lastTs = ts;
  if (state === 'playing' && current) {
    current.y += fallSpeed() * dt;
    const target = landingRow(current.c);
    if (current.y >= target) {
      current.y = target;
      drawCurrent();
      land();
    } else {
      drawCurrent();
    }
  }
  requestAnimationFrame(loop);
}

// ---------- 입력 ----------

function colFromX(x) {
  const rect = bgLayer.getBoundingClientRect();
  return Math.max(0, Math.min(COLS - 1, Math.floor(((x - rect.left) / rect.width) * COLS)));
}

let dragging = false;
board.addEventListener('pointerdown', (e) => {
  if (state !== 'playing' || !current) return;
  dragging = true;
  board.setPointerCapture(e.pointerId);
  moveTo(colFromX(e.clientX));
});
board.addEventListener('pointermove', (e) => {
  if (dragging) moveTo(colFromX(e.clientX));
});
board.addEventListener('pointerup', () => {
  if (!dragging) return;
  dragging = false;
  if (current) fast = true;
});
board.addEventListener('pointercancel', () => { dragging = false; });

document.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowLeft': move(-1); break;
    case 'ArrowRight': move(1); break;
    case 'ArrowDown': soft = true; break;
    case 'ArrowUp':
    case ' ': if (state === 'playing' && current) fast = true; break;
    case 'p': case 'P': case 'Escape': togglePause(); break;
    default: return;
  }
  e.preventDefault();
});
document.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowDown') soft = false;
});

$('pauseBtn').addEventListener('click', togglePause);
$('restartBtn').addEventListener('click', newGame);
$('ovBtn').onclick = newGame;
window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

// ---------- 시작 ----------

grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
setupBoard();
nextValue = genNext();
renderNext();
updateScore();
requestAnimationFrame((ts) => { lastTs = ts; requestAnimationFrame(loop); });
