import { describe, expect, it } from "vitest";
import {
  BOX_DAYS,
  dayNumber,
  isDue,
  lineLevel,
  pickCards,
  review,
  revengeIds,
} from "@/game/starSchool/leitner";
import {
  answerCard,
  answerDaily,
  comboMultiplier,
  dailyStreak,
  emptySave,
  finishLesson,
  markMissed,
  rankOf,
  RANKS,
  saveBestRecord,
  XP,
} from "@/game/starSchool/progress";

// 별자리 익히기의 복습 일정(라이트너 상자)과 경험치 규칙.

const TODAY = dayNumber(new Date(2026, 9, 23));

describe("라이트너 상자", () => {
  it("맞히면 한 칸씩 올라가며 다음 복습이 1·3·7·16일 뒤로 밀린다", () => {
    let c = review(undefined, true, TODAY);

    expect(c.box).toBe(2);
    expect(c.due).toBe(TODAY + BOX_DAYS[1]);

    for (const box of [3, 4, 5]) {
      c = review(c, true, TODAY);
      expect(c.box).toBe(box);
      expect(c.due).toBe(TODAY + BOX_DAYS[box - 1]);
    }

    c = review(c, true, TODAY);
    expect(c.box).toBe(5);
  });

  it("틀리면 첫 칸으로 돌아와 오늘 다시 나온다", () => {
    let c = review(undefined, true, TODAY);
    c = review(c, true, TODAY);
    c = review(c, false, TODAY);

    expect(c.box).toBe(1);
    expect(c.due).toBe(TODAY);
    expect(c.misses).toBe(1);
    expect(c.missedLast).toBe(true);
    expect(isDue(c, TODAY)).toBe(true);
  });

  it("오늘 낼 카드: 날짜가 된 카드(낮은 칸 먼저) → 새 카드 → 아직 이른 카드", () => {
    const cards = {
      a: { box: 3, due: TODAY - 1, right: 2, misses: 0, missedLast: false },
      b: { box: 1, due: TODAY, right: 0, misses: 1, missedLast: true },
      c: { box: 4, due: TODAY + 5, right: 3, misses: 0, missedLast: false },
    };

    expect(pickCards(["a", "b", "c", "d", "e"], cards, TODAY, 4)).toEqual([
      "b",
      "a",
      "d",
      "e",
    ]);
    expect(pickCards(["a", "c"], cards, TODAY, 5)).toEqual(["a", "c"]);
  });

  it("선은 익숙해질수록 흐려진다: 1~2칸 선, 3칸 흐린 선, 4~5칸 별만", () => {
    const at = (box: number) =>
      lineLevel({ box, due: 0, right: 0, misses: 0, missedLast: false });

    expect(lineLevel(undefined)).toBe("lines");
    expect([1, 2, 3, 4, 5].map(at)).toEqual([
      "lines",
      "lines",
      "faint",
      "stars",
      "stars",
    ]);
  });

  it("복수전 목록: 틀린 적 있고 아직 낮은 칸이거나 마지막에 틀린 카드, 많이 틀린 것 먼저", () => {
    const cards = {
      a: { box: 1, due: TODAY, right: 0, misses: 1, missedLast: true },
      b: { box: 2, due: TODAY, right: 1, misses: 3, missedLast: false },
      c: { box: 5, due: TODAY, right: 5, misses: 1, missedLast: false },
      d: { box: 2, due: TODAY, right: 1, misses: 0, missedLast: false },
    };

    expect(revengeIds(cards)).toEqual(["b", "a"]);
  });

  it("날짜는 그 지역 날짜로 센다 (같은 날이면 같은 수)", () => {
    expect(dayNumber(new Date(2026, 9, 23, 0, 5))).toBe(
      dayNumber(new Date(2026, 9, 23, 23, 55)),
    );
    expect(dayNumber(new Date(2026, 9, 24, 0, 5))).toBe(TODAY + 1);
  });
});

describe("경험치", () => {
  it("전에 틀린 카드를 다시 맞히면 더 많이 받는다 (복수 성공)", () => {
    const missed = markMissed(emptySave(), "c:오리온자리", TODAY);
    const revenge = answerCard(missed, "c:오리온자리", true, TODAY, 1);
    const plain = answerCard(emptySave(), "c:오리온자리", true, TODAY, 1);

    expect(revenge.revenge).toBe(true);
    expect(plain.revenge).toBe(false);
    expect(revenge.gained).toBe(XP.revenge);
    expect(plain.gained).toBe(XP.correct);
    expect(revenge.gained).toBeGreaterThan(plain.gained);
  });

  it("맞힌 카드는 도감에 열리고, 틀린 답은 경험치가 없다", () => {
    const right = answerCard(emptySave(), "c:사자자리", true, TODAY, 1);
    const wrong = answerCard(emptySave(), "c:사자자리", false, TODAY, 1);

    expect(right.save.learned).toContain("c:사자자리");
    expect(wrong.gained).toBe(0);
    expect(wrong.save.learned).not.toContain("c:사자자리");
  });

  it("연달아 맞히면 10%씩 더, 두 배까지", () => {
    expect(comboMultiplier(1)).toBe(1);
    expect(comboMultiplier(3)).toBeCloseTo(1.2);
    expect(comboMultiplier(30)).toBe(2);
  });

  it("수업은 처음 마칠 때 크게, 다시 마치면 조금", () => {
    const first = finishLesson(emptySave(), "spring", 2, ["c:목동자리"]);
    const again = finishLesson(first.save, "spring", 1, ["c:목동자리"]);

    expect(first.gained).toBe(XP.lessonFirst + 2 * XP.quizCorrect);
    expect(again.gained).toBe(XP.lessonAgain + XP.quizCorrect);
    expect(again.save.lessons.spring.quiz).toBe(2);
    expect(first.save.learned).toContain("c:목동자리");
  });

  it("오늘의 문제는 하루 한 번만 경험치를 준다", () => {
    const a = answerDaily(emptySave(), "2026-10-23", true);
    const b = answerDaily(a.save, "2026-10-23", true);

    expect(a.gained).toBe(XP.daily);
    expect(b.gained).toBe(0);
  });

  it("오늘의 문제를 연달아 푼 날 수", () => {
    const daily = {
      "2026-10-21": true,
      "2026-10-22": false,
      "2026-10-23": true,
    };

    expect(dailyStreak(daily, new Date(2026, 9, 23, 20))).toBe(3);
    // 오늘 아직 안 풀었으면 어제까지 센다
    expect(dailyStreak(daily, new Date(2026, 9, 24, 8))).toBe(3);
    expect(dailyStreak(daily, new Date(2026, 9, 26, 8))).toBe(0);
  });

  it("별지기 등급: 맨눈 → 쌍안경 → 망원경 → 천문대", () => {
    expect(RANKS.map((r) => r.title)).toEqual([
      "맨눈 별지기",
      "쌍안경 별지기",
      "망원경 별지기",
      "천문대 별지기",
    ]);
    expect(rankOf(0).rank.title).toBe("맨눈 별지기");
    expect(rankOf(RANKS[1].minXp).rank.title).toBe("쌍안경 별지기");
    expect(rankOf(RANKS[1].minXp - 1).progress).toBeLessThan(1);
    expect(rankOf(99999).next).toBeNull();
  });

  it("최고 기록은 더 좋을 때만 바뀐다", () => {
    const a = saveBestRecord(emptySave(), "timeAttack", 12);
    const b = saveBestRecord(a.save, "timeAttack", 9);

    expect(a.isNew).toBe(true);
    expect(b.isNew).toBe(false);
    expect(b.save.best.timeAttack).toBe(12);
  });
});
