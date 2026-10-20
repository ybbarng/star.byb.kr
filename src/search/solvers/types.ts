import type { Point3D } from "@/scripts/hash/types";
import type { PairIndex, TriangleIndex } from "@/search/catalogGeometry";
import type { CandidateIndex } from "@/search/findCandidatesCore";
import type { SolveStar } from "@/search/solveCore";
import type { FisheyeCamera } from "@/search/utils/fisheye";
import type { Mat3 } from "@/search/utils/similarity";

// 세 알고리즘(원본/개선/최선)을 같은 입력으로 비교 실행하기 위한 공통 인터페이스.

// 검출 단계의 출력에 해당. brightness는 밝을수록 큰 값(밝기 또는 겉보기 크기).
export interface InputStar {
  x: number;
  y: number;
  brightness: number;
  // 주변 고리가 고른 정도(detectCore.ringContrast). 작을수록 별답다. 없으면(사람이 찍은 별 등) 별로 본다.
  ringContrast?: number;
  // 다른 검출 여럿과 한 직선 위에 줄지어 있다 (비행기 점선·창문 줄, utils/alignment)
  aligned?: boolean;
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
  brightTriangleIndex?: TriangleIndex; // 밝은 별끼리만 만든 삼각형 (최선B가 함께 찾는다)
  pairIndex?: PairIndex; // 별쌍 각거리 투표용 (최선A)
}

// 사람이 고를 수 있도록 제시하는 후보 하나 (서로 다른 하늘 위치).
export interface SolveCandidateResult {
  centerVector: Point3D;
  fovDeg: number;
  transform: Mat3;
  confidence: number;
  inlierCount: number;
}

export interface SolveOutcome {
  found: boolean; // 알고리즘이 "해를 찾았다"고 확신하는지 (최상위 후보가 우연으로 설명되지 않는지)
  centerVector: Point3D | null; // 최상위 후보의 광축 방향
  fovDeg: number | null; // 최상위 후보의 시야각
  // 신뢰 지표. 원본은 1/거리, 나머지는 log-odds(우연일 확률의 -log10, 클수록 믿을 만함)
  confidence: number;
  inlierCount: number; // 매칭된 별 수 (원본은 0)
  candidatesEvaluated: number; // 검토한 후보 수
  timeMs: number;
  transform: Mat3 | null; // 최상위 후보의 변환행렬(TP)
  // 유의도 순 상위 후보들(서로 다른 하늘 위치, 중복 제거). 유일한 해를 못
  // 찾아도 사람이 이 중 고를 수 있게 한다 (사람-컴퓨터 협업).
  candidates: SolveCandidateResult[];
  // 직선투영으로 못 풀고 어안 blind 풀이가 성공했을 때의 어안 카메라(있으면 오버레이는
  // 이걸로 그린다). 초광각/어안 사진용.
  fisheyeCamera?: FisheyeCamera | null;
}

// 한 번의 solve 호출에 주는 실행 조건.
export interface SolveRunOptions {
  // performance.now() 기준 마감 시각. 넘으면 지금까지 찾은 것으로 끝낸다.
  deadline?: number;
}

export interface Solver {
  key: string;
  name: string;
  description: string;
  // 앱 흐름(solvePhoto)이 이 solver에 넣어 볼 입력 크기들. 없으면 INPUT_SIZES
  inputSizes?: number[];
  solve(
    stars: InputStar[],
    size: ImageSize,
    ctx: SolverContext,
    options?: SolveRunOptions,
  ): SolveOutcome;
}
