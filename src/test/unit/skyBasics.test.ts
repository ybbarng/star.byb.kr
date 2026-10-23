import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { gameForPath } from "@/game/hub";
import { STARS } from "@/game/sky/catalog";
import {
  HEXAGON,
  HOT_HISTOGRAM,
  MONTHLY,
  REGIONS,
  SEASON_AVERAGES,
  VISIBLE,
} from "@/learn/basics/brightSeasons";
import { NEAR_BRIGHT_STARS, REFERENCE_PAIRS } from "@/learn/basics/references";
import {
  altAzAt,
  angleBetweenDeg,
  airmass,
  arcPoints,
  brightnessRatio,
  clockLabel,
  dayLengthHours,
  extinctionMag,
  fistsLabel,
  DAILY_EARLIER_SECONDS,
  GALACTIC_CENTER,
  GALACTIC_TILT_DEG,
  galacticToVector,
  KM_PER_DEG_LAT,
  kmPerDegLon,
  maxAltitudeDeg,
  meanSolarNoonMinutes,
  moonAngularDiameterDeg,
  moonHourlyMotionDeg,
  offLineDeg,
  parallaxToLightYears,
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
import { j2000ToOfDate, julianDay } from "@/search/utils/ephemeris";

// 하늘 읽기 기초 페이지가 보여 주는 숫자를 확인한다. 화면의 문장은 이 값들을 따른다.
const byLatin = (name: string) => {
  const s = STARS.find((x) => x.latinName === name);

  if (!s) {
    throw new Error(`카탈로그에 없는 별: ${name}`);
  }

  return s;
};

describe("목차", () => {
  it("목차의 페이지마다 page.tsx가 있다", () => {
    for (const t of BASICS_TOPICS) {
      expect(
        existsSync(`src/app/learn/basics/${t.slug}/page.tsx`),
        t.slug,
      ).toBe(true);
    }
  });

  it("이 개념을 쓰는 곳의 링크는 실제 있는 페이지다", () => {
    const learn = new Set(LEARN_STEPS.map((s) => `/learn/${s.slug}`));

    for (const t of BASICS_TOPICS) {
      for (const l of t.links) {
        const path = l.href.split("#")[0];
        const ok =
          path === "/plate-solver" ||
          path === "/games" ||
          gameForPath(path) !== undefined ||
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

  it("은하면과 황도는 약 60.2° 기울어 있다", () => {
    expect(
      angleBetweenDeg(galacticToVector(0, 90), raDecToVector(270, 66.5607)),
    ).toBeCloseTo(60.19, 1);
  });

  it("서울 저녁 9시: 1월엔 반대쪽이 68°, 4월엔 은하 북극이 53°, 8월엔 은하 중심이 정남 23°", () => {
    const at = (m: number, l: number, b: number) =>
      altAzAt(galacticToVector(l, b), Date.UTC(2026, m - 1, 15, 12), SEOUL);
    expect(at(1, 180, 0).altDeg).toBeCloseTo(68, -0.5);
    expect(at(4, 0, 90).altDeg).toBeCloseTo(53, -0.5);
    const center = at(8, 0, 0);
    expect(center.altDeg).toBeCloseTo(23, -0.5);
    expect(Math.abs(center.azDeg - 180)).toBeLessThan(10);
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

describe("계절", () => {
  it("서울의 낮: 하지 14시간 46분, 춘분 12시간 8분, 동지 9시간 34분 (대기 굴절 포함)", () => {
    expect(dayLengthHours(SEOUL.latDeg, 23.44) * 60).toBeCloseTo(
      14 * 60 + 46,
      -1,
    );
    expect(dayLengthHours(SEOUL.latDeg, 0) * 60).toBeCloseTo(12 * 60 + 8, -1);
    expect(dayLengthHours(SEOUL.latDeg, -23.44) * 60).toBeCloseTo(
      9 * 60 + 34,
      -1,
    );
  });

  it("극권 안에서는 해가 지지 않거나 뜨지 않는다", () => {
    expect(dayLengthHours(70, 23.44)).toBe(24);
    expect(dayLengthHours(70, -23.44)).toBe(0);
  });

  it("서울의 춘분 정오 해 높이는 52°", () => {
    expect(noonSunAltitudeDeg(SEOUL.latDeg, 0)).toBeCloseTo(52.4, 1);
  });
});

describe("손 각도와 스타 호핑", () => {
  const deg = (label: string) =>
    REFERENCE_PAIRS.find((p) => p.label.includes(label))!.deg;

  it("기준 쌍의 각거리 (별 지도로 계산)", () => {
    expect(deg("지시별 (두베")).toBeCloseTo(5.4, 1);
    expect(deg("허리띠")).toBeCloseTo(2.7, 1);
    expect(deg("카스토르")).toBeCloseTo(4.5, 1);
    expect(deg("베텔게우스")).toBeCloseTo(18.6, 1);
    expect(deg("북두칠성 전체")).toBeCloseTo(25.7, 1);
    expect(deg("북극성")).toBeCloseTo(28.7, 1);
  });

  it("두베→북극성은 지시별 간격의 약 5배", () => {
    expect(deg("북극성") / deg("지시별 (두베")).toBeCloseTo(5.3, 1);
  });

  it("달의 지름은 0.49°~0.56°", () => {
    const sizes = Array.from({ length: 365 }, (_, d) =>
      moonAngularDiameterDeg(new Date(Date.UTC(2026, 0, 1 + d))),
    );
    expect(Math.min(...sizes)).toBeGreaterThan(0.48);
    expect(Math.max(...sizes)).toBeLessThan(0.57);
  });

  it("지시별을 이은 선에서 북극성은 2° 비켜나 있다", () => {
    expect(
      offLineDeg(
        byLatin("Merak").vector,
        byLatin("Dubhe").vector,
        byLatin("Polaris").vector,
      ),
    ).toBeCloseTo(1.9, 1);
  });

  it("허리띠 선에서 시리우스는 2.6°, 알데바란·플레이아데스는 약 5° 비켜나 있다", () => {
    const a = byLatin("Mintaka").vector;
    const b = byLatin("Alnitak").vector;
    expect(offLineDeg(a, b, byLatin("Sirius").vector)).toBeCloseTo(2.6, 1);
    expect(offLineDeg(a, b, byLatin("Aldebaran").vector)).toBeCloseTo(5.2, 1);
    expect(offLineDeg(a, b, byLatin("Alcyone").vector)).toBeCloseTo(5.1, 1);
  });

  it("미라크·안드로메다 뮤·M31은 한 줄에 약 3.9° 간격", () => {
    const mirach = byLatin("Mirach").vector;
    const mu = STARS.find((s) => s.hr === "269")!.vector;
    const m31 = raDecToVector(10.6847, 41.269);
    expect(offLineDeg(mirach, mu, m31)).toBeLessThan(0.1);
    expect(angleBetweenDeg(mirach, mu)).toBeCloseTo(3.9, 1);
    expect(angleBetweenDeg(mu, m31)).toBeCloseTo(3.9, 1);
  });

  it("arcPoints는 큰 원을 따라 늘인 끝점에 닿는다", () => {
    const a = byLatin("Merak").vector;
    const b = byLatin("Dubhe").vector;
    const pts = arcPoints(a, b, 3);
    expect(angleBetweenDeg(pts[0], a)).toBeLessThan(1e-9);
    expect(angleBetweenDeg(a, pts[pts.length - 1])).toBeCloseTo(
      3 * angleBetweenDeg(a, b),
      4,
    );
  });

  it("손 각도 문구", () => {
    expect(fistsLabel(1)).toBe("새끼손가락 1개 폭쯤");
    expect(fistsLabel(5.4)).toBe("손가락 세 개 폭쯤");
    expect(fistsLabel(9)).toBe("주먹 1개쯤");
    expect(fistsLabel(25.7)).toBe("주먹 2개 반쯤");
    expect(fistsLabel(28.7)).toBe("주먹 3개쯤");
  });
});

describe("밝기와 거리", () => {
  it("5등급 차이는 정확히 100배, 1등급은 약 2.512배", () => {
    expect(brightnessRatio(5)).toBeCloseTo(100, 9);
    expect(brightnessRatio(1)).toBeCloseTo(2.512, 3);
  });

  it("대기층 두께: 머리 위 1, 고도 30° 약 2, 고도 10° 약 5.6", () => {
    expect(airmass(90)).toBeCloseTo(1, 3);
    expect(airmass(30)).toBeCloseTo(2, 1);
    expect(airmass(10)).toBeCloseTo(5.6, 1);
  });

  it("고도 10°의 별은 머리 위보다 1등급 남짓(약 3배) 어둡다", () => {
    const d = extinctionMag(10) - extinctionMag(90);
    expect(d).toBeGreaterThan(1);
    expect(d).toBeLessThan(1.3);
    expect(brightnessRatio(d)).toBeCloseTo(2.9, 0);
  });

  it("센타우루스자리 알파 4.3광년, 시리우스 8.7광년, 프로키온 11.3광년 (BSC5 시차)", () => {
    const ly = (name: string) =>
      NEAR_BRIGHT_STARS.find((s) => s.name === name)!.lightYears;
    expect(ly("시리우스")).toBeCloseTo(8.7, 1);
    expect(ly("프로키온")).toBeCloseTo(11.3, 1);
    // 가장 가까운 밝은 별은 센타우루스자리 알파 (서울에서는 뜨지 않는다)
    expect(NEAR_BRIGHT_STARS[0].name).toBe("알파 센타우리");
    expect(NEAR_BRIGHT_STARS[0].lightYears).toBeCloseTo(4.3, 1);
    expect(NEAR_BRIGHT_STARS.every((s) => s.lightYears < 82)).toBe(true);
  });

  it("1파섹은 3.26광년", () => {
    expect(parallaxToLightYears(1)).toBeCloseTo(3.26, 2);
  });
});

describe("겨울 별은 정말 더 밝을까 (서울, 저녁 9시, 고도 10° 위)", () => {
  const avg = (key: string) =>
    SEASON_AVERAGES.find((s) => s.key === key)!.averages;

  it("달마다 1.5등급·2.0등급보다 밝은 별 수", () => {
    expect(MONTHLY.map((m) => m.counts[0])).toEqual([
      9, 9, 9, 10, 7, 7, 6, 5, 5, 5, 6, 7,
    ]);
    expect(MONTHLY.map((m) => m.counts[1])).toEqual([
      21, 23, 23, 23, 15, 12, 11, 10, 11, 8, 11, 16,
    ]);
  });

  it("저녁에 떠 있는 수로는 겨울과 봄이 비슷하고, 여름·가을은 그 절반쯤", () => {
    expect(avg("winter")[0]).toBeCloseTo(8.3, 1);
    expect(avg("spring")[0]).toBeCloseTo(8.7, 1);
    expect(avg("summer")[0]).toBeCloseTo(6.0, 1);
    expect(avg("autumn")[0]).toBeCloseTo(5.3, 1);
    expect(avg("winter")[1]).toBeCloseTo(20.0, 1);
    expect(avg("spring")[1]).toBeCloseTo(20.3, 1);
    expect(avg("summer")[1]).toBeCloseTo(11.0, 1);
    expect(avg("autumn")[1]).toBeCloseTo(10.0, 1);
  });

  it("그 계절 별자리 자리(자오선 ±3시간)로 세면 겨울이 가장 많다", () => {
    const n = (season: string, k: number) =>
      REGIONS.find((r) => r.season === season)!.stars[k].length;
    expect(["겨울", "봄", "여름", "가을"].map((s) => n(s, 0))).toEqual([
      6, 3, 4, 3,
    ]);
    expect(["겨울", "봄", "여름", "가을"].map((s) => n(s, 1))).toEqual([
      14, 8, 7, 3,
    ]);
  });

  it("서울에서 보이는 1.5등급보다 밝은 별 16개 중 8개가 오리온 둘레(적경 4.5h~8h)", () => {
    expect(VISIBLE).toHaveLength(16);
    expect(HEXAGON.map((s) => s.name).sort()).toEqual(
      [
        "시리우스",
        "카펠라",
        "리겔",
        "베텔게우스",
        "알데바란",
        "아다라",
        "프로키온",
        "폴룩스",
      ].sort(),
    );
  });

  it("뜨거운 별(1만 K 이상, 3등급까지)은 은하 경도 180~210°와 300~360°에 몰려 있다", () => {
    expect(HOT_HISTOGRAM).toEqual([2, 2, 3, 4, 4, 5, 9, 5, 3, 7, 10, 14]);
    const top = [...HOT_HISTOGRAM.keys()]
      .sort((a, b) => HOT_HISTOGRAM[b] - HOT_HISTOGRAM[a])
      .slice(0, 3);
    expect(top.sort((a, b) => a - b)).toEqual([6, 10, 11]);
  });

  it("오리온 허리띠는 은하 경도 180~210° 칸에 있다", () => {
    const l = vectorToGalactic(byLatin("Alnilam").vector).lDeg;
    expect(l).toBeGreaterThan(180);
    expect(l).toBeLessThan(210);
  });
});

describe("선원의 위치 찾기", () => {
  it("북극성은 천구의 북극에서 2000년 0.74°, 2026년 약 0.6°", () => {
    const p = byLatin("Polaris").vector;
    expect(90 - vectorToRaDec(p).decDeg).toBeCloseTo(0.74, 1);
    const now = j2000ToOfDate(p, julianDay(new Date(Date.UTC(2026, 0, 1))));
    expect(90 - vectorToRaDec(now).decDeg).toBeCloseTo(0.6, 1);
  });

  it("달은 별 사이를 한 시간에 약 0.55° 움직인다 (2026년 평균)", () => {
    const avg =
      Array.from({ length: 365 }, (_, d) =>
        moonHourlyMotionDeg(new Date(Date.UTC(2026, 0, 1 + d))),
      ).reduce((a, b) => a + b, 0) / 365;
    expect(avg).toBeCloseTo(0.55, 2);
  });

  it("정오의 해로 위도: 위도 = 90° − 해 높이 + 해의 적위", () => {
    for (const dec of [-23.44, 0, 23.44]) {
      const h = noonSunAltitudeDeg(SEOUL.latDeg, dec);
      expect(90 - h + dec).toBeCloseTo(SEOUL.latDeg, 9);
    }
  });
});
