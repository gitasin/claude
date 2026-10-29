# Claude 작업 안내 (Cube Clean)

Claude Code가 이 폴더에서 시작할 때 자동으로 읽는 파일. 다른 PC에서 이어서 할 때도 이 파일이 규칙과 남은 일을 알려 줌.
규칙이나 남은 일이 바뀌면 이 파일도 같이 고칠 것.

## 작업 규칙 (사용자 지시)

- **모든 답변과 중간 안내는 한글로.**
- 작업 대상은 `cybercube/` (모바일 웹게임 Cube Clean), 브랜치 `gita1`.
- `stage2048/`, `game/` 폴더는 건드리지 않고 커밋하지도 않음.
- 커밋·push는 사용자가 말할 때만. 커밋할 때는 `cybercube/`만 (이 파일·continue.txt·dialog/는 함께 해도 됨).
- **수정하면 특별한 말이 없는 한 본주소에 바로 배포** (2026-10-28 지시). 미리보기 채널은 사용자가 말할 때만.
- 배포 전에 `cybercube/www/version.js`의 시각을 현재 시각으로 새로 씀 → 폰 화면 맨 아래 `build MM-dd HH:mm`으로 최신 버전인지 확인.
- 고친 뒤에는 headless Edge(CDP)로 실제로 돌려 보고 결과를 숫자로 알려 줌. 확인 못 한 부분은 못 했다고 말함.

## 배포

`cybercube` 폴더에서 (PowerShell은 `npx.ps1`이 막히므로 `npx.cmd` 사용):

```
npm run build                                   # src/cloud.js → www/cloud.js
npx.cmd firebase deploy --only hosting          # 본주소
npx.cmd firebase deploy --only "hosting,firestore:rules"   # firestore.rules를 바꿨을 때
npx.cmd firebase hosting:channel:deploy led-floor --expires 7d   # 미리보기 (말할 때만)
```

version.js 갱신 (PowerShell): `Set-Content -Encoding utf8 www/version.js "window.BUILD = '$(Get-Date -Format 'MM-dd HH:mm')';"`

- Firebase 프로젝트 `stages-861a3` (계정 gitasin0@gmail.com, 새 PC는 `npx.cmd firebase login` 먼저)
- 본주소 https://stages-861a3.web.app
- 미리보기 https://stages-861a3--led-floor-6m05ukpi.web.app (7일마다 만료)

## 파일

- `www/game.js` 게임 본체, `stages.js` 스테이지·레벨 설정(TIERS), `demo.js` 시연, `i18n.js` 5개 언어(en, ko, zh-CN, zh-TW, ja)
- `sound.js` 효과음(WebAudio 합성), `orb.js` 3D 볼, `crack.js` 금 가는 연출, `ads.js`·`ads-config.js` 광고
- `src/cloud.js` Firebase(익명 로그인, 진행 백업, 랭킹) → 빌드하면 `www/cloud.js` (gitignore)
- `privacy.html` 개인정보처리방침 (5개 언어, 게임 내용이 바뀌면 같이 점검)
- `firestore.rules` 진행 백업 `players/{uid}`, 레벨 랭킹 `levels/{L1-1}/points/{uid}` (점수 0~100000)

## 지금 게임 (2026-10-29 기준)

- 4레벨 × 8단계, 판 6×8, 75초, 생명 3, 판 둘레 벽은 모두 막힘, 기울기 없음.
  - 1레벨 직선 빨강, 2레벨 대각선 빨강, 3레벨 깜빡이 빨강, 4레벨 쓸기 빨강(4-1부터 초록 2개).
  - 1·2레벨은 초록 자리가 판마다 랜덤 (볼은 초록에서 시작).
- 파랑 16개, 판에는 8개씩 보이고 먹으면 하나씩 새로 나옴. 파랑이 옮겨질 때 숫자도 새로 뽑음.
  - 큰 숫자 2%(레벨별 TIERS[].big), 곱하기 5%(×3/5/10/15/20, 3이 가장 많음) = 직전에 먹은 파랑 × 곱하는 수.
  - 큰 숫자와 곱하기는 한 판에 같이 안 나옴 (먼저 나온 쪽만).
- 점수 = 단계별 최고 점수의 합. 점수로 아이템 구매: 순간이동(볼 두 번 탭 → 갈 칸 탭), 시간 정지(볼 2초 누름 → 5초 멈춤). 🎒 버튼으로 아이템 창.
- 시연: 처음 실행할 때 개인정보처리방침 → 게임 방법 7장면. 아이템 ? 버튼 → 사용법. 레벨마다 1단계 들어갈 때(다시 하기 포함) 그 레벨 빨강 시연, '다음부터 표시하지 않기' 체크해야 안 나옴.
- 보상형 광고(시험 모드는 가짜 광고): 생명 다 떨어지면 ♥+3, 시간 초과면 +60초.

## 출시 전에 할 일

- `game.js`: `TELEPORT_PRICE`·`FREEZE_PRICE` 실제 가격으로 (지금 시험용 10점, 순간이동은 1000 예정), `UNLOCK_ALL = false`, `window.__cc = () => state;` 줄 삭제.
- 시험용 버튼 삭제: 맨 아래 광고 모드 전환·점수 초기화 버튼, build 표시(`#buildTag`, `version.js`).
- `ads-config.js`: `defaultMode: 'release'`, `showModeToggle: false`, AdMob 실제 광고 ID와 `useTestAds: false`.
- 'Cube Clean' 이름 정식 상표 검색 (KIPRIS·TIPO·WIPO). 같은 이름의 작은 게임·청소 앱이 있어서 부제(예: "Cube Clean: Glow Floor")도 고려.
- localStorage 키 `cybercube.*`와 폴더 이름은 일부러 안 바꿈 (바꾸면 저장된 진행이 사라짐).

## 사용자가 아직 정하지 않은 것 (물어보면 됨)

- 시간을 60초로 줄이거나 파랑 개수 줄이기
- 시간 정지 누르는 중 손가락이 조금 움직여도 인정할지

## 시험 요령

- 시험 스크립트는 headless Edge + CDP(`--remote-debugging-port`)로 `file:///.../cybercube/www/index.html`을 열고 `__cc()`로 상태 확인.
- localStorage로 시작 상태 지정: `cybercube.hideIntro='1'`(시작 안내 끄기), `cybercube.hideRed='1,2,3,4'`(빨강 시연 끄기), `cybercube.lang='ko'`, `cybercube.progress`.
- 창 버튼은 뜬 직후 잠깐 눌러도 무시됨 (MODAL_GUARD_MS) → 시험에서 1초쯤 기다렸다 누름.
- bash에서 `node -e`에 템플릿 문자열을 넣으면 깨지기 쉬움 → 스크립트는 파일로 써서 실행.

## 이전 대화 기록

`dialog/`에 있음. `e41bd2c9-...jsonl.gz`가 Cube Clean 대화 전체(이미지는 뺌, gzip). 매우 길어서 필요한 부분만 찾아볼 것.
