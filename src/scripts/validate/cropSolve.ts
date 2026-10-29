import { resolve } from "node:path";
import sharp from "sharp";
import { photoDir } from "@/scripts/validate/common";
import { DEFAULT_SOLVERS, solvePhoto } from "@/search/solvePhoto";
import { buildSolverContext } from "@/search/solverContext";
import { detectLikeApp } from "@/test/real/detectImage";
import {
  contextStars,
  loadCatalog,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

// 확인용: 사진 일부(left, top, width, height 비율 0~1)만 잘라 앱과 같은 흐름으로 푼다 (캡처 화면·테두리·글자 빼기)
//   npx tsx src/scripts/validate/cropSolve.ts <묶음> <파일> <left> <top> <width> <height>
const run = async () => {
  const [set, file, ...box] = process.argv.slice(2);
  const [l, t, w, h] = box.map(Number);
  const path = resolve(photoDir(set), file);
  const meta = await sharp(path).metadata();
  const region = {
    left: Math.round(l * meta.width!),
    top: Math.round(t * meta.height!),
    width: Math.round(w * meta.width!),
    height: Math.round(h * meta.height!),
  };
  const buf = await sharp(path).extract(region).png().toBuffer();
  const det = await detectLikeApp(buf);
  const ctx = buildSolverContext(contextStars(loadCatalog()), loadHashes());
  const out = solvePhoto(
    det.stars,
    { width: det.width, height: det.height },
    ctx,
    DEFAULT_SOLVERS,
  );
  console.log(
    file,
    `${region.width}×${region.height}`,
    "검출",
    det.stars.length,
    "확신",
    out.found,
    out.confidence.toFixed(1),
    "시야",
    out.fovDeg?.toFixed(0),
    Math.round(out.timeMs),
    "ms",
  );
};

run();
