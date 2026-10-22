"use client";

import type { Point3D } from "@/scripts/hash/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { CONSTELLATIONS, STARS } from "@/game/sky/catalog";
import {
  altAzOf,
  julianDay,
  moonVectorFrom,
  ofDateToJ2000,
  sunVector,
} from "@/search/utils/ephemeris";

// 달로 날짜 맞히기: 처음 보는 화악산 사진 세 장(저작권 때문에 사진은 싣지 않는다)을 각각 풀어 얻은 달의 하늘 위치를
// 적경·적위 지도에 찍고, 2026년 한 해 달의 길을 겹친다. 달은 27.3일마다 그 자리를 지나지만, 그때 달이 떠 있고
// 해가 져 있어야 사진에 찍힌다. 장소는 글에 적힌 화악산으로 둔다. 계산은 search/utils/ephemeris.ts와 같다.

const D = Math.PI / 180;
const OBSERVER = { latDeg: 37.99, lonDeg: 127.52 }; // 화악산
const KST = 9;
const W = 620;
const H = 380;
const RA_MIN = 140;
const RA_MAX = 210;
const DEC_MIN = -22;
const DEC_MAX = 22;

// 세 사진을 따로 풀어 얻은 달 위치 (J2000 적경·적위, 도)
const PHOTO_MOONS = [
  { name: "034 (약 73mm)", ra: 173.6, dec: 0.2 },
  { name: "039 (약 24mm)", ra: 173.3, dec: 0.1 },
  { name: "040 (약 24mm)", ra: 173.6, dec: 0.4 },
];
const TARGET = { ra: 173.5, dec: 0.23 };
// 사진 속 달은 가는 그믐달 (빛나는 부분이 이보다 작다)
const MAX_LIT = 0.15;

const visible = (p: { moonAlt: number; sunAlt: number; lit: number }) =>
  p.moonAlt > 0 && p.sunAlt < -6 && p.lit <= MAX_LIT;

const raDecOf = (v: Point3D): [number, number] => [
  (((Math.atan2(v[1], v[0]) / D) % 360) + 360) % 360,
  Math.asin(Math.max(-1, Math.min(1, v[2]))) / D,
];

// 적경은 왼쪽으로 커지게 (하늘을 올려다본 방향)
const toXY = (ra: number, dec: number) => ({
  x: W - ((ra - RA_MIN) / (RA_MAX - RA_MIN)) * W,
  y: H - ((dec - DEC_MIN) / (DEC_MAX - DEC_MIN)) * H,
});

const moonAt = (t: Date) => {
  const jd = julianDay(t);
  const moon = moonVectorFrom(jd, OBSERVER);
  const sun = sunVector(jd);
  const [ra, dec] = raDecOf(ofDateToJ2000(moon, jd));

  return {
    ra,
    dec,
    lit: (1 - (moon[0] * sun[0] + moon[1] * sun[1] + moon[2] * sun[2])) / 2,
    moonAlt: altAzOf(moon, jd, OBSERVER).altDeg,
    sunAlt: altAzOf(sun, jd, OBSERVER).altDeg,
  };
};

const kstLabel = (t: Date) => {
  const k = new Date(t.getTime() + KST * 3600000);

  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
};

export default function MoonDateDemo() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [picked, setPicked] = useState<number | null>(null);

  // 2026년 한 해, 달이 사진 속 달 자리에 가장 가까이 온 때마다 (10분 간격으로 훑는다). 14번 지나는데
  // 같은 자리에서 가는 그믐달이 되려면 해도 가을 자리에 있어야 해서 맞는 때는 한 번뿐이다
  const passes = useMemo(() => {
    const out: { t: Date; path: { ra: number; dec: number }[] }[] = [];
    const start = Date.UTC(2026, 0, 1);
    let prev = Infinity;
    let prevT = start;
    let falling = false;

    for (let m = 0; m < 6 * 24 * 365; m++) {
      const t = start + m * 600000;
      const p = moonAt(new Date(t));
      const d = Math.hypot(
        (p.ra - TARGET.ra) * Math.cos(TARGET.dec * D),
        p.dec - TARGET.dec,
      );

      if (d > prev && falling && prev < 2) {
        const path = Array.from({ length: 61 }, (_, i) => {
          const q = moonAt(new Date(prevT + (i - 30) * 3 * 3600000));

          return { ra: q.ra, dec: q.dec };
        });
        out.push({ t: new Date(prevT), path });
      }

      falling = d < prev;
      prev = d;
      prevT = t;
    }

    return out.map((p) => ({ ...p, ...moonAt(p.t) }));
  }, []);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");

    if (!el || !ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = W * dpr;
    el.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0b0f22";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(160,180,255,0.12)";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px sans-serif";

    for (let ra = 150; ra <= 200; ra += 10) {
      const { x } = toXY(ra, 0);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
      ctx.fillText(`${ra}°`, x + 2, H - 4);
    }

    for (let dec = -20; dec <= 20; dec += 10) {
      const { y } = toXY(0, dec);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.fillText(`${dec}°`, 2, y - 2);
    }

    // 별자리선과 별
    ctx.strokeStyle = "rgba(253,230,138,0.35)";

    for (const c of CONSTELLATIONS) {
      ctx.beginPath();
      c.stars.forEach((v, i) => {
        const [ra, dec] = raDecOf(v);
        const p = toXY(ra, dec);

        if (i) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
      });
      ctx.stroke();
    }

    for (const s of STARS) {
      if (s.mag > 4.5) continue;

      const [ra, dec] = raDecOf(s.vector as Point3D);

      if (ra < RA_MIN || ra > RA_MAX) continue;

      const p = toXY(ra, dec);
      ctx.fillStyle = "rgba(226,232,240,0.75)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.8, 3 - s.mag * 0.5), 0, 2 * Math.PI);
      ctx.fill();
    }

    // 달의 길 (지나갈 때마다 하나씩, 맞는 날은 초록)
    passes.forEach((pass, i) => {
      const on = visible(pass);
      ctx.strokeStyle = on
        ? "#4ade80"
        : i === picked
          ? "#93c5fd"
          : "rgba(147,197,253,0.35)";
      ctx.lineWidth = on || i === picked ? 2.5 : 1.5;
      ctx.beginPath();
      pass.path.forEach((q, j) => {
        const p = toXY(q.ra, q.dec);

        if (j) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
      });
      ctx.stroke();
    });

    // 사진 속 달 세 개
    ctx.font = "bold 13px sans-serif";

    for (const m of PHOTO_MOONS) {
      const p = toXY(m.ra, m.dec);
      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
      ctx.fill();
    }

    const t = toXY(TARGET.ra, TARGET.dec);
    ctx.strokeStyle = "#fde68a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 14, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = "#fde68a";
    ctx.fillText("사진 속 달 (세 장)", t.x + 18, t.y - 10);
  }, [passes, picked]);

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
      <div className="flex flex-col gap-2">
        <canvas
          ref={canvas}
          className="rounded-box h-auto w-full"
          style={{ maxHeight: "80vh" }}
        />
        <div className="text-center text-base">
          사진 정보: 2026년, 화악산, 밤, 가는 그믐달
        </div>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        {passes.map((p, i) => (
          <button
            key={p.t.getTime()}
            className={`rounded-box flex items-baseline justify-between gap-2 px-2 py-0.5 text-left ${visible(p) ? "bg-green-400/20 outline outline-2 outline-green-400" : i === picked ? "bg-blue-300/20" : "bg-base-300/60"}`}
            onClick={() => setPicked(i)}
          >
            <span className="font-bold">{kstLabel(p.t)}</span>
            <span className="opacity-80">
              {/* 해가 떠 있으면 낮. 달이 땅 아래면 보이지 않으니 0% */}
              {p.sunAlt > -6 ? "낮" : "밤"} ·{" "}
              {p.moonAlt < 0 ? 0 : Math.round(p.lit * 100)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
