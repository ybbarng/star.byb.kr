import type { Point3D } from "@/scripts/hash/types";
import { describe, expect, it } from "vitest";
import {
  boundaryRings,
  constellationAt,
  constellationsContaining,
} from "@/search/utils/constellationBounds";
import { createRng } from "@/utils/rng";

const D = Math.PI / 180;
const at = (raHours: number, decDeg: number): Point3D => [
  Math.cos(decDeg * D) * Math.cos(raHours * 15 * D),
  Math.cos(decDeg * D) * Math.sin(raHours * 15 * D),
  Math.sin(decDeg * D),
];

describe("IAU 별자리 경계", () => {
  it("88개 별자리(뱀자리는 두 구역)를 담는다", () => {
    const labels = new Set(boundaryRings().map((r) => r.label));

    expect(boundaryRings()).toHaveLength(89);
    expect(labels.size).toBe(88);
  });

  // J2000 적경(시)·적위(°)
  it.each([
    ["스피카", 13.4199, -11.161, "처녀자리"],
    ["자비야바", 11.8449, 1.7647, "처녀자리"],
    ["레굴루스", 10.1395, 11.9672, "사자자리"],
    ["북극성", 2.5303, 89.2641, "작은곰자리"],
    ["천구 남극 근처", 0, -89.5, "팔분의자리"],
    ["베텔게우스", 5.9195, 7.4071, "오리온자리"],
    ["안타레스", 16.4901, -26.432, "전갈자리"],
    ["알페라츠", 0.1398, 29.0904, "안드로메다자리"],
    ["알비레오", 19.5121, 27.9597, "백조자리"],
    ["카노푸스", 6.3992, -52.6957, "용골자리"],
  ])("%s는 %s 구역", (_name, ra, dec, label) => {
    expect(constellationAt(at(ra as number, dec as number))).toBe(label);
  });

  it("하늘의 어느 방향이든 정확히 한 구역에 속한다", () => {
    const rng = createRng(7);

    for (let i = 0; i < 5000; i++) {
      // 구 위에 고르게
      const z = rng() * 2 - 1;
      const phi = rng() * 2 * Math.PI;
      const r = Math.sqrt(1 - z * z);
      const v: Point3D = [r * Math.cos(phi), r * Math.sin(phi), z];

      expect(
        constellationsContaining(v),
        `방향 ${v.map((c) => c.toFixed(3))}`,
      ).toHaveLength(1);
    }
  });
});
