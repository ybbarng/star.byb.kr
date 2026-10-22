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
// 질문 대비: 10° 원을 모두 켜면 원이 이웃 칸과 겹치는 것(그래서 겹친 조합을 지운다)이, 경위도 192칸으로
// 바꾸면 극으로 갈수록 칸이 좁아지는 것(그래서 같은 넓이로 나누는 HEALPix를 쓴다)이 보인다.

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

// 경위도 192칸: 적경 22.5°(16줄) × 적위 15°(12줄). HEALPix 칸 수와 같게 맞춘 비교용
const RA_STEP = 22.5;
const DEC_STEP = 15;
const SQ_DEG = (180 / Math.PI) ** 2;
const HEALPIX_CELL_SQ_DEG = (4 * Math.PI * SQ_DEG) / healpix.nside2npix(NSIDE);

const vecOf = (raDeg: number, decDeg: number): Point3D => [
  Math.cos(decDeg * D) * Math.cos(raDeg * D),
  Math.cos(decDeg * D) * Math.sin(raDeg * D),
  Math.sin(decDeg * D),
];

const GRID_LINES: Point3D[][] = [
  // 적경 선(경선)
  ...Array.from({ length: 360 / RA_STEP }, (_, i) =>
    Array.from({ length: 37 }, (_, t) => vecOf(i * RA_STEP, -90 + t * 5)),
  ),
  // 적위 선(위선)
  ...Array.from({ length: 180 / DEC_STEP - 1 }, (_, j) =>
    Array.from({ length: 73 }, (_, t) =>
      vecOf(t * 5, -90 + (j + 1) * DEC_STEP),
    ),
  ),
];

const gridCellOf = (v: Point3D) => {
  const { ra, dec } = raDecOf(v);

  return {
    ra: Math.min(360 / RA_STEP - 1, Math.floor((ra * 15) / RA_STEP)),
    dec: Math.min(180 / DEC_STEP - 1, Math.floor((dec + 90) / DEC_STEP)),
  };
};

const STAR_GRID = STARS.map((s) => {
  const g = gridCellOf(s.vector);

  return g.dec * (360 / RA_STEP) + g.ra;
});

const gridStats = (ra: number, dec: number, magLimit: number) => {
  const lo = -90 + dec * DEC_STEP;
  const hi = lo + DEC_STEP;
  const area = RA_STEP * D * (Math.sin(hi * D) - Math.sin(lo * D)) * SQ_DEG;
  const index = dec * (360 / RA_STEP) + ra;
  const stars = STARS.filter(
    (s, i) => s.mag <= magLimit && STAR_GRID[i] === index,
  ).length;
  const edge = [
    ...Array.from({ length: 9 }, (_, t) =>
      vecOf(ra * RA_STEP + (t * RA_STEP) / 8, lo),
    ),
    ...Array.from({ length: 9 }, (_, t) =>
      vecOf((ra + 1) * RA_STEP, lo + (t * DEC_STEP) / 8),
    ),
    ...Array.from({ length: 9 }, (_, t) =>
      vecOf((ra + 1) * RA_STEP - (t * RA_STEP) / 8, hi),
    ),
    ...Array.from({ length: 9 }, (_, t) =>
      vecOf(ra * RA_STEP, hi - (t * DEC_STEP) / 8),
    ),
  ];

  return { lo, hi, area, stars, edge };
};

// 중심에서 r° 원 (구 위의 작은 원)
const circleAround = (center: Point3D, deg: number): Point3D[] => {
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
  const r = deg * D;

  return Array.from({ length: 65 }, (_, i): Point3D => {
    const t = (i / 64) * 2 * Math.PI;

    return [0, 1, 2].map(
      (k) =>
        center[k] * Math.cos(r) +
        (u[k] * Math.cos(t) + w[k] * Math.sin(t)) * Math.sin(r),
    ) as Point3D;
  });
};

const CELL_CENTERS = Array.from(
  { length: healpix.nside2npix(NSIDE) },
  (_, ipix) => healpix.pix2vec_nest(NSIDE, ipix) as Point3D,
);
const CELL_CIRCLES = CELL_CENTERS.map((c) => circleAround(c, CELL_RADIUS_DEG));

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
  | { kind: "grid"; ra: number; dec: number }
  | null;

type CellMode = "none" | "healpix" | "grid";

export default function SkySphere() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [yaw, setYaw] = useState(-2.4);
  const [pitch, setPitch] = useState(-1.0);
  const [magLimit, setMagLimit] = useState(5);
  const [showLines, setShowLines] = useState(true);
  const [cellMode, setCellMode] = useState<CellMode>("none");
  const [showCircles, setShowCircles] = useState(false);
  const showCells = cellMode === "healpix";
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
  const grid = useMemo(
    () =>
      picked?.kind === "grid"
        ? gridStats(picked.ra, picked.dec, magLimit)
        : null,
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

    if (cellMode === "grid") {
      GRID_LINES.forEach((line) => polyline(line, "rgba(244,170,255,0.3)"));
    }

    if (showCells && showCircles) {
      // 칸마다 중심과 10° 원: 이웃 칸의 원과 겹친다
      CELL_CIRCLES.forEach((circle) =>
        polyline(circle, "rgba(253,230,138,0.22)"),
      );
      context.fillStyle = "rgba(253,230,138,0.8)";
      CELL_CENTERS.forEach((v) => {
        const p = project(v);

        if (!p.front) return;

        context.beginPath();
        context.arc(p.x, p.y, 2, 0, 2 * Math.PI);
        context.fill();
      });
    }

    if (cell) {
      // 고른 칸: 중심에서 10° 원
      polyline(
        circleAround(cell.center, CELL_RADIUS_DEG),
        "rgba(253,230,138,0.9)",
        2,
      );
      polyline(CELL_EDGES[cell.ipix], "rgba(120,200,255,0.9)", 1.5);
    }

    if (grid) {
      polyline(grid.edge, "rgba(244,170,255,0.95)", 2);
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
        : cellMode === "grid"
          ? `hsl(${(STAR_GRID[i] * 137.5) % 360} 80% 72%)`
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
  }, [
    yaw,
    pitch,
    magLimit,
    showLines,
    showCells,
    cellMode,
    showCircles,
    picked,
    cell,
    grid,
  ]);

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

    if (cellMode === "grid") {
      setPicked({ kind: "grid", ...gridCellOf(v) });

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
            setCellMode(showCells ? "none" : "healpix");
            setPicked(null);
          }}
        >
          HEALPix 192칸
        </button>
        {showCells && (
          <button
            className={cn("btn btn-xs", showCircles && "btn-warning")}
            onClick={() => setShowCircles(!showCircles)}
          >
            10° 원 모두
          </button>
        )}
        <button
          className={cn("btn btn-xs", cellMode === "grid" && "btn-secondary")}
          onClick={() => {
            setCellMode(cellMode === "grid" ? "none" : "grid");
            setPicked(null);
          }}
        >
          경위도 192칸
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
        ) : grid ? (
          <div className="flex flex-col gap-1">
            <div className="font-bold">
              경위도 칸 (적위 {grid.lo}°~{grid.hi}°) · 넓이{" "}
              {Math.round(grid.area)}제곱도 · 별 {grid.stars}개
            </div>
            <div className="opacity-80">
              HEALPix 칸은 어디서나 {Math.round(HEALPIX_CELL_SQ_DEG)}제곱도예요.
              경위도 칸은 적도 근처 333제곱도, 극 근처 44제곱도로 7.6배 차이
              나서 칸마다 별 수가 고르지 않아요.
            </div>
          </div>
        ) : showCells && showCircles ? (
          <div className="opacity-80">
            칸마다 중심에서 10° 원 안의 별로 조합을 만들어요. 원이 이웃 칸과
            겹쳐서 같은 조합이 여러 칸에서 나오면 하나만 남겨요 (84,962 →
            82,703개). 칸을 누르면 그 칸의 조합 수를 보여 줘요.
          </div>
        ) : (
          <div className="opacity-60">
            끌어서 돌려 보세요. 별을 누르면 위치를,{" "}
            {showCells
              ? "칸을 누르면 그 칸의 별 넷 조합 수를"
              : cellMode === "grid"
                ? "칸을 누르면 그 칸의 넓이를"
                : "HEALPix를 켜고 칸을 누르면 그 칸의 조합 수를"}{" "}
            보여 줘요.
          </div>
        )}
      </div>
    </div>
  );
}
