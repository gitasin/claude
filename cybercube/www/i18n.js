// 다국어: 한국어 · English · 简体中文 · 繁體中文 · 日本語
// - 처음엔 기기 언어(navigator.language)로 자동 선택, 지원 안 하면 영어
// - 고른 언어는 이 기기에만 저장 (개인정보 아님)
// - HTML: data-i18n="키" → 글자, data-i18n-aria="키" → aria-label
// - JS: window.I18N.t('키', { n: 3 }) → '{n}' 자리에 값
(() => {
  const LANG_KEY = 'cybercube.lang';
  const LANGS = { ko: '한국어', en: 'English', 'zh-CN': '简体中文', 'zh-TW': '繁體中文', ja: '日本語' };

  const DICT = {
    en: {
      stars: 'STARS', step: 'STEP', avoid: 'AVOID', safe: 'SAFE', privacy: 'PRIVACY',
      soundOn: '♪ ON', soundOff: '♪ OFF', language: 'LANGUAGE',
      adTest: 'AD MODE · TEST', adRelease: 'AD MODE · RELEASE',
      tierEASY: 'EASY', tierNORMAL: 'NORMAL', tierHARD: 'HARD', tierEXPERT: 'EXPERT', stageLabel: '{tier} {n}',
      blue: 'BLUE', time: 'TIME', life: 'LIFE', swipeHint: 'SWIPE ↑ ↓ ← → ↖ ↗ ↙ ↘', go: 'GO',
      howTo: 'HOW TO PLAY', skip: 'SKIP', start: 'START ▶', prev: 'Previous', nextAria: 'Next',
      clear: 'CLEAR!', failed: 'FAILED', paused: 'PAUSED', outOfLife: 'OUT OF LIFE', timeUp: 'TIME UP',
      newBest: 'NEW BEST', continued: 'CONTINUED (NO RANKING)', myBest: 'MY BEST', rank: 'RANK',
      ranking: 'RANKING', close: 'CLOSE', next: 'NEXT ▶', retry: 'RETRY', stages: 'STAGES', resume: 'RESUME',
      watchAdLife: '▶ Watch ad ♥+{n}', watchAdTime: '▶ WATCH AD · +{n}s',
      loading: 'LOADING…', offline: 'OFFLINE', noRecords: 'NO RECORDS YET', name: 'NAME', ok: 'OK',
      adSimulated: 'SIMULATED', adRewarded: 'REWARDED AD', adInterstitial: 'INTERSTITIAL AD',
      adRewardDone: 'REWARD ✓', adClose: 'CLOSE ✕',
      d1t: 'SWIPE TO MOVE', d1s: '8 directions  ↑ ↓ ← → ↖ ↗ ↙ ↘',
      d2t: 'STEP ON ALL BLUE', d2s: 'Turn every blue tile off',
      d3t: 'AVOID RED', d3s: 'Red tiles move. Time your step',
      d4t: 'RED = LOSE A LIFE', d4s: '3 lives. Lose them all and it\'s over',
      d5t: 'GREEN IS SAFE', d5s: 'Red can\'t enter green. Hide there',
      d6t: 'BLUE TELEPORTS!', d6s: 'Blue blinks, then jumps to a new spot',
      d7t: 'BEAT THE CLOCK', d7s: 'Clear before time runs out. Fewer hits = more ★',
      nice: 'NICE!',
      dontShowAgain: 'Don\'t show this again', privacyTitle: 'PRIVACY POLICY', introNext: 'NEXT ▶',
      nameLabel: 'Nickname shown in the ranking', save: 'SAVE', saved: '✓ Saved',
    },
    ko: {
      stars: '별', step: '밟기', avoid: '피하기', safe: '안전', privacy: '개인정보처리방침',
      soundOn: '♪ 소리 켜짐', soundOff: '♪ 소리 꺼짐', language: '언어',
      adTest: '광고 모드 · 테스트', adRelease: '광고 모드 · 출시',
      tierEASY: '초급', tierNORMAL: '중급', tierHARD: '고급', tierEXPERT: '특급', stageLabel: '{tier} {n}',
      blue: '파랑', time: '시간', life: '생명', swipeHint: '밀어서 이동  ↑ ↓ ← → ↖ ↗ ↙ ↘', go: '시작!',
      howTo: '게임 방법', skip: '건너뛰기', start: '시작 ▶', prev: '이전', nextAria: '다음',
      clear: '클리어!', failed: '실패', paused: '일시정지', outOfLife: '생명을 모두 잃었어요', timeUp: '시간 초과',
      newBest: '최고 기록!', continued: '이어하기 (랭킹 제외)', myBest: '내 최고', rank: '순위',
      ranking: '랭킹', close: '닫기', next: '다음 ▶', retry: '다시 하기', stages: '스테이지', resume: '계속하기',
      watchAdLife: '▶ 광고보고 ♥+{n}', watchAdTime: '▶ 광고 보고 +{n}초',
      loading: '불러오는 중…', offline: '오프라인', noRecords: '아직 기록이 없어요', name: '닉네임', ok: '확인',
      adSimulated: '가짜 광고', adRewarded: '보상형 광고', adInterstitial: '전면 광고',
      adRewardDone: '보상 받음 ✓', adClose: '닫기 ✕',
      d1t: '밀어서 이동', d1s: '8방향  ↑ ↓ ← → ↖ ↗ ↙ ↘',
      d2t: '파랑을 모두 밟기', d2s: '파란 타일을 전부 꺼요',
      d3t: '빨강 피하기', d3s: '빨강은 움직여요. 타이밍을 맞춰 지나가요',
      d4t: '빨강을 밟으면 생명 -1', d4s: '생명은 3개, 다 잃으면 끝나요',
      d5t: '초록은 안전지대', d5s: '빨강은 초록에 못 들어와요. 여기 숨어요',
      d6t: '파랑이 순간이동!', d6s: '깜빡이면 곧 다른 칸으로 옮겨가요',
      d7t: '시간 안에 클리어', d7s: '시간 안에 다 밟아요. 덜 맞을수록 ★가 많아요',
      nice: '좋아요!',
      dontShowAgain: '다음부터 표시하지 않기', privacyTitle: '개인정보처리방침', introNext: '다음 ▶',
      nameLabel: '랭킹에 표시될 닉네임', save: '저장', saved: '✓ 저장됨',
    },
    'zh-CN': {
      stars: '星星', step: '踩', avoid: '躲开', safe: '安全', privacy: '隐私政策',
      soundOn: '♪ 音效 开', soundOff: '♪ 音效 关', language: '语言',
      adTest: '广告模式 · 测试', adRelease: '广告模式 · 上线',
      tierEASY: '初级', tierNORMAL: '中级', tierHARD: '高级', tierEXPERT: '特级', stageLabel: '{tier} {n}',
      blue: '蓝色', time: '时间', life: '生命', swipeHint: '滑动移动  ↑ ↓ ← → ↖ ↗ ↙ ↘', go: '开始！',
      howTo: '游戏玩法', skip: '跳过', start: '开始 ▶', prev: '上一个', nextAria: '下一个',
      clear: '过关！', failed: '失败', paused: '暂停', outOfLife: '生命用完了', timeUp: '时间到',
      newBest: '新纪录！', continued: '续关（不计入排行）', myBest: '我的最佳', rank: '名次',
      ranking: '排行榜', close: '关闭', next: '下一关 ▶', retry: '再试一次', stages: '关卡', resume: '继续',
      watchAdLife: '▶ 看广告 ♥+{n}', watchAdTime: '▶ 看广告 +{n} 秒',
      loading: '加载中…', offline: '离线', noRecords: '还没有记录', name: '昵称', ok: '确定',
      adSimulated: '模拟广告', adRewarded: '激励广告', adInterstitial: '插屏广告',
      adRewardDone: '获得奖励 ✓', adClose: '关闭 ✕',
      d1t: '滑动来移动', d1s: '8 个方向  ↑ ↓ ← → ↖ ↗ ↙ ↘',
      d2t: '踩完所有蓝色', d2s: '把蓝色方块全部踩灭',
      d3t: '躲开红色', d3s: '红色会移动，看准时机通过',
      d4t: '踩到红色＝失去 1 条命', d4s: '共 3 条命，全部用完就结束',
      d5t: '绿色是安全区', d5s: '红色进不了绿色，躲在这里',
      d6t: '蓝色会瞬间移动！', d6s: '闪烁之后会跳到别的位置',
      d7t: '在时间内过关', d7s: '时间用完前过关，被打越少 ★ 越多',
      nice: '赞！',
      dontShowAgain: '下次不再显示', privacyTitle: '隐私政策', introNext: '下一步 ▶',
      nameLabel: '排行榜上显示的昵称', save: '保存', saved: '✓ 已保存',
    },
    'zh-TW': {
      stars: '星星', step: '踩', avoid: '躲開', safe: '安全', privacy: '隱私權政策',
      soundOn: '♪ 音效 開', soundOff: '♪ 音效 關', language: '語言',
      adTest: '廣告模式 · 測試', adRelease: '廣告模式 · 上架',
      tierEASY: '初級', tierNORMAL: '中級', tierHARD: '高級', tierEXPERT: '特級', stageLabel: '{tier} {n}',
      blue: '藍色', time: '時間', life: '生命', swipeHint: '滑動移動  ↑ ↓ ← → ↖ ↗ ↙ ↘', go: '開始！',
      howTo: '遊戲玩法', skip: '略過', start: '開始 ▶', prev: '上一個', nextAria: '下一個',
      clear: '過關！', failed: '失敗', paused: '暫停', outOfLife: '生命用完了', timeUp: '時間到',
      newBest: '新紀錄！', continued: '接關（不列入排行）', myBest: '我的最佳', rank: '名次',
      ranking: '排行榜', close: '關閉', next: '下一關 ▶', retry: '再試一次', stages: '關卡', resume: '繼續',
      watchAdLife: '▶ 看廣告 ♥+{n}', watchAdTime: '▶ 看廣告 +{n} 秒',
      loading: '載入中…', offline: '離線', noRecords: '還沒有紀錄', name: '暱稱', ok: '確定',
      adSimulated: '模擬廣告', adRewarded: '獎勵廣告', adInterstitial: '插頁廣告',
      adRewardDone: '獲得獎勵 ✓', adClose: '關閉 ✕',
      d1t: '滑動來移動', d1s: '8 個方向  ↑ ↓ ← → ↖ ↗ ↙ ↘',
      d2t: '踩完所有藍色', d2s: '把藍色方塊全部踩熄',
      d3t: '躲開紅色', d3s: '紅色會移動，抓準時機通過',
      d4t: '踩到紅色＝失去 1 條命', d4s: '共 3 條命，全部用完就結束',
      d5t: '綠色是安全區', d5s: '紅色進不了綠色，躲在這裡',
      d6t: '藍色會瞬間移動！', d6s: '閃爍之後會跳到別的位置',
      d7t: '在時間內過關', d7s: '時間用完前過關，被打越少 ★ 越多',
      nice: '讚！',
      dontShowAgain: '下次不再顯示', privacyTitle: '隱私權政策', introNext: '下一步 ▶',
      nameLabel: '排行榜上顯示的暱稱', save: '儲存', saved: '✓ 已儲存',
    },
    ja: {
      stars: 'スター', step: '踏む', avoid: 'よける', safe: '安全', privacy: 'プライバシー',
      soundOn: '♪ サウンド オン', soundOff: '♪ サウンド オフ', language: '言語',
      adTest: '広告モード · テスト', adRelease: '広告モード · リリース',
      tierEASY: '初級', tierNORMAL: '中級', tierHARD: '上級', tierEXPERT: '特級', stageLabel: '{tier} {n}',
      blue: '青', time: 'タイム', life: 'ライフ', swipeHint: 'スワイプで移動  ↑ ↓ ← → ↖ ↗ ↙ ↘', go: 'スタート！',
      howTo: '遊び方', skip: 'スキップ', start: 'スタート ▶', prev: '前へ', nextAria: '次へ',
      clear: 'クリア！', failed: '失敗', paused: '一時停止', outOfLife: 'ライフがなくなりました', timeUp: 'タイムアップ',
      newBest: '自己ベスト！', continued: 'コンティニュー（ランキング対象外）', myBest: '自己ベスト', rank: '順位',
      ranking: 'ランキング', close: '閉じる', next: '次へ ▶', retry: 'リトライ', stages: 'ステージ', resume: '再開',
      watchAdLife: '▶ 広告を見て ♥+{n}', watchAdTime: '▶ 広告を見て +{n}秒',
      loading: '読み込み中…', offline: 'オフライン', noRecords: 'まだ記録がありません', name: 'ニックネーム', ok: 'OK',
      adSimulated: '模擬広告', adRewarded: 'リワード広告', adInterstitial: 'インタースティシャル広告',
      adRewardDone: '報酬獲得 ✓', adClose: '閉じる ✕',
      d1t: 'スワイプで移動', d1s: '8方向  ↑ ↓ ← → ↖ ↗ ↙ ↘',
      d2t: '青をすべて踏もう', d2s: '青いタイルを全部消そう',
      d3t: '赤をよけよう', d3s: '赤は動きます。タイミングを見て進もう',
      d4t: '赤を踏むとライフ -1', d4s: 'ライフは3つ。全部なくなると終わり',
      d5t: '緑は安全地帯', d5s: '赤は緑に入れません。ここに隠れよう',
      d6t: '青がワープ！', d6s: '点滅したら別のマスへ移動します',
      d7t: '時間内にクリア', d7s: '時間切れ前にクリア。被弾が少ないほど★が増える',
      nice: 'ナイス！',
      dontShowAgain: '次回から表示しない', privacyTitle: 'プライバシーポリシー', introNext: '次へ ▶',
      nameLabel: 'ランキングに表示されるニックネーム', save: '保存', saved: '✓ 保存しました',
    },
  };

  // 기기 언어 → 지원 언어 (중국어는 지역에 따라 간체/번체, 나머지 미지원 언어는 영어)
  function detect() {
    const list = navigator.languages?.length ? navigator.languages : [navigator.language || 'en'];
    for (const raw of list) {
      const l = String(raw).toLowerCase();
      if (l.startsWith('ko')) return 'ko';
      if (l.startsWith('ja')) return 'ja';
      if (l.startsWith('zh')) return /-(tw|hk|mo|hant)/.test(l) ? 'zh-TW' : 'zh-CN';
      if (l.startsWith('en')) return 'en';
    }
    return 'en';
  }

  let lang = null;
  try { lang = localStorage.getItem(LANG_KEY); } catch (e) { /* 저장소 없음 */ }
  if (!DICT[lang]) lang = detect();

  function t(key, vars) {
    let s = DICT[lang][key] ?? DICT.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
    return s;
  }

  // 화면의 data-i18n 글자 바꾸기
  function apply(root = document) {
    document.documentElement.lang = lang;
    root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  }

  window.I18N = {
    LANGS,
    get lang() { return lang; },
    t,
    apply,
    setLang(l) {
      if (!DICT[l]) return;
      lang = l;
      try { localStorage.setItem(LANG_KEY, l); } catch (e) { /* 이번 실행 동안만 */ }
      apply();
    },
  };
  // 스크립트는 body 끝에서 불러오므로 화면 요소가 이미 있음
  apply();
})();
