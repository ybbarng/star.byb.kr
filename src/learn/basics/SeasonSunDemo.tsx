"use client";

import { useMemo, useState } from "react";
import {
  dayLengthHours,
  noonSunAltitudeDeg,
  sunDeclinationDeg,
} from "@/learn/basics/skyMath";
import { cn } from "@/utils/cn";

// 날짜를 옮기면 해의 적위(천구 적도에서 남북으로 몇 도), 정오의 해 높이, 낮의 길이가 바뀐다.
// 위쪽 그래프는 한 해 동안의 해의 적위, 아래 그림은 그날 정오에 해가 얼마나 높은지.

const YEAR = 2026;
const W = 360;
const H = 150;
const PAD = 26;
const PLACES = [
  { name: "서울", lat: 37.57 },
  { name: "적도", lat: 0 },
  { name: "시드니", lat: -33.87 },
  { name: "레이캬비크", lat: 64.15 },
];

const dateOf = (day: number) => new Date(Date.UTC(YEAR, 0, 1 + day, 12));

const MONTHS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

export default function SeasonSunDemo() {
  const [day, setDay] = useState(171); // 6월 21일 무렵
  const [placeIdx, setPlaceIdx] = useState(0);
  const lat = PLACES[placeIdx].lat;
  const curve = useMemo(
    () =>
      Array.from({ length: 74 }, (_, i) => {
        const d = i * 5;

        return { d, dec: sunDeclinationDeg(dateOf(d)) };
      }),
    [],
  );
  const dec = sunDeclinationDeg(dateOf(day));
  const noon = noonSunAltitudeDeg(lat, dec);
  const lengthMin = Math.round(dayLengthHours(lat, dec) * 60);
  const date = dateOf(day);
  const x = (d: number) => PAD + (d / 365) * (W - PAD - 8);
  const y = (v: number) => H / 2 - (v / 30) * (H / 2 - 12);
  // 정오의 해: 해가 보이는 방향(남쪽 또는 북쪽)
  const sunNorth = dec > lat;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {PLACES.map((p, i) => (
          <button
            key={p.name}
            className={cn("btn btn-xs", i === placeIdx && "btn-primary")}
            onClick={() => setPlaceIdx(i)}
          >
            {p.name}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-3 text-sm">
        <span className="w-16 shrink-0 font-bold">
          {date.getUTCMonth() + 1}월 {date.getUTCDate()}일
        </span>
        <input
          type="range"
          className="range range-xs flex-1"
          min={0}
          max={364}
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
        />
      </label>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="rounded-box w-full bg-[#0b0f22]"
        role="img"
        aria-label="한 해 동안 해의 적위"
      >
        {[23.44, 0, -23.44].map((v) => (
          <g key={v}>
            <line
              x1={PAD}
              x2={W - 8}
              y1={y(v)}
              y2={y(v)}
              stroke="white"
              strokeOpacity={v === 0 ? 0.35 : 0.15}
              strokeDasharray={v === 0 ? undefined : "3 3"}
            />
            <text
              x={PAD - 3}
              y={y(v) + 3}
              fontSize="9"
              fill="white"
              opacity="0.6"
              textAnchor="end"
            >
              {v > 0 ? "+23°" : v < 0 ? "−23°" : "0°"}
            </text>
          </g>
        ))}
        {MONTHS.map((m, i) => (
          <text
            key={m}
            x={x((i * 365) / 12 + 15)}
            y={H - 3}
            fontSize="8"
            fill="white"
            opacity="0.45"
            textAnchor="middle"
          >
            {m}월
          </text>
        ))}
        <path
          d={curve
            .map((p, i) => `${i ? "L" : "M"} ${x(p.d)} ${y(p.dec)}`)
            .join(" ")}
          fill="none"
          stroke="#fde68a"
          strokeWidth="2"
        />
        <line
          x1={x(day)}
          x2={x(day)}
          y1={8}
          y2={H - 14}
          stroke="white"
          strokeOpacity="0.3"
        />
        <circle cx={x(day)} cy={y(dec)} r="5" fill="#fbbf24" />
      </svg>
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="bg-base-300/50 rounded-box p-2">
          <div className="text-xs opacity-60">해의 적위</div>
          <div className="font-black">
            {dec >= 0 ? "+" : "−"}
            {Math.abs(dec).toFixed(1)}°
          </div>
        </div>
        <div className="bg-base-300/50 rounded-box p-2">
          <div className="text-xs opacity-60">정오의 해 높이</div>
          <div className="font-black">
            {noon > 0 ? `${noon.toFixed(0)}°` : "뜨지 않음"}
          </div>
          <div className="text-[10px] opacity-60">
            {noon > 0 && Math.abs(noon - 90) > 0.5
              ? sunNorth
                ? "북쪽 하늘"
                : "남쪽 하늘"
              : ""}
          </div>
        </div>
        <div className="bg-base-300/50 rounded-box p-2">
          <div className="text-xs opacity-60">낮의 길이</div>
          <div className="font-black">
            {Math.floor(lengthMin / 60)}시간 {lengthMin % 60}분
          </div>
        </div>
      </div>
      <p className="text-xs opacity-60">
        정오의 해 높이 = 90° − |위도 − 해의 적위|. 낮의 길이는 해 윗가장자리가
        지평선에 걸린 때부터 재고 대기 굴절을 넣었어요.
      </p>
    </div>
  );
}
