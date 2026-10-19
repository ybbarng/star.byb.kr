import type { Point2D } from "@/scripts/hash/types";
import type {
  ImageSize,
  InputStar,
  SolveCandidateResult,
  SolveOutcome,
  Solver,
  SolverContext,
} from "@/search/solvers";
import { blindSolveFisheye } from "@/search/fisheyeSolve";
import { dedupeBySky } from "@/search/solvers/candidates";

// 사진 한 장의 검출 별 목록을 받아 앱과 똑같은 흐름으로 푼다.
// Worker(solverWorker)는 이 함수를 감싸기만 하고, Node 테스트도 이 함수를 그대로 쓴다.
//
// 흐름:
// 1) 검출 노이즈 비율을 모르므로 밝기 상위 N개를 여러 크기로 잘라 차례로 푼다.
//    노이즈가 적은 크기에서 정답이 나온다. 확신할 해가 나오면 바로 멈춘다.
// 2) 직선투영으로 확신하지 못하면 어안(초광각) blind 풀이를 시도한다.
// 3) 확신하지 못해도 서로 다른 하늘 위치의 후보들을 모아 사람이 고를 수 있게 돌려준다.

export const INPUT_SIZES = [15, 25, 40, 60];
// 일반인이 기다릴 수 있는 시간(목표 10초) 안에서 풀이를 멈춘다. 확신할 해를 못 찾으면
// 그때까지 모은 후보만 돌려준다.
export const DEFAULT_TIME_BUDGET_MS = 8000;
const MAX_PRESENTED_CANDIDATES = 8;
// 어안 blind 풀이 결과를 채택하는 기준(우연/오답을 줄이려 inlier가 많고 재투영 오차가 작을 때만)
const FISHEYE_ACCEPT = { minInliers: 25, maxRmsPx: 6 };

export type SolvePhase =
  | { kind: "linear"; inputSize: number; index: number; total: number }
  | { kind: "fisheye" };

export interface SolvePhotoOptions {
  timeBudgetMs?: number;
  onPhase?: (phase: SolvePhase) => void;
}

export interface SolvePhotoResult extends SolveOutcome {
  timedOut: boolean; // 시간 상한에 걸려 남은 입력 크기를 못 봤는지
}

// 후보들을 믿을 만한 순(log-odds, 같으면 inlier)으로 정렬하고 같은 하늘 위치는 하나로 묶는다.
const mergeCandidates = (all: SolveCandidateResult[]): SolveCandidateResult[] =>
  dedupeBySky(
    [...all].sort(
      (a, b) => b.confidence - a.confidence || b.inlierCount - a.inlierCount,
    ),
    MAX_PRESENTED_CANDIDATES,
  );

// 입력 별 수보다 큰 크기는 같은 입력을 되풀이할 뿐이라, 처음으로 전체를 덮는 크기까지만 쓴다.
const inputSizesFor = (starCount: number): number[] => {
  const sizes: number[] = [];

  for (const n of INPUT_SIZES) {
    sizes.push(Math.min(n, starCount));

    if (n >= starCount) {
      break;
    }
  }

  return sizes;
};

export const solvePhoto = (
  stars: InputStar[],
  size: ImageSize,
  ctx: SolverContext,
  solver: Solver,
  options: SolvePhotoOptions = {},
): SolvePhotoResult => {
  const t0 = performance.now();
  const deadline = t0 + (options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS);
  const sorted = [...stars].sort((a, b) => b.brightness - a.brightness);
  const sizes = inputSizesFor(sorted.length);

  const allCandidates: SolveCandidateResult[] = [];
  let best: SolveOutcome | null = null;
  let evaluated = 0;
  let timedOut = false;

  for (let i = 0; i < sizes.length; i++) {
    if (performance.now() >= deadline) {
      timedOut = true;
      break;
    }

    options.onPhase?.({
      kind: "linear",
      inputSize: sizes[i],
      index: i,
      total: sizes.length,
    });

    const out = solver.solve(sorted.slice(0, sizes[i]), size, ctx, {
      deadline,
    });
    allCandidates.push(...out.candidates);
    evaluated += out.candidatesEvaluated;

    if (out.found) {
      best = out;
      break;
    }
  }

  // 직선투영으로 확신하지 못했으면 어안(초광각) blind 풀이를 시도한다.
  let fisheyeCamera = null;

  if (!best && sorted.length > 0) {
    options.onPhase?.({ kind: "fisheye" });

    const fe = blindSolveFisheye(
      sorted.map((s): Point2D => [s.x, s.y]),
      ctx.index,
      ctx.byHrVec,
      size.width,
      size.height,
    );

    if (
      fe &&
      fe.inliers >= FISHEYE_ACCEPT.minInliers &&
      fe.rms < FISHEYE_ACCEPT.maxRmsPx
    ) {
      fisheyeCamera = fe.camera;
    }
  }

  const candidates = mergeCandidates(allCandidates);
  const timeMs = performance.now() - t0;

  if (best) {
    return {
      ...best,
      candidatesEvaluated: evaluated,
      timeMs,
      candidates,
      fisheyeCamera,
      timedOut,
    };
  }

  return {
    found: fisheyeCamera !== null,
    centerVector: null,
    fovDeg: null,
    confidence: 0,
    inlierCount: 0,
    candidatesEvaluated: evaluated,
    timeMs,
    transform: null,
    candidates,
    fisheyeCamera,
    timedOut,
  };
};
