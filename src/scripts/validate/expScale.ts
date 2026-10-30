import type { InputStar } from "@/search/solvers";
import type { Mat3 } from "@/search/utils/similarity";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import {
  listPhotos,
  loadClasses,
  loadDetected,
  photoDir,
  shardOf,
} from "@/scripts/validate/common";
import { loadRun } from "@/scripts/validate/report";
import { DEFAULT_SOLVERS, solvePhoto } from "@/search/solvePhoto";
import { buildSolverContext } from "@/search/solverContext";
import { mergeDistancePx, rankForSolving } from "@/search/utils/selectStars";
import { photoToSky } from "@/search/utils/wcs";
import { detectLikeApp } from "@/test/real/detectImage";
import {
  contextStars,
  loadCatalog,
  loadDeepStars,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

// 실험 (journey 54장, 사용자 단서: 280 카시오페이아·310 대삼각형): 밝은 별을 부드럽게 퍼뜨린 사진은 빛무리가
// 검출의 흐림(σ8)보다 넓어 밝은 별이 약하게 잡힌다. 사진을 줄여 다시 검출하면 빛무리가 점이 된다.
// 기준 풀이에서 확신 못 한 사진마다 세 가지를 번갈아 푼다 (부하가 섞여도 셋이 같이 받는다).
//   full: 지금 검출 그대로 · small: 줄인 사진 검출만 · front: 줄인 사진 검출 상위 SMALL_TOP개를 지금 검출 앞에
//   npx tsx src/scripts/validate/expScale.ts <기준 풀이> <ms> <배율> <묶음> [조각]
const SMALL_TOP = 15;

const angle = (a: number[], b: number[]) =>
  (Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) *
    180) /
  Math.PI;

const run = async () => {
  const [name, budget, scaleArg, set, shard] = process.argv.slice(2);
  const scale = Number(scaleArg);
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
  const solvedBefore = new Set(
    loadRun(set, name)
      .filter((r) => r.found)
      .map((r) => r.file),
  );
  const classes = loadClasses(set);

  for (const file of shardOf(listPhotos(set), shard)) {
    const d = loadDetected(set, file);

    // ONLY=web-280.jpg,web-310.jpg: 그 사진만
    if (process.env.ONLY && !process.env.ONLY.split(",").includes(file))
      continue;

    if (!d || solvedBefore.has(file)) continue;

    const { data, info } = await sharp(resolve(photoDir(set), file))
      .resize(
        Math.round(d.width * scale),
        Math.round(d.height * scale),
        // 줄일 때 픽셀을 평균한다 (빛무리가 고르게 모인다)
        { kernel: "cubic" },
      )
      .png()
      .toBuffer({ resolveWithObject: true });
    const sm = await detectLikeApp(data);
    const sx = d.width / info.width;
    const sy = d.height / info.height;
    const small = sm.stars.map((s) => ({ ...s, x: s.x * sx, y: s.y * sy }));
    // front: 줄인 사진 상위(우선순위 그대로) 별을 앞에 두고, 그와 겹치는 원래 검출은 뺀다.
    // 앞에 둔 별이 우선순위로 먼저 뽑히도록 별다움(작을수록 별답다)을 0, 밝기를 순서대로 가장 크게 준다
    const top = rankForSolving(small, d.width, d.height)
      .slice(0, SMALL_TOP)
      .map(({ aligned: _a, ...s }, i) => ({
        ...s,
        ringContrast: 0,
        brightness: 1e12 - i,
      }));
    const near = mergeDistancePx(d.width, d.height) * 2;
    const front = [
      ...top,
      ...d.stars.filter(
        (s) => !top.some((t) => Math.hypot(t.x - s.x, t.y - s.y) < near),
      ),
    ];
    const parts: string[] = [];

    for (const [label, stars] of [
      ["full", d.stars],
      ["small", small],
      ["front", front],
    ] as [string, InputStar[]][]) {
      const t0 = performance.now();
      const out = solvePhoto(
        stars,
        { width: d.width, height: d.height },
        ctx,
        DEFAULT_SOLVERS,
        { timeBudgetMs: Number(budget) },
      );
      const ms = performance.now() - t0;
      const t = truth[file];
      const vs =
        out.found && t
          ? angle(out.centerVector!, photoToSky(t, [d.width / 2, d.height / 2]))
          : null;
      parts.push(
        `${label}=${out.found ? `O(${out.confidence.toFixed(0)}${vs === null ? "" : ` 정답지 ${vs.toFixed(1)}°`})` : "x"} ${(ms / 1000).toFixed(1)}s`,
      );
    }

    console.log(
      `${set}/${file}\t${classes.get(file) ?? ""}\t${parts.join("\t")}`,
    );
  }
};

run();
