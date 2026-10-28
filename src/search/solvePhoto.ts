import type { Point2D, Point3D } from "@/scripts/hash/types";
import type {
  ImageSize,
  InputStar,
  SolveCandidateResult,
  SolveOutcome,
  Solver,
  SolverContext,
} from "@/search/solvers";
import { blindSolveFisheye } from "@/search/fisheyeSolve";
import { refineSolution, scorePose } from "@/search/solveCore";
// 비교용 전체 목록(solvers/index)은 mathjs를 쓰는 원본(baseline)까지 싣기 때문에, 앱이 쓰는 둘만 직접 불러온다
import { ACCEPT, dedupeBySky, isConfident } from "@/search/solvers/candidates";
import { improvedSolver } from "@/search/solvers/improved";
import { triangleSolver } from "@/search/solvers/triangle";
import { rankForSolving } from "@/search/utils/selectStars";

// 사진 한 장의 검출 별 목록을 받아 앱과 똑같은 흐름으로 푼다.
// Worker(solverWorker)는 이 함수를 감싸기만 하고, Node 테스트도 이 함수를 그대로 쓴다.
//
// 흐름:
// 1) solver를 차례로 쓰고, 각 solver는 밝기 상위 N개를 여러 크기로 잘라 차례로 푼다.
//    (검출 노이즈 비율을 모르므로 노이즈가 적은 크기에서 정답이 나오길 기대한다.)
//    확신할 해가 나오면 바로 멈춘다.
//    입력은 사진 전체에서 고른 뒤, 지면 불빛 같은 노이즈가 아래쪽에 몰린 사진을 위해
//    위쪽 영역에서만 다시 고른다 (사람이 지면을 가리는 일을 흉내, journey 14장). 광각 가장자리를 뺀 가운데도 본다.
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
// border를 주면 네 가장자리를 그 비율만큼 뺀다: 광각 렌즈는 가장자리가 직선투영에서 벗어나 거기 별이
// 매칭을 흐린다 (인터넷 사진 391장에서 가장자리 15%를 빼는 영역으로 7장이 더 풀렸다, journey 40장).
// trail이면 별 궤적 점(노출 중간 순간의 별 자리)만 쓴다. 다른 영역은 궤적 점을 쓰지 않는다 (journey 41장).
export const SEARCH_REGIONS: {
  label: string;
  keepTop: number;
  border?: number;
  trail?: boolean;
}[] = [
  { label: "사진 전체", keepTop: 1 },
  { label: "위쪽 75%", keepTop: 0.75 },
  { label: "위쪽 55%", keepTop: 0.55 },
  // 하늘이 사진 위쪽 절반 남짓인 사진(서울 누각, 오로라 아래 나무·산)
  { label: "위쪽 45%", keepTop: 0.45 },
  { label: "가운데", keepTop: 1, border: 0.15 },
  { label: "별 궤적", keepTop: 1, trail: true },
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
const inputSizesFor = (
  starCount: number,
  candidates: number[] = INPUT_SIZES,
): number[] => {
  const sizes: number[] = [];

  for (const n of candidates) {
    sizes.push(Math.min(n, starCount));

    if (n >= starCount) {
      break;
    }
  }

  return sizes;
};

// 확신한 답을 그 영역의 별 더 많이로 다시 검증해, 점수가 오르면 그 결과로 바꾼다.
// 처음 확신한 순간의 점수는 입력 크기(15·25…)에 따라 기준 근처에서 출렁이기 때문이다.
// 처음 해의 크기가 조금 틀리면 가장자리 별이 허용오차 밖이라 다시 맞춰도 못 잡는다. 그래서
// 허용오차를 넓혀 한 번 맞춘 뒤 원래 허용오차로 다시 맞추는 길도 같이 보고, 가장 좋은 것을 고른다
// (원근 보정된 은하수: 신뢰도 9.4 → 27, journey 22장). 한 번에 1ms 안팎이라 다 해 봐도 싸다.
const POLISH_INPUT_STARS = [60, 100, 150];
const POLISH_WIDEN = [1, 1.5, 2, 3];

export const polish = (
  out: SolveOutcome,
  stars: InputStar[],
  size: ImageSize,
  ctx: SolverContext,
): SolveOutcome => {
  if (!out.transform) {
    return out;
  }

  const base = Math.max(5, Math.hypot(size.width, size.height) * 0.006);
  let refined: ReturnType<typeof refineSolution> = null;

  for (const n of POLISH_INPUT_STARS) {
    const points = stars.slice(0, n).map((s): Point2D => [s.x, s.y]);

    for (const widen of POLISH_WIDEN) {
      let TP = out.transform;
      let last: ReturnType<typeof refineSolution> = null;

      // 넓힌 허용오차로 두 번, 원래 허용오차로 두 번. 점수는 마지막(원래 허용오차) 것으로 본다.
      for (const tolerancePx of [base * widen, base * widen, base, base]) {
        last = refineSolution(TP, points, ctx.catalog, {
          imageWidth: size.width,
          imageHeight: size.height,
          tolerancePx,
        });

        if (!last) {
          break;
        }

        TP = last.TP;
      }

      if (last && (!refined || last.logOdds > refined.logOdds)) {
        refined = last;
      }
    }

    if (stars.length <= n) {
      break;
    }
  }

  if (!refined || refined.logOdds <= out.confidence) {
    return out;
  }

  const candidate = {
    centerVector: refined.centerVector,
    fovDeg: refined.fovDeg,
    transform: refined.TP,
    confidence: refined.logOdds,
    inlierCount: refined.inlierCount,
  };

  return {
    ...out,
    ...candidate,
    candidates: [candidate, ...out.candidates],
  };
};

// 정밀화해 볼 만큼 유망한 후보의 log-odds 하한과 단계마다 볼 후보 수. 오답 후보는 대개 4~5.5에 몰려 있고
// 정밀화해도 8.6을 넘지 않았다(200장). 정밀화는 한 번에 10ms 안팎이라 단계마다 몇 개는 싸다.
const PROMOTE_MIN_LOG_ODDS = 5;
const PROMOTE_PER_STEP = 2;
// 이미 정밀화해 본 하늘 위치(광축 1° 안)는 다시 하지 않는다
const PROMOTE_SAME_SKY_COS = Math.cos(Math.PI / 180);

// 교차 검증: 우선순위 짝수 번째 별로만 정밀화하고, 그 변환을 고정한 채 홀수 번째 별로 채점한다.
// 정밀화는 허용오차를 넓혀 가며 변환을 여러 번 다시 맞추므로, 맞춘 별로 다시 채점하면 오답도 점수가 부푼다
// (합성 지면 불빛 150개 사진에서 시야 69°짜리 오답 7.2가 정밀화로 12.1이 됐다).
const PROMOTE_MIN_HELD_OUT = 3;

// 정밀화한 변환을 고정한 채, 검출이 몰린 곳을 따지는 기대치(국소 밀도)로 다시 채점한다
const localLogOdds = (
  out: SolveOutcome,
  stars: InputStar[],
  size: ImageSize,
  ctx: SolverContext,
): number => {
  const n = POLISH_INPUT_STARS[POLISH_INPUT_STARS.length - 1];
  const scored = out.transform
    ? scorePose(
        out.transform,
        stars.slice(0, n).map((s): Point2D => [s.x, s.y]),
        ctx.catalog,
        { imageWidth: size.width, imageHeight: size.height },
      )
    : null;

  return scored?.logOdds ?? 0;
};

export const heldOutLogOdds = (
  c: SolveCandidateResult,
  stars: InputStar[],
  size: ImageSize,
  ctx: SolverContext,
): number => {
  const even = stars.filter((_, i) => i % 2 === 0);
  const odd = stars
    .filter((_, i) => i % 2 === 1)
    .slice(0, POLISH_INPUT_STARS[POLISH_INPUT_STARS.length - 1] / 2);
  const fit = polish(
    { found: false, ...c, candidatesEvaluated: 0, timeMs: 0, candidates: [] },
    even,
    size,
    ctx,
  );

  if (!fit.transform) {
    return 0;
  }

  const held = scorePose(
    fit.transform,
    odd.map((s): Point2D => [s.x, s.y]),
    ctx.catalog,
    { imageWidth: size.width, imageHeight: size.height },
  );

  return held?.logOdds ?? 0;
};

const promoteCandidates = (
  candidates: SolveCandidateResult[],
  polished: Point3D[],
  stars: InputStar[],
  size: ImageSize,
  ctx: SolverContext,
): SolveOutcome | null => {
  const fresh = candidates
    .filter(
      (c) =>
        c.confidence >= PROMOTE_MIN_LOG_ODDS &&
        !polished.some(
          (v) =>
            v[0] * c.centerVector[0] +
              v[1] * c.centerVector[1] +
              v[2] * c.centerVector[2] >=
            PROMOTE_SAME_SKY_COS,
        ),
    )
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, PROMOTE_PER_STEP);

  for (const c of fresh) {
    polished.push(c.centerVector);

    const out = polish(
      {
        found: false,
        ...c,
        candidatesEvaluated: 0,
        timeMs: 0,
        candidates: [],
      },
      stars,
      size,
      ctx,
    );

    if (
      isConfident({
        inlierCount: out.inlierCount,
        fovDeg: out.fovDeg ?? Infinity,
        logOdds: out.confidence,
      }) &&
      localLogOdds(out, stars, size, ctx) >= ACCEPT.minLogOdds &&
      heldOutLogOdds(c, stars, size, ctx) >= PROMOTE_MIN_HELD_OUT
    ) {
      return out;
    }
  }

  return null;
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
  const sorted = rankForSolving(stars, size.width, size.height);
  const regionInputs = SEARCH_REGIONS.map((region) => ({
    label: region.label,
    stars: sorted.filter(
      (s) =>
        Boolean(s.trail) === Boolean(region.trail) &&
        s.y < size.height * region.keepTop &&
        (!region.border ||
          (s.x > size.width * region.border &&
            s.x < size.width * (1 - region.border) &&
            s.y > size.height * region.border &&
            s.y < size.height * (1 - region.border))),
    ),
  })).filter(
    (region, i, all) =>
      region.stars.length >= MIN_REGION_STARS &&
      // 앞 영역과 실제로 쓰는 별이 같으면(아래쪽에 별이 없던 사진) 되풀이하지 않는다
      (i === 0 || !sameTopStars(region.stars, all[i - 1].stars)),
  );
  // solver 하나 안에서: 사진 전체를 입력 크기 순으로 보고(별다움 순으로 고른 입력이면 지면이 섞여도 대부분
  // 여기서 풀린다), 못 풀면 지면·가장자리를 빼는 영역들을 입력 크기 순으로 번갈아 본다
  // (15개: 위쪽 75% → 55% → 45% → 가운데, 그다음 25개 …). 큰 입력은 비싸서 작은 입력을 먼저 본다.
  const stepsFor = (regions: typeof regionInputs, list: Solver[] = solvers) =>
    list.flatMap((solver) => {
      const perRegion = regions.map((region) =>
        inputSizesFor(region.stars.length, solver.inputSizes).map(
          (inputSize) => ({
            solver,
            region,
            inputSize,
          }),
        ),
      );
      const rounds = Math.max(...perRegion.map((list) => list.length), 0);

      return Array.from({ length: rounds }, (_, k) =>
        perRegion.flatMap((list) => (k < list.length ? [list[k]] : [])),
      ).flat();
    });
  // solver마다 사진 전체를 먼저, 그다음 영역들. 빠른 solver(개선 quad, 단계당 수십~수백 ms)로 영역까지 다
  // 본 뒤 느린 solver(삼각형, 60개 단계는 수 초)로 넘어간다. 예전에는 두 solver로 사진 전체를 다 본 뒤에야
  // 영역으로 갔는데, 그때쯤이면 대개 8초가 지나 영역 단계는 391장 중 5장만 풀었다 (journey 40장).
  const steps = solvers.flatMap((solver) => [
    ...stepsFor(regionInputs.slice(0, 1), [solver]),
    ...stepsFor(regionInputs.slice(1), [solver]),
  ]);

  const allCandidates: SolveCandidateResult[] = [];
  let best: SolveOutcome | null = null;
  let evaluated = 0;
  let timedOut = false;
  const polished: Point3D[] = [];

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
      best = polish(out, region.stars, size, ctx);
      allCandidates.push(...best.candidates);
      break;
    }

    // 확신은 못 했지만 유망한 후보는 그 영역의 별 더 많이로 다시 맞춰 본다. 15~25개로 잰 점수는
    // 기준 근처에서 출렁여, 정답 후보가 기준 아래(6~8.5)에 머문 채 시간 상한까지 가곤 했다
    // (인터넷 사진 200장에서 1위 후보가 이미 정답인데 못 푼 사진 5장, journey 38장).
    const promoted = promoteCandidates(
      out.candidates,
      polished,
      region.stars,
      size,
      ctx,
    );

    if (promoted) {
      best = { ...out, ...promoted, found: true };
      allCandidates.push(...promoted.candidates);
      break;
    }
  }

  // 직선투영으로 확신하지 못했으면 어안(초광각) blind 풀이를 시도한다.
  let fisheyeCamera = null;

  if (!best && sorted.length > 0) {
    options.onPhase?.({ kind: "fisheye" });

    const fe = blindSolveFisheye(
      sorted
        .filter((s) => !s.trail)
        .slice(0, FISHEYE_INPUT_STARS)
        .map((s): Point2D => [s.x, s.y]),
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
