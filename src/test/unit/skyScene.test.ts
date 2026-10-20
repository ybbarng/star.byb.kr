import { describe, expect, it } from "vitest";
import { makeSkyScene, SCENE_HEIGHT } from "@/game/sky/scene";
import {
  altAzOf,
  fromAltAzJ2000,
  horizontalFrameJ2000,
  julianDay,
  sunVector,
} from "@/search/utils/ephemeris";
import { projectVecToPhoto } from "@/search/utils/wcs";

// 게임용 밤하늘 문제의 규칙: 같은 시드면 같은 문제, 늘 밤이고 지평선이 보인다.

describe("문제 만들기", () => {
  it("같은 시드면 같은 문제다 (오늘의 문제)", () => {
    const a = makeSkyScene(20261020, "easy");
    const b = makeSkyScene(20261020, "easy");

    expect(a.date.getTime()).toBe(b.date.getTime());
    expect(a.observer).toEqual(b.observer);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    "시드 %i: 해가 15° 아래인 밤이고 지평선이 사진 아래쪽에 보인다",
    (seed) => {
      const s = makeSkyScene(seed, "normal");
      const jd = julianDay(s.date);

      expect(altAzOf(sunVector(jd), jd, s.observer).altDeg).toBeLessThan(-15);

      const horizon = projectVecToPhoto(
        s.TP,
        fromAltAzJ2000(
          horizontalFrameJ2000(jd, s.observer),
          0,
          s.view.azimuthDeg,
        ),
      )!;

      expect(horizon[1]).toBeGreaterThan(SCENE_HEIGHT * 0.55);
      expect(horizon[1]).toBeLessThan(SCENE_HEIGHT * 0.95);
    },
  );
});
