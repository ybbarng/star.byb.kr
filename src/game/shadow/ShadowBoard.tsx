"use client";

import type { Shadow } from "@/game/shadow/shadow";
import { useMemo } from "react";
import {
  dayLight,
  shadowCurve,
  solarClock,
  sunAt,
  sunDeclinationDeg,
  dayDate,
} from "@/game/shadow/shadow";

// 그림자 시계의 마당: 위에서 내려다본 해시계 막대와 그림자. 북쪽이 위, 막대 높이가 1칸.
// 그림자 끝 곡선(힌트)은 해시계 시각 정각마다 점, 해돋이·해넘이 때 그림자 방향을 점선으로.

const R = 4.6; // 마당 반지름 (막대 길이 단위)
const FONT = 0.3;

const pt = (s: { x: number; y: number }, maxLen = R - 0.15) => {
  const len = Math.hypot(s.x, s.y);
  const k = len > maxLen ? maxLen / len : 1;

  return { x: s.x * k, y: -s.y * k, clipped: len > maxLen };
};

export interface GuessShadows {
  shadow: Shadow | null;
  noonShadow: Shadow | null;
}

export default function ShadowBoard({
  latDeg,
  day,
  shadow,
  noonShadow,
  compass,
  rings,
  curve,
  guess,
}: {
  latDeg: number;
  day: number;
  shadow: Shadow;
  noonShadow: Shadow;
  compass: "full" | "north";
  rings: boolean;
  curve: boolean;
  guess?: GuessShadows | null;
}) {
  const path = useMemo(
    () => (curve ? shadowCurve(latDeg, day, 1 / 6, 2) : []),
    [curve, latDeg, day],
  );
  const edges = useMemo(() => {
    if (!curve) {
      return [];
    }

    const light = dayLight(latDeg, sunDeclinationDeg(dayDate(day)));

    if (light.hours <= 0 || light.hours >= 24) {
      return [];
    }

    return [
      { label: "해돋이", hours: light.sunrise },
      { label: "해넘이", hours: light.sunset },
    ].map((e) => {
      const az = (sunAt(latDeg, day, e.hours).azDeg + 180) * (Math.PI / 180);

      return { ...e, x: Math.sin(az), y: -Math.cos(az) };
    });
  }, [curve, latDeg, day]);

  const tip = pt(shadow);
  const noonTip = pt(noonShadow);
  const segments: string[] = [];
  let current: string[] = [];

  for (const p of path) {
    if (p.shadow.length < R) {
      current.push(`${p.shadow.x.toFixed(3)},${(-p.shadow.y).toFixed(3)}`);
    } else if (current.length) {
      segments.push(current.join(" "));
      current = [];
    }
  }

  if (current.length) {
    segments.push(current.join(" "));
  }

  const hourDots = path.filter(
    (p) =>
      Math.abs(p.hours - Math.round(p.hours)) < 1e-6 && p.shadow.length < R,
  );

  return (
    <svg
      viewBox={`${-R - 0.4} ${-R - 0.4} ${2 * R + 0.8} ${2 * R + 0.8}`}
      className="aspect-square w-full touch-none select-none"
      role="img"
      aria-label="위에서 내려다본 막대와 그림자"
    >
      <defs>
        <radialGradient id="shadow-ground" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#8a7350" />
          <stop offset="70%" stopColor="#5e4c33" />
          <stop offset="100%" stopColor="#3a2f20" />
        </radialGradient>
        <filter id="shadow-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.035" />
        </filter>
      </defs>

      <circle r={R} fill="url(#shadow-ground)" />
      <circle
        r={R}
        fill="none"
        stroke="rgba(255,230,180,0.35)"
        strokeWidth={0.04}
      />

      {rings &&
        [1, 2, 3, 4].map((i) => (
          <g key={i}>
            <circle
              r={i}
              fill="none"
              stroke="rgba(255,240,210,0.22)"
              strokeWidth={0.025}
              strokeDasharray="0.08 0.1"
            />
            <text
              x={i * 0.71 + 0.05}
              y={i * 0.71 + 0.25}
              fontSize={FONT * 0.8}
              fill="rgba(255,240,210,0.6)"
            >
              {i}배
            </text>
          </g>
        ))}

      {/* 방위 */}
      {compass === "full" ? (
        (
          [
            ["북", 0, -R + 0.35],
            ["남", 0, R - 0.15],
            ["동", R - 0.3, 0.1],
            ["서", -R + 0.3, 0.1],
          ] as const
        ).map(([t, x, y]) => (
          <text
            key={t}
            x={x}
            y={y}
            fontSize={FONT}
            fontWeight="bold"
            textAnchor="middle"
            fill={t === "북" ? "#ffd27a" : "rgba(255,240,210,0.8)"}
          >
            {t}
          </text>
        ))
      ) : (
        <g>
          <path
            d={`M0 ${-R - 0.3} l-0.15 0.35 h0.3 z`}
            fill="#ffd27a"
            opacity={0.9}
          />
          <text
            x={0.25}
            y={-R + 0.05}
            fontSize={FONT * 0.9}
            fontWeight="bold"
            fill="#ffd27a"
          >
            북
          </text>
        </g>
      )}

      {/* 그림자 끝 곡선 (힌트) */}
      {edges.map((e) => (
        <g key={e.label}>
          <line
            x1={e.x * 0.4}
            y1={e.y * 0.4}
            x2={e.x * (R - 0.1)}
            y2={e.y * (R - 0.1)}
            stroke="rgba(255,200,120,0.55)"
            strokeWidth={0.03}
            strokeDasharray="0.12 0.1"
          />
          <text
            x={e.x * (R - 0.75)}
            y={e.y * (R - 0.75) + (e.y > 0 ? 0.35 : -0.15)}
            fontSize={FONT * 0.75}
            textAnchor="middle"
            fill="rgba(255,215,150,0.9)"
          >
            {e.label} {solarClock(e.hours)}
          </text>
        </g>
      ))}
      {segments.map((s, i) => (
        <polyline
          key={i}
          points={s}
          fill="none"
          stroke="rgba(130,200,255,0.75)"
          strokeWidth={0.03}
        />
      ))}
      {hourDots.map((p) => (
        <g key={p.hours}>
          <circle
            cx={p.shadow.x}
            cy={-p.shadow.y}
            r={0.06}
            fill="#9fd6ff"
            stroke="rgba(0,0,0,0.5)"
            strokeWidth={0.015}
          />
          <text
            x={p.shadow.x}
            y={-p.shadow.y - 0.12}
            fontSize={FONT * 0.65}
            textAnchor="middle"
            fill="#cfe9ff"
          >
            {Math.round(p.hours)}시
          </text>
        </g>
      ))}

      {/* 정오 그림자 자국 */}
      <line
        x1={0}
        y1={0}
        x2={noonTip.x}
        y2={noonTip.y}
        stroke="rgba(20,12,4,0.55)"
        strokeWidth={0.09}
        strokeDasharray="0.14 0.1"
        strokeLinecap="round"
      />
      <text
        x={noonTip.x + (noonTip.x >= 0 ? 0.15 : -0.15)}
        y={noonTip.y + (noonTip.y >= 0 ? 0.35 : -0.15)}
        fontSize={FONT * 0.75}
        textAnchor={noonTip.x >= 0 ? "start" : "end"}
        fill="rgba(255,240,210,0.85)"
      >
        정오 그림자
      </text>

      {/* 지금 그림자 */}
      <line
        x1={0}
        y1={0}
        x2={tip.x}
        y2={tip.y}
        stroke="rgba(10,6,2,0.85)"
        strokeWidth={0.16}
        strokeLinecap="round"
        filter="url(#shadow-blur)"
      />
      {tip.clipped && (
        <text
          x={tip.x * 0.8}
          y={tip.y * 0.8 - 0.2}
          fontSize={FONT * 0.75}
          textAnchor="middle"
          fill="rgba(255,240,210,0.9)"
        >
          막대의 {shadow.length.toFixed(1)}배 →
        </text>
      )}

      {/* 내 답의 그림자 */}
      {guess?.noonShadow && (
        <line
          x1={0}
          y1={0}
          x2={pt(guess.noonShadow).x}
          y2={pt(guess.noonShadow).y}
          stroke="#ffd166"
          strokeWidth={0.04}
          strokeDasharray="0.12 0.08"
          opacity={0.8}
        />
      )}
      {guess?.shadow && (
        <line
          x1={0}
          y1={0}
          x2={pt(guess.shadow).x}
          y2={pt(guess.shadow).y}
          stroke="#ffd166"
          strokeWidth={0.07}
          strokeLinecap="round"
        />
      )}

      {/* 막대 (위에서 본 동그란 머리) */}
      <circle r={0.16} fill="#3a2a16" opacity={0.5} />
      <circle r={0.12} fill="#e8d3a6" stroke="#6b4f2a" strokeWidth={0.03} />

      {/* 막대 높이 자 (같은 축척) */}
      <g transform={`translate(${-R - 0.15} ${R - 0.1})`}>
        <line
          x1={0}
          y1={0}
          x2={0}
          y2={-1}
          stroke="#e8d3a6"
          strokeWidth={0.06}
        />
        <line
          x1={-0.12}
          y1={0}
          x2={0.12}
          y2={0}
          stroke="#e8d3a6"
          strokeWidth={0.03}
        />
        <text
          x={0.12}
          y={-0.75}
          fontSize={FONT * 0.7}
          fill="rgba(255,240,210,0.75)"
        >
          막대 높이
        </text>
      </g>
    </svg>
  );
}
