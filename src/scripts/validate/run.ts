import type { RunRecord } from "@/scripts/validate/common";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  listPhotos,
  loadCoarse,
  loadDetected,
  outDir,
  shardOf,
} from "@/scripts/validate/common";
import { loadRun } from "@/scripts/validate/report";
import { DEFAULT_SOLVERS, solvePhoto } from "@/search/solvePhoto";
import { buildSolverContext } from "@/search/solverContext";
import {
  contextStars,
  loadCatalog,
  loadDeepStars,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

// 앱과 같은 흐름(solvePhoto 기본값)으로 묶음을 풀어 사진마다 한 줄(JSON)씩 기록한다.
//   npx tsx src/scripts/validate/run.ts web-2026-10 8000 base [0/4]
// → build/validate/web-2026-10/runs/base.<조각>.jsonl

const run = () => {
  const [set, budget, name, shard] = process.argv.slice(2);
  // 앱과 같이 검증 전용 어두운 별을 쓴다. DEEP=0이면 빼고 푼다 (비교용, journey 48장)
  const ctx = buildSolverContext(
    contextStars(loadCatalog()),
    loadHashes(),
    undefined,
    process.env.DEEP === "0" ? undefined : loadDeepStars(),
  );

  const dir = resolve(outDir(set), "runs");
  const path = resolve(
    dir,
    `${name}.${(shard ?? "0/1").replace("/", "-")}.jsonl`,
  );
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, "");

  // UNSOLVED=<이름>: 그 풀이 기록에서 확신 못 한 사진만 (시간 상한을 늘려 다시 볼 때)
  const skip = process.env.UNSOLVED
    ? new Set(
        loadRun(set, process.env.UNSOLVED)
          .filter((r) => r.found)
          .map((r) => r.file),
      )
    : new Set<string>();

  for (const file of shardOf(listPhotos(set), shard).filter(
    (f) => !skip.has(f),
  )) {
    const det = loadDetected(set, file);

    if (!det) {
      continue;
    }

    let phase = "";

    if (process.env.DBG) {
      console.log("file", file);
    }

    const coarseShare = Number(process.env.COARSE_SHARE ?? 0);
    const out = solvePhoto(
      [
        // BRIGHT_ONLY=1: 별다움을 지워 밝기 순으로만 푼다 (은하수 실험, journey 52장)
        ...(process.env.BRIGHT_ONLY
          ? det.stars.map(({ ringContrast: _r, ...s }) => s)
          : det.stars),
        // COARSE_SHARE=0.25: 줄인 사진 검출(detect.ts COARSE=1 캐시)을 붙이고 확신 못 하면 그 몫으로 다시 푼다 (journey 54장)
        ...(coarseShare > 0 ? loadCoarse(set, file) : []),
      ],
      { width: det.width, height: det.height },
      ctx,
      DEFAULT_SOLVERS,
      {
        timeBudgetMs: Number(budget),
        // BRIGHT_FALLBACK=0.3: 확신 못 하면 남은 시간의 30%로 밝기 순 재시도 (journey 52장)
        brightFallbackShare: Number(process.env.BRIGHT_FALLBACK ?? 0),
        // TILE_SHARE=0.3: 확신 못 하면 남은 시간의 30%로 조각 풀이 (journey 53장)
        tileShare: Number(process.env.TILE_SHARE ?? 0),
        coarseShare,
        onPhase: (p) => {
          phase =
            p.kind === "linear"
              ? `${p.index}:${p.solverKey}:${p.region}:${p.inputSize}`
              : "fisheye";
        },
      },
    );
    const top = out.found ? out : out.candidates[0];
    const record: RunRecord = {
      file,
      found: out.found,
      confidence: top?.confidence ?? 0,
      inliers: top?.inlierCount ?? 0,
      center: top?.centerVector ?? null,
      fovDeg: top?.fovDeg ?? null,
      transform: top?.transform ?? null,
      timeMs: Math.round(out.timeMs),
      timedOut: out.timedOut,
      phase,
      fisheye: Boolean(out.fisheyeCamera),
      fisheyeCamera: out.fisheyeCamera ?? null,
      trailAngleDeg: out.trailAngleDeg,
    };
    appendFileSync(path, `${JSON.stringify(record)}\n`);
  }
};

run();
