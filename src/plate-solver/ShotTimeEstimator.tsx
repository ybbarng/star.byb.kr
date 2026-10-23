import type { ShotTime } from "@/plate-solver/shotTime";
import type { EstimateMarks } from "@/plate-solver/types";
import type { ShotCandidate } from "@/search/shotTimeEstimate";
import type { Mat3 } from "@/search/utils/similarity";
import { useMemo, useState } from "react";
import { BasicsTerm } from "@/learn/basics/BasicsLinks";
import { ESTIMATED_SHOT_NOTE } from "@/plate-solver/shotTime";
import {
  estimateShotTimes,
  skyClockOf,
  zenithFromHorizon,
} from "@/search/shotTimeEstimate";
import { photoToSky } from "@/search/utils/wcs";

// 사진에서 촬영 시각을 거꾸로 찾는다 (발표 "이과생의 별 헤는 밤"을 계산으로).
// 지평선 두 점(과 있으면 달)이 있으면, 같은 하늘이 되는 밤 시각을 날짜별로 보여 준다.
// 지평선·달은 별 고치기 화면에서 찍는다.

const MAX_SHOWN = 12;

export default function ShotTimeEstimator({
  transform,
  width,
  shot,
  marks,
  onApply,
  onPickHorizon,
}: {
  transform: Mat3; // 풀린 변환
  width: number;
  shot: ShotTime | null;
  marks: EstimateMarks;
  onApply: (shot: ShotTime) => void;
  onPickHorizon: () => void;
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

  if (marks.horizon.length < 2) {
    return (
      <div className="flex flex-col gap-2">
        <p className="opacity-70">
          사진에 지평선(먼 산·바다 끝)이 보이면, 하늘의 기울기로 위도와 촬영
          시각을 거꾸로 계산할 수 있어요.
        </p>
        <button className="btn btn-sm self-start" onClick={onPickHorizon}>
          지평선 찍으러 가기
        </button>
      </div>
    );
  }

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
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
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
        <button className="btn btn-xs btn-ghost" onClick={onPickHorizon}>
          지평선·달 고치기
        </button>
      </div>
      {!result && (
        <p className="opacity-70">
          이 지평선으로는 하늘의 기울기를 알 수 없어요. 지평선을 다시 찍어
          보세요.
        </p>
      )}
      {result && (
        <>
          <p className="text-xs opacity-70">
            위도 약 {result.clock.latDeg.toFixed(0)}° · 해가 진 밤만
            {marks.moon ? (
              " · 달 위치가 맞는 순 (달은 27일마다 같은 자리로 와서, 달 모양으로 가르세요)"
            ) : (
              <>
                {" · 같은 하늘은 "}
                <BasicsTerm slug="sidereal-day">하루 4분씩 일찍</BasicsTerm>
                {" 와서 보름 간격으로만 보여요. 달을 찍으면 날짜가 좁혀져요"}
              </>
            )}
          </p>
          <ul className="grid grid-cols-2 gap-1">
            {shown.map((c) => {
              const local = toLocal(c);

              return (
                <li key={c.date.getTime()}>
                  <button
                    className="btn btn-xs btn-ghost w-full justify-start font-normal"
                    title="이 시각으로 해·달·행성을 그려요"
                    onClick={() =>
                      onApply({
                        local,
                        offset,
                        observer: {
                          latDeg: result.clock.latDeg,
                          lonDeg,
                        },
                        source: "manual",
                        note: ESTIMATED_SHOT_NOTE,
                      })
                    }
                  >
                    {local.replace("T", " ")}
                    {c.moonErrorDeg !== undefined &&
                      ` · ${moonShape(c.moonLit!)}`}
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
