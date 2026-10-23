import type { Shape } from "@/game/myConstellation/shape";
import type { Point3D } from "@/scripts/hash/types";
import { edgesOf, STAR_BY_HR, starsOf } from "@/game/myConstellation/shape";
import { CONSTELLATIONS, STARS } from "@/game/sky/catalog";

// 나만의 별자리를 만드는 별 지도: 하늘 안쪽에서 올려다본 평사 투영 (북이 위, 동이 왼쪽 — 실제로 올려다본 모습).
// 끌어서 하늘을 돌리고, 확대·축소하고, 별을 눌러 잇는다. 별은 5등급까지(카탈로그 전부)를 그린다.

export const MAP_W = 960;
export const MAP_H = 720;

export const MIN_SCALE = 320;
export const MAX_SCALE = 3200;

const D = Math.PI / 180;
const FONT = '"Pretendard Variable", Pretendard, system-ui, sans-serif';

export interface MapView {
  raDeg: number; // 가운데 적경
  decDeg: number; // 가운데 적위
  scale: number; // 가운데 근처에서 1라디안이 몇 px인지
}

export const vectorOf = (raDeg: number, decDeg: number): Point3D => [
  Math.cos(decDeg * D) * Math.cos(raDeg * D),
  Math.cos(decDeg * D) * Math.sin(raDeg * D),
  Math.sin(decDeg * D),
];

const dot = (a: Point3D, b: Point3D) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const viewToward = (v: Point3D, scale: number): MapView => ({
  raDeg: (((Math.atan2(v[1], v[0]) / D) % 360) + 360) % 360,
  decDeg: Math.max(-89, Math.min(89, Math.asin(v[2]) / D)),
  scale,
});

// 별 지도 투영: 방향 → 지도 좌표 (가운데에서 반대쪽 하늘은 그리지 않는다)
export const mapProjector = (view: MapView, W = MAP_W, H = MAP_H) => {
  const c = vectorOf(view.raDeg, view.decDeg);
  const en = Math.hypot(c[0], c[1]) || 1;
  const east: Point3D = [-c[1] / en, c[0] / en, 0];
  const north: Point3D = [
    c[1] * east[2] - c[2] * east[1],
    c[2] * east[0] - c[0] * east[2],
    c[0] * east[1] - c[1] * east[0],
  ];

  return (v: Point3D) => {
    const cos = dot(v, c);

    if (cos < -0.2) {
      return null;
    }

    const k = (2 * view.scale) / (1 + cos);

    return { x: W / 2 - k * dot(v, east), y: H / 2 - k * dot(v, north) };
  };
};

// 끌기: 손가락을 오른쪽으로 끌면 왼쪽(동쪽) 하늘이 가운데로 온다
export const panView = (view: MapView, dx: number, dy: number): MapView => {
  const pxPerDeg = view.scale * D;

  return {
    ...view,
    raDeg:
      (((view.raDeg +
        dx / pxPerDeg / Math.max(0.15, Math.cos(view.decDeg * D))) %
        360) +
        360) %
      360,
    decDeg: Math.max(-89, Math.min(89, view.decDeg + dy / pxPerDeg)),
  };
};

export const zoomView = (view: MapView, factor: number): MapView => ({
  ...view,
  scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, view.scale * factor)),
});

export interface MapStar {
  hr: string;
  x: number;
  y: number;
  mag: number;
}

// 누른 자리에서 가장 그럴듯한 별: 반지름 안에서 가까운 것, 거리가 비슷하면 밝은 것
export const pickMapStar = (
  stars: MapStar[],
  x: number,
  y: number,
  radius: number,
): string | null => {
  let best: string | null = null;
  let bestScore = Infinity;

  for (const s of stars) {
    const d = Math.hypot(s.x - x, s.y - y);

    if (d > radius) {
      continue;
    }

    const score = d + s.mag * radius * 0.12;

    if (score < bestScore) {
      bestScore = score;
      best = s.hr;
    }
  }

  return best;
};

const starRadius = (mag: number) =>
  Math.max(1.1, Math.min(7, 1.3 * 10 ** ((-0.4 * (mag - 5)) / 2.2)));

const STAR_COLORS = [
  "255,190,150",
  "255,220,185",
  "255,246,232",
  "228,236,255",
  "200,215,255",
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

export interface StarMapOptions {
  shape: Shape;
  showReal: boolean; // 진짜 별자리선·이름을 흐리게
  W?: number;
  H?: number;
}

export const drawStarMap = (
  ctx: CanvasRenderingContext2D,
  view: MapView,
  o: StarMapOptions,
): MapStar[] => {
  const W = o.W ?? MAP_W;
  const H = o.H ?? MAP_H;
  const project = mapProjector(view, W, H);
  const inView = (p: { x: number; y: number } | null) =>
    !!p && p.x > -40 && p.x < W + 40 && p.y > -40 && p.y < H + 40;

  const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
  bg.addColorStop(0, "#111a3d");
  bg.addColorStop(1, "#070a1c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 적경·적위 눈금 (적위 30°, 적경 2시간마다)
  ctx.strokeStyle = "rgba(140,160,255,0.09)";
  ctx.lineWidth = 1;

  const polyline = (pts: Point3D[]) => {
    ctx.beginPath();
    let prev: { x: number; y: number } | null = null;

    for (const v of pts) {
      const p = project(v);

      if (p && prev && Math.hypot(p.x - prev.x, p.y - prev.y) < W) {
        ctx.lineTo(p.x, p.y);
      } else if (p) {
        ctx.moveTo(p.x, p.y);
      }

      prev = p;
    }

    ctx.stroke();
  };

  for (let dec = -60; dec <= 60; dec += 30) {
    polyline(
      Array.from({ length: 181 }, (_, i) => vectorOf(i * 2, dec)) as Point3D[],
    );
  }

  for (let ra = 0; ra < 360; ra += 30) {
    polyline(Array.from({ length: 89 }, (_, i) => vectorOf(ra, -88 + i * 2)));
  }

  // 진짜 별자리: 흐린 선과 이름
  if (o.showReal) {
    ctx.strokeStyle = "rgba(150,170,255,0.22)";
    ctx.lineWidth = 1.2;
    const labels = new Map<string, { x: number; y: number; n: number }>();

    for (const c of CONSTELLATIONS) {
      polyline(c.stars);

      for (const v of c.stars) {
        const p = project(v);

        if (inView(p)) {
          const l = labels.get(c.label) ?? { x: 0, y: 0, n: 0 };
          l.x += p!.x;
          l.y += p!.y;
          l.n++;
          labels.set(c.label, l);
        }
      }
    }

    ctx.font = `600 15px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(170,185,255,0.42)";

    for (const [label, l] of labels) {
      ctx.fillText(label, l.x / l.n, l.y / l.n);
    }
  }

  // 별
  const shown: MapStar[] = [];

  for (const s of STARS) {
    const p = project(s.vector);

    if (!inView(p)) {
      continue;
    }

    const r =
      starRadius(s.mag) * Math.min(1.6, Math.max(0.8, view.scale / 700));
    const rgb = starRgb(s.kelvin);

    if (s.mag < 1.5) {
      const g = ctx.createRadialGradient(p!.x, p!.y, 0, p!.x, p!.y, r * 4);
      g.addColorStop(0, `rgba(${rgb},0.35)`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(p!.x - r * 4, p!.y - r * 4, r * 8, r * 8);
    }

    ctx.fillStyle = `rgba(${rgb},${Math.min(1, 0.55 + r / 6)})`;
    ctx.beginPath();
    ctx.arc(p!.x, p!.y, r, 0, Math.PI * 2);
    ctx.fill();
    shown.push({ hr: s.hr, x: p!.x, y: p!.y, mag: s.mag });
  }

  // 밝은 별 이름 (길 찾기용)
  ctx.font = `500 13px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.5)";

  for (const s of STARS) {
    if (s.mag > (view.scale > 900 ? 2.6 : 1.6) || !s.name) {
      continue;
    }

    const p = project(s.vector);

    if (inView(p)) {
      ctx.fillText(s.name, p!.x + 7, p!.y - 6);
    }
  }

  // 내 별자리: 금색 선과 고리
  const at = (hr: string) => {
    const s = STAR_BY_HR.get(hr);

    return s ? project(s.vector) : null;
  };

  ctx.strokeStyle = "rgba(255,214,120,0.95)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(255,200,90,0.8)";
  ctx.shadowBlur = 8;

  for (const [a, b] of edgesOf(o.shape)) {
    const pa = at(a);
    const pb = at(b);

    if (pa && pb && Math.hypot(pa.x - pb.x, pa.y - pb.y) < W * 1.5) {
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
  }

  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;

  for (const hr of starsOf(o.shape)) {
    const p = at(hr);

    if (p) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // 펜이 닿아 있는 별: 분홍 고리
  const last = o.shape.strokes[o.shape.strokes.length - 1];

  if (o.shape.open && last) {
    const p = at(last[last.length - 1]);

    if (p) {
      ctx.strokeStyle = "#ff9ecb";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.textAlign = "start";

  return shown;
};
