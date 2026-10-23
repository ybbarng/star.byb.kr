import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { SolverContext } from "@/search/solvers";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { REVERSAL_ROUND } from "@/game/humanVsComputer/rounds";
import {
  SEA_SCENE,
  seaSceneHorizon,
  seaSceneShotAt,
  seaSceneTP,
} from "@/game/humanVsComputer/seaScene";
import { shotDate } from "@/plate-solver/shotTime";
import { HORIZON_ACCEPT_LOG_ODDS, horizonSolve } from "@/search/horizonSolve";
import {
  DEFAULT_SOLVERS,
  DEFAULT_TIME_BUDGET_MS,
  solvePhoto,
} from "@/search/solvePhoto";
import { buildSolverContext } from "@/search/solverContext";
import { detectHorizon } from "@/search/utils/horizonDetect";
import { rankForSolving } from "@/search/utils/selectStars";
import { recoverCenter } from "@/search/utils/wcs";
import { detectLikeApp } from "@/test/real/detectImage";
import {
  catalogExists,
  contextStars,
  loadCatalog,
  loadHashes,
} from "@/test/synthetic/loadCatalog";
import { yieldToEventLoop } from "@/test/yieldToEventLoop";

// 사람 계산원 vs 컴퓨터의 반전 판(직접 만든 바닷가 장면, src/scripts/game/renderSeaScene.ts)이
// 게임의 이야기대로 나오는지 앱과 같은 흐름으로 확인한다:
// 별만으로는(풀이 Worker와 같은 solvePhoto, 8초 상한) 확신하지 못하고,
// 사람이 단서(판에 적어 둔 날짜·시각·장소 + 수평선)를 주면 시각·장소 풀이(Worker와 같은 입력)로 확신한다.

const PATH = resolve(process.cwd(), "public/samples", SEA_SCENE.file);
const ready = catalogExists() && existsSync(PATH);

const angleDeg = (a: Point3D, b: Point3D) =>
  (Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) *
    180) /
  Math.PI;

describe.skipIf(!ready)("사람 계산원 vs 컴퓨터: 반전 판 장면", () => {
  let stars: Awaited<ReturnType<typeof detectLikeApp>>["stars"];
  let photoStars: Point2D[];
  let ctx: SolverContext;
  const truth = recoverCenter(seaSceneTP(), SEA_SCENE.width, SEA_SCENE.height);
  const clues = REVERSAL_ROUND.clues!;

  beforeAll(async () => {
    const detected = await detectLikeApp(PATH);
    expect([detected.width, detected.height]).toEqual([
      SEA_SCENE.width,
      SEA_SCENE.height,
    ]);
    stars = detected.stars;
    // 풀이 Worker의 horizonSolve 경로와 같은 순서
    photoStars = rankForSolving(stars, SEA_SCENE.width, SEA_SCENE.height).map(
      (s): Point2D => [s.x, s.y],
    );
    ctx = buildSolverContext(contextStars(loadCatalog()), loadHashes());
  });

  const solveWithClues = (horizon: [Point2D, Point2D]) =>
    horizonSolve({
      photoStars,
      width: SEA_SCENE.width,
      height: SEA_SCENE.height,
      horizon,
      date: shotDate(clues.shot),
      observer: clues.shot.observer,
      catalog: contextStars(loadCatalog()).map(({ vector, mag }) => ({
        vector,
        mag,
      })),
    });

  it("단서는 판 데이터에서 오고, 알려 주는 시각은 찍은 시각보다 조금 늦다", () => {
    expect(REVERSAL_ROUND.file).toBe(SEA_SCENE.file);
    const lateMinutes =
      (shotDate(clues.shot).getTime() - seaSceneShotAt().getTime()) / 60000;
    expect(lateMinutes).toBeGreaterThan(0);
    expect(lateMinutes).toBeLessThan(90);
  });

  it("별만으로는 앱과 같은 8초 상한 안에 확신하지 못한다", async () => {
    const out = solvePhoto(
      stars,
      { width: SEA_SCENE.width, height: SEA_SCENE.height },
      ctx,
      DEFAULT_SOLVERS,
      { timeBudgetMs: DEFAULT_TIME_BUDGET_MS },
    );
    await yieldToEventLoop();

    expect(out.found).toBe(false);
  }, 60000);

  it("단서(날짜·시각·장소 + 정답 수평선)를 주면 정답 자세로 확신한다", () => {
    const r = solveWithClues(seaSceneHorizon())!;

    expect(r.logOdds).toBeGreaterThanOrEqual(HORIZON_ACCEPT_LOG_ODDS);
    expect(angleDeg(r.centerVector, truth)).toBeLessThan(1);
  }, 60000);

  it("컴퓨터가 찾은 수평선을 사람이 '맞아요'로 확인해도 확신한다", async () => {
    // 브라우저(plate-solver/autoHorizon.ts)처럼 긴 변 960px로 줄여 찾고, 사진 좌우 10%·90% 두 점으로
    const k = 960 / Math.max(SEA_SCENE.width, SEA_SCENE.height);
    const { data, info } = await sharp(PATH)
      .resize(Math.round(SEA_SCENE.width * k), Math.round(SEA_SCENE.height * k))
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const found = detectHorizon(
      data,
      info.width,
      info.height,
      info.channels,
      photoStars.slice(0, 60).map(([x, y]): Point2D => [x * k, y * k]),
    );

    expect(found).not.toBeNull();
    const [[, y0], [, y1]] = found!.line;
    const at = (fx: number): Point2D => [
      SEA_SCENE.width * fx,
      (y0 + (y1 - y0) * fx) / k,
    ];
    const r = solveWithClues([at(0.1), at(0.9)])!;

    expect(r.logOdds).toBeGreaterThanOrEqual(HORIZON_ACCEPT_LOG_ODDS);
    expect(angleDeg(r.centerVector, truth)).toBeLessThan(1);
  }, 60000);

  it("넉 달 어긋난 날짜를 주면 확신하지 않는다", () => {
    const wrong = new Date(shotDate(clues.shot).getTime() + 122 * 86400000);
    const r = horizonSolve({
      photoStars,
      width: SEA_SCENE.width,
      height: SEA_SCENE.height,
      horizon: seaSceneHorizon(),
      date: wrong,
      observer: clues.shot.observer,
      catalog: contextStars(loadCatalog()).map(({ vector, mag }) => ({
        vector,
        mag,
      })),
    });

    expect(r === null || r.logOdds < HORIZON_ACCEPT_LOG_ODDS).toBe(true);
  }, 60000);
});
