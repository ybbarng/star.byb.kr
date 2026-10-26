"use client";

import type { Point2D, Point3D } from "@/scripts/hash/types";
import { useEffect, useRef, useState } from "react";
import { STARS } from "@/game/sky/catalog";
import { createRng } from "@/utils/rng";

// 지평선 근처의 별자리가 커 보이는 착시 (테크 블로그 도입부용). 똑같은 크기의 북두칠성을 지평선 바로 위와
// 텅 빈 하늘 높은 곳에 그린다. 땅에는 멀어질수록 좁아지는 길·작아지는 나무(원근, 폰조 착시)와 지평선의
// 아주 작은 집·산 능선(비교 대상)을 두어, 아래쪽 북두칠성이 "저 먼 곳의 큰 것"처럼 느껴지게 한다.

const W = 800;
const H = 660;
const HORIZON_Y = 470;
const VANISH_X = 400;
const DIPPER_WIDTH = 230;
const UPPER = { x: 400, y: 115 };
const LOWER = { x: 400, y: 400 };

const starByHr = (hr: string) => STARS.find((s) => s.hr === hr)!;
// 두베 → 메라크 → 페크다 → 메그레즈 → 알리오트 → 미자르 → 알카이드
const DIPPER = ["4301", "4295", "4554", "4660", "4905", "5054", "5191"].map(
  starByHr,
);

// 북두칠성을 접선 평면에 펼친다 (북쪽이 위, 동쪽이 왼쪽 — 하늘을 올려다본 모습). 가로 DIPPER_WIDTH, 가운데 (0,0)
const dipperShape = (): Point2D[] => {
  const s = DIPPER.reduce<Point3D>(
    (a, { vector: v }) => [a[0] + v[0], a[1] + v[1], a[2] + v[2]],
    [0, 0, 0],
  );
  const n = Math.hypot(...s);
  const c: Point3D = [s[0] / n, s[1] / n, s[2] / n];
  const e = Math.hypot(c[0], c[1]);
  const east: Point3D = [-c[1] / e, c[0] / e, 0];
  const north: Point3D = [
    c[1] * east[2] - c[2] * east[1],
    c[2] * east[0] - c[0] * east[2],
    c[0] * east[1] - c[1] * east[0],
  ];
  const dot = (a: Point3D, b: Point3D) =>
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const raw = DIPPER.map(({ vector: v }): Point2D => {
    const z = dot(v, c);

    return [-dot(v, east) / z, -dot(v, north) / z];
  });
  const xs = raw.map((p) => p[0]);
  const ys = raw.map((p) => p[1]);
  const k = DIPPER_WIDTH / (Math.max(...xs) - Math.min(...xs));
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;

  return raw.map(([x, y]) => [(x - cx) * k, (y - cy) * k]);
};

const drawDipper = (
  ctx: CanvasRenderingContext2D,
  shape: Point2D[],
  at: { x: number; y: number },
) => {
  const pts = shape.map(([x, y]): Point2D => [at.x + x, at.y + y]);

  ctx.strokeStyle = "rgba(250,220,80,0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  // 국자를 닫는 선: 메그레즈 → 두베
  ctx.moveTo(pts[3][0], pts[3][1]);
  ctx.lineTo(pts[0][0], pts[0][1]);
  ctx.stroke();

  DIPPER.forEach((s, i) => {
    const [x, y] = pts[i];
    const r = 2 + (3 - s.mag) * 1.3;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    glow.addColorStop(0, "rgba(235,240,255,0.55)");
    glow.addColorStop(1, "rgba(235,240,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgb(245,247,255)";
    ctx.fill();
  });
};

// 멀어질수록(지평선에 가까울수록) 작아진다: 땅 위 y에서의 크기 비율
const depthScale = (y: number) => (y - HORIZON_Y) / (H - HORIZON_Y);

const drawTree = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
) => {
  ctx.fillStyle = "rgb(8,10,12)";
  ctx.fillRect(x - h * 0.04, y - h * 0.3, h * 0.08, h * 0.3);

  for (let k = 0; k < 3; k++) {
    const w = h * (0.42 - k * 0.1);
    const top = y - h * (0.25 + k * 0.25) - h * 0.35;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, top + h * 0.35);
    ctx.lineTo(x, top);
    ctx.lineTo(x + w / 2, top + h * 0.35);
    ctx.closePath();
    ctx.fill();
  }
};

const drawHouse = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  lit: boolean,
) => {
  const h = w * 0.7;
  ctx.fillStyle = "rgb(10,11,14)";
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

const drawScene = (
  ctx: CanvasRenderingContext2D,
  shape: Point2D[],
  reveal: boolean,
) => {
  // 하늘: 위는 어둡고 지평선 쪽은 마을 불빛으로 조금 밝다
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
  sky.addColorStop(0, "rgb(5,8,20)");
  sky.addColorStop(1, "rgb(28,34,62)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HORIZON_Y);

  const rng = createRng(7);

  for (let i = 0; i < 260; i++) {
    const x = rng() * W;
    const y = rng() * (HORIZON_Y - 20);
    const a = 0.15 + rng() * 0.45 * (1 - y / HORIZON_Y);
    ctx.fillStyle = `rgba(220,228,255,${a})`;
    ctx.fillRect(x, y, 1.2, 1.2);
  }

  drawDipper(ctx, shape, UPPER);
  drawDipper(ctx, shape, LOWER);

  // 먼 산 능선
  ctx.fillStyle = "rgb(14,16,24)";
  ctx.beginPath();
  ctx.moveTo(0, HORIZON_Y);

  for (let x = 0; x <= W; x += 10) {
    const y =
      HORIZON_Y -
      6 -
      5 * Math.sin(x * 0.013) -
      4 * Math.sin(x * 0.041 + 1) -
      (x < 260 ? (260 - x) * 0.08 : 0) -
      (x > 560 ? (x - 560) * 0.06 : 0);
    ctx.lineTo(x, y);
  }

  ctx.lineTo(W, HORIZON_Y);
  ctx.closePath();
  ctx.fill();

  // 땅
  const ground = ctx.createLinearGradient(0, HORIZON_Y, 0, H);
  ground.addColorStop(0, "rgb(16,18,22)");
  ground.addColorStop(1, "rgb(6,7,9)");
  ctx.fillStyle = ground;
  ctx.fillRect(0, HORIZON_Y, W, H - HORIZON_Y);

  // 지평선의 작은 마을: 집이 아주 작아서 그 위의 별자리가 크게 느껴진다
  const houses = createRng(3);

  // 아래쪽 북두칠성 바로 밑(길 양옆)에도 두어 크기를 견주게 한다
  for (const cx of [140, 300, 345, 455, 500, 655]) {
    for (let k = 0; k < 3; k++) {
      drawHouse(
        ctx,
        cx + (houses() - 0.5) * 30,
        HORIZON_Y + 1,
        5 + houses() * 3,
        houses() > 0.3,
      );
    }
  }

  // 멀어질수록 좁아지는 길
  ctx.fillStyle = "rgb(24,26,30)";
  ctx.beginPath();
  ctx.moveTo(VANISH_X - 3, HORIZON_Y);
  ctx.lineTo(VANISH_X + 3, HORIZON_Y);
  ctx.lineTo(VANISH_X + 230, H);
  ctx.lineTo(VANISH_X - 230, H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(230,220,170,0.5)";
  ctx.setLineDash([]);

  // 가운데 점선: 멀수록 짧고 촘촘하게
  for (let t = 0.04; t < 1; t *= 1.45) {
    const y0 = HORIZON_Y + (H - HORIZON_Y) * t;
    const y1 = HORIZON_Y + (H - HORIZON_Y) * Math.min(1, t * 1.2);
    ctx.lineWidth = Math.max(0.5, 4 * t);
    ctx.beginPath();
    ctx.moveTo(VANISH_X, y0);
    ctx.lineTo(VANISH_X, y1);
    ctx.stroke();
  }

  // 길가의 나무: 멀어질수록 작게
  for (let t = 0.05; t < 1.1; t *= 1.5) {
    const y = HORIZON_Y + (H - HORIZON_Y) * t;
    const side = 230 * depthScale(y) + 18 * t;
    const h = 150 * depthScale(y) + 4;
    drawTree(ctx, VANISH_X - side - 10 * t, y, h);
    drawTree(ctx, VANISH_X + side + 10 * t, y, h);
  }

  if (reveal) {
    // 두 북두칠성의 가로 폭을 같은 자로 잰다
    ctx.strokeStyle = "rgba(120,220,255,0.95)";
    ctx.fillStyle = "rgba(120,220,255,0.95)";
    ctx.lineWidth = 2;
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";

    for (const at of [UPPER, LOWER]) {
      const y = at.y + 62;
      const x0 = at.x - DIPPER_WIDTH / 2;
      const x1 = at.x + DIPPER_WIDTH / 2;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.moveTo(x0, y - 7);
      ctx.lineTo(x0, y + 7);
      ctx.moveTo(x1, y - 7);
      ctx.lineTo(x1, y + 7);
      ctx.stroke();
      ctx.fillText(`${DIPPER_WIDTH}px`, at.x, y + 22);
    }

    ctx.textAlign = "start";
  }
};

export default function HorizonIllusionDemo() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");

    if (!el || !ctx) return;

    el.width = W;
    el.height = H;
    drawScene(ctx, dipperShape(), reveal);
  }, [reveal]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-lg font-bold">
          위와 아래, 어느 북두칠성이 더 커 보이나요?
        </div>
        <button
          className="btn btn-sm btn-primary"
          onClick={() => setReveal((r) => !r)}
        >
          {reveal ? "다시 보기" : "정답 보기"}
        </button>
      </div>
      <canvas
        ref={canvas}
        style={{ maxHeight: "80vh" }}
        className="rounded-box h-auto w-full"
      />
      {reveal && (
        <div className="text-sm opacity-80">
          둘은 크기가 똑같아요. 지평선 근처에는 멀어지는 길과 작은 집·나무가
          있어서, 그 위의 별자리를 &ldquo;저 멀리 있는 큰 것&rdquo;으로 느끼게
          돼요. 달이 지평선에서 커 보이는 것과 같은 착시예요.
        </div>
      )}
    </div>
  );
}
