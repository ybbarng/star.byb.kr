import type { Mat3 } from "@/search/utils/similarity";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  listPhotos,
  loadClasses,
  loadCoarse,
  loadDetected,
  shardOf,
} from "@/scripts/validate/common";
import { DEFAULT_SOLVERS, solvePhoto } from "@/search/solvePhoto";
import { buildSolverContext } from "@/search/solverContext";
import { photoToSky } from "@/search/utils/wcs";
import {
  contextStars,
  loadCatalog,
  loadDeepStars,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

// 재시도 선택지 하나를 기준선(앱 기본값)과 사진마다 번갈아 바로 이어 푼다 (journey 54장).
// 다른 작업의 부하가 오르내려도 두 방식이 거의 같은 부하를 받는다 (따로 재면 1초 안에 풀리던 사진까지 놓쳤다, 53장).
// 기준선은 앱과 같이 줄인 사진 검출을 붙여 기본값으로 풀되 그 선택지만 끈다(0).
//   npx tsx src/scripts/validate/abShare.ts <ms> <선택지: coarseShare|tileShare|brightFallbackShare> <몫> <묶음> [조각]
// 한 줄: 묶음/파일 분류 A(기준) B(선택지) 각각 O/x·log-odds·시간·정답지 각도
const angle = (a: number[], b: number[]) =>
  (Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) *
    180) /
  Math.PI;

const run = () => {
  const [budget, option, shareArg, set, shard] = process.argv.slice(2);
  const share = Number(shareArg);
  const ctx = buildSolverContext(
    contextStars(loadCatalog()),
    loadHashes(),
    undefined,
    loadDeepStars(),
  );
  const tp = resolve(
    process.cwd(),
    "build/validate/astrometry",
    set,
    "truth.json",
  );
  const truth: Record<string, Mat3> = existsSync(tp)
    ? JSON.parse(readFileSync(tp, "utf8"))
    : {};
  const classes = loadClasses(set);
  let i = 0;

  for (const file of shardOf(listPhotos(set), shard)) {
    const d = loadDetected(set, file);

    if (!d) continue;

    const stars = [...d.stars, ...loadCoarse(set, file)];

    const solve = (s: number | null) => {
      const out = solvePhoto(
        stars,
        { width: d.width, height: d.height },
        ctx,
        DEFAULT_SOLVERS,
        {
          timeBudgetMs: Number(budget),
          [option]: s ?? 0,
        },
      );
      const t = truth[file];
      const vs =
        out.found && t
          ? angle(out.centerVector!, photoToSky(t, [d.width / 2, d.height / 2]))
          : null;

      return `${out.found ? "O" : "x"} ${out.confidence.toFixed(1)} ${Math.round(out.timeMs)} ${vs === null ? "-" : vs.toFixed(1)}`;
    };

    // 순서도 번갈아 (먼저 도는 쪽이 늘 유리하거나 불리하지 않게)
    const [a, b] =
      i++ % 2 === 0
        ? [solve(null), solve(share)]
        : (() => {
            const bb = solve(share);

            return [solve(null), bb];
          })();

    console.log(`${set}/${file}\t${classes.get(file) ?? ""}\t${a}\t${b}`);
  }
};

run();
