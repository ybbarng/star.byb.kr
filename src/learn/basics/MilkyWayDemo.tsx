"use client";

import type { DomeLine, DomeMark } from "@/learn/basics/SkyDome";
import { useMemo, useState } from "react";
import SkyDome from "@/learn/basics/SkyDome";
import {
  altAzAt,
  celestialEquator,
  galacticEquator,
  galacticToVector,
  SEOUL,
} from "@/learn/basics/skyMath";
import { cn } from "@/utils/cn";

// 계절마다 저녁 9시 서울 하늘에 은하 적도(은하수 한가운데 선)가 어디를 지나는지.
// 은하수 띠는 은하 적도를 따라 넓게 칠한 것이다 (실제 밝기 분포가 아니라 위치만 보인다).

const MONTHS = [
  { m: 1, label: "1월 (겨울)" },
  { m: 4, label: "4월 (봄)" },
  { m: 8, label: "8월 (여름)" },
  { m: 10, label: "10월 (가을)" },
];

const CENTER = galacticToVector(0, 0);
const ANTI = galacticToVector(180, 0);
const POLE = galacticToVector(0, 90);

const LINES: DomeLine[] = [
  {
    points: galacticEquator(),
    color: "216,180,254",
    width: 1.5,
    band: 26,
  },
  { points: celestialEquator(), color: "125,211,252", dash: [6, 5], width: 1 },
];

const MARKS: DomeMark[] = [
  { vector: CENTER, label: "은하 중심", color: "#fbbf24" },
  { vector: ANTI, label: "반대쪽", color: "#93c5fd" },
  { vector: POLE, label: "은하 북극", color: "#f9a8d4" },
];

export default function MilkyWayDemo() {
  const [month, setMonth] = useState(8);
  const [hour, setHour] = useState(21);
  const t = Date.UTC(2026, month - 1, 15, hour - 9);
  const alts = useMemo(
    () => ({
      center: altAzAt(CENTER, t, SEOUL).altDeg,
      anti: altAzAt(ANTI, t, SEOUL).altDeg,
      pole: altAzAt(POLE, t, SEOUL).altDeg,
    }),
    [t],
  );
  const fmt = (a: number) => (a < 0 ? "지평선 아래" : `고도 ${a.toFixed(0)}°`);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {MONTHS.map((x) => (
          <button
            key={x.m}
            className={cn("btn btn-xs", x.m === month && "btn-primary")}
            onClick={() => setMonth(x.m)}
          >
            {x.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-3 text-sm">
        <span className="w-24 shrink-0">밤 {hour % 24}시</span>
        <input
          type="range"
          className="range range-xs flex-1"
          min={19}
          max={28}
          value={hour}
          onChange={(e) => setHour(Number(e.target.value))}
        />
      </label>
      <SkyDome t={t} observer={SEOUL} lines={LINES} marks={MARKS} />
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-box border border-amber-300/40 p-2">
          은하 중심
          <div className="font-bold">{fmt(alts.center)}</div>
        </div>
        <div className="rounded-box border border-sky-300/40 p-2">
          반대쪽
          <div className="font-bold">{fmt(alts.anti)}</div>
        </div>
        <div className="rounded-box border border-pink-300/40 p-2">
          은하 북극
          <div className="font-bold">{fmt(alts.pole)}</div>
        </div>
      </div>
      <p className="text-xs opacity-60">
        보라색 띠가 은하 적도(은하수가 흐르는 자리), 하늘색 점선이 천구
        적도예요. 서울, 한국 시각 기준.
      </p>
    </div>
  );
}
