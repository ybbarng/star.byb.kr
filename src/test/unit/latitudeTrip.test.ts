import { describe, expect, it } from "vitest";
import {
  altAzAt,
  equatorialOf,
  latitudeNote,
  makeQuiz,
  QUIZ_PLACES,
  risingAngleDeg,
  skyShare,
  starPath,
} from "@/game/latitudeTrip/trip";
import { STARS } from "@/game/sky/catalog";
import { altAzOf, julianDay, localSiderealDeg } from "@/search/utils/ephemeris";
import { createRng } from "@/utils/rng";

// 극지방·적도 하늘 여행: 위도·항성시로 구한 고도·방위와, 위도마다 별이 지지 않는지·뜨지 않는지.
describe("고도·방위", () => {
  it("천구의 북극은 위도만큼 높이, 정북에 있다", () => {
    for (const lat of [10, 37.6, 65]) {
      const p = altAzAt(90, 123, lat);

      expect(p.altDeg).toBeCloseTo(lat, 6);
      expect(p.azDeg).toBeCloseTo(0, 6);
    }
  });

  it("적도에서 천구의 적도 위 별은 정동에서 수직으로 뜬다", () => {
    const rising = altAzAt(0, -90, 0);
    const later = altAzAt(0, -80, 0);

    expect(rising.altDeg).toBeCloseTo(0, 6);
    expect(rising.azDeg).toBeCloseTo(90, 6);
    // 시간이 흘러도 방위는 그대로, 고도만 오른다 (수직)
    expect(later.azDeg).toBeCloseTo(90, 6);
    expect(later.altDeg).toBeCloseTo(10, 6);
  });

  it("북극에서는 고도가 시간과 상관없이 적위와 같다 (지평선과 나란히 돈다)", () => {
    for (const h of [0, 70, 200]) {
      expect(altAzAt(40, h, 90).altDeg).toBeCloseTo(40, 6);
    }
  });

  it("앱의 ephemeris(altAzOf)와 같은 답 (서울, 시리우스)", () => {
    const sirius = STARS.find((s) => s.latinName === "Sirius")!;
    const date = new Date(Date.UTC(2026, 0, 15, 12));
    const jd = julianDay(date);
    const seoul = { latDeg: 37.57, lonDeg: 126.98 };
    const { raDeg, decDeg } = equatorialOf(sirius.vector);
    const mine = altAzAt(decDeg, localSiderealDeg(jd, seoul) - raDeg, 37.57);
    const app = altAzOf(sirius.vector, jd, seoul);

    // 세차(26년치 약 0.4°)를 무시한 차이만큼
    expect(Math.abs(mine.altDeg - app.altDeg)).toBeLessThan(0.6);
    expect(Math.abs(mine.azDeg - app.azDeg)).toBeLessThan(0.8);
  });
});

describe("지지 않는 별·볼 수 없는 별", () => {
  it("서울에서 북극성은 지지 않고, 남십자자리 아크룩스는 뜨지 않는다", () => {
    expect(starPath(89.26, 37.6)).toBe("always");
    expect(starPath(-63.1, 37.6)).toBe("never");
    expect(starPath(-16.7, 37.6)).toBe("riseSet");
  });

  it("북극에서는 북반구 별만 지지 않고 남반구 별은 볼 수 없다", () => {
    const decs = STARS.map((s) => equatorialOf(s.vector).decDeg);
    const share = skyShare(decs, 90);
    const north = decs.filter((d) => d > 0).length / decs.length;

    expect(share.riseSet).toBe(0);
    expect(share.always).toBeCloseTo(north, 6);
  });

  it("적도에서는 모든 별이 뜨고 진다", () => {
    const decs = STARS.map((s) => equatorialOf(s.vector).decDeg);

    expect(skyShare(decs, 0).riseSet).toBe(1);
  });

  it("별이 지평선을 지나는 기울기: 적도 90°, 서울 약 52°, 극 0°", () => {
    expect(risingAngleDeg(0)).toBe(90);
    expect(risingAngleDeg(37.6)).toBeCloseTo(52.4, 6);
    expect(risingAngleDeg(-90)).toBe(0);
  });
});

describe("설명과 퀴즈", () => {
  it("위도마다 맞는 설명", () => {
    expect(latitudeNote(90).title).toContain("북극");
    expect(latitudeNote(-89).title).toContain("남극");
    expect(latitudeNote(2).title).toContain("적도");
    expect(latitudeNote(37.6).title).toContain("비스듬히");
  });

  it("퀴즈 보기 네 개에 정답이 하나 들어 있다", () => {
    const rng = createRng(3);

    for (let i = 0; i < 20; i++) {
      const q = makeQuiz(rng);

      expect(q.choices).toHaveLength(4);
      expect(new Set(q.choices.map((c) => c.id)).size).toBe(4);
      expect(q.choices).toContain(q.answer);
      expect(QUIZ_PLACES).toContain(q.answer);
    }
  });
});
