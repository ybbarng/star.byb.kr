import type { Fingerprint } from "@/game/quadFingerprint/fingerprint";
import type { Difficulty } from "@/game/quadFingerprint/problems";
import type { Point2D } from "@/scripts/hash/types";
import { describe, expect, it } from "vitest";
import {
  equivalentFingerprints,
  fingerprintDistance,
  matchError,
  readingsOf,
} from "@/game/quadFingerprint/fingerprint";
import {
  AXIS_TOLERANCE,
  gradePlace,
  isSameShape,
  makeRounds,
  quadPool,
  ROUNDS,
  SETTINGS,
  shapeGap,
} from "@/game/quadFingerprint/problems";
import { calculateHash } from "@/scripts/hash/hash";
import { createRng } from "@/utils/rng";

// 별 넷 지문 맞추기: 같은 배치가 지문을 둘 이상 가질 수 있는 경우를 모두 정답으로 치는지,
// 문제 보기에 정답이 하나뿐인지.

const hashOf = (points: Point2D[]) =>
  calculateHash(
    points.map((vector, i) => ({ label: String(i), vector })) as Parameters<
      typeof calculateHash
    >[0],
  ).hash as Fingerprint;

// 옮기고·돌리고·키운다 (뒤집지는 않는다)
const move = (points: Point2D[], angle: number, scale: number): Point2D[] =>
  points.map(([x, y]) => [
    3 + scale * (x * Math.cos(angle) - y * Math.sin(angle)),
    -7 + scale * (x * Math.sin(angle) + y * Math.cos(angle)),
  ]);

const randomQuad = (rng: () => number): Point2D[] =>
  Array.from({ length: 4 }, () => [rng() * 10, rng() * 10] as Point2D);

// 정규화 평면의 A(0,0)·B(1,1)·C·D로 모양을 만든다 (그다음 아무렇게나 옮겨 calculateHash에 넣는다)
const fromNormalized = (c: Point2D, d: Point2D): Point2D[] =>
  move([[0, 0], [1, 1], c, d], 0.7, 4.2);

const closeTo = (f: Fingerprint, g: Fingerprint, eps = 1e-6) =>
  f.every((v, i) => Math.abs(v - g[i]) < eps);

const inSet = (set: Fingerprint[], f: Fingerprint, eps = 1e-6) =>
  set.some((g) => closeTo(g, f, eps));

describe("지문 읽기는 calculateHash와 같다", () => {
  it("흔한 모양은 지문이 하나이고 calculateHash와 같다", () => {
    const rng = createRng(7);

    for (let n = 0; n < 300; n++) {
      const pts = randomQuad(rng);
      const set = equivalentFingerprints(pts);
      expect(set).toHaveLength(1);
      expect(closeTo(set[0], hashOf(pts))).toBe(true);
    }
  });

  it("옮기고 돌리고 키워도 지문은 그대로, 뒤집으면(거울상) 달라진다", () => {
    const rng = createRng(11);

    for (let n = 0; n < 50; n++) {
      const pts = randomQuad(rng);
      const f = hashOf(pts);
      const moved = move(pts, rng() * 6, 0.2 + rng() * 5);
      expect(closeTo(hashOf(moved), f, 1e-6)).toBe(true);
      // 돌리고 키운 모양을 그 지문과 견주면 0
      expect(matchError(moved, f).error).toBeLessThan(1e-9);
    }

    // 거울상: 대칭이 없는 모양이면 다른 지문
    const pts: Point2D[] = [
      [0, 0],
      [9, 2],
      [3, 4],
      [6, -1],
    ];
    const mirrored = pts.map(([x, y]) => [-x, y] as Point2D);
    expect(fingerprintDistance(hashOf(pts), hashOf(mirrored))).toBeGreaterThan(
      0.1,
    );
    expect(
      matchError(mirrored, hashOf(pts), AXIS_TOLERANCE).error,
    ).toBeGreaterThan(0.1);
  });
});

describe("같은 배치가 지문을 둘 가지는 경우 (규칙의 경계)", () => {
  it("C·D의 x 합이 정확히 1이면 A·B 방향이 둘 → 지문 둘, 조금만 흔들어도 calculateHash가 양쪽을 오간다", () => {
    const c: Point2D = [0.2, 0.55];
    const d: Point2D = [0.8, 0.3];
    const set = equivalentFingerprints(fromNormalized(c, d));
    // 원래 읽기와, A·B를 바꾼 읽기 (모든 점이 (1-x, 1-y))
    expect(set).toHaveLength(2);
    expect(inSet(set, [0.2, 0.55, 0.8, 0.3])).toBe(true);
    expect(inSet(set, [0.2, 0.7, 0.8, 0.45])).toBe(true);
    expect(inSet(set, hashOf(fromNormalized(c, d)), 1e-6)).toBe(true);

    // D를 아주 조금 오른쪽/왼쪽으로: 합이 1을 넘으면 A·B가 바뀐다
    const right = hashOf(fromNormalized(c, [0.8 + 1e-4, 0.3]));
    const left = hashOf(fromNormalized(c, [0.8 - 1e-4, 0.3]));
    expect(inSet(set, right, 1e-3)).toBe(true);
    expect(inSet(set, left, 1e-3)).toBe(true);
    expect(fingerprintDistance(right, left)).toBeGreaterThan(0.1);
  });

  it("C·D의 x가 같으면 C·D 순서가 둘 → 지문 둘", () => {
    const c: Point2D = [0.3, 0.65];
    const d: Point2D = [0.3, 0.1];
    const set = equivalentFingerprints(fromNormalized(c, d));
    expect(set).toHaveLength(2);
    expect(inSet(set, [0.3, 0.65, 0.3, 0.1])).toBe(true);
    expect(inSet(set, [0.3, 0.1, 0.3, 0.65])).toBe(true);

    const a = hashOf(fromNormalized([0.3 - 1e-4, 0.65], d));
    const b = hashOf(fromNormalized([0.3 + 1e-4, 0.65], d));
    expect(inSet(set, a, 1e-3)).toBe(true);
    expect(inSet(set, b, 1e-3)).toBe(true);
    // 순서만 다르니 점 짝으로는 같은 지문
    expect(fingerprintDistance(set[0], set[1])).toBeLessThan(1e-9);
  });

  // 가장 먼 쌍이 둘: P0–P3와 P1–P2가 모두 √136
  const twin: Point2D[] = [
    [0, 0],
    [9, -1],
    [3, 9],
    [10, 6],
  ];

  it("가장 먼 쌍이 둘이면 축이 둘 → 전혀 다른 지문 둘, 흔들면 calculateHash가 양쪽을 오간다", () => {
    const set = equivalentFingerprints(twin);
    expect(set).toHaveLength(2);
    expect(fingerprintDistance(set[0], set[1])).toBeGreaterThan(0.2);
    expect(inSet(set, hashOf(twin))).toBe(true);

    // P3를 조금 밀면 P0–P3가, P2를 조금 밀면 P1–P2가 가장 먼 쌍이 된다
    const longer03 = hashOf([twin[0], twin[1], twin[2], [10.02, 6.012]]);
    const longer12 = hashOf([twin[0], twin[1], [2.99, 9.02], twin[3]]);
    expect(
      Math.min(...set.map((g) => fingerprintDistance(g, longer03))),
    ).toBeLessThan(0.01);
    expect(
      Math.min(...set.map((g) => fingerprintDistance(g, longer12))),
    ).toBeLessThan(0.01);
    expect(fingerprintDistance(longer03, longer12)).toBeGreaterThan(0.2);
  });

  it("거의 같은 거리(눈대중 범위)면 사람에게는 두 축 모두 정답", () => {
    // P3를 3% 멀리: calculateHash는 하나만 내지만, 눈대중 허용 안이면 둘 다
    const near: Point2D[] = [twin[0], twin[1], twin[2], [10.3, 6.18]];
    expect(equivalentFingerprints(near)).toHaveLength(1);
    const human = equivalentFingerprints(near, AXIS_TOLERANCE);
    expect(human).toHaveLength(2);

    // 어느 축으로 읽어 찍어도 만점
    for (const f of human) {
      const g = gradePlace(near, [f[0], f[1]], [f[2], f[3]]);
      expect(g.score).toBe(1000);
    }
  });

  it("사람이 A·B를 거꾸로 잡거나 C·D를 바꿔 찍어도 같은 모양이라 만점", () => {
    const pts: Point2D[] = [
      [0, 0],
      [9, 2],
      [3, 4],
      [6, -1],
    ];
    const [cx, cy, dx, dy] = hashOf(pts);
    expect(gradePlace(pts, [cx, cy], [dx, dy]).score).toBe(1000);
    expect(gradePlace(pts, [dx, dy], [cx, cy]).score).toBe(1000);
    // A·B를 바꾼 자리 (1-x, 1-y)
    const flipped = gradePlace(pts, [1 - dx, 1 - dy], [1 - cx, 1 - cy]);
    expect(flipped.score).toBe(1000);
    expect(flipped.reading.hash[0] + flipped.reading.hash[2]).toBeGreaterThan(
      1,
    );
    // 멀리 찍으면 0점, 조금 어긋나면 그 사이
    expect(gradePlace(pts, [cx + 0.5, cy], [dx, dy - 0.5]).score).toBe(0);
    const off = gradePlace(pts, [cx + 0.1, cy], [dx, dy]).score;
    expect(off).toBeGreaterThan(0);
    expect(off).toBeLessThan(1000);
  });

  it("모든 읽기는 정규화 규칙을 지킨다: A·B는 축 후보, C의 x ≤ D의 x", () => {
    for (const r of readingsOf(twin, AXIS_TOLERANCE)) {
      expect(r.hash[0]).toBeLessThanOrEqual(r.hash[2] + 1e-6);
      expect(new Set([...r.axis, ...r.rest]).size).toBe(4);
    }
  });
});

describe("문제", () => {
  const pool = quadPool();

  it("별 지도의 quad에서 만들고, 지문은 그린 모양의 calculateHash", () => {
    expect(pool.length).toBeGreaterThan(1000);

    for (const q of pool.slice(0, 200)) {
      expect(closeTo(q.fingerprint, hashOf(q.points), 1e-9)).toBe(true);
    }
  });

  it.each(["intro", "easy", "normal", "hard"] as Difficulty[])(
    "%s: 판마다 정답 보기는 하나뿐, 가짜는 정해 둔 만큼 다르다",
    (difficulty) => {
      const setting = SETTINGS[difficulty];

      for (const seed of [1, 2, 3, 4, 5]) {
        const rounds = makeRounds(difficulty, seed);
        expect(rounds).toHaveLength(ROUNDS);

        for (const round of rounds) {
          expect(round.answer.mags.every((m) => m <= setting.maxMag)).toBe(
            true,
          );

          if (round.kind === "place") {
            // 보여 준 모양 그대로 찍으면 만점
            const f = round.answer.fingerprint;
            expect(
              gradePlace(round.shown.points, [f[0], f[1]], [f[2], f[3]]).score,
            ).toBe(1000);
            continue;
          }

          expect(round.options).toHaveLength(setting.options);
          const same = round.options.map((o) =>
            isSameShape(o.points, round.fingerprint),
          );
          expect(same.filter(Boolean)).toHaveLength(1);
          expect(same[round.correct]).toBe(true);

          for (const [i, o] of round.options.entries()) {
            if (i !== round.correct) {
              const gap = shapeGap(round.answer.points, o.points);
              expect(gap).toBeGreaterThanOrEqual(
                Math.min(setting.far, setting.near?.[1] ?? 1, 0.1) - 1e-9,
              );
            }
          }

          if (setting.mirror && round.options.some((o) => o.mirrored)) {
            const m = round.options.find((o) => o.mirrored)!;
            expect(isSameShape(m.points, round.fingerprint)).toBe(false);
          }
        }
      }
    },
  );

  it("입문·쉬움은 지문이 둘인 모양을 내지 않고, 보통·어려움은 닮은 가짜를 섞는다", () => {
    for (const seed of [1, 2, 3]) {
      for (const r of makeRounds("intro", seed)) {
        expect(
          equivalentFingerprints(r.answer.points, AXIS_TOLERANCE),
        ).toHaveLength(1);
      }

      const normal = makeRounds("normal", seed).filter(
        (r) => r.kind === "pick",
      );
      const nearCount = normal
        .flatMap((r) =>
          r.options
            .filter((_, i) => i !== r.correct)
            .map((o) => shapeGap(r.answer.points, o.points)),
        )
        .filter((g) => g <= 0.25).length;
      expect(nearCount).toBeGreaterThan(0);
    }
  });
});
