import type { Point3D } from "@/scripts/hash/types";
import type { SolverContext } from "@/search/solvers";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { answerVector, getSampleAnswer } from "@/plate-solver/sampleAnswers";
import { buildTriangleIndex } from "@/search/catalogGeometry";
import { buildCandidateIndex } from "@/search/findCandidatesCore";
import { solvePhoto } from "@/search/solvePhoto";
import { triangleSolver } from "@/search/solvers";
import { detectLikeApp } from "@/test/real/detectImage";
import {
  catalogExists,
  hashesExist,
  loadCatalog,
  loadHashes,
} from "@/test/synthetic/loadCatalog";
import { yieldToEventLoop } from "@/test/yieldToEventLoop";

const samplesDir = resolve(process.cwd(), "public/samples");
const ready = catalogExists() && hashesExist() && existsSync(samplesDir);

// 정답 중심에서 이 각도 이내면 맞힌 것으로 본다 (sampleAnswers.matchesAnswer와 같은 기준)
const ANSWER_TOLERANCE_DEG = 6;

// 사람 손 없이 자동으로 풀려야 하는 샘플 (지금 풀리는 것. 늘어나면 여기에 옮긴다)
const MUST_SOLVE = [
  "big-dipper.jpg",
  "cafe-orion.jpg",
  "20231012-nike-aust-01.jpg",
];

// 정답은 알지만 아직 자동으로는 못 푸는 샘플. 풀지 못해도 되지만 틀린 해를 확신하면 안 된다.
const MUST_NOT_BE_WRONG = [
  "20190617-jarrod-saipan.jpg",
  "20220328-brice-Milky Way over Buzzvil.jpg",
  "20230904-nike-jeungseun-02.png",
];

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
    const catalog = loadCatalog();
    const solveStars = catalog.map((s) => ({ hr: s.hr, vector: s.vector }));
    ctx = {
      index: buildCandidateIndex(loadHashes()),
      catalog: solveStars,
      byHrVec: new Map(catalog.map((s) => [s.hr, s.vector])),
      triangleIndex: buildTriangleIndex(solveStars, 18),
    };
  });

  const solveSample = async (file: string) => {
    const { stars, width, height } = await detectLikeApp(
      resolve(samplesDir, file),
    );
    // 맞히는지를 보는 테스트라 시간 상한은 끈다. 실제 시계 기준 상한은 CPU 부하에 따라
    // 결과가 달라져(병렬 실행 시 시간 초과) 테스트가 결정적이지 않게 된다.
    const out = solvePhoto(stars, { width, height }, ctx, triangleSolver, {
      timeBudgetMs: Infinity,
    });
    await yieldToEventLoop();

    return out;
  };

  it.each(MUST_SOLVE)(
    "%s: 자동으로 정답을 확신한다",
    async (file) => {
      const answer = getSampleAnswer(file);
      const out = await solveSample(file);

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
      const out = await solveSample(file);

      expect(answer).not.toBeNull();

      if (out.found && out.centerVector) {
        expect(angleDeg(out.centerVector, answerVector(answer!))).toBeLessThan(
          ANSWER_TOLERANCE_DEG,
        );
      }
    },
    60000,
  );
});
