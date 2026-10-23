"use client";

import type { DomeLine, DomeMark } from "@/learn/basics/SkyDome";
import { useMemo, useState } from "react";
import { STARS } from "@/game/sky/catalog";
import SkyDome from "@/learn/basics/SkyDome";
import {
  altAzAt,
  celestialEquator,
  clockLabel,
  hourAngleDeg,
  maxAltitudeDeg,
  raLabel,
  starVisibility,
  vectorToRaDec,
} from "@/learn/basics/skyMath";
import { horizontalFrameJ2000, julianDay } from "@/search/utils/ephemeris";
import { cn } from "@/utils/cn";

// 별 하나를 골라 밤새 시각을 옮기면: 적경·적위는 그대로, 고도·방위와 시간각은 바뀐다.
// 지방 항성시 = 지금 남쪽 자오선을 지나는 적경. 시간각 = 항성시 − 적경 (0이면 남중)

const PICKS = [
  { latin: "Vega", label: "직녀성" },
  { latin: "Sirius", label: "시리우스" },
  { latin: "Betelgeuse", label: "베텔게우스" },
  { latin: "Arcturus", label: "아크투루스" },
  { latin: "Polaris", label: "북극성" },
  { latin: "Antares", label: "안타레스" },
];

const PLACES = [
  { name: "서울", latDeg: 37.57, lonDeg: 126.98, utc: 9 },
  { name: "싱가포르", latDeg: 1.35, lonDeg: 103.82, utc: 8 },
  { name: "시드니", latDeg: -33.87, lonDeg: 151.21, utc: 10 },
  { name: "레이캬비크", latDeg: 64.15, lonDeg: -21.94, utc: 0 },
];

const SEASONS = [
  { label: "1월 15일", month: 1 },
  { label: "4월 15일", month: 4 },
  { label: "7월 15일", month: 7 },
  { label: "10월 15일", month: 10 },
];

const DIRS = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
const dirName = (az: number) => DIRS[Math.round(az / 45) % 8];

const VIS_LABEL = {
  circumpolar: "지지 않는 별",
  rises: "뜨고 지는 별",
  never: "뜨지 않는 별",
} as const;

export default function SkyCoordsDemo() {
  const [pick, setPick] = useState(PICKS[0].latin);
  const [placeIdx, setPlaceIdx] = useState(0);
  const [month, setMonth] = useState(10);
  const [minutes, setMinutes] = useState(21 * 60); // 그 나라 시각, 18:00 ~ 다음 날 6:00
  const place = PLACES[placeIdx];
  const star = STARS.find((s) => s.latinName === pick)!;
  const { raDeg, decDeg } = vectorToRaDec(star.vector);
  const t = Date.UTC(2026, month - 1, 15) + (minutes - place.utc * 60) * 60000;
  const observer = useMemo(
    () => ({ latDeg: place.latDeg, lonDeg: place.lonDeg }),
    [place],
  );
  // 별 지도(2000년 기준)와 맞추려고 천정의 적경을 같은 기준으로 잰다 (그날 기준 항성시와 0.4°쯤 차이)
  const lst = vectorToRaDec(
    horizontalFrameJ2000(julianDay(new Date(t)), observer).zenith,
  ).raDeg;
  const ha = hourAngleDeg(lst, raDeg);
  const { altDeg, azDeg } = altAzAt(star.vector, t, observer);
  const vis = starVisibility(place.latDeg, decDeg);

  const lines = useMemo<DomeLine[]>(
    () => [{ points: celestialEquator(), color: "125,211,252", dash: [6, 5] }],
    [],
  );
  const marks = useMemo<DomeMark[]>(
    () => [
      {
        vector: star.vector,
        label: PICKS.find((p) => p.latin === pick)!.label,
        color: "#fde68a",
      },
    ],
    [star, pick],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {PICKS.map((p) => (
          <button
            key={p.latin}
            className={cn("btn btn-xs", p.latin === pick && "btn-primary")}
            onClick={() => setPick(p.latin)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {PLACES.map((p, i) => (
          <button
            key={p.name}
            className={cn("btn btn-xs", i === placeIdx && "btn-secondary")}
            onClick={() => setPlaceIdx(i)}
          >
            {p.name}
          </button>
        ))}
        <span className="mx-1 opacity-30">|</span>
        {SEASONS.map((s) => (
          <button
            key={s.month}
            className={cn("btn btn-xs", s.month === month && "btn-accent")}
            onClick={() => setMonth(s.month)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-3 text-sm">
        <span className="w-20 shrink-0 font-mono">{clockLabel(minutes)}</span>
        <input
          type="range"
          className="range range-xs flex-1"
          min={18 * 60}
          max={30 * 60}
          step={5}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
        />
      </label>

      <SkyDome t={t} observer={observer} lines={lines} marks={marks} meridian />

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-box border border-sky-300/30 p-3">
          <div className="text-xs opacity-60">별의 주소 (바뀌지 않아요)</div>
          <div>
            적경 <b>{raLabel(raDeg)}</b>
          </div>
          <div>
            적위{" "}
            <b>
              {decDeg >= 0 ? "+" : "−"}
              {Math.abs(decDeg).toFixed(1)}°
            </b>
          </div>
        </div>
        <div className="rounded-box border border-amber-300/30 p-3">
          <div className="text-xs opacity-60">
            {place.name}에서 지금 (바뀌어요)
          </div>
          <div>
            고도{" "}
            <b className={cn(altDeg < 0 && "text-rose-300")}>
              {altDeg.toFixed(1)}°
            </b>
            {altDeg < 0 && " (지평선 아래)"}
          </div>
          <div>
            방위 <b>{azDeg.toFixed(0)}°</b> ({dirName(azDeg)})
          </div>
        </div>
        <div className="rounded-box col-span-2 border border-white/10 p-3">
          <div>
            지방 항성시 <b>{raLabel(lst)}</b> → 지금 자오선(점선, 북-천정-남)을
            지나는 적경
          </div>
          <div>
            시간각 = 항성시 − 적경 ={" "}
            <b>
              {ha >= 0 ? "+" : "−"}
              {(Math.abs(ha) / 15).toFixed(1)}시간
            </b>{" "}
            {Math.abs(ha) < 2
              ? "(남중 무렵)"
              : ha > 0
                ? "(남중을 지나 서쪽으로)"
                : "(아직 동쪽, 남중 전)"}
          </div>
          <div className="text-xs opacity-70">
            이 별은 {place.name}에서 <b>{VIS_LABEL[vis]}</b>
            {vis !== "never" &&
              `이고, 가장 높이 뜰 때 고도 ${maxAltitudeDeg(place.latDeg, decDeg).toFixed(0)}°`}
            예요. 하늘색 점선은 천구 적도예요.
          </div>
        </div>
      </div>
    </div>
  );
}
