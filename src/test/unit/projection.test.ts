import type { Point3D } from "@/scripts/hash/types";
import { describe, expect, it } from "vitest";
import {
  buildGroundTruthTransform,
  photoToSky,
  projectStarToPhoto,
  recoverCenter,
  recoverFov,
} from "@/test/synthetic/projection";

const deg = (rad: number) => (rad * 180) / Math.PI;

// RA(시간)·Dec(도)로 천구 방향 벡터를 만든다 (테스트 편의용).
const skyVector = (raDeg: number, decDeg: number): Point3D => {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;

  return [
    Math.cos(dec) * Math.cos(ra),
    Math.cos(dec) * Math.sin(ra),
    Math.sin(dec),
  ];
};

describe("합성 카메라: 정/역 투영 왕복", () => {
  it("투영한 별을 역투영하면 원래 방향이 복원된다 (<1e-9)", () => {
    const center = skyVector(80, 20);
    const { TP } = buildGroundTruthTransform(
      center,
      (50 * Math.PI) / 180,
      (12 * Math.PI) / 180,
      1600,
      1200,
    );

    // 광축 근처 여러 방향
    const stars: Point3D[] = [
      skyVector(80, 20),
      skyVector(85, 22),
      skyVector(76, 18),
      skyVector(82, 25),
    ];

    for (const v of stars) {
      const p = projectStarToPhoto(v, TP);

      expect(p).not.toBeNull();

      const back = photoToSky(p as [number, number], TP);

      expect(back[0]).toBeCloseTo(v[0], 9);
      expect(back[1]).toBeCloseTo(v[1], 9);
      expect(back[2]).toBeCloseTo(v[2], 9);
    }
  });

  it("반대 반구의 별은 투영되지 않는다 (null)", () => {
    // 광축을 정확한 좌표축(±x 등)에 두면 plane.ts의 기저 선택이 degenerate해지므로
    // 비축 방향을 쓴다. 실제 별 방향은 정확한 축에 오지 않는다.
    const center = skyVector(30, 10);
    const { TP } = buildGroundTruthTransform(
      center,
      (60 * Math.PI) / 180,
      0,
      1000,
      1000,
    );
    // 정반대 방향(-center)
    const opposite = skyVector(210, -10);

    expect(projectStarToPhoto(opposite, TP)).toBeNull();
  });
});

describe("합성 카메라: pose 복원", () => {
  it("광축은 화면 중앙으로 투영된다", () => {
    const center = skyVector(120, -30);
    const width = 1920;
    const height = 1080;
    const { TP } = buildGroundTruthTransform(
      center,
      (45 * Math.PI) / 180,
      (30 * Math.PI) / 180,
      width,
      height,
    );
    const p = projectStarToPhoto(center, TP) as [number, number];

    expect(p[0]).toBeCloseTo(width / 2, 6);
    expect(p[1]).toBeCloseTo(height / 2, 6);
  });

  it("recoverCenter가 입력 광축을 복원한다", () => {
    const center = skyVector(200, 45);
    const { TP } = buildGroundTruthTransform(
      center,
      (70 * Math.PI) / 180,
      (15 * Math.PI) / 180,
      1600,
      900,
    );
    const recovered = recoverCenter(TP, 1600, 900);
    const dot =
      recovered[0] * center[0] +
      recovered[1] * center[1] +
      recovered[2] * center[2];

    // 각오차 < 0.001도
    expect(deg(Math.acos(Math.min(1, dot)))).toBeLessThan(0.001);
  });

  it("recoverFov가 입력 시야각을 복원한다", () => {
    for (const fovDeg of [20, 45, 60, 90]) {
      const center = skyVector(10, 5);
      const { TP } = buildGroundTruthTransform(
        center,
        (fovDeg * Math.PI) / 180,
        0,
        1600,
        1200,
      );
      const recovered = deg(recoverFov(TP, 1600, 1200));

      expect(recovered).toBeCloseTo(fovDeg, 4);
    }
  });
});
