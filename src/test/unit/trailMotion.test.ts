import type { Mat3 } from "@/search/utils/similarity";
import { describe, expect, it } from "vitest";
import {
  TRAIL_MOTION,
  trailPose,
  trailProgress,
} from "@/plate-solver/trailMotion";

describe("별 궤적 움직임", () => {
  it("시작에서 멈춤 → 이동 → 끝에서 멈춤을 되풀이하고, 끝에서 시작으로 바로 넘어간다", () => {
    const { holdStartMs, moveMs, holdEndMs } = TRAIL_MOTION;
    const cycle = holdStartMs + moveMs + holdEndMs;

    expect(trailProgress(0)).toBe(0);
    expect(trailProgress(holdStartMs - 1)).toBe(0);
    expect(trailProgress(holdStartMs + moveMs / 2)).toBeCloseTo(0.5, 5);
    expect(trailProgress(holdStartMs + moveMs)).toBe(1);
    expect(trailProgress(cycle - 1)).toBe(1);
    expect(trailProgress(cycle)).toBe(0);
  });

  it("진행도 1이면 하늘을 천구 극 둘레로 궤적 각도만큼 돌린 자세다", () => {
    const start: Mat3 = [
      [1000, 0, 500],
      [0, 1000, 400],
      [0, 0, 1],
    ];

    expect(trailPose(start, 30, 0)).toEqual(start);

    // 시작 자세에서 적경 0°에 있던 별은 끝 자세에서 적경 30°에 있던 별의 자리에 간다 (하늘이 −30° 돈다)
    const end = trailPose(start, 30, 1);
    const a = (30 * Math.PI) / 180;
    const v = [Math.cos(a), Math.sin(a), 0.5];
    const proj = (m: Mat3, w: number[]) =>
      m.map((row) => row[0] * w[0] + row[1] * w[1] + row[2] * w[2]);
    const atEnd = proj(end, v);
    const atStart = proj(start, [1, 0, 0.5]);

    atEnd.forEach((x, i) => expect(x).toBeCloseTo(atStart[i], 9));
  });
});
