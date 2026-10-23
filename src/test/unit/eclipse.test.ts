import { describe, expect, it } from "vitest";
import {
  chanceOf,
  closestFromSeoul,
  dayOfIso,
  findSyzygies,
  LIMITS,
  sunNodeGapDeg,
  yearSky,
  yearStartJd,
} from "@/game/eclipse/eclipse";
import {
  ECLIPSES,
  eclipsesOf,
  FIRST_YEAR,
  LAST_YEAR,
  YEARS,
} from "@/game/eclipse/eclipseList";
import {
  bestKey,
  pickYears,
  scoreYear,
  starsOf,
  togglePick,
} from "@/game/eclipse/problem";
import {
  lunarKoreaText,
  nextInKorea,
  syzygyOf,
  yearDetails,
} from "@/game/eclipse/summary";

// 식 예측하기: 손으로 옮긴 NASA 목록을 우리 계산(ephemeris.ts)으로 교차 확인하고, 문제 만들기·채점을 확인한다.
// 달 위치 오차(0.3~0.5°)를 감안해 0.35°의 여유를 둔다. 여유 안쪽(경계 근처)은 판단하지 않는다.

const MARGIN = 0.35;

const syzygiesByYear = new Map(YEARS.map((y) => [y, findSyzygies(y)]));

const syzygyFor = (date: string, kind: "solar" | "lunar") => {
  const year = Number(date.slice(0, 4));
  const start = yearStartJd(year) + dayOfIso(date);
  const want = kind === "solar" ? "new" : "full";
  const candidates = [year - 1, year, year + 1]
    .flatMap((y) => syzygiesByYear.get(y) ?? [])
    .filter((s) => s.kind === want);

  // 식이 가장 깊은 때와 삭·망은 몇 시간 안쪽이다: 그 날짜(0~24시) 앞뒤로 0.3일까지
  return candidates.find((s) => s.jd > start - 0.3 && s.jd < start + 1.3);
};

describe("우리 계산: 삭·망", () => {
  it("한 해에 삭·망이 각각 12~13번, 간격은 29.3~29.8일", () => {
    for (const year of [2000, 2017, 2026, 2035]) {
      const s = findSyzygies(year);
      const news = s.filter((x) => x.kind === "new");
      const fulls = s.filter((x) => x.kind === "full");

      for (const list of [news, fulls]) {
        expect(list.length).toBeGreaterThanOrEqual(12);
        expect(list.length).toBeLessThanOrEqual(13);

        for (let i = 1; i < list.length; i++) {
          const gap = list[i].jd - list[i - 1].jd;
          expect(gap).toBeGreaterThan(29.2);
          expect(gap).toBeLessThan(29.9);
        }
      }
    }
  });

  it("그래프 재료: 황위는 ±5.4° 안, 식 철은 한 해에 두세 번", () => {
    const sky = yearSky(2024);
    const maxLat = Math.max(...sky.samples.map((s) => Math.abs(s.moonLatDeg)));
    expect(maxLat).toBeGreaterThan(4.8);
    expect(maxLat).toBeLessThan(5.5);
    expect(sky.seasons.length).toBeGreaterThanOrEqual(2);
    expect(sky.seasons.length).toBeLessThanOrEqual(3);
  });
});

describe("NASA 목록 교차 확인", () => {
  it(`목록은 ${FIRST_YEAR}~${LAST_YEAR}년, 날짜 형식이 맞고 겹치지 않는다`, () => {
    const seen = new Set<string>();

    for (const e of ECLIPSES) {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const y = Number(e.date.slice(0, 4));
      expect(y).toBeGreaterThanOrEqual(FIRST_YEAR);
      expect(y).toBeLessThanOrEqual(LAST_YEAR);
      expect(seen.has(e.date)).toBe(false);
      seen.add(e.date);
    }
  });

  it("해마다 일식 2~5번, 월식 2~5번, 합해 4~7번", () => {
    for (const y of YEARS) {
      const list = eclipsesOf(y);
      const solar = list.filter((e) => e.kind === "solar").length;
      const lunar = list.length - solar;
      expect(solar, `${y} 일식`).toBeGreaterThanOrEqual(2);
      expect(solar, `${y} 일식`).toBeLessThanOrEqual(5);
      expect(lunar, `${y} 월식`).toBeGreaterThanOrEqual(2);
      expect(lunar, `${y} 월식`).toBeLessThanOrEqual(5);
      expect(list.length).toBeGreaterThanOrEqual(4);
      expect(list.length).toBeLessThanOrEqual(7);
    }
  });

  it("일식은 그날이 삭, 월식은 그날이 망", () => {
    const bad = ECLIPSES.filter((e) => !syzygyFor(e.date, e.kind)).map(
      (e) => `${e.date} ${e.kind}`,
    );
    expect(bad).toEqual([]);
  });

  it("그때 달은 교점 근처: 황위가 그 식이 날 수 있는 범위 안", () => {
    const bad: string[] = [];

    for (const e of ECLIPSES) {
      const s = syzygyFor(e.date, e.kind)!;
      const b = Math.abs(s.moonLatDeg);
      const max =
        e.kind === "solar"
          ? LIMITS.solarMax
          : e.type === "penumbral"
            ? LIMITS.penumbralMax
            : LIMITS.umbralMax;

      if (b > max + MARGIN) {
        bad.push(`${e.date} 황위 ${b.toFixed(2)}° > ${max}°`);
      }

      // 반영식인데 황위가 아주 작으면 본영식이었을 것이다
      if (e.kind === "lunar" && e.type === "penumbral") {
        if (b < LIMITS.umbralSure - MARGIN) {
          bad.push(`${e.date} 반영식인데 황위 ${b.toFixed(2)}°`);
        }
      }
    }

    expect(bad).toEqual([]);
  });

  it("빠진 식이 없다: 황위가 확실히 식이 나는 범위인 삭·망은 모두 목록에 있다", () => {
    const listed = new Set(ECLIPSES.map((e) => e.date));
    const missing: string[] = [];

    for (const y of YEARS) {
      for (const s of syzygiesByYear.get(y)!) {
        const sure = s.kind === "new" ? LIMITS.solarSure : LIMITS.penumbralSure;

        if (Math.abs(s.moonLatDeg) < sure - MARGIN) {
          // 식 날짜(세계시)는 삭·망과 하루 안쪽
          const near = [-1, 0, 1].some((k) =>
            listed.has(
              new Date((s.jd - 2440587.5 + k) * 86400000)
                .toISOString()
                .slice(0, 10),
            ),
          );

          if (!near) {
            missing.push(`${s.date} ${s.kind} ${s.moonLatDeg.toFixed(2)}°`);
          }
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("식은 해가 교점 근처일 때(식 철)에만", () => {
    for (const e of ECLIPSES) {
      const s = syzygyFor(e.date, e.kind)!;
      // 평균 교점은 실제 교점과 1.7°까지 다르다. 식이 날 수 있는 한계 18.5°에 여유를 둔다
      expect(sunNodeGapDeg(s.jd), e.date).toBeLessThan(20.5);
    }
  });

  it("한국에서 보인다고 적은 일식은 서울에서 해와 달이 겹치고 해가 떠 있다", () => {
    const korea = ECLIPSES.filter((e) => e.kind === "solar" && e.korea);
    expect(korea.length).toBeGreaterThanOrEqual(5);

    for (const e of korea) {
      const c = closestFromSeoul(syzygyFor(e.date, "solar")!.jd);
      // 해·달 반지름 합은 0.49~0.55°
      expect(c.sepDeg, e.date).toBeLessThan(0.55 + MARGIN);
      expect(c.sunAltDeg, e.date).toBeGreaterThan(0);
    }
  });
});

describe("문제와 채점", () => {
  it("한 판의 해는 서로 다르고 목록 안이며, 같은 시드면 같다", () => {
    for (let seed = 1; seed < 40; seed++) {
      const ys = pickYears(seed);
      expect(new Set(ys).size).toBe(ys.length);
      expect(ys.every((y) => YEARS.includes(y))).toBe(true);
      expect(pickYears(seed)).toEqual(ys);
    }
  });

  it("실제 식을 모두 맞히면 1000점, 하루 차이도 맞음, 종류가 다르면 틀림", () => {
    const list = eclipsesOf(2024);
    const all = list.map((e) => ({ kind: e.kind, day: dayOfIso(e.date) }));
    expect(scoreYear(2024, all).points).toBe(1000);
    expect(scoreYear(2024, all).missed).toEqual([]);

    const shifted = all.map((p) => ({ ...p, day: p.day + 1 }));
    expect(scoreYear(2024, shifted).points).toBe(1000);

    const swapped = all.map((p) => ({
      ...p,
      kind: p.kind === "solar" ? ("lunar" as const) : ("solar" as const),
    }));
    expect(scoreYear(2024, swapped).hits).toBe(0);
    expect(scoreYear(2024, swapped).points).toBe(0);
  });

  it("없는 식을 고르면 깎이고, 한 식을 두 번 골라도 한 번만 센다", () => {
    const e = eclipsesOf(2026);
    const one = { kind: e[0].kind, day: dayOfIso(e[0].date) };
    const base = scoreYear(2026, [one]);
    expect(base.points).toBe(250); // 2026년은 식 넷
    const withFalse = scoreYear(2026, [one, { kind: "solar", day: 100 }]);
    expect(withFalse.falses).toBe(1);
    expect(withFalse.points).toBe(125);
    const twice = scoreYear(2026, [one, { ...one, day: one.day + 1 }]);
    expect(twice.hits).toBe(1);
    expect(scoreYear(2026, []).points).toBe(0);
  });

  it("삭·망을 황위로만 골라도(입문의 규칙) 대부분 맞는다", () => {
    let total = 0;

    for (const y of YEARS) {
      const picks = syzygiesByYear
        .get(y)!
        .filter((s) => chanceOf(s.moonLatDeg) !== "none")
        .map((s) => ({
          kind: s.kind === "new" ? ("solar" as const) : ("lunar" as const),
          day: s.day,
        }));
      total += scoreYear(y, picks).points;
    }

    expect(total / YEARS.length).toBeGreaterThan(700);
  });

  it("고르기를 다시 누르면 지워진다", () => {
    const a = togglePick([], { kind: "solar", day: 10 });
    expect(a).toHaveLength(1);
    expect(togglePick(a, { kind: "solar", day: 11 })).toHaveLength(0);
    expect(togglePick(a, { kind: "lunar", day: 10 })).toHaveLength(2);
  });

  it("별점과 기록 키", () => {
    expect(starsOf(3000)).toBe(3);
    expect(starsOf(1500)).toBe(2);
    expect(starsOf(10)).toBe(1);
    expect(starsOf(0)).toBe(0);
    expect(bestKey("intro")).toBe("eclipse-intro");
  });
});

describe("결과 화면 풀이", () => {
  it("그해 식은 모두 그래프의 식 철 띠 안(하루 여유)에 있다", () => {
    const outside: string[] = [];

    for (const y of YEARS) {
      const sky = yearSky(y);

      for (const e of eclipsesOf(y)) {
        const d = dayOfIso(e.date);
        const inside = sky.seasons.some(
          (s) => d >= s.startDay - 1 && d <= s.endDay + 1,
        );

        if (!inside) {
          outside.push(e.date);
        }
      }
    }

    expect(outside).toEqual([]);
  });

  it("식마다 짝이 되는 삭·망을 찾고, 월식은 보이는 쪽을 계산한다", () => {
    const syz = findSyzygies(2026);
    const details = yearDetails(2026, syz);
    expect(details).toHaveLength(4);
    expect(details.every((d) => d.syzygy !== null)).toBe(true);
    expect(details.every((d) => d.where !== null)).toBe(true);
  });

  it("월식이 한국에서 보이는지: 2026-03-03 개기월식은 저녁에 보이고, 2026-08-28은 낮이라 안 보인다", () => {
    const syz = findSyzygies(2026);
    const at = (date: string) =>
      syzygyOf(ECLIPSES.find((e) => e.date === date)!, syz)!.jd;
    expect(lunarKoreaText(at("2026-03-03"))).toBe("한국에서 보여요");
    expect(lunarKoreaText(at("2026-08-28"))).toBe("한국은 낮이라 안 보여요");
  });

  it("다음에 한국에서 보이는 식: 오늘 뒤, 날짜 순, 2030-06-01 부분일식과 2028-12-31 개기월식이 들어 있다", () => {
    const list = nextInKorea("2026-10-23", 10);
    const dates = list.map((d) => d.record.date);
    expect(dates.every((d) => d > "2026-10-23")).toBe(true);
    expect([...dates].sort()).toEqual(dates);
    expect(dates).toContain("2030-06-01");
    expect(dates).toContain("2028-12-31");
  });
});
