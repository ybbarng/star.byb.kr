import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Observer } from "@/search/utils/ephemeris";
import type { Mat3 } from "@/search/utils/similarity";
import { solarSystemObjects } from "@/search/skyObjects";
import {
  fromAltAzJ2000,
  horizontalFrameJ2000,
  julianDay,
} from "@/search/utils/ephemeris";
import { createRng } from "@/utils/rng";

// 게임의 밤하늘을 Canvas 2D로 그린다. 별(등급에 따라 크기, 표면 온도에 따라 색), 위상까지 그린 달,
// 행성, 광해, 들쭉날쭉한 땅과 마을 불빛. 하늘의 모든 것은 카메라 변환(TP)으로 투영해서, 정답과 어긋나지 않는다.

export interface DrawStar {
  vector: Point3D;
  mag: number;
  kelvin: number;
  name?: string; // 고유 이름 (시리우스 등)
  id?: string; // 카탈로그 번호 (HR)
}

export interface DrawConstellation {
  label: string;
  stars: Point3D[];
}

export interface DrawSkyOptions {
  width: number;
  height: number;
  TP: Mat3;
  date: Date;
  observer: Observer;
  azimuthDeg: number; // 카메라가 바라보는 방위 (땅 능선을 그릴 범위)
  magLimit: number;
  lightPollution: number;
  groundSeed: number; // 능선·마을 불빛 모양
  stars: DrawStar[];
  constellations?: DrawConstellation[]; // 주면 별자리선을 그린다 (풀이 화면)
  compass?: boolean; // 지평선에 동서남북 표시 (쉬움)
  // 달빛이 어두운 별을 지우게 할지 (기본 true). 별을 눌러 보는 게 목적이면 끈다.
  moonlightDimsStars?: boolean;
}

const D = Math.PI / 180;

// 행성의 대략 밝기·색 (사진에서 별과 구분되는 단서)
const PLANET_LOOK: Record<string, { mag: number; color: string }> = {
  수성: { mag: 0, color: "255,235,210" },
  금성: { mag: -4, color: "255,250,235" },
  화성: { mag: 0.5, color: "255,170,120" },
  목성: { mag: -2.2, color: "255,240,215" },
  토성: { mag: 0.6, color: "250,225,170" },
};

// 표면 온도 → 대략의 색 (붉은 별 ~ 푸른 별)
const starColor = (kelvin: number) =>
  kelvin < 3600
    ? "255,180,130"
    : kelvin < 5000
      ? "255,215,170"
      : kelvin < 6500
        ? "255,244,228"
        : kelvin < 9000
          ? "225,233,255"
          : "190,208,255";

// 그린 것 하나 ("이건 뭐예요?"·숨은그림찾기 판정에 쓴다)
export interface SkyItem {
  kind: "star" | "planet" | "moon" | "town";
  id?: string; // 별이면 카탈로그 번호 (HR)
  x: number;
  y: number;
  radius: number; // 누를 수 있는 반지름 (px)
  label: string;
  detail: string;
}

export const moonShapeName = (lit: number) =>
  lit < 0.05
    ? "그믐달 무렵 (거의 안 보임)"
    : lit < 0.35
      ? "초승달·그믐달"
      : lit < 0.65
        ? "반달"
        : lit < 0.95
          ? "볼록한 달"
          : "보름달";

export const drawSky = (
  ctx: CanvasRenderingContext2D,
  o: DrawSkyOptions,
): SkyItem[] => {
  const items: SkyItem[] = [];
  const { width: W, height: H, TP } = o;
  const jd = julianDay(o.date);
  const frame = horizontalFrameJ2000(jd, o.observer);
  const dot = (a: Point3D, b: Point3D) =>
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const altOf = (v: Point3D) => Math.asin(dot(v, frame.zenith)) / D;

  const project = (v: Point3D): Point2D | null => {
    const z = dot(TP[2] as Point3D, v);

    return z > 1e-6
      ? [dot(TP[0] as Point3D, v) / z, dot(TP[1] as Point3D, v) / z]
      : null;
  };

  const pxPerDeg = Math.hypot(TP[0][0], TP[0][1], TP[0][2]) * D;

  // 달 (위상·밝기는 하늘 밝기에도 쓴다)
  const sky = solarSystemObjects(o.date, o.observer);
  const moon = sky.find((s) => s.kind === "moon")!;
  const sun = sky.find((s) => s.kind === "sun")!;
  const moonAlt = altOf(moon.vector);
  const elong = Math.acos(
    Math.max(-1, Math.min(1, dot(moon.vector, sun.vector))),
  );
  const moonLit = (1 - Math.cos(elong)) / 2;
  const moonGlow =
    moonAlt > 0 ? moonLit * Math.min(1, Math.sin(moonAlt * D) * 3) : 0;

  // 1) 하늘: 위는 어둡고 지평선 쪽은 광해·달빛으로 밝다
  const horizonY = project(fromAltAzJ2000(frame, 0, o.azimuthDeg))?.[1] ?? H;
  const gradient = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizonY));
  const lp = o.lightPollution;
  gradient.addColorStop(
    0,
    `rgb(${4 + 20 * moonGlow},${7 + 25 * moonGlow},${18 + 40 * moonGlow})`,
  );
  gradient.addColorStop(
    1,
    `rgb(${14 + 70 * lp + 30 * moonGlow},${22 + 45 * lp + 35 * moonGlow},${45 + 20 * lp + 50 * moonGlow})`,
  );
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  // 2) 별: 밝은 달과 광해가 어두운 별을 지운다. 지평선 근처는 대기에 묻힌다.
  const limit =
    o.magLimit - (o.moonlightDimsStars === false ? 0 : 1.5 * moonGlow);

  for (const s of o.stars) {
    const alt = altOf(s.vector);

    if (alt <= 0) {
      continue;
    }

    // 대기 소광: 지평선 가까울수록 어둡다 (공기 두께 ~ 1/sin(고도))
    const mag = s.mag + 0.25 * (1 / Math.max(0.05, Math.sin(alt * D)) - 1);

    if (mag > limit) {
      continue;
    }

    const p = project(s.vector);

    if (!p || p[0] < -5 || p[0] > W + 5 || p[1] < -5 || p[1] > H + 5) {
      continue;
    }

    drawPoint(ctx, p, limit - mag, starColor(s.kelvin));
    items.push({
      kind: "star",
      id: s.id,
      x: p[0],
      y: p[1],
      radius: 6 + Math.max(0, limit - mag) * 2,
      label: s.name ?? "이름 없는 별",
      detail: `${s.mag.toFixed(1)}등급 · 표면 온도 약 ${Math.round(s.kelvin / 100) * 100}K`,
    });
  }

  // 3) 행성
  for (const pl of sky.filter((s) => s.kind === "planet")) {
    const look = PLANET_LOOK[pl.name];
    const p = project(pl.vector);

    if (look && p && altOf(pl.vector) > 0) {
      drawPoint(ctx, p, limit - look.mag, look.color);
      items.push({
        kind: "planet",
        x: p[0],
        y: p[1],
        radius: 14,
        label: pl.name,
        detail:
          "행성 — 별처럼 보이지만 반짝임이 적고, 날마다 별자리 사이를 조금씩 옮겨 다녀요",
      });
    }
  }

  // 4) 달: 위상 모양 (밝은 쪽이 해를 향한다)
  if (moonAlt > -1) {
    const p = project(moon.vector);
    const toward = project(
      normalize(moon.vector.map((c, i) => c + 0.02 * sun.vector[i]) as Point3D),
    );

    if (p && toward) {
      const radius = Math.max(7, moon.radiusDeg * pxPerDeg);
      drawMoon(
        ctx,
        p,
        radius,
        Math.atan2(toward[1] - p[1], toward[0] - p[0]),
        moonLit,
      );
      items.push({
        kind: "moon",
        x: p[0],
        y: p[1],
        radius: radius + 10,
        label: "달",
        detail: `${moonShapeName(moonLit)} — 밝은 쪽이 해가 있는 방향이에요`,
      });
    }
  }

  // 별자리선 (풀이 화면). 땅보다 먼저 그려서 지평선 아래는 땅이 가린다.
  if (o.constellations) {
    ctx.strokeStyle = "rgba(250,220,80,0.75)";
    ctx.fillStyle = "rgba(250,220,80,0.95)";
    ctx.lineWidth = 1.5;
    ctx.font = "bold 16px Arial";

    for (const c of o.constellations) {
      const pts = c.stars.map((v) => (altOf(v) > 0 ? project(v) : null));
      let shown = 0;
      let sx = 0;
      let sy = 0;

      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];

        if (!a || !b || Math.hypot(a[0] - b[0], a[1] - b[1]) > W) {
          continue;
        }

        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }

      for (const p of pts) {
        if (p && p[0] >= 0 && p[0] < W && p[1] >= 0 && p[1] < H) {
          shown++;
          sx += p[0];
          sy += p[1];
        }
      }

      if (shown > 0) {
        ctx.fillText(c.label, sx / shown, sy / shown);
      }
    }
  }

  // 5) 땅: 고도 0° 위로 솟은 능선 (산·숲), 그 아래를 어둡게 칠한다
  const rng = createRng(o.groundSeed);
  const waves = [0, 1, 2, 3].map(() => ({
    freq: 1 + Math.floor(rng() * 7),
    phase: rng() * Math.PI * 2,
    amp: 0.2 + rng() * 1.2,
  }));
  const ridge = (az: number) =>
    0.3 +
    waves.reduce(
      (s, w) => s + w.amp * (1 + Math.sin(w.freq * az * D + w.phase)) * 0.5,
      0,
    );
  const ground: Point2D[] = [];

  for (let az = o.azimuthDeg - 110; az <= o.azimuthDeg + 110; az += 0.5) {
    const p = project(fromAltAzJ2000(frame, ridge(az), az));

    if (p) {
      ground.push(p);
    }
  }

  if (ground.length > 1) {
    ctx.beginPath();
    ctx.moveTo(ground[0][0], H * 3);

    for (const p of ground) {
      ctx.lineTo(p[0], p[1]);
    }

    ctx.lineTo(ground[ground.length - 1][0], H * 3);
    ctx.closePath();
    ctx.fillStyle = `rgb(${6 + 8 * moonGlow},${7 + 9 * moonGlow},${9 + 10 * moonGlow})`;
    ctx.fill();
  }

  // 6) 마을 불빛: 둥근 빛 덩어리로 그렸더니 해·달로 오해했다. 진짜 광해처럼 지평선을 따라 낮고 넓게
  //    퍼지는 빛 + 땅 위의 작은 불빛 점들(창문·가로등)로 그린다. 광해가 셀수록 마을이 많다.
  const towns = Math.round(lp * 6);

  for (let i = 0; i < towns; i++) {
    const az = o.azimuthDeg + (rng() - 0.5) * 120;
    const base = project(fromAltAzJ2000(frame, ridge(az), az));

    if (!base) {
      continue;
    }

    // 지평선 위로 낮게 깔리는 빛 (가로로 길쭉한 타원)
    const spread = (6 + rng() * 10) * pxPerDeg;
    items.push({
      kind: "town",
      x: base[0],
      y: base[1],
      radius: spread * 0.4,
      label: "마을 불빛",
      detail: "광해 — 도시·마을의 불빛이 하늘을 밝혀 어두운 별을 지워요",
    });
    ctx.save();
    ctx.translate(base[0], base[1]);
    ctx.scale(1, 0.18);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, spread);
    glow.addColorStop(0, `rgba(255,175,100,${0.12 + 0.18 * lp})`);
    glow.addColorStop(1, "rgba(255,175,100,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-spread, -spread, 2 * spread, 2 * spread);
    ctx.restore();

    // 집들: 지붕 있는 실루엣 + 불 켜진 창문, 사이사이 가로등
    const houses = 4 + Math.floor(rng() * 6);
    const townWidthDeg = (spread / pxPerDeg) * 0.7;

    for (let k = 0; k < houses; k++) {
      const haz = az + (rng() - 0.5) * townWidthDeg;
      const foot = project(fromAltAzJ2000(frame, ridge(haz) - 0.3, haz));

      if (!foot) {
        continue;
      }

      const w = (0.5 + rng() * 0.9) * pxPerDeg;
      const h = w * (0.6 + rng() * 0.6);
      drawHouse(ctx, foot, w, h, rng);
    }

    for (let k = 0; k < 3; k++) {
      const laz = az + (rng() - 0.5) * townWidthDeg;
      const foot = project(fromAltAzJ2000(frame, ridge(laz) - 0.2, laz));

      if (foot) {
        drawStreetLight(ctx, foot, 0.9 * pxPerDeg);
      }
    }
  }

  // 7) 동서남북 (쉬움)
  if (o.compass) {
    ctx.font = "bold 22px Arial";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.textAlign = "center";

    for (const [label, az] of [
      ["북", 0],
      ["동", 90],
      ["남", 180],
      ["서", 270],
    ] as const) {
      const p = project(fromAltAzJ2000(frame, -3, az));

      if (p && p[0] > 0 && p[0] < W) {
        ctx.fillText(label, p[0], Math.min(H - 12, p[1] + 28));
      }
    }

    ctx.textAlign = "start";
  }

  return items;
};

// 집 한 채: 벽(직사각형) + 지붕(삼각형) 실루엣, 창문 몇 개에 불이 켜져 있다. foot은 바닥 가운데.
const drawHouse = (
  ctx: CanvasRenderingContext2D,
  [x, y]: Point2D,
  w: number,
  h: number,
  rng: () => number,
) => {
  const roof = h * 0.45;
  ctx.fillStyle = "rgb(12,12,16)";
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x - w / 2, y - h);
  ctx.lineTo(x, y - h - roof);
  ctx.lineTo(x + w / 2, y - h);
  ctx.lineTo(x + w / 2, y);
  ctx.closePath();
  ctx.fill();

  const win = Math.max(1.5, w * 0.14);
  const cols = w > 25 ? 3 : 2;

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < 2; r++) {
      if (rng() < 0.45) {
        continue;
      }

      const wx = x - w / 2 + ((c + 0.5) * w) / cols - win / 2;
      const wy = y - h + h * (0.25 + r * 0.4);
      ctx.fillStyle = `rgba(255,${200 + Math.floor(rng() * 40)},120,0.9)`;
      ctx.fillRect(wx, wy, win, win);
    }
  }
};

// 가로등: 가는 기둥 + 따뜻한 빛
const drawStreetLight = (
  ctx: CanvasRenderingContext2D,
  [x, y]: Point2D,
  h: number,
) => {
  ctx.strokeStyle = "rgb(18,18,22)";
  ctx.lineWidth = Math.max(1, h * 0.05);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - h);
  ctx.stroke();

  const r = h * 0.35;
  const glow = ctx.createRadialGradient(x, y - h, 0, x, y - h, r);
  glow.addColorStop(0, "rgba(255,210,140,0.9)");
  glow.addColorStop(1, "rgba(255,210,140,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - r, y - h - r, 2 * r, 2 * r);
};

const normalize = (v: Point3D): Point3D => {
  const n = Math.hypot(v[0], v[1], v[2]);

  return [v[0] / n, v[1] / n, v[2] / n];
};

// 밝기 여유(보이는 한계보다 몇 등급 밝은지)에 따라 크기·빛번짐이 커지는 점
const drawPoint = (
  ctx: CanvasRenderingContext2D,
  [x, y]: Point2D,
  headroom: number,
  rgb: string,
) => {
  const core = 0.6 + Math.max(0, headroom) * 0.45;
  const alpha = Math.min(1, 0.3 + headroom * 0.35);

  if (headroom > 2) {
    const r = core * 4;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, `rgba(${rgb},${alpha * 0.5})`);
    glow.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }

  ctx.beginPath();
  ctx.arc(x, y, core, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${rgb},${alpha})`;
  ctx.fill();
};

// 위상이 있는 달. angle은 해 쪽 방향, lit은 빛나는 비율(0 그믐 ~ 1 보름).
const drawMoon = (
  ctx: CanvasRenderingContext2D,
  [x, y]: Point2D,
  r: number,
  angle: number,
  lit: number,
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // 달무리
  const halo = ctx.createRadialGradient(0, 0, r, 0, 0, r * 6);
  halo.addColorStop(0, `rgba(220,225,240,${0.25 * lit})`);
  halo.addColorStop(1, "rgba(220,225,240,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(-r * 6, -r * 6, r * 12, r * 12);

  // 어두운 면 (지구조로 아주 희미하게)
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(60,62,70,0.6)";
  ctx.fill();

  // 밝은 면: 해 쪽 반원 + 경계 타원 (초승·그믐이면 깎고, 볼록하면 더한다)
  const terminator = Math.abs(1 - 2 * lit) * r;
  ctx.fillStyle = "rgb(240,238,225)";
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);

  if (lit < 0.5) {
    ctx.ellipse(0, 0, terminator, r, 0, Math.PI / 2, -Math.PI / 2, true);
  } else {
    ctx.ellipse(0, 0, terminator, r, 0, Math.PI / 2, -Math.PI / 2, false);
  }

  ctx.fill();
  ctx.restore();
};
