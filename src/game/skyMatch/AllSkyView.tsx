"use client";

import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Observer } from "@/search/utils/ephemeris";
import type { Mat3 } from "@/search/utils/similarity";
import { useEffect, useRef } from "react";
import { CONSTELLATIONS, STARS } from "@/game/sky/catalog";
import {
  horizontalFrameJ2000,
  julianDay,
  localSiderealDeg,
} from "@/search/utils/ephemeris";
import { photoToSky } from "@/search/utils/wcs";

// 하늘 전체 뷰: 누워서 올려다본 둥근 하늘 (가운데 천정, 테두리 지평선, 위가 북, 왼쪽이 동).
// 사진이 찍힌 영역을 네모로, 천구의 북극(남반구면 남극)을 ★로 그린다. 위도를 돌리면 극이 그 높이로 오르내리고,
// 시각을 돌리면 별들이 극을 중심으로 돈다 — "위도는 기울기, 시각은 회전"이 한눈에 보이게.

const SIZE = 360;
const R = SIZE / 2 - 22;
const D = Math.PI / 180;
const MAG_LIMIT = 4.3;

export type Emphasis = "lat" | "time" | null;

export default function AllSkyView({
  date,
  observer,
  TP,
  photoWidth,
  photoHeight,
  emphasis,
}: {
  date: Date;
  observer: Observer;
  TP: Mat3; // 지금 내 하늘의 사진 변환 (사진 영역을 그린다)
  photoWidth: number;
  photoHeight: number;
  emphasis: Emphasis; // 방금 움직인 다이얼
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");

    if (!ctx) {
      return;
    }

    const jd = julianDay(date);
    const frame = horizontalFrameJ2000(jd, observer);
    const dot = (a: Point3D, b: Point3D) =>
      a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

    // 방향 → 둥근 하늘 위 점 (지평선 아래면 null)
    const toDome = (v: Point3D): Point2D | null => {
      const alt = Math.asin(Math.max(-1, Math.min(1, dot(v, frame.zenith))));

      if (alt < 0) {
        return null;
      }

      const az = Math.atan2(dot(v, frame.east), dot(v, frame.north));
      const r = ((Math.PI / 2 - alt) / (Math.PI / 2)) * R;

      return [SIZE / 2 - r * Math.sin(az), SIZE / 2 - r * Math.cos(az)];
    };

    const c = SIZE / 2;

    ctx.clearRect(0, 0, SIZE, SIZE);
    const sky = ctx.createRadialGradient(c, c, 0, c, c, R);
    sky.addColorStop(0, "#0b1430");
    sky.addColorStop(1, "#16234a");
    ctx.fillStyle = sky;
    ctx.beginPath();
    ctx.arc(c, c, R, 0, Math.PI * 2);
    ctx.fill();

    // 고도 30°·60° 동심원
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;

    for (const alt of [30, 60]) {
      ctx.beginPath();
      ctx.arc(c, c, ((90 - alt) / 90) * R, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 천구의 적도 (점선)
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle =
      emphasis === "lat" ? "rgba(140,200,255,0.9)" : "rgba(140,200,255,0.35)";
    ctx.lineWidth = emphasis === "lat" ? 2 : 1;
    ctx.beginPath();
    let pen = false;

    for (let a = 0; a <= 360; a += 3) {
      const p = toDome([Math.cos(a * D), Math.sin(a * D), 0]);

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
    ctx.setLineDash([]);

    // 별자리선
    ctx.strokeStyle = "rgba(160,190,255,0.25)";
    ctx.lineWidth = 1;

    for (const con of CONSTELLATIONS) {
      ctx.beginPath();
      let prev: Point2D | null = null;

      for (const v of con.stars) {
        const p = toDome(v);

        if (p && prev) {
          ctx.moveTo(prev[0], prev[1]);
          ctx.lineTo(p[0], p[1]);
        }

        prev = p;
      }

      ctx.stroke();
    }

    // 별
    for (const s of STARS) {
      if (s.mag > MAG_LIMIT) {
        continue;
      }

      const p = toDome(s.vector);

      if (p) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], Math.max(0.6, 2.4 - s.mag * 0.45), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${Math.min(1, 1.1 - s.mag * 0.15)})`;
        ctx.fill();
      }
    }

    // 사진이 찍힌 영역 (테두리를 따라 하늘 방향으로 되돌린다)
    const edge: Point2D[] = [];
    const n = 12;

    for (let i = 0; i <= n; i++) {
      edge.push([(photoWidth * i) / n, 0]);
    }

    for (let i = 0; i <= n; i++) {
      edge.push([photoWidth, (photoHeight * i) / n]);
    }

    for (let i = n; i >= 0; i--) {
      edge.push([(photoWidth * i) / n, photoHeight]);
    }

    for (let i = n; i >= 0; i--) {
      edge.push([0, (photoHeight * i) / n]);
    }

    ctx.strokeStyle = "rgba(250,210,80,0.9)";
    ctx.fillStyle = "rgba(250,210,80,0.08)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    pen = false;

    for (const e of edge) {
      const p = toDome(photoToSky(TP, e));

      if (!p) {
        continue;
      }

      if (pen) {
        ctx.lineTo(p[0], p[1]);
      } else {
        ctx.moveTo(p[0], p[1]);
      }

      pen = true;
    }

    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 천구의 극과, 시간이 흐를 때 별이 도는 방향
    const north = observer.latDeg >= 0;
    const pole: Point3D = [0, 0, north ? 1 : -1];
    const poleAt = toDome(pole);

    if (poleAt) {
      // 극 둘레 별 하나가 시간이 흐르며 지나가는 호 (시간각 -50°→+50°)
      const lst = localSiderealDeg(jd, observer);
      const dec = (north ? 72 : -72) * D;
      const arc: Point2D[] = [];

      for (let ha = -50; ha <= 50; ha += 5) {
        const ra = (lst - ha) * D;
        const p = toDome([
          Math.cos(dec) * Math.cos(ra),
          Math.cos(dec) * Math.sin(ra),
          Math.sin(dec),
        ]);

        if (p) {
          arc.push(p);
        }
      }

      if (arc.length > 2) {
        ctx.strokeStyle =
          emphasis === "time"
            ? "rgba(120,255,170,0.95)"
            : "rgba(120,255,170,0.5)";
        ctx.lineWidth = emphasis === "time" ? 3 : 2;
        ctx.beginPath();
        arc.forEach((p, i) =>
          i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]),
        );
        ctx.stroke();
        // 화살촉
        const [a, b] = [arc[arc.length - 2], arc[arc.length - 1]];
        const t = Math.atan2(b[1] - a[1], b[0] - a[0]);
        ctx.beginPath();
        ctx.moveTo(b[0], b[1]);
        ctx.lineTo(b[0] - 9 * Math.cos(t - 0.5), b[1] - 9 * Math.sin(t - 0.5));
        ctx.lineTo(b[0] - 9 * Math.cos(t + 0.5), b[1] - 9 * Math.sin(t + 0.5));
        ctx.closePath();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      }

      const big = emphasis === "lat";
      ctx.font = `${big ? 26 : 20}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = big ? "rgb(255,240,140)" : "rgb(255,225,120)";
      ctx.shadowColor = "rgba(255,220,100,0.9)";
      ctx.shadowBlur = big ? 14 : 6;
      ctx.fillText("★", poleAt[0], poleAt[1]);
      ctx.shadowBlur = 0;
      ctx.font = "11px Arial";
      ctx.fillStyle = "rgba(255,230,150,0.95)";
      ctx.fillText(
        `${north ? "천구 북극" : "천구 남극"} · 고도 ${Math.abs(Math.round(observer.latDeg))}°`,
        poleAt[0],
        poleAt[1] + 16,
      );
    } else {
      ctx.font = "11px Arial";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,230,150,0.9)";
      ctx.fillText("적도에서는 천구의 극이 지평선에 걸려요", c, SIZE - 6);
    }

    // 지평선과 방위
    ctx.strokeStyle = "rgba(200,220,255,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c, c, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(220,230,255,0.9)";
    ctx.fillText("북", c, 10);
    ctx.fillText("남", c, SIZE - 10);
    ctx.fillText("동", 10, c);
    ctx.fillText("서", SIZE - 10, c);
    ctx.textBaseline = "alphabetic";
  }, [date, observer, TP, photoWidth, photoHeight, emphasis]);

  return (
    <canvas
      ref={ref}
      width={SIZE}
      height={SIZE}
      className="mx-auto block aspect-square w-full max-w-[360px]"
    />
  );
}
