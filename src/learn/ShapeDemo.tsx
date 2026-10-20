"use client";

import { useState } from "react";

// 모양 값 데모: 별 셋의 삼각형을 돌리고 키워도 (짧은 변 ÷ 긴 변, 중간 변 ÷ 긴 변)은 그대로다.
// 풀이(search/catalogGeometry.ts의 triangleShape)가 쓰는 것과 같은 모양 값이다.

// 기준 삼각형 (북두칠성 국자 머리 세 별과 비슷한 비율)
const BASE: [number, number][] = [
  [-55, -30],
  [-45, 35],
  [60, 20],
];

const dist = (a: [number, number], b: [number, number]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);

export default function ShapeDemo() {
  const [angle, setAngle] = useState(30);
  const [scale, setScale] = useState(1);
  const rad = (angle * Math.PI) / 180;
  const points = BASE.map(([x, y]): [number, number] => [
    160 + scale * (x * Math.cos(rad) - y * Math.sin(rad)),
    110 + scale * (x * Math.sin(rad) + y * Math.cos(rad)),
  ]);
  const sides = [
    dist(points[1], points[2]),
    dist(points[0], points[2]),
    dist(points[0], points[1]),
  ].sort((a, b) => a - b);
  const shape = [sides[0] / sides[2], sides[1] / sides[2]];

  return (
    <div className="flex flex-col gap-3">
      <svg viewBox="0 0 320 220" className="mx-auto w-full max-w-md">
        <polygon
          points={points.map((p) => p.join(",")).join(" ")}
          fill="rgba(165,180,252,0.12)"
          stroke="#a5b4fc"
          strokeWidth="1.5"
        />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={4} fill="white" />
        ))}
      </svg>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          돌리기 {angle}°
          <input
            type="range"
            className="range range-xs"
            min={0}
            max={360}
            value={angle}
            onChange={(e) => setAngle(Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          크기 ×{scale.toFixed(2)}
          <input
            type="range"
            className="range range-xs"
            min={0.4}
            max={1.6}
            step={0.01}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="bg-base-300/60 rounded-box p-3">
          <div className="text-xs opacity-60">변 길이 (화면 픽셀)</div>
          <div className="font-mono text-sm">
            {sides.map((s) => s.toFixed(0)).join(" · ")}
          </div>
        </div>
        <div className="bg-base-300/60 rounded-box p-3">
          <div className="text-xs opacity-60">모양 값 (짧은÷긴, 중간÷긴)</div>
          <div className="font-mono text-sm text-indigo-200">
            ({shape[0].toFixed(3)}, {shape[1].toFixed(3)})
          </div>
        </div>
      </div>
    </div>
  );
}
