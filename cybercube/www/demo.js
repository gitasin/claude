// 시연 화면: 미니 판(5×5)에서 규칙을 장면별로 자동 재생
// - 실제 게임과 같은 타일 스타일(.cell .blue/.red/.green ...)을 그대로 씀
// - window.Demo.start(onDone) / window.Demo.stop()
(() => {
  const N = 5;
  const t = window.I18N.t;
  const $ = (id) => document.getElementById(id);
  const boardEl = $('demoBoard');
  const playerEl = $('demoPlayer');
  const swipeEl = $('demoSwipe');
  const badgeEl = $('demoBadge');

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

  let cells = [];
  let d = null;        // 현재 장면 상태
  let timers = [];
  let current = 0;
  let onDone = null;

  function build() {
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
    cells.forEach((c, i) => {
      const t = d.tiles[i];
      let cls = 'cell';
      if (t === 'G') cls += ' green';
      else if (red.has(i)) cls += ' red';
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
    const s = SCENES[i];
    d = {
      tiles: s.map.join('').split(''),
      px: s.player[0],
      py: s.player[1],
      red: [],
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
    SCENES.forEach((_, k) => {
      const dot = document.createElement('button');
      dot.className = 'dot' + (k === i ? ' active' : '');
      dot.setAttribute('aria-label', `Step ${k + 1}`);
      dot.onclick = () => play(k);
      dots.appendChild(dot);
    });
    $('demoPrev').disabled = i === 0;
    $('demoNext').disabled = i === SCENES.length - 1;
    $('demoStart').classList.toggle('pulse', i === SCENES.length - 1);

    // 단계 실행 → 끝나면 잠시 후 다음 장면 (마지막 장면은 그대로 두고 START 강조)
    let elapsed = 0;
    s.steps.forEach(([wait, fn]) => { elapsed += wait; later(elapsed, () => fn(actions)); });
    if (i < SCENES.length - 1) later(elapsed + 1400, () => play(i + 1));
  }

  $('demoPrev').onclick = () => current > 0 && play(current - 1);
  $('demoNext').onclick = () => current < SCENES.length - 1 && play(current + 1);
  const finish = () => { window.Demo.stop(); onDone && onDone(); };
  $('demoStart').onclick = finish;
  $('demoSkip').onclick = finish;

  window.Demo = {
    start(done) {
      onDone = done;
      if (!cells.length) build();
      play(0);
    },
    stop() { clearTimers(); },
  };
})();
