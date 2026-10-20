import { describe, expect, it } from "vitest";
import { makeSkyScene } from "@/game/sky/scene";
import {
  answerDials,
  dialDate,
  matchedFlags,
  SOLVED_RATIO,
  targetStars,
} from "@/game/skyMatch/match";
import { horizonCameraTP } from "@/search/horizonSolve";
import { contextStars, loadCatalog } from "@/test/synthetic/loadCatalog";

// 하늘 맞추기 퍼즐의 판정: 정답 다이얼이면 다 맞고, 같은 하늘이면 날짜가 달라도 맞고, 엉뚱하면 안 맞는다.

const stars = contextStars(loadCatalog()).map((s) => ({
  vector: s.vector,
  mag: s.mag,
}));

const ratio = (flags: boolean[]) => flags.filter(Boolean).length / flags.length;

describe("하늘 맞추기 판정", () => {
  const scene = makeSkyScene(11, "easy");
  const targets = targetStars(scene, stars);
  const tpFor = (latDeg: number, dayOfYear: number, minutes: number) =>
    horizonCameraTP(
      dialDate(scene, dayOfYear, minutes),
      { latDeg, lonDeg: scene.observer.lonDeg },
      scene.view,
      scene.width,
      scene.height,
    );

  it("정답 사진에 밝은 별이 충분히 보인다", () => {
    expect(targets.length).toBeGreaterThanOrEqual(15);
  });

  it("정답 다이얼이면 모든 별이 맞는다", () => {
    const a = answerDials(scene);

    expect(
      ratio(
        matchedFlags(targets, tpFor(a.latDeg, a.dayOfYear, a.minutes), scene),
      ),
    ).toBe(1);
  });

  it("한 달 뒤 2시간 이른 시각(같은 하늘)이어도 성공이다", () => {
    const a = answerDials(scene);
    // 하루 4분 일찍 → 30일 뒤 약 118분 일찍
    const flags = matchedFlags(
      targets,
      tpFor(a.latDeg, a.dayOfYear + 30, a.minutes - 118),
      scene,
    );

    expect(ratio(flags)).toBeGreaterThanOrEqual(SOLVED_RATIO);
  });

  it("위도가 20° 다르거나 시각이 3시간 다르면 실패다", () => {
    const a = answerDials(scene);

    expect(
      ratio(
        matchedFlags(
          targets,
          tpFor(a.latDeg + 20, a.dayOfYear, a.minutes),
          scene,
        ),
      ),
    ).toBeLessThan(SOLVED_RATIO);
    expect(
      ratio(
        matchedFlags(
          targets,
          tpFor(a.latDeg, a.dayOfYear, a.minutes + 180),
          scene,
        ),
      ),
    ).toBeLessThan(SOLVED_RATIO);
  });
});
