"use client";

import type { City } from "@/game/eratosthenes/eratosthenes";
import { useRef } from "react";

// 에라토스테네스 그림: 옆에서 본 막대·그림자·햇빛과 각도기(SideFigure), 자오선으로 자른 지구 단면(EarthFigure).

const D = Math.PI / 180;

// ---------- 옆에서 본 막대와 각도기 ----------

const W = 360;
const H = 250;
const GROUND = 225;
const BASE_X = 70;

export function SideFigure({
  city,
  angleDeg,
  needleDeg,
  onNeedle,
  fitDeg,
}: {
  city: City;
  angleDeg: number; // 정오 그림자 각 (+ 북쪽으로 그림자)
  needleDeg?: number | null; // 각도기 바늘 (없으면 각도기를 그리지 않는다)
  onNeedle?: (deg: number) => void;
  fitDeg?: number; // 이 각의 그림자가 들어가게 축척을 정한다 (두 그림을 같은 축척으로 놓을 때)
}) {
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const theta = Math.min(80, Math.abs(angleDeg));
  const tan = Math.tan(theta * D);
  const fitTan = Math.tan(Math.min(80, fitDeg ?? theta) * D);
  const stick = Math.min(165, fitTan > 0 ? 250 / fitTan : 165);
  const shadow = stick * tan;
  const top = { x: BASE_X, y: GROUND - stick };
  const tip = { x: BASE_X + shadow, y: GROUND };
  // 햇빛 방향 (아래로 내려오는 단위 벡터)
  const ray = { x: Math.sin(theta * D), y: Math.cos(theta * D) };
  const r = Math.min(120, stick * 0.85);
  const towardNorth = angleDeg >= 0;

  const setFromPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const el = svg.current;
    const ctm = el?.getScreenCTM();

    if (!el || !ctm || !onNeedle) {
      return;
    }

    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const a = Math.atan2(p.x - top.x, p.y - top.y) / D;
    onNeedle(Math.round(Math.max(0, Math.min(89, a)) * 10) / 10);
  };

  const rays = [-90, -45, 0, 45, 90, 135].map((off) => {
    // 막대 꼭대기를 지나는 빛과 나란한 빛 여러 줄
    const sx = top.x + off * ray.y;
    const sy = top.y - off * ray.x;
    const t0 = (sy - 0) / ray.y;
    const t1 = (GROUND - sy) / ray.y;

    return {
      x1: sx - ray.x * t0,
      y1: 0,
      x2: sx + ray.x * t1,
      y2: GROUND,
      main: off === 0,
    };
  });

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full touch-none select-none"
      onPointerDown={(e) => {
        if (onNeedle) {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromPointer(e);
        }
      }}
      onPointerMove={(e) => dragging.current && setFromPointer(e)}
      onPointerUp={() => (dragging.current = false)}
      role="img"
      aria-label={`${city.name}의 정오 막대와 그림자`}
    >
      <rect width={W} height={H} fill="#0e1830" />
      {rays.map((l, i) => (
        <line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.main ? tip.x : l.x2}
          y2={l.main ? tip.y : l.y2}
          stroke={l.main ? "#ffd166" : "rgba(255,210,110,0.25)"}
          strokeWidth={l.main ? 1.6 : 1}
          strokeDasharray={l.main ? undefined : "4 5"}
        />
      ))}
      <rect y={GROUND} width={W} height={H - GROUND} fill="#3d5a3a" />
      {/* 그림자 */}
      <line
        x1={BASE_X}
        y1={GROUND + 1}
        x2={tip.x}
        y2={GROUND + 1}
        stroke="#05080f"
        strokeWidth={5}
      />
      {/* 막대 */}
      <line
        x1={BASE_X}
        y1={GROUND}
        x2={top.x}
        y2={top.y}
        stroke="#e8d3a6"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <text x={8} y={GROUND + 18} fontSize={11} fill="rgba(255,255,255,0.7)">
        {towardNorth ? "← 남" : "← 북"}
      </text>
      <text
        x={W - 8}
        y={GROUND + 18}
        fontSize={11}
        textAnchor="end"
        fill="rgba(255,255,255,0.7)"
      >
        {towardNorth ? "북 →" : "남 →"}
      </text>
      <text x={8} y={16} fontSize={12} fontWeight="bold" fill="white">
        {city.name} · 정오
      </text>

      {needleDeg !== undefined && needleDeg !== null && (
        <g>
          {/* 각도기: 막대 꼭대기에서 아래(막대 방향)가 0° */}
          <path
            d={`M${top.x} ${top.y} L${top.x} ${top.y + r} A${r} ${r} 0 0 0 ${top.x + r} ${top.y} Z`}
            fill="rgba(160,200,255,0.08)"
            stroke="rgba(160,200,255,0.5)"
          />
          {Array.from({ length: 91 }, (_, a) => {
            const len = a % 10 === 0 ? 10 : a % 5 === 0 ? 6 : 3;
            const s = Math.sin(a * D);
            const c = Math.cos(a * D);

            return (
              <g key={a}>
                <line
                  x1={top.x + s * r}
                  y1={top.y + c * r}
                  x2={top.x + s * (r - len)}
                  y2={top.y + c * (r - len)}
                  stroke="rgba(190,220,255,0.7)"
                  strokeWidth={a % 10 === 0 ? 1 : 0.6}
                />
                {a % 10 === 0 && a > 0 && a < 90 && r > 70 && (
                  <text
                    x={top.x + s * (r - 18)}
                    y={top.y + c * (r - 18) + 3}
                    fontSize={8}
                    textAnchor="middle"
                    fill="rgba(200,225,255,0.85)"
                  >
                    {a}
                  </text>
                )}
              </g>
            );
          })}
          <line
            x1={top.x}
            y1={top.y}
            x2={top.x + Math.sin(needleDeg * D) * (r + 14)}
            y2={top.y + Math.cos(needleDeg * D) * (r + 14)}
            stroke="#ff6b9a"
            strokeWidth={2}
          />
          <circle
            cx={top.x + Math.sin(needleDeg * D) * (r + 14)}
            cy={top.y + Math.cos(needleDeg * D) * (r + 14)}
            r={6}
            fill="#ff6b9a"
            className="cursor-grab"
          />
          <text
            x={top.x + 10}
            y={top.y - 8}
            fontSize={13}
            fontWeight="bold"
            fill="#ff9dbb"
          >
            {needleDeg.toFixed(1)}°
          </text>
        </g>
      )}
    </svg>
  );
}

// ---------- 지구 단면 ----------

export function EarthFigure({
  a,
  b,
  decDeg,
  showCenter,
}: {
  a: City;
  b: City;
  decDeg: number;
  showCenter: boolean;
}) {
  const cx = 130;
  const cy = 150;
  const R = 95;
  const gap = Math.abs(a.latDeg - b.latDeg);
  // 각이 작으면 그림에서 키워 보여 준다 (글에 밝힌다)
  const k = gap > 0 && gap < 18 ? Math.min(6, 18 / gap) : 1;
  const mid = (a.latDeg + b.latDeg) / 2;
  const shown = (lat: number) =>
    Math.max(-85, Math.min(85, mid + (lat - mid) * k));
  const at = (lat: number, rr: number) => ({
    x: cx + rr * Math.cos(shown(lat) * D),
    y: cy - rr * Math.sin(shown(lat) * D),
  });
  const sun = { x: Math.cos(decDeg * D), y: -Math.sin(decDeg * D) };
  const night = `M${cx - sun.y * R} ${cy + sun.x * R} A${R} ${R} 0 0 1 ${cx + sun.y * R} ${cy - sun.x * R} Z`;

  return (
    <svg
      viewBox="0 0 330 300"
      className="w-full select-none"
      role="img"
      aria-label="자오선으로 자른 지구와 햇빛"
    >
      <rect width={330} height={300} fill="#0b1226" />
      {/* 햇빛: 오른쪽 멀리서 나란히 */}
      {[-80, -50, -20, 10, 40, 70].map((o) => {
        const px = cx + -sun.y * o;
        const py = cy + sun.x * o;

        return (
          <line
            key={o}
            x1={px + sun.x * 400}
            y1={py + sun.y * 400}
            x2={px + sun.x * Math.sqrt(Math.max(0, R * R - o * o))}
            y2={py + sun.y * Math.sqrt(Math.max(0, R * R - o * o))}
            stroke="rgba(255,210,110,0.4)"
            strokeDasharray="5 4"
          />
        );
      })}
      <text x={318} y={20} fontSize={11} textAnchor="end" fill="#ffd166">
        ☀ 햇빛 (나란히)
      </text>
      <circle cx={cx} cy={cy} r={R} fill="#1f4f7a" stroke="#7fb0e0" />
      <path d={night} fill="rgba(0,0,0,0.45)" />
      <line
        x1={cx - R - 8}
        y1={cy}
        x2={cx + R + 8}
        y2={cy}
        stroke="rgba(255,255,255,0.25)"
        strokeDasharray="3 3"
      />
      <text x={cx - R - 6} y={cy - 4} fontSize={9} fill="rgba(255,255,255,0.5)">
        적도
      </text>
      {[a, b].map((c, i) => {
        const p = at(c.latDeg, R);
        const q = at(c.latDeg, R + 22);
        const ray = { x: q.x + sun.x * 60, y: q.y + sun.y * 60 };

        return (
          <g key={i}>
            {showCenter && (
              <line
                x1={cx}
                y1={cy}
                x2={p.x}
                y2={p.y}
                stroke="#ff9dbb"
                strokeWidth={1.4}
              />
            )}
            <line x1={q.x} y1={q.y} x2={ray.x} y2={ray.y} stroke="#ffd166" />
            <line
              x1={p.x}
              y1={p.y}
              x2={q.x}
              y2={q.y}
              stroke="#e8d3a6"
              strokeWidth={3}
              strokeLinecap="round"
            />
            <circle cx={p.x} cy={p.y} r={3} fill="white" />
            <text
              x={q.x + 6}
              y={q.y + (i === 0 ? -4 : 12)}
              fontSize={11}
              fill="white"
            >
              {c.name}
            </text>
          </g>
        );
      })}
      {showCenter && (
        <>
          <path
            d={`M${cx + 28 * Math.cos(shown(b.latDeg) * D)} ${cy - 28 * Math.sin(shown(b.latDeg) * D)} A28 28 0 0 0 ${cx + 28 * Math.cos(shown(a.latDeg) * D)} ${cy - 28 * Math.sin(shown(a.latDeg) * D)}`}
            fill="none"
            stroke="#ff9dbb"
            strokeWidth={2}
          />
          <text
            x={cx + 34 * Math.cos(shown(mid) * D)}
            y={cy - 34 * Math.sin(shown(mid) * D) + 4}
            fontSize={11}
            fontWeight="bold"
            fill="#ff9dbb"
          >
            {gap.toFixed(1)}°
          </text>
          <circle cx={cx} cy={cy} r={2.5} fill="#ff9dbb" />
          <text
            x={cx - 4}
            y={cy + 14}
            fontSize={9}
            fill="#ff9dbb"
            textAnchor="end"
          >
            지구 중심
          </text>
        </>
      )}
      {k > 1 && (
        <text x={8} y={292} fontSize={9} fill="rgba(255,255,255,0.5)">
          두 도시 사이 각은 그림에서 {k.toFixed(1)}배로 키워 그렸어요
        </text>
      )}
    </svg>
  );
}
