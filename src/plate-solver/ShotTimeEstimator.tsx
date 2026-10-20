import type { ShotTime } from "@/plate-solver/shotTime";
import type { Point2D } from "@/scripts/hash/types";
import type { ShotCandidate } from "@/search/shotTimeEstimate";
import type { Mat3 } from "@/search/utils/similarity";
import { useMemo, useState } from "react";
import {
  estimateShotTimes,
  skyClockOf,
  zenithFromHorizon,
} from "@/search/shotTimeEstimate";
import { photoToSky } from "@/search/utils/wcs";
import { cn } from "@/utils/cn";

// 사진에서 촬영 시각을 거꾸로 찾는다 (발표 "이과생의 별 헤는 밤"을 계산으로).
// 사람이 지평선 두 점(과 있으면 달)을 찍으면, 같은 하늘이 되는 밤 시각을 날짜별로 보여 준다.

export type PickTarget = "horizon" | "moon" | null;

export interface EstimateMarks {
  horizon: Point2D[]; // 최대 2개
  moon: Point2D | null;
}

const MAX_SHOWN = 12;

export default function ShotTimeEstimator({
  transform,
  width,
  shot,
  marks,
  picking,
  onPick,
  onClear,
  onApply,
}: {
  transform: Mat3;
  width: number;
  shot: ShotTime | null;
  marks: EstimateMarks;
  picking: PickTarget;
  onPick: (target: PickTarget) => void;
  onClear: () => void;
  onApply: (shot: ShotTime) => void;
}) {
  // 시간대로 경도를 어림한다 (UTC+9 → 135°). 촬영지를 알면 그 경도를 쓴다.
  const defaultLon =
    shot?.observer?.lonDeg ??
    (shot
      ? parseInt(shot.offset, 10) * 15
      : -new Date().getTimezoneOffset() / 4);
  const [lonDeg, setLonDeg] = useState(Math.round(defaultLon));
  const [year, setYear] = useState(
    shot ? Number(shot.local.slice(0, 4)) : new Date().getFullYear(),
  );

  const result = useMemo(() => {
    if (marks.horizon.length < 2) {
      return null;
    }

    const zenith = zenithFromHorizon(
      photoToSky(transform, marks.horizon[0]),
      photoToSky(transform, marks.horizon[1]),
      photoToSky(transform, [width / 2, 0]),
    );

    if (!zenith) {
      return null;
    }

    const clock = skyClockOf(zenith);
    const candidates = estimateShotTimes(clock, {
      lonDeg,
      from: new Date(Date.UTC(year, 0, 1) - (lonDeg / 15) * 3600000),
      days: 366,
      moon: marks.moon ? photoToSky(transform, marks.moon) : undefined,
    });

    return { clock, candidates };
  }, [transform, width, marks, lonDeg, year]);

  // 시간대: 경도 15°마다 1시간 (모르면 이것으로 보여 준다)
  const offsetHours = shot
    ? parseInt(shot.offset, 10)
    : Math.round(lonDeg / 15);
  const offset = `${offsetHours >= 0 ? "+" : "-"}${String(Math.abs(offsetHours)).padStart(2, "0")}:00`;

  const toLocal = (c: ShotCandidate) =>
    new Date(c.date.getTime() + offsetHours * 3600000)
      .toISOString()
      .slice(0, 16);

  // 달이 없으면 같은 하늘이 하루 4분씩 일찍 오니, 보름 간격으로만 보여 준다
  const shown = result
    ? marks.moon
      ? result.candidates.slice(0, MAX_SHOWN)
      : result.candidates.filter((c) => {
          const day = Number(toLocal(c).slice(8, 10));

          return day === 1 || day === 15;
        })
    : [];

  return (
    <div className="bg-base-200 rounded-box flex w-full max-w-3xl flex-col gap-2 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold">촬영 시각 추정</span>
        <button
          className={cn("btn btn-xs", picking === "horizon" && "btn-primary")}
          onClick={() => onPick(picking === "horizon" ? null : "horizon")}
        >
          지평선 두 점 찍기 ({marks.horizon.length}/2)
        </button>
        <button
          className={cn("btn btn-xs", picking === "moon" && "btn-primary")}
          onClick={() => onPick(picking === "moon" ? null : "moon")}
        >
          달 찍기 {marks.moon ? "✓" : "(있으면)"}
        </button>
        <button className="btn btn-xs btn-ghost" onClick={onClear}>
          지우기
        </button>
        <label className="flex items-center gap-1">
          경도
          <input
            type="number"
            className="input input-xs w-20"
            value={lonDeg}
            onChange={(e) => setLonDeg(Number(e.target.value))}
          />
        </label>
        <label className="flex items-center gap-1">
          연도
          <input
            type="number"
            className="input input-xs w-20"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
      </div>
      {picking && (
        <div className="text-info text-xs">
          {picking === "horizon"
            ? "사진에서 땅과 하늘이 만나는 곳(먼 산·바다 끝)을 좌우로 떨어진 두 곳 클릭하세요."
            : "사진에서 달(또는 달빛 중심)을 클릭하세요."}
        </div>
      )}
      {result && (
        <>
          <div className="text-xs opacity-70">
            위도 약 {result.clock.latDeg.toFixed(0)}° · 지방 항성시{" "}
            {(result.clock.lstDeg / 15).toFixed(2)}시 · 해가 12° 아래인 밤만
            {marks.moon
              ? " · 달 위치가 맞는 순 (달은 27일마다 같은 자리로 와서, 달 모양으로 가르세요)"
              : " · 같은 하늘은 하루 4분씩 일찍 옵니다 (보름 간격만 표시)"}
          </div>
          <ul className="grid grid-cols-2 gap-1 md:grid-cols-3">
            {shown.map((c) => {
              const local = toLocal(c);

              return (
                <li key={c.date.getTime()}>
                  <button
                    className="btn btn-xs btn-ghost w-full justify-start font-normal"
                    onClick={() =>
                      onApply({
                        local,
                        offset,
                        observer: {
                          latDeg: result.clock.latDeg,
                          lonDeg,
                        },
                        source: "manual",
                        note: "사진에서 추정",
                      })
                    }
                  >
                    {local.replace("T", " ")}
                    {c.moonErrorDeg !== undefined &&
                      ` · 달 ${c.moonErrorDeg.toFixed(1)}° · ${moonShape(c.moonLit!)}`}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

// 빛나는 비율 → 사람이 아는 달 모양
const moonShape = (lit: number) =>
  lit < 0.1
    ? "그믐/초승 직전"
    : lit < 0.35
      ? "초승·그믐달"
      : lit < 0.65
        ? "반달"
        : lit < 0.9
          ? "볼록한 달"
          : "보름";
