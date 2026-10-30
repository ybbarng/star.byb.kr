import type { InputStar } from "@/search/solvers";
import { resolve } from "node:path";
import sharp from "sharp";
import {
  judge,
  listPhotos,
  loadClasses,
  loadDetected,
  loadSkyMapFile,
  photoDir,
} from "@/scripts/validate/common";
import { loadRun } from "@/scripts/validate/report";
import { GLOW_COLS, makeGlow, TEMPLATE_COLS } from "@/search/milkyWayGlow";
import { solveByMilkyWay } from "@/search/milkyWaySolve";
import { buildSolverContext } from "@/search/solverContext";
import {
  contextStars,
  loadCatalog,
  loadDeepStars,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

// 앱의 은하수 띠·지도 대조 풀이(search/milkyWaySolve)를 실험(expBandSolve)과 같은 사진에 돌려 같은 결과인지 본다.
// 사진 흐린 밝기도 앱과 같은 함수(makeGlow)로 만든다. 못 푼 은하수 사진만 (ALL=1이면 풀린 사진도)
//   npx tsx src/scripts/validate/milkyWayCheck.ts <풀이 이름> <묶음>...   (BUDGET=초, 기본 6)
const main = async () => {
  const [name, ...sets] = process.argv.slice(2);
  const ctx = buildSolverContext(
    contextStars(loadCatalog()),
    loadHashes(),
    undefined,
    loadDeepStars(),
  );
  const skyMap = loadSkyMapFile();
  const budget = Number(process.env.BUDGET ?? 6) * 1000;
  let tried = 0;
  let solved = 0;

  for (const set of sets) {
    const runs = new Map(loadRun(set, name).map((r) => [r.file, r]));
    const classes = loadClasses(set);

    for (const file of listPhotos(set)) {
      const d = loadDetected(set, file);

      if (!d || classes.get(file) !== "은하수") {
        continue;
      }

      if (runs.get(file)?.found && !process.env.ALL) {
        continue;
      }

      tried++;

      const { data, info } = await sharp(resolve(photoDir(set), file))
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const t0 = performance.now();
      const glows = {
        band: makeGlow(data, info.width, info.height, GLOW_COLS),
        // FAST=1: 지도 대조를 48칸으로 (51장의 빠른 설정)
        map: makeGlow(
          data,
          info.width,
          info.height,
          process.env.FAST ? 48 : TEMPLATE_COLS,
        ),
      };
      const tGlow = performance.now() - t0;
      const out = solveByMilkyWay(
        d.stars as InputStar[],
        { width: d.width, height: d.height },
        ctx,
        glows,
        skyMap,
        performance.now() + budget,
        process.env.FAST
          ? { starPool: 300, templatePool: 1000, mapPick: 300 }
          : undefined,
      );
      const ms = Math.round(performance.now() - t0);
      const j = out?.transform ? judge(d, out.transform, false) : null;

      if (out) {
        solved++;
      }

      console.log(
        `${set}/${file}\t${out ? `확신 lo${out.confidence.toFixed(1)} 판정 ${j?.verdict}` : "못 풂"}\t${ms}ms (썸네일 ${Math.round(tGlow)}ms)`,
      );
    }
  }

  console.log(`\n사진 ${tried}장 · 확신 ${solved}장`);
};

void main();
