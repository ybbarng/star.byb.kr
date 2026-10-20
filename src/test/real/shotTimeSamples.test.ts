import type { Point2D } from "@/scripts/hash/types";
import { describe, expect, it } from "vitest";
import {
  estimateShotTimes,
  skyClockOf,
  zenithFromHorizon,
} from "@/search/shotTimeEstimate";
import { photoToSky } from "@/search/utils/wcs";
import { loadSolvedPoses } from "@/test/real/detectionLabels";

// 발표 "이과생의 별 헤는 밤"의 Berry 사진: 사람이 Stellarium과 표로 찾았던 촬영 시각을
// 지평선 두 점과 풀린 변환만으로 계산한다. 본인 답은 2021년 10월 3일 오전 4~5시.
describe("Berry 사진의 촬영 시각", () => {
  const pose = loadSolvedPoses()["20220607-berry-seoul.jpg"];
  // 왼쪽 먼 산 능선 (사진을 잘라 눈으로 찾음). 실제 지평선보다 조금 높다.
  const horizon: [Point2D, Point2D] = [
    [10, 843],
    [330, 850],
  ];
  const zenith = zenithFromHorizon(
    photoToSky(pose.TP, horizon[0]),
    photoToSky(pose.TP, horizon[1]),
    photoToSky(pose.TP, [pose.width / 2, 0]),
  )!;
  const clock = skyClockOf(zenith);

  it("천정의 적위로 구한 위도가 서울(37.5°)과 5° 안", () => {
    expect(Math.abs(clock.latDeg - 37.5)).toBeLessThan(5);
  });

  it("10월 3일 후보가 오전 4~5시 (KST)", () => {
    const candidates = estimateShotTimes(clock, {
      lonDeg: 127,
      from: new Date("2021-10-03T00:00:00+09:00"),
      days: 1,
    });

    expect(candidates).toHaveLength(1);

    const kstHour =
      (candidates[0].date.getUTCHours() +
        9 +
        candidates[0].date.getUTCMinutes() / 60) %
      24;

    expect(kstHour).toBeGreaterThanOrEqual(4);
    expect(kstHour).toBeLessThan(5);
  });
});
