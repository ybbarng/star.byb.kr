"use client";

import type { GeoProblem } from "@/game/geo/problem";
import type { Point2D } from "@/scripts/hash/types";
import { useEffect, useRef, useState } from "react";
import { GEO_SETTINGS } from "@/game/geo/problem";
import { CONSTELLATIONS, STARS } from "@/game/sky/catalog";
import { drawSky } from "@/game/sky/drawSky";
import { horizonCameraTP } from "@/search/horizonSolve";
import { horizontalFrameJ2000, julianDay } from "@/search/utils/ephemeris";
import { projectVecToPhoto } from "@/search/utils/wcs";

// 360° 밤하늘 보기: 끌어서 사방을 둘러보고(가로: 방위, 세로: 고도), 휠로 확대·축소한다.
// 타임랩스를 켜면 지난 한 시간 동안 밝은 별이 지나온 궤적을 그린다 (궤적이 휘는 중심이 천구의 극).

const W = 1280;
const H = 720;
const FOV_MIN = 35;
const FOV_MAX = 110;
const TRAIL_MINUTES = 60;
const TRAIL_STARS = STARS.filter((s) => s.mag < 3.6);
const DIRECTIONS = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];

export default function SkyViewer({
  problem,
  compass,
  timelapse,
  constellations,
}: {
  problem: GeoProblem;
  compass: boolean;
  timelapse: boolean;
  constellations: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState({
    az: problem.startAzimuthDeg,
    alt: 25,
    fov: 80,
  });
  const drag = useRef<{ x: number; y: number; az: number; alt: number } | null>(
    null,
  );
  const set = GEO_SETTINGS[problem.difficulty];

  useEffect(() => {
    setView({ az: problem.startAzimuthDeg, alt: 25, fov: 80 });
  }, [problem]);

  // 휠로 확대·축소 (페이지가 스크롤되지 않게 직접 붙인다)
  useEffect(() => {
    const el = canvas.current;

    if (!el) {
      return;
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setView((v) => ({
        ...v,
        fov: Math.max(
          FOV_MIN,
          Math.min(FOV_MAX, v.fov * (e.deltaY > 0 ? 1.1 : 1 / 1.1)),
        ),
      }));
    };

    el.addEventListener("wheel", onWheel, { passive: false });

    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");

    if (!ctx) {
      return;
    }

    const cam = (date: Date) =>
      horizonCameraTP(
        date,
        problem.observer,
        {
          azimuthDeg: view.az,
          altitudeDeg: view.alt,
          rollDeg: 0,
          fovDeg: view.fov,
        },
        W,
        H,
      );
    const TP = cam(problem.date);

    drawSky(ctx, {
      width: W,
      height: H,
      TP,
      date: problem.date,
      observer: problem.observer,
      azimuthDeg: view.az,
      magLimit: set.magLimit,
      lightPollution: set.lightPollution,
      groundSeed: problem.groundSeed,
      stars: STARS,
      compass,
      mountains: problem.mountains,
      clouds: problem.clouds,
      constellations: constellations ? CONSTELLATIONS : undefined,
    });

    if (timelapse) {
      // 카메라는 땅에 고정, 시간만 거꾸로: 별이 지나온 길
      const steps = 12;
      const frames = Array.from({ length: steps + 1 }, (_, i) => {
        const date = new Date(
          problem.date.getTime() - ((TRAIL_MINUTES * i) / steps) * 60000,
        );

        return {
          TP: cam(date),
          zenith: horizontalFrameJ2000(julianDay(date), problem.observer)
            .zenith,
        };
      });
      ctx.save();
      ctx.strokeStyle = "rgba(170,210,255,0.55)";
      ctx.lineWidth = 1.5;

      for (const s of TRAIL_STARS) {
        ctx.beginPath();
        let pen = false;

        for (const f of frames) {
          const up =
            s.vector[0] * f.zenith[0] +
            s.vector[1] * f.zenith[1] +
            s.vector[2] * f.zenith[2];
          const p: Point2D | null =
            up > 0.05 ? projectVecToPhoto(f.TP, s.vector) : null;

          if (!p) {
            pen = false;
            continue;
          }

          if (pen) {
            ctx.lineTo(p[0], p[1]);
          } else {
            ctx.moveTo(p[0], p[1]);
          }

          pen = true;
        }

        ctx.stroke();
      }

      ctx.restore();
    }
  }, [problem, view, compass, timelapse, constellations, set]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, az: view.az, alt: view.alt };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current) {
      return;
    }

    const degPerPx = view.fov / e.currentTarget.getBoundingClientRect().width;
    const az =
      (((drag.current.az - (e.clientX - drag.current.x) * degPerPx) % 360) +
        360) %
      360;
    const alt = Math.max(
      -5,
      Math.min(85, drag.current.alt + (e.clientY - drag.current.y) * degPerPx),
    );
    setView((v) => ({ ...v, az, alt }));
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div className="relative">
      <canvas
        ref={canvas}
        width={W}
        height={H}
        className="rounded-box block w-full cursor-grab touch-none bg-black active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {compass && (
        <div className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/55 px-3 py-1 text-xs backdrop-blur">
          {DIRECTIONS[Math.round(view.az / 45) % 8]}쪽을 보고 있어요
          {problem.difficulty === "easy" &&
            ` · 화면 가운데 고도 ${Math.round(view.alt)}°`}
        </div>
      )}
      <div className="absolute right-3 bottom-3 flex gap-1">
        <button
          className="btn btn-xs btn-circle"
          aria-label="확대"
          onClick={() =>
            setView((v) => ({ ...v, fov: Math.max(FOV_MIN, v.fov / 1.2) }))
          }
        >
          +
        </button>
        <button
          className="btn btn-xs btn-circle"
          aria-label="축소"
          onClick={() =>
            setView((v) => ({ ...v, fov: Math.min(FOV_MAX, v.fov * 1.2) }))
          }
        >
          −
        </button>
      </div>
    </div>
  );
}
