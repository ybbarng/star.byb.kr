// 시드 기반 결정적 난수 생성기. 테스트 재현성을 위해 Math.random을 쓰지 않는다.

// mulberry32: 작고 품질 좋은 32비트 PRNG.
export const createRng = (seed: number): (() => number) => {
  let a = seed >>> 0;

  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// 표준정규분포 표본 (Box-Muller).
export const gaussian = (rng: () => number): number => {
  let u = 0;
  let v = 0;

  while (u === 0) {
    u = rng();
  }

  while (v === 0) {
    v = rng();
  }

  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
