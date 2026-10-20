import type { Point3D } from "@/scripts/hash/types";
import type { HashedQuad } from "@/search/findCandidatesCore";
import type { SolverContext } from "@/search/solvers/types";
import { buildTriangleIndex } from "@/search/catalogGeometry";
import { buildCandidateIndex } from "@/search/findCandidatesCore";

// 풀이에 필요한 인덱스를 한 곳에서 만든다. 브라우저 Worker와 테스트가 같은 설정을 쓴다.

export interface ContextStar {
  hr: string;
  vector: Point3D;
  mag: number; // 시등급(V). 작을수록 밝다.
}

// 전체 삼각형 인덱스: 한 별에서 18° 이내인 두 별로 만든 삼각형 (약 113만 개)
export const TRIANGLE_MAX_ANGLE_DEG = 18;

// 밝은 별 삼각형 인덱스: 3.5등급 이하 별(287개)만으로, 30° 이내 (약 4.9만 개).
// 전체 인덱스는 삼각형이 너무 많아 모양이 0.005만 어긋나도 비슷한 모양이 백 개 넘게
// 앞에 온다. 사진에서 가장 밝은 별은 대개 카탈로그에서도 밝은 별이라, 밝은 별끼리만
// 찾으면 경쟁 삼각형이 1/20로 줄어 왜곡된 사진(원근 보정 등)에서도 정답이 앞에 온다.
export const BRIGHT_TRIANGLE = { maxMag: 3.5, maxAngleDeg: 30 };

export const buildSolverContext = (
  stars: ContextStar[],
  quads: HashedQuad[],
  nameOf?: (hr: string) => string,
): SolverContext => {
  const catalog = stars.map((s) => ({ hr: s.hr, vector: s.vector }));
  const bright = stars
    .filter((s) => s.mag <= BRIGHT_TRIANGLE.maxMag)
    .map((s) => ({ hr: s.hr, vector: s.vector }));

  return {
    index: buildCandidateIndex(quads, nameOf),
    catalog,
    byHrVec: new Map(stars.map((s) => [s.hr, s.vector])),
    triangleIndex: buildTriangleIndex(catalog, TRIANGLE_MAX_ANGLE_DEG),
    brightTriangleIndex: buildTriangleIndex(
      bright,
      BRIGHT_TRIANGLE.maxAngleDeg,
    ),
  };
};
