// 광고: 테스트/출시 모드 전환 + 보상형·전면 광고
// - window.Ads.isRelease()            출시 모드인지
// - window.Ads.setMode('test'|'release')
// - window.Ads.showRewarded()         → Promise<boolean> (끝까지 봐서 보상을 받았는지)
// - window.Ads.countResult()          판이 끝날 때마다 호출 (전면 광고 주기 계산)
// - window.Ads.beforeNext()           → Promise. 결과 화면에서 다음 행동 전에 호출, 전면 광고 차례면 보여주고 끝나면 풀림
(() => {
  const cfg = window.ADS_CONFIG || {};
  const MODE_KEY = 'cybercube.adMode'; // 기기별 설정 (클라우드 저장 안 함)

  let mode = cfg.defaultMode || 'test';
  try { mode = localStorage.getItem(MODE_KEY) || mode; } catch (e) { /* 기본값 */ }

  let results = 0;           // 마지막 전면 광고 후 끝난 판 수
  let lastAdAt = 0;          // 마지막 광고(종류 무관) 시각 (ms)

  // ── 폰 앱: AdMob ──
  const AdMob = window.Capacitor?.Plugins?.AdMob;
  const platform = window.Capacitor?.getPlatform?.();
  const ids = cfg.admob?.[platform === 'ios' ? 'ios' : 'android'] || {};
  let admobReady = null;

  function initAdMob() {
    if (!admobReady) {
      // TODO 출시 전: iOS 추적 허용(ATT)·유럽 동의(UMP) 요청을 여기서
      admobReady = AdMob.initialize({ initializeForTesting: !!cfg.admob?.useTestAds });
    }
    return admobReady;
  }

  // 이벤트 하나가 올 때까지 기다리기 (먼저 온 것으로 결정)
  function waitFor(events) {
    return new Promise((resolve) => {
      const handles = [];
      const done = (name) => { handles.forEach((h) => h.then((x) => x.remove())); resolve(name); };
      events.forEach((name) => handles.push(Promise.resolve(AdMob.addListener(name, () => done(name)))));
    });
  }

  async function admobInterstitial() {
    await initAdMob();
    await AdMob.prepareInterstitial({ adId: ids.interstitial, isTesting: !!cfg.admob?.useTestAds });
    const closed = waitFor(['onInterstitialAdDismissed', 'onInterstitialAdFailedToShow']);
    await AdMob.showInterstitial();
    await closed;
  }

  async function admobRewarded() {
    await initAdMob();
    await AdMob.prepareRewardVideoAd({ adId: ids.rewarded, isTesting: !!cfg.admob?.useTestAds });
    let rewarded = false;
    const reward = AdMob.addListener('onRewardedVideoAdReward', () => { rewarded = true; });
    const closed = waitFor(['onRewardedVideoAdDismissed', 'onRewardedVideoAdFailedToShow']);
    await AdMob.showRewardVideoAd();
    await closed;
    Promise.resolve(reward).then((h) => h.remove());
    return rewarded;
  }

  // ── 브라우저: 가짜 광고 화면 (흐름 확인용) ──
  function simulated(kind) {
    return new Promise((resolve) => {
      const el = document.getElementById('adOverlay');
      const label = document.getElementById('adLabel');
      const count = document.getElementById('adCount');
      const close = document.getElementById('adClose');
      let left = cfg.simulatedSeconds || 5;
      const t = window.I18N.t;
      label.textContent = t(kind === 'rewarded' ? 'adRewarded' : 'adInterstitial');
      close.classList.add('hidden');
      count.textContent = left;
      el.classList.remove('hidden');
      let finished = false;
      const timer = setInterval(() => {
        left--;
        count.textContent = Math.max(0, left);
        if (left <= 0) {
          clearInterval(timer);
          finished = true;
          count.textContent = kind === 'rewarded' ? t('adRewardDone') : '';
          close.classList.remove('hidden');
        }
      }, 1000);
      close.onclick = () => {
        clearInterval(timer);
        el.classList.add('hidden');
        resolve(finished);
      };
    });
  }

  async function show(kind) {
    lastAdAt = Date.now();
    try {
      if (AdMob) {
        if (kind === 'rewarded') return await admobRewarded();
        await admobInterstitial();
        return true;
      }
      return await simulated(kind);
    } catch (e) {
      console.warn('[ads] 광고 못 띄움:', e.message || e);
      return false; // 광고가 안 떠도 게임은 계속
    }
  }

  window.Ads = {
    isRelease: () => mode === 'release',
    get mode() { return mode; },
    setMode(m) {
      mode = m === 'release' ? 'release' : 'test';
      try { localStorage.setItem(MODE_KEY, mode); } catch (e) { /* 이번 실행 동안만 */ }
    },
    showToggle: cfg.showModeToggle !== false,

    async showRewarded() {
      if (mode !== 'release') return false;
      const ok = await show('rewarded');
      results = 0; // 보상형 직후엔 전면 광고 안 띄움
      return ok;
    },

    countResult() {
      if (mode === 'release') results++;
    },

    async beforeNext() {
      if (mode !== 'release') return;
      const gapOk = Date.now() - lastAdAt >= (cfg.interstitialMinGap ?? 60) * 1000;
      if (results < (cfg.interstitialEvery || 3) || !gapOk) return;
      results = 0;
      await show('interstitial');
    },
  };
})();
