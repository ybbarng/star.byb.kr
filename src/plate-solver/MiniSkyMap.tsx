"use client";

import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  constellationCenter,
  constellationParts,
  CONSTELLATIONS,
  STARS,
} from "@/game/sky/catalog";
import { boundaryEdges } from "@/search/utils/constellationBounds";
import { photoToSky, projectVecToPhoto } from "@/search/utils/wcs";

// 작은 천문도: 하늘 전체 지도 위에 사진이 담은 범위(초록 테두리)와 사진에서 찾은 별(빨간 원)을 겹친다.
// 빨간 원이 지도의 별 위에 앉으면 맞는 답이다. 끌어서 옮기고, 휠·버튼으로 확대한다.
// 지도는 적경·적위 평면(적경은 왼쪽으로 커진다, 하늘을 올려다본 방향). 가로는 보고 있는 적위의
// cos만큼 줄여, 화면 가운데에서는 모양이 사진과 비슷하게 보인다.

const HEIGHT = 240;
const D = Math.PI / 180;
const PHOTO_STARS = 60;

interface View {
  ra: number; // 가운데 적경 (°)
  dec: number; // 가운데 적위 (°)
  scale: number; // 1°당 화면 px
}

const raDecOf = (v: Point3D): [number, number] => [
  (Math.atan2(v[1], v[0]) / D + 360) % 360,
  Math.asin(Math.max(-1, Math.min(1, v[2]))) / D,
];

const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

// 별자리 이름 자리 (선 그림의 가운데)
const LABELS = [...new Set(CONSTELLATIONS.map((c) => c.label))].map(
  (label) => ({
    label,
    at: raDecOf(constellationCenter(constellationParts(label))),
  }),
);

export default function MiniSkyMap({
  transform,
  width,
  height,
  photoStars,
}: {
  transform: Mat3;
  width: number;
  height: number;
  photoStars: { x: number; y: number }[];
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [mapWidth, setMapWidth] = useState(340);
  const drag = useRef<{ x: number; y: number } | null>(null);

  // 사진 테두리(변마다 16점)와 찾은 별의 하늘 위치
  const footprint = useMemo(() => {
    const pts: Point2D[] = [];
    const N = 16;

    for (let i = 0; i < N; i++) pts.push([(width * i) / N, 0]);
    for (let i = 0; i < N; i++) pts.push([width, (height * i) / N]);
    for (let i = 0; i < N; i++) pts.push([width - (width * i) / N, height]);
    for (let i = 0; i < N; i++) pts.push([0, height - (height * i) / N]);

    return pts.map((p) => raDecOf(photoToSky(transform, p)));
  }, [transform, width, height]);
  // 사진에서 찾은 별 중 지도 별과 겹치는 것(풀이와 같은 허용 반경)과 아닌 것
  const photoSky = useMemo(() => {
    const tol = Math.max(5, Math.hypot(width, height) * 0.006);
    const mapPx = STARS.map((s) =>
      projectVecToPhoto(transform, s.vector),
    ).filter(
      (p): p is Point2D =>
        p !== null &&
        p[0] > -tol &&
        p[0] < width + tol &&
        p[1] > -tol &&
        p[1] < height + tol,
    );

    return photoStars.slice(0, PHOTO_STARS).map((s) => ({
      at: raDecOf(photoToSky(transform, [s.x, s.y])),
      matched: mapPx.some((m) => Math.hypot(m[0] - s.x, m[1] - s.y) < tol),
    }));
  }, [transform, photoStars, width, height]);
  const center = useMemo(
    () => raDecOf(photoToSky(transform, [width / 2, height / 2])),
    [transform, width, height],
  );
  // 사진의 대각선 화각
  const diagDeg = useMemo(() => {
    const a = photoToSky(transform, [0, 0]);
    const b = photoToSky(transform, [width, height]);

    return Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) / D;
  }, [transform, width, height]);

  const fitView = (): View => ({
    ra: center[0],
    dec: center[1],
    scale: mapWidth / Math.max(30, diagDeg * 2.5),
  });
  const [view, setView] = useState<View>(fitView);

  // 답이 바뀌면 그 사진에 맞춘다
  useEffect(() => {
    setView(fitView());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 답(center·화각)이 바뀔 때만 맞춘다
  }, [center[0], center[1], diagDeg]);

  // 휠로 확대할 때 페이지가 같이 스크롤되지 않게 (React의 onWheel은 막을 수 없어 직접 붙인다)
  useEffect(() => {
    const el = canvas.current;

    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomRef.current(e.deltaY < 0 ? 1.15 : 1 / 1.15);
    };

    el.addEventListener("wheel", onWheel, { passive: false });

    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (!box.current) return;

    const observer = new ResizeObserver(([entry]) =>
      setMapWidth(Math.round(entry.contentRect.width)),
    );
    observer.observe(box.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = canvas.current;
    const context = el?.getContext("2d");

    if (!el || !context) return;

    const W = mapWidth;
    const H = HEIGHT;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = W * dpr;
    el.height = H * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = "#0b0f22";
    context.fillRect(0, 0, W, H);

    const k = Math.max(0.25, Math.cos(view.dec * D));
    const toXY = ([ra, dec]: [number, number]): Point2D => [
      W / 2 - wrap(ra - view.ra) * view.scale * k,
      H / 2 - (dec - view.dec) * view.scale,
    ];

    // 적경 0°/360° 이음매를 넘는 선분은 끊는다
    const polyline = (pts: [number, number][]) => {
      context.beginPath();
      let prev: Point2D | null = null;

      for (const p of pts.map(toXY)) {
        if (prev && Math.abs(p[0] - prev[0]) < W) context.lineTo(p[0], p[1]);
        else context.moveTo(p[0], p[1]);

        prev = p;
      }

      context.stroke();
    };

    // 격자: 적경 1시간(15°)·적위 15°마다
    context.strokeStyle = "rgba(160,180,255,0.08)";
    context.lineWidth = 1;

    for (let ra = 0; ra < 360; ra += 15) {
      polyline(
        Array.from({ length: 13 }, (_, i): [number, number] => [
          ra,
          -90 + i * 15,
        ]),
      );
    }

    for (let dec = -75; dec <= 75; dec += 15) {
      polyline(
        Array.from({ length: 73 }, (_, i): [number, number] => [i * 5, dec]),
      );
    }

    // 별자리 경계 (점선)
    context.setLineDash([3, 3]);
    context.strokeStyle = "rgba(140,190,255,0.3)";

    for (const edge of boundaryEdges()) {
      polyline(edge.map(raDecOf));
    }

    context.setLineDash([]);

    // 별자리선
    context.strokeStyle = "rgba(253,230,138,0.45)";

    for (const c of CONSTELLATIONS) {
      polyline(c.stars.map(raDecOf));
    }

    // 별 (밝을수록 크게)
    for (const s of STARS) {
      const [x, y] = toXY(raDecOf(s.vector));

      if (x < -5 || x > W + 5 || y < -5 || y > H + 5) continue;

      const r = Math.max(
        0.5,
        (2.4 - s.mag * 0.4) * Math.min(1.6, Math.max(0.7, view.scale / 8)),
      );
      context.fillStyle = "rgba(235,240,255,0.9)";
      context.beginPath();
      context.arc(x, y, r, 0, 2 * Math.PI);
      context.fill();

      if (s.name && s.mag < 2 && view.scale > 5) {
        context.fillStyle = "rgba(196,181,253,0.85)";
        context.font = "10px sans-serif";
        context.fillText(s.name, x + 4, y - 3);
      }
    }

    // 별자리 이름
    if (view.scale > 1.5) {
      context.fillStyle = "rgba(253,230,138,0.7)";
      context.font = "11px sans-serif";
      context.textAlign = "center";

      for (const { label, at } of LABELS) {
        const [x, y] = toXY(at);

        if (x > 0 && x < W && y > 0 && y < H) context.fillText(label, x, y);
      }

      context.textAlign = "start";
    }

    // 사진이 담은 범위와 사진에서 찾은 별
    context.strokeStyle = "#4ade80";
    context.fillStyle = "rgba(74,222,128,0.08)";
    context.lineWidth = 1.5;
    context.beginPath();
    footprint
      .map(toXY)
      .forEach(([x, y], i) =>
        i ? context.lineTo(x, y) : context.moveTo(x, y),
      );
    context.closePath();
    context.fill();
    context.stroke();

    context.strokeStyle = "rgba(248,113,113,0.95)";
    context.lineWidth = 1.2;

    for (const { at, matched } of photoSky) {
      const [x, y] = toXY(at);

      if (matched) {
        context.beginPath();
        context.arc(
          x,
          y,
          Math.max(2.5, Math.min(6, view.scale * 0.35)),
          0,
          2 * Math.PI,
        );
        context.stroke();
      } else {
        context.fillStyle = "rgba(248,113,113,0.35)";
        context.fillRect(x - 1, y - 1, 2, 2);
      }
    }
  }, [view, mapWidth, footprint, photoSky]);

  const zoom = (factor: number) =>
    setView((v) => ({
      ...v,
      scale: Math.max(mapWidth / 400, Math.min(60, v.scale * factor)),
    }));
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  return (
    <div className="flex flex-col gap-2">
      <div ref={box} className="relative">
        <canvas
          ref={canvas}
          className="rounded-box block w-full cursor-grab touch-none active:cursor-grabbing"
          style={{ height: HEIGHT }}
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, y: e.clientY };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = drag.current;

            if (!d) return;

            const dx = e.clientX - d.x;
            const dy = e.clientY - d.y;
            drag.current = { x: e.clientX, y: e.clientY };
            setView((v) => {
              const k = Math.max(0.25, Math.cos(v.dec * D));

              return {
                ...v,
                ra: (v.ra + dx / (v.scale * k) + 360) % 360,
                dec: Math.max(-85, Math.min(85, v.dec + dy / v.scale)),
              };
            });
          }}
          onPointerUp={() => (drag.current = null)}
        />
        <div className="absolute top-2 right-2 flex gap-1">
          <button
            className="btn btn-xs"
            onClick={() => zoom(1.4)}
            aria-label="확대"
          >
            +
          </button>
          <button
            className="btn btn-xs"
            onClick={() => zoom(1 / 1.4)}
            aria-label="축소"
          >
            −
          </button>
          <button className="btn btn-xs" onClick={() => setView(fitView())}>
            사진
          </button>
          <button
            className="btn btn-xs"
            onClick={() =>
              setView({ ra: center[0], dec: 0, scale: mapWidth / 360 })
            }
          >
            전체
          </button>
        </div>
      </div>
      <p className="text-xs opacity-60">
        초록 테두리가 사진이 담은 하늘이에요. 빨간 원은 사진에서 찾은 별 중
        지도의 별과 겹친 것, 흐린 점은 겹치지 않은 것(땅 불빛 등)이에요.
        확대해서 빨간 원이 지도 별 위에 앉아 있는지 보세요.
      </p>
    </div>
  );
}
