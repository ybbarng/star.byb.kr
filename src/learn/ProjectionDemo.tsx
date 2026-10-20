"use client";

import { useState } from "react";

// 렌즈가 하늘을 사진에 담는 방식 비교: 보통 렌즈(직선투영, r = f·tanθ)와 어안 렌즈(등거리, r = f·θ).
// 같은 화각으로 하늘의 10° 격자와 작은 삼각형 두 개(가운데·가장자리)를 그린다.
// 화각이 넓어질수록 직선투영은 가장자리를 크게 늘리고, 어안은 고르게 담는 대신 직선을 휜다.
// 작은 삼각형은 어느 쪽이든 모양이 거의 그대로다 — 작은 패턴으로 찾는 이유다.

const SIZE = 220;
const D = Math.PI / 180;

type Kind = "rect" | "fisheye";

// 광축에서 θ 떨어지고 방위 φ인 방향 → 화면 좌표 (화각의 절반이 화면 반지름)
const project = (kind: Kind, thetaDeg: number, phi: number, fovDeg: number) => {
  const half = (fovDeg / 2) * D;
  const t = thetaDeg * D;
  const r =
    kind === "rect"
      ? t >= Math.PI / 2 - 0.01
        ? Infinity
        : Math.tan(t) / Math.tan(half)
      : t / half;
  const R = SIZE / 2 - 6;

  return {
    x: SIZE / 2 + r * R * Math.cos(phi),
    y: SIZE / 2 + r * R * Math.sin(phi),
    r,
  };
};

// 하늘의 방향(광축 기준 x·y 각, 작은 영역) → (θ, φ)
const toPolar = (ax: number, ay: number) => {
  // 광축 = z, 방향 벡터
  const v = [
    Math.sin(ax * D) * Math.cos(ay * D),
    Math.sin(ay * D),
    Math.cos(ax * D) * Math.cos(ay * D),
  ];

  return {
    theta: Math.acos(Math.min(1, v[2])) / D,
    phi: Math.atan2(v[1], v[0]),
  };
};

function Panel({ kind, fov }: { kind: Kind; fov: number }) {
  const lines: string[] = [];

  // 하늘의 '가로·세로' 격자 (10°마다). 둘 다 큰원이라 직선투영에서는 곧은 선이 된다.
  // 가로선은 세로선 묶음을 광축 둘레로 90° 돌린 것이다.
  for (let g = -80; g <= 80; g += 10) {
    for (const vertical of [false, true]) {
      const pts: string[] = [];

      for (let s = -85; s <= 85; s += 2.5) {
        const { theta, phi } = toPolar(g, s);
        const p = project(kind, theta, vertical ? phi : phi + Math.PI / 2, fov);

        if (p.r < 3) pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
      }

      if (pts.length > 1) lines.push(pts.join(" "));
    }
  }

  // 작은 삼각형: 가운데와 화각의 85% 지점
  const tri = (cx: number) =>
    [
      [cx, 0],
      [cx + 6, 4],
      [cx + 2, -5],
    ]
      .map(([x, y]) => {
        const { theta, phi } = toPolar(x, y);
        const p = project(kind, theta, phi, fov);

        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="rounded-box w-full bg-[#0b0f22]"
    >
      <defs>
        <clipPath id={`clip-${kind}`}>
          <rect x="0" y="0" width={SIZE} height={SIZE} />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip-${kind})`}>
        {lines.map((l, i) => (
          <polyline
            key={i}
            points={l}
            fill="none"
            stroke="rgba(165,180,252,0.45)"
            strokeWidth="0.8"
          />
        ))}
        <polygon
          points={tri(0)}
          fill="rgba(253,230,138,0.5)"
          stroke="#fde68a"
        />
        <polygon
          points={tri(fov * 0.42)}
          fill="rgba(253,230,138,0.5)"
          stroke="#fde68a"
        />
      </g>
    </svg>
  );
}

export default function ProjectionDemo() {
  const [fov, setFov] = useState(100);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-3 text-sm">
        화각 {fov}°
        <input
          type="range"
          className="range range-xs flex-1"
          min={30}
          max={170}
          value={fov}
          onChange={(e) => setFov(Number(e.target.value))}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Panel kind="rect" fov={fov} />
          <div className="text-center text-xs opacity-70">
            보통 렌즈 (직선이 곧다)
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Panel kind="fisheye" fov={fov} />
          <div className="text-center text-xs opacity-70">
            어안 렌즈 (가장자리가 덜 늘어난다)
          </div>
        </div>
      </div>
    </div>
  );
}
