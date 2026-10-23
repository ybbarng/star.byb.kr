import { describe, expect, it } from "vitest";
import { GAMES } from "@/game/hub";
import { STARS } from "@/game/sky/catalog";
import {
  angleBetweenDeg,
  DAILY_EARLIER_SECONDS,
  GALACTIC_CENTER,
  GALACTIC_TILT_DEG,
  galacticToVector,
  noonSunAltitudeDeg,
  raDecToVector,
  SIDEREAL_DAY_SECONDS,
  sunDeclinationExtremes,
  vectorToGalactic,
} from "@/learn/basics/skyMath";
import { BASICS_TOPICS } from "@/learn/basics/topics";
import { LEARN_STEPS } from "@/learn/steps";
import { constellationAt } from "@/search/utils/constellationBounds";

// 하늘 읽기 기초 페이지가 보여 주는 숫자를 확인한다. 화면의 문장은 이 값들을 따른다.
const byLatin = (name: string) => {
  const s = STARS.find((x) => x.latinName === name);

  if (!s) {
    throw new Error(`카탈로그에 없는 별: ${name}`);
  }

  return s;
};

describe("목차", () => {
  it("이 개념을 쓰는 곳의 링크는 실제 있는 페이지다", () => {
    const games = new Set(GAMES.map((g) => g.href));
    const learn = new Set(LEARN_STEPS.map((s) => `/learn/${s.slug}`));

    for (const t of BASICS_TOPICS) {
      for (const l of t.links) {
        const path = l.href.split("#")[0];
        const ok =
          path === "/plate-solver" ||
          path === "/games" ||
          games.has(path) ||
          learn.has(path);
        expect(ok, `${t.slug}: ${l.href}`).toBe(true);
      }
    }
  });

  it("놀이터 링크가 있으면 🌍 표시, 솔버 링크가 있으면 🔭 표시가 있다", () => {
    for (const t of BASICS_TOPICS) {
      for (const l of t.links) {
        expect(t.marks, t.slug).toContain(l.mark);
      }
    }
  });
});

describe("항성일", () => {
  it("별 기준 하루는 23시간 56분 4초", () => {
    expect(SIDEREAL_DAY_SECONDS).toBeCloseTo(23 * 3600 + 56 * 60 + 4.09, 1);
  });

  it("별은 하루에 약 3분 56초 일찍 뜬다", () => {
    expect(DAILY_EARLIER_SECONDS).toBeCloseTo(3 * 60 + 55.9, 0);
  });
});

describe("지구의 기울기", () => {
  it("해의 적위는 한 해 동안 ±23.4°를 오간다", () => {
    const { max, min } = sunDeclinationExtremes(2026);
    expect(max).toBeCloseTo(23.44, 1);
    expect(min).toBeCloseTo(-23.44, 1);
  });

  it("서울(37.57°N) 정오의 해 높이: 하지 약 76°, 동지 약 29°", () => {
    expect(noonSunAltitudeDeg(37.57, 23.44)).toBeCloseTo(75.9, 1);
    expect(noonSunAltitudeDeg(37.57, -23.44)).toBeCloseTo(29.0, 1);
  });
});

describe("은하 좌표", () => {
  it("은하면은 천구 적도와 약 62.9° 기울어 있다", () => {
    expect(GALACTIC_TILT_DEG).toBeCloseTo(62.87, 2);
  });

  it("은하 중심과 은하 북극은 서로 직각이다", () => {
    expect(
      angleBetweenDeg(galacticToVector(0, 0), galacticToVector(0, 90)),
    ).toBeCloseTo(90, 3);
  });

  it("천구 북극의 은하 경도는 122.93°", () => {
    expect(vectorToGalactic([0, 0, 1]).lDeg).toBeCloseTo(122.93, 2);
  });

  it("은하 중심은 궁수자리, 반대쪽은 마차부자리(황소자리 경계 근처), 은하 북극은 머리털자리", () => {
    expect(constellationAt(galacticToVector(0, 0))).toBe("궁수자리");
    expect(constellationAt(galacticToVector(180, 0))).toBe("마차부자리");
    expect(constellationAt(galacticToVector(0, 90))).toBe("머리털자리");
    // 반대쪽은 황소자리 뿔 끝 엘나트에서 5° 안
    expect(
      angleBetweenDeg(galacticToVector(180, 0), byLatin("Elnath").vector),
    ).toBeLessThan(5);
  });

  it("은하 중심은 적위 −29°라 서울에서 가장 높이 떠도 23° 남짓", () => {
    expect(90 - 37.57 + GALACTIC_CENTER.decDeg).toBeCloseTo(23.5, 1);
  });

  it("백조자리 데네브는 은하면 바로 위(|b| < 5°)", () => {
    expect(
      Math.abs(vectorToGalactic(byLatin("Deneb").vector).bDeg),
    ).toBeLessThan(5);
  });

  it("발표된 은하 중심 좌표는 은하 적도 위에 있다 (반올림 오차 0.1초각 안)", () => {
    const v = raDecToVector(GALACTIC_CENTER.raDeg, GALACTIC_CENTER.decDeg);
    const g = vectorToGalactic(v);
    expect(Math.abs(g.bDeg)).toBeLessThan(0.1 / 3600);
    expect(Math.min(g.lDeg, 360 - g.lDeg)).toBeLessThan(0.1 / 3600);
  });
});
