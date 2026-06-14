import type { Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { describe, expect, it } from "vitest";
import { calculateProjectTransform } from "@/scripts/hash/plane";
import { mat3Inv, mat3Mul, projectionMatrix } from "@/search/utils/wcs";

const normalize = (v: Point3D): Point3D => {
  const n = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);

  return [v[0] / n, v[1] / n, v[2] / n];
};

describe("wcs: 투영행렬이 plane.ts와 동치", () => {
  it("projectionMatrix가 plane.calculateProjectTransform와 같은 결과를 낸다", () => {
    const centers: Point3D[] = [
      normalize([0.3, 0.5, 0.8]),
      normalize([0.1, -0.4, 0.9]),
      normalize([-0.6, 0.2, 0.77]),
      normalize([0.05, 0.9, -0.43]),
    ];

    for (const c of centers) {
      const wcs = projectionMatrix(c);
      const ref = calculateProjectTransform(c) as unknown as number[][];

      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          expect(wcs[i][j]).toBeCloseTo(ref[i][j], 9);
        }
      }
    }
  });
});

describe("wcs: 3x3 역행렬", () => {
  it("mat3Mul(m, mat3Inv(m))은 단위행렬이다", () => {
    const m: Mat3 = [
      [2, 1, 3],
      [0, 4, 5],
      [1, 0, 6],
    ];
    const prod = mat3Mul(m, mat3Inv(m));

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(prod[i][j]).toBeCloseTo(i === j ? 1 : 0, 9);
      }
    }
  });
});
