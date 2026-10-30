import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { wcsToTransform } from "@/scripts/validate/astrometryTruth";
import { loadRun } from "@/scripts/validate/report";
import { photoToSky } from "@/search/utils/wcs";

// 풀이 기록을 조각 정답지(사진을 조각으로 잘라 astrometry로 푼 것, journey 53장)와 대조한다.
// 사진 전체 정답지가 없는 사진(astrometry가 사진 전체로는 못 푼 사진)도 조각 하나가 풀렸으면 확인할 수 있다.
// 우리 답으로 계산한 조각 가운데의 하늘 방향과 astrometry가 푼 조각 가운데의 각도(도)
//   npx tsx src/scripts/validate/tileTruthCheck.ts <풀이 이름> <묶음>...
const angle = (a: number[], b: number[]) =>
  (Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) *
    180) /
  Math.PI;

const [name, ...sets] = process.argv.slice(2);
const dir = resolve(process.cwd(), "build/validate/astrometry/tile-crops");
const map: Record<
  string,
  { set: string; file: string; label: string; rect: number[] }
> = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "public/samples-external/tile-crops/map.json"),
    "utf8",
  ),
);

for (const set of sets) {
  for (const r of loadRun(set, name)) {
    const tiles = Object.entries(map).filter(
      ([t, m]) =>
        m.set === set &&
        m.file === r.file &&
        existsSync(resolve(dir, t.replace(/\.jpg$/, ".wcs"))),
    );
    const parts = tiles.map(([t, m]) => {
      const [x0, y0, w, h] = m.rect;
      const truth = photoToSky(
        wcsToTransform(resolve(dir, t.replace(/\.jpg$/, ".wcs"))),
        [w / 2, h / 2],
      );
      const ours = r.transform
        ? photoToSky(r.transform, [x0 + w / 2, y0 + h / 2])
        : null;

      return `${m.label} ${ours ? angle(ours, truth).toFixed(1) : "-"}°`;
    });

    console.log(
      `${set}/${r.file}\t${r.found ? "확신" : "못 함"} ${r.confidence.toFixed(1)}\t${parts.length ? parts.join(", ") : "조각 정답 없음"}`,
    );
  }
}
