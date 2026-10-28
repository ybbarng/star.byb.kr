import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  detPath,
  listPhotos,
  photoDir,
  shardOf,
} from "@/scripts/validate/common";
import { detectLikeApp } from "@/test/real/detectImage";

// 사진 묶음의 검출을 미리 해서 캐시한다 (검출 코드를 바꾸면 FORCE=1로 다시).
//   npx tsx src/scripts/validate/detect.ts web-2026-10 [0/4]

const run = async () => {
  const [set, shard] = process.argv.slice(2);

  for (const file of shardOf(listPhotos(set), shard)) {
    const path = detPath(set, file);

    if (existsSync(path) && !process.env.FORCE) {
      continue;
    }

    const out = await detectLikeApp(resolve(photoDir(set), file));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(out));
  }
};

run();
