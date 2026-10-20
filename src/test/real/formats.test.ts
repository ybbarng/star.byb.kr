import type { Point3D } from "@/scripts/hash/types";
import type { SolverContext } from "@/search/solvers";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { answerVector, getSampleAnswer } from "@/plate-solver/sampleAnswers";
import { DEFAULT_SOLVERS, solvePhoto } from "@/search/solvePhoto";
import { buildSolverContext } from "@/search/solverContext";
import { detectLikeApp } from "@/test/real/detectImage";
import {
  catalogExists,
  contextStars,
  loadCatalog,
  loadHashes,
} from "@/test/synthetic/loadCatalog";
import { yieldToEventLoop } from "@/test/yieldToEventLoop";

// 사진 형식이 달라도 같은 흐름으로 풀린다: 사용자는 JPEG뿐 아니라 PNG·WebP(웹에서 받은 사진, 변환기)를 올린다.
// 안정적으로 풀리는 샘플(별이 적은 사진, 큰 사진, 오로라)만 쓴다 — 형식 지원을 지키는 테스트지, 경계 사진의 흔들림을 재는 게 아니다.
// (2026-10-20 측정: 풀리는 14장을 WebP 품질 90·75·50으로 바꾸면 40/42, JPEG 재압축·축소 68/70, 틀린 확신 0.
//  못 푼 둘은 형식과 상관없이 흔들리는 경계 사진(은하수·서울 누각) — journey 29장)
const samplesDir = resolve(process.cwd(), "public/samples");
const FILES = [
  "big-dipper.jpg",
  "20231012-nike-aust-01.jpg",
  "20250117-carl-aurora-04.jpg",
];
const FORMATS = {
  "WebP 75": (b: Buffer) => sharp(b).webp({ quality: 75 }).toBuffer(),
  PNG: (b: Buffer) => sharp(b).png().toBuffer(),
};
const ready = catalogExists() && existsSync(samplesDir);

const angleDeg = (a: Point3D, b: Point3D) =>
  (Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) *
    180) /
  Math.PI;

describe.skipIf(!ready)("사진 형식이 달라도 풀린다", () => {
  let ctx: SolverContext;

  beforeAll(() => {
    ctx = buildSolverContext(contextStars(loadCatalog()), loadHashes());
  });

  const cases = FILES.flatMap((file) =>
    (Object.keys(FORMATS) as (keyof typeof FORMATS)[]).map(
      (format) => [file, format] as const,
    ),
  );

  it.each(cases)(
    "%s → %s",
    async (file, format) => {
      const converted = await FORMATS[format](
        readFileSync(resolve(samplesDir, file)),
      );
      const { stars, width, height } = await detectLikeApp(converted);
      const out = solvePhoto(stars, { width, height }, ctx, DEFAULT_SOLVERS, {
        timeBudgetMs: Infinity,
      });
      await yieldToEventLoop();

      expect(out.found).toBe(true);
      expect(
        angleDeg(
          out.centerVector as Point3D,
          answerVector(getSampleAnswer(file)!),
        ),
      ).toBeLessThan(6);
    },
    60000,
  );
});
