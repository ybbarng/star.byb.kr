"use client";

import { useRef, useState } from "react";
import { calculateHash } from "@/scripts/hash/hash";

// 기하 해싱 데모: ① 별 넷을 끌면, ② 가장 먼 두 별 A·B를 (0,0)·(1,1)에 놓도록 옮기고·돌리고·늘린 모습과
// ③ 나머지 두 별 C·D의 좌표(quad 값 네 숫자)를 차례로 보여 준다. 숫자는 풀이가 쓰는 calculateHash 그대로다.
// 회전·크기 막대는 넷을 한꺼번에 바꿔, 사진을 돌리거나 당겨 찍어도 지문이 그대로인 걸 보여 준다.

type P = [number, number];

const LABELS = ["가", "나", "다", "라"];
const CENTER: P = [160, 130];
// ② 그림에서 C·D가 올 수 있는 렌즈의 두 끝 ((0.5∓√0.75, 0.5±√0.75)를 그림 좌표로)과 반지름 (√2)
const LENS = ["26.1 26.1", "233.9 233.9"];
const LENS_R = 169.7;

// 화면 가운데를 중심으로 돌리고 키운다 (inverse면 거꾸로)
const transform = (
  p: P,
  angleDeg: number,
  scale: number,
  inverse = false,
): P => {
  const t = ((inverse ? -angleDeg : angleDeg) * Math.PI) / 180;
  const k = inverse ? 1 / scale : scale;
  const dx = p[0] - CENTER[0];
  const dy = p[1] - CENTER[1];

  return [
    CENTER[0] + k * (dx * Math.cos(t) - dy * Math.sin(t)),
    CENTER[1] + k * (dx * Math.sin(t) + dy * Math.cos(t)),
  ];
};

export default function QuadHashDemo() {
  const [base, setBase] = useState<P[]>([
    [60, 180],
    [130, 70],
    [230, 120],
    [270, 210],
  ]);
  const [angle, setAngle] = useState(0);
  const [scale, setScale] = useState(1);
  const points = base.map((p) => transform(p, angle, scale));
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
  // 정규화 평면을 가운데 그림 좌표로 (0~1 → 70~190, 상자 밖 -0.58~1.58까지 보인다)
  const toBox = ([x, y]: P): P => [70 + x * 120, 190 - y * 120];
  const [C, D] = [normalized[2], normalized[3]];
  const coord = ([x, y]: P) => `(${x.toFixed(2)}, ${y.toFixed(2)})`;

  return (
    <div className="grid items-start gap-4 md:grid-cols-[1.15fr_1fr_0.75fr]">
      <div className="flex flex-col gap-1">
        <div className="text-sm opacity-70">① 사진 속 별 4개</div>
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
            const q = transform(p, angle, scale, true);
            setBase((ps) => ps.map((r, i) => (i === dragging.current ? q : r)));
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
        <label className="flex items-center gap-2 text-sm">
          <span className="w-16 shrink-0">회전</span>
          <input
            type="range"
            className="range range-xs"
            min={-180}
            max={180}
            value={angle}
            onChange={(e) => setAngle(Number(e.target.value))}
          />
          <span className="w-12 text-right font-mono">{angle}°</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="w-16 shrink-0">크기</span>
          <input
            type="range"
            className="range range-xs"
            min={50}
            max={140}
            value={Math.round(scale * 100)}
            onChange={(e) => setScale(Number(e.target.value) / 100)}
          />
          <span className="w-12 text-right font-mono">×{scale.toFixed(2)}</span>
        </label>
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-sm opacity-70">
          ② 가장 먼 A·B를 (0,0)·(1,1)에 놓으면
        </div>
        <svg viewBox="0 0 260 260" className="rounded-box w-full bg-[#0b0f22]">
          {/* C·D가 올 수 있는 곳: A·B가 가장 먼 쌍이니 A에서도 B에서도 √2 안 (두 원이 겹친 렌즈, -0.41~1.41) */}
          <path
            d={`M ${LENS[0]} A ${LENS_R} ${LENS_R} 0 0 1 ${LENS[1]} A ${LENS_R} ${LENS_R} 0 0 1 ${LENS[0]} Z`}
            fill="rgba(165,180,252,0.08)"
            stroke="rgba(165,180,252,0.3)"
          />
          <path
            d="M 8 190 L 252 190 M 70 252 L 70 8"
            stroke="rgba(255,255,255,0.35)"
          />
          <rect
            x="70"
            y="70"
            width="120"
            height="120"
            fill="none"
            stroke="rgba(160,180,255,0.2)"
            strokeDasharray="4 4"
          />
          <text x="240" y="203" fontSize="10" fill="white" opacity="0.6">
            x
          </text>
          <text x="58" y="16" fontSize="10" fill="white" opacity="0.6">
            y
          </text>
          <text x="118" y="222" fontSize="9" fill="#a5b4fc" opacity="0.8">
            C·D가 올 수 있는 곳
          </text>
          <line
            x1="70"
            y1="190"
            x2="190"
            y2="70"
            stroke="#fde68a"
            strokeDasharray="4 3"
          />
          {/* C·D의 좌표를 읽는 보조선 */}
          {[C, D].map((p, i) => {
            const [x, y] = toBox(p);

            return (
              <path
                key={i}
                d={`M ${x} ${y} L ${x} 190 M ${x} ${y} L 70 ${y}`}
                stroke="rgba(165,180,252,0.45)"
                strokeDasharray="2 3"
                fill="none"
              />
            );
          })}
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
          <text x="56" y="206" fontSize="10" fill="white" opacity="0.6">
            (0,0)
          </text>
          <text x="176" y="62" fontSize="10" fill="white" opacity="0.6">
            (1,1)
          </text>
        </svg>
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-sm opacity-70">③ quad 값 = C·D의 좌표 = 지문</div>
        <div className="bg-base-300/60 rounded-box flex flex-col gap-2 p-3 font-mono">
          <div>
            <span className="text-indigo-300">C</span>{" "}
            <span className="text-lg">{coord(C)}</span>
          </div>
          <div>
            <span className="text-indigo-300">D</span>{" "}
            <span className="text-lg">{coord(D)}</span>
          </div>
          <div className="border-base-content/10 border-t pt-2 text-sm text-indigo-200">
            ({hash.map((v) => v.toFixed(2)).join(", ")})
          </div>
        </div>
        <div className="text-sm opacity-70">
          별 지도에서 미리 계산한 8만 5천 개의 quad 중 가장 가까운 것을 찾으면
          된다.
        </div>
        <div className="text-sm opacity-50">
          Astrometry.net 논문에서 제시한 방식
        </div>
      </div>
    </div>
  );
}
