import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { glowPath, listPhotos, photoDir } from "@/scripts/validate/common";
import { toGray } from "@/search/detectImage";
import { GLOW_COLS, makeGlow, TEMPLATE_COLS } from "@/search/milkyWayGlow";

// 은하수 띠·지도 대조(journey 57장)에 쓰는 사진의 흐린 썸네일을 앱과 같은 함수(toGray → makeGlow)로 만들어 캐시한다.
// run.ts가 읽어 앱과 같은 흐름(solvePhotoWithMilkyWay)으로 푼다.
//   npx tsx src/scripts/validate/glows.ts <묶음>...
const round = (a: Float32Array) =>
  Array.from(a, (v) => Math.round(v * 10) / 10);

const main = async () => {
  for (const set of process.argv.slice(2)) {
    let made = 0;

    for (const file of listPhotos(set)) {
      const path = glowPath(set, file);

      if (existsSync(path)) {
        continue;
      }

      const { data, info } = await sharp(resolve(photoDir(set), file))
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const gray = toGray(data, info.width, info.height, info.channels);
      const band = makeGlow(gray, info.width, info.height, GLOW_COLS);
      const map = makeGlow(gray, info.width, info.height, TEMPLATE_COLS);

      mkdirSync(resolve(path, ".."), { recursive: true });
      writeFileSync(
        path,
        JSON.stringify({
          band: { ...band, data: round(band.data) },
          map: { ...map, data: round(map.data) },
        }),
      );
      made++;
    }

    console.log(`${set}: 새로 ${made}장`);
  }
};

void main();
