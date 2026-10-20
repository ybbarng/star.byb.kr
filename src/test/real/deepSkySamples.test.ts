import type { Point2D } from "@/scripts/hash/types";
import { describe, expect, it } from "vitest";
import { DEEP_SKY_OBJECTS } from "@/search/skyObjects";
import { projectVecToPhoto } from "@/search/utils/wcs";
import { loadSolvedPoses } from "@/test/real/detectionLabels";

// 풀린 변환으로 딥스카이를 투영하면 사진에 실제로 찍힌 자리에 온다.
// 기대 위치는 사진을 잘라 눈으로 찾은 천체 중심 (2026-10-20).
const SEEN: [file: string, name: string, at: Point2D][] = [
  // 발표 "이과생의 별 헤는 밤"에서 분홍 원으로 표시했던 흐릿한 얼룩
  ["20220607-berry-seoul.jpg", "안드로메다 은하 M31", [182, 44]],
  ["cafe-orion.jpg", "오리온 대성운 M42", [778, 628]],
  ["20250117-carl-aurora-01.jpg", "플레이아데스 성단 M45", [811, 1661]],
];

describe("딥스카이 표시", () => {
  const poses = loadSolvedPoses();

  it.each(SEEN)("%s: %s", (file, name, at) => {
    const pose = poses[file];
    const object = DEEP_SKY_OBJECTS.find((o) => o.name === name)!;
    const p = projectVecToPhoto(pose.TP, object.vector)!;

    // 대각선의 1% 안 (베리 사진이면 18px)
    expect(Math.hypot(p[0] - at[0], p[1] - at[1])).toBeLessThan(
      Math.hypot(pose.width, pose.height) * 0.01,
    );
  });
});
