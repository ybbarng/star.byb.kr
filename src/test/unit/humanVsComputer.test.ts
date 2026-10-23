import type { Mat3 } from "@/search/utils/similarity";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHOICES,
  constellationShape,
  EASY_ROUNDS,
  exampleTriangle,
  FAMOUS,
  formatSeconds,
  HARD_ROUNDS,
  overlapOf,
  planGame,
  pointsFor,
  REVERSAL_ROUND,
} from "@/game/humanVsComputer/rounds";
import {
  constellationParts,
  CONSTELLATIONS,
  STARS,
  uniqueStars,
} from "@/game/sky/catalog";
import { projectVecToPhoto } from "@/search/utils/wcs";
import samples from "@/services/samples";
import poses from "@/test/real/solvedPoses.json";

const ALL = [...EASY_ROUNDS, ...HARD_ROUNDS, REVERSAL_ROUND];
const labels = new Set(CONSTELLATIONS.map((c) => c.label));
const pose = (file: string) =>
  (
    poses as unknown as Record<
      string,
      { width: number; height: number; TP: Mat3 }
    >
  )[file];

describe("사람 계산원 vs 컴퓨터: 문제", () => {
  it("반전 판 말고는 저장소 샘플이고, 정답·보기 별자리 이름이 별자리 데이터에 있다", () => {
    const files = new Set(samples.map((s) => s.src.replace("/samples/", "")));

    for (const r of ALL) {
      expect(r.reversal ? !files.has(r.file) : files.has(r.file), r.file).toBe(
        true,
      );
      expect(
        existsSync(resolve(process.cwd(), "public/samples", r.file)),
        r.file,
      ).toBe(true);
      expect(labels.has(r.answer)).toBe(true);
      expect(r.inPhoto).toContain(r.answer);
      // 반전 판에만 단서가 있다
      expect(!!r.clues).toBe(!!r.reversal);
    }

    for (const label of FAMOUS) {
      expect(labels.has(label)).toBe(true);
    }
  });

  it("정답 별자리는 정답 자세로 투영했을 때 사진 안에 별 셋 이상이 들어온다", () => {
    for (const r of [...EASY_ROUNDS, ...HARD_ROUNDS]) {
      const p = pose(r.file);
      expect(p).toBeDefined();
      const inside = uniqueStars(constellationParts(r.answer)).filter((v) => {
        const q = projectVecToPhoto(p.TP, v);

        return q && q[0] >= 0 && q[0] < p.width && q[1] >= 0 && q[1] < p.height;
      });
      expect(inside.length, r.file).toBeGreaterThanOrEqual(3);
    }
  });

  it("한 게임은 쉬운 둘 → 어려운 둘 → 반전 판, 정답이 겹치지 않고 보기는 넷", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const game = planGame(seed);
      expect(game).toHaveLength(5);
      expect(EASY_ROUNDS.some((r) => r.file === game[0].file)).toBe(true);
      expect(EASY_ROUNDS.some((r) => r.file === game[1].file)).toBe(true);
      expect(HARD_ROUNDS.some((r) => r.file === game[2].file)).toBe(true);
      expect(HARD_ROUNDS.some((r) => r.file === game[3].file)).toBe(true);
      expect(game[4].reversal).toBe(true);
      expect(new Set(game.map((r) => r.answer)).size).toBe(5);

      for (const r of game) {
        expect(r.choices).toHaveLength(CHOICES);
        expect(new Set(r.choices).size).toBe(CHOICES);
        expect(r.choices).toContain(r.answer);
        // 오답 보기는 사진에 찍히지 않은 별자리
        expect(
          r.choices.filter((c) => c !== r.answer && r.inPhoto.includes(c)),
        ).toEqual([]);
      }
    }

    expect(planGame(7)).toEqual(planGame(7));
  });

  it("보기 카드의 모양은 별자리마다 선이 있다", () => {
    for (const label of FAMOUS) {
      const shape = constellationShape(label);
      expect(shape.length).toBeGreaterThan(0);
      expect(shape.flat().every(([x, y]) => isFinite(x) && isFinite(y))).toBe(
        true,
      );
    }
  });

  it("점수는 빠를수록 높고 틀리면 깎이며 바닥이 있다", () => {
    expect(pointsFor(0, 0)).toBe(1000);
    expect(pointsFor(10, 0)).toBeLessThan(pointsFor(5, 0));
    expect(pointsFor(5, 1)).toBeLessThan(pointsFor(5, 0));
    expect(pointsFor(1000, 3)).toBe(100);
    expect(formatSeconds(420)).toBe("0.42초");
    expect(formatSeconds(12300)).toBe("12초");
  });
});

describe("사람 계산원 vs 컴퓨터: 풀이 단계 그림", () => {
  it("정답 자세로 만든 사진 별은 확인 단계에서 겹치고, 예시 삼각형이 나온다", () => {
    const p = pose("big-dipper.jpg");
    // 정답 자세로 별 지도를 사진에 투영한 것을 '찾은 별'로 본다 (밝은 순)
    const photo = STARS.filter((s) => s.mag < 4.5)
      .sort((a, b) => a.mag - b.mag)
      .map((s) => projectVecToPhoto(p.TP, s.vector))
      .filter(
        (q): q is [number, number] =>
          !!q && q[0] >= 0 && q[0] < p.width && q[1] >= 0 && q[1] < p.height,
      )
      .map(([x, y]) => ({ x, y }));
    const o = overlapOf(p.TP, photo, p.width, p.height);

    expect(o.pairs.length).toBe(photo.length);

    const t = exampleTriangle(o.pairs, p.width, p.height);
    expect(t).not.toBeNull();
    expect(t?.every((m) => m.rank < 10)).toBe(true);
  });
});
