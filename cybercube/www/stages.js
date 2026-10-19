// 스테이지 데이터 (판 크기: 가로 6 × 세로 8)
// - time: 제한 시간 (초)
// - map: 판 모양 (위→아래)
//     '.' = 빈 바닥, 'B' = 파랑 (밟아서 모두 끄기), 'G' = 초록 (안전지대, 빨강이 못 들어옴)
//     '#' = 구멍 (못 밟음), 'P' = 시작 위치
//     'a' / 'b' = 깜빡이는 빨강 (a와 b가 번갈아 켜짐)
// - blink: 깜빡임 설정 { period: 한 주기(초), warn: 켜지기 전 경고 시간(초) }
// - hazards: 움직이는 빨강
//     { type: 'bounce', x, y, dx, dy, speed }  직선으로 움직이다 막히면 튕김 (dx, dy 둘 다 주면 대각선)
//     { type: 'chase', x, y, speed }           플레이어를 쫓아옴 (초록 위에 있으면 배회)
//     { type: 'sweep', axis: 'row'|'col', pos, dir, speed }  한 줄 전체가 쓸고 지나감 (초록은 안전)
//   speed = 초당 이동 칸 수
const STAGES = [
  {
    time: 30,
    map: [
      '......',
      '.B..B.',
      '......',
      '..BB..',
      '......',
      '.B..B.',
      '......',
      '..P...',
    ],
    hazards: [],
  },
  {
    time: 30,
    map: [
      '.B..B.',
      '......',
      'B....B',
      '......',
      'B....B',
      '......',
      '.B..B.',
      '..P...',
    ],
    hazards: [{ type: 'bounce', x: 0, y: 3, dx: 1, dy: 0, speed: 2.5 }],
  },
  {
    time: 35,
    map: [
      'B.BB.B',
      '......',
      'G....G',
      '.B..B.',
      '.B..B.',
      'G....G',
      '......',
      'B.P..B',
    ],
    hazards: [
      { type: 'bounce', x: 1, y: 2, dx: 1, dy: 0, speed: 3 },
      { type: 'bounce', x: 4, y: 5, dx: -1, dy: 0, speed: 3 },
    ],
  },
  {
    time: 40,
    map: [
      'B..B.B',
      '.#..#.',
      'B....B',
      '..##..',
      'B....B',
      '.#..#.',
      'B.BB.B',
      '..P...',
    ],
    hazards: [
      { type: 'bounce', x: 0, y: 0, dx: 0, dy: 1, speed: 2.5 },
      { type: 'bounce', x: 5, y: 7, dx: 0, dy: -1, speed: 2.5 },
      { type: 'bounce', x: 1, y: 2, dx: 1, dy: 0, speed: 2 },
    ],
  },
  {
    time: 40,
    map: [
      'B.aa.B',
      '.b..b.',
      'a.BB.a',
      '.b..b.',
      'b.BB.b',
      '.a..a.',
      'B.bb.B',
      '..P...',
    ],
    blink: { period: 3, warn: 0.7 },
    hazards: [],
  },
  {
    time: 45,
    map: [
      'BB..BB',
      'G....G',
      '..BB..',
      '.G..G.',
      '..BB..',
      'G....G',
      'BB..BB',
      'G.P..G',
    ],
    hazards: [{ type: 'sweep', axis: 'row', pos: 0, dir: 1, speed: 1.2 }],
  },
  {
    time: 40,
    map: [
      'B....B',
      '..B...',
      '.G..B.',
      'B..G..',
      '..B..B',
      '.B..G.',
      'B...B.',
      '..P...',
    ],
    hazards: [{ type: 'chase', x: 2, y: 0, speed: 1.6 }],
  },
  {
    time: 40,
    map: [
      'B.B..B',
      '......',
      '.B..B.',
      '..BB..',
      '..BB..',
      '.B..B.',
      '......',
      'B.P.BB',
    ],
    hazards: [
      { type: 'bounce', x: 0, y: 1, dx: 1, dy: 1, speed: 2.5 },
      { type: 'bounce', x: 5, y: 4, dx: -1, dy: -1, speed: 2.5 },
    ],
  },
  {
    time: 45,
    map: [
      'BabbaB',
      'a....b',
      'b.BB.a',
      '..GG..',
      'a.BB.b',
      'b....a',
      'BabbaB',
      '..P...',
    ],
    blink: { period: 2.6, warn: 0.6 },
    hazards: [
      { type: 'bounce', x: 1, y: 1, dx: 1, dy: 0, speed: 2 },
      { type: 'bounce', x: 4, y: 5, dx: -1, dy: 0, speed: 2 },
    ],
  },
  {
    time: 50,
    map: [
      'BG..GB',
      'B....B',
      '..GG..',
      'BB..BB',
      '..GG..',
      'B....B',
      'BG..GB',
      '..P...',
    ],
    hazards: [
      { type: 'sweep', axis: 'col', pos: 0, dir: 1, speed: 1 },
      { type: 'bounce', x: 0, y: 3, dx: 1, dy: 0, speed: 2.5 },
    ],
  },
  {
    time: 50,
    map: [
      'BaBbBa',
      'b....b',
      '..G...',
      'aB..Ba',
      'bB..Bb',
      '...G..',
      'a....a',
      'B.P.bB',
    ],
    blink: { period: 3, warn: 0.7 },
    hazards: [{ type: 'chase', x: 1, y: 1, speed: 1.4 }],
  },
  {
    time: 60,
    map: [
      'BGaaGB',
      'b.BB.b',
      '..##..',
      'BaGGaB',
      'B.##.B',
      'b.BB.b',
      'BGaaGB',
      '..P...',
    ],
    blink: { period: 3.2, warn: 0.7 },
    hazards: [
      { type: 'sweep', axis: 'row', pos: 0, dir: 1, speed: 0.9 },
      { type: 'bounce', x: 1, y: 1, dx: 1, dy: 0, speed: 2.5 },
      { type: 'chase', x: 5, y: 7, speed: 1.2 },
    ],
  },
];
