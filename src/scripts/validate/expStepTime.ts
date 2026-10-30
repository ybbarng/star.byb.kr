import { appendFileSync, writeFileSync } from "node:fs";
import {
  listPhotos,
  loadCoarse,
  loadDetected,
} from "@/scripts/validate/common";
import { solvePhoto } from "@/search/solvePhoto";
import { buildSolverContext } from "@/search/solverContext";
import {
  contextStars,
  loadCatalog,
  loadDeepStars,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

// 시간이 어느 단계에 쓰이나 (journey 59장): 앱 기본 흐름으로 풀며 단계가 바뀔 때마다 시각을 적어,
// 사진마다 (solver·영역) 단계별 쓴 시간과 확신한 단계·시각을 한 줄(JSON)로 남긴다.
// 조각·줄인 사진 단계는 안에서 다시 solvePhoto를 부르므로 같은 이름으로 섞인다 — 바깥 흐름의 순서로 구분한다
//   CLASS=은하수 npx tsx src/scripts/validate/expStepTime.ts <출력 jsonl> <상한 ms> <묶음>...
const [out, budget, ...sets] = process.argv.slice(2);
const ctx = buildSolverContext(
  contextStars(loadCatalog()),
  loadHashes(),
  undefined,
  loadDeepStars(),
);

writeFileSync(out, "");

for (const set of sets) {
  for (const file of listPhotos(set)) {
    const det = loadDetected(set, file);

    if (!det) {
      continue;
    }

    const marks: { t: number; key: string }[] = [];
    const t0 = performance.now();
    const res = solvePhoto(
      [...det.stars, ...loadCoarse(set, file)],
      { width: det.width, height: det.height },
      ctx,
      undefined,
      {
        timeBudgetMs: Number(budget),
        onPhase: (p) =>
          marks.push({
            t: performance.now() - t0,
            key:
              p.kind === "linear"
                ? `${p.solverKey}:${p.region}:${p.inputSize}`
                : p.kind,
          }),
      },
    );
    const total = performance.now() - t0;
    const spent: Record<string, number> = {};

    marks.forEach((m, i) => {
      const end = i + 1 < marks.length ? marks[i + 1].t : total;

      spent[m.key] = Math.round((spent[m.key] ?? 0) + end - m.t);
    });

    appendFileSync(
      out,
      `${JSON.stringify({
        file: `${set}/${file}`,
        found: res.found,
        timeMs: Math.round(total),
        last: marks[marks.length - 1]?.key ?? "",
        steps: marks.map((m) => [Math.round(m.t), m.key]),
        spent,
      })}\n`,
    );
  }
}
