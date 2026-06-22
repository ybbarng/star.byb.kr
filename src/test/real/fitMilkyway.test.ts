import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { umeyamaSimilarity2D } from "@/search/utils/similarity";
import {
  mat3Mul,
  mat3MulVec,
  projectVecToPhoto,
  projectionMatrix,
  recoverCenter,
} from "@/search/utils/wcs";

// 손 라벨(픽셀↔별)로 어안(등거리, r=f·θ) 카메라를 피팅한다. 광학중심·어안초점을 탐색.
// 이미지 크기는 1200x801 (참고). 어안 모델은 광학중심을 자유 변수로 두므로 직접 쓰진 않는다.
const CORR: { hr: string; x: number; y: number }[] = [
  { hr: "7557", x: 3, y: 244 }, // Altair (왼쪽 끝)
  { hr: "6527", x: 986, y: 670 }, // Shaula (오른쪽 아래)
  { hr: "6378", x: 967, y: 278 }, // Sabik (오른쪽 위)
  { hr: "6175", x: 1127, y: 79 }, // Zeta Oph (오른쪽 맨 위)
  { hr: "7121", x: 634, y: 648 }, // Nunki (가운데 아래)
  { hr: "7194", x: 643, y: 705 }, // Ascella (가운데 아래)
  { hr: "7377", x: 201, y: 284 }, // Delta Aql (왼쪽 가운데)
  { hr: "6869", x: 538, y: 218 }, // Eta Ser (가운데 위)
];
// 피팅에 안 쓰는 검증용
const TEST: { hr: string; x: number; y: number }[] = [
  { hr: "6698", x: 699, y: 286 }, // Sinistra
];

interface VStar {
  HR: string | number;
  N?: string;
  x: number;
  y: number;
  z: number;
}

const vdbPath = resolve(process.cwd(), "build/database/vectors-database.json");
const hasData = existsSync(vdbPath);
const vdb = hasData
  ? (JSON.parse(readFileSync(vdbPath, "utf8")) as VStar[])
  : [];
const byHR = new Map<string, VStar>(vdb.map((s) => [String(s.HR), s]));

const toPlane = (P: Mat3, v: Point3D): Point2D => {
  const p = mat3MulVec(P, v);

  return [p[0] / p[2], p[1] / p[2]];
};

// 관측(어안) 픽셀 → 직선투영 등가 좌표 [tanθ·cosφ, tanθ·sinφ]
const rectify = (
  x: number,
  y: number,
  pcx: number,
  pcy: number,
  ffish: number,
): Point2D => {
  const xc = x - pcx;
  const yc = y - pcy;
  const r = Math.hypot(xc, yc);

  if (r < 1e-9) {
    return [0, 0];
  }

  const t = Math.tan(r / ffish);

  return [(t * xc) / r, (t * yc) / r];
};

// 직선투영 등가 좌표 [u,v] → 관측(어안) 픽셀
const fisheyeForward = (
  u: number,
  v: number,
  pcx: number,
  pcy: number,
  ffish: number,
): Point2D => {
  const rt = Math.hypot(u, v);

  if (rt < 1e-9) {
    return [pcx, pcy];
  }

  const rObs = ffish * Math.atan(rt);

  return [pcx + (rObs * u) / rt, pcy + (rObs * v) / rt];
};

const fitPose = (pts: { p: Point2D; v: Point3D }[]): Mat3 => {
  let cx = 0;
  let cy = 0;
  let cz = 0;

  for (const c of pts) {
    cx += c.v[0];
    cy += c.v[1];
    cz += c.v[2];
  }

  const n = Math.hypot(cx, cy, cz);
  let center: Point3D = [cx / n, cy / n, cz / n];
  let P = projectionMatrix(center);
  let T = umeyamaSimilarity2D(
    pts.map((c) => toPlane(P, c.v)),
    pts.map((c) => c.p),
  ).matrix;

  for (let iter = 0; iter < 8; iter++) {
    center = recoverCenter(mat3Mul(T, P), 0, 0);
    P = projectionMatrix(center);
    T = umeyamaSimilarity2D(
      pts.map((c) => toPlane(P, c.v)),
      pts.map((c) => c.p),
    ).matrix;
  }

  return mat3Mul(T, P);
};

const raDec = (v: Point3D) =>
  `RA${(((Math.atan2(v[1], v[0]) * 180) / Math.PI + 360) % 360).toFixed(1)} Dec${((Math.asin(Math.max(-1, Math.min(1, v[2]))) * 180) / Math.PI).toFixed(1)}`;

describe.skipIf(!hasData)("은하수 어안 카메라 피팅", () => {
  it("등거리 어안으로 피팅하고 out-of-sample 예측", () => {
    const corr = CORR.map((c) => {
      const s = byHR.get(c.hr)!;

      return {
        x: c.x,
        y: c.y,
        v: [s.x, s.y, s.z] as Point3D,
        name: s.N,
        hr: c.hr,
      };
    });

    // (pcx, pcy, ffish)로: 관측→rectify→포즈피팅 → 관측공간 RMS
    const evalModel = (pcx: number, pcy: number, ffish: number) => {
      const TP = fitPose(
        corr.map((c) => ({ p: rectify(c.x, c.y, pcx, pcy, ffish), v: c.v })),
      );
      let sse = 0;
      let maxRes = 0;

      for (const c of corr) {
        const uv = projectVecToPhoto(TP, c.v);
        const obs = uv ? fisheyeForward(uv[0], uv[1], pcx, pcy, ffish) : null;
        const res = obs ? Math.hypot(obs[0] - c.x, obs[1] - c.y) : Infinity;
        sse += res * res;
        maxRes = Math.max(maxRes, res);
      }

      return { TP, rms: Math.sqrt(sse / corr.length), maxRes };
    };

    // 코스 탐색 → 베스트 주변 정밀 탐색
    const search = (
      pcxR: [number, number, number],
      pcyR: [number, number, number],
      fR: [number, number, number],
      seed?: { pcx: number; pcy: number; ffish: number; rms: number },
    ) => {
      let best = seed ?? { pcx: 600, pcy: 400, ffish: 1200, rms: Infinity };

      for (let pcx = pcxR[0]; pcx <= pcxR[1]; pcx += pcxR[2]) {
        for (let pcy = pcyR[0]; pcy <= pcyR[1]; pcy += pcyR[2]) {
          for (let ffish = fR[0]; ffish <= fR[1]; ffish += fR[2]) {
            const r = evalModel(pcx, pcy, ffish);

            if (r.rms < best.rms) {
              best = { pcx, pcy, ffish, rms: r.rms };
            }
          }
        }
      }

      return best;
    };

    const coarse = search(
      [-200, 1400, 100],
      [-400, 1200, 100],
      [400, 3500, 100],
    );
    const fine = search(
      [coarse.pcx - 100, coarse.pcx + 100, 20],
      [coarse.pcy - 100, coarse.pcy + 100, 20],
      [coarse.ffish - 100, coarse.ffish + 100, 20],
      coarse,
    );

    const { pcx, pcy, ffish } = fine;
    const m = evalModel(pcx, pcy, ffish);
    const center = recoverCenter(m.TP, 0, 0);

    console.warn(`\n=== 어안 피팅 (대응 ${corr.length}개) ===`);
    console.warn(
      `광학중심(${pcx.toFixed(0)},${pcy.toFixed(0)}) 어안초점 f=${ffish.toFixed(0)}px`,
    );
    console.warn(
      `중심 ${raDec(center)} · RMS ${m.rms.toFixed(1)}px, 최대 ${m.maxRes.toFixed(0)}px`,
    );
    console.warn("라벨 별 잔차:");

    for (const c of corr) {
      const uv = projectVecToPhoto(m.TP, c.v);
      const obs = uv ? fisheyeForward(uv[0], uv[1], pcx, pcy, ffish) : null;
      const res = obs ? Math.hypot(obs[0] - c.x, obs[1] - c.y) : Infinity;

      console.warn(
        `  ${c.name ?? c.hr}: 예측 ${obs ? `(${obs[0].toFixed(0)},${obs[1].toFixed(0)})` : "뒤"} vs 실제 (${c.x},${c.y}) → ${res.toFixed(0)}px`,
      );
    }

    console.warn("\nout-of-sample 검증(피팅에 안 쓴 별):");

    for (const t of TEST) {
      const ts = byHR.get(t.hr)!;
      const uv = projectVecToPhoto(m.TP, [ts.x, ts.y, ts.z]);
      const obs = uv ? fisheyeForward(uv[0], uv[1], pcx, pcy, ffish) : null;
      const err = obs ? Math.hypot(obs[0] - t.x, obs[1] - t.y) : Infinity;

      console.warn(
        `  ${ts.N ?? t.hr}: 예측 ${obs ? `(${obs[0].toFixed(0)},${obs[1].toFixed(0)})` : "뒤"} vs 실제 (${t.x},${t.y}) → ${err.toFixed(0)}px`,
      );
    }

    expect(corr.length).toBeGreaterThanOrEqual(3);
  });
});
