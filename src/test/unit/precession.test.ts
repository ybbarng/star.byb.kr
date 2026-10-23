import { describe, expect, it } from "vitest";
import {
  angleDeg,
  astrologyDriftDeg,
  equinoxConstellation,
  equinoxLonOfYear,
  nearestPoleStar,
  northPoleOfYear,
  poleStarEras,
  PRECESSION_PERIOD_YEARS,
  yearLabel,
} from "@/game/precession/precession";
import { STARS } from "@/game/sky/catalog";

// 세차운동 타임머신: 천구의 북극이 별 사이를 도는 근사(일정한 속도, 기울기 고정)를 알려진 북극성 시대로 확인한다.
const byLatin = (name: string) => STARS.find((s) => s.latinName === name)!;

describe("세차 원", () => {
  it("한 바퀴는 약 25,800년", () => {
    expect(PRECESSION_PERIOD_YEARS).toBeGreaterThan(25700);
    expect(PRECESSION_PERIOD_YEARS).toBeLessThan(25850);
  });

  it("2000년의 극은 J2000 천구의 북극", () => {
    expect(angleDeg(northPoleOfYear(2000), [0, 0, 1])).toBeLessThan(1e-6);
  });

  it("극은 늘 황도의 북극에서 23.44° 떨어져 있다", () => {
    const eps = (23.4392911 * Math.PI) / 180;
    const eclipticPole: [number, number, number] = [
      0,
      -Math.sin(eps),
      Math.cos(eps),
    ];

    for (const y of [-12000, -3000, 2000, 8000, 14000]) {
      expect(angleDeg(northPoleOfYear(y), eclipticPole)).toBeCloseTo(23.44, 1);
    }
  });

  it("반 바퀴 뒤에는 지금 극에서 약 47° 떨어진다", () => {
    expect(
      angleDeg(
        northPoleOfYear(2000),
        northPoleOfYear(2000 + PRECESSION_PERIOD_YEARS / 2),
      ),
    ).toBeCloseTo(46.88, 1);
  });
});

describe("북극성의 시대", () => {
  it("지금은 북극성(폴라리스)이 1° 안", () => {
    const { star, sepDeg } = nearestPoleStar(2026, STARS);

    expect(star.latinName).toBe("Polaris");
    expect(sepDeg).toBeLessThan(1);
  });

  it("피라미드 무렵(기원전 2800년쯤)에는 투반", () => {
    const { star, sepDeg } = nearestPoleStar(-2800, STARS);

    expect(star.latinName).toBe("Thuban");
    expect(sepDeg).toBeLessThan(1);
  });

  it("약 12,000년 뒤에는 직녀성(베가)이 5° 안", () => {
    const { star, sepDeg } = nearestPoleStar(14000, STARS);

    expect(star.latinName).toBe("Vega");
    expect(sepDeg).toBeLessThan(5.5);
  });

  it("가장 가까워지는 해: 투반 기원전 3000~2600년, 폴라리스 2050~2150년, 베가 13000~14500년", () => {
    const eras = poleStarEras(STARS, -11000, 14500, { maxSepDeg: 6 });
    const yearOf = (name: string) =>
      eras.find((e) => e.star === byLatin(name))!.bestYear;

    expect(yearOf("Thuban")).toBeGreaterThan(-3000);
    expect(yearOf("Thuban")).toBeLessThan(-2600);
    expect(yearOf("Polaris")).toBeGreaterThan(2050);
    expect(yearOf("Polaris")).toBeLessThan(2150);
    expect(yearOf("Vega")).toBeGreaterThan(13000);
    expect(yearOf("Vega")).toBeLessThan(14500);
  });
});

describe("춘분점과 점성술", () => {
  it("2000년 춘분점은 황경 0°, 지금은 물고기자리", () => {
    expect(equinoxLonOfYear(2000)).toBeCloseTo(0, 6);
    expect(equinoxConstellation(2026).label).toBe("물고기자리");
  });

  it("2600년대 후반에는 물병자리로 넘어간다", () => {
    expect(equinoxConstellation(2550).label).toBe("물고기자리");
    expect(equinoxConstellation(2700).label).toBe("물병자리");
  });

  it("점성술이 정해진 무렵 춘분점은 양자리 곁, 지금은 약 30° 어긋남", () => {
    expect(["양자리", "물고기자리"]).toContain(
      equinoxConstellation(-129).label,
    );
    expect(astrologyDriftDeg(2026)).toBeGreaterThan(29);
    expect(astrologyDriftDeg(2026)).toBeLessThan(31);
  });
});

describe("연도 표시", () => {
  it("천문 연도 0년은 기원전 1년", () => {
    expect(yearLabel(0)).toBe("기원전 1년");
    expect(yearLabel(-2799)).toBe("기원전 2800년");
    expect(yearLabel(2026)).toBe("2026년");
    expect(yearLabel(-12000)).toBe("기원전 12,001년");
    expect(yearLabel(14000)).toBe("14,000년");
  });
});
