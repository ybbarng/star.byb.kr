"use client";

import { useSyncExternalStore } from "react";

// 효과음: 소리 파일 없이 Web Audio로 그때그때 합성한다 (받을 파일이 없고, 음 높이를 바꾸기 쉽다).
// 소리 끄기는 이 브라우저에만 기억한다 (저장이 막혀 있어도 게임은 그대로 된다).

const MUTE_KEY = "star-games-muted";

let audio: AudioContext | null = null;
let muted = false;
let loaded = false;
const listeners = new Set<() => void>();

const loadMuted = () => {
  if (!loaded) {
    loaded = true;

    try {
      muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      muted = false;
    }
  }

  return muted;
};

export const setMuted = (m: boolean) => {
  muted = m;

  try {
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {
    // 저장이 막혀 있으면 이번 방문 동안만 기억한다
  }

  listeners.forEach((l) => l());
};

export const useMuted = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);

      return () => listeners.delete(l);
    },
    loadMuted,
    () => false,
  );

const context = () => {
  if (typeof window === "undefined" || loadMuted()) {
    return null;
  }

  audio ??= new AudioContext();

  if (audio.state === "suspended") {
    void audio.resume();
  }

  return audio;
};

interface ToneOptions {
  type?: OscillatorType;
  gain?: number;
  slideTo?: number; // 끝날 때 이 주파수로 미끄러진다
}

// 음 하나: 짧게 올라갔다가 부드럽게 줄어드는 소리
const tone = (
  freq: number,
  delay: number,
  duration: number,
  { type = "sine", gain = 0.12, slideTo }: ToneOptions = {},
) => {
  const ac = context();

  if (!ac) {
    return;
  }

  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);

  if (slideTo) {
    osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
  }

  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(env).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
};

// 반음 n개 위의 주파수
const semitone = (base: number, n: number) => base * 2 ** (n / 12);

export const sfx = {
  // 버튼·점 찍기
  tap: () => tone(700, 0, 0.07, { type: "triangle", gain: 0.06 }),
  // 별이 반짝: step이 오를수록 높은 음 (연달아 맞힐 때 음이 올라간다)
  twinkle: (step = 0) => {
    const f = semitone(880, (step % 12) * 2);
    tone(f, 0, 0.35, { gain: 0.07 });
    tone(f * 1.5, 0.05, 0.3, { gain: 0.04 });
  },
  // 맞혔다: 위로 올라가는 화음
  hit: () =>
    [0, 4, 7, 12].forEach((n, i) =>
      tone(semitone(523, n), i * 0.07, 0.35, { type: "triangle", gain: 0.1 }),
    ),
  // 틀렸다: 낮게 미끄러지는 소리
  miss: () => tone(220, 0, 0.3, { type: "sawtooth", gain: 0.06, slideTo: 110 }),
  // 다음으로 넘어갈 때 휙
  whoosh: () => tone(300, 0, 0.35, { gain: 0.05, slideTo: 1200 }),
  // 시간이 흐르는 째깍
  tick: () => tone(1500, 0, 0.03, { type: "square", gain: 0.015 }),
  // 다 끝났다: 짧은 팡파르
  win: () =>
    (
      [
        [0, 0],
        [4, 0.12],
        [7, 0.24],
        [12, 0.36],
        [7, 0.5],
        [12, 0.62],
      ] as const
    ).forEach(([n, d]) =>
      tone(semitone(523, n), d, 0.4, { type: "triangle", gain: 0.1 }),
    ),
  // 놓쳤다: 내려가는 음
  lose: () =>
    [7, 4, 0].forEach((n, i) =>
      tone(semitone(392, n), i * 0.15, 0.35, { type: "triangle", gain: 0.08 }),
    ),
};
