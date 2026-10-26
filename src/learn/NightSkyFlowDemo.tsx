"use client";

import type { DrawConstellation, Mountain } from "@/game/sky/drawSky";
import type { Point3D } from "@/scripts/hash/types";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  constellationCenter,
  constellationParts,
  STARS,
} from "@/game/sky/catalog";
import { drawSky } from "@/game/sky/drawSky";
import { horizonCameraTP } from "@/search/horizonSolve";
import {
  altAzOf,
  fromAltAzJ2000,
  horizontalFrameJ2000,
  julianDay,
  sunVector,
} from "@/search/utils/ephemeris";
import { projectVecToPhoto } from "@/search/utils/wcs";

// 거제에서 본 밤하늘이 저절로 흘러간다 (테크 블로그 도입부용). 낮은 건너뛰고, 밤이 끝나면 며칠 뒤 밤으로 넘어가
// 계절에 따라 같은 시각의 하늘이 달라지는 것도 보인다.
// - 북쪽 하늘: 북쪽에 고정. 북두칠성·카시오페이아자리가 북극성을 사이에 두고 돈다.
//   땅에 원근 단서(멀어지는 길·나무, 지평선의 작은 집)를 두어 지평선 근처 별자리가 커 보이는 착시도 느끼게 한다
// - 오리온자리: 카메라가 오리온을 따라 동 → 남 → 서로 돈다. 오리온이 진 밤 시간은 건너뛴다

const GEOJE = { latDeg: 34.88, lonDeg: 128.62 };
const KST = 9;
const HOUR = 3600000;
const DAY = 24 * HOUR;
// 화면 1초에 하늘 12분
const SIM_PER_REAL = 12 * 60;
// 해가 이보다 낮아야 밤
const NIGHT_SUN_ALT = -12;
// 한 밤이 끝나면 이만큼 건너뛴다 (한 해를 몇십 분 안에 돌게)
const NIGHTS_SKIPPED = 6;
const STEP = 10 * 60000;

const starByHr = (hr: string) => STARS.find((s) => s.hr === hr)!.vector;

// 큰곰자리 전체가 아니라 국자 모양 일곱 별만: 두베 → 메라크 → 페크다 → 메그레즈 → 알리오트 → 미자르 → 알카이드, 메그레즈 → 두베
const BIG_DIPPER: DrawConstellation[] = [
  {
    label: "북두칠성",
    stars: ["4301", "4295", "4554", "4660", "4905", "5054", "5191"].map(
      starByHr,
    ),
  },
  { label: "북두칠성", stars: ["4660", "4301"].map(starByHr) },
];
const CASSIOPEIA = constellationParts("카시오페이아자리");
const ORION = constellationParts("오리온자리");
const POLARIS = starByHr("424");
const ORION_CENTER = constellationCenter(ORION);

interface FlowView {
  width: number;
  height: number;
  fovDeg: number; // 짧은 변(세로) 기준 화각
  altitudeDeg: number; // 화면 가운데 고도
  constellations: DrawConstellation[];
  mountains: Mountain[];
  groundSeed: number;
  startKst: [number, number, number, number]; // 년, 월(1~12), 일, 시
  // 카메라 방위. 없으면 북쪽 고정
  follow?: Point3D;
  maxAltitudeDeg?: number; // 따라갈 때 카메라를 이 고도까지 든다
  // 이 별(방향)이 지평선 위에 있을 때만 보여 준다
  mustBeUp?: Point3D;
  labels?: { text: string; vector: Point3D }[];
  ridgeScale?: number;
  // 땅 위 앞쪽 풍경 (화면 좌표). 주면 동서남북 표시 대신 이것을 그린다
  foreground?: (ctx: CanvasRenderingContext2D, horizonY: number) => void;
}

// 나무 한 그루 (원뿔 세 겹). (x, y)는 밑동
const drawTree = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
) => {
  ctx.fillStyle = "rgb(5,6,8)";
  ctx.fillRect(x - h * 0.04, y - h * 0.3, h * 0.08, h * 0.3);

  for (let k = 0; k < 3; k++) {
    const w = h * (0.42 - k * 0.1);
    const top = y - h * (0.6 + k * 0.25);
    ctx.beginPath();
    ctx.moveTo(x - w / 2, top + h * 0.35);
    ctx.lineTo(x, top);
    ctx.lineTo(x + w / 2, top + h * 0.35);
    ctx.closePath();
    ctx.fill();
  }
};

// 아주 작은 집 (창문 하나에 불). (x, y)는 바닥 가운데
const drawHouse = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  lit: boolean,
) => {
  const h = w * 0.7;
  ctx.fillStyle = "rgb(8,9,12)";
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x - w / 2, y - h);
  ctx.lineTo(x, y - h - w * 0.4);
  ctx.lineTo(x + w / 2, y - h);
  ctx.lineTo(x + w / 2, y);
  ctx.closePath();
  ctx.fill();

  if (lit) {
    ctx.fillStyle = "rgba(255,210,130,0.95)";
    ctx.fillRect(x - w * 0.2, y - h * 0.65, Math.max(1, w * 0.18), w * 0.18);
  }
};

// 북쪽 지평선으로 멀어지는 길, 멀어질수록 작아지는 나무, 지평선의 아주 작은 집.
// 지평선 근처 별자리가 커 보이는 착시를 화면에서도 느끼게 하는 원근 단서다 (달이 지평선에서 커 보이는 것과 같다).
const northForeground = (ctx: CanvasRenderingContext2D, hy: number) => {
  const W = 800;
  const H = 600;
  const cx = W / 2;
  const depth = H - hy;

  // 지평선의 작은 마을 (길 양옆에도 두어 그 위 별자리와 크기를 견주게)
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  for (const x0 of [90, 170, 300, 345, 455, 500, 640, 720]) {
    for (let k = 0; k < 3; k++) {
      drawHouse(
        ctx,
        x0 + (rnd() - 0.5) * 30,
        hy + 1,
        4 + rnd() * 3,
        rnd() > 0.3,
      );
    }
  }

  // 길
  ctx.fillStyle = "rgb(22,24,28)";
  ctx.beginPath();
  ctx.moveTo(cx - 2, hy);
  ctx.lineTo(cx + 2, hy);
  ctx.lineTo(cx + 260, H);
  ctx.lineTo(cx - 260, H);
  ctx.closePath();
  ctx.fill();

  // 가운데 점선: 멀수록 짧고 가늘게
  ctx.strokeStyle = "rgba(230,220,170,0.5)";

  for (let t = 0.04; t < 1; t *= 1.45) {
    ctx.lineWidth = Math.max(0.5, 4 * t);
    ctx.beginPath();
    ctx.moveTo(cx, hy + depth * t);
    ctx.lineTo(cx, hy + depth * Math.min(1, t * 1.2));
    ctx.stroke();
  }

  // 길가의 나무: 멀어질수록 작게
  for (let t = 0.06; t < 1.2; t *= 1.45) {
    const y = hy + depth * t;
    const side = 260 * t + 14;
    const h = 170 * t + 4;
    drawTree(ctx, cx - side, y, h);
    drawTree(ctx, cx + side, y, h);
  }

  ctx.font = "bold 20px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.textAlign = "center";
  ctx.fillText("북", cx, H - 14);
  ctx.textAlign = "start";
};

const NORTH: FlowView = {
  width: 800,
  height: 600,
  fovDeg: 90,
  // 땅이 화면 아래 1/5쯤 보이게. 북두칠성이 가장 높이 떠도(고도 약 76°) 화면 안에 든다
  altitudeDeg: 30,
  constellations: [...BIG_DIPPER, ...CASSIOPEIA],
  // 산이 북두칠성을 가리지 않게 먼 능선은 낮게
  mountains: [
    { azDeg: -40, widthDeg: 25, heightDeg: 2.5 },
    { azDeg: 45, widthDeg: 20, heightDeg: 2 },
  ],
  ridgeScale: 0.3,
  groundSeed: 11,
  startKst: [2026, 1, 10, 19],
  labels: [{ text: "북극성", vector: POLARIS }],
  foreground: northForeground,
};

const ORION_VIEW: FlowView = {
  width: 800,
  height: 600,
  fovDeg: 84,
  altitudeDeg: 28,
  maxAltitudeDeg: 38,
  constellations: ORION,
  mountains: [
    { azDeg: 95, widthDeg: 25, heightDeg: 6 },
    { azDeg: 150, widthDeg: 15, heightDeg: 3 },
    { azDeg: 250, widthDeg: 30, heightDeg: 7 },
  ],
  groundSeed: 23,
  startKst: [2026, 11, 20, 21],
  follow: ORION_CENTER,
  mustBeUp: ORION_CENTER,
};

const sunAlt = (date: Date) => {
  const jd = julianDay(date);

  return altAzOf(sunVector(jd), jd, GEOJE).altDeg;
};

const visible = (t: number, v: FlowView) => {
  const date = new Date(t);

  if (sunAlt(date) > NIGHT_SUN_ALT) return false;

  return !v.mustBeUp || altAzOf(v.mustBeUp, julianDay(date), GEOJE).altDeg > 5;
};

// 보이는 다음 순간: 며칠 건너뛰고, 보일 때까지 10분씩 앞으로 (오리온이 낮에만 뜨는 철이면 몇 달)
const nextVisible = (t: number, v: FlowView) => {
  let s = t + NIGHTS_SKIPPED * DAY;

  for (let i = 0; i < 60000 && !visible(s, v); i++) s += STEP;

  return s;
};

const kstLabel = (t: number) => {
  const k = new Date(t + KST * HOUR);

  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
};

// 방위각 → 여덟 방위 (땅의 동서남북 표시 사이를 볼 때도 어느 쪽인지 알게)
const DIRECTIONS = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
const directionOf = (azDeg: number) =>
  DIRECTIONS[Math.round((((azDeg % 360) + 360) % 360) / 45) % 8];

function NightSkyFlow({ view }: { view: FlowView }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const start = useMemo(() => {
    const [y, m, d, h] = view.startKst;

    return Date.UTC(y, m - 1, d, h - KST);
  }, [view]);
  const [time, setTime] = useState(start);
  const [playing, setPlaying] = useState(true);

  // 시간 흘리기
  useEffect(() => {
    if (!playing) return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      setTime((t) => {
        const next = t + dt * SIM_PER_REAL;

        return visible(next, view) ? next : nextVisible(next, view);
      });
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [playing, view]);

  // 그리기
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");

    if (!el || !ctx) return;

    const { width: W, height: H } = view;
    const date = new Date(time);
    const followed = view.follow
      ? altAzOf(view.follow, julianDay(date), GEOJE)
      : null;
    const azimuthDeg = followed?.azDeg ?? 0;
    // 따라가는 별자리가 높이 뜨면 카메라도 들되, 지평선(땅)이 화면 아래에 남을 만큼만
    const altitudeDeg = followed
      ? Math.min(
          view.maxAltitudeDeg ?? view.altitudeDeg,
          Math.max(view.altitudeDeg, followed.altDeg - 12),
        )
      : view.altitudeDeg;
    const camera = {
      azimuthDeg,
      altitudeDeg,
      rollDeg: 0,
      fovDeg: view.fovDeg,
    };
    const TP = horizonCameraTP(date, GEOJE, camera, W, H);

    if (el.width !== W) el.width = W;
    if (el.height !== H) el.height = H;

    drawSky(ctx, {
      width: W,
      height: H,
      TP,
      date,
      observer: GEOJE,
      azimuthDeg,
      magLimit: 4.8,
      lightPollution: 0.25,
      groundSeed: view.groundSeed,
      stars: STARS,
      constellations: view.constellations,
      compass: !view.foreground,
      mountains: view.mountains,
      ridgeScale: view.ridgeScale,
    });

    if (view.foreground) {
      const north = fromAltAzJ2000(
        horizontalFrameJ2000(julianDay(date), GEOJE),
        0,
        azimuthDeg,
      );
      const horizon = projectVecToPhoto(TP, north);

      if (horizon) view.foreground(ctx, horizon[1]);
    }

    ctx.font = "bold 15px Arial";
    ctx.fillStyle = "rgba(190,220,255,0.95)";

    for (const l of view.labels ?? []) {
      const p = projectVecToPhoto(TP, l.vector);

      if (p) ctx.fillText(l.text, p[0] + 8, p[1] - 8);
    }
  }, [time, view]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-lg font-bold">
          {kstLabel(time)}{" "}
          <span className="text-sm font-normal opacity-70">
            경남 거제 (북위 34.9°) ·{" "}
            {directionOf(
              view.follow
                ? altAzOf(view.follow, julianDay(new Date(time)), GEOJE).azDeg
                : 0,
            )}
            쪽 하늘
          </span>
        </div>
        <button className="btn btn-sm" onClick={() => setPlaying((p) => !p)}>
          {playing ? "❚❚ 멈춤" : "▶ 재생"}
        </button>
      </div>
      <canvas
        ref={canvas}
        style={{ maxHeight: "80vh" }}
        className="rounded-box h-auto w-full"
      />
    </div>
  );
}

export const NorthSkyFlowDemo = () => <NightSkyFlow view={NORTH} />;
export const OrionSkyFlowDemo = () => <NightSkyFlow view={ORION_VIEW} />;
