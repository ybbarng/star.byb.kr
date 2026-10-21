"use client";

import type { Point3D } from "@/scripts/hash/types";
import * as healpix from "@hscmap/healpix";
import { useEffect, useMemo, useRef, useState } from "react";
import { STARS } from "@/game/sky/catalog";
import { angleDeg } from "@/learn/brightTriangles";
import { projectionMatrix } from "@/search/utils/wcs";

// quad가 북두칠성을 못 찾는 이유: quad DB는 크기를 감당하려고 "네 별이 서로 10° 안"인 조합만 담는다
// (search/quadDatabase.ts). 북두칠성 근처 하늘에서 별 넷을 골라, 여섯 쌍의 거리와 10°를 넘는지 본다.
// 북두칠성 일곱 별로 만드는 4별 조합 35개는 모두 10°를 넘는다 — 국자 네 별도 10.4°.

const MAX_PAIR_DEG = 10;
const SIZE_W = 760;
const SIZE_H = 480;
const PX_PER_DEG = 24;
const VIEW_RADIUS_DEG = 32;

const DIPPER = [
  ["두베", "4301"],
  ["메라크", "4295"],
  ["페크다", "4554"],
  ["메그레즈", "4660"],
  ["알리오트", "4905"],
  ["미자르", "5054"],
  ["알카이드", "5191"],
] as const;

const dipperIndex = DIPPER.map(([, hr]) => STARS.findIndex((s) => s.hr === hr));
const center = (() => {
  const sum = dipperIndex.reduce(
    (a, i) => [
      a[0] + STARS[i].vector[0],
      a[1] + STARS[i].vector[1],
      a[2] + STARS[i].vector[2],
    ],
    [0, 0, 0],
  );
  const n = Math.hypot(sum[0], sum[1], sum[2]);

  return [sum[0] / n, sum[1] / n, sum[2] / n] as Point3D;
})();
const P = projectionMatrix(center);

// 접선 평면에 놓고 화면 좌표로 (하늘을 올려다본 방향이 되게 x를 뒤집는다)
const toScreen = (v: Point3D) => {
  const x = P[0][0] * v[0] + P[0][1] * v[1] + P[0][2] * v[2];
  const y = P[1][0] * v[0] + P[1][1] * v[1] + P[1][2] * v[2];
  const z = P[2][0] * v[0] + P[2][1] * v[1] + P[2][2] * v[2];
  const k = PX_PER_DEG / (Math.PI / 180);

  return { x: SIZE_W / 2 - (x / z) * k, y: SIZE_H / 2 - (y / z) * k };
};

const nearby = STARS.map((s, i) => ({ s, i }))
  .filter(({ s }) => angleDeg(s.vector as Point3D, center) < VIEW_RADIUS_DEG)
  .map(({ s, i }) => ({ i, mag: s.mag, ...toScreen(s.vector as Point3D) }))
  .filter(
    (p) => p.x > -10 && p.x < SIZE_W + 10 && p.y > -10 && p.y < SIZE_H + 10,
  );

// HEALPix 칸 (quad DB와 같은 nside=4, 192칸): 화면 근처 칸의 경계와, 칸 중심에서 10° 원
const NSIDE = 4;
const CELL_RADIUS_DEG = 10;

const unit = (v: number[]): Point3D => {
  const n = Math.hypot(v[0], v[1], v[2]);

  return [v[0] / n, v[1] / n, v[2] / n];
};

const cellPaths = Array.from(
  { length: healpix.nside2npix(NSIDE) },
  (_, ipix) => ipix,
)
  .filter(
    (ipix) =>
      angleDeg(healpix.pix2vec_nest(NSIDE, ipix) as Point3D, center) < 45,
  )
  .map((ipix) => {
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
  });

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
  const r = (deg * Math.PI) / 180;

  return Array.from({ length: 73 }, (_, i) => {
    const t = (i / 72) * 2 * Math.PI;

    return unit(
      [0, 1, 2].map(
        (k) =>
          Math.cos(r) * c[k] +
          Math.sin(r) * (Math.cos(t) * u[k] + Math.sin(t) * w[k]),
      ),
    );
  });
};

const nameOf = (i: number) => {
  const d = dipperIndex.indexOf(i);

  return d >= 0 ? DIPPER[d][0] : (STARS[i].name ?? `HR ${STARS[i].hr}`);
};

export default function QuadReachDemo() {
  const [picked, setPicked] = useState<number[]>(dipperIndex.slice(0, 4));
  const [cells, setCells] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  const pairs = useMemo(() => {
    const out: { a: number; b: number; deg: number }[] = [];

    for (let i = 0; i < picked.length; i++) {
      for (let j = i + 1; j < picked.length; j++) {
        out.push({
          a: picked[i],
          b: picked[j],
          deg: angleDeg(
            STARS[picked[i]].vector as Point3D,
            STARS[picked[j]].vector as Point3D,
          ),
        });
      }
    }

    return out;
  }, [picked]);
  const widest = Math.max(...pairs.map((p) => p.deg));
  const inDb = widest <= MAX_PAIR_DEG;

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");

    if (!el || !ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = SIZE_W * dpr;
    el.height = SIZE_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0b0f22";
    ctx.fillRect(0, 0, SIZE_W, SIZE_H);

    // 별 (밝을수록 크게)
    for (const p of nearby) {
      ctx.fillStyle = dipperIndex.includes(p.i)
        ? "#fde68a"
        : "rgba(226,232,240,0.75)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.2, 5 - p.mag), 0, 2 * Math.PI);
      ctx.fill();
    }

    // HEALPix 칸과, 고른 별들의 가운데가 든 칸의 중심 10° 원
    if (cells) {
      ctx.strokeStyle = "rgba(147,197,253,0.35)";
      ctx.lineWidth = 1;

      for (const path of cellPaths) {
        ctx.beginPath();
        path.forEach((v, i) => {
          const p = toScreen(v);

          if (i) ctx.lineTo(p.x, p.y);
          else ctx.moveTo(p.x, p.y);
        });
        ctx.stroke();
      }

      const mid = unit(
        [0, 1, 2].map((k) =>
          picked.reduce((s, i) => s + STARS[i].vector[k], 0),
        ),
      );
      const cell = healpix.pix2vec_nest(
        NSIDE,
        healpix.vec2pix_nest(NSIDE, mid),
      ) as Point3D;
      const c = toScreen(cell);
      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      circleAround(cell, CELL_RADIUS_DEG).forEach((v, i) => {
        const p = toScreen(v);

        if (i) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4, 0, 2 * Math.PI);
      ctx.fill();
    }

    // 고른 별 넷의 여섯 쌍: 10° 넘는 쌍은 빨강
    ctx.font = "bold 13px sans-serif";

    for (const { a, b, deg } of pairs) {
      const pa = toScreen(STARS[a].vector as Point3D);
      const pb = toScreen(STARS[b].vector as Point3D);
      const over = deg > MAX_PAIR_DEG;
      ctx.strokeStyle = over ? "#f87171" : "#4ade80";
      ctx.lineWidth = over ? 2.5 : 2;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
      ctx.fillStyle = over ? "#fca5a5" : "#86efac";
      ctx.fillText(
        `${deg.toFixed(1)}°`,
        (pa.x + pb.x) / 2 + 4,
        (pa.y + pb.y) / 2 - 4,
      );
    }

    ctx.font = "13px sans-serif";

    for (const i of picked) {
      const p = toScreen(STARS[i].vector as Point3D);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(nameOf(i), p.x + 12, p.y + 16);
    }

    // 10° 자
    const x0 = 20;
    const y0 = SIZE_H - 20;
    ctx.strokeStyle = "#fde68a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + MAX_PAIR_DEG * PX_PER_DEG, y0);
    ctx.stroke();
    ctx.fillStyle = "#fde68a";
    ctx.fillText("10°", x0 + 60, y0 - 8);
  }, [picked, pairs, cells]);

  // 누른 곳에서 가장 가까운 별을 고른다 (넷까지, 오래된 것부터 바뀐다)
  const pick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SIZE_W;
    const y = ((e.clientY - rect.top) / rect.height) * SIZE_H;
    const near = nearby
      .map((p) => ({ i: p.i, d: Math.hypot(p.x - x, p.y - y) }))
      .sort((a, b) => a.d - b.d)[0];

    if (!near || near.d > 20 || picked.includes(near.i)) return;

    setPicked((p) => [...p.slice(1), near.i]);
  };

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_17rem]">
      <canvas
        ref={canvas}
        className="rounded-box h-auto w-full cursor-pointer"
        style={{ maxHeight: "80vh" }}
        onClick={pick}
      />
      <div className="flex flex-col gap-3 text-base">
        <div className="text-sm opacity-70">
          별 넷을 눌러 골라 보세요. 노란 별이 북두칠성이에요.
        </div>
        <div className="bg-base-300/60 rounded-box flex flex-col gap-1 p-3">
          <div>
            가장 먼 두 별 <b className="text-lg">{widest.toFixed(1)}°</b>
          </div>
          {inDb ? (
            <div className="text-green-400">모두 10° 안 → DB에 있다</div>
          ) : (
            <div className="text-red-400">10°를 넘는다 → DB에 없다</div>
          )}
        </div>
        <div className="text-sm opacity-80">
          quad DB에는 네 별이 서로 10° 안에 모인 조합만 담았어요. 넓히면 조합
          수가 네제곱으로 늘어나요.
        </div>
        <div className="text-sm opacity-80">
          북두칠성 일곱 별로 만드는 4별 조합 35개 중 10° 안은{" "}
          <b className="text-red-400">0개</b>
        </div>
        <button
          className="btn btn-sm"
          onClick={() => setPicked(dipperIndex.slice(0, 4))}
        >
          국자 네 별로
        </button>
        <button
          className={`btn btn-sm ${cells ? "btn-secondary" : ""}`}
          onClick={() => setCells((c) => !c)}
        >
          HEALPix 칸 보기
        </button>
        {cells && (
          <div className="text-sm opacity-80">
            하늘을 같은 넓이 192칸으로 나누고, 칸마다 중심에서 10° 안(노란 원)의
            별로 4별 조합을 만들어요.
          </div>
        )}
      </div>
    </div>
  );
}
