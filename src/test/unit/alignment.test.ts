import { describe, expect, it } from "vitest";
import { findAlignedStars } from "@/search/utils/alignment";
import { createRng } from "@/test/synthetic/rng";

const W = 1200;
const H = 800;

describe("findAlignedStars", () => {
  it("같은 간격으로 깜빡이는 비행기 불빛(점선)을 찾는다", () => {
    const plane = Array.from({ length: 8 }, (_, i) => ({
      x: 100 + i * 30,
      y: 200 + i * 6,
    }));
    const aligned = findAlignedStars(plane, W, H);

    expect(aligned.size).toBe(8);
  });

  it("꺼진 창문 자리만큼 정수배로 벌어진 창문 줄도 찾는다", () => {
    const row = [0, 1, 2, 4, 5, 7].map((k) => ({ x: 600 + k * 12, y: 500 }));

    expect(findAlignedStars(row, W, H).size).toBe(6);
  });

  it("간격이 제멋대로인 줄은 우연으로 보고 넘긴다", () => {
    const row = [0, 13, 41, 50, 87, 95].map((t) => ({ x: 300 + t, y: 300 }));

    expect(findAlignedStars(row, W, H).size).toBe(0);
  });

  it("무작위로 흩어진 별 수백 개에서는 거의 찾지 않는다", () => {
    const rng = createRng(7);
    const stars = Array.from({ length: 300 }, () => ({
      x: rng() * W,
      y: rng() * H,
    }));

    expect(findAlignedStars(stars, W, H).size).toBeLessThan(10);
  });
});
