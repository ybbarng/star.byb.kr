import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { umeyamaSimilarity2D } from "@/search/utils/similarity";
import {
  mat3Mul,
  mat3MulVec,
  projectionMatrix,
  projectVecToPhoto,
  recoverCenter,
  recoverFov,
} from "@/search/utils/wcs";

// 손으로 라벨한 (픽셀, 카탈로그 별) 대응으로 카메라 포즈를 피팅하고, 새 별의
// 위치를 예측한다. 사용자가 좌표+별이름을 주면 이 흐름으로 "다음 별 어디?"를 답한다.

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

// 대응 {x,y,hr}로 포즈(TP) 피팅. 광축 재추정 반복.
const fitPose = (
  corr: { x: number; y: number; v: Point3D }[],
  W: number,
  H: number,
): Mat3 => {
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

  for (let iter = 0; iter < 6; iter++) {
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

describe.skipIf(!hasData)("포즈 피팅·예측 검증 (사이판 8개)", () => {
  it("대응으로 포즈를 잡고 잔차·예측을 본다", () => {
    const truth = JSON.parse(
      readFileSync(resolve(process.cwd(), "data/search/saipan.json"), "utf8"),
    ) as {
      width: number;
      height: number;
      stars: { label: string; position: [number, number] }[];
    };
    const W = truth.width;
    const H = truth.height;
    const corr = truth.stars.map((s) => {
      const hr = s.label.split(" ")[0];
      const st = byHR.get(hr)!;

      return {
        x: s.position[0],
        y: s.position[1],
        v: [st.x, st.y, st.z] as Point3D,
        hr,
      };
    });

    const TP = fitPose(corr, W, H);
    const center = recoverCenter(TP, W, H);
    const fov = (recoverFov(TP, W, H) * 180) / Math.PI;
    console.warn(`피팅 결과: 중심 ${raDec(center)} FOV${fov.toFixed(1)}`);

    let maxRes = 0;

    for (const c of corr) {
      const p = projectVecToPhoto(TP, c.v);
      const res = p ? Math.hypot(p[0] - c.x, p[1] - c.y) : Infinity;
      maxRes = Math.max(maxRes, res);
    }

    console.warn(`최대 잔차 ${maxRes.toFixed(1)}px (작을수록 잘 맞음)`);

    // leave-one-out 예측: 7개로 피팅 → 8번째 위치 예측 → 실제와 비교
    console.warn("예측 검증(하나 빼고 피팅 → 뺀 별 위치 예측):");

    for (let i = 0; i < corr.length; i++) {
      const train = corr.filter((_, j) => j !== i);
      const tp = fitPose(train, W, H);
      const p = projectVecToPhoto(tp, corr[i].v);
      const err = p ? Math.hypot(p[0] - corr[i].x, p[1] - corr[i].y) : Infinity;
      console.warn(
        `  ${corr[i].hr}: 예측 ${p ? `(${p[0].toFixed(0)},${p[1].toFixed(0)})` : "-"} vs 실제 (${corr[i].x},${corr[i].y}) → ${err.toFixed(0)}px`,
      );
    }

    expect(maxRes).toBeLessThan(20);
  });
});
