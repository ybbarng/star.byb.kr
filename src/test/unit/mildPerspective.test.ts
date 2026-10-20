import type { Mat3 } from "@/search/utils/similarity";
import { describe, expect, it } from "vitest";
import { isMildPerspective } from "@/search/solveCore";
import { loadSolvedPoses } from "@/test/real/detectionLabels";

describe("isMildPerspective", () => {
  it("자동으로 푼 실제 샘플의 변환은 모두 받아들인다 (원근 보정된 은하수 포함)", () => {
    for (const [file, pose] of Object.entries(loadSolvedPoses())) {
      expect(isMildPerspective(pose.TP, pose.width, pose.height), file).toBe(
        true,
      );
    }
  });

  it("지평선이 사진을 가로지르는 퇴화 변환은 거른다", () => {
    // 오로라-02를 사진 전체로 풀 때 log-odds 9.8로 확신했던 오답 (시야 0.57°)
    const degenerate: Mat3 = [
      [-3958.1609717020833, -1536.4585945482627, 2011.6140779498596],
      [-10872.55565442412, -2530.3877418444063, -2649.9329301307803],
      [-3.0169541147409933, -0.6958141865581298, -0.7911573683404067],
    ];

    expect(isMildPerspective(degenerate, 3024, 4032)).toBe(false);
  });
});
