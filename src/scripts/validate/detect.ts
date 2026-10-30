import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  coarsePath,
  detPath,
  listPhotos,
  photoDir,
  shardOf,
} from "@/scripts/validate/common";
import { detectCoarseLikeApp, detectLikeApp } from "@/test/real/detectImage";

// 사진 묶음의 검출을 미리 해서 캐시한다 (검출 코드를 바꾸면 FORCE=1로 다시).
// COARSE=1이면 줄인 사진 검출만 따로 캐시한다 (journey 54장)
//   npx tsx src/scripts/validate/detect.ts web-2026-10 [0/4]

const run = async () => {
  const [set, shard] = process.argv.slice(2);
  const coarse = Boolean(process.env.COARSE);

  for (const file of shardOf(listPhotos(set), shard)) {
    const path = coarse ? coarsePath(set, file) : detPath(set, file);

    if (existsSync(path) && !process.env.FORCE) {
      continue;
    }

    const src = resolve(photoDir(set), file);
    const out = coarse
      ? await detectCoarseLikeApp(src)
      : await detectLikeApp(src);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(out));
  }
};

run();
