import { describe, expect, it } from "vitest";
import { poissonTailNegLog10 } from "@/search/utils/stats";

// 정의대로 P(X >= k) = 1 - Σ_{i<k} e^-λ λ^i / i! 를 직접 계산한 값
const naiveTail = (k: number, lambda: number): number => {
  let term = Math.exp(-lambda);
  let cdf = 0;

  for (let i = 0; i < k; i++) {
    cdf += term;
    term *= lambda / (i + 1);
  }

  return 1 - cdf;
};

describe("poissonTailNegLog10", () => {
  it("k가 0 이하면 확률 1 (값 0)", () => {
    expect(poissonTailNegLog10(0, 1.5)).toBe(0);
  });

  it("정의대로 계산한 꼬리확률과 같다", () => {
    for (const [k, lambda] of [
      [1, 0.5],
      [3, 1],
      [5, 2.3],
      [8, 0.8],
    ]) {
      expect(poissonTailNegLog10(k, lambda)).toBeCloseTo(
        -Math.log10(naiveTail(k, lambda)),
        6,
      );
    }
  });

  it("아주 작은 꼬리확률도 무너지지 않는다 (1 - cdf로는 0이 되는 경우)", () => {
    // λ=0.2에서 40개 이상: 약 10^-77. 1 - cdf는 부동소수점에서 0이 된다.
    const v = poissonTailNegLog10(40, 0.2);

    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThan(70);
    expect(v).toBeLessThan(80);
  });

  it("k가 클수록 우연일 확률이 작아진다", () => {
    expect(poissonTailNegLog10(10, 1)).toBeGreaterThan(
      poissonTailNegLog10(8, 1),
    );
  });
});
