import { describe, expect, it } from "vitest";
import { ZODIAC } from "@/game/birthday/zodiac";
import {
  cardQuestion,
  dailyQuestion,
  deckIds,
  relationBank,
  relationRound,
  relationVectors,
  zodiacOrderQuestion,
} from "@/game/starSchool/quiz";
import {
  altAzAt,
  dateAt,
  observerOf,
  sunAltAt,
  timeLabel,
} from "@/game/starSchool/skyMath";
import { createRng } from "@/utils/rng";

// 별자리 익히기 문제: 보기·하늘 장면·오늘의 문제가 바르게 만들어지는지.

describe("카드 연습 문제", () => {
  it("보기 넷에 정답이 들어 있고, 같은 종류(별자리끼리·길잡이끼리)만 섞는다", () => {
    for (const deck of ["famous", "asterisms"] as const) {
      const ids = deckIds(deck);

      for (const id of ids) {
        for (const box of [1, 2, 3]) {
          const q = cardQuestion(id, box, ids, createRng(box));

          if (q.kind === "draw") continue;

          expect(q.choices).toHaveLength(4);
          expect(new Set(q.choices).size).toBe(4);
          expect(q.choices).toContain(id);
          expect(q.choices.every((c) => c.slice(0, 2) === id.slice(0, 2))).toBe(
            true,
          );
        }
      }
    }
  });

  it("상자 칸이 오를수록 선이 흐려진다 (1칸 선 → 3칸 흐린 선 → 5칸 별만)", () => {
    const ids = deckIds("famous");

    const levelAt = (box: number) => {
      const q = cardQuestion("c:사자자리", box, ids, createRng(7));

      return q.kind === "draw" ? "stars" : q.level;
    };

    expect(levelAt(1)).toBe("lines");
    expect(levelAt(3)).toBe("faint");
    expect(levelAt(5)).toBe("stars");
  });

  it("덱: 유명한 15, 맨눈 30, 88 전부", () => {
    expect(deckIds("famous")).toHaveLength(15);
    expect(deckIds("nakedEye")).toHaveLength(30);
    expect(deckIds("all")).toHaveLength(88);
  });
});

describe("관계 맞히기 하늘", () => {
  it.each(relationBank().map((q) => [q.key, q] as const))(
    "%s: 고른 시각엔 해가 −12° 아래, 다루는 것이 모두 15° 넘게 떠 있다",
    (_, q) => {
      if (q.kind === "order") return;

      const date = dateAt(q.scene.place, q.scene.time);
      const observer = observerOf(q.scene.place);

      expect(sunAltAt(date, observer)).toBeLessThan(-12);

      for (const v of relationVectors(q)) {
        expect(altAzAt(v, date, observer).altDeg).toBeGreaterThan(15);
      }
    },
  );

  it("문제 열쇠가 겹치지 않는다", () => {
    const keys = relationBank().map((q) => q.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("고르기 문제의 정답 번호가 보기를 가리킨다", () => {
    for (const q of relationBank()) {
      if (q.kind === "choice") {
        expect(q.choices[q.answer]).toBeDefined();
      }
    }
  });

  it("한 판: 남반구가 닫혀 있으면 남반구 문제를 내지 않고, 황도 순서 문제가 하나 들어간다", () => {
    const round = relationRound(42, 8, false);

    expect(round).toHaveLength(8);
    expect(round.some((q) => q.south)).toBe(false);
    expect(round.filter((q) => q.kind === "order")).toHaveLength(1);
  });

  it("황도 순서 문제는 해가 지나는 차례대로 연달아 있는 넷", () => {
    const labels = ZODIAC.map((z) => z.label);

    for (let seed = 1; seed < 30; seed++) {
      const q = zodiacOrderQuestion(createRng(seed));

      if (q.kind !== "order") throw new Error("순서 문제가 아니다");

      const i = labels.indexOf(q.items[0]);

      q.items.forEach((item, k) =>
        expect(item).toBe(labels[(i + k) % labels.length]),
      );
    }
  });
});

describe("오늘의 하늘 문제", () => {
  it("같은 날이면 같은 문제, 날마다 바뀐다", () => {
    expect(dailyQuestion("2026-10-23")).toEqual(dailyQuestion("2026-10-23"));

    const keys = new Set(
      Array.from({ length: 14 }, (_, i) =>
        dailyQuestion(`2026-11-${String(i + 1).padStart(2, "0")}`),
      ).map((q) => JSON.stringify(q)),
    );

    expect(keys.size).toBeGreaterThan(7);
  });

  it("남반구 문제는 오늘의 문제로 내지 않는다", () => {
    for (let d = 1; d <= 28; d++) {
      expect(dailyQuestion(`2026-02-${String(d).padStart(2, "0")}`).south).toBe(
        false,
      );
    }
  });
});

describe("시각 말", () => {
  it("저녁·밤·새벽", () => {
    expect(timeLabel({ y: 2026, m: 5, d: 15, h: 20, min: 0 })).toBe(
      "5월 15일 저녁 8시",
    );
    expect(timeLabel({ y: 2026, m: 5, d: 15, h: 21, min: 30 })).toBe(
      "5월 15일 밤 9시 30분",
    );
    expect(timeLabel({ y: 2026, m: 5, d: 16, h: 0, min: 0 })).toBe(
      "5월 16일 밤 12시",
    );
    expect(timeLabel({ y: 2026, m: 5, d: 16, h: 2, min: 0 })).toBe(
      "5월 16일 새벽 2시",
    );
  });
});
