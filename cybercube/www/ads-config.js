// 광고 설정
// - mode 'test'    = 광고 없는 버전 (기본)
// - mode 'release' = 광고 넣은 버전 (보상형 + 전면)
// - 폰 앱(Capacitor + @capacitor-community/admob)에서는 실제 AdMob, 브라우저에서는 가짜 광고 화면으로 흐름만 확인
window.ADS_CONFIG = {
  defaultMode: 'test',     // 처음 실행했을 때 모드. 스토어 출시 빌드는 'release'로
  showModeToggle: true,    // 메인 화면의 TEST/RELEASE 전환 버튼. 스토어 출시 빌드는 false로

  interstitialEvery: 3,    // 전면 광고: 판이 이만큼 끝날 때마다 (클리어·실패 모두 셈)
  interstitialMinGap: 60,  // 전면 광고 사이 최소 간격 (초)
  rewardedLife: 3,         // 보상형: 생명이 다 떨어졌을 때 받는 생명 (3 = 가득)
  rewardedTime: 60,        // 보상형: 시간이 다 됐을 때 받는 시간 (초, 1분)
  simulatedSeconds: 5,     // 브라우저 가짜 광고 길이 (초)

  // AdMob 광고 단위 ID. 지금은 Google 공식 테스트 ID
  // 출시할 때 AdMob 콘솔에서 받은 실제 ID로 바꾸고 useTestAds를 false로
  // (앱 ID는 여기가 아니라 AndroidManifest.xml / Info.plist에 넣음)
  admob: {
    useTestAds: true,
    android: {
      interstitial: 'ca-app-pub-3940256099942544/1033173712',
      rewarded: 'ca-app-pub-3940256099942544/5224354917',
    },
    ios: {
      interstitial: 'ca-app-pub-3940256099942544/4411468910',
      rewarded: 'ca-app-pub-3940256099942544/1712485313',
    },
  },
};
