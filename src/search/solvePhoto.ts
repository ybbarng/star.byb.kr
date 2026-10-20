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
import { improvedSolver, triangleSolver } from "@/search/solvers";
import { dedupeBySky } from "@/search/solvers/candidates";
import { byStarPriority } from "@/search/utils/selectStars";

// 사진 한 장의 검출 별 목록을 받아 앱과 똑같은 흐름으로 푼다.
// Worker(solverWorker)는 이 함수를 감싸기만 하고, Node 테스트도 이 함수를 그대로 쓴다.
//
// 흐름:
// 1) solver를 차례로 쓰고, 각 solver는 밝기 상위 N개를 여러 크기로 잘라 차례로 푼다.
//    (검출 노이즈 비율을 모르므로 노이즈가 적은 크기에서 정답이 나오길 기대한다.)
//    확신할 해가 나오면 바로 멈춘다.
//    입력은 사진 전체에서 고른 뒤, 지면 불빛 같은 노이즈가 아래쪽에 몰린 사진을 위해
//    위쪽 영역에서만 다시 고른다 (사람이 지면을 가리는 일을 흉내, journey 14장).
// 2) 직선투영으로 확신하지 못하면 어안(초광각) blind 풀이를 시도한다.
// 3) 확신하지 못해도 서로 다른 하늘 위치의 후보들을 모아 사람이 고를 수 있게 돌려준다.

export const INPUT_SIZES = [15, 25, 40, 60];
// 일반인이 기다릴 수 있는 시간(목표 10초) 안에서 풀이를 멈춘다. 확신할 해를 못 찾으면
// 그때까지 모은 후보만 돌려준다.
export const DEFAULT_TIME_BUDGET_MS = 8000;
// 쓰는 순서. 개선 quad는 빠르고 노이즈에 강하며(실제 샘플 5장 확신), 삼각형은 별이 적은
// 사진(북두칠성)을 푼다. 서로 못 푸는 사진을 보완한다 (journey 13장).
export const DEFAULT_SOLVERS: Solver[] = [improvedSolver, triangleSolver];
// 입력을 고르는 영역. 사진 위쪽이 하늘이라고 보고(대부분의 사진), 지면이 섞인 아래쪽을
// 점점 더 빼 본다. 이 가정이 틀린 사진은 확신 기준(log-odds)이 오답을 막고, 사람이 영역을 고를 수 있다.
export const SEARCH_REGIONS = [
  { label: "사진 전체", keepTop: 1 },
  { label: "위쪽 75%", keepTop: 0.75 },
  { label: "위쪽 55%", keepTop: 0.55 },
  // 하늘이 사진 위쪽 절반 남짓인 사진(서울 누각, 오로라 아래 나무·산)
  { label: "위쪽 45%", keepTop: 0.45 },
];
// 영역 안 별이 이보다 적으면 그 영역은 건너뛴다
const MIN_REGION_STARS = 8;
// 어안 blind 풀이에 넣는 별 수 (모든 검출을 넣으면 느리다)
const FISHEYE_INPUT_STARS = 100;
const MAX_PRESENTED_CANDIDATES = 8;
// 어안 blind 풀이 결과를 채택하는 기준(우연/오답을 줄이려 inlier가 많고 재투영 오차가 작을 때만)
const FISHEYE_ACCEPT = { minInliers: 25, maxRmsPx: 6 };

export type SolvePhase =
  | {
      kind: "linear";
      solverKey: string;
      region: string;
      inputSize: number;
      index: number; // 전체 직선투영 단계(solver × 영역 × 입력 크기) 중 몇 번째인지
      total: number;
    }
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

// 두 목록에서 풀이에 실제로 쓰는 앞부분(가장 큰 입력 크기만큼)이 같은 별들인가
const sameTopStars = (a: InputStar[], b: InputStar[]): boolean => {
  const n = INPUT_SIZES[INPUT_SIZES.length - 1];
  const ta = a.slice(0, n);
  const tb = b.slice(0, n);

  return ta.length === tb.length && ta.every((s, k) => s === tb[k]);
};

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

// stars는 검출 전체를 넣어도 된다. 영역마다 우선순위(별다움 → 밝기) 순으로 필요한 만큼만 쓴다.
export const solvePhoto = (
  stars: InputStar[],
  size: ImageSize,
  ctx: SolverContext,
  solvers: Solver[] = DEFAULT_SOLVERS,
  options: SolvePhotoOptions = {},
): SolvePhotoResult => {
  const t0 = performance.now();
  const deadline = t0 + (options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS);
  const sorted = [...stars].sort(byStarPriority);
  const regionInputs = SEARCH_REGIONS.map((region) => ({
    label: region.label,
    stars: sorted.filter((s) => s.y < size.height * region.keepTop),
  })).filter(
    (region, i, all) =>
      region.stars.length >= MIN_REGION_STARS &&
      // 앞 영역과 실제로 쓰는 별이 같으면(아래쪽에 별이 없던 사진) 되풀이하지 않는다
      (i === 0 || !sameTopStars(region.stars, all[i - 1].stars)),
  );
  // 1차: 사진 전체를 모든 solver로 (빠른 solver부터, 입력 크기 순). 별다움 순으로 고른 입력이면
  // 지면이 섞여도 대부분 여기서 풀린다.
  // 2차: 못 풀면 지면을 빼는 영역으로. 한 solver 안에서는 입력 크기 순으로 영역을 번갈아 본다
  // (15개: 위쪽 75% → 55% → 45%, 그다음 25개 …). 큰 입력은 비싸서 작은 입력을 먼저 본다.
  const stepsFor = (regions: typeof regionInputs) =>
    solvers.flatMap((solver) => {
      const perRegion = regions.map((region) =>
        inputSizesFor(region.stars.length).map((inputSize) => ({
          solver,
          region,
          inputSize,
        })),
      );
      const rounds = Math.max(...perRegion.map((list) => list.length), 0);

      return Array.from({ length: rounds }, (_, k) =>
        perRegion.flatMap((list) => (k < list.length ? [list[k]] : [])),
      ).flat();
    });
  const steps = [
    ...stepsFor(regionInputs.slice(0, 1)),
    ...stepsFor(regionInputs.slice(1)),
  ];

  const allCandidates: SolveCandidateResult[] = [];
  let best: SolveOutcome | null = null;
  let evaluated = 0;
  let timedOut = false;

  for (let i = 0; i < steps.length; i++) {
    if (performance.now() >= deadline) {
      timedOut = true;
      break;
    }

    const { solver, region, inputSize } = steps[i];

    options.onPhase?.({
      kind: "linear",
      solverKey: solver.key,
      region: region.label,
      inputSize,
      index: i,
      total: steps.length,
    });

    const out = solver.solve(region.stars.slice(0, inputSize), size, ctx, {
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
      sorted.slice(0, FISHEYE_INPUT_STARS).map((s): Point2D => [s.x, s.y]),
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
