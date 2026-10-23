"use client";

import type { MapGuides, MapPin, MapView } from "@/game/geo/drawMap";
import { useEffect, useRef, useState } from "react";
import { drawWorldMap, mapProjection } from "@/game/geo/drawMap";
import { clockLabel } from "@/game/geo/problem";

// 세계 지도: 끌어서 옮기고 휠·버튼으로 확대, 누르면 핀. 그 순간(UTC)의 낮밤 음영이 "세계 시계"다.
// hoverTime이면 커서 자리의 현지 시각(UTC에서 계산, 하늘 미리보기가 아니다)을 보여 준다.

const MIN_ZOOM = 2;
const MAX_ZOOM = 30;
const ASPECT = 0.5;
const MAX_HEIGHT = 560;

export default function WorldMap({
  utc,
  timeBands,
  hoverTime,
  pins,
  line,
  onPick,
  focus,
  shade,
  guides,
}: {
  utc: Date;
  timeBands: boolean;
  hoverTime: boolean;
  pins: MapPin[];
  line?: [MapPin, MapPin];
  onPick?: (latDeg: number, lonDeg: number) => void;
  focus?: { latDeg: number; lonDeg: number }; // 결과 화면: 이곳을 가운데로
  shade?: boolean; // 낮밤 음영 (기본 켬)
  guides?: MapGuides; // 위도 띠·선, 경도 선
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const fitted = useRef(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 900, h: 450 });
  const [view, setView] = useState<MapView>({
    centerLon: 0,
    centerLat: 10,
    pxPerDeg: 2.5,
  });
  const [hover, setHover] = useState<{ lat: number; lon: number } | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    lon: number;
    lat: number;
    moved: boolean;
  } | null>(null);

  // 크기: 너비를 채우고 높이는 너비의 절반 (상한)
  useEffect(() => {
    const el = wrapper.current;

    if (!el) {
      return;
    }

    const measure = () => {
      const w = el.clientWidth;
      const h = Math.min(MAX_HEIGHT, Math.round(w * ASPECT));
      setSize({ w, h });

      // 처음엔 세계 전체가 가로를 채우게
      if (!fitted.current) {
        fitted.current = true;
        setView((v) => ({ ...v, pxPerDeg: w / 360 }));
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (focus) {
      setView((v) => ({
        ...v,
        centerLon: focus.lonDeg,
        centerLat: Math.max(-60, Math.min(60, focus.latDeg)),
      }));
    }
  }, [focus]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");

    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    ctx.canvas.width = Math.round(size.w * dpr);
    ctx.canvas.height = Math.round(size.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWorldMap(ctx, size.w, size.h, view, utc, {
      timeBands,
      pins,
      line,
      shade,
      guides,
    });
  }, [size, view, utc, timeBands, pins, line, shade, guides]);

  // 휠 확대 (커서 자리를 고정한 채)
  useEffect(() => {
    const el = canvas.current;

    if (!el) {
      return;
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setView((v) => {
        const P = mapProjection(rect.width, rect.height, v);
        const lon = P.lon(x);
        const lat = P.lat(y);
        const pxPerDeg = Math.max(
          Math.max(MIN_ZOOM, rect.width / 360),
          Math.min(MAX_ZOOM, v.pxPerDeg * (e.deltaY > 0 ? 1 / 1.2 : 1.2)),
        );

        return {
          pxPerDeg,
          centerLon: lon - (x - rect.width / 2) / pxPerDeg,
          centerLat: clampLat(lat + (y - rect.height / 2) / pxPerDeg),
        };
      });
    };

    el.addEventListener("wheel", onWheel, { passive: false });

    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const toLatLon = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const P = mapProjection(rect.width, rect.height, view);
    const lon =
      ((((P.lon(e.clientX - rect.left) + 180) % 360) + 360) % 360) - 180;

    return { lat: P.lat(e.clientY - rect.top), lon };
  };

  const zoom = (k: number) =>
    setView((v) => ({
      ...v,
      pxPerDeg: Math.max(
        Math.max(MIN_ZOOM, size.w / 360),
        Math.min(MAX_ZOOM, v.pxPerDeg * k),
      ),
    }));

  const utcMinutes = utc.getUTCHours() * 60 + utc.getUTCMinutes();
  const hoverClock =
    hover &&
    clockLabel((((utcMinutes + (hover.lon / 15) * 60) % 1440) + 1440) % 1440);

  return (
    <div ref={wrapper} className="relative w-full">
      <canvas
        ref={canvas}
        style={{ width: size.w, height: size.h }}
        className="rounded-box block cursor-crosshair touch-none"
        onPointerDown={(e) => {
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            lon: view.centerLon,
            lat: view.centerLat,
            moved: false,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const p = toLatLon(e);
          setHover(Math.abs(p.lat) <= 90 ? p : null);

          if (!drag.current) {
            return;
          }

          const dx = e.clientX - drag.current.x;
          const dy = e.clientY - drag.current.y;

          if (Math.hypot(dx, dy) > 5) {
            drag.current.moved = true;
          }

          if (drag.current.moved) {
            const d = drag.current;
            setView((v) => ({
              ...v,
              centerLon: d.lon - dx / v.pxPerDeg,
              centerLat: clampLat(d.lat + dy / v.pxPerDeg),
            }));
          }
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;

          if (d && !d.moved && onPick) {
            const p = toLatLon(e);

            if (Math.abs(p.lat) <= 85) {
              onPick(p.lat, p.lon);
            }
          }
        }}
        onPointerLeave={() => setHover(null)}
      />
      {hoverTime && hover && hoverClock && (
        <div className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs backdrop-blur">
          이곳 현지 시각 약 <b>{hoverClock}</b>
        </div>
      )}
      <div className="absolute right-3 bottom-3 flex gap-1">
        <button
          className="btn btn-xs btn-circle"
          aria-label="지도 확대"
          onClick={() => zoom(1.4)}
        >
          +
        </button>
        <button
          className="btn btn-xs btn-circle"
          aria-label="지도 축소"
          onClick={() => zoom(1 / 1.4)}
        >
          −
        </button>
      </div>
    </div>
  );
}

const clampLat = (lat: number) => Math.max(-70, Math.min(70, lat));
