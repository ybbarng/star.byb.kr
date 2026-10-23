import type { Point2D, Point3D } from "@/scripts/hash/types";
import { SIGNS, ZODIAC, zodiacWidthDeg } from "@/game/birthday/zodiac";
import {
  equinoxLonOfYear,
  northPoleOfYear,
  OBLIQUITY_DEG,
  PRECESSION_PERIOD_YEARS,
  toEclipticJ2000,
  yearLabel,
} from "@/game/precession/precession";
import {
  CONSTELLATIONS,
  constellationCenter,
  constellationParts,
  STARS,
} from "@/game/sky/catalog";

// 세차운동 타임머신의 그림 두 장.
// 1) 북쪽 하늘 지도: 황도의 북극을 가운데 둔 등거리 방위 투영 (올려다본 방향이라 황경이 시계 반대 방향으로 는다).
//    세차 원(반지름 23.44°)과 연도 눈금, 그 해의 북극, 가장 가까운 밝은 별을 그린다. 지금 북극이 위로 오게 돌렸다.
// 2) 황도 띠: 점성술의 열두 궁(춘분점부터 30°씩)과 실제 황도 별자리(IAU 경계)를 위아래로 놓아 어긋남을 보인다.

export const CHART_SIZE = 900;
export const STRIP_WIDTH = 1200;
export const STRIP_HEIGHT = 210;

const D = Math.PI / 180;
// 지도 가운데에서 가장자리까지 각 (세차 원 23.44° + 베가·데네브까지)
const CHART_RADIUS_DEG = 44;
const MAG_LIMIT = 5;

// 지도에 이름을 붙일 별 (북극성이었거나 될 별들)
const NAMED = [
  "Polaris",
  "Vega",
  "Thuban",
  "Kochab",
  "Errai",
  "Alderamin",
  "Deneb",
  "Al Fawaris",
];

// 지도에 이름을 붙일 별자리
const CONSTELLATION_LABELS = [
  "작은곰자리",
  "큰곰자리",
  "용자리",
  "세페우스자리",
  "카시오페이아자리",
  "백조자리",
  "거문고자리",
  "헤르쿨레스자리",
];

const wrap360 = (deg: number) => ((deg % 360) + 360) % 360;

const chart = () => {
  const c = CHART_SIZE / 2;
  const k = (c - 24) / CHART_RADIUS_DEG;

  return (v: Point3D): Point2D | null => {
    const e = toEclipticJ2000(v);
    const rho = 90 - e.latDeg;

    if (rho > CHART_RADIUS_DEG + 2) {
      return null;
    }

    return [
      c + rho * k * Math.cos(e.lonDeg * D),
      c - rho * k * Math.sin(e.lonDeg * D),
    ];
  };
};

// 별·별자리선의 지도 위치는 한 번만 구한다
let cache: {
  stars: { p: Point2D; mag: number }[];
  lines: (Point2D | null)[][];
  named: { p: Point2D; name: string }[];
  labels: { p: Point2D; label: string }[];
} | null = null;

const chartCatalog = () => {
  if (!cache) {
    const project = chart();

    cache = {
      stars: STARS.filter((s) => s.mag <= MAG_LIMIT).flatMap((s) => {
        const p = project(s.vector);

        return p ? [{ p, mag: s.mag }] : [];
      }),
      lines: CONSTELLATIONS.map((c) => c.stars.map((v) => project(v))),
      named: STARS.filter(
        (s) => s.latinName && NAMED.includes(s.latinName),
      ).flatMap((s) => {
        const p = project(s.vector);

        return p ? [{ p, name: s.name ?? s.latinName! }] : [];
      }),
      labels: CONSTELLATION_LABELS.flatMap((label) => {
        const parts = constellationParts(label);
        const p = parts.length ? project(constellationCenter(parts)) : null;

        return p ? [{ p, label }] : [];
      }),
    };
  }

  return cache;
};

export const drawPrecessionChart = (
  ctx: CanvasRenderingContext2D,
  year: number,
  nowYear: number,
  nearest: { vector: Point3D; sepDeg: number } | null,
) => {
  const S = CHART_SIZE;
  const c = S / 2;
  const project = chart();
  const { stars, lines, named, labels } = chartCatalog();

  ctx.fillStyle = "#04060d";
  ctx.fillRect(0, 0, S, S);
  const sky = ctx.createRadialGradient(c, c, 0, c, c, c - 20);
  sky.addColorStop(0, "#0d1736");
  sky.addColorStop(1, "#070c20");
  ctx.fillStyle = sky;
  ctx.beginPath();
  ctx.arc(c, c, c - 20, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, c - 20, 0, Math.PI * 2);
  ctx.clip();

  // 별자리선
  ctx.strokeStyle = "rgba(150,180,255,0.28)";
  ctx.lineWidth = 1.3;

  for (const line of lines) {
    ctx.beginPath();
    let pen = false;

    for (const p of line) {
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
  }

  ctx.font = "15px Arial";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(150,180,255,0.55)";

  for (const { p, label } of labels) {
    ctx.fillText(label, p[0], p[1] + 30);
  }

  // 별
  for (const { p, mag } of stars) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], Math.max(0.8, 3.8 - mag * 0.62), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, 1.15 - mag * 0.14)})`;
    ctx.fill();
  }

  // 세차 원: 천구의 북극이 약 25,800년에 한 바퀴 도는 길
  const k = (c - 24) / CHART_RADIUS_DEG;
  ctx.strokeStyle = "rgba(255,200,90,0.45)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(c, c, OBLIQUITY_DEG * k, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // 지금부터 고른 해까지 극이 지나간 길
  const steps = Math.max(2, Math.ceil(Math.abs(year - nowYear) / 50));
  ctx.strokeStyle = "rgba(255,210,100,0.95)";
  ctx.lineWidth = 4;
  ctx.beginPath();

  for (let i = 0; i <= steps; i++) {
    const p = project(
      northPoleOfYear(nowYear + ((year - nowYear) * i) / steps),
    )!;

    if (i) {
      ctx.lineTo(p[0], p[1]);
    } else {
      ctx.moveTo(p[0], p[1]);
    }
  }

  ctx.stroke();

  // 연도 눈금 (1,000년마다, 4,000년마다 글자)
  ctx.font = "14px Arial";

  for (let y = -12000; y <= 14000; y += 1000) {
    const e = 90 - ((y - 2000) * 360) / PRECESSION_PERIOD_YEARS;
    const cos = Math.cos(e * D);
    const sin = Math.sin(e * D);
    const r = OBLIQUITY_DEG * k;
    ctx.strokeStyle = "rgba(255,200,90,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c + (r - 7) * cos, c - (r - 7) * sin);
    ctx.lineTo(c + (r + 7) * cos, c - (r + 7) * sin);
    ctx.stroke();

    if (y % 4000 === 0 && y !== 14000) {
      ctx.fillStyle = "rgba(255,210,120,0.85)";
      ctx.fillText(yearLabel(y), c + (r - 40) * cos, c - (r - 40) * sin + 5);
    }
  }

  // 황도의 북극 (세차 원의 가운데)
  ctx.strokeStyle = "rgba(255,200,90,0.6)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(c - 7, c);
  ctx.lineTo(c + 7, c);
  ctx.moveTo(c, c - 7);
  ctx.lineTo(c, c + 7);
  ctx.stroke();
  ctx.font = "13px Arial";
  ctx.fillStyle = "rgba(255,210,120,0.7)";
  ctx.fillText("황도의 북극", c, c + 22);

  // 이름 붙은 별
  ctx.font = "bold 17px Arial";
  ctx.fillStyle = "rgba(200,230,255,0.95)";
  ctx.textAlign = "left";

  for (const { p, name } of named) {
    ctx.fillText(name, p[0] + 9, p[1] - 8);
  }

  // 지금의 북극 (비교용, 고른 해가 지금이 아니면)
  if (Math.abs(year - nowYear) > 150) {
    const now = project(northPoleOfYear(nowYear))!;
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(now[0], now[1], 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = "13px Arial";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.textAlign = "right";
    ctx.fillText("지금의 북극", now[0] - 12, now[1] + 22);
  }

  // 고른 해의 북극과 가장 가까운 밝은 별
  const pole = project(northPoleOfYear(year))!;

  if (nearest) {
    const q = project(nearest.vector);

    if (q) {
      ctx.strokeStyle = "rgba(120,230,255,0.9)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pole[0], pole[1]);
      ctx.lineTo(q[0], q[1]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(q[0], q[1], 13, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const glow = ctx.createRadialGradient(
    pole[0],
    pole[1],
    0,
    pole[0],
    pole[1],
    34,
  );
  glow.addColorStop(0, "rgba(255,120,180,0.55)");
  glow.addColorStop(1, "rgba(255,120,180,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(pole[0] - 34, pole[1] - 34, 68, 68);
  ctx.strokeStyle = "rgb(255,140,190)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pole[0] - 16, pole[1]);
  ctx.lineTo(pole[0] + 16, pole[1]);
  ctx.moveTo(pole[0], pole[1] - 16);
  ctx.lineTo(pole[0], pole[1] + 16);
  ctx.stroke();
  ctx.font = "bold 18px Arial";
  ctx.fillStyle = "rgb(255,170,210)";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 5;
  ctx.fillText(`${yearLabel(year)}의 북극`, pole[0], pole[1] - 24);
  ctx.shadowBlur = 0;

  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(c, c, c - 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.textAlign = "start";
};

const ASTRO_COLOR = "rgb(255,120,170)";
const REAL_COLOR = "rgb(250,200,60)";

// 황도 띠: 오른쪽 끝이 춘분점보다 60° 서쪽, 왼쪽 끝이 180° 동쪽 (올려다본 방향이라 동쪽이 왼쪽)
export const drawZodiacStrip = (
  ctx: CanvasRenderingContext2D,
  year: number,
) => {
  const W = STRIP_WIDTH;
  const H = STRIP_HEIGHT;
  const SPAN = 240;
  const equinox = equinoxLonOfYear(year);
  const right = equinox - 60;
  const x = (lon: number) => W - (wrap360(lon - right) * W) / SPAN;
  const pxPerDeg = W / SPAN;
  const astroTop = 34;
  const realTop = 120;
  const rowH = 56;

  ctx.fillStyle = "#070b18";
  ctx.fillRect(0, 0, W, H);

  // 한 칸: 황경 start에서 width°만큼 (띠 경계를 넘으면 잘라 그린다)
  const segment = (
    start: number,
    width: number,
    top: number,
    label: string,
    fill: string,
    stroke: string,
    textColor: string,
  ) => {
    const d0 = wrap360(start - right);

    for (const d of [d0, d0 - 360]) {
      const xa = W - d * pxPerDeg;
      const xb = W - (d + width) * pxPerDeg;

      if (xa < 0 || xb > W) {
        continue;
      }

      ctx.fillStyle = fill;
      ctx.fillRect(xb, top, xa - xb, rowH);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(xb, top, xa - xb, rowH);
      const mid = Math.min(
        W - 50,
        Math.max(50, (Math.max(0, xb) + Math.min(W, xa)) / 2),
      );

      if (Math.min(W, xa) - Math.max(0, xb) > 40) {
        ctx.fillStyle = textColor;
        ctx.fillText(label, mid, top + rowH / 2 + 6);
      }
    }
  };

  ctx.font = "bold 17px Arial";
  ctx.textAlign = "center";

  SIGNS.forEach((sign, i) =>
    segment(
      equinox + 30 * i,
      30,
      astroTop,
      sign,
      i === 0
        ? "rgba(255,120,170,0.3)"
        : i % 2
          ? "rgba(255,120,170,0.08)"
          : "rgba(255,120,170,0.14)",
      "rgba(255,150,190,0.5)",
      i === 0 ? ASTRO_COLOR : "rgba(255,190,215,0.9)",
    ),
  );

  ZODIAC.forEach((z, i) =>
    segment(
      z.startLonDeg,
      zodiacWidthDeg(z),
      realTop,
      z.label,
      z.label === "양자리"
        ? "rgba(250,200,60,0.3)"
        : i % 2
          ? "rgba(120,160,255,0.08)"
          : "rgba(120,160,255,0.15)",
      "rgba(160,190,255,0.5)",
      z.label === "양자리" ? REAL_COLOR : "rgba(200,215,255,0.9)",
    ),
  );

  ctx.font = "13px Arial";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,190,215,0.85)";
  ctx.fillText(
    "점성술의 열두 궁 — 춘분점부터 30°씩 (춘분점과 함께 움직여요)",
    10,
    astroTop - 10,
  );
  ctx.fillStyle = "rgba(200,215,255,0.85)";
  ctx.fillText("실제 별자리 — 별들의 자리 (움직이지 않아요)", 10, realTop - 10);

  // 춘분점
  const ex = x(equinox);
  ctx.strokeStyle = "rgb(255,255,255)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(ex, astroTop - 4);
  ctx.lineTo(ex, realTop + rowH + 6);
  ctx.stroke();
  ctx.font = "bold 14px Arial";
  ctx.fillStyle = "white";
  ctx.textAlign = "left";
  ctx.fillText("춘분점", ex + 6, H - 8);
  ctx.textAlign = "right";
  ctx.font = "12px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText("← 동   서 →", W - 10, H - 8);
  ctx.textAlign = "start";
};
