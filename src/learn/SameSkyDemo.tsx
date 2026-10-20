"use client";

import { useMemo, useState } from "react";
import {
  altAzOf,
  julianDay,
  localSiderealDeg,
  sunVector,
} from "@/search/utils/ephemeris";

// 같은 하늘은 언제 또 올까: 서울에서 '하늘 시계'(지방 항성시)가 같은 시각을 한 해 동안 날짜마다 찾는다.
// 같은 하늘은 하루에 약 4분씩 일찍 오고, 해가 떠 있으면 별이 안 보이니 그 날짜는 흐리게 표시한다.
// 촬영 시각 추정(search/shotTimeEstimate.ts)과 같은 생각이다.

const SEOUL = { latDeg: 37.57, lonDeg: 126.98 };
const KST = 9;
const YEAR = 2025;

const timeLabel = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(Math.round(minutes % 60)).padStart(2, "0")}`;

export default function SameSkyDemo() {
  // 하늘 시계 (시) — 기본은 겨울 대삼각형이 남쪽에 오는 6시 무렵
  const [lstHours, setLstHours] = useState(6);

  const rows = useMemo(() => {
    const out: { date: string; time: string; night: boolean }[] = [];

    for (let month = 0; month < 12; month++) {
      for (const day of [1, 15]) {
        // 그날 KST 12시부터 하루 동안, 항성시가 목표에 닿는 시각
        const start = Date.UTC(YEAR, month, day, 12 - KST);
        const lst0 = localSiderealDeg(julianDay(new Date(start)), SEOUL);
        // 항성시는 태양시보다 1.0027배 빨리 간다
        const deltaDeg = (((lstHours * 15 - lst0) % 360) + 360) % 360;
        const minutes = (deltaDeg / 15 / 1.0027379) * 60;
        const when = new Date(start + minutes * 60000);
        const jd = julianDay(when);
        const sunAlt = altAzOf(sunVector(jd), jd, SEOUL).altDeg;
        const local = (12 * 60 + minutes) % (24 * 60);

        out.push({
          date: `${month + 1}월 ${day}일`,
          time: timeLabel(local),
          night: sunAlt < -12,
        });
      }
    }

    return out;
  }, [lstHours]);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-3 text-sm">
        하늘 시계 {lstHours}시
        <input
          type="range"
          className="range range-xs flex-1"
          min={0}
          max={23}
          value={lstHours}
          onChange={(e) => setLstHours(Number(e.target.value))}
        />
      </label>
      <div className="grid grid-cols-3 gap-1 text-center text-xs sm:grid-cols-6">
        {rows.map((r) => (
          <div
            key={r.date}
            className={
              r.night
                ? "rounded bg-indigo-400/20 px-1 py-1"
                : "rounded px-1 py-1 opacity-35"
            }
          >
            <div className="opacity-70">{r.date}</div>
            <div className="font-mono font-bold">{r.time}</div>
          </div>
        ))}
      </div>
      <p className="text-xs opacity-70">
        서울에서 하늘이 똑같아지는 시각이에요. 보름마다 약 1시간씩 일찍 와요.
        흐린 칸은 해가 떠 있거나 아직 밝아서 별이 안 보이는 시각이에요. 사진 한
        장의 하늘만으로는 이 줄의 어느 날짜인지까지는 몰라요.
      </p>
    </div>
  );
}
