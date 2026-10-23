// 크리스탈 볼을 진짜 3D 구처럼 굴리기 (게임·시연 화면 공용)
// - Orb.mount(el)            .orb 안에 표면 그림(SVG)을 넣음
// - Orb.roll(el, dx, dy, ms) 한 칸 굴러감: 이동 방향으로 실제 굴러간 각도만큼 3D로 회전하며 ms 동안 다시 그림
// 표면에 박힌 크리스탈 절단선 3줄과 반짝이 점들을 회전 행렬로 돌린 뒤 화면에 비춘 모습을 그림
// → 가운데는 빠르고 가장자리로 갈수록 느려지며 작아지고, 뒤로 넘어가면 희미하게 비침(투명한 크리스탈)
// 좌표: x 오른쪽, y 아래(화면), z 화면 밖(보는 사람 쪽)
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const R_DRAW = 47;          // SVG(0~100)에서 볼 반지름
  // 한 칸에 굴러가는 각도. 실제 비율(약 180°)이면 너무 빨라 눈이 못 따라가고 무늬가 제자리처럼 보여서
  // 눈에 보이게 약 110°로 (회전 시간도 이동보다 조금 길게: game.js)
  const ROLL_PER_CELL = 1.9;

  // 3×3 행렬
  const mul = (a, b) => a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
  const apply = (m, v) => [0, 1, 2].map((i) => m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2]);
  // 축 k(단위 벡터) 기준 θ 회전 (로드리게스)
  function axisRot(k, t) {
    const [x, y, z] = k;
    const c = Math.cos(t), s = Math.sin(t), C = 1 - c;
    return [
      [c + x * x * C, x * y * C - z * s, x * z * C + y * s],
      [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
      [z * x * C - y * s, z * y * C + x * s, c + z * z * C],
    ];
  }
  const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

  // 표면 무늬: 굵은 띠 1줄 + 얇은 절단선 1줄(대원) + 반짝이 점 + 표식 점 1개
  // 띠와 표식은 비대칭이라 어느 쪽으로 얼마나 굴렀는지 바로 보임 (당구공 줄무늬처럼)
  const CIRCLES = [[0.3, 1, 0.2], [1, -0.2, 0.5]].map((n) => {
    n = norm(n);
    const u = norm(Math.abs(n[0]) < 0.9 ? [0, -n[2], n[1]] : [-n[2], 0, n[0]]);
    const w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    return Array.from({ length: 49 }, (_, i) => {
      const a = (i / 48) * Math.PI * 2;
      return [u[0] * Math.cos(a) + w[0] * Math.sin(a), u[1] * Math.cos(a) + w[1] * Math.sin(a), u[2] * Math.cos(a) + w[2] * Math.sin(a)];
    });
  });
  const SPARKS = Array.from({ length: 12 }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / 12;           // 피보나치 구: 고르게 퍼진 점
    const r = Math.sqrt(1 - y * y);
    const a = i * 2.39996;
    return [r * Math.cos(a), y, r * Math.sin(a)];
  });
  const MARK = norm([-0.1, 0.25, 0.96]);           // 표식 점 (짙은 파랑, 크게) — 처음엔 앞쪽에 보이게

  const proj = (v) => [50 + v[0] * R_DRAW, 50 + v[1] * R_DRAW];
  const ease = (p) => 1 - Math.pow(1 - p, 3); // 이동 애니메이션(감속)과 비슷하게

  function draw(el, m) {
    const o = el._orb;
    CIRCLES.forEach((pts, ci) => {
      let front = '', back = '';
      let prevFront = null;
      pts.forEach((p) => {
        const q = apply(m, p);
        const [x, y] = proj(q);
        const isFront = q[2] >= 0;
        const cmd = `${prevFront === isFront ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
        if (isFront) front += cmd; else back += cmd;
        prevFront = isFront;
      });
      o.lines[ci].front.setAttribute('d', front);
      o.lines[ci].back.setAttribute('d', back);
    });
    const q = apply(m, MARK);
    const [mx, my] = proj(q);
    o.mark.setAttribute('cx', mx.toFixed(1));
    o.mark.setAttribute('cy', my.toFixed(1));
    o.mark.setAttribute('r', (3.5 + 5 * Math.max(0, q[2])).toFixed(2));
    o.mark.setAttribute('opacity', (q[2] >= 0 ? 0.55 + 0.45 * q[2] : 0.2).toFixed(2));
    SPARKS.forEach((p, i) => {
      const q = apply(m, p);
      const [x, y] = proj(q);
      const dot = o.dots[i];
      dot.setAttribute('cx', x.toFixed(1));
      dot.setAttribute('cy', y.toFixed(1));
      // 앞쪽일수록 크고 또렷, 뒤쪽은 작고 희미하게 비침
      dot.setAttribute('r', (1.1 + 1.9 * Math.max(0, q[2])).toFixed(2));
      dot.setAttribute('opacity', (q[2] >= 0 ? 0.45 + 0.55 * q[2] : 0.18 + 0.12 * (1 + q[2])).toFixed(2));
    });
  }

  window.Orb = {
    mount(el) {
      const orb = el.querySelector('.orb');
      if (!orb || el._orb) return;
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'orb-lines');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('aria-hidden', 'true');
      const mk = (tag, cls) => { const e = document.createElementNS(NS, tag); e.setAttribute('class', cls); svg.appendChild(e); return e; };
      const lines = CIRCLES.map((_, i) => ({ back: mk('path', `orb-line back${i === 0 ? ' band' : ''}`) }));
      const dots = SPARKS.map(() => mk('circle', 'orb-dot'));
      const mark = mk('circle', 'orb-mark');
      CIRCLES.forEach((_, i) => { lines[i].front = mk('path', `orb-line${i === 0 ? ' band' : ''}`); }); // 앞쪽 선은 점보다 위에
      orb.insertBefore(svg, orb.firstChild);
      // 처음 방향은 비스듬히 (선이 정면으로만 보이지 않게)
      const m = mul(axisRot([1, 0, 0], 0.6), axisRot([0, 1, 0], 0.4));
      el._orb = { m, lines, dots, mark, raf: 0 };
      draw(el, m);
    },

    roll(el, dx, dy, ms) {
      const o = el._orb;
      if (!o || (!dx && !dy)) return;
      cancelAnimationFrame(o.raf);
      const start = o.m;                                     // 굴러가던 중이면 지금 모습에서 이어서
      const k = norm([-dy, dx, 0]);                          // 굴러가는 축: 이동 방향에 수직인 바닥 쪽 축
      const angle = ROLL_PER_CELL * Math.hypot(dx, dy);       // 대각선은 √2배 더 굴러감
      const t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / ms);
        o.m = mul(axisRot(k, angle * ease(p)), start);
        draw(el, o.m);
        if (p < 1) o.raf = requestAnimationFrame(step);
      };
      o.raf = requestAnimationFrame(step);
    },
  };
})();
