import type { Point3D } from "@/scripts/hash/types";
import type { Observer } from "@/search/utils/ephemeris";
import { CONSTELLATIONS, STARS } from "@/game/sky/catalog";
import { altOf, frameAt, moonAt, planetAt, sunAt } from "@/game/tonight/report";
import { PLANETS } from "@/search/skyObjects";

// 오늘 밤 내 하늘: 그 시각의 하늘 전체를 둥근 그림 하나로 (천정이 가운데, 가장자리가 지평선).
// 남쪽을 보고 서서 머리 위로 들어 올린 모습이라 북쪽이 위, 동쪽이 왼쪽이다 (평사 투영, 사이트 배경과 같은 방법).

export interface AllSkyOptions {
  size: number; // 정사각형 한 변 (px)
  t: number;
  observer: Observer;
  highlights?: string[]; // 금색으로 그릴 별자리
  labels?: boolean; // 행성·달·별자리 이름
  // 남반구: 북쪽을 보고 서서 드는 그림으로 (북이 아래, 동이 오른쪽)
  flip?: boolean;
  // 캔버스 안에서 그림을 놓을 자리 (기본: 가운데 꽉 차게)
  cx?: number;
  cy?: number;
}

const PLANET_COLOR: Record<string, string> = {
  수성: "#d9d2c5",
  금성: "#fff4c8",
  화성: "#ff8a5c",
  목성: "#ffe2b0",
  토성: "#f3d48c",
};

const STAR_COLORS = [
  "255,180,130",
  "255,215,170",
  "255,244,228",
  "225,233,255",
  "190,208,255",
];

const starRgb = (kelvin: number) =>
  STAR_COLORS[
    kelvin < 3600
      ? 0
      : kelvin < 5000
        ? 1
        : kelvin < 6500
          ? 2
          : kelvin < 9000
            ? 3
            : 4
  ];

const dot = (a: Point3D, b: Point3D) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const FONT = '"Pretendard Variable", Pretendard, system-ui, sans-serif';

export const drawAllSky = (ctx: CanvasRenderingContext2D, o: AllSkyOptions) => {
  const { size, t, observer } = o;
  const f = o.flip ? -1 : 1;
  const cx = o.cx ?? size / 2;
  const cy = o.cy ?? size / 2;
  const R = size / 2 - size * 0.07;
  const frame = frameAt(t, observer);

  const project = (v: Point3D) => {
    const up = dot(frame.zenith, v);

    if (up < -0.02) {
      return null;
    }

    const k = R / (1 + up);

    return {
      x: cx - f * k * dot(frame.east, v),
      y: cy - f * k * dot(frame.north, v),
      up,
    };
  };

  // 하늘 바탕: 해가 아직 덜 졌으면 해 쪽이 물든다
  const sun = sunAt(t);
  const sunAlt = altOf(sun, frame);
  const dusk = Math.max(0, Math.min(1, (sunAlt + 18) / 18));

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();

  const base = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  base.addColorStop(
    0,
    `rgb(${10 + 30 * dusk},${14 + 40 * dusk},${36 + 70 * dusk})`,
  );
  base.addColorStop(
    1,
    `rgb(${24 + 50 * dusk},${30 + 50 * dusk},${70 + 70 * dusk})`,
  );
  ctx.fillStyle = base;
  ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);

  if (dusk > 0) {
    const e = dot(frame.east, sun);
    const n = dot(frame.north, sun);
    const l = Math.hypot(e, n) || 1;
    const gx = cx - (f * R * e) / l;
    const gy = cy - (f * R * n) / l;
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, R * 1.1);
    glow.addColorStop(0, `rgba(255,150,90,${0.55 * dusk ** 1.5})`);
    glow.addColorStop(1, "rgba(255,150,90,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  }

  // 고도 30°·60° 고리 (점선)
  ctx.setLineDash([3, 6]);
  ctx.strokeStyle = "rgba(170,190,255,0.16)";
  ctx.lineWidth = 1;

  for (const alt of [30, 60]) {
    const z = (90 - alt) * (Math.PI / 180);
    const r = R * Math.tan(z / 2);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.setLineDash([]);

  // 별자리선: 흐리게, 고른 별자리는 금색으로
  const highlights = new Set(o.highlights ?? []);
  const labelAt = new Map<string, { x: number; y: number; n: number }>();

  for (const c of CONSTELLATIONS) {
    const on = highlights.has(c.label);
    ctx.strokeStyle = on ? "rgba(255,214,120,0.85)" : "rgba(150,170,255,0.2)";
    ctx.lineWidth = on ? size * 0.004 : size * 0.0018;
    ctx.beginPath();
    let prev: { x: number; y: number } | null = null;

    for (const v of c.stars) {
      const p = project(v);

      if (p && prev) {
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(p.x, p.y);
      }

      if (p && on && p.up > 0) {
        const l = labelAt.get(c.label) ?? { x: 0, y: 0, n: 0 };
        l.x += p.x;
        l.y += p.y;
        l.n++;
        labelAt.set(c.label, l);
      }

      prev = p;
    }

    ctx.stroke();
  }

  // 별: 밝을수록 크게, 표면 온도에 따라 색을. 지평선 가까이는 흐리게
  for (const s of STARS) {
    if (s.mag > 4.8) {
      continue;
    }

    const p = project(s.vector);

    if (!p || p.up < 0) {
      continue;
    }

    const fade = Math.min(1, p.up * 6 + 0.25) * (1 - 0.8 * dusk);
    const r =
      Math.max(
        0.5,
        Math.min(3.6, 0.55 * 10 ** ((-0.4 * (s.mag - 4.5)) / 2.6)),
      ) *
      (size / 560);
    const rgb = starRgb(s.kelvin);

    if (s.mag < 1.5) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4);
      g.addColorStop(0, `rgba(${rgb},${0.35 * fade})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(p.x - r * 4, p.y - r * 4, r * 8, r * 8);
    }

    ctx.fillStyle = `rgba(${rgb},${Math.min(1, (0.45 + r / 3) * fade)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const labels = o.labels !== false;
  const fontSize = Math.round(size * 0.03);

  if (labels) {
    ctx.font = `700 ${fontSize}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,220,140,0.95)";

    for (const [label, l] of labelAt) {
      ctx.fillText(
        label.replace(/자리$/, ""),
        l.x / l.n,
        l.y / l.n + fontSize * 1.6,
      );
    }
  }

  // 행성
  for (const [key, name] of PLANETS) {
    const p = project(planetAt(key, t));

    if (!p || p.up < 0) {
      continue;
    }

    const r = size * 0.009;
    ctx.fillStyle = PLANET_COLOR[name];
    ctx.shadowColor = PLANET_COLOR[name];
    ctx.shadowBlur = size * 0.02;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (labels) {
      ctx.font = `800 ${fontSize}px ${FONT}`;
      ctx.fillStyle = PLANET_COLOR[name];
      ctx.textAlign = "left";
      ctx.fillText(name, p.x + r * 1.8, p.y - r * 1.2);
    }
  }

  // 달: 빛나는 부분을 해 쪽으로
  const moon = moonAt(t, observer);
  const mp = project(moon);

  if (mp && mp.up > -0.01) {
    const cosE = dot(sun, moon);
    const lit = (1 - cosE) / 2;
    const toward = sun.map((c, i) => c - cosE * moon[i]);
    const tl = Math.hypot(toward[0], toward[1], toward[2]) || 1;
    const ahead = moon.map((c, i) => c + (0.02 * toward[i]) / tl) as Point3D;
    const ap = project(ahead);
    const angle = ap ? Math.atan2(ap.y - mp.y, ap.x - mp.x) : 0;
    const r = size * 0.022;

    ctx.save();
    ctx.translate(mp.x, mp.y);
    const halo = ctx.createRadialGradient(0, 0, r, 0, 0, r * 5);
    halo.addColorStop(0, `rgba(255,240,190,${0.3 * lit})`);
    halo.addColorStop(1, "rgba(255,240,190,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(-r * 5, -r * 5, r * 10, r * 10);
    ctx.rotate(angle);
    ctx.fillStyle = "rgba(55,62,90,0.95)";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff1c2";
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
    ctx.ellipse(
      0,
      0,
      Math.abs(1 - 2 * lit) * r,
      r,
      0,
      Math.PI / 2,
      -Math.PI / 2,
      lit < 0.5,
    );
    ctx.fill();
    ctx.restore();

    if (labels) {
      ctx.font = `800 ${fontSize}px ${FONT}`;
      ctx.fillStyle = "#fff1c2";
      ctx.textAlign = "center";
      ctx.fillText("달", mp.x, mp.y + r + fontSize * 1.1);
    }
  }

  ctx.restore();

  // 지평선 테두리와 동서남북
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = size * 0.004;
  ctx.setLineDash([size * 0.012, size * 0.01]);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = `800 ${Math.round(size * 0.04)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const gap = size * 0.038;

  for (const [label, x, y, color] of [
    ["북", cx, cy - f * (R + gap), "#9fd8ff"],
    ["남", cx, cy + f * (R + gap), "#ffb38a"],
    ["동", cx - f * (R + gap), cy, "#ffffff"],
    ["서", cx + f * (R + gap), cy, "#ffffff"],
  ] as const) {
    ctx.fillStyle = color;
    ctx.fillText(label, x, y);
  }

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "start";
};
