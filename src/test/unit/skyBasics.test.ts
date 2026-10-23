import { describe, expect, it } from "vitest";
import { GAMES } from "@/game/hub";
import { STARS } from "@/game/sky/catalog";
import {
  altAzAt,
  angleBetweenDeg,
  clockLabel,
  DAILY_EARLIER_SECONDS,
  GALACTIC_CENTER,
  GALACTIC_TILT_DEG,
  galacticToVector,
  KM_PER_DEG_LAT,
  kmPerDegLon,
  maxAltitudeDeg,
  meanSolarNoonMinutes,
  noonSunAltitudeDeg,
  raDecToVector,
  SEOUL,
  SIDEREAL_DAY_SECONDS,
  starVisibility,
  sunDeclinationExtremes,
  transitMinutes,
  vectorToGalactic,
  vectorToRaDec,
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

describe("지구 위의 좌표", () => {
  it("위도 1°는 약 111km, 서울에서 경도 1°는 약 88km", () => {
    expect(KM_PER_DEG_LAT).toBeCloseTo(111.1, 1);
    expect(kmPerDegLon(SEOUL.latDeg)).toBeCloseTo(88.2, 0);
  });

  it("서울의 평균 해는 한국 시각 12시 32분에 남중한다", () => {
    expect(clockLabel(meanSolarNoonMinutes(SEOUL.lonDeg, 9))).toBe("12:32");
  });
});

describe("하늘의 좌표", () => {
  it("서울에서 직녀성은 89°, 시리우스는 36°까지 뜬다", () => {
    const dec = (n: string) => vectorToRaDec(byLatin(n).vector).decDeg;
    expect(maxAltitudeDeg(SEOUL.latDeg, dec("Vega"))).toBeCloseTo(88.8, 0);
    expect(maxAltitudeDeg(SEOUL.latDeg, dec("Sirius"))).toBeCloseTo(35.7, 0);
  });

  it("서울에서 적위 +52.4° 북쪽은 지지 않고, −52.4° 남쪽은 뜨지 않는다", () => {
    expect(starVisibility(SEOUL.latDeg, 53)).toBe("circumpolar");
    expect(starVisibility(SEOUL.latDeg, 52)).toBe("rises");
    expect(starVisibility(SEOUL.latDeg, -53)).toBe("never");
    expect(starVisibility(-33.87, -60)).toBe("circumpolar");
  });

  it("베텔게우스의 적경은 5h 55m", () => {
    expect(vectorToRaDec(byLatin("Betelgeuse").vector).raDeg / 15).toBeCloseTo(
      5.92,
      2,
    );
  });

  it("남중 시각에는 정남(방위 180°)에 있다", () => {
    const v = byLatin("Betelgeuse").vector;
    const m = transitMinutes(vectorToRaDec(v).raDeg, 2026, 1, 15, SEOUL, 9);
    const t = Date.UTC(2026, 0, 15) - 9 * 3600000 + m * 60000;
    const { azDeg, altDeg } = altAzAt(v, t, SEOUL);
    // 별 지도(2000년)와 그날 기준 항성시의 차이 0.4°만큼 어긋날 수 있다
    expect(Math.abs(azDeg - 180)).toBeLessThan(1);
    expect(altDeg).toBeCloseTo(maxAltitudeDeg(SEOUL.latDeg, 7.41), 0);
  });
});

describe("하루 4분", () => {
  it("베텔게우스의 남중은 한 달에 약 2시간씩 이르다", () => {
    const ra = vectorToRaDec(byLatin("Betelgeuse").vector).raDeg;
    const m = Array.from({ length: 12 }, (_, i) =>
      transitMinutes(ra, 2026, i + 1, 1, SEOUL, 9),
    );

    for (let i = 1; i < 12; i++) {
      const earlier = (((m[i - 1] - m[i]) % 1440) + 1440) % 1440;
      expect(earlier).toBeGreaterThan(105);
      expect(earlier).toBeLessThan(126);
    }

    // 1월 1일 자정 무렵, 7월 1일에는 낮(정오 무렵)에 남중
    expect(Math.min(m[0], 1440 - m[0])).toBeLessThan(30);
    expect(Math.abs(m[6] - 12 * 60)).toBeLessThan(60);
  });
});
