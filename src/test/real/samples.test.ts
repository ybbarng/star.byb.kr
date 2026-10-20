import type { Point3D } from "@/scripts/hash/types";
import type { SolverContext } from "@/search/solvers";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { answerVector, getSampleAnswer } from "@/plate-solver/sampleAnswers";
import {
  DEFAULT_SOLVERS,
  DEFAULT_TIME_BUDGET_MS,
  solvePhoto,
} from "@/search/solvePhoto";
import { buildSolverContext } from "@/search/solverContext";
import { detectLikeApp } from "@/test/real/detectImage";
import {
  catalogExists,
  hashesExist,
  loadCatalog,
  loadHashes,
  contextStars,
} from "@/test/synthetic/loadCatalog";
import { yieldToEventLoop } from "@/test/yieldToEventLoop";

const samplesDir = resolve(process.cwd(), "public/samples");
const ready = catalogExists() && hashesExist() && existsSync(samplesDir);

// 정답 중심에서 이 각도 이내면 맞힌 것으로 본다 (sampleAnswers.matchesAnswer와 같은 기준)
const ANSWER_TOLERANCE_DEG = 6;

// 못 푸는 샘플은 앱과 같은 시간 상한으로 돌린다 (아래 solveSample 설명)
const UNSOLVED_BUDGET_MS = DEFAULT_TIME_BUDGET_MS;

// 사람 손 없이 자동으로 풀려야 하는 샘플 (지금 풀리는 것. 늘어나면 여기에 옮긴다)
const MUST_SOLVE = [
  "big-dipper.jpg",
  "cafe-orion.jpg",
  "20220328-brice-Milky Way over Buzzvil.jpg",
  "20220607-berry-seoul.jpg",
  "20230904-nike-jeungseun-01.png",
  "20230904-nike-jeungseun-02.png",
  "20230904-nike-jeungseun-03.png",
  "20230904-nike-jeungseun-04.png",
  "20231012-nike-aust-01.jpg",
  "20231012-nike-aust-02.jpg",
  "20250117-carl-aurora-01.jpg",
  "20250117-carl-aurora-02.jpg",
  "20250117-carl-aurora-03.jpg",
  "20250117-carl-aurora-04.jpg",
];

// 정답은 알지만 아직 자동으로는 못 푸는 샘플. 풀지 못해도 되지만 틀린 해를 확신하면 안 된다.
const MUST_NOT_BE_WRONG = ["20190617-jarrod-saipan.jpg"];

// 진짜 밤하늘이 아닐 수 있는 사진 (사용자: 구글에서 찾은 가짜일 수 있음, 확인 필요).
// 어떤 해도 확신하면 안 된다. 진짜로 밝혀지고 검증되면 MUST_SOLVE로 옮긴다.
const MAYBE_FAKE = ["google-unknown.jpg"];

const angleDeg = (a: Point3D, b: Point3D): number =>
  (Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) *
    180) /
  Math.PI;

// 앱과 같은 흐름(자동 검출 → 중복 합치기 → 밝기 상위 → solvePhoto)으로 실제 샘플을 푼다.
describe.skipIf(!ready)("실제 샘플: 앱 흐름 회귀", () => {
  let ctx: SolverContext;

  beforeAll(() => {
    // 앱과 같은 인덱스 설정
    ctx = buildSolverContext(contextStars(loadCatalog()), loadHashes());
  });

  // timeBudgetMs: 풀어야 하는 샘플은 상한을 끈다(무제한). 실제 시계 기준 상한은 CPU 부하에
  // 따라 결과가 달라져 "풀었는가"가 결정적이지 않게 된다.
  // 못 푸는 샘플은 끝까지 찾으면 영역 3개 × solver 2개라 수십 초가 걸려, 앱과 같은 상한으로
  // 돌린다(앱이 실제로 보여 줄 결과를 확인). 탐색이 줄면 오답을 놓칠 수는 있어도 없는 오답을
  // 만들지는 않으므로, "틀린 해를 확신하지 않는다"가 잘못 실패하지는 않는다.
  const solveSample = async (file: string, timeBudgetMs: number) => {
    const { stars, width, height } = await detectLikeApp(
      resolve(samplesDir, file),
    );
    const out = solvePhoto(stars, { width, height }, ctx, DEFAULT_SOLVERS, {
      timeBudgetMs,
    });
    await yieldToEventLoop();

    return out;
  };

  it.each(MUST_SOLVE)(
    "%s: 자동으로 정답을 확신한다",
    async (file) => {
      const answer = getSampleAnswer(file);
      const out = await solveSample(file, Infinity);

      expect(answer).not.toBeNull();
      expect(out.found).toBe(true);
      expect(
        angleDeg(out.centerVector as Point3D, answerVector(answer!)),
      ).toBeLessThan(ANSWER_TOLERANCE_DEG);
    },
    60000,
  );

  it.each(MUST_NOT_BE_WRONG)(
    "%s: 틀린 해를 확신하지 않는다",
    async (file) => {
      const answer = getSampleAnswer(file);
      const out = await solveSample(file, UNSOLVED_BUDGET_MS);

      expect(answer).not.toBeNull();

      if (out.found && out.centerVector) {
        expect(angleDeg(out.centerVector, answerVector(answer!))).toBeLessThan(
          ANSWER_TOLERANCE_DEG,
        );
      }
    },
    60000,
  );

  it.each(MAYBE_FAKE)(
    "%s: 가짜일 수 있는 사진에서 어떤 해도 확신하지 않는다",
    async (file) => {
      const out = await solveSample(file, UNSOLVED_BUDGET_MS);

      expect(out.found).toBe(false);
    },
    60000,
  );
});
