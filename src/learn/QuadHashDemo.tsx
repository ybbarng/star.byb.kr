"use client";

import { useRef, useState } from "react";
import { calculateHash } from "@/scripts/hash/hash";

// 기하 해싱 데모: 별 넷을 끌면, 가장 먼 두 별 A·B를 (0,0)·(1,1)에 놓도록 옮기고·돌리고·늘린 모습과
// 나머지 두 별의 좌표(지문 네 숫자)를 보여 준다. 숫자는 풀이가 쓰는 calculateHash 그대로다.

type P = [number, number];

const LABELS = ["가", "나", "다", "라"];

export default function QuadHashDemo() {
  const [points, setPoints] = useState<P[]>([
    [60, 180],
    [130, 70],
    [230, 120],
    [270, 210],
  ]);
  const dragging = useRef<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  // 화면 y는 아래로 커지니, 계산에는 위로 커지게 뒤집어 넣는다
  const { labels, hash } = calculateHash(
    points.map((p, i) => ({
      label: LABELS[i],
      vector: [p[0], -p[1]] as P,
    })) as [
      { label: string; vector: P },
      { label: string; vector: P },
      { label: string; vector: P },
      { label: string; vector: P },
    ],
  );
  const byLabel = (l: string) => points[LABELS.indexOf(l)];
  const [A, B] = [byLabel(labels[0]), byLabel(labels[1])];
  const normalized: P[] = [
    [0, 0],
    [1, 1],
    [hash[0], hash[1]],
    [hash[2], hash[3]],
  ];
  // 정규화 평면을 오른쪽 그림 좌표로 (0~1 → 40~200)
  const toBox = ([x, y]: P): P => [40 + x * 160, 210 - y * 160];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-1">
        <div className="text-xs opacity-70">사진 속 별 넷 (끌어 보세요)</div>
        <svg
          ref={svg}
          viewBox="0 0 320 260"
          className="rounded-box w-full touch-none bg-[#0b0f22]"
          onPointerMove={(e) => {
            if (dragging.current === null) return;

            const rect = svg.current!.getBoundingClientRect();
            const p: P = [
              ((e.clientX - rect.left) / rect.width) * 320,
              ((e.clientY - rect.top) / rect.height) * 260,
            ];
            setPoints((ps) =>
              ps.map((q, i) => (i === dragging.current ? p : q)),
            );
          }}
          onPointerUp={() => (dragging.current = null)}
          onPointerLeave={() => (dragging.current = null)}
        >
          <line
            x1={A[0]}
            y1={A[1]}
            x2={B[0]}
            y2={B[1]}
            stroke="#fde68a"
            strokeDasharray="4 3"
          />
          {points.map(([x, y], i) => {
            const role = labels.indexOf(LABELS[i]);

            return (
              <g key={i}>
                <circle
                  cx={x}
                  cy={y}
                  r={11}
                  fill={role < 2 ? "#fde68a" : "#a5b4fc"}
                  className="cursor-grab"
                  onPointerDown={(e) => {
                    dragging.current = i;
                    (e.target as Element).setPointerCapture?.(e.pointerId);
                  }}
                />
                <text x={x + 14} y={y + 4} fontSize="12" fill="white">
                  {["A", "B", "C", "D"][role]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-xs opacity-70">
          가장 먼 A·B를 (0,0)·(1,1)에 놓으면
        </div>
        <svg viewBox="0 0 240 240" className="rounded-box w-full bg-[#0b0f22]">
          <rect
            x="40"
            y="50"
            width="160"
            height="160"
            fill="none"
            stroke="rgba(160,180,255,0.25)"
            strokeDasharray="4 4"
          />
          <line
            x1="40"
            y1="210"
            x2="200"
            y2="50"
            stroke="#fde68a"
            strokeDasharray="4 3"
          />
          {normalized.map((p, i) => {
            const [x, y] = toBox(p);

            return (
              <g key={i}>
                <circle
                  cx={x}
                  cy={y}
                  r={6}
                  fill={i < 2 ? "#fde68a" : "#a5b4fc"}
                />
                <text x={x + 9} y={y + 4} fontSize="11" fill="white">
                  {["A", "B", "C", "D"][i]}
                </text>
              </g>
            );
          })}
          <text x="28" y="226" fontSize="10" fill="white" opacity="0.6">
            (0,0)
          </text>
          <text x="186" y="44" fontSize="10" fill="white" opacity="0.6">
            (1,1)
          </text>
        </svg>
        <div className="font-mono text-sm text-indigo-200">
          지문 ({hash.map((v) => v.toFixed(3)).join(", ")})
        </div>
      </div>
    </div>
  );
}
