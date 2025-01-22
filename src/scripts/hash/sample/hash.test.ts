import { expect, test } from "vitest";
import { calculate } from "./hash";
import { Hash, Quadrilateral2D } from "@/scripts/hash/types";

class HashComparator {
  public hash: Hash;

  constructor(hash: Hash) {
    this.hash = hash;
  }

  equals(other: HashComparator): boolean {
    const tolerance = 1e-6;

    return this.hash.every(
      (thisHashi, i) => Math.abs(thisHashi - other.hash[i]) < tolerance,
    );
  }
}

function isHashComparator(a: unknown): a is HashComparator {
  return a instanceof HashComparator;
}

function areHashesEqual(a: unknown, b: unknown): boolean | undefined {
  const isAHashComparator = isHashComparator(a);
  const isBHashComparator = isHashComparator(b);

  if (isAHashComparator && isBHashComparator) {
    return (a as HashComparator).equals(b);
  } else if (isAHashComparator === isBHashComparator) {
    return undefined;
  } else {
    return false;
  }
}

expect.addEqualityTesters([areHashesEqual]);

test("사잔 샘플 데이터로 hash 계산", () => {
  const given: Quadrilateral2D = [
    [774.2253086419753, 552.6018518518518],
    [672.3654618473895, 615.3293172690762],
    [551.7619047619047, 487.30303030303025],
    [603, 402.77272727272725],
  ];
  const expected: Hash = [
    0.2713096068688039, 1.0379848659180313, 0.5214422945201762,
    -0.30270945223148926,
  ];
  const result = calculate(given);
  expect(result).toHaveLength(4);

  expect(new HashComparator(result)).toEqual(new HashComparator(expected));
});

test("카탈로그 샘플 데이터로 hash 계산", () => {
  const given: Quadrilateral2D = [
    [-0.05319170051932333, 0.08641597298549719],
    [-0.08095038548270216, -0.003116408779236912],
    [0.039547713112145666, -0.07002104735658571],
    [0.09459437288987987, -0.013278516849674682],
  ];
  const expected: Hash = [
    0.27199167408766955, 1.0367008298293259, 0.5335218185710089,
    -0.30544323703051024,
  ];
  const result = calculate(given);
  expect(result).toHaveLength(4);

  expect(new HashComparator(result)).toEqual(new HashComparator(expected));
});
