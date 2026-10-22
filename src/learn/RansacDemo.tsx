"use client";

import type { Point2D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { useMemo, useState } from "react";
import {
  applySimilarity,
  umeyamaSimilarity2D,
} from "@/search/utils/similarity";

// RANSAC 데모: 별 지도와 사진 별을 이은 짝 20쌍 중 6쌍이 가짜다(우연히 근처에 있던 다른 별·불빛).
// "전부로 평균내기"는 가짜에 끌려가 진짜 짝까지 어긋난다. "2쌍 뽑기"는 짝 2쌍으로 변환을 만들고
// 나머지 짝에게 맞는지 물어 찬성을 센다. 여러 번 뽑아 찬성이 가장 많은 변환을 남기고, 찬성한 짝으로만
// 다시 평균내면 가짜가 빠진다 — solveCore의 RANSAC과 같은 순서다(2쌍씩, 허용 거리 안이면 찬성).
// 하늘은 합성이다: 정답 변환으로 진짜 짝을 만들고, 가짜 짝은 사진 위의 엉뚱한 자리와 잇는다.

const W = 480;
const H = 320;
const TRUE_PAIRS = 14;
const FAKE_PAIRS = 6;
const TOL = 8; // 이 안이면 "맞는다"(찬성)
const ROUNDS = 200;

interface Pair {
  sky: Point2D; // 별 지도 좌표 (접선 평면)
  photo: Point2D; // 사진에서 찾은 별
  fake: boolean;
}

interface Round {
  picked: [number, number];
  agree: number[];
}

// 결정적 난수 (solveCore와 같은 mulberry32)
const rngOf = (seed: number) => {
  let a = seed >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// 정답 변환(하늘 → 사진)으로 진짜 짝을, 엉뚱한 자리와 이어 가짜 짝을 만든다
const makeSky = (seed: number): Pair[] => {
  const rand = rngOf(seed);
  const angle = (rand() - 0.5) * 1.2;
  const scale = 0.8 + rand() * 0.4;
  const [cos, sin] = [Math.cos(angle) * scale, Math.sin(angle) * scale];
  const inside = (): Point2D => [
    30 + rand() * (W - 60),
    30 + rand() * (H - 60),
  ];

  // 사진 위치에서 하늘 좌표로 (정답 변환의 역)
  const toSky = ([x, y]: Point2D): Point2D => {
    const [dx, dy] = [x - W / 2, y - H / 2];

    return [
      (cos * dx + sin * dy) / (scale * scale),
      (-sin * dx + cos * dy) / (scale * scale),
    ];
  };

  const pairs: Pair[] = [];

  for (let i = 0; i < TRUE_PAIRS; i++) {
    const at = inside();
    // 별 위치에는 1~2px 오차가 있다
    const noisy: Point2D = [
      at[0] + (rand() - 0.5) * 3,
      at[1] + (rand() - 0.5) * 3,
    ];
    pairs.push({ sky: toSky(at), photo: noisy, fake: false });
  }

  for (let i = 0; i < FAKE_PAIRS; i++) {
    const at = inside();
    let other = inside();

    while (Math.hypot(other[0] - at[0], other[1] - at[1]) < 60)
      other = inside();

    pairs.push({ sky: toSky(at), photo: other, fake: true });
  }

  // 진짜·가짜가 번호로 드러나지 않게 섞는다
  return pairs
    .map((p) => ({ p, k: rand() }))
    .sort((a, b) => a.k - b.k)
    .map(({ p }) => p);
};

const fit = (pairs: Pair[], use: number[]): Mat3 =>
  umeyamaSimilarity2D(
    use.map((i) => pairs[i].sky),
    use.map((i) => pairs[i].photo),
  ).matrix;

const missOf = (M: Mat3, p: Pair) => {
  const [x, y] = applySimilarity(M, p.sky);

  return Math.hypot(x - p.photo[0], y - p.photo[1]);
};

const agreeOf = (M: Mat3, pairs: Pair[]) =>
  pairs.map((p, i) => (missOf(M, p) <= TOL ? i : -1)).filter((i) => i >= 0);

type View =
  | { kind: "start" }
  | { kind: "average" }
  | { kind: "pick"; round: Round }
  | { kind: "final"; best: Round };

export default function RansacDemo() {
  const [seed, setSeed] = useState(7);
  const [view, setView] = useState<View>({ kind: "start" });
  const [rounds, setRounds] = useState<Round[]>([]);
  const [truth, setTruth] = useState(false);
  const pairs = useMemo(() => makeSky(seed), [seed]);
  const all = useMemo(() => pairs.map((_, i) => i), [pairs]);
  const rand = useMemo(() => rngOf(seed * 31 + 1), [seed]);

  const pickOnce = (): Round => {
    const a = Math.floor(rand() * pairs.length);
    let b = Math.floor(rand() * pairs.length);

    if (b === a) b = (b + 1) % pairs.length;

    return { picked: [a, b], agree: agreeOf(fit(pairs, [a, b]), pairs) };
  };

  const pick = () => {
    const round = pickOnce();
    setRounds((r) => [...r, round]);
    setView({ kind: "pick", round });
  };

  const runAll = () => {
    const more = Array.from({ length: ROUNDS - rounds.length }, pickOnce);
    const done = [...rounds, ...more];
    const best = done.reduce((a, b) =>
      b.agree.length > a.agree.length ? b : a,
    );
    setRounds(done);
    setView({ kind: "final", best });
  };

  const reset = (next: number) => {
    setSeed(next);
    setRounds([]);
    setView({ kind: "start" });
  };

  // 지금 화면의 변환: 평균이면 전부로, 뽑기면 뽑은 2쌍으로, 끝이면 찬성한 짝으로만 다시 맞춘다
  const M: Mat3 | null =
    view.kind === "average"
      ? fit(pairs, all)
      : view.kind === "pick"
        ? fit(pairs, view.round.picked)
        : view.kind === "final"
          ? fit(pairs, view.best.agree)
          : null;
  const agree = M ? agreeOf(M, pairs) : [];
  const picked: number[] = view.kind === "pick" ? view.round.picked : [];
  const realMiss = M
    ? pairs.filter((p) => !p.fake).reduce((s, p) => s + missOf(M, p), 0) /
      TRUE_PAIRS
    : null;
  const pickedFake = picked.some((i) => pairs[i].fake);

  const note =
    view.kind === "start"
      ? "사진 별(흰 점)마다 별 지도의 짝이 하나씩 있어요. 이 중 6쌍은 가짜예요. 어느 것이 가짜인지는 모르는 채로 변환을 찾아야 해요."
      : view.kind === "average"
        ? "짝 20쌍 전부로 평균냈어요. 가짜 6쌍이 변환을 자기 쪽으로 끌어당겨 진짜 짝까지 어긋나요."
        : view.kind === "pick"
          ? pickedFake && truth
            ? "가짜가 섞인 2쌍으로 만든 변환이라 엉뚱해요. 찬성하는 짝이 거의 없어요."
            : "뽑은 2쌍(빨간 원)으로 변환을 만들고, 나머지 짝에게 맞는지 물었어요. 초록 원이 찬성한 짝이에요."
          : `${ROUNDS}번 뽑아 찬성이 가장 많았던 변환을 고르고, 찬성한 ${view.best.agree.length}쌍으로만 다시 평균냈어요. 가짜는 투표에서 저절로 빠져요.`;

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_17rem]">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="rounded-box w-full bg-[#0b0f22]"
      >
        {M &&
          pairs.map((p, i) => {
            const [x, y] = applySimilarity(M, p.sky);

            return (
              <line
                key={`l${i}`}
                x1={p.photo[0]}
                y1={p.photo[1]}
                x2={x}
                y2={y}
                stroke="#f87171"
                strokeWidth="2"
              />
            );
          })}
        {pairs.map((p, i) => (
          <g key={`p${i}`}>
            {agree.includes(i) && !picked.includes(i) && (
              <circle
                cx={p.photo[0]}
                cy={p.photo[1]}
                r="11"
                fill="none"
                stroke="#4ade80"
                strokeWidth="2.5"
              />
            )}
            {picked.includes(i) && (
              <circle
                cx={p.photo[0]}
                cy={p.photo[1]}
                r="12"
                fill="none"
                stroke="#ef4444"
                strokeWidth="3"
              />
            )}
            <circle
              cx={p.photo[0]}
              cy={p.photo[1]}
              r="5"
              fill={truth && p.fake ? "none" : "white"}
              stroke={truth && p.fake ? "#fb923c" : "rgba(0,0,0,0.6)"}
              strokeWidth={truth && p.fake ? 2.5 : 1}
            />
          </g>
        ))}
        {M &&
          pairs.map((p, i) => {
            const [x, y] = applySimilarity(M, p.sky);

            return (
              <circle
                key={`m${i}`}
                cx={x}
                cy={y}
                r="4"
                fill="#fde047"
                stroke="rgba(0,0,0,0.6)"
              />
            );
          })}
      </svg>
      <div className="flex flex-col gap-3 text-base">
        <div className="grid grid-cols-2 gap-2">
          <button
            className={`btn btn-sm ${view.kind === "average" ? "btn-primary" : ""}`}
            onClick={() => setView({ kind: "average" })}
          >
            전부로 평균내기
          </button>
          <button
            className={`btn btn-sm ${view.kind === "pick" ? "btn-primary" : ""}`}
            onClick={pick}
          >
            2쌍 뽑기
          </button>
          <button
            className={`btn btn-sm ${view.kind === "final" ? "btn-primary" : ""}`}
            onClick={runAll}
          >
            {ROUNDS}번 뽑기
          </button>
          <button className="btn btn-sm" onClick={() => reset(seed + 1)}>
            새 하늘
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={truth}
            onChange={(e) => setTruth(e.target.checked)}
          />
          가짜 짝 보기 <span className="text-orange-400">◯</span>
        </label>
        <div className="text-sm opacity-80">{note}</div>
        {M && (
          <div className="bg-base-300/60 rounded-box flex flex-col gap-1 p-3">
            <div>
              찬성한 짝 <b className="text-lg">{agree.length}</b> /{" "}
              {pairs.length}
            </div>
            <div className="text-sm opacity-80">
              진짜 짝의 평균 어긋남 <b>{realMiss?.toFixed(1)}px</b>
            </div>
          </div>
        )}
        {rounds.length > 0 && (
          <div className="text-sm opacity-80">
            뽑은 횟수 {rounds.length} · 지금까지 가장 많은 찬성{" "}
            {Math.max(...rounds.map((r) => r.agree.length))}
          </div>
        )}
        <ul className="flex flex-col gap-1 text-sm">
          <li>
            <span className="text-white">●</span> 사진의 별 ·{" "}
            <span className="text-yellow-300">●</span> 변환으로 배치한 지도 별
          </li>
          <li>
            <span className="text-red-400">━</span> 어긋남 ·{" "}
            <span className="text-red-500">◯</span> 뽑은 2쌍 ·{" "}
            <span className="text-green-400">◯</span> 찬성한 짝
          </li>
        </ul>
      </div>
    </div>
  );
}
