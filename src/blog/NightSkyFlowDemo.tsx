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

// 테크 블로그 전용 (사이트에는 쓰지 않는다). 거제에서 본 밤하늘이 저절로 흘러간다 (글 도입부). 낮은 건너뛰고, 밤이 끝나면 며칠 뒤 밤으로 넘어가
// 계절에 따라 같은 시각의 하늘이 달라지는 것도 보인다.
// - 북쪽 하늘: 북쪽에 고정. 북두칠성·카시오페이아자리가 북극성을 사이에 두고 돈다.
//   지평선의 먼 도시 스카이라인과 멀어지는 길을 두어 지평선 근처 별자리가 커 보이는 느낌도 주게 한다
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

// 먼 건물 한 동: 실루엣과 불 켜진 창문 몇 개. (x, y)는 바닥 왼쪽
const drawBuilding = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rnd: () => number,
) => {
  ctx.fillStyle = "rgb(9,10,14)";
  ctx.fillRect(x, y - h, w, h);

  for (let wy = y - h + 3; wy < y - 2; wy += 3) {
    for (let wx = x + 2; wx < x + w - 2; wx += 3) {
      if (rnd() < 0.22) {
        ctx.fillStyle = `rgba(255,${195 + Math.floor(rnd() * 45)},130,${0.55 + rnd() * 0.4})`;
        ctx.fillRect(wx, wy, 1.4, 1.2);
      }
    }
  }
};

// 북쪽 지평선의 먼 도시 스카이라인과 그쪽으로 멀어지는 길.
// 크기를 아는 건물이 별자리 바로 아래 아주 작게 있어서, 지평선 근처의 북두칠성이 커 보이게 하는 단서다
// (망원으로 찍은 "도시 위 거대한 달"과 같은 원리. 하늘 높이 뜨면 견줄 것이 없다).
const northForeground = (ctx: CanvasRenderingContext2D, hy: number) => {
  const W = 800;
  const H = 600;
  const cx = W / 2;
  const depth = H - hy;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  // 도시 불빛이 지평선 위로 은은하게 번진다
  const glow = ctx.createLinearGradient(0, hy - 60, 0, hy);
  glow.addColorStop(0, "rgba(255,170,100,0)");
  glow.addColorStop(1, "rgba(255,170,100,0.16)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, hy - 60, W, 60);

  // 스카이라인: 띄엄띄엄 모인 건물 무리 (아파트 단지·시내). 낮은 건물이 많고 가끔 높은 동
  for (let x = 0; x < W; ) {
    if (rnd() < 0.12) {
      x += 10 + rnd() * 40;
      continue;
    }

    const w = 8 + rnd() * 18;
    const h = rnd() < 0.2 ? 22 + rnd() * 16 : 6 + rnd() * 14;
    drawBuilding(ctx, x, hy + 2, w, h, rnd);
    x += w + rnd() * 3;
  }

  // 땅 (스카이라인 아래)
  ctx.fillStyle = "rgb(8,9,11)";
  ctx.fillRect(0, hy + 2, W, H - hy - 2);

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
      // 이름은 아래에서 따로 쓴다 (drawSky는 별들 가운데에 써서 선과 어두운 별을 덮는다)
      constellations: view.constellations.map((c) => ({ ...c, label: "" })),
      linesBelowHorizon: true,
      // 날짜가 흘러 달 밝은 밤도 오는데, 그때 별이 다 지워지면 별자리 주변이 텅 빈다
      moonlightDimsStars: false,
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

    // 별자리 이름: 지평선 위에 보이는 별들을 감싼 상자의 위쪽 바깥에 (선과 별을 덮지 않게)
    const jd = julianDay(date);
    const boxes = new Map<string, [number, number, number]>(); // 이름 → [왼쪽, 오른쪽, 위]

    for (const c of view.constellations) {
      for (const v of c.stars) {
        const p = projectVecToPhoto(TP, v);

        if (!p || altAzOf(v, jd, GEOJE).altDeg <= 0) continue;
        if (p[0] < 0 || p[0] > W || p[1] < 0 || p[1] > H) continue;

        const [l, r, t] = boxes.get(c.label) ?? [p[0], p[0], p[1]];
        boxes.set(c.label, [
          Math.min(l, p[0]),
          Math.max(r, p[0]),
          Math.min(t, p[1]),
        ]);
      }
    }

    ctx.font = "bold 16px Arial";
    ctx.fillStyle = "rgba(250,220,80,0.95)";
    ctx.textAlign = "center";

    for (const [text, [l, r, t]] of boxes) {
      ctx.fillText(text, (l + r) / 2, Math.max(18, t - 14));
    }

    ctx.textAlign = "start";
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
          {/* 카메라가 따라 돌 때만 지금 어느 쪽을 보는지 (북쪽 고정은 땅에 "북"이 있다) */}
          {view.follow && (
            <span className="text-sm font-normal opacity-70">
              {directionOf(
                altAzOf(view.follow, julianDay(new Date(time)), GEOJE).azDeg,
              )}
              쪽 하늘
            </span>
          )}
        </div>
        <button className="btn btn-sm" onClick={() => setPlaying((p) => !p)}>
          {playing ? "❚❚ 멈춤" : "▶ 재생"}
        </button>
      </div>
      <canvas
        ref={canvas}
        // 높이 제한 없이 폭에 맞춘다 (블로그 iframe 높이를 폭 × 0.75 + 48px로 딱 맞춘다. 넘치면 FitToFrame이 줄인다)
        style={{ maxHeight: "none" }}
        className="rounded-box h-auto w-full"
      />
    </div>
  );
}

export const NorthSkyFlowDemo = () => <NightSkyFlow view={NORTH} />;
export const OrionSkyFlowDemo = () => <NightSkyFlow view={ORION_VIEW} />;
