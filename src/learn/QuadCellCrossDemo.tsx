"use client";

import type { Point3D } from "@/scripts/hash/types";
import * as healpix from "@hscmap/healpix";
import { useEffect, useMemo, useRef, useState } from "react";
import { CONSTELLATIONS, STARS } from "@/game/sky/catalog";
import { generateQuadDatabase } from "@/search/quadDatabase";
import {
  BRIGHT_TRIANGLE,
  TRIANGLE_MAX_ANGLE_DEG,
} from "@/search/solverContext";

// quad는 HEALPix 칸 원 안에 갇히고, 삼각형은 칸 경계를 넘는다.
// 실제 별자리 위에 HEALPix 칸(nside 4)과 칸 중심에서 10° 원 두 개를 그리고, 각 원 안의 quad(지금 풀이와 같은
// search/quadDatabase.ts로 만든 것)와, 두 원 사이를 잇는 삼각형(search/solverContext.ts의 색인 규칙)을 보인다.
// 두 원은 별자리 별을 가장 많이 담는 칸과, 그 칸이 못 담은 별을 가장 많이 담는 칸이다.
// 경계를 넘는 삼각형은 세 별을 한꺼번에 담는 칸 원이 하나도 없는 것만 고른다 — 같은 별 셋은 어떤 quad에도 같이 못 든다.

const NSIDE = 4;
const CELL_RADIUS_DEG = 10;
const D = Math.PI / 180;
const W = 760;
const H = 480;

const SHAPES = [
  {
    name: "북두칠성",
    hrs: ["4301", "4295", "4554", "4660", "4905", "5054", "5191"],
  },
  {
    name: "오리온",
    hrs: ["2061", "1790", "1852", "1903", "1948", "2004", "1713"],
  },
  { name: "카시오페이아", hrs: ["21", "168", "264", "403", "542"] },
];

const dot = (a: Point3D, b: Point3D) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const angle = (a: Point3D, b: Point3D) =>
  Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) / D;

const unit = (v: number[]): Point3D => {
  const n = Math.hypot(v[0], v[1], v[2]);

  return [v[0] / n, v[1] / n, v[2] / n];
};

const vec = (i: number) => STARS[i].vector as Point3D;
const nameOf = (i: number) => STARS[i].name ?? `HR ${STARS[i].hr}`;
const CELL_CENTERS = Array.from(
  { length: healpix.nside2npix(NSIDE) },
  (_, ipix) => healpix.pix2vec_nest(NSIDE, ipix) as Point3D,
);
const cosCell = Math.cos(CELL_RADIUS_DEG * D);
const inCell = (ipix: number, i: number) =>
  dot(CELL_CENTERS[ipix], vec(i)) >= cosCell;

const circleAround = (c: Point3D, deg: number): Point3D[] => {
  const helper: Point3D = Math.abs(c[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = unit([
    c[1] * helper[2] - c[2] * helper[1],
    c[2] * helper[0] - c[0] * helper[2],
    c[0] * helper[1] - c[1] * helper[0],
  ]);
  const w: Point3D = [
    c[1] * u[2] - c[2] * u[1],
    c[2] * u[0] - c[0] * u[2],
    c[0] * u[1] - c[1] * u[0],
  ];

  return Array.from({ length: 73 }, (_, k) => {
    const t = (k / 72) * 2 * Math.PI;

    return unit(
      [0, 1, 2].map(
        (a) =>
          Math.cos(deg * D) * c[a] +
          Math.sin(deg * D) * (Math.cos(t) * u[a] + Math.sin(t) * w[a]),
      ),
    );
  });
};

const cellEdge = (ipix: number): Point3D[] => {
  const corners = healpix.corners_nest(NSIDE, ipix) as Point3D[];
  const path: Point3D[] = [];

  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];

    for (let t = 0; t <= 8; t++) {
      path.push(unit([0, 1, 2].map((k) => a[k] + ((b[k] - a[k]) * t) / 8)));
    }
  }

  return path;
};

// 한 별에서 나머지 두 별이 모두 maxDeg 안이면 삼각형 색인에 있다
const inTriangleIndex = (tri: number[], maxDeg: number) =>
  tri.some((c) => tri.every((o) => o === c || angle(vec(c), vec(o)) <= maxDeg));

export default function QuadCellCrossDemo() {
  const [shape, setShape] = useState(0);
  const [quadPick, setQuadPick] = useState(0);
  const [triPick, setTriPick] = useState(0);
  const [quadDb, setQuadDb] = useState<string[][] | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const id = window.setTimeout(
      () =>
        setQuadDb(
          generateQuadDatabase(
            STARS.map((s) => ({ hr: s.hr, vector: s.vector as Point3D })),
          ).map((q) => q.stars as string[]),
        ),
      50,
    );

    return () => window.clearTimeout(id);
  }, []);

  const scene = useMemo(() => {
    if (!quadDb) return null;

    const ids = SHAPES[shape].hrs
      .map((hr) => STARS.findIndex((s) => s.hr === hr))
      .filter((i) => i >= 0);
    const count = (ipix: number, only: (i: number) => boolean) =>
      ids.filter((i) => only(i) && inCell(ipix, i)).length;
    const cells = CELL_CENTERS.map((_, ipix) => ipix);
    const hrIndex = new Map(STARS.map((s, i) => [s.hr, i]));
    const isShape = new Set(ids);
    const allQuads = quadDb.map((q) => q.map((hr) => hrIndex.get(hr)!));

    // 고르게 퍼진 모양일수록 높게 (가장 가까운 쌍 ÷ 가장 먼 쌍): 붙어 있는 별 둘이 낀 납작한 모양을 피한다
    const fatness = (ids: number[]) => {
      const d = ids.flatMap((i) =>
        ids.filter((j) => j > i).map((j) => angle(vec(i), vec(j))),
      );

      return Math.min(...d) / Math.max(...d);
    };

    const magSum = (ids: number[]) => ids.reduce((s, i) => s + STARS[i].mag, 0);
    // 원 안에서만 만들어진 quad 중 별자리 별을 많이 쓰고, 고르게 퍼지고, 밝은 것부터
    const quadsIn = (cell: number) =>
      allQuads
        .filter((q) => q.every((i) => inCell(cell, i)))
        .map((q) => ({
          q,
          score:
            q.filter((i) => isShape.has(i)).length * 4 +
            fatness(q) * 10 -
            magSum(q) * 0.5,
        }))
        .sort((x, y) => y.score - x.score)
        .slice(0, 6)
        .map((x) => x.q);
    const a = cells.reduce((best, c) =>
      count(c, () => true) > count(best, () => true) ? c : best,
    );
    // B: A가 못 담은 별자리 별을 가장 많이 담고, 그 원 안에 quad가 있는 칸
    const bCandidates = cells
      .filter((c) => c !== a && count(c, (i) => !inCell(a, i)) > 0)
      .map((c) => ({ c, quads: quadsIn(c) }))
      .filter((x) => x.quads.length > 0)
      .sort(
        (x, y) =>
          count(y.c, (i) => !inCell(a, i)) - count(x.c, (i) => !inCell(a, i)),
      );
    const b = bCandidates[0]?.c ?? a;
    // 별자리 별 셋 중 삼각형 색인에 있지만 어느 칸 원에도 함께 들지 않는 것
    const triangles: number[][] = [];

    for (let x = 0; x < ids.length; x++) {
      for (let y = x + 1; y < ids.length; y++) {
        for (let z = y + 1; z < ids.length; z++) {
          const t = [ids[x], ids[y], ids[z]];
          const indexed =
            inTriangleIndex(t, TRIANGLE_MAX_ANGLE_DEG) ||
            (t.every((i) => STARS[i].mag <= BRIGHT_TRIANGLE.maxMag) &&
              inTriangleIndex(t, BRIGHT_TRIANGLE.maxAngleDeg));
          const together = CELL_CENTERS.some((_, c) =>
            t.every((i) => inCell(c, i)),
          );

          if (indexed && !together) triangles.push(t);
        }
      }
    }

    const triScore = (t: number[]) => fatness(t) * 10 - magSum(t) * 0.5;
    triangles.sort((p, q) => triScore(q) - triScore(p));

    // 두 칸 원과 별자리 별이 모두 보이게
    const center = unit(
      [0, 1, 2].map(
        (k) =>
          ids.reduce((s, i) => s + vec(i)[k], 0) / ids.length +
          CELL_CENTERS[a][k] +
          CELL_CENTERS[b][k],
      ),
    );
    const viewDeg =
      Math.max(
        ...ids.map((i) => angle(vec(i), center)),
        angle(CELL_CENTERS[a], center) + CELL_RADIUS_DEG,
        angle(CELL_CENTERS[b], center) + CELL_RADIUS_DEG,
      ) + 1.5;

    return {
      ids,
      a,
      b,
      quadsA: quadsIn(a),
      quadsB: bCandidates[0]?.quads ?? [],
      triangles,
      center,
      viewDeg,
    };
  }, [quadDb, shape]);

  const quadA = scene?.quadsA[quadPick % Math.max(1, scene.quadsA.length)];
  const quadB = scene?.quadsB[quadPick % Math.max(1, scene.quadsB.length)];
  const tri = scene?.triangles[triPick % Math.max(1, scene.triangles.length)];

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");

    if (!el || !ctx || !scene) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = W * dpr;
    el.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0b0f22";
    ctx.fillRect(0, 0, W, H);

    // 하늘을 올려다본 방향: 위가 북쪽, 왼쪽이 동쪽 (접선 평면)
    const c = scene.center;
    const north: Point3D = [0, 0, 1];
    const up = unit(north.map((v, k) => v - dot(north, c) * c[k]));
    const east: Point3D = [
      up[1] * c[2] - up[2] * c[1],
      up[2] * c[0] - up[0] * c[2],
      up[0] * c[1] - up[1] * c[0],
    ];
    const scale = (Math.min(W, H) / 2 / Math.tan(scene.viewDeg * D)) * 0.98;

    const project = (v: Point3D) => {
      const z = dot(v, c);

      return {
        x: W / 2 - (dot(v, east) / z) * scale,
        y: H / 2 - (dot(v, up) / z) * scale,
        front: z > 0.2,
      };
    };

    const path = (pts: Point3D[], close = false) => {
      ctx.beginPath();
      pts.forEach((v, k) => {
        const p = project(v);

        if (k) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
      });

      if (close) ctx.closePath();
    };

    // HEALPix 칸 경계
    ctx.strokeStyle = "rgba(120,200,255,0.18)";
    ctx.lineWidth = 1;
    CELL_CENTERS.forEach((cc, ipix) => {
      if (angle(cc, c) > scene.viewDeg + 15) return;

      path(cellEdge(ipix));
      ctx.stroke();
    });

    // 별자리선
    ctx.strokeStyle = "rgba(253,230,138,0.25)";

    for (const line of CONSTELLATIONS) {
      if (line.stars.every((v) => angle(v as Point3D, c) > scene.viewDeg + 5))
        continue;

      path(line.stars as Point3D[]);
      ctx.stroke();
    }

    // 별
    STARS.forEach((s, i) => {
      if (angle(vec(i), c) > scene.viewDeg + 5) return;

      const p = project(vec(i));
      ctx.fillStyle = scene.ids.includes(i)
        ? "rgba(255,255,255,0.95)"
        : "rgba(226,232,240,0.55)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1, 4 - s.mag * 0.6), 0, 2 * Math.PI);
      ctx.fill();
    });

    // 칸 원 두 개와 그 안의 quad
    const drawCell = (ipix: number, color: string, label: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      path(circleAround(CELL_CENTERS[ipix], CELL_RADIUS_DEG), true);
      ctx.stroke();
      ctx.setLineDash([]);
      const p = project(CELL_CENTERS[ipix]);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, 2 * Math.PI);
      ctx.fill();
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(label, p.x + 6, p.y - 6);
    };

    const drawPolygon = (ids: number[], stroke: string, fill: string) => {
      // 무게중심 둘레 각도 순으로 이어 선이 엇갈리지 않게
      const pts = ids.map((i) => project(vec(i)));
      const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      pts.sort(
        (p, q) =>
          Math.atan2(p.y - my, p.x - mx) - Math.atan2(q.y - my, q.x - mx),
      );
      ctx.beginPath();
      pts.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      pts.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, 2 * Math.PI);
        ctx.stroke();
      });
    };

    drawCell(scene.a, "#93c5fd", "칸 A");
    drawCell(scene.b, "#c4b5fd", "칸 B");

    if (quadA) drawPolygon(quadA, "#93c5fd", "rgba(147,197,253,0.12)");
    if (quadB) drawPolygon(quadB, "#c4b5fd", "rgba(196,181,253,0.12)");
    if (tri) drawPolygon(tri, "#4ade80", "rgba(74,222,128,0.12)");

    ctx.font = "12px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText("북 ↑  · 동 ←", 10, 18);
  }, [scene, quadA, quadB, tri]);

  const maxPair = (ids?: number[]) =>
    ids
      ? Math.max(
          ...ids.flatMap((i) =>
            ids.map((j) => (i < j ? angle(vec(i), vec(j)) : 0)),
          ),
        ).toFixed(1)
      : "";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {SHAPES.map((s, i) => (
          <button
            key={s.name}
            className={`btn btn-sm ${shape === i ? "btn-primary" : ""}`}
            onClick={() => {
              setShape(i);
              setQuadPick(0);
              setTriPick(0);
            }}
          >
            {s.name}
          </button>
        ))}
        <div className="grow" />
        <button
          className="btn btn-sm"
          onClick={() => setQuadPick((p) => p + 1)}
        >
          다른 quad
        </button>
        <button className="btn btn-sm" onClick={() => setTriPick((p) => p + 1)}>
          다른 삼각형
        </button>
      </div>
      {!scene ? (
        <div className="bg-base-300/60 rounded-box p-4 text-sm opacity-80">
          quad 색인을 만드는 중이에요…
        </div>
      ) : (
        <>
          <canvas
            ref={canvas}
            className="rounded-box h-auto w-full"
            style={{ maxWidth: W }}
          />
          <div className="grid gap-2 text-sm md:grid-cols-3">
            <div className="bg-base-300/60 rounded-box p-3">
              <span className="text-blue-300">■</span> 칸 A 원 안의 quad{" "}
              {quadA ? (
                <>
                  <div>{quadA.map(nameOf).join(" · ")}</div>
                  <div className="opacity-60">
                    가장 먼 두 별 {maxPair(quadA)}°
                  </div>
                </>
              ) : (
                <div className="opacity-60">없음</div>
              )}
            </div>
            <div className="bg-base-300/60 rounded-box p-3">
              <span className="text-violet-300">■</span> 칸 B 원 안의 quad{" "}
              {quadB ? (
                <>
                  <div>{quadB.map(nameOf).join(" · ")}</div>
                  <div className="opacity-60">
                    가장 먼 두 별 {maxPair(quadB)}°
                  </div>
                </>
              ) : (
                <div className="opacity-60">없음</div>
              )}
            </div>
            <div className="bg-base-300/60 rounded-box p-3">
              <span className="text-green-400">■</span> 경계를 넘는 삼각형{" "}
              {tri ? (
                <>
                  <div>{tri.map(nameOf).join(" · ")}</div>
                  <div className="opacity-60">
                    가장 먼 두 별 {maxPair(tri)}° · 셋을 함께 담는 칸 원 없음
                  </div>
                </>
              ) : (
                <div className="opacity-60">
                  이 별자리는 한 칸 원에 다 들어가요
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
