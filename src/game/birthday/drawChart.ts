import type { BirthdaySky } from "@/game/birthday/zodiac";
import {
  SIGNS,
  toEcliptic,
  ZODIAC,
  zodiacWidthDeg,
} from "@/game/birthday/zodiac";
import {
  CONSTELLATIONS,
  constellationCenter,
  constellationParts,
  STARS,
} from "@/game/sky/catalog";
import { julianDay, ofDateToJ2000, sunVector } from "@/search/utils/ephemeris";

// 생일 별자리 천문도: 황도(해가 지나는 길)를 가로로 곧게 펼친 띠 모양 천문도.
// 황경을 가로, 황위를 세로로 두는 메르카토르 투영이라 화면이 넓으면 황도 한 바퀴(360°)까지 이어서 보이고,
// 좁은 곳에서도 별자리 모양이 일그러지지 않는다. 하늘을 올려다본 방향이라 동쪽이 왼쪽이다.
// 황도 별자리 구간(IAU 경계), 점성술의 30° 구간, 달마다 해의 자리, 생일의 해를 함께 그린다.

const D = Math.PI / 180;
// 세로로 이 황위까지는 보이게 배율을 정한다 (황도 별자리가 대부분 들어온다)
const VISIBLE_LAT_DEG = 38;
// 황도대: 해·달·행성이 지나는 황도 위아래 띠
const BAND_LAT_DEG = 9;

// 해에서 이만큼 떨어지면 밤하늘 (해가 지평선 아래로 내려간 쪽)
const DAY_RADIUS_DEG = 100;
// 낮 하늘은 작게 그려 늘린다 (끌 때도 매끄럽게)
const SKY_SCALE = 6;
const NIGHT_RGB = [7, 11, 24];
const DAY_RGB = [96, 150, 220];
const SUN_RGB = [255, 244, 214];

export const BIRTH_COLOR = "rgb(250,200,60)";
export const SIGN_COLOR = "rgb(255,120,170)";

export const wrap180 = (deg: number) =>
  ((((deg + 180) % 360) + 360) % 360) - 180;
// 메르카토르 세로 좌표 (각도 단위)
const mercator = (latDeg: number) =>
  Math.log(Math.tan(Math.PI / 4 + (latDeg * D) / 2)) / D;

// 해와의 각거리(°) → 낮 하늘 밝기 (해 곁 1 → 약 100° 밖 0). 해와 같은 쪽 하늘은 낮이라 별이 안 보인다
export const daylight = (sunDistanceDeg: number) => {
  const t = Math.min(1, Math.max(0, sunDistanceDeg / DAY_RADIUS_DEG));

  return 1 - t * t * (3 - 2 * t);
};

// 황경 차이·황위(°) → 해(황도 위)와의 각거리(°)
const sunDistance = (dLonDeg: number, latDeg: number) =>
  Math.acos(
    Math.max(-1, Math.min(1, Math.cos(latDeg * D) * Math.cos(dLonDeg * D))),
  ) / D;

let skyCanvas: HTMLCanvasElement | null = null;

// 해 둘레가 밝은 낮 하늘 (해 아주 가까이는 흰빛, 멀어지며 파랑 → 밤)
const drawDaySky = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  P: ChartProjection,
  sunDLon: number,
) => {
  const w = Math.ceil(W / SKY_SCALE);
  const h = Math.ceil(H / SKY_SCALE);
  skyCanvas ??= document.createElement("canvas");
  skyCanvas.width = w;
  skyCanvas.height = h;
  const small = skyCanvas.getContext("2d")!;
  const image = small.createImageData(w, h);

  for (let j = 0; j < h; j++) {
    const m = (H / 2 - (j + 0.5) * SKY_SCALE) / P.pxPerDeg;
    const lat = (2 * Math.atan(Math.exp(m * D))) / D - 90;

    for (let i = 0; i < w; i++) {
      const dLon = (W / 2 - (i + 0.5) * SKY_SCALE) / P.pxPerDeg;
      const d = sunDistance(wrap180(dLon - sunDLon), lat);
      const b = daylight(d);
      const glow = Math.max(0, 1 - d / 12) ** 2;
      const k = (j * w + i) * 4;

      for (let c = 0; c < 3; c++) {
        const day = DAY_RGB[c] + (SUN_RGB[c] - DAY_RGB[c]) * glow;
        image.data[k + c] = NIGHT_RGB[c] + (day - NIGHT_RGB[c]) * b;
      }

      image.data[k + 3] = 255;
    }
  }

  small.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(skyCanvas, 0, 0, w * SKY_SCALE, h * SKY_SCALE);
};

export interface ChartProjection {
  pxPerDeg: number;
  spanDeg: number; // 화면에 보이는 황경 폭
  // 가운데 황경에서 lonDeg만큼 떨어진 곳 (늘 -180~180로 돌리지 않는다: 선이 이어지게)
  x: (dLonDeg: number) => number;
  y: (latDeg: number) => number;
  dLon: (lonDeg: number) => number;
}

// 가운데 황경 centerLon, 화면 W×H의 투영. 세로로 VISIBLE_LAT_DEG가 들어오게 하되,
// 화면이 아주 넓으면 황도 한 바퀴가 가로를 꽉 채우게 배율을 키운다.
export const chartProjection = (
  W: number,
  H: number,
  centerLon: number,
): ChartProjection => {
  const pxPerDeg = Math.max(H / 2 / mercator(VISIBLE_LAT_DEG), W / 360);

  return {
    pxPerDeg,
    spanDeg: W / pxPerDeg,
    x: (d) => W / 2 - d * pxPerDeg,
    y: (lat) => H / 2 - mercator(lat) * pxPerDeg,
    dLon: (lon) => wrap180(lon - centerLon),
  };
};

// 별·별자리선의 황도 좌표는 한 번만 구한다 (애니메이션 중 매 장면 다시 그린다)
let cache: {
  stars: { lon: number; lat: number; mag: number }[];
  lines: { label: string; points: { lon: number; lat: number }[] }[];
  centers: Map<string, { lon: number; lat: number }>;
} | null = null;

const eclipticCatalog = () => {
  if (!cache) {
    const ecl = (v: [number, number, number]) => {
      const e = toEcliptic(v);

      return { lon: e.lonDeg, lat: e.latDeg };
    };

    cache = {
      stars: STARS.map((s) => ({ ...ecl(s.vector), mag: s.mag })),
      lines: CONSTELLATIONS.map((c) => ({
        label: c.label,
        points: c.stars.map((v) => ecl(v as [number, number, number])),
      })),
      centers: new Map(
        ZODIAC.map((z) => [
          z.label,
          ecl(constellationCenter(constellationParts(z.label))),
        ]),
      ),
    };
  }

  return cache;
};

export const drawBirthdayChart = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  birth: { year: number; month: number; day: number },
  sky: BirthdaySky,
  centerLon: number,
) => {
  const P = chartProjection(W, H, centerLon);
  const { stars, lines, centers } = eclipticCatalog();
  const birthLabel = sky.constellation.label;
  const signLabel = sky.sign;
  // 황도 한 바퀴 넘어가는 부분은 360° 옆에 한 번 더 그린다
  const OFFSETS = [-360, 0, 360];
  const colorOf = (label: string) =>
    label === birthLabel
      ? BIRTH_COLOR
      : label === signLabel
        ? SIGN_COLOR
        : null;

  const sunDLon = P.dLon(sky.sunLonJ2000);
  drawDaySky(ctx, W, H, P, sunDLon);

  // 황도대 띠와 황도 별자리 구간 (내 별자리 금색, 점성술 별자리 분홍)
  const bandTop = P.y(BAND_LAT_DEG);
  const bandBottom = P.y(-BAND_LAT_DEG);

  ZODIAC.forEach((z, i) => {
    const d0 = P.dLon(z.startLonDeg);
    const d1 = d0 + zodiacWidthDeg(z);
    const color = colorOf(z.label);

    for (const o of OFFSETS) {
      const xa = P.x(d0 + o);
      const xb = P.x(d1 + o);

      if (Math.max(xa, xb) < 0 || Math.min(xa, xb) > W) {
        continue;
      }

      ctx.fillStyle = color
        ? color.replace("rgb", "rgba").replace(")", ",0.17)")
        : i % 2
          ? "rgba(120,160,255,0.05)"
          : "rgba(120,160,255,0.09)";
      ctx.fillRect(xb, bandTop, xa - xb, bandBottom - bandTop);

      ctx.strokeStyle = "rgba(160,190,255,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xa, bandTop);
      ctx.lineTo(xa, bandBottom);
      ctx.stroke();

      ctx.font = color ? "bold 17px Arial" : "13px Arial";
      ctx.fillStyle = color ?? "rgba(190,210,255,0.85)";
      ctx.textAlign = "center";
      ctx.fillText(z.label, (xa + xb) / 2, bandBottom + 20);
    }
  });

  // 별
  for (const s of stars) {
    const x = P.x(P.dLon(s.lon));
    const y = P.y(s.lat);

    if (x < 0 || x > W || y < 0 || y > H) {
      continue;
    }

    // 낮 하늘에 묻힌 별은 흐려진다
    const day = daylight(sunDistance(P.dLon(s.lon) - sunDLon, s.lat));
    const alpha = Math.min(1, 1.2 - s.mag * 0.15) * (1 - 0.92 * day);

    if (alpha < 0.03) {
      continue;
    }

    const r = Math.max(0.6, 3.2 - s.mag * 0.55);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fill();
  }

  // 밝은 낮 하늘에서도 선·글자가 보이게 그림자를 둔다
  ctx.shadowColor = "rgba(0,0,0,0.75)";
  ctx.shadowBlur = 4;

  // 별자리선: 내 별자리(금색)·점성술 별자리(분홍)는 굵게, 다른 황도 별자리는 하늘색, 나머지는 흐리게
  const zodiacLabels = new Set(ZODIAC.map((z) => z.label));

  for (const con of lines) {
    const color = colorOf(con.label);
    const zodiac = zodiacLabels.has(con.label);
    ctx.strokeStyle =
      color ?? (zodiac ? "rgba(140,190,255,0.7)" : "rgba(255,255,255,0.15)");
    ctx.lineWidth = color ? 3 : zodiac ? 1.5 : 1;

    // 앞 점에 이어지게 편 황경 (한 바퀴 경계에서 선이 끊기거나 화면을 가로지르지 않게)
    const ds = [P.dLon(con.points[0].lon)];

    for (let k = 1; k < con.points.length; k++) {
      ds.push(ds[k - 1] + wrap180(con.points[k].lon - con.points[k - 1].lon));
    }

    for (const o of OFFSETS) {
      const xs = ds.map((d) => P.x(d + o));

      if (Math.max(...xs) < 0 || Math.min(...xs) > W) {
        continue;
      }

      ctx.beginPath();
      con.points.forEach((p, k) => {
        const y = P.y(p.lat);

        if (k) {
          ctx.lineTo(xs[k], y);
        } else {
          ctx.moveTo(xs[k], y);
        }
      });
      ctx.stroke();
    }
  }

  // 황도 별자리 이름 (별자리 가운데, 띠와 겹치지 않을 때)
  ctx.textAlign = "center";

  for (const [label, c] of centers) {
    const x = P.x(P.dLon(c.lon));
    const y = P.y(c.lat);
    const color = colorOf(label);

    if (x > 0 && x < W && (y < bandTop - 6 || y > bandBottom + 30)) {
      ctx.font = color ? "bold 16px Arial" : "12px Arial";
      ctx.fillStyle = color ?? "rgba(170,200,255,0.8)";
      ctx.fillText(label, x, y);
    }
  }

  // 황도: 해가 지나는 길
  ctx.strokeStyle = "rgba(255,180,80,0.8)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = "12px Arial";
  ctx.fillStyle = "rgba(255,190,100,0.9)";
  ctx.textAlign = "left";
  ctx.fillText(
    "황도 (해가 지나는 길) — 해는 하루에 약 1°씩 서쪽(오른쪽)으로 움직여요",
    12,
    20,
  );

  // 달마다 1일의 해 자리
  ctx.textAlign = "center";

  for (let m = 1; m <= 12; m++) {
    const jd = julianDay(new Date(Date.UTC(birth.year, m - 1, 1, 12)));
    const lon = toEcliptic(ofDateToJ2000(sunVector(jd), jd)).lonDeg;

    for (const o of OFFSETS) {
      const x = P.x(P.dLon(lon) + o);

      if (x > 10 && x < W - 10) {
        ctx.strokeStyle = "rgba(255,190,100,0.9)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, H / 2 - 6);
        ctx.lineTo(x, H / 2 + 6);
        ctx.stroke();
        ctx.font = "12px Arial";
        ctx.fillStyle = "rgba(255,190,100,0.9)";
        ctx.fillText(`${m}월`, x, H / 2 + 20);
      }
    }
  }

  // 점성술의 30° 구간 (그날 춘분점 기준 → J2000으로 옮겨 그린다)
  const signIndex = SIGNS.indexOf(signLabel);
  const shift = sky.sunLonOfDate - sky.sunLonJ2000;
  const s0 = P.dLon(signIndex * 30 - shift);
  const y = bandTop - 26;

  for (const o of OFFSETS) {
    const xa = P.x(s0 + o);
    const xb = P.x(s0 + 30 + o);

    if (Math.max(xa, xb) < 0 || Math.min(xa, xb) > W) {
      continue;
    }

    ctx.strokeStyle = SIGN_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xa, y + 10);
    ctx.lineTo(xa, y);
    ctx.lineTo(xb, y);
    ctx.lineTo(xb, y + 10);
    ctx.stroke();
    ctx.font = "bold 14px Arial";
    ctx.fillStyle = SIGN_COLOR;
    ctx.fillText(`점성술의 ${signLabel} 구간 (30°)`, (xa + xb) / 2, y - 8);
  }

  ctx.shadowBlur = 0;

  // 생일의 해
  const sx = P.x(P.dLon(sky.sunLonJ2000));
  const sy = H / 2;
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 40);
  glow.addColorStop(0, "rgba(255,230,120,0.9)");
  glow.addColorStop(1, "rgba(255,230,120,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(sx - 40, sy - 40, 80, 80);
  ctx.beginPath();
  ctx.arc(sx, sy, 12, 0, Math.PI * 2);
  ctx.fillStyle = "rgb(255,220,90)";
  ctx.fill();
  ctx.font = "bold 15px Arial";
  ctx.fillStyle = "rgb(255,235,150)";
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 6;
  ctx.fillText(`생일의 해 (${birth.month}월 ${birth.day}일)`, sx, sy - 22);
  ctx.shadowBlur = 0;

  ctx.textAlign = "left";
  ctx.font = "12px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText("← 동", 12, H - 12);
  ctx.textAlign = "right";
  ctx.fillText("서 →", W - 12, H - 12);
  ctx.textAlign = "left";
};
