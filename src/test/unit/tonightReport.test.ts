import type { Place } from "@/game/tonight/places";
import { describe, expect, it } from "vitest";
import { CITIES, placeAt, SEOUL } from "@/game/tonight/places";
import {
  altOf,
  buildReport,
  frameAt,
  MOON_HORIZON,
  moonAt,
} from "@/game/tonight/report";
import {
  clockLabel,
  isoDate,
  localToUtc,
  zoneFromLongitude,
} from "@/game/tonight/time";

// 오늘 밤 내 하늘: 시간대, 해·달이 뜨고 지는 시각, 행성, 볼 만한 것 고르기.
// 기준값은 한국천문연구원·호주 기상청 등이 펴낸 일출·일몰 표, 널리 알려진 보름·삭·행성 충의 날짜.

const city = (name: string): Place => CITIES.find((c) => c.name === name)!;
const SYDNEY = city("시드니");
const TROMSO = city("트롬쇠 (오로라)");

// "19:56" ± 분
const expectClock = (
  t: number | null,
  place: Place,
  date: string,
  hhmm: string,
  minutes: number,
) => {
  expect(t).not.toBeNull();
  expect(isoDate(t!, place.tz)).toBe(date);
  const [h, m] = hhmm.split(":").map(Number);
  const [gh, gm] = clockLabel(t!, place.tz).split(":").map(Number);

  expect(Math.abs(gh * 60 + gm - (h * 60 + m))).toBeLessThanOrEqual(minutes);
};

describe("시간대", () => {
  it("서울 정오는 UTC 3시", () => {
    expect(
      new Date(localToUtc(2026, 10, 23, 12, 0, "Asia/Seoul")).toISOString(),
    ).toBe("2026-10-23T03:00:00.000Z");
  });

  it("뉴욕은 서머타임에 따라 UTC-4·UTC-5", () => {
    const tz = "America/New_York";

    expect(new Date(localToUtc(2026, 7, 1, 12, 0, tz)).getUTCHours()).toBe(16);
    expect(new Date(localToUtc(2026, 1, 15, 12, 0, tz)).getUTCHours()).toBe(17);
  });

  it("다음 날로 넘어가는 날짜(32일)도 정상화한다", () => {
    expect(
      new Date(localToUtc(2026, 10, 32, 0, 0, "Asia/Seoul")).toISOString(),
    ).toBe("2026-10-31T15:00:00.000Z");
  });

  it("지도에서 고른 한국 땅은 경도 어림(UTC+8) 대신 서울 시간대를 쓴다", () => {
    expect(zoneFromLongitude(127)).toBe("Etc/GMT-8");
    expect(placeAt(36.5, 127.8).tz).toBe("Asia/Seoul");
    // 가까운 도시가 없는 태평양 한가운데는 경도로 어림
    expect(placeAt(-10, -140).tz).toBe("Etc/GMT+9");
  });
});

describe("해가 지고 뜨는 시각 (발표된 표와 3분 안)", () => {
  it.each([
    [SEOUL, 2024, 6, 21, "2024-06-21", "19:56", "2024-06-22", "05:11"],
    [SEOUL, 2024, 12, 21, "2024-12-21", "17:17", "2024-12-22", "07:43"],
    [SYDNEY, 2024, 12, 21, "2024-12-21", "20:05", "2024-12-22", "05:41"],
  ] as const)(
    "%s %i-%i-%i",
    (place, y, m, d, setDate, setAt, riseDate, riseAt) => {
      const r = buildReport({ place, year: y, month: m, day: d });

      expect(r.sun.mode).toBe("normal");
      expectClock(r.sun.set, place, setDate, setAt, 3);
      expectClock(r.sun.rise, place, riseDate, riseAt, 3);
      // 박명은 해 지는 시각과 천문 박명 끝 사이에 차례로
      expect(r.sun.civilDusk!).toBeGreaterThan(r.sun.set!);
      expect(r.sun.nauticalDusk!).toBeGreaterThan(r.sun.civilDusk!);
      expect(r.sun.astroDusk!).toBeGreaterThan(r.sun.nauticalDusk!);
    },
  );

  it("트롬쇠(북위 69.6°)는 하지에 백야, 동지에 극야", () => {
    expect(
      buildReport({ place: TROMSO, year: 2024, month: 6, day: 21 }).sun.mode,
    ).toBe("midnightSun");
    expect(
      buildReport({ place: TROMSO, year: 2024, month: 12, day: 21 }).sun.mode,
    ).toBe("polarNight");
  });
});

describe("달", () => {
  it("보름·삭 시각 (1시간 안): 2024-06-22 01:08 UTC 보름, 2024-10-02 18:49 UTC 삭", () => {
    const june = buildReport({ place: SEOUL, year: 2024, month: 6, day: 20 });
    const sept = buildReport({ place: SEOUL, year: 2024, month: 9, day: 25 });

    expect(
      Math.abs(june.moon.nextFull! - Date.parse("2024-06-22T01:08:00Z")),
    ).toBeLessThan(3600000);
    expect(
      Math.abs(sept.moon.nextNew! - Date.parse("2024-10-02T18:49:00Z")),
    ).toBeLessThan(3600000);
  });

  it("보름밤은 보름달, 해 질 무렵 뜨고 밤새 하늘을 밝힌다", () => {
    const r = buildReport({ place: SEOUL, year: 2024, month: 6, day: 21 });

    expect(r.moon.name).toBe("보름달");
    expect(r.moon.lit).toBeGreaterThan(0.97);
    const rise = r.moon.events.find((e) => e.rising)!;

    expect(Math.abs(rise.t - r.sun.set!)).toBeLessThan(90 * 60000);
    expect(r.moon.interference).toBeGreaterThan(0.6);
    expect(r.headline).toContain("밝은 달");
  });

  it("찾은 달 뜨고 지는 시각에 달의 고도는 지평선 기준(-0.83°)이다", () => {
    const r = buildReport({ place: SEOUL, year: 2026, month: 10, day: 23 });

    expect(r.moon.events.length).toBeGreaterThan(0);

    for (const e of r.moon.events) {
      const alt = altOf(moonAt(e.t, SEOUL), frameAt(e.t, SEOUL));

      expect(Math.abs(alt - MOON_HORIZON)).toBeLessThan(0.05);
    }
  });
});

describe("행성", () => {
  it("2026-01-10 충 무렵 목성: 밤새 보이고, 자정 무렵 남쪽 높이, 약 -2.7등급, 쌍둥이자리", () => {
    const r = buildReport({ place: SEOUL, year: 2026, month: 1, day: 10 });
    const jupiter = r.planets.find((p) => p.key === "Jupiter")!;

    expect(jupiter.visible).toBe(true);
    expect(jupiter.best!.altDeg).toBeGreaterThan(70);
    expect(jupiter.best!.azDeg).toBeGreaterThan(160);
    expect(jupiter.best!.azDeg).toBeLessThan(200);
    expect(jupiter.magnitude).toBeGreaterThan(-3);
    expect(jupiter.magnitude).toBeLessThan(-2.4);
    expect(jupiter.constellation).toBe("쌍둥이자리");
  });

  it("2026-01-06 외합 무렵 금성은 해에 묻혀 안 보인다", () => {
    const r = buildReport({ place: SEOUL, year: 2026, month: 1, day: 10 });
    const venus = r.planets.find((p) => p.key === "Venus")!;

    expect(venus.visible).toBe(false);
    expect(venus.why).toContain("해와");
  });

  it("2024-12-21 금성은 초저녁 남서쪽의 개밥바라기 (-4등급보다 밝다)", () => {
    const r = buildReport({ place: SEOUL, year: 2024, month: 12, day: 21 });
    const venus = r.planets.find((p) => p.key === "Venus")!;

    expect(venus.visible).toBe(true);
    expect(venus.magnitude).toBeLessThan(-4);
    expect(clockLabel(venus.window!.from, SEOUL.tz) < "19:00").toBe(true);
    expect(venus.best!.azDeg).toBeGreaterThan(180);
    expect(venus.best!.azDeg).toBeLessThan(270);
  });
});

describe("볼 만한 것 고르기", () => {
  it("2026-12-13 서울: 쌍둥이자리 유성우 극대 전날, 초승달이 일찍 져서 별점 5", () => {
    const r = buildReport({ place: SEOUL, year: 2026, month: 12, day: 13 });
    const gem = r.showers.find((s) => s.shower.name.startsWith("쌍둥이자리"))!;

    expect(gem).toBeDefined();
    expect(["2026-12-14", "2026-12-15"]).toContain(isoDate(gem.peak, SEOUL.tz));
    expect(gem.perHour).toBeGreaterThan(30);
    expect(r.score).toBe(5);
    expect(r.headline).toContain("별 보기 딱 좋아요");
  });

  it("활동하는 유성우가 없으면 다음 유성우를 알려 준다", () => {
    const r = buildReport({ place: SEOUL, year: 2024, month: 6, day: 21 });

    expect(r.showers).toHaveLength(0);
    expect(r.nextShower!.shower.name).toBe("남쪽 물병자리 델타 유성우");
  });

  it.each([
    [SEOUL, 2026, 1, 10, "오리온자리", "겨울 별자리"],
    [SEOUL, 2024, 6, 21, "백조자리", "여름 별자리"],
    // 남반구는 계절이 반대: 오리온은 여름 별자리
    [SYDNEY, 2024, 12, 21, "오리온자리", "여름 별자리"],
    [SYDNEY, 2025, 5, 1, "남십자자리", "가을 별자리"],
  ] as const)(
    "%s %i-%i-%i 밤 9시 하늘 한가운데: %s (%s)",
    (place, y, m, d, label, season) => {
      const r = buildReport({ place, year: y, month: m, day: d });
      const found = r.constellations.find((c) => c.label === label);

      expect(found).toBeDefined();
      expect(found!.season).toBe(season);
      expect(found!.altDeg).toBeGreaterThan(25);
    },
  );

  it("별자리 그림은 -1~1 안에 그린다", () => {
    const r = buildReport({ place: SEOUL, year: 2026, month: 1, day: 10 });

    for (const c of r.constellations) {
      for (const p of c.sketch.stars) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(1.0001);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(1.0001);
      }
    }
  });

  it("보는 시각을 새벽으로 정하면 다음 날 새벽 하늘을 본다", () => {
    const r = buildReport({
      place: SEOUL,
      year: 2026,
      month: 10,
      day: 23,
      time: "03:30",
    });

    expect(isoDate(r.viewTime, SEOUL.tz)).toBe("2026-10-24");
    expect(clockLabel(r.viewTime, SEOUL.tz)).toBe("03:30");
  });

  it("가까이 붙는 것: 2026-01-11 새벽 달이 스피카 곁 (3° 안)", () => {
    const r = buildReport({ place: SEOUL, year: 2026, month: 1, day: 10 });

    expect(
      r.tonightApproaches.some((a) => a.a === "달" && a.b === "스피카"),
    ).toBe(true);
  });
});
