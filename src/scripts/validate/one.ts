import { loadDetected } from "@/scripts/validate/common";
import { DEFAULT_SOLVERS, solvePhoto } from "@/search/solvePhoto";
import { buildSolverContext } from "@/search/solverContext";
import {
  contextStars,
  loadCatalog,
  loadDeepCatalog,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

// 검출 캐시로 사진 몇 장만 푼다 (프로파일·디버그용).
//   [BUDGET=8000] npx tsx src/scripts/validate/one.ts <묶음> <파일>...
const ctx = buildSolverContext(contextStars(loadCatalog()), loadHashes());

// DEEP=<등급>: 검증에만 그 등급까지의 어두운 별을 쓴다 (run.ts와 같다)
if (process.env.DEEP) {
  ctx.verifyCatalog = loadDeepCatalog(Number(process.env.DEEP)).map(
    ({ hr, vector }) => ({ hr, vector }),
  );
}

for (const f of process.argv.slice(3)) {
  const d = loadDetected(process.argv[2], f)!;
  const out = solvePhoto(
    d.stars,
    { width: d.width, height: d.height },
    ctx,
    DEFAULT_SOLVERS,
    { timeBudgetMs: Number(process.env.BUDGET ?? 8000) },
  );
  console.log(
    f,
    out.found,
    out.confidence.toFixed(1),
    Math.round(out.timeMs),
    `후보 ${out.candidatesEvaluated}`,
  );
}
