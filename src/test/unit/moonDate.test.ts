import { describe, expect, it } from "vitest";
import {
  candidateDays,
  constellationChoices,
  dayLabel,
  dayOfYear,
  explainMoonDate,
  localMoment,
  makeMoonProblem,
  moonInPhoto,
  moonState,
  passesThrough,
  PLACES,
  scoreMoonDate,
  shapeOf,
  SLOTS,
  yearTable,
} from "@/game/moonDate/moonDate";

// 달로 날짜 맞히기: 달 모양·자리 계산이 알려진 날과 맞는지, 문제가 조건대로 나오는지, 채점·풀이 설명.
const SEOUL = PLACES[1];

describe("달 모양", () => {
  it("위상각을 일곱 모양으로 나눈다", () => {
    expect(shapeOf(5)).toBe("new");
    expect(shapeOf(40)).toBe("waxingCrescent");
    expect(shapeOf(90)).toBe("firstQuarter");
    expect(shapeOf(130)).toBe("waxingGibbous");
    expect(shapeOf(180)).toBe("full");
    expect(shapeOf(230)).toBe("waningGibbous");
    expect(shapeOf(270)).toBe("lastQuarter");
    expect(shapeOf(320)).toBe("waningCrescent");
    expect(shapeOf(355)).toBe("new");
  });

  // 2025년 10월의 삭·상현·망 (한국천문연구원 역서: 삭 10/21 21:25, 상현 10/30 01:21, 망 10/7 12:47 KST)
  it.each([
    ["2025-10-07T03:47:00Z", 180],
    ["2025-10-21T12:25:00Z", 0],
    ["2025-10-29T16:21:00Z", 90],
  ])("%s 위상각 ≈ %i°", (iso, want) => {
    const s = moonState(new Date(iso), SEOUL.observer);
    const diff = ((s.phaseDeg - want + 540) % 360) - 180;

    // 관측지에서 본 달(시차 최대 1°)과 공식 오차(약 0.3°)를 합쳐 2° 안
    expect(Math.abs(diff)).toBeLessThan(2);
  });

  it("삭 나흘 뒤 해 진 직후의 초승달은 서쪽 하늘에 낮게", () => {
    const s = moonState(
      localMoment(2025, dayOfYear(2025, 9, 25), 18.5, 9),
      SEOUL.observer,
    );

    expect(s.shape).toBe("waxingCrescent");
    expect(s.waxing).toBe(true);
    expect(s.moonAltDeg).toBeGreaterThan(0);
    expect(s.moonAltDeg).toBeLessThan(25);
    expect(s.moonAzDeg).toBeGreaterThan(200);
    expect(s.moonAzDeg).toBeLessThan(280);
  });
});

describe("그해 날마다의 달", () => {
  const table = yearTable(2026, SEOUL, 21);

  it("하루에 약 13°씩 동쪽으로 옮긴다 (위상각이 하루 12.2°씩 커진다)", () => {
    const steps = table
      .slice(1)
      .map((d, i) => (d.phaseDeg - table[i].phaseDeg + 360) % 360);
    const mean = steps.reduce((a, b) => a + b, 0) / steps.length;

    expect(mean).toBeCloseTo(360 / 29.53, 0);
  });

  it("황도 별자리는 1년에 13~14번 지나간다 (27.3일 주기)", () => {
    for (const c of ["사자자리", "황소자리", "궁수자리"]) {
      const n = passesThrough(table, c).length;

      expect(n).toBeGreaterThanOrEqual(12);
      expect(n).toBeLessThanOrEqual(15);
    }
  });

  it("모양과 별자리가 둘 다 맞는 날은 1년에 몇 날뿐", () => {
    const day = 200;
    const d = table[day];
    const days = candidateDays(table, d.shape, d.constellation);

    expect(days).toContain(day);
    expect(days.length).toBeLessThanOrEqual(6);
  });
});

describe("문제 만들기", () => {
  it.each(["intro", "easy", "normal"] as const)(
    "%s: 같은 시드면 같은 문제, 조건을 지킨다",
    (difficulty) => {
      for (let seed = 1; seed <= 8; seed++) {
        const p = makeMoonProblem(seed * 7919, difficulty);
        const again = makeMoonProblem(seed * 7919, difficulty);

        expect(again.date.getTime()).toBe(p.date.getTime());
        expect(p.state.shape).not.toBe("new");
        expect(p.state.sunAltDeg).toBeLessThan(-12);
        expect(p.state.moonAltDeg).toBeGreaterThan(5);

        const [h0, h1] = SLOTS[p.slot].hours;
        expect(p.hours).toBeGreaterThanOrEqual(h0);
        expect(p.hours).toBeLessThanOrEqual(h1);

        // 달이 사진 안에 있다
        const m = moonInPhoto(p);
        expect(m).not.toBeNull();
        expect(m!.at[0]).toBeGreaterThan(0);
        expect(m!.at[0]).toBeLessThan(p.width);
        expect(m!.at[1]).toBeGreaterThan(0);
        expect(m!.at[1]).toBeLessThan(p.height);

        if (difficulty !== "normal") {
          expect(p.place.tz).toBe(9);
        }
      }
    },
  );

  it("그날 그 시각의 표와 문제의 달이 같고, 후보 날에 정답이 들어 있다", () => {
    const p = makeMoonProblem(4242, "intro");
    const table = yearTable(p.year, p.place, p.hours);

    expect(table[p.day].constellation).toBe(p.state.constellation);
    expect(table[p.day].shape).toBe(p.state.shape);
    expect(
      candidateDays(table, p.state.shape, p.state.constellation),
    ).toContain(p.day);

    const choices = constellationChoices(table, p);
    expect(choices).toContain(p.state.constellation);
    expect(new Set(choices).size).toBe(choices.length);
    expect(choices.length).toBeGreaterThanOrEqual(3);
  });
});

describe("채점과 풀이", () => {
  const p = makeMoonProblem(99, "easy");

  it("날짜 차이가 클수록 점수가 줄어든다", () => {
    expect(scoreMoonDate(p, p.day).points).toBe(1000);
    expect(scoreMoonDate(p, p.day + 1).points).toBe(819);
    expect(scoreMoonDate(p, p.day - 3).points).toBe(549);
    expect(scoreMoonDate(p, p.day + 30).points).toBeLessThan(5);
    expect(scoreMoonDate(p, p.day, 0.3).points).toBe(700);
    expect(scoreMoonDate(p, p.day + 2).diffDays).toBe(2);
  });

  it("풀이: 정답 날이 든 지나감이 있고, 해는 그 무렵 그 별자리에 있다", () => {
    const table = yearTable(p.year, p.place, p.hours);
    const ex = explainMoonDate(p, table);

    expect(ex.answerPass).toBeGreaterThanOrEqual(0);
    expect(ex.sameShapePasses).toBeGreaterThanOrEqual(1);
    expect(ex.sameShapePasses).toBeLessThanOrEqual(3);
    // 해의 별자리 구간 하나가 정답 날 근처(하루 오차)에 걸친다
    expect(
      ex.sunRanges.some(([a, b]) => a - 1 <= p.day && p.day <= b + 1),
    ).toBe(true);
  });

  it("날짜 글자", () => {
    expect(dayLabel(2026, 0)).toBe("1월 1일");
    expect(dayLabel(2026, dayOfYear(2026, 9, 23))).toBe("10월 23일");
  });
});
