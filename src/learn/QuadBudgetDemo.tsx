"use client";

import type { Point3D } from "@/scripts/hash/types";
import * as healpix from "@hscmap/healpix";
import { useEffect, useMemo, useRef, useState } from "react";
import { STARS } from "@/game/sky/catalog";
import { calculateHash } from "@/scripts/hash/hash";
import { projectToTangentPlane } from "@/scripts/hash/plane";
import {
  BRIGHT_TRIANGLE,
  TRIANGLE_MAX_ANGLE_DEG,
} from "@/search/solverContext";
import { buildKdTree4, nearestK } from "@/search/utils/kdTree4";

// quad를 얼마나 크게까지 담을까: V2는 HEALPix 칸 중심에서 10° 원 안의 별 넷을 모두 묶었다(별 사이 최대 20°, 약 51만 개).
// V3는 네 별이 모두 서로 10° 안인 것만 남겼다(8만 3천 개, search/quadDatabase.ts). 이 데모는 같은 규칙으로 칸 원 안의
// 조합을 모두 만들어 두고, "별 사이 최대 각도" 한계를 바꿔 가며 세 가지를 이 기기에서 바로 잰다.
//   ① 개수·용량·검색 나무 쌓는 시간 (용량은 V2 JSON 65.4MB/514,885개, 이진 2MB/82,703개에서 낸 개당 크기로 어림)
//   ② 닮은 가짜: 6° 안의 작은 quad 300개(모든 한계에 들어 있다)의 지문에 사진 오차만큼 흔들림을 더해 가까운 8개를 찾고,
//      정답이 몇 등인지 센다. quad가 늘수록 같은 자리에 닮은 가짜가 늘어 정답이 밀린다
//   ③ 담는 모양: 이름난 별 모양의 4별·3별 조합이 quad·삼각형 색인에 들어가는지 (삼각형 규칙은 search/solverContext.ts)

const NSIDE = 4;
const CELL_RADIUS_DEG = 10;
const D = Math.PI / 180;
const LIMITS = Array.from({ length: 15 }, (_, i) => 6 + i); // 6°..20°
const V3_LIMIT = 10;
const V2_LIMIT = 20;
const K = 8;
const QUERY_COUNT = 300;
const QUERY_MAX_DEG = 6;
const NOISES = [0.005, 0.01, 0.02];
const JSON_BYTES_PER_QUAD = 65.4e6 / 514885;
const JSON_GZIP_RATIO = 22.15 / 65.4;
const BINARY_BYTES_PER_QUAD = 2.0e6 / 82703;
const BINARY_GZIP_RATIO = 1.46 / 2.0;

const ASTERISMS = [
  {
    name: "북두칠성",
    hrs: ["4301", "4295", "4554", "4660", "4905", "5054", "5191"],
  },
  { name: "카시오페이아 W", hrs: ["21", "168", "264", "403", "542"] },
  {
    name: "오리온 (일곱 별)",
    hrs: ["2061", "1790", "1852", "1903", "1948", "2004", "1713"],
  },
  { name: "남십자", hrs: ["4730", "4853", "4763", "4656"] },
];

interface Quads {
  n: number;
  hashes: Float64Array; // 4n
  maxPair: Float32Array; // 별 사이 최대 각도 (도)
  byKey: Map<number, number>; // 별 번호 넷(오름차순) → quad 번호
  ms: number;
}

interface LimitStat {
  limit: number;
  count: number;
  treeMs: number;
  first: number; // 정답이 1등인 비율
  top8: number; // 정답이 가까운 8개 안인 비율
}

const dot = (a: Point3D, b: Point3D) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const angle = (a: Point3D, b: Point3D) =>
  Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) / D;

const keyOf = (ids: number[]) => {
  const s = [...ids].sort((x, y) => x - y);

  return ((s[0] * 2048 + s[1]) * 2048 + s[2]) * 2048 + s[3];
};

// 칸 원 안의 네 별 조합을 모두 만든다 (V2 규칙). 칸끼리 겹친 조합은 하나만
const buildAllQuads = (): Quads => {
  const t0 = performance.now();
  const cosCell = Math.cos(CELL_RADIUS_DEG * D);
  const byKey = new Map<number, number>();
  const hashes: number[] = [];
  const maxPair: number[] = [];

  for (let ipix = 0; ipix < healpix.nside2npix(NSIDE); ipix++) {
    const center = healpix.pix2vec_nest(NSIDE, ipix) as Point3D;
    const cell: number[] = [];

    STARS.forEach((s, i) => {
      if (dot(s.vector as Point3D, center) >= cosCell) cell.push(i);
    });

    const k = cell.length;
    const ang = new Float32Array(k * k);

    for (let i = 0; i < k; i++) {
      for (let j = i + 1; j < k; j++) {
        const a = angle(
          STARS[cell[i]].vector as Point3D,
          STARS[cell[j]].vector as Point3D,
        );
        ang[i * k + j] = a;
        ang[j * k + i] = a;
      }
    }

    for (let a = 0; a < k - 3; a++) {
      for (let b = a + 1; b < k - 2; b++) {
        for (let c = b + 1; c < k - 1; c++) {
          for (let d = c + 1; d < k; d++) {
            const ids = [cell[a], cell[b], cell[c], cell[d]];
            const key = keyOf(ids);

            if (byKey.has(key)) continue;

            const m = Math.max(
              ang[a * k + b],
              ang[a * k + c],
              ang[a * k + d],
              ang[b * k + c],
              ang[b * k + d],
              ang[c * k + d],
            );
            const projected = projectToTangentPlane(
              ids.map((i) => STARS[i].vector as Point3D),
            );
            const hash = calculateHash(
              projected.map((vector, i) => ({
                label: String(ids[i]),
                vector,
              })) as Parameters<typeof calculateHash>[0],
            ).hash as number[];

            byKey.set(key, maxPair.length);
            maxPair.push(m);
            hashes.push(hash[0], hash[1], hash[2], hash[3]);
          }
        }
      }
    }
  }

  return {
    n: maxPair.length,
    hashes: Float64Array.from(hashes),
    maxPair: Float32Array.from(maxPair),
    byKey,
    ms: performance.now() - t0,
  };
};

// 고정 씨앗 난수 (매번 같은 시험)
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;

  return seed / 2 ** 32;
};

const gauss = (r: () => number) =>
  Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

const subsetsOf = <T,>(items: T[], size: number): T[][] => {
  if (size === 0) return [[]];
  if (items.length < size) return [];

  const [head, ...rest] = items;

  return [
    ...subsetsOf(rest, size - 1).map((s) => [head, ...s]),
    ...subsetsOf(rest, size),
  ];
};

const CHART_W = 640;
const CHART_H = 300;
const PAD = { left: 52, right: 52, top: 16, bottom: 36 };

export default function QuadBudgetDemo() {
  const [quads, setQuads] = useState<Quads | null>(null);
  const [limit, setLimit] = useState(V3_LIMIT);
  const [noise, setNoise] = useState(0.01);
  const [stats, setStats] = useState<LimitStat[]>([]);
  const chart = useRef<HTMLCanvasElement>(null);

  // 조합 만들기는 화면을 그린 뒤에 (이 기기에서 1~2초)
  useEffect(() => {
    const id = window.setTimeout(() => setQuads(buildAllQuads()), 50);

    return () => window.clearTimeout(id);
  }, []);

  // 한계마다 검색 나무를 쌓고 닮은 가짜 시험을 한다 (한계 하나씩 차례로, 화면이 멈추지 않게)
  useEffect(() => {
    if (!quads) return;

    let alive = true;
    const r = rng(7);
    const small: number[] = [];

    for (let i = 0; i < quads.n; i++) {
      if (quads.maxPair[i] <= QUERY_MAX_DEG) small.push(i);
    }

    const queries = Array.from(
      { length: QUERY_COUNT },
      () => small[Math.floor(r() * small.length)],
    );
    const jitter = queries.map(() => [gauss(r), gauss(r), gauss(r), gauss(r)]);
    const out: LimitStat[] = [];
    setStats([]);

    const step = (li: number) => {
      if (!alive || li >= LIMITS.length) return;

      const lim = LIMITS[li];
      const members: number[] = [];

      for (let i = 0; i < quads.n; i++) {
        if (quads.maxPair[i] <= lim) members.push(i);
      }

      const coords = new Float64Array(members.length * 4);
      const pos = new Int32Array(quads.n).fill(-1);

      members.forEach((g, j) => {
        pos[g] = j;
        coords.set(quads.hashes.subarray(g * 4, g * 4 + 4), j * 4);
      });

      const t0 = performance.now();
      const tree = buildKdTree4(coords);
      const treeMs = performance.now() - t0;
      let first = 0;
      let top8 = 0;

      queries.forEach((g, qi) => {
        const q = [0, 1, 2, 3].map(
          (a) => quads.hashes[g * 4 + a] + jitter[qi][a] * noise,
        );
        const rank = nearestK(tree, q, K).findIndex(
          (nb) => nb.index === pos[g],
        );

        if (rank === 0) first++;
        if (rank >= 0) top8++;
      });

      out.push({
        limit: lim,
        count: members.length,
        treeMs,
        first: first / QUERY_COUNT,
        top8: top8 / QUERY_COUNT,
      });
      setStats([...out]);
      window.setTimeout(() => step(li + 1), 0);
    };

    window.setTimeout(() => step(0), 0);

    return () => {
      alive = false;
    };
  }, [quads, noise]);

  const current = stats.find((s) => s.limit === limit);
  const v2 = stats.find((s) => s.limit === V2_LIMIT);
  const maxCount = quads
    ? quads.maxPair.reduce((n, m) => (m <= V2_LIMIT ? n + 1 : n), 0)
    : 0;
  const countAt = (lim: number) =>
    quads ? quads.maxPair.reduce((n, m) => (m <= lim ? n + 1 : n), 0) : 0;
  const count = useMemo(() => countAt(limit), [quads, limit]); // eslint-disable-line react-hooks/exhaustive-deps

  // 이름난 별 모양: 4별 조합이 quad로, 3별 조합이 삼각형으로 들어가는지
  const shapes = useMemo(() => {
    if (!quads) return [];

    return ASTERISMS.map(({ name, hrs }) => {
      const ids = hrs
        .map((hr) => STARS.findIndex((s) => s.hr === hr))
        .filter((i) => i >= 0);
      const v = (i: number) => STARS[i].vector as Point3D;
      const spread = Math.max(
        ...subsetsOf(ids, 2).map(([a, b]) => angle(v(a), v(b))),
      );
      const fours = subsetsOf(ids, 4);
      const inQuad = (lim: number) =>
        fours.filter((s) => {
          const at = quads.byKey.get(keyOf(s));

          return at !== undefined && quads.maxPair[at] <= lim;
        }).length;
      const threes = subsetsOf(ids, 3);
      // 한 별에서 나머지 두 별이 모두 한계 안이면 그 삼각형이 색인에 있다
      const inTriangle = (tri: number[], maxDeg: number) =>
        tri.some((c) =>
          tri.every((o) => o === c || angle(v(c), v(o)) <= maxDeg),
        );
      const all = threes.filter((t) =>
        inTriangle(t, TRIANGLE_MAX_ANGLE_DEG),
      ).length;
      const bright = threes.filter(
        (t) =>
          t.every((i) => STARS[i].mag <= BRIGHT_TRIANGLE.maxMag) &&
          inTriangle(t, BRIGHT_TRIANGLE.maxAngleDeg),
      ).length;

      return {
        name,
        spread,
        fours: fours.length,
        quadNow: inQuad(limit),
        quadV2: inQuad(V2_LIMIT),
        threes: threes.length,
        triangle: all,
        bright,
      };
    });
  }, [quads, limit]);

  // 한계별 그래프: 막대 = quad 수, 선 = 정답이 1등·8등 안인 비율
  useEffect(() => {
    const el = chart.current;
    const ctx = el?.getContext("2d");

    if (!el || !ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = CHART_W * dpr;
    el.height = CHART_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0b0f22";
    ctx.fillRect(0, 0, CHART_W, CHART_H);

    const plotW = CHART_W - PAD.left - PAD.right;
    const plotH = CHART_H - PAD.top - PAD.bottom;
    const slot = plotW / LIMITS.length;
    const xOf = (lim: number) => PAD.left + (lim - LIMITS[0] + 0.5) * slot;
    const yPct = (p: number) => PAD.top + (1 - p) * plotH;

    ctx.font = "12px sans-serif";
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.fillStyle = "rgba(255,255,255,0.6)";

    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      ctx.beginPath();
      ctx.moveTo(PAD.left, yPct(p));
      ctx.lineTo(CHART_W - PAD.right, yPct(p));
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.fillText(`${Math.round(p * 100)}%`, PAD.left - 6, yPct(p) + 4);
    }

    if (maxCount > 0) {
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(147,197,253,0.8)";
      ctx.fillText(
        `${Math.round(maxCount / 1000)}k`,
        CHART_W - PAD.right + 6,
        yPct(1) + 4,
      );
      ctx.fillText("0", CHART_W - PAD.right + 6, yPct(0) + 4);
    }

    // quad 수 막대
    for (const lim of LIMITS) {
      const c = countAt(lim);
      const h = maxCount ? (c / maxCount) * plotH : 0;
      ctx.fillStyle =
        lim === limit ? "rgba(147,197,253,0.55)" : "rgba(147,197,253,0.22)";
      ctx.fillRect(xOf(lim) - slot * 0.35, yPct(0) - h, slot * 0.7, h);
    }

    // V2·V3 표시
    ctx.textAlign = "center";

    for (const [lim, label] of [
      [V3_LIMIT, "V3"],
      [V2_LIMIT, "V2"],
    ] as const) {
      ctx.fillStyle = "#fde68a";
      ctx.fillText(`${lim}° ${label}`, xOf(lim), CHART_H - 8);
    }

    ctx.fillStyle = "rgba(255,255,255,0.6)";

    for (const lim of LIMITS) {
      if (lim !== V3_LIMIT && lim !== V2_LIMIT && lim % 2 === 0) {
        ctx.fillText(`${lim}°`, xOf(lim), CHART_H - 8);
      }
    }

    const line = (pick: (s: LimitStat) => number, color: string) => {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      stats.forEach((s, i) => {
        const x = xOf(s.limit);
        const y = yPct(pick(s));

        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.stroke();
      stats.forEach((s) => {
        ctx.beginPath();
        ctx.arc(xOf(s.limit), yPct(pick(s)), 3.5, 0, 2 * Math.PI);
        ctx.fill();
      });
    };

    line((s) => s.top8, "#4ade80");
    line((s) => s.first, "#fdba74");
  }, [stats, limit, quads]); // eslint-disable-line react-hooks/exhaustive-deps

  const mb = (bytes: number) => `${(bytes / 1e6).toFixed(1)}MB`;

  return (
    <div className="flex flex-col gap-3">
      {!quads ? (
        <div className="bg-base-300/60 rounded-box p-4 text-sm opacity-80">
          별 1,625개로 칸마다 네 별 조합을 모두 만드는 중이에요… (이 기기에서
          1~2초)
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-base">
            <label className="flex items-center gap-2">
              네 별 사이 최대 거리
              <input
                type="range"
                className="range range-sm w-56"
                min={LIMITS[0]}
                max={V2_LIMIT}
                step={1}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              />
              <b className="w-10">{limit}°</b>
            </label>
            <button
              className={`btn btn-xs ${limit === V3_LIMIT ? "btn-primary" : ""}`}
              onClick={() => setLimit(V3_LIMIT)}
            >
              V3 (10°)
            </button>
            <button
              className={`btn btn-xs ${limit === V2_LIMIT ? "btn-primary" : ""}`}
              onClick={() => setLimit(V2_LIMIT)}
            >
              V2 (칸 원 안 모두 = 20°)
            </button>
          </div>

          <div className="grid gap-2 text-sm md:grid-cols-4">
            <div className="bg-base-300/60 rounded-box p-3">
              quad 수
              <div className="text-xl font-bold">
                {count.toLocaleString("ko-KR")}
              </div>
              <div className="opacity-60">
                V2 규칙(20°)의 {Math.round((count / maxCount) * 100)}%
              </div>
            </div>
            <div className="bg-base-300/60 rounded-box p-3">
              파일로 받는다면 (어림)
              <div className="text-xl font-bold">
                {mb(count * JSON_BYTES_PER_QUAD * JSON_GZIP_RATIO)}
              </div>
              <div className="opacity-60">
                V2처럼 JSON {mb(count * JSON_BYTES_PER_QUAD)}, 압축 기준 ·
                이진이면 {mb(count * BINARY_BYTES_PER_QUAD * BINARY_GZIP_RATIO)}
              </div>
            </div>
            <div className="bg-base-300/60 rounded-box p-3">
              검색 나무 쌓기 (이 기기)
              <div className="text-xl font-bold">
                {current ? `${Math.round(current.treeMs)}ms` : "재는 중…"}
              </div>
              <div className="opacity-60">
                조합 만들기 전체 {(quads.ms / 1000).toFixed(1)}초 (20°까지)
              </div>
            </div>
            <div className="bg-base-300/60 rounded-box p-3">
              작은 quad의 정답이 1등
              <div className="text-xl font-bold">
                {current ? `${Math.round(current.first * 100)}%` : "재는 중…"}
              </div>
              <div className="opacity-60">
                {current && v2
                  ? `가까운 8개 안 ${Math.round(current.top8 * 100)}% (V2 규칙 ${Math.round(v2.top8 * 100)}%)`
                  : "한계마다 차례로 재요"}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <canvas
              ref={chart}
              className="rounded-box h-auto w-full"
              style={{ maxWidth: CHART_W }}
            />
            <div className="flex flex-wrap items-center gap-3 text-sm opacity-80">
              <span>
                <span className="text-blue-300">■</span> quad 수
              </span>
              <span>
                <span className="text-green-400">●</span> 정답이 가까운 8개 안
              </span>
              <span>
                <span className="text-orange-300">●</span> 정답이 1등
              </span>
              <span className="ml-auto flex items-center gap-1">
                사진 오차(지문 흔들림, 가정)
                {NOISES.map((n) => (
                  <button
                    key={n}
                    className={`btn btn-xs ${noise === n ? "btn-primary" : ""}`}
                    onClick={() => setNoise(n)}
                  >
                    {n}
                  </button>
                ))}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table-sm table text-sm">
              <thead>
                <tr>
                  <th>별 모양</th>
                  <th>가장 먼 두 별</th>
                  <th>quad ({limit}°)</th>
                  <th>quad (V2)</th>
                  <th>삼각형 (18°)</th>
                  <th>밝은 별 삼각형 (30°)</th>
                </tr>
              </thead>
              <tbody>
                {shapes.map((s) => (
                  <tr key={s.name}>
                    <td>{s.name}</td>
                    <td>{s.spread.toFixed(1)}°</td>
                    <td
                      className={s.quadNow ? "text-green-400" : "text-red-400"}
                    >
                      {s.quadNow} / {s.fours}
                    </td>
                    <td
                      className={s.quadV2 ? "text-green-400" : "text-red-400"}
                    >
                      {s.quadV2} / {s.fours}
                    </td>
                    <td
                      className={s.triangle ? "text-green-400" : "text-red-400"}
                    >
                      {s.triangle} / {s.threes}
                    </td>
                    <td
                      className={s.bright ? "text-green-400" : "text-red-400"}
                    >
                      {s.bright} / {s.threes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-xs opacity-60">
              그 별 모양의 별 넷(셋)으로 만들 수 있는 조합 중 색인에 들어 있는
              수예요.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
