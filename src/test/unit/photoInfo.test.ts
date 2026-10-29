import { describe, expect, it } from "vitest";
import {
  equivalentFocalMm,
  formatExposure,
  lensKind,
  photoInfo,
} from "@/plate-solver/photoInfo";

describe("사진 정보 (렌즈·화각·별 궤적 노출)", () => {
  it("짧은 변 화각에서 35mm 환산 초점거리를 구한다", () => {
    // 풀프레임 24mm 렌즈의 짧은 변 화각은 약 53.1°
    expect(equivalentFocalMm(53.13)).toBeCloseTo(24, 0);
    expect(lensKind(14)).toBe("초광각");
    expect(lensKind(24)).toBe("광각");
    expect(lensKind(50)).toBe("표준");
    expect(lensKind(200)).toBe("망원");
  });

  it("하늘이 돈 각도로 노출 시간을 어림한다 (한 시간에 약 15°)", () => {
    // 15분 노출 사진(web-263)에서 잰 3.7°
    expect(formatExposure(3.7)).toBe("약 15분");
    expect(formatExposure(0.25)).toBe("약 60초");
    expect(formatExposure(30)).toBe("약 2시간 0분");
  });

  it("원형 어안은 화각 대신 렌즈 종류만, 별 궤적이면 노출을 덧붙인다", () => {
    expect(photoInfo({ fovDeg: 40, fisheye: true })).toEqual([
      { label: "렌즈", value: "원형 어안 (하늘 전체)" },
    ]);
    expect(
      photoInfo({ fovDeg: 53, fisheye: false, trailAngleDeg: 3.7 }).map(
        (i) => i.label,
      ),
    ).toEqual(["렌즈", "화각", "별 궤적"]);
    // 회전은 잰 값, 노출은 추정 값으로 나눠 쓴다 (받침에 따라 "으로/로")
    expect(
      photoInfo({ fovDeg: 53, fisheye: false, trailAngleDeg: 3.7 })[2].value,
    ).toBe("궤적에서 잰 회전 3.7° → 노출 약 15분으로 추정");
    expect(
      photoInfo({ fovDeg: 53, fisheye: false, trailAngleDeg: 0.25 })[2].value,
    ).toBe("궤적에서 잰 회전 0.3° → 노출 약 60초로 추정");
  });
});
