// 클라우드: Firebase 익명 로그인 + Firestore
// - 진행 상황 백업: players/{uid}
// - 스테이지별 랭킹: levels/{스테이지 id}/points/{uid}  (점수 = 밟은 파랑 숫자의 합, 높을수록 좋음)
// - 게임은 폰 저장(localStorage)만으로 동작하고, 이 모듈은 그걸 클라우드와 맞춰주기만 함
// - 인터넷이 없거나 설정이 비어 있으면 조용히 아무것도 안 함 (랭킹 함수는 null 반환)
// - 빌드: npm run build → www/cloud.js (Firebase SDK를 한 파일로 묶어서 오프라인에서도 로드됨)
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
// Lite 버전: 실시간 동기화·오프라인 캐시가 없는 대신 훨씬 가벼움
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, orderBy, limit,
  getDocs, getCount, serverTimestamp,
} from 'firebase/firestore/lite';

const SAVE_DELAY_MS = 1500; // 연속 저장을 모아서 한 번에 보냄

let db = null;
let uid = null;
let playerRef = null; // Firestore 문서: players/{익명 사용자 uid}
let pending = null;   // 아직 못 보낸 진행 상황
let timer = null;
let ready = null;     // 로그인이 끝나면 풀리는 Promise

// 두 진행 상황 합치기: 점수·별은 큰 값, 시간 기록은 작은 값, 닉네임은 더 최근에 저장된 쪽
function merge(a, b) {
  const pick = (x = {}, y = {}, better) => {
    const out = { ...x };
    for (const [k, v] of Object.entries(y)) out[k] = out[k] == null ? v : better(out[k], v);
    return out;
  };
  const newer = (a.updated || 0) >= (b.updated || 0) ? a : b;
  return {
    stars: pick(a.stars, b.stars, Math.max),
    best: pick(a.best, b.best, Math.min),
    points: pick(a.points, b.points, Math.max),
    cleared: pick(a.cleared, b.cleared, Math.max),
    earned: pick(a.earned, b.earned, Math.max),
    tpBought: Math.max(a.tpBought || 0, b.tpBought || 0),
    tpUsed: Math.max(a.tpUsed || 0, b.tpUsed || 0),
    frBought: Math.max(a.frBought || 0, b.frBought || 0),
    frUsed: Math.max(a.frUsed || 0, b.frUsed || 0),
    name: newer.name || a.name || b.name || '',
    sound: a.sound,
    updated: Math.max(a.updated || 0, b.updated || 0),
  };
}

async function flush() {
  if (!playerRef || !pending) return;
  const data = pending;
  pending = null;
  try {
    await setDoc(playerRef, { progress: data, updatedAt: serverTimestamp() });
  } catch (e) {
    pending = pending || data; // 실패하면 다음 저장 때 다시 시도
  }
}

async function currentUser(auth) {
  const user = await new Promise((resolve) => {
    const off = onAuthStateChanged(auth, (u) => { off(); resolve(u); });
  });
  return user || (await signInAnonymously(auth)).user;
}

const scoresOf = (stage) => collection(db, 'levels', String(stage), 'points');

window.cloud = {
  // 시작할 때 한 번: 로그인 → 클라우드 기록과 합치기 → onMerged(합친 결과)
  start(local, onMerged) {
    const config = window.FIREBASE_CONFIG;
    if (!config || !config.apiKey) return;
    ready = (async () => {
      const app = initializeApp(config);
      const user = await currentUser(getAuth(app));
      db = getFirestore(app);
      uid = user.uid;
      playerRef = doc(db, 'players', uid);
    })();
    ready.then(async () => {
      const snap = await getDoc(playerRef);
      const merged = snap.exists() ? merge(local, snap.data().progress || {}) : local;
      onMerged(merged);
      pending = merged;
      await flush();
    }).catch((e) => console.warn('[cloud] 동기화 안 됨:', e.message));
  },

  // 진행 상황이 바뀔 때마다 호출 (잠깐 모았다가 저장)
  save(progress) {
    pending = JSON.parse(JSON.stringify(progress));
    clearTimeout(timer);
    timer = setTimeout(flush, SAVE_DELAY_MS);
  },

  get uid() { return uid; },

  // 기록 올리기 (내 기존 기록보다 좋을 때만 저장). 반환: 내 순위 (1부터) 또는 null
  async submit(stage, { name, score }) {
    try {
      await ready;
      const ref = doc(scoresOf(stage), uid);
      const old = await getDoc(ref);
      const best = old.exists() ? old.data().score : -1;
      if (score > best) {
        await setDoc(ref, { name, score, at: serverTimestamp() });
      }
      return await this.rank(stage, Math.max(score, best));
    } catch (e) {
      console.warn('[cloud] 기록 저장 안 됨:', e.message);
      return null;
    }
  },

  // 이 기록이 몇 등인지 (나보다 좋은 기록 수 + 1)
  async rank(stage, score) {
    try {
      await ready;
      const snap = await getCount(query(scoresOf(stage), where('score', '>', score)));
      return snap.data().count + 1;
    } catch (e) {
      return null;
    }
  },

  // 상위 기록 목록. 반환: [{ uid, name, score }] 또는 null
  async top(stage, n = 10) {
    try {
      await ready;
      const snap = await getDocs(query(scoresOf(stage), orderBy('score', 'desc'), limit(n)));
      return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    } catch (e) {
      console.warn('[cloud] 랭킹 못 불러옴:', e.message);
      return null;
    }
  },

  // 닉네임 바꾸기: 이미 올린 기록들의 이름도 같이 바꿈
  async rename(name, stages) {
    try {
      await ready;
      await Promise.all(stages.map((s) => updateDoc(doc(scoresOf(s), uid), { name }).catch(() => {})));
    } catch (e) { /* 다음에 기록 올릴 때 반영됨 */ }
  },
};
