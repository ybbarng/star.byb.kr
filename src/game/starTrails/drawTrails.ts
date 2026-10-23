import type { TrailProblem } from "@/game/starTrails/trails";
import type { Point2D } from "@/scripts/hash/types";
import {
  enuOf,
  projectEnu,
  TRAIL_SETTINGS,
  trailsOf,
} from "@/game/starTrails/trails";
import { createRng } from "@/utils/rng";

// 장노출 별 궤적 사진을 Canvas 2D로 합성한다: 어두운 하늘과 지평선 광해, 별마다 노출 동안 지나간 호
// (등급에 따라 굵기·밝기, 표면 온도에 따라 색), 능선과 나무 실루엣, 마을 불빛, 센서 잡음, 주변부 어두워짐.
// 궤적은 trails.ts의 같은 카메라로 투영해서 정답(극 자리)과 어긋나지 않는다.

const starColor = (kelvin: number) =>
  kelvin < 3600
    ? "255,175,125"
    : kelvin < 5000
      ? "255,212,165"
      : kelvin < 6500
        ? "255,244,228"
        : kelvin < 9000
          ? "220,230,255"
          : "180,200,255";

export interface DrawTrailOptions {
  grid: boolean; // 고도 10°마다 눈금선
  compass: boolean; // 동서남북
}

export const drawTrailPhoto = (
  ctx: CanvasRenderingContext2D,
  p: TrailProblem,
  o: DrawTrailOptions,
) => {
  const W = p.width;
  const H = p.height;
  const set = TRAIL_SETTINGS[p.difficulty];
  const lp = set.lightPollution;
  const project = (altDeg: number, azDeg: number) =>
    projectEnu(p.view, W, H, enuOf(altDeg, azDeg));
  const horizonY = project(0, p.view.azDeg)?.[1] ?? H;

  // 1) 하늘: 위는 어둡고 지평선 쪽은 광해로 밝다
  const sky = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizonY));
  sky.addColorStop(0, "rgb(3,5,14)");
  sky.addColorStop(0.65, `rgb(${8 + 20 * lp},${12 + 16 * lp},${30 + 10 * lp})`);
  sky.addColorStop(1, `rgb(${24 + 90 * lp},${28 + 55 * lp},${48 + 20 * lp})`);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // 2) 궤적: 빛이 겹치면 더 밝아지게 더해 그린다
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const t of trailsOf(p, set.magLimit)) {
    const headroom = set.magLimit - t.mag;
    const width = 0.7 + Math.max(0, headroom) * 0.55;
    const alpha = Math.min(1, 0.25 + headroom * 0.22);
    const rgb = starColor(t.kelvin);

    for (const line of t.lines) {
      // 지평선 가까이에서는 대기에 묻혀 흐려진다 (그런 부분만 조각마다 투명도를 바꿔 그린다.
      // 겹쳐 더해 그리니 조각 끝이 둥글면 이음매가 구슬처럼 밝아져서, 그때는 끝을 자른다)
      const fades = line.alts.map((alt) =>
        Math.min(1, Math.max(0, Math.sin((alt * Math.PI) / 180) * 5)),
      );
      ctx.lineWidth = width;

      if (Math.min(...fades) > 0.98) {
        ctx.strokeStyle = `rgba(${rgb},${alpha})`;
        ctx.beginPath();
        line.points.forEach(([x, y], i) =>
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y),
        );
        ctx.stroke();
      } else {
        ctx.lineCap = "butt";

        for (let i = 0; i < line.points.length - 1; i++) {
          const fade = (fades[i] + fades[i + 1]) / 2;

          if (fade <= 0.02) {
            continue;
          }

          ctx.strokeStyle = `rgba(${rgb},${alpha * fade})`;
          ctx.beginPath();
          ctx.moveTo(line.points[i][0], line.points[i][1]);
          ctx.lineTo(line.points[i + 1][0], line.points[i + 1][1]);
          ctx.stroke();
        }

        ctx.lineCap = "round";
      }

      // 밝은 별은 빛이 번진 넓은 띠를 한 번 더
      if (headroom > 2.5) {
        ctx.strokeStyle = `rgba(${rgb},0.12)`;
        ctx.lineWidth = width * 3.5;
        ctx.beginPath();
        line.points.forEach(([x, y], i) =>
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y),
        );
        ctx.stroke();
      }
    }
  }

  ctx.restore();

  // 3) 땅: 능선 + 나무 실루엣
  const rng = createRng(p.groundSeed);
  const waves = [0, 1, 2, 3].map(() => ({
    freq: 1 + Math.floor(rng() * 8),
    phase: rng() * Math.PI * 2,
    amp: 0.3 + rng() * 1.5,
  }));
  const ridge = (az: number) =>
    0.4 +
    waves.reduce(
      (s, w) =>
        s +
        w.amp * (1 + Math.sin((w.freq * az * Math.PI) / 180 + w.phase)) * 0.5,
      0,
    );
  const ground: Point2D[] = [];

  for (let az = p.view.azDeg - 88; az <= p.view.azDeg + 88; az += 0.5) {
    const q = project(ridge(az), az);

    if (q) {
      ground.push(q);
    }
  }

  // 광해: 지평선을 따라 낮고 넓게 퍼지는 빛
  const towns = Math.round(lp * 10);

  for (let i = 0; i < towns; i++) {
    const az = p.view.azDeg + (rng() - 0.5) * p.view.fovDeg * 1.4;
    const base = project(ridge(az), az);

    if (!base) {
      continue;
    }

    const spread = 140 + rng() * 220;
    ctx.save();
    ctx.translate(base[0], base[1]);
    ctx.scale(1, 0.25);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, spread);
    glow.addColorStop(0, `rgba(255,170,95,${0.18 + 0.2 * lp})`);
    glow.addColorStop(1, "rgba(255,170,95,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-spread, -spread, 2 * spread, 2 * spread);
    ctx.restore();
  }

  if (ground.length > 1) {
    ctx.beginPath();
    ctx.moveTo(ground[0][0], H * 3);
    ground.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(ground[ground.length - 1][0], H * 3);
    ctx.closePath();
    ctx.fillStyle = "rgb(5,6,8)";
    ctx.fill();

    // 침엽수 몇 그루: 능선 위 뾰족한 실루엣
    const trees = 6 + Math.floor(rng() * 14);

    for (let k = 0; k < trees; k++) {
      const at = ground[Math.floor(rng() * ground.length)];
      const h = 18 + rng() * 55;
      const w = h * (0.25 + rng() * 0.15);
      ctx.beginPath();
      ctx.moveTo(at[0] - w / 2, at[1] + 2);
      ctx.lineTo(at[0], at[1] - h);
      ctx.lineTo(at[0] + w / 2, at[1] + 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 4) 길잡이: 고도 눈금선, 동서남북
  if (o.grid) {
    ctx.save();
    ctx.setLineDash([6, 8]);
    ctx.strokeStyle = "rgba(140,200,255,0.35)";
    ctx.fillStyle = "rgba(170,215,255,0.85)";
    ctx.lineWidth = 1.2;
    ctx.font = "bold 18px Arial";

    for (let alt = 10; alt <= 80; alt += 10) {
      const pts: Point2D[] = [];

      for (let az = p.view.azDeg - 85; az <= p.view.azDeg + 85; az += 1) {
        const q = project(alt, az);

        if (q) {
          pts.push(q);
        }
      }

      const shown = pts.filter(
        ([x, y]) => x > -50 && x < W + 50 && y > -50 && y < H + 50,
      );

      if (shown.length < 2) {
        continue;
      }

      ctx.beginPath();
      shown.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();

      // 이름표: 사진 왼쪽 가장자리 가까이
      const label = shown.find(([x, y]) => x >= 12 && y > 16 && y < H - 6);

      if (label) {
        ctx.fillText(`${alt}°`, label[0] + 4, label[1] - 5);
      }
    }

    ctx.restore();
  }

  if (o.compass) {
    ctx.font = "bold 22px Arial";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.textAlign = "center";

    for (const [label, az] of [
      ["북", 0],
      ["북동", 45],
      ["동", 90],
      ["남동", 135],
      ["남", 180],
      ["남서", 225],
      ["서", 270],
      ["북서", 315],
    ] as const) {
      const off = Math.abs(((az - p.view.azDeg + 540) % 360) - 180);
      const q = off < 85 ? project(0, az) : null;

      if (q && q[0] > 20 && q[0] < W - 20 && q[1] < H) {
        ctx.fillText(label, q[0], Math.min(H - 12, q[1] + 30));
      }
    }

    ctx.textAlign = "start";
  }

  // 5) 센서 잡음과 주변부 어두워짐 (사진 느낌)
  const noise = createRng(p.seed ^ 0x5bd1e995);

  for (let k = 0; k < 2600; k++) {
    const v = 120 + Math.floor(noise() * 135);
    ctx.fillStyle = `rgba(${v},${v},${v + 10},${0.04 + noise() * 0.08})`;
    ctx.fillRect(noise() * W, noise() * H, 1.5, 1.5);
  }

  const vignette = ctx.createRadialGradient(
    W / 2,
    H / 2,
    H * 0.45,
    W / 2,
    H / 2,
    W * 0.72,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
};
