// 육각형 금·깨짐 (게임·시연 화면 공용)
// - Crack.reset(el)   새 금 모양을 정하고 금 SVG를 그림 (판 시작·이어하기 때)
// - Crack.shatter(el) 보이던 금선을 따라 조각내서 흩뿌림
// 실제 유리처럼: 충격 지점 → 방사형 금 8~11갈래 → 갈래 사이 거미줄 금.
// 1단계(생명 2) = 충격 자국 + 금 3~4갈래가 중간까지, 2단계(생명 1) = 모든 금이 테두리까지 + 거미줄 금
// 좌표는 육각형 상자 기준 % (0~100). SVG viewBox도 0~100이라 그대로 씀
(() => {
  const HEX = [[25, 6.7], [75, 6.7], [100, 50], [75, 93.3], [25, 93.3], [0, 50]];
  const STEPS = 6; // 금 한 갈래를 몇 마디로 꺾을지
  const rand = (a, b) => a + Math.random() * (b - a);

  // P에서 각도 a로 뻗은 선이 육각형 테두리와 만나는 점
  function rayToEdge(P, a) {
    const d = [Math.cos(a), Math.sin(a)];
    let best = null;
    HEX.forEach((A, k) => {
      const B = HEX[(k + 1) % 6];
      const e = [B[0] - A[0], B[1] - A[1]];
      const den = d[0] * e[1] - d[1] * e[0];
      if (Math.abs(den) < 1e-9) return;
      const t = ((A[0] - P[0]) * e[1] - (A[1] - P[1]) * e[0]) / den;
      const u = ((A[0] - P[0]) * d[1] - (A[1] - P[1]) * d[0]) / den;
      if (t > 0 && u >= 0 && u <= 1 && (!best || t < best.t)) best = { t, p: [P[0] + d[0] * t, P[1] + d[1] * t] };
    });
    return best.p;
  }

  // 두 점 사이를 들쭉날쭉하게 (양 끝은 그대로)
  function jagged(from, to, steps, jitter) {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
    const nx = -(to[1] - from[1]) / len;
    const ny = (to[0] - from[0]) / len;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const j = i === 0 || i === steps ? 0 : rand(-jitter, jitter);
      pts.push([from[0] + (to[0] - from[0]) * t + nx * j, from[1] + (to[1] - from[1]) * t + ny * j]);
    }
    return pts;
  }

  // 금 모양 정하기 (조각 모양도 같은 선을 써서 깨질 때 금선을 따라 갈라짐)
  function plan() {
    const P = [50 + rand(-12, 12), 50 + rand(-12, 12)];
    const n = 8 + Math.floor(Math.random() * 4);
    const step = (Math.PI * 2) / n;
    const offset = rand(0, step);
    const rays = [];
    for (let i = 0; i < n; i++) {
      const a = offset + i * step + rand(-0.35, 0.35) * step;
      const edge = rayToEdge(P, a);
      const pts = jagged(P, edge, STEPS, 1.6);
      const m = 2 + Math.floor(Math.random() * 3); // 거미줄 금이 지나는 마디 (2~4)
      // 곁가지: 절반 정도의 갈래에 하나
      let branch = null;
      if (Math.random() < 0.5) {
        const at = 1 + Math.floor(Math.random() * (STEPS - 2));
        const ba = a + (Math.random() < 0.5 ? -1 : 1) * rand(0.45, 0.8);
        const bl = rand(6, 14);
        const from = pts[at];
        branch = { at, pts: jagged(from, [from[0] + Math.cos(ba) * bl, from[1] + Math.sin(ba) * bl], 3, 1) };
      }
      rays.push({ a, pts, m, branch });
    }
    const verts = HEX.map((v) => ({ v, a: Math.atan2(v[1] - P[1], v[0] - P[0]) }));
    const wedges = [];
    const pieces = [];
    for (let i = 0; i < n; i++) {
      const A = rays[i];
      const B = rays[(i + 1) % n];
      let a1 = B.a;
      while (a1 <= A.a) a1 += Math.PI * 2;
      const between = verts
        .map(({ v, a }) => { let x = a; while (x <= A.a) x += Math.PI * 2; return { v, a: x }; })
        .filter(({ a }) => a < a1)
        .sort((p, q) => p.a - q.a)
        .map(({ v }) => v);
      const am = A.pts[A.m];
      const bm = B.pts[B.m];
      const J = [(am[0] + bm[0]) / 2 + rand(-3, 3), (am[1] + bm[1]) / 2 + rand(-3, 3)];
      wedges.push({ am, J, bm });
      // 안쪽 조각: P → A를 따라 거미줄까지 → J → B를 따라 P로
      pieces.push([...A.pts.slice(0, A.m + 1), J, ...B.pts.slice(1, B.m + 1).reverse()]);
      // 바깥 조각: A 거미줄 → A 테두리 → 꼭짓점들 → B 테두리 → B 거미줄 → J
      pieces.push([...A.pts.slice(A.m), ...between, ...B.pts.slice(B.m).reverse(), J]);
    }
    // 1단계에 보일 갈래 3~4개 (고르게 퍼지게) + 얼마나 뻗었는지
    const c1 = new Map();
    const count = 3 + Math.floor(Math.random() * 2);
    const start = Math.floor(Math.random() * n);
    for (let k = 0; k < count; k++) {
      const i = (start + Math.round((k * n) / count)) % n;
      c1.set(i, Math.min(STEPS - 1, rays[i].m + 1 + Math.floor(Math.random() * 2)));
    }
    return { P, rays, wedges, pieces, c1 };
  }

  // ── SVG 그리기 ──
  const f = (v) => v.toFixed(1);
  // 끝으로 갈수록 가늘어지는 선: 마디마다 굵기를 줄여서 그림. 틈의 그림자(core) + 빛 반사(glint)
  function taper(pts, w0, w1) {
    let core = '';
    let glint = '';
    for (let k = 0; k < pts.length - 1; k++) {
      const w = w0 + (w1 - w0) * (k / Math.max(1, pts.length - 2));
      const d = `M${f(pts[k][0])} ${f(pts[k][1])}L${f(pts[k + 1][0])} ${f(pts[k + 1][1])}`;
      core += `<path d="${d}" stroke-width="${f(w)}"/>`;
      glint += `<path d="${d}" stroke-width="${f(w * 0.45)}"/>`;
    }
    return { core, glint };
  }

  function draw(svg, pl) {
    const c1 = { core: '', glint: '' };
    const c2 = { core: '', glint: '' };
    const add = (into, t) => { into.core += t.core; into.glint += t.glint; };
    const W0 = 1.8;
    const W1 = 0.6;
    const widthAt = (k) => W0 + (W1 - W0) * (k / STEPS);

    pl.rays.forEach((r, i) => {
      const shown = pl.c1.get(i); // 1단계에서 이 마디까지 보임 (없으면 2단계에서 처음 나타남)
      if (shown != null) {
        add(c1, taper(r.pts.slice(0, shown + 1), W0, widthAt(shown)));
        add(c2, taper(r.pts.slice(shown), widthAt(shown), W1));
      } else {
        add(c2, taper(r.pts, W0 * 0.85, W1));
      }
      if (r.branch) {
        const into = shown != null && r.branch.at < shown ? c1 : c2;
        add(into, taper(r.branch.pts, widthAt(r.branch.at) * 0.6, 0.3));
      }
    });
    // 거미줄 금 (2단계)
    pl.wedges.forEach(({ am, J, bm }) => add(c2, taper([am, J, bm], 1.1, 0.8)));

    // 충격 자국 (1단계): 작게 패인 점 + 잔금
    const [px, py] = pl.P;
    let impact = `<circle cx="${f(px)}" cy="${f(py)}" r="2.4" class="pit"/>` +
      `<circle cx="${f(px)}" cy="${f(py)}" r="3.6" class="pit-ring"/>`;
    for (let k = 0; k < 6; k++) {
      const a = rand(0, Math.PI * 2);
      const l = rand(3, 6);
      add(c1, taper(jagged([px, py], [px + Math.cos(a) * l, py + Math.sin(a) * l], 2, 0.5), 0.7, 0.3));
    }

    // 금 간 조각마다 빛을 조금씩 다르게 받음 (2단계)
    const tints = pl.pieces
      .map((p) => {
        const light = Math.random() < 0.5;
        const alpha = rand(0.03, 0.12);
        return `<path d="M${p.map((q) => `${f(q[0])} ${f(q[1])}`).join('L')}Z" fill="${light ? `rgba(255,255,255,${f(alpha)})` : `rgba(10,30,55,${f(alpha)})`}"/>`;
      })
      .join('');

    svg.innerHTML =
      `<g class="c2"><g class="tints">${tints}</g><g class="glint">${c2.glint}</g><g class="core">${c2.core}</g></g>` +
      `<g class="c1"><g class="glint">${c1.glint}</g><g class="core">${c1.core}</g>${impact}</g>`;
  }

  // 점을 육각형 가운데 기준으로 회전 (화면에 보이는 몸체는 --rot만큼 돌아가 있음)
  function rotate(p, deg) {
    const t = (deg * Math.PI) / 180;
    const x = p[0] - 50;
    const y = p[1] - 50;
    return [50 + x * Math.cos(t) - y * Math.sin(t), 50 + x * Math.sin(t) + y * Math.cos(t)];
  }

  function clear(el) {
    el.classList.remove('shatter', 'crack-flash');
    el.querySelectorAll('.shard').forEach((s) => s.remove());
  }

  window.Crack = {
    reset(el) {
      clear(el);
      el.fracture = plan();
      const svg = el.querySelector('.crack');
      if (svg) draw(svg, el.fracture);
    },

    shatter(el) {
      const pl = el.fracture || plan();
      const rot = el.rot || 0;
      const P = rotate(pl.P, rot);
      el.classList.add('shatter');
      const size = el.getBoundingClientRect().width || 60; // 날아가는 거리를 칸 크기에 맞춤
      // 금선을 따라 나뉜 조각 + 작은 가루
      const dust = [];
      for (let i = 0; i < 6; i++) {
        const c = [pl.P[0] + rand(-14, 14), pl.P[1] + rand(-14, 14)];
        const s = rand(2, 4);
        dust.push([[c[0], c[1] - s], [c[0] + s, c[1] + s * 0.8], [c[0] - s * 0.9, c[1] + s * 0.6]]);
      }
      [...pl.pieces.map((p) => ({ p, dust: false })), ...dust.map((p) => ({ p, dust: true }))].forEach(({ p, dust: isDust }) => {
        const poly = p.map((q) => rotate(q, rot));
        const c = poly.reduce((acc, q) => [acc[0] + q[0] / poly.length, acc[1] + q[1] / poly.length], [0, 0]);
        let dir = [c[0] - P[0], c[1] - P[1]];
        const len = Math.hypot(dir[0], dir[1]) || 1;
        dir = [dir[0] / len, dir[1] / len];
        const dist = size * (isDust ? rand(0.9, 1.4) : rand(0.35, 0.7) * (0.6 + len / 60));
        const shard = document.createElement('div');
        shard.className = 'shard';
        shard.style.clipPath = `polygon(${poly.map((q) => `${f(q[0])}% ${f(q[1])}%`).join(', ')})`;
        shard.style.transformOrigin = `${f(c[0])}% ${f(c[1])}%`;
        const light = Math.round(rand(200, 245));
        shard.style.background = `linear-gradient(${Math.round(rand(0, 360))}deg, rgb(${light + 8}, ${light + 10}, 255), rgb(${light - 70}, ${light - 50}, ${light - 30}))`;
        shard.style.setProperty('--dx', `${f(dir[0] * dist)}px`);
        shard.style.setProperty('--dy', `${f(dir[1] * dist - rand(0, size * 0.15))}px`);
        shard.style.setProperty('--fall', `${f(size * rand(0.3, 0.7))}px`);
        shard.style.setProperty('--r', `${Math.round(rand(-240, 240))}deg`);
        shard.style.setProperty('--dur', `${rand(0.6, 0.95).toFixed(2)}s`);
        el.appendChild(shard);
      });
    },
  };
})();
