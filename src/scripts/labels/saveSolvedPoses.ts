// 자동으로 풀리는 실제 샘플의 변환(TP)을 저장한다. 검출 하나하나가 "풀이에 쓸모 있는
// 진짜 별"인지 라벨을 붙이는 기준이 된다 (src/test/real/detectionLabels.ts).
// 풀이 코드가 바뀌어도 라벨 기준은 그대로 두려고 결과를 파일로 고정한다.
// 실행: npx tsx src/scripts/labels/saveSolvedPoses.ts
import type { Mat3 } from "@/search/utils/similarity";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSampleAnswer, matchesAnswer } from "@/plate-solver/sampleAnswers";
import { solvePhoto } from "@/search/solvePhoto";
import { buildSolverContext } from "@/search/solverContext";
import { detectLikeApp } from "@/test/real/detectImage";
import { SOLVED_SAMPLES } from "@/test/real/solvedSamples";
import {
  contextStars,
  loadCatalog,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

const main = async () => {
  const ctx = buildSolverContext(contextStars(loadCatalog()), loadHashes());
  const poses: Record<string, { width: number; height: number; TP: Mat3 }> = {};

  for (const file of SOLVED_SAMPLES) {
    const { stars, width, height } = await detectLikeApp(
      resolve("public/samples", file),
    );
    const out = solvePhoto(stars, { width, height }, ctx, undefined, {
      timeBudgetMs: Infinity,
    });
    const answer = getSampleAnswer(file);

    if (
      !out.found ||
      !out.transform ||
      !out.centerVector ||
      !answer ||
      !matchesAnswer(out.centerVector, answer)
    ) {
      throw new Error(`${file}: 정답으로 풀리지 않았다`);
    }

    poses[file] = { width, height, TP: out.transform };
    console.warn(`${file}: log-odds ${out.confidence.toFixed(1)}`);
  }

  writeFileSync(
    resolve("src/test/real/solvedPoses.json"),
    `${JSON.stringify(poses, null, 2)}\n`,
  );
};

main();
