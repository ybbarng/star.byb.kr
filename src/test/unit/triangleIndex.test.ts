import { describe, expect, it } from "vitest";
import {
  buildTriangleIndex,
  projectTriangle,
  searchTriangle,
  triangleShape,
} from "@/search/catalogGeometry";
import { catalogExists, loadCatalog } from "@/test/synthetic/loadCatalog";

const MAX_ANGLE_DEG = 18;

// 정의대로 만든 삼각형 집합: 한 별이 나머지 두 별과 모두 maxAngle 이내인 세 별 (HR 정렬 키)
const naiveTriangleKeys = (
  stars: { hr: string; vector: [number, number, number] }[],
): Set<string> => {
  const cosMax = Math.cos((MAX_ANGLE_DEG * Math.PI) / 180);

  const near = (i: number, j: number) => {
    const a = stars[i].vector;
    const b = stars[j].vector;

    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] > cosMax;
  };

  const keys = new Set<string>();

  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      for (let k = j + 1; k < stars.length; k++) {
        const ok =
          (near(i, j) && near(i, k)) ||
          (near(j, i) && near(j, k)) ||
          (near(k, i) && near(k, j));

        if (ok) {
          keys.add([stars[i].hr, stars[j].hr, stars[k].hr].sort().join(","));
        }
      }
    }
  }

  return keys;
};

describe.skipIf(!catalogExists())("삼각형 인덱스", () => {
  // 전수 확인이 O(n³)이라 하늘 한 구역의 별만 쓴다
  const stars = loadCatalog()
    .filter((s) => s.vector[2] > 0.8)
    .map((s) => ({ hr: s.hr, vector: s.vector }));

  it("정의대로 만든 삼각형 집합과 중복·누락 없이 같다", () => {
    const index = buildTriangleIndex(stars, MAX_ANGLE_DEG);
    const keys: string[] = [];

    for (let t = 0; t < index.vertices.length / 3; t++) {
      keys.push(
        [0, 1, 2]
          .map((o) => index.hrs[index.vertices[3 * t + o]])
          .sort()
          .join(","),
      );
    }

    const naive = naiveTriangleKeys(stars);

    expect(keys.length).toBe(new Set(keys).size); // 중복 없음
    expect(new Set(keys)).toEqual(naive);
  });

  it("카탈로그 삼각형 자신의 형태로 찾으면 그 삼각형이 나온다", () => {
    const index = buildTriangleIndex(stars, MAX_ANGLE_DEG);
    const byHr = new Map(stars.map((s) => [s.hr, s.vector]));
    const t = Math.floor(index.vertices.length / 3 / 2);
    const hrs = [0, 1, 2].map((o) => index.hrs[index.vertices[3 * t + o]]);
    const pp = projectTriangle(hrs.map((hr) => byHr.get(hr)!));
    const { shape } = triangleShape(
      Math.hypot(pp[0][0] - pp[1][0], pp[0][1] - pp[1][1]),
      Math.hypot(pp[0][0] - pp[2][0], pp[0][1] - pp[2][1]),
      Math.hypot(pp[1][0] - pp[2][0], pp[1][1] - pp[2][1]),
      [0, 1, 2],
    );

    const found = searchTriangle(index, shape, 8).map((e) =>
      [...e.hrs].sort().join(","),
    );

    expect(found).toContain([...hrs].sort().join(","));
  });
});
