"use client";

import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { useEffect, useMemo, useRef, useState } from "react";
import { CONSTELLATIONS, STARS } from "@/game/sky/catalog";
import {
  estimateShotTimes,
  skyClockOf,
  zenithFromHorizon,
} from "@/search/shotTimeEstimate";
import { photoToSky, projectVecToPhoto } from "@/search/utils/wcs";
import { cn } from "@/utils/cn";

// 지평선 두 점 → 천정 → 위도·하늘 시계 → 날짜마다 시각. 누각 사진(정답 자세)으로 단계별로 보인다.
//   ① 풀린 사진: 사진의 점마다 하늘 방향을 안다
//   ② 지평선 두 점: 먼 능선 두 점을 하늘 방향으로 바꾼다 (고도 0°인 두 방향)
//   ③ 천정: 두 방향 모두에 수직인 방향. 적위가 위도, 적경이 그 순간의 하늘 시계(지방 항성시)
//   ④ 날짜마다 시각: 하늘 시계가 그 값이 되는 순간은 날마다 한 번. 해가 떠 있으면 버린다
// 계산은 촬영 시각 추정(search/shotTimeEstimate.ts)과 같다.
// 자료: public/learn/zenith-seoul.json (scripts/learn/buildDemoData.ts)

const SRC = "/samples/20220607-berry-seoul.jpg";
const D = Math.PI / 180;
const CHART_W = 600;
const CHART_H = 340;
const SEOUL_LON = 127;
const KST = 9;

type Step = 1 | 2 | 3 | 4;

const STEPS: { step: Step; label: string }[] = [
  { step: 1, label: "① 풀린 사진" },
  { step: 2, label: "② 지평선 두 점" },
  { step: 3, label: "③ 천정 찾기" },
  { step: 4, label: "④ 날짜마다 시각" },
];

// 찍은 분 답(10월 3일)과, 지난 발표에서 Stellarium으로 찾은 날짜, 계절이 다른 날
const DATES = [
  { label: "2021년 7월 1일", iso: "2021-07-01" },
  { label: "2021년 10월 3일", iso: "2021-10-03", answer: true },
  { label: "2022년 1월 11일", iso: "2022-01-11" },
  { label: "2022년 4월 1일", iso: "2022-04-01" },
];

interface Data {
  W: number;
  H: number;
  TP: Mat3;
  horizon: [Point2D, Point2D];
}

const raDecOf = (v: Point3D): [number, number] => [
  (((Math.atan2(v[1], v[0]) / D) % 360) + 360) % 360,
  Math.asin(Math.max(-1, Math.min(1, v[2]))) / D,
];

const hm = (deg: number) => {
  const minutes = Math.round((deg / 15) * 60);

  return `${Math.floor(minutes / 60)}시 ${minutes % 60}분`;
};

// 적경은 왼쪽으로 커지게 (하늘을 올려다본 방향)
const chartXY = ([ra, dec]: [number, number]): Point2D => [
  CHART_W - (ra / 360) * CHART_W,
  CHART_H / 2 - (dec / 90) * (CHART_H / 2),
];

export default function ZenithClockDemo() {
  const [data, setData] = useState<Data | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [step, setStep] = useState<Step>(1);
  const photo = useRef<HTMLCanvasElement>(null);
  const chart = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;

    fetch("/learn/zenith-seoul.json")
      .then((r) => r.json())
      .then((d: Data) => alive && setData(d));
    const img = new Image();
    img.onload = () => alive && setImage(img);
    img.src = SRC;

    return () => {
      alive = false;
    };
  }, []);

  const sky = useMemo(() => {
    if (!data) return null;

    const a = photoToSky(data.TP, data.horizon[0]);
    const b = photoToSky(data.TP, data.horizon[1]);
    const zenith = zenithFromHorizon(
      a,
      b,
      photoToSky(data.TP, [data.W / 2, 0]),
    )!;
    const clock = skyClockOf(zenith);
    // 지평선 = 천정에서 90° 떨어진 큰 원
    const u = a;
    const w: Point3D = [
      zenith[1] * u[2] - zenith[2] * u[1],
      zenith[2] * u[0] - zenith[0] * u[2],
      zenith[0] * u[1] - zenith[1] * u[0],
    ];
    const ring = Array.from({ length: 360 }, (_, i) => {
      const t = i * D;

      return raDecOf([
        Math.cos(t) * u[0] + Math.sin(t) * w[0],
        Math.cos(t) * u[1] + Math.sin(t) * w[1],
        Math.cos(t) * u[2] + Math.sin(t) * w[2],
      ]);
    });
    const times = DATES.map((d) => {
      const [c] = estimateShotTimes(clock, {
        lonDeg: SEOUL_LON,
        from: new Date(`${d.iso}T00:00:00+09:00`),
        days: 1,
        maxSunAltDeg: 90,
      });
      const k = new Date(c.date.getTime() + KST * 3600000);

      return {
        ...d,
        time: `${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`,
        night: c.sunAltDeg < -12,
      };
    });

    return { a, b, zenith, clock, ring, times };
  }, [data]);

  // 사진
  useEffect(() => {
    const el = photo.current;
    const ctx = el?.getContext("2d");

    if (!el || !ctx || !data || !image || !sky) return;

    const W = 560;
    const k = W / data.W;
    const H = Math.round(data.H * k);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = W * dpr;
    el.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(image, 0, 0, W, H);
    ctx.fillStyle = "rgba(5,8,20,0.3)";
    ctx.fillRect(0, 0, W, H);

    // 풀린 변환으로 별자리선
    ctx.strokeStyle = "rgba(253,230,138,0.6)";
    ctx.lineWidth = 1.2;

    for (const c of CONSTELLATIONS) {
      const pts = c.stars.map((v) => projectVecToPhoto(data.TP, v));

      for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i];
        const q = pts[i + 1];

        // 사진 밖으로 멀리 나가는 선은 그리지 않는다
        if (!p || !q || Math.hypot(p[0] - q[0], p[1] - q[1]) > data.W) continue;

        ctx.beginPath();
        ctx.moveTo(p[0] * k, p[1] * k);
        ctx.lineTo(q[0] * k, q[1] * k);
        ctx.stroke();
      }
    }

    if (step >= 2) {
      const [p, q] = data.horizon;
      ctx.strokeStyle = "#4ade80";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p[0] * k, p[1] * k);
      ctx.lineTo(q[0] * k, q[1] * k);
      ctx.stroke();
      ctx.fillStyle = "#4ade80";

      for (const [x, y] of data.horizon) {
        ctx.beginPath();
        ctx.arc(x * k, y * k, 7, 0, 2 * Math.PI);
        ctx.fill();
      }

      ctx.font = "bold 14px sans-serif";
      ctx.fillText("먼 능선 = 지평선", q[0] * k + 10, q[1] * k - 8);
    }
  }, [data, image, sky, step]);

  // 하늘 지도 (적경·적위)
  useEffect(() => {
    const el = chart.current;
    const ctx = el?.getContext("2d");

    if (!el || !ctx || !sky) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = CHART_W * dpr;
    el.height = CHART_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0b0f22";
    ctx.fillRect(0, 0, CHART_W, CHART_H);

    // 격자: 적경 2시간·적위 30°마다
    ctx.strokeStyle = "rgba(160,180,255,0.12)";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px sans-serif";

    for (let h = 0; h <= 24; h += 2) {
      const [x] = chartXY([h * 15, 0]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CHART_H);
      ctx.stroke();

      if (h % 4 === 0 && h < 24) ctx.fillText(`${h}시`, x + 2, CHART_H - 4);
    }

    for (let dec = -60; dec <= 60; dec += 30) {
      const [, y] = chartXY([0, dec]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CHART_W, y);
      ctx.stroke();
      ctx.fillText(`${dec}°`, 2, y - 2);
    }

    for (const s of STARS) {
      if (s.mag > 4) continue;

      const [x, y] = chartXY(raDecOf(s.vector as Point3D));
      ctx.fillStyle = "rgba(226,232,240,0.7)";
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.6, 2.2 - s.mag * 0.4), 0, 2 * Math.PI);
      ctx.fill();
    }

    if (step >= 2) {
      ctx.fillStyle = "#4ade80";

      for (const v of [sky.a, sky.b]) {
        const [x, y] = chartXY(raDecOf(v));
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    if (step >= 3) {
      // 지평선 큰 원
      ctx.fillStyle = "rgba(74,222,128,0.6)";

      for (const p of sky.ring) {
        const [x, y] = chartXY(p);
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }

      const [zx, zy] = chartXY(raDecOf(sky.zenith));
      ctx.strokeStyle = "#fde68a";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(zx, zy);
      ctx.lineTo(zx, CHART_H);
      ctx.moveTo(zx, zy);
      ctx.lineTo(0, zy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(zx - 12, zy);
      ctx.lineTo(zx + 12, zy);
      ctx.moveTo(zx, zy - 12);
      ctx.lineTo(zx, zy + 12);
      ctx.stroke();
      ctx.fillStyle = "#fde68a";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText("천정", zx + 14, zy - 10);
    }
  }, [sky, step]);

  if (!data || !sky) {
    return <div className="text-sm opacity-60">자료를 불러오는 중…</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <button
            key={s.step}
            className={`btn btn-sm ${step === s.step ? "btn-primary" : ""}`}
            onClick={() => setStep(s.step)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <div className="text-sm opacity-70">
            누각 사진 (풀린 변환으로 별자리선)
          </div>
          <canvas
            ref={photo}
            className="rounded-box h-auto w-full"
            style={{ maxHeight: "80vh" }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-sm opacity-70">
            하늘 지도 (가로 적경 = 하늘의 경도, 세로 적위 = 하늘의 위도)
          </div>
          <canvas
            ref={chart}
            className="rounded-box h-auto w-full"
            style={{ maxHeight: "80vh" }}
          />
        </div>
      </div>
      {/* 단계 설명은 모두 같은 칸에 겹쳐 두고 지금 단계만 보인다: 가장 긴 ④만큼 자리를 늘 잡아 두어 배치가 움직이지 않는다 */}
      <div className="bg-base-300/60 rounded-box grid p-3 text-base">
        <div className={cn("[grid-area:1/1]", step !== 1 && "invisible")}>
          사진이 풀렸으니, 사진 속 어느 점이든 하늘의 어느 방향인지 안다.
        </div>
        <div className={cn("[grid-area:1/1]", step !== 2 && "invisible")}>
          지평선 위 두 점을 하늘 방향으로 바꾼다. 둘 다 고도 0°인 방향이다.
        </div>
        <div className={cn("[grid-area:1/1]", step !== 3 && "invisible")}>
          두 방향 모두와 90°인 방향이 머리 꼭대기(천정). 천정의 적위{" "}
          <b className="text-amber-200">
            {sky.clock.latDeg.toFixed(1)}° = 위도
          </b>
          , 적경{" "}
          <b className="text-amber-200">
            {hm(sky.clock.lstDeg)} = 그 순간의 하늘 시계
          </b>
        </div>
        <div
          className={cn(
            "flex flex-col gap-2 [grid-area:1/1]",
            step !== 4 && "invisible",
          )}
        >
          <div>
            하늘 시계가 {hm(sky.clock.lstDeg)}가 되는 순간은 날마다 한 번씩
            온다. 날짜는 하늘만으로 정할 수 없다.
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {sky.times.map((t) => (
              <div
                key={t.iso}
                className={`rounded-box p-2 ${t.answer ? "bg-amber-300/20 outline outline-2 outline-amber-300" : "bg-base-100/60"} ${t.night ? "" : "opacity-50"}`}
              >
                <div className="text-sm opacity-70">{t.label}</div>
                <div className="text-lg font-bold">{t.time}</div>
                <div className="text-sm">
                  {t.night
                    ? t.answer
                      ? "찍은 분 답: 4~5시"
                      : "밤"
                    : "낮이라 안 보임"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
