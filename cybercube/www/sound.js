// 효과음 (WebAudio 합성, 파일 없음)
// - window.Sound.create(isOn) → { step, blue, hit, crack, shatter, flatline, timeUp, tick, go, shuffle, clear, bump }
// - 부드럽게: 둥근 파형(sine)만, 마림바 같은 배음(bell), 살짝 천천히 시작, 높은 소리 거르기, 짧은 울림(echo)
//   걷는 소리는 매번 높이가 조금씩 다름, 파랑을 빠르게 이어 밟으면 음계가 올라감
(() => {
  let ctx = null;
  let master = null;
  let echoIn = null;
  let noiseBuf = null;
  const rand = (a, b) => a + Math.random() * (b - a);

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    // 출력: 전체 음량 → 압축(갑자기 커지는 소리 정리) → 스피커
    master = ctx.createGain();
    master.gain.value = 0.9;
    const soft = ctx.createBiquadFilter(); // 귀에 거슬리는 아주 높은 소리는 걸러냄
    soft.type = 'lowpass';
    soft.frequency.value = 7000;
    const comp = ctx.createDynamicsCompressor();
    master.connect(soft).connect(comp).connect(ctx.destination);
    // 짧은 울림: 0.11초 메아리가 조금씩 줄어들며 반복 (높은 소리는 깎아서 부드럽게)
    echoIn = ctx.createGain();
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.11;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    const fb = ctx.createGain();
    fb.gain.value = 0.25;
    const wet = ctx.createGain();
    wet.gain.value = 0.2;
    echoIn.connect(delay);
    delay.connect(lp);
    lp.connect(fb);
    fb.connect(delay);
    lp.connect(wet);
    wet.connect(master);
    // 잡음 재료 (1초짜리 백색 잡음)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return true;
  }

  // 소리 하나의 출구: 음량 모양(빠르게 커졌다 줄어듦) → 전체 + 울림
  function output(at, dur, vol, attack, echo) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    g.connect(master);
    if (echo > 0) {
      const send = ctx.createGain();
      send.gain.value = echo;
      g.connect(send).connect(echoIn);
    }
    return g;
  }

  // 음: f(Hz), slide = 끝날 때 높이, detune = 두 번째 음을 몇 cent 어긋나게 겹칠지
  function tone({ f, dur = 0.1, type = 'triangle', vol = 0.06, delay = 0, attack = 0.005, slide, detune = 0, cutoff, echo = 0.2 }) {
    const at = ctx.currentTime + delay;
    let out = output(at, dur, vol, attack, echo);
    if (cutoff) {
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = cutoff;
      filt.connect(out);
      out = filt;
    }
    (detune ? [0, detune] : [0]).forEach((cents) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(f, at);
      if (slide) osc.frequency.exponentialRampToValueAtTime(slide, at + dur);
      osc.detune.value = cents;
      osc.connect(out);
      osc.start(at);
      osc.stop(at + dur + 0.02);
    });
  }

  // 잡음: 필터로 깎아서 "퍽", "치익", "쨍그랑" 같은 질감
  function noise({ dur = 0.1, vol = 0.1, delay = 0, attack = 0.003, type = 'bandpass', freq = 2000, q = 1, sweepTo, echo = 0.15 }) {
    const at = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(freq, at);
    if (sweepTo) filt.frequency.exponentialRampToValueAtTime(sweepTo, at + dur);
    filt.Q.value = q;
    src.connect(filt).connect(output(at, dur, vol, attack, echo));
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.02);
  }

  // 마림바·실로폰 같은 부드러운 음: 기본음 + 빨리 사라지는 배음 두 개 (둥근 파형만)
  function bell(f, { vol = 0.08, dur = 0.45, delay = 0, echo = 0.3 } = {}) {
    tone({ f, dur, type: 'sine', vol, delay, attack: 0.008, echo });
    tone({ f: f * 2.76, dur: dur * 0.3, type: 'sine', vol: vol * 0.22, delay, attack: 0.004, echo: echo * 0.5 });
    tone({ f: f * 4, dur: dur * 0.15, type: 'sine', vol: vol * 0.07, delay, attack: 0.003, echo: 0 });
  }

  // 파랑 연속 밟기 음계 (도레미솔라 …): 1.6초 안에 이어 밟으면 한 칸씩 올라감
  const SCALE = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093];
  let combo = -1;
  let lastBlue = 0;

  const SOUNDS = {
    step() {
      // 부드러운 "톡" (높이 매번 조금씩 다름)
      tone({ f: rand(170, 200), slide: rand(130, 150), dur: 0.07, type: 'sine', vol: 0.05, attack: 0.006, echo: 0.05 });
    },
    bump() {
      tone({ f: 110, slide: 80, dur: 0.09, type: 'sine', vol: 0.06, attack: 0.006, echo: 0 });
    },
    blue() {
      const now = performance.now();
      combo = now - lastBlue < 1600 ? Math.min(combo + 1, SCALE.length - 1) : 0;
      lastBlue = now;
      const f = SCALE[combo];
      // 마림바 "또롱": 또렷한 첫 음 → 5도 위 음
      bell(f, { vol: 0.12, dur: 0.5, echo: 0.25 });
      bell(f * 1.5, { vol: 0.07, dur: 0.45, delay: 0.06, echo: 0.3 });
    },
    hit() {
      noise({ dur: 0.2, vol: 0.22, type: 'lowpass', freq: 400, echo: 0.1 });              // 둔한 "퍽"
      tone({ f: 120, slide: 55, dur: 0.3, type: 'sine', vol: 0.2, attack: 0.004, echo: 0.1 });
      noise({ dur: 0.07, vol: 0.06, delay: 0.02, type: 'bandpass', freq: 3000, q: 3 });   // 살짝 "지직"
    },
    crack() {
      // 유리에 금 가는 소리: 맑은 "찡" + 가는 "찌직"
      tone({ f: 2600, slide: 2300, dur: 0.12, type: 'sine', vol: 0.04, delay: 0.03, echo: 0.3 });
      noise({ dur: 0.05, vol: 0.09, delay: 0.03, type: 'bandpass', freq: 4500, q: 8, echo: 0.25 });
      noise({ dur: 0.04, vol: 0.06, delay: 0.09, type: 'bandpass', freq: 5200, q: 10, echo: 0.25 });
    },
    shatter() {
      // 와장창: 잡음이 높은 데서 내려오고 + 유리 조각 "팅팅"
      noise({ dur: 0.45, vol: 0.2, type: 'highpass', freq: 5000, sweepTo: 1400, echo: 0.35 });
      noise({ dur: 0.12, vol: 0.15, type: 'lowpass', freq: 600, echo: 0.1 });
      for (let i = 0; i < 7; i++) {
        tone({ f: rand(2200, 4800), dur: rand(0.15, 0.35), type: 'sine', vol: 0.03, delay: rand(0.02, 0.35), attack: 0.003, echo: 0.5 });
      }
    },
    flatline() {
      // 죽음: 심전도 멈춤 같은 긴 "삐———" (맑은 단일 음)
      tone({ f: 1000, dur: 1.5, type: 'sine', vol: 0.11, attack: 0.02, echo: 0.1 });
    },
    timeUp() {
      // 시간 초과: 부드러운 "삐삐"
      [0, 0.26].forEach((delay) => tone({ f: 880, dur: 0.18, type: 'sine', vol: 0.09, delay, attack: 0.01, echo: 0.2 }));
    },
    tick() {
      bell(660, { vol: 0.07, dur: 0.25, echo: 0.2 });
    },
    go() {
      [523, 659, 784].forEach((f, i) => bell(f, { vol: 0.06, dur: 0.6, delay: i * 0.03, echo: 0.4 }));
    },
    shuffle() {
      noise({ dur: 0.3, vol: 0.06, type: 'bandpass', freq: 600, sweepTo: 3500, q: 2, echo: 0.3 });   // 부드러운 "슈욱"
      bell(1568, { vol: 0.045, dur: 0.5, delay: 0.14, echo: 0.5 });                                  // 딩
      bell(2093, { vol: 0.035, dur: 0.5, delay: 0.21, echo: 0.5 });                                  // 동
    },
    clear() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => bell(f, { vol: 0.07, dur: 0.6, delay: i * 0.08, echo: 0.4 }));
      [523, 784, 1047].forEach((f) => tone({ f, dur: 1.1, type: 'sine', vol: 0.03, delay: 0.42, attack: 0.08, echo: 0.6 })); // 은은한 화음
    },
  };

  window.Sound = {
    create(isOn) {
      const api = {};
      Object.keys(SOUNDS).forEach((name) => {
        api[name] = () => {
          if (!isOn()) return;
          try { if (init()) SOUNDS[name](); } catch (e) { /* 소리 없이 진행 */ }
        };
      });
      return api;
    },
  };
})();
