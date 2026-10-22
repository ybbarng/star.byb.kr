"use client";

import type { Point2D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { useMemo, useState } from "react";
import { applyHomography, fitHomography2D } from "@/search/utils/homography";
import {
  applySimilarity,
  umeyamaSimilarity2D,
} from "@/search/utils/similarity";
import { mat3Inv } from "@/search/utils/wcs";

// 원근 변환 데모: 사진이 얼마나 비스듬한지(기울기)를 슬라이더로 바꾸고, 짝 몇 개로 맞출지 고른다.
// 닮음 변환(돌리기·키우기·옮기기, 숫자 4개)과 원근 변환(숫자 8개)을 같은 짝으로 맞춰, 사진의 별 40개
// 전부가 얼마나 맞는지 본다. 원근을 쓸지는 미리 재지 않고 solveCore처럼 맞춰 본 뒤 정한다:
//   ① 짝이 8개 이상 ② 지평선이 사진 밖이고 늘어남 비가 2.5 이하 ③ 맞는 별이 늘었을 때만.
// 하늘은 합성이다: 기울기가 0이면 닮음 변환과 같은 사진이 된다.

const W = 480;
const H = 320;
const STARS = 40;
const TOL = 6;
const MIN_PAIRS = 8; // solveCore PERSPECTIVE_MIN_MATCHES
const MAX_RATIO = 2.5; // solveCore MAX_PERSPECTIVE_SCALE_RATIO

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

// 하늘 좌표(접선 평면)에 별을 고르게 뿌린다. 짝으로 쓰는 순서도 섞여 있다
const SKY: Point2D[] = (() => {
  const rand = rngOf(11);

  return Array.from(
    { length: STARS },
    (): Point2D => [(rand() - 0.5) * 2.1, (rand() - 0.5) * 1.4],
  );
})();
const NOISE: Point2D[] = (() => {
  const rand = rngOf(23);

  return SKY.map((): Point2D => [(rand() - 0.5) * 2.5, (rand() - 0.5) * 2.5]);
})();

// 실제 사진: 위로 갈수록 넓어지는 원근(기울기 k). k = 0이면 닮음 변환과 같다
const truthOf = (k: number): Mat3 => [
  [200, 0, W / 2],
  [0, 200, H / 2],
  [0, k, 1],
];

const project = (M: Mat3, p: Point2D, perspective: boolean): Point2D | null =>
  perspective ? applyHomography(M, p) : applySimilarity(M, p);

// 사진 네 모서리에서 원근 항(분모)을 보고 늘어남 비를 잰다 (solveCore isMildPerspective와 같은 식)
const stretchOf = (Hm: Mat3) => {
  const inv = mat3Inv(Hm);
  const ws = [
    [0, 0],
    [W, 0],
    [0, H],
    [W, H],
  ].map(([x, y]) => {
    const q = [0, 1, 2].map((r) => inv[r][0] * x + inv[r][1] * y + inv[r][2]);
    const [u, v] = [q[0] / q[2], q[1] / q[2]];

    return (Hm[2][0] * u + Hm[2][1] * v + Hm[2][2]) / Hm[2][2];
  });
  const [lo, hi] = [Math.min(...ws), Math.max(...ws)];

  return lo > 0 ? (hi / lo) ** 1.5 : Infinity;
};

export default function PerspectiveDemo() {
  const [tilt, setTilt] = useState(15); // 0~30 → k 0~0.3 (30 근처면 너무 비틀려 거부된다)
  const [n, setN] = useState(20);
  const [model, setModel] = useState<"similarity" | "perspective">(
    "similarity",
  );

  const photo = useMemo(() => {
    const T = truthOf(tilt / 100);

    return SKY.map((p, i): Point2D => {
      const q = applyHomography(T, p)!;

      return [q[0] + NOISE[i][0], q[1] + NOISE[i][1]];
    });
  }, [tilt]);

  const fits = useMemo(() => {
    const from = SKY.slice(0, n);
    const to = photo.slice(0, n);
    const similarity = umeyamaSimilarity2D(from, to).matrix;
    const homography = fitHomography2D(from, to);
    const hitsOf = (M: Mat3 | null, perspective: boolean) =>
      M
        ? SKY.filter((p, i) => {
            const q = project(M, p, perspective);

            return (
              q && Math.hypot(q[0] - photo[i][0], q[1] - photo[i][1]) <= TOL
            );
          }).length
        : 0;

    return {
      similarity,
      homography,
      similarityHits: hitsOf(similarity, false),
      homographyHits: hitsOf(homography, true),
      stretch: homography ? stretchOf(homography) : Infinity,
    };
  }, [n, photo]);

  const enough = n >= MIN_PAIRS;
  const mild = fits.stretch <= MAX_RATIO;
  const better = fits.homographyHits > fits.similarityHits;
  const accepted = enough && mild && better;
  const perspective = model === "perspective" && fits.homography !== null;
  const M = perspective ? fits.homography! : fits.similarity;

  // 하늘의 같은 간격 격자를 지금 변환으로 그린다: 닮음이면 바둑판, 원근이면 사다리꼴
  const grid: string[] = [];

  for (let g = -5; g <= 5; g++) {
    for (const vertical of [true, false]) {
      const pts: string[] = [];

      for (let t = -5; t <= 5; t += 0.5) {
        const p: Point2D = vertical ? [g * 0.25, t * 0.2] : [t * 0.25, g * 0.2];
        const q = project(M, p, perspective);

        if (q) pts.push(`${q[0].toFixed(1)},${q[1].toFixed(1)}`);
      }

      grid.push(pts.join(" "));
    }
  }

  const check = (ok: boolean, text: string) => (
    <li className={ok ? "text-green-400" : "text-red-400"}>
      {ok ? "✓" : "✗"} {text}
    </li>
  );

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_17rem]">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="rounded-box w-full bg-[#0b0f22]"
      >
        {grid.map((pts, i) => (
          <polyline
            key={i}
            points={pts}
            fill="none"
            stroke="rgba(147,197,253,0.3)"
          />
        ))}
        {SKY.map((p, i) => {
          const q = project(M, p, perspective);

          return (
            q && (
              <line
                key={`l${i}`}
                x1={photo[i][0]}
                y1={photo[i][1]}
                x2={q[0]}
                y2={q[1]}
                stroke="#f87171"
                strokeWidth="2"
              />
            )
          );
        })}
        {photo.map(([x, y], i) => (
          <g key={`p${i}`}>
            {i < n && (
              <circle
                cx={x}
                cy={y}
                r="10"
                fill="none"
                stroke="#4ade80"
                strokeWidth="2"
              />
            )}
            <circle cx={x} cy={y} r="5" fill="white" stroke="rgba(0,0,0,0.6)" />
          </g>
        ))}
        {SKY.map((p, i) => {
          const q = project(M, p, perspective);

          return (
            q && (
              <circle
                key={`m${i}`}
                cx={q[0]}
                cy={q[1]}
                r="4"
                fill="#fde047"
                stroke="rgba(0,0,0,0.6)"
              />
            )
          );
        })}
      </svg>
      <div className="flex flex-col gap-3 text-base">
        <label className="flex flex-col gap-1 text-sm">
          <span>
            사진의 기울기 <b>{tilt === 0 ? "없음" : tilt}</b>
          </span>
          <input
            type="range"
            min={0}
            max={30}
            value={tilt}
            className="range range-sm"
            onChange={(e) => setTilt(Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>
            맞추는 데 쓰는 짝 <b>{n}개</b>
          </span>
          <input
            type="range"
            min={4}
            max={STARS}
            value={n}
            className="range range-sm"
            onChange={(e) => setN(Number(e.target.value))}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            className={`btn btn-sm ${model === "similarity" ? "btn-primary" : ""}`}
            onClick={() => setModel("similarity")}
          >
            닮음 변환
          </button>
          <button
            className={`btn btn-sm ${model === "perspective" ? "btn-primary" : ""}`}
            onClick={() => setModel("perspective")}
          >
            원근 변환
          </button>
        </div>
        <div className="bg-base-300/60 rounded-box flex flex-col gap-1 p-3 text-sm">
          <div>
            맞는 별 (40개 중): 닮음 <b>{fits.similarityHits}</b> · 원근{" "}
            <b>{fits.homographyHits}</b>
          </div>
          <ul className="flex flex-col gap-0.5">
            {check(enough, `짝 ${MIN_PAIRS}개 이상 (${n}개)`)}
            {check(
              mild,
              `늘어남 비 ${Number.isFinite(fits.stretch) ? fits.stretch.toFixed(2) : "∞"} ≤ ${MAX_RATIO}`,
            )}
            {check(better, "원근 변환으로 맞는 별이 늘었다")}
          </ul>
          <div className={`font-bold ${accepted ? "text-green-400" : ""}`}>
            → {accepted ? "원근 변환을 쓴다" : "닮음 변환 그대로"}
          </div>
        </div>
        <ul className="flex flex-col gap-1 text-sm">
          <li>
            <span className="text-white">●</span> 사진의 별 ·{" "}
            <span className="text-yellow-300">●</span> 배치한 지도 별 ·{" "}
            <span className="text-red-400">━</span> 어긋남
          </li>
          <li>
            <span className="text-green-400">◯</span> 맞추는 데 쓴 짝 ·{" "}
            <span className="text-blue-300">▦</span> 하늘의 같은 간격 격자
          </li>
        </ul>
      </div>
    </div>
  );
}
