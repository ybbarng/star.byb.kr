import type { Syzygy } from "@/game/eclipse/eclipse";
import type { EclipseRecord } from "@/game/eclipse/eclipseList";
import { dayOfIso } from "@/game/eclipse/eclipse";
import { eclipsesOf, YEARS } from "@/game/eclipse/eclipseList";
import { createRng } from "@/utils/rng";

// 식 예측하기 (src/game/eclipse): 한 해 달력에서 식이 일어날 날을 고르고, 실제 NASA 목록과 맞춰 본다.
// 입문: 삭·망 표시 + 식이 날 수 있는 황위 띠 / 보통: 삭·망 표시만 / 어려움: 달 밝기 그래프만 보고 날짜를 직접 고른다.

export type EclipseDifficulty = "intro" | "normal" | "hard";

export interface EclipseSettings {
  markers: boolean; // 삭·망 자리를 표시하고 그 자리만 고른다
  band: boolean; // 황위 ±1°·±1.6° 띠
}

export const ECLIPSE_SETTINGS: Record<EclipseDifficulty, EclipseSettings> = {
  intro: { markers: true, band: true },
  normal: { markers: true, band: false },
  hard: { markers: false, band: false },
};

export const ROUNDS = 3;
export const ROUND_MAX = 1000;
export const DAY_TOLERANCE = 1; // 실제 식 날짜(세계시)와 하루 차이까지 맞은 것으로

export type EclipseKind = "solar" | "lunar";

export interface Pick {
  kind: EclipseKind;
  day: number; // 그해 몇 번째 날
}

// 서로 다른 해 ROUNDS개 (같은 시드 = 같은 해들)
export const pickYears = (seed: number, count = ROUNDS): number[] => {
  const rng = createRng(seed);
  const pool = [...YEARS];
  const out: number[] = [];

  while (out.length < count && pool.length > 0) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }

  return out;
};

// 삭이면 일식, 망이면 월식
export const kindOfSyzygy = (s: Syzygy): EclipseKind =>
  s.kind === "new" ? "solar" : "lunar";

export interface ScoredPick extends Pick {
  hit: EclipseRecord | null;
}

export interface EclipseScore {
  picks: ScoredPick[];
  hits: number;
  falses: number;
  missed: EclipseRecord[];
  actual: EclipseRecord[];
  points: number;
}

// 맞힌 식 하나마다 1000/식 수, 없는 식을 고르면 그 절반을 뺀다 (0점 아래로는 안 간다).
// 한 식은 한 번만 맞힌 것으로 센다
export const scoreYear = (year: number, picks: Pick[]): EclipseScore => {
  const actual = eclipsesOf(year);
  const used = new Set<EclipseRecord>();
  const scored: ScoredPick[] = [...picks]
    .sort((a, b) => a.day - b.day)
    .map((p) => {
      const hit =
        actual.find(
          (e) =>
            !used.has(e) &&
            e.kind === p.kind &&
            Math.abs(dayOfIso(e.date) - p.day) <= DAY_TOLERANCE,
        ) ?? null;

      if (hit) {
        used.add(hit);
      }

      return { ...p, hit };
    });
  const hits = used.size;
  const falses = scored.length - hits;
  const unit = ROUND_MAX / Math.max(1, actual.length);

  return {
    picks: scored,
    hits,
    falses,
    missed: actual.filter((e) => !used.has(e)),
    actual,
    points: Math.max(0, Math.round(unit * hits - (unit / 2) * falses)),
  };
};

// 같은 날 같은 종류를 다시 고르면 지우고, 아니면 더한다 (어려움에서는 하루 차이도 같은 것으로)
export const togglePick = (picks: Pick[], p: Pick): Pick[] => {
  const same = picks.findIndex(
    (q) => q.kind === p.kind && Math.abs(q.day - p.day) <= DAY_TOLERANCE,
  );

  return same >= 0 ? picks.filter((_, i) => i !== same) : [...picks, p];
};

export const starsOf = (total: number, rounds = ROUNDS) =>
  total >= rounds * 800 ? 3 : total >= rounds * 500 ? 2 : total > 0 ? 1 : 0;

export const bestKey = (d: EclipseDifficulty) => `eclipse-${d}`;
