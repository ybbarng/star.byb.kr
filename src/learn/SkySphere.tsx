"use client";

import type { Point3D } from "@/scripts/hash/types";
import * as healpix from "@hscmap/healpix";
import { useEffect, useMemo, useRef, useState } from "react";
import { CONSTELLATIONS, STARS } from "@/game/sky/catalog";
import { cn } from "@/utils/cn";

// 별 지도 데모: 별 지도(1,625개)를 손으로 돌려 보는 천구.
// 등급 한계를 바꾸면 별 수가 어떻게 변하는지, 별자리선, HEALPix 192칸을 켜 볼 수 있다.
// 별을 누르면 적경·적위와 단위 벡터를, 칸 모드에서 빈 곳을 누르면 그 칸(중심에서 10°)의 별 수와
// 별 넷 조합 수를 보여 준다 (search/quadDatabase.ts와 같은 규칙).

const NSIDE = 4;
const CELL_RADIUS_DEG = 10;
const D = Math.PI / 180;

type Mat = number[]; // 3×3 행 우선

const rotation = (yaw: number, pitch: number): Mat => {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);

  // 먼저 z축으로 yaw, 그다음 x축으로 pitch
  return [cy, -sy, 0, cp * sy, cp * cy, -sp, sp * sy, sp * cy, cp];
};

const apply = (m: Mat, v: Point3D): Point3D => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];

const applyT = (m: Mat, v: Point3D): Point3D => [
  m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
  m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
  m[2] * v[0] + m[5] * v[1] + m[8] * v[2],
];

const dot = (a: Point3D, b: Point3D) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const normalize = (v: Point3D): Point3D => {
  const n = Math.hypot(v[0], v[1], v[2]);

  return [v[0] / n, v[1] / n, v[2] / n];
};

const raDecOf = (v: Point3D) => ({
  ra: ((Math.atan2(v[1], v[0]) / D + 360) % 360) / 15,
  dec: Math.asin(v[2]) / D,
});

const hms = (hours: number) => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);

  return `${h}시 ${m}분`;
};

const choose4 = (k: number) => (k * (k - 1) * (k - 2) * (k - 3)) / 24;

// 별의 칸 번호 (색칠용)
const STAR_CELLS = STARS.map((s) => healpix.vec2pix_nest(NSIDE, s.vector));

// 칸 경계: 네 모서리를 잇는 변을 잘게 나눠 구 위의 곡선처럼 그린다
const CELL_EDGES: Point3D[][] = Array.from(
  { length: healpix.nside2npix(NSIDE) },
  (_, ipix) => {
    const corners = healpix.corners_nest(NSIDE, ipix) as Point3D[];
    const path: Point3D[] = [];

    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];

      for (let t = 0; t < 8; t++) {
        const f = t / 8;
        path.push(
          normalize([
            a[0] + (b[0] - a[0]) * f,
            a[1] + (b[1] - a[1]) * f,
            a[2] + (b[2] - a[2]) * f,
          ]),
        );
      }
    }

    path.push(corners[0]);

    return path;
  },
);

// 칸 하나의 별과 별 넷 조합 수 (모든 별쌍이 10° 안인 것만)
const cellStats = (ipix: number, magLimit: number) => {
  const center = healpix.pix2vec_nest(NSIDE, ipix) as Point3D;
  const cosR = Math.cos(CELL_RADIUS_DEG * D);
  const stars = STARS.filter(
    (s) => s.mag <= magLimit && dot(s.vector, center) >= cosR,
  );
  const k = stars.length;
  let compact = 0;
  const near = (i: number, j: number) =>
    dot(stars[i].vector, stars[j].vector) >= cosR;

  for (let a = 0; a < k; a++) {
    for (let b = a + 1; b < k; b++) {
      if (!near(a, b)) continue;

      for (let c = b + 1; c < k; c++) {
        if (!near(a, c) || !near(b, c)) continue;

        for (let d = c + 1; d < k; d++) {
          if (near(a, d) && near(b, d) && near(c, d)) compact++;
        }
      }
    }
  }

  return { ipix, center, stars: k, all: choose4(k), compact };
};

type Picked =
  | { kind: "star"; index: number }
  | { kind: "cell"; ipix: number }
  | null;

export default function SkySphere() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [yaw, setYaw] = useState(-2.4);
  const [pitch, setPitch] = useState(-1.0);
  const [magLimit, setMagLimit] = useState(5);
  const [showLines, setShowLines] = useState(true);
  const [showCells, setShowCells] = useState(false);
  const [picked, setPicked] = useState<Picked>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const size = useRef({ width: 600, radius: 280 });

  const visibleCount = useMemo(
    () => STARS.filter((s) => s.mag <= magLimit).length,
    [magLimit],
  );
  const cell = useMemo(
    () => (picked?.kind === "cell" ? cellStats(picked.ipix, magLimit) : null),
    [picked, magLimit],
  );

  useEffect(() => {
    const el = canvas.current;
    const context = el?.getContext("2d");

    if (!el || !context) return;

    const width = el.clientWidth;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = Math.round(width * dpr);
    el.height = Math.round(width * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const radius = width * 0.47;
    const c = width / 2;
    size.current = { width, radius };
    const m = rotation(yaw, pitch);

    // 화면 x = 회전 후 x, 화면 y = -z, 앞쪽(보이는 쪽) = y > 0
    const project = (v: Point3D) => {
      const r = apply(m, v);

      return { x: c + r[0] * radius, y: c - r[2] * radius, front: r[1] > 0 };
    };

    context.clearRect(0, 0, width, width);
    const glow = context.createRadialGradient(c, c, radius * 0.2, c, c, radius);
    glow.addColorStop(0, "#141a33");
    glow.addColorStop(1, "#0b0f22");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(c, c, radius, 0, 2 * Math.PI);
    context.fill();
    context.strokeStyle = "rgba(160,180,255,0.35)";
    context.stroke();

    const polyline = (points: Point3D[], style: string, width = 1) => {
      context.strokeStyle = style;
      context.lineWidth = width;
      context.beginPath();
      let prevFront = false;

      for (const v of points) {
        const p = project(v);

        if (p.front && prevFront) {
          context.lineTo(p.x, p.y);
        } else if (p.front) {
          context.moveTo(p.x, p.y);
        }

        prevFront = p.front;
      }

      context.stroke();
    };

    if (showCells) {
      CELL_EDGES.forEach((edge) => polyline(edge, "rgba(120,200,255,0.22)"));
    }

    if (cell) {
      // 고른 칸: 중심에서 10° 원
      const center = cell.center;
      const axis: Point3D = Math.abs(center[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
      const u = normalize([
        center[1] * axis[2] - center[2] * axis[1],
        center[2] * axis[0] - center[0] * axis[2],
        center[0] * axis[1] - center[1] * axis[0],
      ]);
      const w: Point3D = [
        center[1] * u[2] - center[2] * u[1],
        center[2] * u[0] - center[0] * u[2],
        center[0] * u[1] - center[1] * u[0],
      ];
      const r = CELL_RADIUS_DEG * D;
      const circle = Array.from({ length: 65 }, (_, i): Point3D => {
        const t = (i / 64) * 2 * Math.PI;

        return [0, 1, 2].map(
          (k) =>
            center[k] * Math.cos(r) +
            (u[k] * Math.cos(t) + w[k] * Math.sin(t)) * Math.sin(r),
        ) as Point3D;
      });
      polyline(circle, "rgba(253,230,138,0.9)", 2);
      polyline(CELL_EDGES[cell.ipix], "rgba(120,200,255,0.9)", 1.5);
    }

    if (showLines) {
      CONSTELLATIONS.forEach((line) =>
        polyline(line.stars, "rgba(253,230,138,0.28)"),
      );
    }

    STARS.forEach((s, i) => {
      if (s.mag > magLimit) return;

      const p = project(s.vector);

      if (!p.front) return;

      const r = Math.max(0.6, 2.6 - s.mag * 0.42);
      const inCell =
        cell && dot(s.vector, cell.center) >= Math.cos(CELL_RADIUS_DEG * D);

      context.fillStyle = showCells
        ? `hsl(${(STAR_CELLS[i] * 137.5) % 360} 80% 72%)`
        : inCell
          ? "#fde68a"
          : "rgba(235,240,255,0.95)";

      if (cell && !inCell && !showCells) {
        context.fillStyle = "rgba(235,240,255,0.45)";
      }

      context.beginPath();
      context.arc(p.x, p.y, r, 0, 2 * Math.PI);
      context.fill();

      if (picked?.kind === "star" && picked.index === i) {
        context.strokeStyle = "#fde68a";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(p.x, p.y, r + 6, 0, 2 * Math.PI);
        context.stroke();
      }
    });
  }, [yaw, pitch, magLimit, showLines, showCells, picked, cell]);

  // 누른 곳 → 가장 가까운 별, 칸 모드면 그 칸
  const pick = (clientX: number, clientY: number) => {
    const el = canvas.current;

    if (!el) return;

    const rect = el.getBoundingClientRect();
    const { width, radius } = size.current;
    const x = (clientX - rect.left - width / 2) / radius;
    const z = -(clientY - rect.top - width / 2) / radius;

    if (x * x + z * z > 1) return;

    const v = applyT(rotation(yaw, pitch), [
      x,
      Math.sqrt(1 - x * x - z * z),
      z,
    ]);

    if (showCells) {
      setPicked({ kind: "cell", ipix: healpix.vec2pix_nest(NSIDE, v) });

      return;
    }

    let best = -1;
    let bestDot = Math.cos(3 * D);

    STARS.forEach((s, i) => {
      if (s.mag > magLimit) return;

      const d = dot(s.vector, v);

      if (d > bestDot) {
        bestDot = d;
        best = i;
      }
    });

    setPicked(best >= 0 ? { kind: "star", index: best } : null);
  };

  const star = picked?.kind === "star" ? STARS[picked.index] : null;
  const starRaDec = star ? raDecOf(star.vector) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-2">
          등급 한계 {magLimit.toFixed(1)}
          <input
            type="range"
            className="range range-xs w-32"
            min={2}
            max={5}
            step={0.5}
            value={magLimit}
            onChange={(e) => setMagLimit(Number(e.target.value))}
          />
        </label>
        <span className="badge badge-ghost">
          별 {visibleCount.toLocaleString("ko-KR")}개
        </span>
        <div className="grow" />
        <button
          className={cn("btn btn-xs", showLines && "btn-active")}
          onClick={() => setShowLines(!showLines)}
        >
          별자리선
        </button>
        <button
          className={cn("btn btn-xs", showCells && "btn-info")}
          onClick={() => {
            setShowCells(!showCells);
            setPicked(null);
          }}
        >
          HEALPix 192칸
        </button>
      </div>
      <canvas
        ref={canvas}
        className="mx-auto aspect-square w-full max-w-[520px] cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, moved: false };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;

          if (!d) return;

          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;

          if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true;

          setYaw((y) => y + dx * 0.006);
          setPitch((p) => Math.max(-1.55, Math.min(1.55, p + dy * 0.006)));
          d.x = e.clientX;
          d.y = e.clientY;
        }}
        onPointerUp={(e) => {
          if (drag.current && !drag.current.moved) pick(e.clientX, e.clientY);

          drag.current = null;
        }}
      />
      <div className="bg-base-300/60 rounded-box min-h-16 p-3 text-sm">
        {star && starRaDec ? (
          <div className="flex flex-col gap-1">
            <div className="font-bold">
              {star.name ?? `HR ${star.hr}`} · {star.mag.toFixed(1)}등급
            </div>
            <div className="opacity-80">
              적경 {hms(starRaDec.ra)} · 적위 {starRaDec.dec.toFixed(1)}°
            </div>
            <div className="font-mono text-xs text-indigo-200">
              단위 벡터 ({star.vector.map((c) => c.toFixed(3)).join(", ")})
            </div>
          </div>
        ) : cell ? (
          <div className="flex flex-col gap-1">
            <div className="font-bold">
              {picked?.kind === "cell" && picked.ipix}번 칸 · 중심에서 10° 안의
              별 {cell.stars}개
            </div>
            <div className="opacity-80">
              네 별 조합 {cell.all.toLocaleString("ko-KR")}개 중, 모든 별쌍이
              10° 안인 것 {cell.compact.toLocaleString("ko-KR")}개만 색인에
              넣어요.
            </div>
          </div>
        ) : (
          <div className="opacity-60">
            끌어서 돌려 보세요. 별을 누르면 위치를,{" "}
            {showCells
              ? "칸을 누르면 그 칸의 별 넷 조합 수를"
              : "HEALPix를 켜고 칸을 누르면 그 칸의 조합 수를"}{" "}
            보여 줘요.
          </div>
        )}
      </div>
    </div>
  );
}
