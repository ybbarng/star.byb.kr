"use client";

import type { Point2D } from "@/scripts/hash/types";
import { useRef } from "react";
import { cn } from "@/utils/cn";

// 별 넷 지문 맞추기의 그림 두 가지: 별 넷 모양(ShapeView)과 지문 좌표판(FingerprintBoard).
// 둘 다 y가 위인 좌표를 받아 화면(y가 아래)으로 뒤집어 그린다.

const AXIS_COLOR = "#fde68a";
const REST_COLOR = "#a5b4fc";
const ROLE_NAMES = ["A", "B", "C", "D"];

export interface ShapeViewProps {
  points: Point2D[]; // 가장 먼 두 별 거리가 1
  size?: number; // 1이 기본
  mags: number[];
  roles?: number[]; // points[i]가 A·B·C·D 중 무엇인가 (0~3). 주면 이름표와 축을 그린다
  showRest?: boolean; // roles가 있을 때 C·D 이름표도
  className?: string;
}

// 별 넷 모양. 밝은 별일수록 크게
export function ShapeView({
  points,
  size = 1,
  mags,
  roles,
  showRest = true,
  className,
}: ShapeViewProps) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const k = 150 * size;
  const at = ([x, y]: Point2D): Point2D => [
    100 + (x - cx) * k,
    100 - (y - cy) * k,
  ];
  const screen = points.map(at);
  const axis = roles
    ? [roles.indexOf(0), roles.indexOf(1)].map((i) => screen[i])
    : null;

  return (
    <svg
      viewBox="0 0 200 200"
      className={cn("rounded-box w-full bg-[#0b0f22]", className)}
    >
      {axis && (
        <line
          x1={axis[0][0]}
          y1={axis[0][1]}
          x2={axis[1][0]}
          y2={axis[1][1]}
          stroke={AXIS_COLOR}
          strokeOpacity={0.7}
          strokeDasharray="4 3"
        />
      )}
      {screen.map(([x, y], i) => {
        const r = Math.max(2.2, 2 + (4 - mags[i]) * 1.4);
        const role = roles?.[i];

        return (
          <g key={i}>
            <circle cx={x} cy={y} r={r * 2.6} fill="white" opacity={0.08} />
            <circle
              cx={x}
              cy={y}
              r={r}
              fill={
                role === undefined
                  ? "white"
                  : role < 2
                    ? AXIS_COLOR
                    : REST_COLOR
              }
            />
            {role !== undefined && (role < 2 || showRest) && (
              <text
                x={x + r + 4}
                y={y + 4}
                fontSize="12"
                fontWeight="bold"
                fill={role < 2 ? AXIS_COLOR : REST_COLOR}
              >
                {ROLE_NAMES[role]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export interface BoardMark {
  p: Point2D;
  color: string;
  label?: string;
  faint?: boolean;
}

// 좌표판 범위: -0.5~1.5 (C·D가 올 수 있는 렌즈는 -0.41~1.41)
const LO = -0.5;
const SPAN = 2;
const PX = 260;

export const toBoard = ([x, y]: Point2D): Point2D => [
  ((x - LO) / SPAN) * PX,
  PX - ((y - LO) / SPAN) * PX,
];

const fromBoard = (sx: number, sy: number): Point2D => [
  LO + (sx / PX) * SPAN,
  LO + ((PX - sy) / PX) * SPAN,
];

// 렌즈의 두 끝 ((0.5∓√0.75, 0.5±√0.75))과 반지름 √2 (QuadHashDemo와 같은 그림)
const LENS_ENDS = [
  toBoard([0.5 - Math.sqrt(0.75), 0.5 + Math.sqrt(0.75)]),
  toBoard([0.5 + Math.sqrt(0.75), 0.5 - Math.sqrt(0.75)]),
];
const LENS_R = (Math.SQRT2 / SPAN) * PX;

/**
 * 지문 좌표판: A(0,0)·B(1,1)과 축, C·D가 올 수 있는 렌즈. onTap을 주면 누른 자리(좌표판 좌표)를 알려 준다.
 * grid: 0.25 간격 눈금 (입문·쉬움)
 */
export function FingerprintBoard({
  marks,
  grid = false,
  onTap,
  lines = [],
}: {
  marks: BoardMark[];
  grid?: boolean;
  onTap?: (p: Point2D) => void;
  lines?: [Point2D, Point2D][]; // 내가 찍은 점 → 정답 같은 잇는 선
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [a, b] = [toBoard([0, 0]), toBoard([1, 1])];
  const ticks = [-0.25, 0, 0.25, 0.5, 0.75, 1, 1.25];

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${PX} ${PX}`}
      className={cn(
        "rounded-box w-full touch-manipulation bg-[#0b0f22] select-none",
        onTap && "cursor-crosshair",
      )}
      onPointerDown={(e) => {
        if (!onTap) {
          return;
        }

        const rect = svg.current!.getBoundingClientRect();
        onTap(
          fromBoard(
            ((e.clientX - rect.left) / rect.width) * PX,
            ((e.clientY - rect.top) / rect.height) * PX,
          ),
        );
      }}
    >
      <path
        d={`M ${LENS_ENDS[0].join(" ")} A ${LENS_R} ${LENS_R} 0 0 1 ${LENS_ENDS[1].join(" ")} A ${LENS_R} ${LENS_R} 0 0 1 ${LENS_ENDS[0].join(" ")} Z`}
        fill="rgba(165,180,252,0.07)"
        stroke="rgba(165,180,252,0.25)"
      />
      {grid &&
        ticks.map((t) => {
          const [x] = toBoard([t, 0]);
          const [, y] = toBoard([0, t]);

          return (
            <g key={t} stroke="rgba(255,255,255,0.1)">
              <line x1={x} y1={0} x2={x} y2={PX} />
              <line x1={0} y1={y} x2={PX} y2={y} />
            </g>
          );
        })}
      {grid &&
        [0, 0.5, 1].map((t) => (
          <g key={t} fontSize="9" fill="white" opacity={0.45}>
            <text x={toBoard([t, 0])[0] - 6} y={PX - 4}>
              {t}
            </text>
            <text x={3} y={toBoard([0, t])[1] + 3}>
              {t}
            </text>
          </g>
        ))}
      {/* x·y 축 */}
      <path
        d={`M 0 ${a[1]} L ${PX} ${a[1]} M ${a[0]} ${PX} L ${a[0]} 0`}
        stroke="rgba(255,255,255,0.3)"
      />
      <line
        x1={a[0]}
        y1={a[1]}
        x2={b[0]}
        y2={b[1]}
        stroke={AXIS_COLOR}
        strokeOpacity={0.7}
        strokeDasharray="4 3"
      />
      {lines.map(([p, q], i) => {
        const [s, t] = [toBoard(p), toBoard(q)];

        return (
          <line
            key={i}
            x1={s[0]}
            y1={s[1]}
            x2={t[0]}
            y2={t[1]}
            stroke="rgba(255,255,255,0.45)"
            strokeDasharray="2 3"
          />
        );
      })}
      {[a, b].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={5} fill={AXIS_COLOR} />
          <text
            x={x + (i ? -34 : 7)}
            y={y + (i ? -8 : 14)}
            fontSize="10"
            fill={AXIS_COLOR}
          >
            {i ? "B (1,1)" : "A (0,0)"}
          </text>
        </g>
      ))}
      {marks.map((m, i) => {
        const [x, y] = toBoard(m.p);

        return (
          <g key={i} opacity={m.faint ? 0.45 : 1}>
            <circle cx={x} cy={y} r={11} fill={m.color} opacity={0.15} />
            <circle cx={x} cy={y} r={5} fill={m.color} />
            {m.label && (
              <text
                x={x + 8}
                y={y - 6}
                fontSize="11"
                fontWeight="bold"
                fill={m.color}
              >
                {m.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export const formatPoint = ([x, y]: Point2D) =>
  `(${x.toFixed(2)}, ${y.toFixed(2)})`;
