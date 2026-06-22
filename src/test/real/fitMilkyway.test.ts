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
  recoverFov,
} from "@/search/utils/wcs";

// 사용자가 손으로 라벨한 (픽셀, 별) 대응. 포즈 + 렌즈 왜곡(광학중심·k1)을 피팅한다.
const W = 1200;
const H = 801;
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

const RN = Math.hypot(W, H) / 2;

const toPlane = (P: Mat3, v: Point3D): Point2D => {
  const p = mat3MulVec(P, v);

  return [p[0] / p[2], p[1] / p[2]];
};

// 방사 왜곡. 광학중심(pcx,pcy)을 자유 변수로 둔다(크롭/디센터 대응).
const undistort = (
  x: number,
  y: number,
  pcx: number,
  pcy: number,
  k1: number,
): Point2D => {
  const xc = x - pcx;
  const yc = y - pcy;
  const rn2 = (xc * xc + yc * yc) / (RN * RN);
  const f = 1 + k1 * rn2;

  return [pcx + xc * f, pcy + yc * f];
};

const distort = (
  x: number,
  y: number,
  pcx: number,
  pcy: number,
  k1: number,
): Point2D => {
  const xu = x - pcx;
  const yu = y - pcy;
  let xc = xu;
  let yc = yu;

  for (let i = 0; i < 16; i++) {
    const rn2 = (xc * xc + yc * yc) / (RN * RN);
    const f = 1 + k1 * rn2;
    xc = xu / f;
    yc = yu / f;
  }

  return [pcx + xc, pcy + yc];
};

const fitPose = (corr: { x: number; y: number; v: Point3D }[]): Mat3 => {
  let cx = 0;
  let cy = 0;
  let cz = 0;

  for (const c of corr) {
    cx += c.v[0];
    cy += c.v[1];
    cz += c.v[2];
  }

  const n = Math.hypot(cx, cy, cz);
  let center: Point3D = [cx / n, cy / n, cz / n];
  let P = projectionMatrix(center);
  let T = umeyamaSimilarity2D(
    corr.map((c) => toPlane(P, c.v)),
    corr.map((c) => [c.x, c.y] as Point2D),
  ).matrix;

  for (let iter = 0; iter < 8; iter++) {
    center = recoverCenter(mat3Mul(T, P), W, H);
    P = projectionMatrix(center);
    T = umeyamaSimilarity2D(
      corr.map((c) => toPlane(P, c.v)),
      corr.map((c) => [c.x, c.y] as Point2D),
    ).matrix;
  }

  return mat3Mul(T, P);
};

const raDec = (v: Point3D) =>
  `RA${(((Math.atan2(v[1], v[0]) * 180) / Math.PI + 360) % 360).toFixed(1)} Dec${((Math.asin(Math.max(-1, Math.min(1, v[2]))) * 180) / Math.PI).toFixed(1)}`;

describe.skipIf(!hasData)("은하수 포즈·왜곡 피팅", () => {
  it("광학중심·k1까지 피팅하고 별을 예측한다", () => {
    const corr = CORR.map((c) => {
      const s = byHR.get(c.hr)!;

      return {
        x: c.x,
        y: c.y,
        v: [s.x, s.y, s.z] as Point3D,
        hr: c.hr,
        name: s.N,
      };
    });

    const evalModel = (pcx: number, pcy: number, k1: number) => {
      const TP = fitPose(
        corr.map((c) => {
          const [ux, uy] = undistort(c.x, c.y, pcx, pcy, k1);

          return { x: ux, y: uy, v: c.v };
        }),
      );
      let sse = 0;
      let maxRes = 0;

      for (const c of corr) {
        const ideal = projectVecToPhoto(TP, c.v);
        const obs = ideal ? distort(ideal[0], ideal[1], pcx, pcy, k1) : null;
        const res = obs ? Math.hypot(obs[0] - c.x, obs[1] - c.y) : Infinity;
        sse += res * res;
        maxRes = Math.max(maxRes, res);
      }

      return { TP, rms: Math.sqrt(sse / corr.length), maxRes };
    };

    const noDist = evalModel(W / 2, H / 2, 0);
    let best = { pcx: W / 2, pcy: H / 2, k1: 0, ...noDist };

    for (let pcx = 0; pcx <= W; pcx += 50) {
      for (let pcy = -200; pcy <= H + 200; pcy += 50) {
        for (let k1 = -0.4; k1 <= 0.4; k1 += 0.02) {
          const r = evalModel(pcx, pcy, k1);

          if (r.rms < best.rms) {
            best = { pcx, pcy, k1, ...r };
          }
        }
      }
    }

    const center = recoverCenter(best.TP, W, H);
    const fov = (recoverFov(best.TP, W, H) * 180) / Math.PI;

    console.warn(`\n=== 대응 ${corr.length}개 ===`);
    console.warn(
      `왜곡 없음: RMS ${noDist.rms.toFixed(1)}px, 최대 ${noDist.maxRes.toFixed(0)}px`,
    );
    console.warn(
      `광학중심(${best.pcx},${best.pcy}) k1=${best.k1.toFixed(3)}: RMS ${best.rms.toFixed(1)}px, 최대 ${best.maxRes.toFixed(0)}px`,
    );
    console.warn(`중심 ${raDec(center)} · FOV ${fov.toFixed(1)}도`);
    console.warn("라벨 별 잔차:");

    for (const c of corr) {
      const ideal = projectVecToPhoto(best.TP, c.v);
      const obs = ideal
        ? distort(ideal[0], ideal[1], best.pcx, best.pcy, best.k1)
        : null;
      const res = obs ? Math.hypot(obs[0] - c.x, obs[1] - c.y) : Infinity;

      console.warn(
        `  ${c.name ?? c.hr}: 예측 ${obs ? `(${obs[0].toFixed(0)},${obs[1].toFixed(0)})` : "뒤"} vs 실제 (${c.x},${c.y}) → ${res.toFixed(0)}px`,
      );
    }

    expect(corr.length).toBeGreaterThanOrEqual(3);
  });
});
