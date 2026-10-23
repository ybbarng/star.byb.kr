"use client";

import type { Place } from "@/game/tonight/places";
import { useEffect, useRef } from "react";
import { LAND_POLYGONS } from "@/game/geo/world";
import { CITIES, placeAt } from "@/game/tonight/places";

// 오늘 밤 내 하늘: 세계 지도를 눌러 장소 고르기 (경위도를 그대로 펼친 지도, 육지는 SkyGuessr와 같은 자료)

const W = 720;
const H = 360;

const toXY = (lon: number, lat: number): [number, number] => [
  ((lon + 180) / 360) * W,
  ((90 - lat) / 180) * H,
];

export default function MapPicker({
  value,
  onPick,
}: {
  value: Place;
  onPick: (p: Place) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");

    if (!ctx) {
      return;
    }

    ctx.fillStyle = "#16204a";
    ctx.fillRect(0, 0, W, H);

    // 경위선 30°마다
    ctx.strokeStyle = "rgba(160,190,255,0.12)";
    ctx.lineWidth = 1;

    for (let lon = -150; lon <= 150; lon += 30) {
      const [x] = toXY(lon, 0);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    for (let lat = -60; lat <= 60; lat += 30) {
      const [, y] = toXY(0, lat);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#3e5a8f";

    for (const poly of LAND_POLYGONS) {
      ctx.beginPath();

      for (const ring of poly) {
        ring.forEach(([lon, lat], i) => {
          const [x, y] = toXY(lon, lat);

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.closePath();
      }

      ctx.fill("evenodd");
    }

    // 도시 점
    ctx.fillStyle = "rgba(255,224,138,0.7)";

    for (const c of CITIES) {
      const [x, y] = toXY(c.lonDeg, c.latDeg);
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 고른 곳: 별 핀
    const [px, py] = toXY(value.lonDeg, value.latDeg);
    ctx.fillStyle = "#ff9ecb";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 4 : 10;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(px + r * Math.cos(a), py + r * Math.sin(a));
    }

    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }, [value]);

  return (
    <canvas
      ref={canvas}
      width={W}
      height={H}
      className="block w-full cursor-crosshair rounded-2xl"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const lon = ((e.clientX - r.left) / r.width) * 360 - 180;
        const lat = 90 - ((e.clientY - r.top) / r.height) * 180;
        onPick(placeAt(Math.max(-85, Math.min(85, lat)), lon));
      }}
    />
  );
}
