import type { GuessrAnswer } from "@/game/starGuessr/score";
import { describe, expect, it } from "vitest";
import {
  localMeanTime,
  makeGuessrScene,
  SCENE_HEIGHT,
} from "@/game/starGuessr/scene";
import { scoreGuess } from "@/game/starGuessr/score";
import { nextTimeWithLst } from "@/search/shotTimeEstimate";
import {
  altAzOf,
  fromAltAzJ2000,
  horizontalFrameJ2000,
  julianDay,
  localSiderealDeg,
  sunVector,
} from "@/search/utils/ephemeris";
import { projectVecToPhoto } from "@/search/utils/wcs";

// 별하늘 지오게서의 규칙: 문제는 밤이고 지평선이 보이며, 채점은 "같은 하늘"을 인정한다 (docs/game-plans.md 1).

const answerAt = (date: Date, lonDeg: number, latDeg: number): GuessrAnswer => {
  const local = localMeanTime(date, lonDeg);

  return {
    latDeg,
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
  };
};

describe("문제 만들기", () => {
  it("같은 시드면 같은 문제다 (오늘의 문제)", () => {
    const a = makeGuessrScene(20261020, "easy");
    const b = makeGuessrScene(20261020, "easy");

    expect(a.date.getTime()).toBe(b.date.getTime());
    expect(a.observer).toEqual(b.observer);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    "시드 %i: 해가 15° 아래인 밤이고 지평선이 사진 아래쪽에 보인다",
    (seed) => {
      const s = makeGuessrScene(seed, "normal");
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

describe("채점", () => {
  const scene = makeGuessrScene(7, "easy");
  const { lonDeg, latDeg } = scene.observer;

  it("위도·날짜·시각을 다 맞히면 5000점", () => {
    const s = scoreGuess(scene, answerAt(scene.date, lonDeg, latDeg));

    expect(s.points.total).toBeGreaterThanOrEqual(4990);
  });

  it("날짜가 달라도 같은 하늘(같은 항성시)이면 하늘 시각 점수는 만점", () => {
    // 두 달 뒤 같은 하늘 = 약 4시간 이른 시각
    const lst = localSiderealDeg(julianDay(scene.date), scene.observer);
    const later = nextTimeWithLst(
      lst,
      lonDeg,
      new Date(scene.date.getTime() + 60 * 86400000),
    );
    const s = scoreGuess(scene, answerAt(later, lonDeg, latDeg));

    expect(s.points.sky).toBeGreaterThanOrEqual(1980);
    expect(s.points.date).toBeLessThan(100);
  });

  it("위도를 8° 틀리면 위도 점수는 약 1/e", () => {
    const s = scoreGuess(scene, answerAt(scene.date, lonDeg, latDeg + 8));

    expect(s.points.lat).toBeGreaterThan(700);
    expect(s.points.lat).toBeLessThan(780);
  });

  it("시각을 12시간 틀리면 하늘 점수는 거의 0", () => {
    const s = scoreGuess(
      scene,
      answerAt(new Date(scene.date.getTime() + 12 * 3600000), lonDeg, latDeg),
    );

    expect(s.points.sky).toBeLessThan(10);
  });
});
