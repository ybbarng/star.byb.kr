import { loadDetected } from "@/scripts/validate/common";
import { DEFAULT_SOLVERS, solvePhoto } from "@/search/solvePhoto";
import { buildSolverContext } from "@/search/solverContext";
import {
  contextStars,
  loadCatalog,
  loadDeepStars,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

// 검출 캐시로 사진 몇 장만 푼다 (프로파일·디버그용).
//   [BUDGET=8000] npx tsx src/scripts/validate/one.ts <묶음> <파일>...
// 앱과 같이 검증 전용 어두운 별을 쓴다. DEEP=0이면 빼고 푼다 (비교용, journey 48장)
const ctx = buildSolverContext(
  contextStars(loadCatalog()),
  loadHashes(),
  undefined,
  process.env.DEEP === "0" ? undefined : loadDeepStars(),
);

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
