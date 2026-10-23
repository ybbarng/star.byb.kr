import type { Point2D } from "@/scripts/hash/types";

// 별 넷 지문 맞추기 (docs/game-plans.md 5)의 계산: quad 지문을 읽는 모든 방법.
//
// 풀이의 calculateHash(src/scripts/hash/hash.ts) 규칙:
//   ① 가장 먼 두 별 A·B를 고른다 ② A를 (0,0), B를 (1,1)에 놓도록 옮기고·돌리고·늘린다 (뒤집지는 않는다)
//   ③ 나머지 둘 중 x가 작은 것이 C, 큰 것이 D ④ C·D의 x 합이 1보다 크면 A·B를 바꾼다
//      (A·B를 바꾸면 모든 점이 (0.5, 0.5)를 중심으로 반 바퀴 돌아 (x, y) → (1-x, 1-y)가 된다)
// 지문은 [Cx, Cy, Dx, Dy].
//
// 같은 배치가 지문을 둘 이상 가질 수 있는 경우 (규칙의 경계에 걸릴 때):
//   - 가장 먼 쌍이 둘 이상 (거리가 같거나 거의 같다) → 축을 어느 쌍으로 잡느냐에 따라 전혀 다른 값
//   - C·D의 x가 같다 → C·D 순서가 둘
//   - C·D의 x 합이 정확히 1 → A·B 방향이 둘
// 셋 다 별의 위치가 조금만 흔들려도 calculateHash가 다른 쪽을 고르니, 사람에게는 모두 정답이다.
// 사람은 또 A·B 방향을 거꾸로 잡거나(④를 건너뜀) C·D를 바꿔 찍을 수 있다 — 같은 모양이니 정답으로 친다.

export type Fingerprint = [number, number, number, number];

export interface Reading {
  axis: [number, number]; // A·B (points의 번호)
  rest: [number, number]; // C·D
  hash: Fingerprint;
}

const EPS = 1e-9;

const dist2 = (p: Point2D, q: Point2D) =>
  (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;

// A를 (0,0), B를 (1,1)로 보내는 닮음변환 (복소수로 (p - a) / (b - a) × (1 + i))
export const axisTransform = (a: Point2D, b: Point2D) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d2 = dx * dx + dy * dy;

  return (p: Point2D): Point2D => {
    const px = p[0] - a[0];
    const py = p[1] - a[1];
    const re = (px * dx + py * dy) / d2;
    const im = (py * dx - px * dy) / d2;

    return [re - im, re + im];
  };
};

/**
 * 축으로 삼을 만한 쌍마다 양쪽 방향으로 읽은 지문 전부 (C·D는 x 순서, x가 같으면 두 순서 모두).
 * @param axisTolerance 가장 먼 거리보다 이 비율만큼 짧은 쌍까지 축으로 본다 (0이면 가장 먼 쌍만, 같은 거리는 모두)
 */
export const readingsOf = (points: Point2D[], axisTolerance = 0): Reading[] => {
  let max = 0;

  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      max = Math.max(max, dist2(points[i], points[j]));
    }
  }

  const minLen = Math.sqrt(max) * (1 - axisTolerance) * (1 - EPS);
  const out: Reading[] = [];

  for (let a = 0; a < 4; a++) {
    for (let b = 0; b < 4; b++) {
      if (a === b || Math.sqrt(dist2(points[a], points[b])) < minLen) {
        continue;
      }

      const t = axisTransform(points[a], points[b]);
      const [k, l] = [0, 1, 2, 3].filter((i) => i !== a && i !== b);
      const [pk, pl] = [t(points[k]), t(points[l])];
      const orders: [number, number][] =
        Math.abs(pk[0] - pl[0]) < 1e-6
          ? [
              [k, l],
              [l, k],
            ]
          : pk[0] < pl[0]
            ? [[k, l]]
            : [[l, k]];

      for (const [c, d] of orders) {
        const [pc, pd] = c === k ? [pk, pl] : [pl, pk];
        out.push({ axis: [a, b], rest: [c, d], hash: [...pc, ...pd] });
      }
    }
  }

  return out;
};

// calculateHash의 ④를 지킨 읽기인가 (x 합이 1 이하)
export const isCanonical = (r: Reading) => r.hash[0] + r.hash[2] <= 1 + 1e-6;

// C·D 순서를 따지지 않은 두 지문의 거리 (두 점 거리의 평균, 더 잘 맞는 짝으로)
export const fingerprintDistance = (f: Fingerprint, g: Fingerprint) => {
  const d = (x1: number, y1: number, x2: number, y2: number) =>
    Math.hypot(x1 - x2, y1 - y2);
  const same = (d(f[0], f[1], g[0], g[1]) + d(f[2], f[3], g[2], g[3])) / 2;
  const swapped = (d(f[0], f[1], g[2], g[3]) + d(f[2], f[3], g[0], g[1])) / 2;

  return Math.min(same, swapped);
};

const dedupe = (hashes: Fingerprint[]) => {
  const out: Fingerprint[] = [];

  for (const h of hashes) {
    if (!out.some((o) => o.every((v, i) => Math.abs(v - h[i]) < 1e-6))) {
      out.push(h);
    }
  }

  return out;
};

/**
 * calculateHash가 낼 수 있는 지문 전부 (규칙의 경계에 걸리면 둘 이상).
 * axisTolerance를 주면 거의 같은 거리의 쌍을 축으로 잡은 지문도 넣는다 (사람 눈대중).
 */
export const equivalentFingerprints = (
  points: Point2D[],
  axisTolerance = 0,
): Fingerprint[] =>
  dedupe(
    readingsOf(points, axisTolerance)
      .filter(isCanonical)
      .map((r) => r.hash),
  );

/**
 * 이 모양을 어떻게 읽어야 지문 f에 가장 가까운가 (축 후보·A·B 방향·C·D 순서 모두에서).
 * 같은 모양이면 0 — 읽기 하나가 모양을 (돌림·크기·위치만 빼고) 다 정하기 때문이다.
 */
export const matchError = (
  points: Point2D[],
  f: Fingerprint,
  axisTolerance = 0,
): { error: number; reading: Reading } => {
  let best = { error: Infinity, reading: null as unknown as Reading };

  for (const r of readingsOf(points, axisTolerance)) {
    const error = fingerprintDistance(r.hash, f);

    if (error < best.error) {
      best = { error, reading: r };
    }
  }

  return best;
};
