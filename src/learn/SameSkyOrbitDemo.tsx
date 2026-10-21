"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CONSTELLATIONS, STARS } from "@/game/sky/catalog";
import { drawSky } from "@/game/sky/drawSky";
import { horizonCameraTP } from "@/search/horizonSolve";
import {
  altAzOf,
  julianDay,
  localSiderealDeg,
  sunVector,
} from "@/search/utils/ephemeris";

// 같은 하늘은 왜 한 달에 2시간씩 일찍 올까: 위에서 내려다본 지구의 공전 그림과, 그 순간 서울에서 본
// 남쪽 하늘을 나란히 그린다. 별은 아주 멀어서 어느 달이든 같은 방향(평행한 화살표)을 봐야 같은 하늘이다.
// 지구가 한 달에 약 30° 공전하니 그 방향을 보려면 해 기준 시계로 약 2시간 일찍 그 자리에 와야 한다.
// 시각은 서울의 지방 항성시가 1월 1일 23시와 같아지는 때다 (search/shotTimeEstimate.ts와 같은 생각).

const SEOUL = { latDeg: 37.57, lonDeg: 126.98 };
const KST = 9;
const YEAR = 2026;
const D = Math.PI / 180;
const SKY_W = 640;
const SKY_H = 400;
const VIEW = { azimuthDeg: 180, altitudeDeg: 32, rollDeg: 0, fovDeg: 70 };

const sinD = (d: number) => Math.sin(d * D);
const cosD = (d: number) => Math.cos(d * D);

// 해의 황경 (지구에서 본 해의 방향, 도)
const sunLongitude = (jd: number) => {
  const v = sunVector(jd);
  const eps = 23.439;

  return (
    (((Math.atan2(cosD(eps) * v[1] + sinD(eps) * v[2], v[0]) / D) % 360) +
      360) %
    360
  );
};

// KST로 그날 정오부터 하루 안에서 항성시가 target에 닿는 순간
const sameSkyMoment = (month: number, targetLst: number) => {
  const start = Date.UTC(YEAR, month, 1, 12 - KST);
  const lst0 = localSiderealDeg(julianDay(new Date(start)), SEOUL);
  const delta = (((targetLst - lst0) % 360) + 360) % 360;

  return new Date(start + (delta / 15 / 1.0027379) * 3600000);
};

const kstLabel = (date: Date) => {
  const k = new Date(date.getTime() + KST * 3600000);

  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
};

const ORBIT_R = 120;
const CX = 200;
const CY = 215;

export default function SameSkyOrbitDemo() {
  const [month, setMonth] = useState(1);
  const sky = useRef<HTMLCanvasElement>(null);

  // 기준: 1월 1일 23시 서울의 하늘
  const target = useMemo(
    () =>
      localSiderealDeg(
        julianDay(new Date(Date.UTC(YEAR, 0, 1, 23 - KST))),
        SEOUL,
      ),
    [],
  );
  const moments = useMemo(
    () =>
      Array.from({ length: 12 }, (_, m) => {
        const date =
          m === 0
            ? new Date(Date.UTC(YEAR, 0, 1, 23 - KST))
            : sameSkyMoment(m, target);
        const jd = julianDay(date);

        return {
          date,
          earthDeg: (sunLongitude(jd) + 180) % 360,
          sunAlt: altAzOf(sunVector(jd), jd, SEOUL).altDeg,
        };
      }),
    [target],
  );
  const now = moments[month];

  useEffect(() => {
    const el = sky.current;
    const ctx = el?.getContext("2d");

    if (!el || !ctx) return;

    el.width = SKY_W;
    el.height = SKY_H;
    drawSky(ctx, {
      width: SKY_W,
      height: SKY_H,
      TP: horizonCameraTP(now.date, SEOUL, VIEW, SKY_W, SKY_H),
      date: now.date,
      observer: SEOUL,
      azimuthDeg: VIEW.azimuthDeg,
      magLimit: 4.5,
      lightPollution: 0.3,
      groundSeed: 7,
      stars: STARS,
      constellations: CONSTELLATIONS,
      compass: true,
    });
  }, [now]);

  // 공전 그림의 좌표 (황경 0°를 오른쪽, 반시계로)
  const at = (deg: number, r: number) => ({
    x: CX + r * cosD(deg),
    y: CY - r * sinD(deg),
  });
  const earth = at(now.earthDeg, ORBIT_R);
  const first = at(moments[0].earthDeg, ORBIT_R);
  const toward = (from: { x: number; y: number }, len: number) => ({
    x: from.x + len * cosD(target),
    y: from.y - len * sinD(target),
  });
  // 지구에서 해 반대쪽(한밤중)과 지금 보는 방향(별) 사이 각 = 해 기준 시각
  const awayFromSun = now.earthDeg;
  const night = now.sunAlt < -12;
  // 1월 1일 23시보다 몇 분 일찍 같은 하늘이 오는가
  const kstMinutes =
    (((now.date.getUTCHours() + KST) % 24) * 60 + now.date.getUTCMinutes()) %
    1440;
  const earlier = (23 * 60 - kstMinutes + 1440) % 1440;

  return (
    <div className="grid gap-4 md:grid-cols-[23rem_1fr]">
      <div className="flex flex-col gap-2">
        <svg viewBox="0 0 400 420" className="rounded-box w-full bg-[#0b0f22]">
          {/* 아주 먼 별들: 어느 달이든 같은 방향 */}
          <g
            transform={`translate(${toward({ x: CX, y: CY }, 185).x} ${toward({ x: CX, y: CY }, 185).y})`}
          >
            {[
              [-10, -4],
              [8, -8],
              [0, 0],
              [-6, 8],
              [10, 6],
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={2.2} fill="#fde68a" />
            ))}
            <text y={-14} textAnchor="middle" fontSize="11" fill="#fde68a">
              아주 먼 별들
            </text>
          </g>
          <circle
            cx={CX}
            cy={CY}
            r={ORBIT_R}
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeDasharray="4 4"
          />
          <circle cx={CX} cy={CY} r={18} fill="#fbbf24" />
          <text
            x={CX}
            y={CY + 34}
            textAnchor="middle"
            fontSize="11"
            fill="#fbbf24"
          >
            해
          </text>
          {/* 1월 1일의 지구와 그때 본 방향 (흐리게) */}
          {month !== 0 && (
            <g opacity={0.4}>
              <circle cx={first.x} cy={first.y} r={9} fill="#60a5fa" />
              <line
                x1={first.x}
                y1={first.y}
                x2={toward(first, 60).x}
                y2={toward(first, 60).y}
                stroke="#fde68a"
                strokeWidth={2}
              />
              <text
                x={first.x + 12}
                y={first.y + 16}
                fontSize="10"
                fill="white"
              >
                1월 1일 23:00
              </text>
            </g>
          )}
          {/* 지금 달의 지구: 해 반대쪽 반은 밤 */}
          <g>
            <circle cx={earth.x} cy={earth.y} r={14} fill="#60a5fa" />
            <path
              d={`M ${earth.x + 14 * cosD(awayFromSun + 90)} ${earth.y - 14 * sinD(awayFromSun + 90)} A 14 14 0 0 1 ${earth.x + 14 * cosD(awayFromSun - 90)} ${earth.y - 14 * sinD(awayFromSun - 90)} Z`}
              fill="#1e3a8a"
            />
            <line
              x1={earth.x}
              y1={earth.y}
              x2={toward(earth, 70).x}
              y2={toward(earth, 70).y}
              stroke="#fde68a"
              strokeWidth={3}
            />
            <circle
              cx={earth.x + 14 * cosD(target)}
              cy={earth.y - 14 * sinD(target)}
              r={4}
              fill="#4ade80"
            />
          </g>
          {/* 해 기준 시계 */}
          <g transform="translate(345 380)">
            <text y={-32} textAnchor="middle" fontSize="10" fill="white">
              시계
            </text>
            <circle r={26} fill="#161616" stroke="rgba(255,255,255,0.4)" />
            {Array.from({ length: 12 }, (_, i) => (
              <line
                key={i}
                x1={0}
                y1={-22}
                x2={0}
                y2={-26}
                stroke="rgba(255,255,255,0.5)"
                transform={`rotate(${i * 30})`}
              />
            ))}
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={-16}
              stroke="#fde68a"
              strokeWidth={3}
              strokeLinecap="round"
              transform={`rotate(${(((now.date.getUTCHours() + KST) % 12) + now.date.getUTCMinutes() / 60) * 30})`}
            />
          </g>
        </svg>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-sm"
            onClick={() => setMonth((m) => (m + 11) % 12)}
          >
            ◀ 한 달 전
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setMonth((m) => (m + 1) % 12)}
          >
            한 달 뒤 ▶
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-lg font-bold">
          {kstLabel(now.date)}{" "}
          <span className="text-sm font-normal opacity-70">
            {month === 0
              ? "(기준)"
              : `(1월 1일보다 ${Math.floor(earlier / 60)}시간 ${earlier % 60}분 일찍)`}
          </span>
        </div>
        <div className="relative">
          <canvas ref={sky} className="rounded-box h-auto w-full" />
          {!night && (
            <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-amber-200">
              이 시각엔 해가 떠 있어 별이 안 보여요
            </div>
          )}
        </div>
        <div className="text-xs opacity-70">
          서울에서 본 남쪽 하늘. 화살표(지금 보는 방향)는 어느 달이든 같은 별을
          가리키고, 지구가 공전한 만큼 시계는 일찍 그 자리에 온다.
        </div>
      </div>
    </div>
  );
}
