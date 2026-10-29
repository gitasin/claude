// 스테이지 데이터 (판 크기: 가로 6 × 세로 8)
// - time: 제한 시간 (초)
// - shuffle: 남은 파랑을 다른 칸으로 옮기는 주기 (초). 생략하면 5, 0이면 안 옮김
//     [최소, 최대]로 주면 매번 그 사이에서 랜덤 (예: [3, 7])
// - map: 판 모양 (위→아래)
//     '.' = 빈 바닥, 'B' = 파랑 (밟아서 모두 끄기), 'G' = 초록 (안전지대, 빨강이 못 들어옴)
//     '#' = 구멍 (못 밟음), 'P' = 시작 위치
//     'a' / 'b' = 깜빡이는 빨강 (a와 b가 번갈아 켜짐)
// - blink: 깜빡임 설정 { period: 한 주기(초), warn: 켜지기 전 경고 시간(초) }
// - hazards: 움직이는 빨강
//     { type: 'bounce', x, y, dx, dy, speed }  직선으로 움직이다 막히면 튕김 (dx, dy 둘 다 주면 대각선)
//     { type: 'chase', x, y, speed }           플레이어를 쫓아옴 (초록 위에 있으면 배회) — 패턴이 없어서 지금은 안 씀
//     { type: 'sweep', axis: 'row'|'col', pos, dir, speed }  한 줄 전체가 쓸고 지나감 (초록은 안전)
//   speed = 초당 이동 칸 수
// ※ 아래 EASY~EXPERT(예전 초급~특급 48스테이지)는 지금 게임에 안 쓰고, 레벨을 만들 때 참고용으로 남겨 둠
//   지금 게임의 스테이지는 맨 아래 '레벨 구성'
// ── 초급 (EASY): 파랑 이동 4초마다 ──
const EASY = [
  {
    time: 50,
    shuffle: 4,
    map: [
      'B.B...',
      '.B..B.',
      '......',
      '..BB..',
      '......',
      '.B..B.',
      '......',
      'G.P..B',
    ],
    hazards: [
      { type: 'bounce', x: 5, y: 4, dx: -1, dy: 0, speed: 1.7 },
      { type: 'bounce', x: 0, y: 0, dx: 1, dy: 0, speed: 2 },
      { type: 'bounce', x: 1, y: 4, dx: 0, dy: 1, speed: 2 },
    ],
  },
  {
    time: 50,
    shuffle: 4,
    map: [
      '.B..B.',
      '..B...',
      'B....B',
      '..B...',
      'B....B',
      '..B...',
      '.B..B.',
      '..P..G',
    ],
    hazards: [
      { type: 'bounce', x: 0, y: 3, dx: 1, dy: 0, speed: 2.9 },
      { type: 'bounce', x: 5, y: 5, dx: -1, dy: 0, speed: 2.9 },
      { type: 'bounce', x: 3, y: 0, dx: 0, dy: 1, speed: 2.3 },
      { type: 'bounce', x: 3, y: 4, dx: 1, dy: 0, speed: 2.1 },
      { type: 'bounce', x: 5, y: 2, dx: 0, dy: 1, speed: 2.1 },
    ],
  },
  {
    time: 55,
    shuffle: 4,
    map: [
      'B.BB.B',
      '....B.',
      'G..B.G',
      '.B..B.',
      '.B..B.',
      'G..B.G',
      '......',
      'B.P..B',
    ],
    hazards: [
      { type: 'bounce', x: 1, y: 2, dx: 1, dy: 0, speed: 3.5 },
      { type: 'bounce', x: 4, y: 5, dx: -1, dy: 0, speed: 3.5 },
      { type: 'bounce', x: 3, y: 0, dx: 0, dy: 1, speed: 2.3 },
      { type: 'bounce', x: 0, y: 4, dx: 1, dy: 0, speed: 2.1 },
      { type: 'bounce', x: 3, y: 3, dx: 0, dy: 1, speed: 2.1 },
    ],
  },
  {
    time: 60,
    shuffle: 4,
    map: [
      'B..B.B',
      '.#B.#.',
      'B....B',
      '.B##..',
      'B..B.B',
      '.#..#.',
      'B.BB.B',
      'G.P...',
    ],
    hazards: [
      { type: 'bounce', x: 0, y: 0, dx: 0, dy: 1, speed: 2.9 },
      { type: 'bounce', x: 5, y: 7, dx: 0, dy: -1, speed: 2.9 },
      { type: 'bounce', x: 1, y: 2, dx: 1, dy: 0, speed: 2.3 },
      { type: 'bounce', x: 2, y: 4, dx: 1, dy: 1, speed: 2.3 },
      { type: 'bounce', x: 5, y: 1, dx: 0, dy: 1, speed: 2.2 },
      { type: 'bounce', x: 4, y: 3, dx: 0, dy: 1, speed: 2.2 },
    ],
  },
  {
    time: 60,
    shuffle: 4,
    map: [
      'B.aa.B',
      '.b..b.',
      'a.BB.a',
      '.b..bB',
      'b.BB.b',
      '.a..aB',
      'B.bb.B',
      'G.P.B.',
    ],
    blink: { period: 2.7, warn: 0.7 },
    hazards: [
      { type: 'bounce', x: 0, y: 3, dx: 1, dy: 0, speed: 2.3 },
      { type: 'bounce', x: 5, y: 7, dx: -1, dy: 0, speed: 2.2 },
      { type: 'bounce', x: 5, y: 0, dx: 0, dy: 1, speed: 2.2 },
    ],
  },
  {
    time: 65,
    shuffle: 4,
    map: [
      'BB..BB',
      'G....G',
      '..BB..',
      'BG..GB',
      '..BB.B',
      'G....G',
      'BB..BB',
      'G.P..G',
    ],
    hazards: [
      { type: 'sweep', axis: 'row', pos: 0, dir: 1, speed: 1.4 },
      { type: 'bounce', x: 0, y: 2, dx: 1, dy: 0, speed: 2.3 },
      { type: 'bounce', x: 5, y: 6, dx: -1, dy: 0, speed: 2.3 },
      { type: 'bounce', x: 4, y: 1, dx: 0, dy: 1, speed: 2.3 },
    ],
  },
  {
    time: 60,
    shuffle: 4,
    map: [
      'B..B.B',
      '..B...',
      '.G..B.',
      'B..G..',
      '..B..B',
      '.B..G.',
      'B...B.',
      '..P.BB',
    ],
    hazards: [
      { type: 'bounce', x: 2, y: 0, dx: 1, dy: 0, speed: 2.5 },
      { type: 'bounce', x: 0, y: 4, dx: 1, dy: 0, speed: 2.9 },
      { type: 'bounce', x: 5, y: 1, dx: 0, dy: 1, speed: 2.3 },
      { type: 'bounce', x: 5, y: 7, dx: -1, dy: 0, speed: 2.3 },
      { type: 'bounce', x: 4, y: 4, dx: 0, dy: -1, speed: 2.3 },
    ],
  },
  {
    time: 60,
    shuffle: 4,
    map: [
      'B.B..B',
      '...B..',
      '.B..B.',
      'B.BB.B',
      '..BB..',
      '.B..B.',
      '......',
      'BGP.BB',
    ],
    hazards: [
      { type: 'bounce', x: 0, y: 1, dx: 1, dy: 1, speed: 2.9 },
      { type: 'bounce', x: 5, y: 4, dx: -1, dy: -1, speed: 2.9 },
      { type: 'bounce', x: 0, y: 6, dx: 1, dy: 0, speed: 3.5 },
      { type: 'bounce', x: 4, y: 0, dx: 1, dy: 0, speed: 2.4 },
      { type: 'bounce', x: 2, y: 3, dx: 0, dy: 1, speed: 2.4 },
    ],
  },
  {
    time: 65,
    shuffle: 4,
    map: [
      'BabbaB',
      'a....b',
      'b.BB.a',
      '.BGG.B',
      'a.BB.b',
      'bB...a',
      'BabbaB',
      '..P...',
    ],
    blink: { period: 2.3, warn: 0.6 },
    hazards: [
      { type: 'bounce', x: 1, y: 1, dx: 1, dy: 0, speed: 2.3 },
      { type: 'bounce', x: 4, y: 5, dx: -1, dy: 0, speed: 2.3 },
      { type: 'bounce', x: 0, y: 3, dx: 0, dy: 1, speed: 2.3 },
      { type: 'bounce', x: 5, y: 0, dx: -1, dy: 0, speed: 2.4 },
      { type: 'bounce', x: 2, y: 4, dx: 0, dy: 1, speed: 2.4 },
    ],
  },
  {
    time: 70,
    shuffle: 4,
    map: [
      'BGB.GB',
      'B..B.B',
      '..GG..',
      'BB..BB',
      '..GG..',
      'B....B',
      'BG..GB',
      '..P.B.',
    ],
    hazards: [
      { type: 'sweep', axis: 'col', pos: 0, dir: 1, speed: 1.2 },
      { type: 'bounce', x: 0, y: 3, dx: 1, dy: 0, speed: 2.9 },
      { type: 'bounce', x: 5, y: 0, dx: 0, dy: 1, speed: 2.3 },
      { type: 'bounce', x: 5, y: 7, dx: -1, dy: 0, speed: 2.5 },
      { type: 'bounce', x: 4, y: 4, dx: 0, dy: 1, speed: 2.5 },
    ],
  },
  {
    time: 70,
    shuffle: 4,
    map: [
      'BaBbBa',
      'b....b',
      '..G..B',
      'aB..Ba',
      'bB..Bb',
      'B..G.B',
      'a....a',
      'B.P.bB',
    ],
    blink: { period: 2.7, warn: 0.7 },
    hazards: [
      { type: 'bounce', x: 1, y: 1, dx: 1, dy: 0, speed: 2.1 },
      { type: 'bounce', x: 5, y: 6, dx: -1, dy: 0, speed: 2.9 },
      { type: 'bounce', x: 5, y: 0, dx: -1, dy: 0, speed: 2.5 },
      { type: 'bounce', x: 3, y: 4, dx: 0, dy: -1, speed: 2.5 },
    ],
  },
  {
    time: 80,
    shuffle: 4,
    map: [
      'BGaaGB',
      'b.BB.b',
      'BB##B.',
      'BaGGaB',
      'B.##.B',
      'b.BB.b',
      'BGaaGB',
      '..P...',
    ],
    blink: { period: 2.9, warn: 0.7 },
    hazards: [
      { type: 'sweep', axis: 'row', pos: 0, dir: 1, speed: 1 },
      { type: 'bounce', x: 1, y: 1, dx: 1, dy: 0, speed: 2.9 },
      { type: 'bounce', x: 5, y: 7, dx: 0, dy: -1, speed: 1.8 },
      { type: 'bounce', x: 1, y: 5, dx: 1, dy: 0, speed: 2.9 },
      { type: 'bounce', x: 4, y: 3, dx: 1, dy: 0, speed: 2.6 },
      { type: 'bounce', x: 0, y: 3, dx: 0, dy: 1, speed: 2.6 },
    ],
  },
];

// ── 중급 (NORMAL): 빨강이 더 빠르고 많음, 파랑 이동 타이밍 랜덤 2.5~6초 ──
const NORMAL = [
  {
    time: 65,
    shuffle: [2.5, 6],
    map: [
      'B.B..B',
      '..G.B.',
      'B.B..B',
      '.B..B.',
      '......',
      'B..G.B',
      '.B..B.',
      'B.P..B',
    ],
    hazards: [
      { type: 'bounce', x: 1, y: 2, dx: 1, dy: 0, speed: 3.2 },
      { type: 'bounce', x: 0, y: 4, dx: 1, dy: 0, speed: 3.2 },
      { type: 'bounce', x: 4, y: 0, dx: 0, dy: 1, speed: 2.6 },
    ],
  },
  {
    time: 65,
    shuffle: [2.5, 6],
    map: [
      'B.B#.B',
      '.B.B..',
      'B.G.B.',
      '#.B..#',
      '.B..B.',
      '..B.G.',
      'B....B',
      '..P.B.',
    ],
    hazards: [
      { type: 'bounce', x: 1, y: 0, dx: 1, dy: 1, speed: 3.2 },
      { type: 'bounce', x: 4, y: 1, dx: -1, dy: 1, speed: 3.2 },
      { type: 'bounce', x: 5, y: 6, dx: -1, dy: 0, speed: 3.2 },
    ],
  },
  {
    time: 70,
    shuffle: [2.5, 6],
    map: [
      'BabaBa',
      'b....b',
      'a.BGBa',
      'b.B..b',
      'a..B.a',
      'bBGB.b',
      'BbabaB',
      '..P.BB',
    ],
    blink: { period: 2, warn: 0.5 },
    hazards: [
      { type: 'bounce', x: 1, y: 1, dx: 1, dy: 0, speed: 2.6 },
      { type: 'bounce', x: 1, y: 4, dx: 1, dy: 0, speed: 2.6 },
      { type: 'bounce', x: 4, y: 1, dx: 0, dy: 1, speed: 2.1 },
    ],
  },
  {
    time: 70,
    shuffle: [2.5, 6],
    map: [
      'BG.BGB',
      '..B.BB',
      'B.GG.B',
      '..B.B.',
      '.B.B..',
      'B.GG.B',
      '.B..B.',
      'G.P..G',
    ],
    hazards: [
      { type: 'sweep', axis: 'col', pos: 0, dir: 1, speed: 1.3 },
      { type: 'bounce', x: 5, y: 2, dx: 0, dy: 1, speed: 2.1 },
    ],
  },
  {
    time: 70,
    shuffle: [2.5, 6],
    map: [
      'B.GB.B',
      '.B..BG',
      'G..B.B',
      '.B..BG',
      'B..G..',
      '.GB..B',
      'B...G.',
      '..P.BB',
    ],
    hazards: [
      { type: 'sweep', axis: 'row', pos: 0, dir: 1, speed: 1.3 },
      { type: 'bounce', x: 1, y: 0, dx: 0, dy: 1, speed: 2.6 },
      { type: 'bounce', x: 4, y: 5, dx: 0, dy: -1, speed: 2.6 },
    ],
  },
  {
    time: 70,
    shuffle: [2.5, 6],
    map: [
      'B.B..B',
      '.B.G..',
      '...B..',
      'B.#..B',
      '..B#BG',
      '.G...B',
      'B..B..',
      '..P.BB',
    ],
    hazards: [
      { type: 'bounce', x: 0, y: 0, dx: 1, dy: 0, speed: 2.1 },
      { type: 'bounce', x: 5, y: 1, dx: 0, dy: 1, speed: 1.8 },
    ],
  },
  {
    time: 70,
    shuffle: [2.5, 6],
    map: [
      'B.B.B.',
      '......',
      '.B.B.B',
      'G.....',
      'B.B.B.',
      '.B..BG',
      '.B.B.B',
      'B.P.B.',
    ],
    hazards: [
      { type: 'bounce', x: 0, y: 1, dx: 1, dy: 0, speed: 3.6 },
      { type: 'bounce', x: 5, y: 3, dx: -1, dy: 0, speed: 3.6 },
      { type: 'bounce', x: 0, y: 5, dx: 1, dy: 0, speed: 3.6 },
      { type: 'bounce', x: 2, y: 0, dx: 0, dy: 1, speed: 2.1 },
    ],
  },
  {
    time: 70,
    shuffle: [2.5, 6],
    map: [
      'BaBaBa',
      'a.G..b',
      'bBab.B',
      'B.baBa',
      'a.Bb.b',
      'b..G.B',
      'aBbaBb',
      'B.P..B',
    ],
    blink: { period: 2.3, warn: 0.6 },
    hazards: [
      { type: 'bounce', x: 5, y: 5, dx: 0, dy: 1, speed: 2.2 },
      { type: 'bounce', x: 3, y: 1, dx: 1, dy: 0, speed: 2.6 },
    ],
  },
  {
    time: 75,
    shuffle: [2.5, 6],
    map: [
      'B.G..B',
      '..B.G.',
      'G..B.B',
      '.B.BB.',
      '.BG..G',
      'B..B.B',
      '.G..B.',
      'B.P..G',
    ],
    hazards: [
      { type: 'sweep', axis: 'row', pos: 0, dir: 1, speed: 0.9 },
      { type: 'sweep', axis: 'col', pos: 5, dir: -1, speed: 0.9 },
    ],
  },
  {
    time: 70,
    shuffle: [2.5, 6],
    map: [
      'B.#B.B',
      '.B#B.#',
      'B.B.B.',
      '##.G.#',
      'B.B..B',
      '.#..#.',
      'BG.B.B',
      '..P.B.',
    ],
    hazards: [
      { type: 'bounce', x: 1, y: 2, dx: 1, dy: 0, speed: 3.2 },
      { type: 'bounce', x: 1, y: 4, dx: 1, dy: 0, speed: 3.2 },
      { type: 'bounce', x: 4, y: 0, dx: 0, dy: 1, speed: 2.6 },
    ],
  },
  {
    time: 75,
    shuffle: [2.5, 6],
    map: [
      'BbBaBb',
      'a..B.a',
      'B.GG.B',
      'b.BB.b',
      'aB...a',
      'B.GG.B',
      'bBabBa',
      'B.P..B',
    ],
    blink: { period: 2.2, warn: 0.6 },
    hazards: [
      { type: 'sweep', axis: 'row', pos: 0, dir: 1, speed: 1.2 },
      { type: 'bounce', x: 1, y: 1, dx: 1, dy: 0, speed: 3.2 },
      { type: 'bounce', x: 4, y: 4, dx: -1, dy: 0, speed: 3.2 },
    ],
  },
  {
    time: 80,
    shuffle: [2.5, 6],
    map: [
      'BGB.BG',
      '.#..#.',
      'B.aB.B',
      '.bGGa.',
      'B.bBBB',
      '.#..#.',
      'GB.aBG',
      'B.P.BB',
    ],
    blink: { period: 2.3, warn: 0.6 },
    hazards: [
      { type: 'bounce', x: 3, y: 0, dx: 1, dy: 0, speed: 2.2 },
      { type: 'bounce', x: 1, y: 4, dx: 1, dy: 0, speed: 3.2 },
      { type: 'bounce', x: 0, y: 1, dx: 1, dy: 1, speed: 3.2 },
      { type: 'sweep', axis: 'col', pos: 0, dir: 1, speed: 1.1 },
    ],
  },
];

// ── 고급 (HARD): 빠른 빨강·추격자 여럿·가로세로 쓸기, 파랑 이동 타이밍 랜덤 1.8~4초 ──
const HARD = [
  {
    time: 70,
    shuffle: [1.8, 4],
    map: [
      'B.B.BB',
      '.G.B..',
      'B.B.B.',
      '......',
      'BB.B.B',
      '..B.G.',
      'BB.BBB',
      '..P.B.',
    ],
    hazards: [
      { type: 'bounce', x: 2, y: 1, dx: 1, dy: 0, speed: 4 },
      { type: 'bounce', x: 0, y: 3, dx: 1, dy: 0, speed: 4 },
      { type: 'bounce', x: 0, y: 5, dx: 1, dy: 0, speed: 4 },
      { type: 'bounce', x: 5, y: 0, dx: 0, dy: 1, speed: 3.1 },
      { type: 'bounce', x: 0, y: 0, dx: 0, dy: 1, speed: 3.1 },
    ],
  },
  {
    time: 70,
    shuffle: [1.8, 4],
    map: [
      'B..B.B',
      '.B..G.',
      'B.B..B',
      '.B#BB.',
      'B.B#.B',
      '.G..B.',
      'B.B..B',
      'B.P.B.',
    ],
    hazards: [
      { type: 'bounce', x: 0, y: 0, dx: 1, dy: 0, speed: 2.5 },
      { type: 'bounce', x: 5, y: 0, dx: -1, dy: 0, speed: 2.4 },
      { type: 'bounce', x: 1, y: 2, dx: 1, dy: 1, speed: 3.5 },
    ],
  },
  {
    time: 75,
    shuffle: [1.8, 4],
    map: [
      'BabBab',
      'baBabB',
      'aBGBBa',
      'b.ab.b',
      'aBb.Ba',
      'b.abGB',
      'BabBab',
      '..P.B.',
    ],
    blink: { period: 1.6, warn: 0.45 },
    hazards: [
      { type: 'bounce', x: 5, y: 7, dx: -1, dy: 0, speed: 3.1 },
      { type: 'bounce', x: 3, y: 0, dx: 0, dy: 1, speed: 3.1 },
    ],
  },
  {
    time: 75,
    shuffle: [1.8, 4],
    map: [
      'BGBB.B',
      '.B..G.',
      'BBG..B',
      '.B.B.G',
      'G..BB.',
      '.B.G.B',
      'B.B.BG',
      'G.P.B.',
    ],
    hazards: [
      { type: 'sweep', axis: 'row', pos: 0, dir: 1, speed: 1.3 },
      { type: 'sweep', axis: 'col', pos: 5, dir: -1, speed: 1.1 },
      { type: 'bounce', x: 0, y: 3, dx: 1, dy: 0, speed: 3.5 },
    ],
  },
  {
    time: 75,
    shuffle: [1.8, 4],
    map: [
      'B.BBGB',
      '.B.B..',
      'G..BBB',
      'B.B.BG',
      '.B.B.B',
      'G.B.B.',
      'B.GB.B',
      '..P.B.',
    ],
    hazards: [
      { type: 'sweep', axis: 'col', pos: 0, dir: 1, speed: 1.3 },
      { type: 'bounce', x: 5, y: 0, dx: 0, dy: 1, speed: 2.5 },
      { type: 'bounce', x: 1, y: 5, dx: 1, dy: 0, speed: 3.5 },
    ],
  },
  {
    time: 75,
    shuffle: [1.8, 4],
    map: [
      'B.#B.B',
      '.B#.G.',
      'B.BB#B',
      '.#B.B.',
      'B.B#.B',
      'G.B.#.',
      'B.#.B.',
      'B.P..B',
    ],
    hazards: [
      { type: 'bounce', x: 5, y: 0, dx: -1, dy: 0, speed: 2.5 },
      { type: 'bounce', x: 0, y: 2, dx: 1, dy: 0, speed: 2.2 },
      { type: 'bounce', x: 3, y: 3, dx: 1, dy: 0, speed: 3.5 },
    ],
  },
  {
    time: 75,
    shuffle: [1.8, 4],
    map: [
      'BB..BB',
      '..B..B',
      'B.GB.B',
      '.B..B.',
      'B.BG.B',
      '...B..',
      'BB..BB',
      '..P...',
    ],
    hazards: [
      { type: 'bounce', x: 0, y: 1, dx: 1, dy: 0, speed: 4.6 },
      { type: 'bounce', x: 5, y: 3, dx: -1, dy: 0, speed: 4.6 },
      { type: 'bounce', x: 0, y: 5, dx: 1, dy: 0, speed: 4.6 },
      { type: 'bounce', x: 1, y: 2, dx: 0, dy: 1, speed: 3.1 },
      { type: 'bounce', x: 4, y: 4, dx: 0, dy: -1, speed: 3.1 },
      { type: 'bounce', x: 2, y: 5, dx: 1, dy: -1, speed: 3.5 },
    ],
  },
  {
    time: 80,
    shuffle: [1.8, 4],
    map: [
      'BaBbBa',
      'bBGB.b',
      'aBB.Ba',
      'b.ab.b',
      'aB.BBa',
      'b..G.b',
      'BaBbBa',
      '..P..B',
    ],
    blink: { period: 1.8, warn: 0.45 },
    hazards: [
      { type: 'sweep', axis: 'row', pos: 0, dir: 1, speed: 1.2 },
      { type: 'bounce', x: 3, y: 2, dx: 1, dy: 0, speed: 2.5 },
    ],
  },
  {
    time: 75,
    shuffle: [1.8, 4],
    map: [
      'B.B.B.',
      '.G.BBB',
      'B..B..',
      'B.BBBB',
      'B..B..',
      '.B...G',
      '..B.B.',
      'B.P..B',
    ],
    hazards: [
      { type: 'bounce', x: 1, y: 0, dx: 1, dy: 1, speed: 4 },
      { type: 'bounce', x: 4, y: 0, dx: -1, dy: 1, speed: 4 },
      { type: 'bounce', x: 0, y: 5, dx: 1, dy: -1, speed: 4 },
      { type: 'bounce', x: 5, y: 3, dx: -1, dy: 1, speed: 3.5 },
      { type: 'bounce', x: 5, y: 6, dx: -1, dy: 0, speed: 2.1 },
    ],
  },
  {
    time: 80,
    shuffle: [1.8, 4],
    map: [
      'BGaB.B',
      '.bB.Gb',
      'BBBaBB',
      'aG.BbB',
      'B.bB.a',
      '.B..G.',
      'BaB.bB',
      'G.P.B.',
    ],
    blink: { period: 1.8, warn: 0.45 },
    hazards: [
      { type: 'sweep', axis: 'row', pos: 0, dir: 1, speed: 1.2 },
      { type: 'sweep', axis: 'col', pos: 5, dir: -1, speed: 1.1 },
      { type: 'bounce', x: 3, y: 0, dx: 1, dy: 0, speed: 2.4 },
    ],
  },
  {
    time: 80,
    shuffle: [1.8, 4],
    map: [
      'B#BBB#',
      '.B..B.',
      'B.G#.B',
      '.BB.BB',
      '#.BG.#',
      'B.B..B',
      '.B#.B.',
      'B.P..B',
    ],
    hazards: [
      { type: 'bounce', x: 0, y: 1, dx: 1, dy: 0, speed: 2.7 },
      { type: 'bounce', x: 5, y: 1, dx: -1, dy: 0, speed: 2.5 },
      { type: 'bounce', x: 0, y: 3, dx: 1, dy: 0, speed: 4 },
      { type: 'bounce', x: 1, y: 5, dx: 1, dy: 0, speed: 4 },
    ],
  },
  {
    time: 85,
    shuffle: [1.8, 4],
    map: [
      'BGBaBG',
      'bB#.Bb',
      'B.aB.B',
      '.bGGb.',
      'B.bB.B',
      'a.#.Ba',
      'GBaBbG',
      'B.P..B',
    ],
    blink: { period: 1.6, warn: 0.45 },
    hazards: [
      { type: 'sweep', axis: 'row', pos: 0, dir: 1, speed: 1.3 },
      { type: 'sweep', axis: 'col', pos: 0, dir: 1, speed: 1.1 },
      { type: 'bounce', x: 4, y: 2, dx: 1, dy: 0, speed: 2.7 },
      { type: 'bounce', x: 3, y: 1, dx: 1, dy: 0, speed: 4 },
      { type: 'bounce', x: 3, y: 5, dx: 1, dy: 0, speed: 4 },
    ],
  },
];

// ── 특급 (EXPERT): 더 빠른 빨강·추격자 셋·십자 쓸기·빠른 깜빡이, 파랑 이동 타이밍 랜덤 1.5~3.5초 ──
const EXPERT = [
  {
    time: 90,
    shuffle: [1.5, 3.5],
    map: [
      'B.B.BB',
      '.B..B.',
      'B.GG.B',
      '.B..B.',
      'B.B.B.',
      '.B..B.',
      'B.GG.B',
      '..P...',
    ],
    hazards: [
      { type: 'sweep', axis: 'row', pos: 0, dir: 1, speed: 1.4 },
      { type: 'sweep', axis: 'col', pos: 0, dir: 1, speed: 1.2 },
      { type: 'bounce', x: 0, y: 3, dx: 1, dy: 0, speed: 4.3 },
      { type: 'bounce', x: 5, y: 0, dx: -1, dy: 0, speed: 2.7 },
    ],
  },
  {
    time: 85,
    shuffle: [1.5, 3.5],
    map: [
      'BB#BBB',
      'B.#..B',
      'B...#.',
      '##.###',
      'B.B..B',
      '.B#B.B',
      'BG#.GB',
      '..P...',
    ],
    hazards: [
      { type: 'bounce', x: 5, y: 0, dx: -1, dy: 0, speed: 2.7 },
      { type: 'bounce', x: 0, y: 4, dx: 1, dy: 0, speed: 2.4 },
      { type: 'bounce', x: 0, y: 2, dx: 1, dy: 0, speed: 3.8 },
    ],
  },
  {
    time: 55,
    shuffle: [1.5, 3.5],
    map: [
      'BabaBa',
      'abBbab',
      'Ba.aBb',
      'bG.bGa',
      'aBab.B',
      'babaBa',
      'BabBab',
      '..P...',
    ],
    blink: { period: 1.7, warn: 0.4 },
    hazards: [
      { type: 'bounce', x: 5, y: 7, dx: 0, dy: -1, speed: 2.4 },
    ],
  },
  {
    time: 90,
    shuffle: [1.5, 3.5],
    map: [
      'BG.B.B',
      'B.B.GB',
      '.B.B..',
      'G.B.B.',
      '.B.B.G',
      '..B.B.',
      'BG.B.B',
      'G.P..G',
    ],
    hazards: [
      { type: 'sweep', axis: 'row', pos: 0, dir: 1, speed: 1.4 },
      { type: 'sweep', axis: 'col', pos: 5, dir: -1, speed: 1.3 },
      { type: 'bounce', x: 0, y: 2, dx: 1, dy: 0, speed: 4.3 },
      { type: 'bounce', x: 5, y: 5, dx: -1, dy: 0, speed: 4.3 },
    ],
  },
  {
    time: 100,
    shuffle: [1.5, 3.5],
    map: [
      'B.B.B.',
      '.B.B.B',
      'B.G.B.',
      '.B.B.B',
      'B.B.G.',
      '.B.B.B',
      'B.B.B.',
      '..P...',
    ],
    hazards: [
      { type: 'bounce', x: 1, y: 0, dx: 1, dy: 1, speed: 4.3 },
      { type: 'bounce', x: 4, y: 0, dx: -1, dy: 1, speed: 4.3 },
      { type: 'bounce', x: 0, y: 3, dx: 1, dy: -1, speed: 3.8 },
      { type: 'bounce', x: 5, y: 4, dx: -1, dy: 1, speed: 3.8 },
      { type: 'bounce', x: 5, y: 6, dx: -1, dy: 0, speed: 2.1 },
    ],
  },
  {
    time: 80,
    shuffle: [1.5, 3.5],
    map: [
      'B.B.B.',
      '.####B',
      'B#.B#.',
      '.#B.#B',
      'B#..#.',
      '.#B##B',
      'B.....',
      'BBP.GB',
    ],
    hazards: [
      { type: 'bounce', x: 0, y: 0, dx: 1, dy: 0, speed: 2.8 },
      { type: 'bounce', x: 5, y: 6, dx: -1, dy: 0, speed: 4.3 },
      { type: 'bounce', x: 0, y: 2, dx: 0, dy: 1, speed: 3.4 },
    ],
  },
  {
    time: 100,
    shuffle: [1.5, 3.5],
    map: [
      'BGBBGB',
      'B....B',
      '.BGGB.',
      'B....B',
      'B.BB.B',
      '.BGGB.',
      'B....B',
      'BGP.GB',
    ],
    hazards: [
      { type: 'sweep', axis: 'row', pos: 0, dir: 1, speed: 1.3 },
      { type: 'sweep', axis: 'col', pos: 0, dir: 1, speed: 1.2 },
      { type: 'bounce', x: 1, y: 3, dx: 1, dy: 0, speed: 4.3 },
    ],
  },
  {
    time: 100,
    shuffle: [1.5, 3.5],
    map: [
      'B..B.B',
      '.BG..B',
      'B..B.B',
      '.B.G..',
      'B.B..B',
      '..B.B.',
      'BG..B.',
      'B.P.BB',
    ],
    hazards: [
      { type: 'bounce', x: 0, y: 0, dx: 1, dy: 0, speed: 2.5 },
      { type: 'bounce', x: 5, y: 0, dx: -1, dy: 0, speed: 2.2 },
      { type: 'bounce', x: 5, y: 3, dx: 0, dy: 1, speed: 2 },
    ],
  },
  {
    time: 75,
    shuffle: [1.5, 3.5],
    map: [
      'BaBbBa',
      'b.G.Bb',
      'aBabBa',
      'B.G.bB',
      'bBaB.a',
      'a.Gb.B',
      'BbBaBb',
      '..P...',
    ],
    blink: { period: 1.7, warn: 0.4 },
    hazards: [
      { type: 'sweep', axis: 'col', pos: 0, dir: 1, speed: 1.2 },
      { type: 'bounce', x: 5, y: 1, dx: -1, dy: 0, speed: 2.2 },
    ],
  },
  {
    time: 85,
    shuffle: [1.5, 3.5],
    map: [
      'BBB.BB',
      '##.###',
      'B.B.GB',
      '###.##',
      'BB.B.B',
      '#.####',
      'BGB.BB',
      '..P...',
    ],
    hazards: [
      { type: 'bounce', x: 0, y: 0, dx: 1, dy: 0, speed: 4.7 },
      { type: 'bounce', x: 0, y: 2, dx: 1, dy: 0, speed: 4.3 },
      { type: 'bounce', x: 5, y: 4, dx: -1, dy: 0, speed: 4.3 },
      { type: 'bounce', x: 5, y: 6, dx: -1, dy: 0, speed: 3.4 },
    ],
  },
  {
    time: 75,
    shuffle: [1.5, 3.5],
    map: [
      'BGaBbB',
      'b.#.aB',
      'B.Bb.G',
      'a#.B#b',
      'B.aB.B',
      'bB.#Ba',
      'BGbaBG',
      '..P...',
    ],
    blink: { period: 1.6, warn: 0.4 },
    hazards: [
      { type: 'sweep', axis: 'row', pos: 0, dir: 1, speed: 1.4 },
      { type: 'bounce', x: 3, y: 0, dx: 1, dy: 0, speed: 2.7 },
      { type: 'bounce', x: 1, y: 4, dx: 1, dy: 0, speed: 4.3 },
      { type: 'bounce', x: 0, y: 1, dx: 1, dy: 1, speed: 3.8 },
    ],
  },
  {
    time: 75,
    shuffle: [1.5, 3.5],
    map: [
      'BGBaBG',
      'aB.#Bb',
      'B.bBa.',
      '#BG.Gb',
      'Ba.Bb#',
      '.bB.aB',
      'GBabBG',
      '..P...',
    ],
    blink: { period: 1.5, warn: 0.4 },
    hazards: [
      { type: 'sweep', axis: 'row', pos: 0, dir: 1, speed: 1.4 },
      { type: 'sweep', axis: 'col', pos: 5, dir: -1, speed: 1.3 },
      { type: 'bounce', x: 3, y: 2, dx: 1, dy: 0, speed: 2.8 },
      { type: 'bounce', x: 0, y: 5, dx: 1, dy: 0, speed: 4.7 },
      { type: 'bounce', x: 5, y: 2, dx: 0, dy: 1, speed: 3.4 },
    ],
  },
];

// ── 레벨 구성: 레벨 1~10 (지금은 레벨 1~3, 레벨마다 8스테이지) ──
// id: 별·기록·랭킹을 저장하는 이름 ('L레벨-스테이지')
// 판·시간·파랑 이동은 모두 예전 초급 1스테이지 그대로, 빨강만 스테이지마다 늘어남 (속도는 그대로)
// 모든 레벨의 기본 판: 제한 시간 1분 15초, 파랑 16개 (판에는 8개씩 보임, game.js VISIBLE_BLUES)
//   withGreen(4-2~)이 쓰는 칸: (4,1) 파랑 → 초록, (5,0) 빈칸 → 파랑, (1,6)·(2,5)는 비워 둠
const BASE = {
  ...EASY[0],
  time: 75,
  map: [
    'B.B.B.',
    '.B..B.',
    'B....B',
    '..BB..',
    '.B..B.',
    'B..B.B',
    '...B..',
    'G.P..B',
  ],
};
const stage = (extra) => ({ time: BASE.time, shuffle: BASE.shuffle, map: BASE.map, hazards: [...BASE.hazards, ...extra] });
const level = (lv, stages) => stages.map((s, k) => ({ id: `L${lv}-${k + 1}`, ...s }));

// 레벨 1: 튕김 빨강만. 1스테이지 3개 → 스테이지마다 1개씩 늘어 8스테이지 10개
const L1_MORE = [
  { type: 'bounce', x: 5, y: 2, dx: -1, dy: 0, speed: 2 },
  { type: 'bounce', x: 3, y: 1, dx: 0, dy: 1, speed: 2 },
  { type: 'bounce', x: 5, y: 6, dx: -1, dy: 0, speed: 2 },
  { type: 'bounce', x: 0, y: 2, dx: 0, dy: 1, speed: 2 },
  { type: 'bounce', x: 4, y: 7, dx: 0, dy: -1, speed: 2 },
  { type: 'bounce', x: 2, y: 5, dx: 1, dy: 0, speed: 2 },
  { type: 'bounce', x: 1, y: 3, dx: 1, dy: 0, speed: 2 },
];
const LEVEL1 = level(1, [0, 1, 2, 3, 4, 5, 6, 7].map((k) => stage(L1_MORE.slice(0, k))));

// 레벨마다 새 패턴을 하나씩만: 1레벨 직선 튕김 → 2레벨 대각선 튕김 → 3레벨 깜빡임 → 4레벨 쓸기

// 레벨 2: 직선 튕김 3개(기본) + 대각선 튕김. 2-1은 대각선 3개 → 스테이지마다 1개씩 늘어 2-8은 10개
//   판은 1레벨과 같음 (초록 1개). 속도는 직선과 같은 초당 2칸, 출발 자리·방향은 판마다 랜덤 (대각선 4방향 중 하나)
const diagonals = (k) => Array.from({ length: k }, () => ({ type: 'bounce', x: 0, y: 0, dx: 1, dy: 1, speed: 2 }));
const LEVEL2 = level(2, [3, 4, 5, 6, 7, 8, 9, 10].map((k) => stage(diagonals(k))));

// 레벨 3: 직선 튕김 3개 + 깜빡이는 빨강 칸 (a·b 두 묶음이 번갈아 켜짐, 켜지기 전에 경고)
//   주기는 모두 2초 (경고 0.5초). 3-1은 10칸씩(10+10) → 3-8은 15+15
//   (파랑이 16개라 빈 바닥은 31칸: 3-1은 바닥의 약 2/3, 3-8은 거의 전부 → 예전 12+12~19+19와 같은 비율)
//   자리는 판마다, 그리고 한 묶음이 꺼질 때마다 랜덤으로 바뀜 (move, game.js moveBlink)
//   그래서 맵에는 개수만 맞춰 바닥 칸 앞에서부터 a n칸, b n칸을 채워 둠
const blinkStage = (n, period, warn) => {
  let k = 0;
  const map = BASE.map.map((row) => row.replace(/\./g, () => (k++ < n ? 'a' : k <= 2 * n ? 'b' : '.')));
  return { ...stage([]), map, blink: { period, warn, move: true } };
};
const LEVEL3 = level(3, [10, 11, 11, 12, 13, 14, 14, 15].map((n) => blinkStage(n, 2, 0.5)));

// 레벨 4: 직선 튕김 3개 + 쓸기 빨강
//   4-1: 붙은 쓸기 2줄 (pair: 두꺼운 한 줄처럼 같이 움직임, 가로·세로 중 판마다 랜덤)
//   4-2~4-8 (가로+세로): 2+0 → 1+1 → 3+0 → 0+2 → 2+1 → 0+3 → 2+2
//   세로 1줄이 가로 1.5줄쯤 어려워서 (시뮬레이션) 이 순서로 두면 스테이지마다 고르게 어려워짐
//   axis: 'row' = 가로줄 쓸기, 'col' = 세로줄 쓸기, 'any' = 시작할 때 둘 중 하나 ('other' = 'any'의 반대 방향, 지금은 안 씀)
//   at = 시작 줄 위치 (0 = 첫 줄 ~ 1 = 끝 줄), speed는 방향별 (예전 초급 쓸기 속도 그대로)
const sweeps = (k, axis = 'any', shift = 0) => Array.from({ length: k }, (_, i) => ({ type: 'sweep', axis, at: (i + shift) / k, dir: 1, speed: { row: 1.4, col: 1.2 } }));
// 4-1부터 초록 2개: 모서리에서 대각선으로 한 칸 안쪽 (왼쪽 아래 (1,6), 오른쪽 위 (4,1))
//   원래 모서리 초록 (0,7)은 바닥으로, (4,1)에 있던 파랑은 비게 된 (5,0)으로 옮김
const put = (map, x, y, ch) => map.map((row, r) => (r === y ? row.slice(0, x) + ch + row.slice(x + 1) : row));
const withGreen = (st) => {
  let map = put(st.map, 0, 7, '.');
  map = put(map, 1, 6, 'G');
  map = put(map, 4, 1, 'G');
  map = put(map, 5, 0, 'B');
  return { ...st, map };
};
// 가로 쓸기(row) h개 + 세로 쓸기(col) v개. 세로가 더 어려움. 시작 줄·방향은 판마다 랜덤 (game.js randomSweeps)
const hv = (h, v) => [...sweeps(h, 'row'), ...sweeps(v, 'col')];
const LEVEL4 = level(4, [
  withGreen(stage(sweeps(2).map((h) => ({ ...h, pair: true })))),
  ...[[2, 0], [1, 1], [3, 0], [0, 2], [2, 1], [0, 3], [2, 2]].map(([h, v]) => withGreen(stage(hv(h, v)))),
]);
// 4-7(세로3)은 아래 초록을 (1,6) → 오른쪽 위 대각선 (2,5)로: 안쪽이라 숨기 쉬워서 4-6과의 차이를 줄이고 4-8과는 벌림
LEVEL4[6].map = put(put(LEVEL4[6].map, 1, 6, '.'), 2, 5, 'G');

// nums: 파랑 큐브에 나오는 숫자 범위 [최소, 최대]. 첫 스테이지는 낮은 숫자 위주, 스테이지가 올라갈수록 높은 숫자가 자주 나옴 (game.js NUM_RATIO)
// walls: 판 둘레 벽이 남아 있는 비율 [첫 스테이지, 마지막 스테이지] (그 사이는 스테이지 번호에 따라 점점 듬성듬성)
//   벽이 있으면 막히고, 뚫린 곳으로 가면 판 밖으로 떨어져 생명 1개를 잃음
// tilt: 판이 기울어짐 (볼이 낮은 쪽으로 저절로 굴러감)
//   dirs = 기우는 방향 종류 ('h' 좌우, 'v' 위아래, 'd' 대각선) 중 랜덤
//   angle = 기울기 [최소, 최대]° (12스테이지는 +stepUp°까지 점점 더), tilted = 기울어 있는 시간, flat = 평평한 시간 (초, 랜덤)
// (예전 난이도 설정: 레벨을 만들 때 참고)
const OLD_TIERS = [
  { name: 'EASY', stages: EASY, walls: [1, 0.6], tilt: null }, // 초급은 판이 안 기울어짐
  { name: 'NORMAL', stages: NORMAL, walls: [0.8, 0.5], tilt: { dirs: ['h', 'v'], angle: [5, 10], stepUp: 2, tilted: [2, 4], flat: [3, 7] } },
  { name: 'HARD', stages: HARD, walls: [0.65, 0.35], tilt: { dirs: ['h', 'v', 'd'], angle: [7, 13], stepUp: 2, tilted: [2.5, 5], flat: [2.5, 6] } },
  { name: 'EXPERT', stages: EXPERT, walls: [0.5, 0.2], tilt: { dirs: ['h', 'v', 'd'], angle: [9, 16], stepUp: 2, tilted: [3, 6], flat: [2, 5] } },
];
// nums: 보통 파랑 숫자 범위, big: 가끔 나오는 큰 숫자 (스테이지가 올라갈수록 큰 쪽이 잘 나옴)
const TIERS = [
  // randomGreen: 초록 칸 자리를 판마다 랜덤으로 (시작 위치도 초록이라 같이 바뀜)
  { level: 1, stages: LEVEL1, nums: [1, 10], big: [30, 50, 80, 100], walls: [1, 1], tilt: null, randomGreen: true }, // 벽 모두 막힘, 기울기 없음
  { level: 2, stages: LEVEL2, nums: [11, 20], big: [50, 100, 150, 200], walls: [1, 1], tilt: null, randomGreen: true },
  { level: 3, stages: LEVEL3, nums: [21, 30], big: [100, 200, 300, 500], walls: [1, 1], tilt: null },
  { level: 4, stages: LEVEL4, nums: [31, 40], big: [300, 500, 800, 1000], walls: [1, 1], tilt: null },
];
const STAGES = TIERS.flatMap((t) => t.stages);
