"use client";

import type { SkyItem } from "@/game/sky/drawSky";
import type { AgeStar } from "@/game/timeCapsule/capsule";
import { useEffect, useMemo, useRef, useState } from "react";
import { pickItem, STARS } from "@/game/sky/catalog";
import { drawSky } from "@/game/sky/drawSky";
import { canvasPoint } from "@/game/sky/ItemInfo";
import { SCENE_HEIGHT, SCENE_WIDTH } from "@/game/sky/scene";
import {
  ageStars,
  bestMonthOf,
  departure,
  distanceOf,
  yearLabel,
} from "@/game/timeCapsule/capsule";
import { horizonCameraTP } from "@/search/horizonSolve";
import { projectVecToPhoto } from "@/search/utils/wcs";
import { cn } from "@/utils/cn";

// 빛의 타임캡슐 (docs/game-plans.md 2): 오늘 밤 9시 서울 하늘에서 별을 누르면, 그 빛이 언제 출발했는지와
// 그 무렵 지구에서 있었던 일을 보여 준다. 하늘의 별은 같은 순간이 아니라 서로 다른 과거의 모습이다.

const SEOUL = { latDeg: 37.57, lonDeg: 126.98 };
const DIRECTIONS = [
  ["북", 0],
  ["동", 90],
  ["남", 180],
  ["서", 270],
] as const;

// 오늘 밤 9시 (서울, UTC+9) = 그날 12:00 UTC
const tonight = () => {
  const now = new Date();

  return new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12),
  );
};

export default function TimeCapsuleGame() {
  const [azimuth, setAzimuth] = useState(180);
  const [picked, setPicked] = useState<SkyItem | null>(null);
  const [age, setAge] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const items = useRef<SkyItem[]>([]);
  const date = useMemo(tonight, []);
  const nowYear = date.getUTCFullYear();
  const TP = useMemo(
    () =>
      horizonCameraTP(
        date,
        SEOUL,
        { azimuthDeg: azimuth, altitudeDeg: 32, rollDeg: 0, fovDeg: 75 },
        SCENE_WIDTH,
        SCENE_HEIGHT,
      ),
    [date, azimuth],
  );
  const ageList = useMemo<AgeStar[]>(() => {
    const n = Number(age);

    return n > 0 && n < 200 ? ageStars(n) : [];
  }, [age]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");

    if (!ctx) {
      return;
    }

    items.current = drawSky(ctx, {
      width: SCENE_WIDTH,
      height: SCENE_HEIGHT,
      TP,
      date,
      observer: SEOUL,
      azimuthDeg: azimuth,
      magLimit: 4.5,
      lightPollution: 0.15,
      groundSeed: 7,
      stars: STARS,
      compass: true,
      // 별을 눌러 보는 게임이라 달빛에 별이 지워지지 않게 한다
      moonlightDimsStars: false,
    });

    // 고른 별(금색)과 내 나이 별(분홍)에 고리
    const ring = (x: number, y: number, color: string) => {
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    };

    for (const s of ageList) {
      const p = projectVecToPhoto(TP, s.vector);

      if (
        p &&
        p[0] > 0 &&
        p[0] < SCENE_WIDTH &&
        p[1] > 0 &&
        p[1] < SCENE_HEIGHT
      ) {
        ring(p[0], p[1], "rgba(255,130,190,0.95)");
      }
    }

    if (picked) {
      ring(picked.x, picked.y, "rgba(255,210,80,0.95)");
    }
  }, [TP, date, azimuth, picked, ageList]);

  const pickedDistance = picked?.id ? distanceOf(picked.id) : null;
  const trip = pickedDistance
    ? departure(pickedDistance.lightYears, nowYear)
    : null;

  return (
    <div className="flex w-full max-w-[1280px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">빛의 타임캡슐</h1>
        <span className="text-sm opacity-70">
          오늘 밤 9시 서울 하늘이에요. 별을 누르면 그 빛이 언제 출발했는지 알려
          줘요.
        </span>
        <div className="grow" />
        <div className="join">
          {DIRECTIONS.map(([label, az]) => (
            <button
              key={label}
              className={cn(
                "join-item btn btn-sm",
                azimuth === az && "btn-primary",
              )}
              onClick={() => {
                setAzimuth(az);
                setPicked(null);
              }}
            >
              {label}쪽
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <canvas
          ref={canvas}
          width={SCENE_WIDTH}
          height={SCENE_HEIGHT}
          className="rounded-box w-full cursor-pointer bg-black md:w-auto md:max-w-[880px] md:grow"
          onClick={(e) => {
            const p = canvasPoint(e);
            const it = pickItem(items.current, p.x, p.y);
            setPicked(it?.kind === "star" ? it : null);
          }}
        />
        <div className="flex w-full shrink-0 flex-col gap-4 md:w-80">
          <div className="bg-base-200 rounded-box flex flex-col gap-2 p-4 text-sm">
            {!picked ? (
              <div className="opacity-70">밝은 별을 눌러 보세요.</div>
            ) : !pickedDistance ? (
              <>
                <div className="font-bold">{picked.label}</div>
                <div className="opacity-70">이 별은 거리 기록이 없어요.</div>
              </>
            ) : (
              <>
                <div className="text-lg font-bold">{picked.label}</div>
                <div>
                  거리 {pickedDistance.reliable ? "" : "약 "}
                  {Math.round(pickedDistance.lightYears).toLocaleString()}광년
                  {!pickedDistance.reliable && " (아주 멀어 정확하지 않아요)"}
                </div>
                <div>
                  지금 보는 이 빛은 <b>{yearLabel(trip!.year)}</b>에 출발해{" "}
                  {Math.round(pickedDistance.lightYears).toLocaleString()}년
                  동안 날아왔어요.
                </div>
                <div className="rounded bg-black/30 p-2">
                  그 무렵 지구에서는 —{" "}
                  <b>
                    {yearLabel(trip!.event.year)} {trip!.event.text}
                  </b>
                  {trip!.gap > 0 && (
                    <span className="opacity-60"> ({trip!.gap}년 차이)</span>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="bg-base-200 rounded-box flex flex-col gap-2 p-4 text-sm">
            <div className="font-bold">내 나이 별</div>
            <div className="text-xs opacity-70">
              내가 태어날 무렵 출발한 빛이 지금 막 닿은 별이에요.
            </div>
            <input
              type="number"
              min={1}
              max={150}
              placeholder="나이"
              className="input input-sm w-28"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
            {ageList.map((s) => (
              <div key={s.hr}>
                <b>{s.name ?? `HR ${s.hr}`}</b> · {s.lightYears.toFixed(1)}광년
                · {s.mag.toFixed(1)}등급 · {bestMonthOf(s.vector)}월 저녁에 잘
                보여요
              </div>
            ))}
            {age && ageList.length === 0 && (
              <div className="opacity-60">
                그 나이만큼 떨어진 밝은 별이 없어요. 한두 살 바꿔 보세요.
              </div>
            )}
            {ageList.length > 0 && (
              <div className="text-xs opacity-60">
                오늘 밤 이 방향 하늘에 있으면 분홍 고리로 표시돼요.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
