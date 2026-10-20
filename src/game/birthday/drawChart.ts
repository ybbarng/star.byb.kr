import type { BirthdaySky } from "@/game/birthday/zodiac";
import type { Point2D, Point3D } from "@/scripts/hash/types";
import {
  fromEcliptic,
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

// 생일 별자리 천문도: 생일의 해를 가운데 두고 황도(해가 지나는 길)를 가로로 펼친 평면 천문도.
// 평사 투영(별자리 모양이 덜 일그러진다), 하늘을 올려다본 방향이라 동쪽이 왼쪽이다.
// 황도 별자리 구간(IAU 경계), 점성술의 30° 구간, 달마다 해의 자리, 생일의 해를 함께 그린다.

const D = Math.PI / 180;
const HALF_SPAN_DEG = 80;

export const drawBirthdayChart = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  birth: { year: number; month: number; day: number },
  sky: BirthdaySky,
) => {
  const center = sky.sunLonJ2000;
  const c = fromEcliptic(center, 0);
  const east = fromEcliptic(center + 90, 0);
  const north = fromEcliptic(0, 90);
  const dot = (a: Point3D, b: Point3D) =>
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const scale = (W / 2 / (2 * Math.tan((HALF_SPAN_DEG / 2) * D))) * 0.98;

  const project = (v: Point3D): Point2D | null => {
    const d = dot(v, c);

    if (d < -0.2) {
      return null;
    }

    const k = 2 / (1 + d);

    return [
      W / 2 - k * dot(v, east) * scale,
      H / 2 - k * dot(v, north) * scale,
    ];
  };

  const atLon = (lon: number, lat = 0) => project(fromEcliptic(lon, lat));
  const birthLabel = sky.constellation.label;

  ctx.fillStyle = "#070b18";
  ctx.fillRect(0, 0, W, H);

  // 황도 별자리 구간 띠 (내 별자리는 금색)
  ZODIAC.forEach((z, i) => {
    const a = atLon(z.startLonDeg);
    const b = atLon(z.startLonDeg + zodiacWidthDeg(z));

    if (!a || !b) {
      return;
    }

    const mine = z.label === birthLabel;
    ctx.fillStyle = mine
      ? "rgba(250,200,60,0.18)"
      : i % 2
        ? "rgba(120,160,255,0.06)"
        : "rgba(120,160,255,0.1)";
    ctx.fillRect(Math.min(a[0], b[0]), H / 2 - 60, Math.abs(b[0] - a[0]), 120);

    ctx.strokeStyle = "rgba(160,190,255,0.35)";
    ctx.beginPath();
    ctx.moveTo(a[0], H / 2 - 60);
    ctx.lineTo(a[0], H / 2 + 60);
    ctx.stroke();

    const mid = atLon(z.startLonDeg + zodiacWidthDeg(z) / 2);

    if (mid) {
      ctx.font = mine ? "bold 18px Arial" : "13px Arial";
      ctx.fillStyle = mine ? "rgb(250,210,90)" : "rgba(190,210,255,0.85)";
      ctx.textAlign = "center";
      ctx.fillText(z.label, mid[0], H / 2 + 80);
    }
  });

  // 별
  for (const s of STARS) {
    const p = project(s.vector);

    if (!p || p[0] < 0 || p[0] > W || p[1] < 0 || p[1] > H) {
      continue;
    }

    const r = Math.max(0.6, 3.2 - s.mag * 0.55);
    ctx.beginPath();
    ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, 1.2 - s.mag * 0.15)})`;
    ctx.fill();
  }

  // 별자리선: 내 별자리는 금색 굵게, 다른 황도 별자리는 하늘색, 나머지는 흐리게
  const zodiacLabels = new Set(ZODIAC.map((z) => z.label));

  for (const con of CONSTELLATIONS) {
    const mine = con.label === birthLabel;
    const zodiac = zodiacLabels.has(con.label);
    ctx.strokeStyle = mine
      ? "rgb(250,200,60)"
      : zodiac
        ? "rgba(140,190,255,0.7)"
        : "rgba(255,255,255,0.15)";
    ctx.lineWidth = mine ? 3 : zodiac ? 1.5 : 1;
    ctx.beginPath();
    let pen = false;

    for (const v of con.stars) {
      const p = project(v);

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

  // 황도 별자리 이름 (별자리 가운데)
  ctx.textAlign = "center";

  for (const z of ZODIAC) {
    const p = project(constellationCenter(constellationParts(z.label)));

    if (p && p[0] > 0 && p[0] < W && Math.abs(p[1] - H / 2) > 70) {
      const mine = z.label === birthLabel;
      ctx.font = mine ? "bold 16px Arial" : "12px Arial";
      ctx.fillStyle = mine ? "rgb(250,210,90)" : "rgba(170,200,255,0.8)";
      ctx.fillText(z.label, p[0], p[1]);
    }
  }

  // 황도: 해가 지나는 길
  const left = atLon(center + HALF_SPAN_DEG);
  const right = atLon(center - HALF_SPAN_DEG);

  if (left && right) {
    ctx.strokeStyle = "rgba(255,180,80,0.8)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(left[0], left[1]);
    ctx.lineTo(right[0], right[1]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "12px Arial";
    ctx.fillStyle = "rgba(255,190,100,0.9)";
    ctx.textAlign = "left";
    ctx.fillText(
      "황도 (해가 지나는 길) →  해는 하루에 약 1°씩 서쪽(오른쪽)으로",
      12,
      H / 2 - 8,
    );
  }

  // 달마다 1일의 해 자리
  ctx.textAlign = "center";
  ctx.font = "12px Arial";

  for (let m = 1; m <= 12; m++) {
    const jd = julianDay(new Date(Date.UTC(birth.year, m - 1, 1, 12)));
    const lon = toEcliptic(ofDateToJ2000(sunVector(jd), jd)).lonDeg;
    const p = atLon(lon);

    if (p && p[0] > 10 && p[0] < W - 10) {
      ctx.strokeStyle = "rgba(255,190,100,0.9)";
      ctx.beginPath();
      ctx.moveTo(p[0], p[1] - 6);
      ctx.lineTo(p[0], p[1] + 6);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,190,100,0.9)";
      ctx.fillText(`${m}월`, p[0], p[1] + 20);
    }
  }

  // 점성술의 30° 구간 (그날 춘분점 기준 → J2000으로 옮겨 그린다)
  const signIndex = SIGNS.indexOf(sky.sign);
  const shift = sky.sunLonOfDate - sky.sunLonJ2000;
  const sa = atLon(signIndex * 30 - shift);
  const sb = atLon(signIndex * 30 + 30 - shift);

  if (sa && sb) {
    const y = H / 2 - 90;
    ctx.strokeStyle = "rgb(255,120,170)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sa[0], y + 10);
    ctx.lineTo(sa[0], y);
    ctx.lineTo(sb[0], y);
    ctx.lineTo(sb[0], y + 10);
    ctx.stroke();
    ctx.font = "bold 14px Arial";
    ctx.fillStyle = "rgb(255,140,180)";
    ctx.fillText(`점성술의 ${sky.sign} 구간 (30°)`, (sa[0] + sb[0]) / 2, y - 8);
  }

  // 생일의 해
  const sun = atLon(sky.sunLonJ2000);

  if (sun) {
    const glow = ctx.createRadialGradient(
      sun[0],
      sun[1],
      0,
      sun[0],
      sun[1],
      40,
    );
    glow.addColorStop(0, "rgba(255,230,120,0.9)");
    glow.addColorStop(1, "rgba(255,230,120,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(sun[0] - 40, sun[1] - 40, 80, 80);
    ctx.beginPath();
    ctx.arc(sun[0], sun[1], 12, 0, Math.PI * 2);
    ctx.fillStyle = "rgb(255,220,90)";
    ctx.fill();
    ctx.font = "bold 15px Arial";
    ctx.fillStyle = "rgb(255,235,150)";
    ctx.fillText(
      `생일의 해 (${birth.month}월 ${birth.day}일)`,
      sun[0],
      sun[1] - 22,
    );
  }

  ctx.textAlign = "left";
  ctx.font = "12px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText("← 동", 12, H - 12);
  ctx.textAlign = "right";
  ctx.fillText("서 →", W - 12, H - 12);
  ctx.textAlign = "left";
};
