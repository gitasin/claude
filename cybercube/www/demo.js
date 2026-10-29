// 시연 화면: 미니 판(5×5)에서 규칙을 장면별로 자동 재생
// - 실제 게임과 같은 타일 스타일(.cell .blue/.red/.green ...)을 그대로 씀
// - window.Demo.start(onDone) / window.Demo.start(onDone, 'tp' | 'fr' | 'r1'~'r4'): 아이템 사용법·레벨별 빨강 한 장면만 반복 / window.Demo.stop()
(() => {
  const N = 5;
  const t = window.I18N.t;
  const $ = (id) => document.getElementById(id);
  const boardEl = $('demoBoard');
  const playerEl = $('demoPlayer');
  const swipeEl = $('demoSwipe');
  const badgeEl = $('demoBadge');
  const tapEl = $('demoTap');

  // 장면: title/sub = 설명의 번역 키 (i18n.js), map = 판 ('.' 바닥, 'B' 파랑, 'G' 초록), player = 시작 위치
  //       steps = [[이전 단계 후 대기(ms), (d) => 동작], ...]
  const SCENES = [
    {
      title: 'd1t',
      sub: 'd1s',
      map: ['.....', '.....', '.....', '.....', '.....'],
      player: [2, 2],
      steps: [
        [700, (d) => d.move(0, -1)],
        [650, (d) => d.move(1, 0)],
        [650, (d) => d.move(0, 1)],
        [650, (d) => d.move(-1, 1)],
        [650, (d) => d.move(-1, -1)],
        [650, (d) => d.move(1, -1)],
      ],
    },
    {
      title: 'd2t',
      sub: 'd2s',
      map: ['.....', '.B...', '...B.', '.B...', '.....'],
      player: [2, 4],
      hud: { blue: true },
      steps: [
        [700, (d) => d.move(-1, -1)],
        [600, (d) => d.move(0, -1)],
        [600, (d) => d.move(0, -1)],
        [600, (d) => d.move(1, 1)],
        [600, (d) => d.move(1, 0)],
        [300, (d) => d.badge(t('clear'), 'good')],
      ],
    },
    {
      title: 'd3t',
      sub: 'd3s',
      map: ['..B..', '.....', '.....', '.....', '.....'],
      player: [2, 4],
      hud: { blue: true },
      steps: [
        [300, (d) => d.red([[0, 2]])],
        [450, (d) => d.move(0, -1)],
        [300, (d) => d.red([[1, 2]])],
        [450, (d) => d.red([[2, 2]])],
        [450, (d) => d.red([[3, 2]])],
        [200, (d) => d.move(0, -1)],
        [250, (d) => d.red([[4, 2]])],
        [300, (d) => d.move(0, -1)],
        [200, (d) => d.red([[3, 2]])],
        [300, (d) => d.move(0, -1)],
        [200, (d) => d.red([[2, 2]])],
        [300, (d) => d.badge(t('nice'), 'good')],
      ],
    },
    {
      title: 'd4t',
      sub: 'd4s',
      map: ['.....', '.....', '.....', '.....', '.....'],
      player: [2, 3],
      hud: { lives: true },
      steps: [
        [0, (d) => d.red([[2, 1]])],
        [700, (d) => d.move(0, -1)],
        [600, (d) => d.move(0, -1)],
        [0, (d) => d.hit()],
        [900, (d) => d.move(0, 1)],
      ],
    },
    {
      title: 'd5t',
      sub: 'd5s',
      map: ['.....', '.....', '..G..', '.....', '.....'],
      player: [2, 3],
      steps: [
        [300, (d) => d.sweep(0)],
        [500, (d) => d.sweep(1)],
        [150, (d) => d.move(0, -1)],
        [350, (d) => d.sweep(2)],
        [100, (d) => d.badge(t('safe'), 'good')],
        [400, (d) => d.sweep(3)],
        [500, (d) => d.sweep(4)],
        [500, (d) => d.red([])],
      ],
    },
    {
      title: 'd6t',
      sub: 'd6s',
      map: ['.....', '.B...', '.....', '...B.', '.....'],
      player: [2, 4],
      hud: { blue: true },
      steps: [
        [700, (d) => d.warnBlue(true)],
        [1100, (d) => { d.warnBlue(false); d.teleport([[1, 1], [3, 3]], [[1, 3], [3, 1]]); }],
        [600, (d) => d.move(-1, -1)],
        [550, (d) => d.move(1, -1)],
        [550, (d) => d.move(1, -1)],
        [300, (d) => d.badge(t('clear'), 'good')],
      ],
    },
    // 판 기울기(d8t)·벽 뚫린 곳으로 떨어지기(d9t) 장면은 뺌: 지금 레벨은 기울기 없고 벽이 모두 막힘
    {
      title: 'd7t',
      sub: 'd7s',
      map: ['.....', '..B..', '.....', '.....', '.....'],
      player: [2, 3],
      hud: { blue: true, timer: true },
      steps: [
        [50, (d) => d.timer(0.45)],
        [650, (d) => d.move(0, -1)],
        [550, (d) => d.move(0, -1)],
        [300, (d) => d.badge('★★★', 'stars')],
      ],
    },
  ];

  // 아이템 사용법 (아이템 창의 ? 버튼)
  const pat = (k) => { const p = k % 8; return p <= 4 ? p : 8 - p; }; // 0→4→0 왕복하는 빨강 위치
  const HOLD_FROM = 3;  // 몇 번째 걸음부터 볼을 누르기 시작하는지
  const HOLD_STEPS = 6; // 누르는 동안 빨강이 움직이는 걸음 수 (333ms × 6 ≈ 2초)
  const DIAMOND = [[0, 2], [1, 3], [2, 4], [3, 3], [4, 2], [3, 1], [2, 0], [1, 1]]; // 대각선 빨강이 벽에 튕기며 도는 길
  const BLINK_A = [[1, 1], [2, 1], [3, 1], [1, 3], [2, 3], [3, 3]]; // 깜빡이 빨강 두 무리 (번갈아 켜짐)
  const BLINK_B = [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]];
  const ITEM_SCENES = [
    {
      // 빨강 줄에 막혀 있어도 순간이동으로 건너감
      id: 'tp',
      title: 'dTpT',
      sub: 'dTpS',
      map: ['.B...', '..B..', '.....', '.....', '.....'],
      player: [2, 4],
      steps: [
        [0, (d) => d.red([[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]])],
        // 준비했다가 볼을 다시 탭해서 취소
        [800, (d) => d.tap(2, 4)],
        [220, (d) => { d.tap(2, 4); d.aim(true); }],
        [1100, (d) => { d.sub('dTpC'); d.tap(2, 4); d.aim(false); d.badge(t('tpCancel'), 'freeze'); }],
        // 다시 준비해서 갈 칸을 탭
        [1600, (d) => { d.sub('dTpS'); d.tap(2, 4); }],
        [220, (d) => { d.tap(2, 4); d.aim(true); }],
        [1100, (d) => { d.tap(1, 0); d.warp(1, 0); }],
        [1000, (d) => d.move(1, 1)],
        [300, (d) => d.badge(t('clear'), 'good')],
      ],
    },
    {
      // 볼을 2초 누름 (둘레 원이 차오름) → 빨강이 멈춘 사이 빈 칸으로 지나감
      id: 'fr',
      title: 'dFrT',
      sub: 'dFrS',
      map: ['..B..', '.....', '.....', '.....', '.....'],
      player: [2, 4],
      steps: [
        ...Array.from({ length: HOLD_FROM + HOLD_STEPS }, (_, k) => [k ? 333 : 300, (d) => {
          d.red([[pat(k), 1], [4 - pat(k), 3]]);
          if (k === HOLD_FROM) d.press(2, 4, true);
          if (k >= HOLD_FROM) d.ring((k - HOLD_FROM) / HOLD_STEPS);
        }]),
        [333, (d) => { d.ring(null); d.press(2, 4, false); d.freeze(true); d.badge('⏱ 5', 'freeze'); }],
        [600, (d) => d.move(0, -1)],
        [450, (d) => d.move(0, -1)],
        [450, (d) => d.move(0, -1)],
        [450, (d) => d.move(0, -1)],
        [300, (d) => d.badge(t('clear'), 'good')],
        [1200, (d) => d.freeze(false)],
        ...[0, 1, 2, 3].map((j) => [333, (d) => { const k = HOLD_FROM + HOLD_STEPS + 1 + j; d.red([[pat(k), 1], [4 - pat(k), 3]]); }]),
      ],
    },

    // ── 레벨별 빨강 (그 레벨 1단계에 들어갈 때) ──
    {
      // 1레벨: 한 줄로 오가는 빨강 → 지나간 틈에 건너감
      id: 'r1',
      title: 'r1T',
      sub: 'r1S',
      map: ['..B..', '.....', '.....', '.....', '.....'],
      player: [2, 4],
      steps: Array.from({ length: 12 }, (_, k) => [k ? 420 : 300, (d) => {
        d.red([[pat(k), 2]]);
        if (k === 1 || k === 4 || k === 5) d.move(0, -1);
        if (k === 6) { d.move(0, -1); d.badge(t('clear'), 'good'); }
      }]),
    },
    {
      // 2레벨: 대각선으로 튕기는 빨강 (벽에 튕기며 마름모를 그림) → 지나간 뒤 대각선으로 빠져나감
      id: 'r2',
      title: 'r2T',
      sub: 'r2S',
      map: ['....B', '.....', '.....', '.....', '.....'],
      player: [2, 2],
      steps: Array.from({ length: 12 }, (_, k) => [k ? 420 : 300, (d) => {
        d.red([DIAMOND[k % DIAMOND.length]]);
        if (k === 6) d.move(1, -1);
        if (k === 7) { d.move(1, -1); d.badge(t('clear'), 'good'); }
      }]),
    },
    {
      // 3레벨: 두 무리가 번갈아 켜짐, 켜지기 전엔 흐리게 경고 → 꺼진 칸으로 한 칸씩
      id: 'r3',
      title: 'r3T',
      sub: 'r3S',
      map: ['..B..', '.....', '.....', '.....', '.....'],
      player: [2, 4],
      steps: [
        [300, (d) => d.blink(BLINK_A, [])],
        [900, (d) => d.blink(BLINK_A, BLINK_B)],
        [600, (d) => d.blink(BLINK_B, [])],
        [150, (d) => d.move(0, -1)],
        [750, (d) => d.blink(BLINK_B, BLINK_A)],
        [600, (d) => d.blink(BLINK_A, [])],
        [150, (d) => d.move(0, -1)],
        [750, (d) => d.blink(BLINK_A, BLINK_B)],
        [600, (d) => d.blink(BLINK_B, [])],
        [150, (d) => d.move(0, -1)],
        [400, (d) => { d.move(0, -1); d.badge(t('clear'), 'good'); }],
        [600, (d) => d.blink(BLINK_B, BLINK_A)],
        [600, (d) => d.blink(BLINK_A, [])],
      ],
    },
    {
      // 4레벨: 빨강 줄이 위에서 아래로 쓸고 지나감 → 초록에서 피했다가 파랑으로
      id: 'r4',
      title: 'r4T',
      sub: 'r4S',
      map: ['B....', '.....', '..G..', '.....', '.....'],
      player: [2, 3],
      steps: [
        [300, (d) => d.sweep(0)],
        [450, (d) => d.sweep(1)],
        [150, (d) => d.move(0, -1)],
        [300, (d) => { d.sweep(2); d.badge(t('safe'), 'good'); }],
        [450, (d) => d.sweep(3)],
        [450, (d) => d.sweep(4)],
        [450, (d) => d.red([])],
        [300, (d) => d.move(-1, -1)],
        [450, (d) => { d.move(-1, -1); d.badge(t('clear'), 'good'); }],
      ],
    },
  ];
  let scenes = SCENES;

  let cells = [];
  let d = null;        // 현재 장면 상태
  let timers = [];
  let current = 0;
  let onDone = null;

  // 판 둘레 벽 (시연 판은 5×5)
  const walls = { top: [], bottom: [], left: [], right: [] };
  function buildWalls() {
    Object.keys(walls).forEach((side) => {
      for (let i = 0; i < N; i++) {
        const w = document.createElement('div');
        w.className = `wall ${side}`;
        w.style.setProperty('--i', i);
        boardEl.appendChild(w);
        walls[side].push(w);
      }
    });
  }

  function build() {
    window.Orb.mount(playerEl);
    buildWalls();
    boardEl.querySelectorAll('.cell').forEach((c) => c.remove());
    cells = [];
    for (let i = 0; i < N * N; i++) {
      const c = document.createElement('div');
      c.className = 'cell';
      boardEl.insertBefore(c, playerEl);
      cells.push(c);
    }
  }

  function render() {
    const red = new Set(d.red.map(([x, y]) => y * N + x));
    const warn = new Set(d.warnCells.map(([x, y]) => y * N + x));
    cells.forEach((c, i) => {
      const t = d.tiles[i];
      let cls = 'cell';
      if (t === 'G') cls += ' green';
      else if (red.has(i)) cls += ' red';
      else if (warn.has(i)) cls += ' warn';
      else if (t === 'B') cls += d.warn ? ' blue moving' : ' blue';
      else if (t === 'D') cls += ' done';
      if (d.pops.has(i)) cls += ' pop';
      c.className = cls;
    });
    playerEl.style.transform = `translate(${d.px * 100}%, ${d.py * 100}%)`;
    playerEl.dataset.crack = String(Math.min(2, 3 - d.lives));
    $('demoBlue').textContent = `${t('blue')} ${d.tiles.filter((x) => x === 'B').length}`;
    $('demoLives').textContent = '♥'.repeat(d.lives) + '♡'.repeat(3 - d.lives);
  }

  // 장면에서 쓰는 동작들
  const actions = {
    move(dx, dy) {
      // 스와이프 화살표를 보여주고 이동
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      swipeEl.style.transform = `translate(${d.px * 100}%, ${d.py * 100}%) rotate(${angle}deg)`;
      swipeEl.classList.remove('show');
      void swipeEl.offsetWidth;
      swipeEl.classList.add('show');
      playerEl.classList.toggle('diag', dx !== 0 && dy !== 0);
      window.rollPlayer?.(playerEl, dx, dy);
      d.px += dx;
      d.py += dy;
      const i = d.py * N + d.px;
      if (d.tiles[i] === 'B') {
        d.tiles[i] = 'D';
        d.pops.add(i);
        later(350, () => { d.pops.delete(i); render(); });
      }
      render();
    },
    red(list) { d.red = list; render(); },
    blink(on, warn) { d.red = on; d.warnCells = warn; render(); }, // 깜빡이: 켜진 칸 + 곧 켜질 칸 (흐린 빨강)
    tilt(ax, ay) { window.tiltVisual?.(boardEl, ax, ay); },
    glide(dx, dy) {
      // 기울기로 이어서 굴러가는 한 칸
      playerEl.classList.add('glide');
      playerEl.style.setProperty('--move', '0.25s');
      actions.move(dx, dy);
    },
    wallHit(dx, dy) {
      playerEl.style.setProperty('--bx', dx);
      playerEl.style.setProperty('--by', dy);
      playerEl.style.setProperty('--sqx', dx ? 0.78 : 1.12);
      playerEl.style.setProperty('--sqy', dy ? 0.78 : 1.12);
      playerEl.classList.remove('wallhit');
      void playerEl.offsetWidth;
      playerEl.classList.add('wallhit');
      const seg = dx ? walls[dx < 0 ? 'left' : 'right'][d.py] : walls[dy < 0 ? 'top' : 'bottom'][d.px];
      if (seg) { seg.classList.remove('hit'); void seg.offsetWidth; seg.classList.add('hit'); }
    },
    fall(dx, dy) {
      // 뚫린 곳 밖으로 굴러 나가 떨어짐 → 생명 -1 → 시작 지점에서 다시
      playerEl.style.setProperty('--fdx', dx);
      playerEl.style.setProperty('--fdy', dy);
      playerEl.style.transform = `translate(${(d.px + dx * 0.85) * 100}%, ${(d.py + dy * 0.85) * 100}%)`;
      window.Orb.roll(playerEl, dx, dy, 700);
      playerEl.classList.add('falling');
      later(750, () => {
        playerEl.classList.remove('falling');
        d.px = d.start[0];
        d.py = d.start[1];
        d.lives = Math.max(0, d.lives - 1);
        playerEl.style.transition = 'none';
        render();
        void playerEl.offsetWidth;
        playerEl.style.transition = '';
        playerEl.classList.add('respawn');
        later(400, () => playerEl.classList.remove('respawn'));
      });
    },
    sweep(row) {
      d.red = [];
      for (let x = 0; x < N; x++) if (d.tiles[row * N + x] !== 'G') d.red.push([x, row]);
      render();
    },
    hit() {
      d.lives = Math.max(0, d.lives - 1);
      boardEl.classList.remove('shake');
      void boardEl.offsetWidth;
      boardEl.classList.add('shake');
      playerEl.classList.add('invincible');
      later(1000, () => playerEl.classList.remove('invincible'));
      actions.badge('-♥', 'bad');
      render();
    },
    warnBlue(on) { d.warn = on; render(); },
    // 손가락 표시: 탭 한 번 / 누르고 있기
    tap(x, y) {
      tapEl.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
      tapEl.classList.remove('tap', 'press');
      void tapEl.offsetWidth;
      tapEl.classList.add('tap');
    },
    press(x, y, on) {
      tapEl.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
      tapEl.classList.remove('tap');
      tapEl.classList.toggle('press', on);
    },
    // 볼 둘레 원 (0~1, null = 숨김)
    ring(p) {
      playerEl.classList.toggle('holding', p != null);
      if (p != null) playerEl.style.setProperty('--hold', p);
    },
    freeze(on) { boardEl.classList.toggle('frozen', on); },
    aim(on) { playerEl.classList.toggle('tp-aim', on); },
    sub(key) { $('demoSub').textContent = t(key); }, // 장면 중간에 설명 바꾸기
    // 순간이동: 깜빡이며 사라졌다가 그 칸에서 나타남
    warp(x, y) {
      playerEl.classList.remove('tp-aim');
      playerEl.classList.add('tp-out');
      later(320, () => {
        playerEl.classList.remove('tp-out');
        playerEl.style.transition = 'none';
        d.px = x;
        d.py = y;
        const i = y * N + x;
        if (d.tiles[i] === 'B') {
          d.tiles[i] = 'D';
          d.pops.add(i);
          later(350, () => { d.pops.delete(i); render(); });
        }
        render();
        void playerEl.offsetWidth;
        playerEl.style.transition = '';
        playerEl.classList.add('tp-in');
        later(380, () => playerEl.classList.remove('tp-in'));
      });
    },
    teleport(from, to) {
      from.forEach(([x, y], k) => {
        const [tx, ty] = to[k];
        d.tiles[y * N + x] = '.';
        d.tiles[ty * N + tx] = 'B';
        const i = ty * N + tx;
        d.pops.add(i);
        later(350, () => { d.pops.delete(i); render(); });
      });
      render();
    },
    timer(ratio) { $('demoTimeFill').style.width = `${ratio * 100}%`; },
    badge(text, kind) {
      badgeEl.textContent = text;
      badgeEl.className = `demo-badge ${kind}`;
      later(900, () => badgeEl.classList.add('hidden'));
    },
  };

  function later(ms, fn) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function play(i) {
    clearTimers();
    current = i;
    window.Crack.reset(playerEl); // 장면마다 깨끗한 육각형 + 새 금 모양
    const s = scenes[i];
    window.tiltVisual?.(boardEl, 0, 0);
    playerEl.classList.remove('glide', 'wallhit', 'falling', 'respawn', 'tp-aim', 'tp-out', 'tp-in', 'holding');
    boardEl.classList.remove('frozen');
    tapEl.classList.remove('tap', 'press');
    playerEl.style.removeProperty('--move');
    const gaps = new Set((s.gaps || []).map(([side, i]) => `${side}${i}`));
    Object.keys(walls).forEach((side) => walls[side].forEach((w, i) => w.classList.toggle('gap', gaps.has(`${side}${i}`))));
    d = {
      start: s.player,
      tiles: s.map.join('').split(''),
      px: s.player[0],
      py: s.player[1],
      red: [],
      warnCells: [],
      pops: new Set(),
      warn: false,
      lives: 3,
    };
    $('demoTitle').textContent = t(s.title);
    $('demoSub').textContent = t(s.sub);
    const hud = s.hud || {};
    $('demoBlue').classList.toggle('hidden', !hud.blue);
    $('demoLives').classList.toggle('hidden', !hud.lives);
    $('demoTimer').classList.toggle('hidden', !hud.timer);
    const fill = $('demoTimeFill');
    fill.style.transition = 'none';
    fill.style.width = '100%';
    void fill.offsetWidth;
    fill.style.transition = '';
    badgeEl.className = 'demo-badge hidden';
    swipeEl.classList.remove('show');
    playerEl.classList.remove('invincible', 'diag');
    // 장면이 바뀔 때 플레이어가 미끄러져 가지 않도록 위치를 바로 지정
    playerEl.style.transition = 'none';
    render();
    void playerEl.offsetWidth;
    playerEl.style.transition = '';

    // 진행 점
    const dots = $('demoDots');
    dots.innerHTML = '';
    dots.classList.toggle('hidden', scenes.length < 2);
    scenes.forEach((_, k) => {
      const dot = document.createElement('button');
      dot.className = 'dot' + (k === i ? ' active' : '');
      dot.setAttribute('aria-label', `Step ${k + 1}`);
      dot.onclick = () => play(k);
      dots.appendChild(dot);
    });
    $('demoPrev').disabled = i === 0;
    $('demoNext').disabled = i === scenes.length - 1;
    $('demoStart').classList.toggle('pulse', scenes.length > 1 && i === scenes.length - 1);

    // 단계 실행 → 끝나면 잠시 후 다음 장면 (마지막 장면은 그대로 두고 START 강조)
    let elapsed = 0;
    s.steps.forEach(([wait, fn]) => { elapsed += wait; later(elapsed, () => fn(actions)); });
    if (i < scenes.length - 1) later(elapsed + 1400, () => play(i + 1));
    else if (scenes.length === 1) later(elapsed + 1400, () => play(0)); // 아이템 사용법은 계속 반복
  }

  $('demoPrev').onclick = () => current > 0 && play(current - 1);
  $('demoNext').onclick = () => current < scenes.length - 1 && play(current + 1);
  const finish = () => { window.Demo.stop(); onDone && onDone(); };
  $('demoStart').onclick = finish;
  $('demoSkip').onclick = finish;

  window.Demo = {
    start(done, item) {
      onDone = done;
      scenes = item ? ITEM_SCENES.filter((s) => s.id === item) : SCENES;
      $('demoPrev').classList.toggle('hidden', !!item);
      $('demoNext').classList.toggle('hidden', !!item);
      $('demoSkip').classList.toggle('hidden', !!item);
      $('demoStart').textContent = t(item && item[0] !== 'r' ? 'close' : 'start'); // 빨강 안내는 닫으면 바로 게임 시작
      $('demoScreen').classList.toggle('item-demo', !!item); // 아이템 사용법: 설명을 크게
      if (!cells.length) build();
      play(0);
    },
    stop() { clearTimers(); },
    has: (id) => ITEM_SCENES.some((s) => s.id === id),
  };
})();
