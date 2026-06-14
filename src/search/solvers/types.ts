import type { Point3D } from "@/scripts/hash/types";
import type { TriangleIndex } from "@/search/catalogGeometry";
import type { CandidateIndex } from "@/search/findCandidatesCore";
import type { SolveStar } from "@/search/solveCore";

// 세 알고리즘(원본/개선/최선)을 같은 입력으로 비교 실행하기 위한 공통 인터페이스.

// 검출 단계의 출력에 해당. brightness는 밝을수록 큰 값(밝기 또는 겉보기 크기).
export interface InputStar {
  x: number;
  y: number;
  brightness: number;
}

export interface ImageSize {
  width: number;
  height: number;
}

// solve에 필요한 공유 자원(매칭 인덱스·카탈로그). 한 번 만들어 재사용한다.
export interface SolverContext {
  index: CandidateIndex; // quad 매칭용 (원본·개선)
  catalog: SolveStar[];
  byHrVec: Map<string, Point3D>;
  triangleIndex?: TriangleIndex; // 삼각형 매칭용 (최선B)
}

export interface SolveOutcome {
  found: boolean; // 알고리즘이 "해를 찾았다"고 판단했는지
  centerVector: Point3D | null; // 추정 광축 방향
  fovDeg: number | null; // 추정 시야각
  confidence: number; // 신뢰 지표(원본은 1/거리, 개선·최선은 유의도)
  inlierCount: number; // 매칭된 별 수 (원본은 0)
  candidatesEvaluated: number; // 검토한 후보 수
  timeMs: number;
}

export interface Solver {
  key: string;
  name: string;
  description: string;
  solve(stars: InputStar[], size: ImageSize, ctx: SolverContext): SolveOutcome;
}
