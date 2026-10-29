import type { ReversalClues } from "@/game/humanVsComputer/rounds";
import type { DetectedStar } from "@/plate-solver/detectPhotoStars";
import type { Point2D } from "@/scripts/hash/types";
import type { HorizonSolveResult } from "@/search/horizonSolve";
import type { SolvePhotoResult } from "@/search/solvePhoto";
import { autoHorizon } from "@/plate-solver/autoHorizon";
import { detectPhotoStars } from "@/plate-solver/detectPhotoStars";
import { shotDate } from "@/plate-solver/shotTime";
import { HORIZON_ACCEPT_LOG_ODDS } from "@/search/horizonSolve";
import {
  horizonSolveInWorker,
  preloadSolver,
  solveInWorker,
} from "@/search/solverClient";

// 컴퓨터 쪽 풀이: 앱과 똑같이 별 찾기 Worker → 풀이 Worker(solvePhoto). 화면은 멈추지 않는다.
// 시간은 사진이 화면에 뜬 순간(사람의 시계가 출발한 순간)부터 답이 돌아올 때까지의 실제 시간으로 잰다.
// 별 지도·색인 준비(preloadSolver)는 게임 시작 화면에서 미리 해 두므로 시간에 넣지 않는다
// (사람도 별자리 모양을 미리 알고 시작하는 것과 같다).

export interface ComputerRun {
  stars: DetectedStar[];
  detectMs: number; // 별 찾기 (사진 → 별 목록)
  solveMs: number; // 풀이 Worker 왕복 (모양 맞추기 + 확인)
  totalMs: number;
  result: SolvePhotoResult;
  horizon: [Point2D, Point2D] | null; // 컴퓨터가 찾은 수평선 (반전 판의 단서 제안에 쓴다)
}

const inputOf = (stars: DetectedStar[]) =>
  stars.map((s) => ({
    x: s.x,
    y: s.y,
    brightness: s.brightness,
    ringContrast: s.ringContrast,
    trail: s.trail,
    chord: s.chord,
  }));

export const runComputer = async (
  image: HTMLImageElement,
): Promise<ComputerRun> => {
  // 준비가 아직 안 끝났으면 기다리되, 그 시간은 재지 않는다
  await preloadSolver();
  const t0 = performance.now();
  const stars = await detectPhotoStars(image);
  const t1 = performance.now();
  const result = await solveInWorker(inputOf(stars), image.width, image.height);
  const t2 = performance.now();

  return {
    stars,
    detectMs: t1 - t0,
    solveMs: t2 - t1,
    totalMs: t2 - t0,
    result,
    horizon: autoHorizon(
      image,
      stars.slice(0, 60).map((s): Point2D => [s.x, s.y]),
    ),
  };
};

export interface TeamRun {
  result: HorizonSolveResult | null;
  accepted: boolean;
  ms: number;
}

// 반전 판: 사람이 준 단서(판에 적어 둔 촬영 시각·장소, 사람이 확인하거나 찍은 수평선)로 다시 푼다
export const runWithClues = async (
  image: HTMLImageElement,
  stars: DetectedStar[],
  horizon: [Point2D, Point2D],
  { shot }: ReversalClues,
): Promise<TeamRun> => {
  const t0 = performance.now();
  const result = await horizonSolveInWorker(
    inputOf(stars),
    image.width,
    image.height,
    horizon,
    shotDate(shot),
    shot.observer,
  );

  return {
    result,
    accepted: !!result && result.logOdds >= HORIZON_ACCEPT_LOG_ODDS,
    ms: performance.now() - t0,
  };
};
