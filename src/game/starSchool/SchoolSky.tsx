"use client";

import type { Mark } from "@/game/starSchool/lessons";
import type { SkyRing, SkyView } from "@/game/starSchool/schoolSkyDraw";
import type { SkyPlace } from "@/game/starSchool/skyMath";
import type { Point3D } from "@/scripts/hash/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { markVectors } from "@/game/starSchool/lessonGeometry";
import {
  aimView,
  drawSchoolSky,
  FOV_MAX,
  FOV_MIN,
} from "@/game/starSchool/schoolSkyDraw";
import { directionWord, observerOf } from "@/game/starSchool/skyMath";
import { horizonCameraTP } from "@/search/horizonSolve";
import { projectVecToPhoto } from "@/search/utils/wcs";

export type { SkyRing } from "@/game/starSchool/schoolSkyDraw";

const D = Math.PI / 180;

export interface SkyTargets {
  vectors: Point3D[];
  tolDeg: number;
}

// 별자리 익히기의 하늘 보기: 그 장소·시각의 실제 하늘에 길잡이 모양·징검다리 화살표·딥스카이·황도·은하수를 겹쳐 그린다.
// 다룰 것이 다 들어오게 카메라를 맞추고, 끌어서 둘러보고 +/−로 확대·축소한다. 누르면 찾을 자리 근처인지 알려 준다.

export default function SchoolSky({
  place,
  date,
  magLimit,
  lightPollution,
  marks,
  aim,
  look,
  aimKey,
  targets,
  onTap,
  rings = [],
  className,
  quiet = false,
}: {
  place: SkyPlace;
  date: Date;
  magLimit: number;
  lightPollution: number;
  marks: Mark[];
  aim?: Point3D[]; // 카메라를 맞출 방향들 (없으면 표시들로)
  look?: SkyView; // 정해 둔 카메라 (지평선부터 머리 위까지처럼 방향들로 맞추기 어려울 때)
  aimKey: string; // 바뀌면 카메라를 다시 맞춘다
  targets?: SkyTargets | null;
  // 하늘을 눌렀을 때: 찾을 자리 중 몇 번째 근처인지 (아니면 −1), 누른 방향
  onTap?: (index: number) => void;
  rings?: SkyRing[];
  className?: string;
  quiet?: boolean; // 찾기 문제를 푸는 동안: 별·딥스카이 이름표를 숨긴다
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 320, h: 320 });
  const aimVectors = useMemo(
    () => aim ?? marks.flatMap(markVectors),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aimKey],
  );
  const startView = () => look ?? aimView(aimVectors, date, place);
  const [view, setView] = useState(startView);
  const drag = useRef<{ x: number; y: number; az: number; alt: number } | null>(
    null,
  );
  const tpRef = useRef<ReturnType<typeof horizonCameraTP> | null>(null);
  const observer = useMemo(() => observerOf(place), [place]);

  // 크기: 좁은 화면은 정사각형에 가깝게, 넓은 화면은 가로로
  useEffect(() => {
    const el = wrap.current;

    if (!el) return;

    const fit = () => {
      const w = Math.max(280, Math.round(el.clientWidth));
      const h = Math.round(w < 560 ? w * 1.05 : Math.min(w * 0.62, 640));
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setView(startView());
    // 단계가 바뀔 때만 다시 맞춘다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aimKey]);

  // 휠로 확대·축소
  useEffect(() => {
    const el = canvas.current;

    if (!el) return;

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
    const el = canvas.current;
    const ctx = el?.getContext("2d");

    if (!el || !ctx) return;

    const k = Math.min(2, window.devicePixelRatio || 1);
    const { w: W, h: H } = size;

    el.width = Math.round(W * k);
    el.height = Math.round(H * k);
    ctx.setTransform(k, 0, 0, k, 0, 0);

    tpRef.current = drawSchoolSky(ctx, {
      width: W,
      height: H,
      view,
      date,
      observer,
      magLimit,
      lightPollution,
      marks,
      rings,
      quiet,
    });
  }, [
    size,
    view,
    date,
    observer,
    marks,
    magLimit,
    lightPollution,
    rings,
    quiet,
  ]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, az: view.az, alt: view.alt };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current) return;

    const degPerPx = view.fov / Math.min(size.w, size.h);
    const az =
      (((drag.current.az - (e.clientX - drag.current.x) * degPerPx) % 360) +
        360) %
      360;
    const alt = Math.max(
      -5,
      Math.min(88, drag.current.alt + (e.clientY - drag.current.y) * degPerPx),
    );
    setView((v) => ({ ...v, az, alt }));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    drag.current = null;

    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) >= 6 || !onTap) {
      return;
    }

    const TP = tpRef.current;

    if (!TP) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * size.w;
    const y = ((e.clientY - rect.top) / rect.height) * size.h;
    const pxPerDeg =
      (Math.min(size.w, size.h) / 2 / Math.tan((view.fov / 2) * D)) * D;
    let hit = -1;
    let bestDist = Infinity;

    (targets?.vectors ?? []).forEach((v, i) => {
      const p = projectVecToPhoto(TP, v);

      if (!p) return;

      const dist = Math.hypot(p[0] - x, p[1] - y);
      const tol = Math.max(20, (targets?.tolDeg ?? 3) * pxPerDeg);

      if (dist <= tol && dist < bestDist) {
        bestDist = dist;
        hit = i;
      }
    });

    onTap(hit);
  };

  return (
    <div ref={wrap} className={className ?? "relative w-full min-w-0"}>
      <canvas
        ref={canvas}
        style={{ width: size.w, height: size.h }}
        className="rounded-box block max-w-full cursor-grab touch-none bg-black active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
      />
      <div className="pointer-events-none absolute top-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-xs backdrop-blur">
        {directionWord(view.az)}쪽 · 높이 {Math.round(view.alt)}°
      </div>
      <div className="absolute right-2 bottom-2 flex gap-1">
        <button className="btn btn-xs" onClick={() => setView(startView())}>
          처음 자리
        </button>
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
