import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { FisheyeCamera } from "@/search/utils/fisheye";
import { describe, expect, it } from "vitest";
import { buildCandidateIndex } from "@/search/findCandidatesCore";
import { blindSolveFisheye } from "@/search/fisheyeSolve";
import { fisheyeForward } from "@/search/utils/fisheye";
import {
  projectionMatrix,
  projectVecToPhoto,
  recoverCenter,
} from "@/search/utils/wcs";
import {
  catalogExists,
  hashesExist,
  loadCatalog,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

// 합성 어안 사진으로 blind 어안 풀이를 검증. 노이즈(가짜 별)를 섞어 견고성도 본다.
const skyVec = (raDeg: number, decDeg: number): Point3D => {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;

  return [
    Math.cos(dec) * Math.cos(ra),
    Math.cos(dec) * Math.sin(ra),
    Math.sin(dec),
  ];
};

// 결정적 난수 (가짜 별 위치용)
const mulberry32 = (seed: number) => {
  let a = seed >>> 0;

  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

describe.skipIf(!(catalogExists() && hashesExist()))("blind 어안 풀이", () => {
  const cat = loadCatalog();
  const byHR = new Map(cat.map((s) => [s.hr, s.vector]));
  const index = buildCandidateIndex(loadHashes());
  const W = 1200;
  const H = 800;

  // 광축·어안초점으로 카탈로그를 어안 픽셀로 투영
  const render = (axis: Point3D, ffish: number, pcx: number, pcy: number) => {
    const TP = projectionMatrix(axis);
    const stars: Point2D[] = [];

    for (const s of cat) {
      const uv = projectVecToPhoto(TP, s.vector);

      if (!uv) {
        continue;
      }

      const p = fisheyeForward(uv[0], uv[1], pcx, pcy, ffish, 0);

      if (p[0] >= 0 && p[0] < W && p[1] >= 0 && p[1] < H) {
        stars.push([p[0], p[1]]);
      }
    }

    return stars;
  };

  const axisErr = (cam: FisheyeCamera, axis: Point3D) => {
    const c = recoverCenter(cam.TP, 0, 0);

    return (
      (Math.acos(
        Math.max(
          -1,
          Math.min(1, c[0] * axis[0] + c[1] * axis[1] + c[2] * axis[2]),
        ),
      ) *
        180) /
      Math.PI
    );
  };

  it("깨끗한 어안: 광축 정확 복원", () => {
    const axis = skyVec(85, 5);
    const stars = render(axis, 1180, 600, 400);
    const out = blindSolveFisheye(stars, index, byHR, W, H);

    expect(out).not.toBeNull();
    console.warn(
      `깨끗: 별 ${stars.length}, inlier ${out!.inliers}, 광축오차 ${axisErr(out!.camera, axis).toFixed(2)}도`,
    );
    expect(axisErr(out!.camera, axis)).toBeLessThan(1);
  });

  it("가짜 별 섞어도(검출 노이즈) 견고", () => {
    const axis = skyVec(280, -25); // 궁수 부근(풍부)
    const real = render(axis, 1180, 600, 400);
    const rand = mulberry32(7);
    const fakes: Point2D[] = Array.from({ length: real.length }, () => [
      rand() * W,
      rand() * H,
    ]);
    const stars = [...real, ...fakes]; // 진짜 50% + 가짜 50%
    const out = blindSolveFisheye(stars, index, byHR, W, H);

    expect(out).not.toBeNull();
    console.warn(
      `노이즈50%: 진짜 ${real.length}+가짜 ${fakes.length}, inlier ${out!.inliers}, 광축오차 ${axisErr(out!.camera, axis).toFixed(2)}도`,
    );
    expect(axisErr(out!.camera, axis)).toBeLessThan(2);
  });
});
