import type { Point3D } from "@/scripts/hash/types";
import type { RunRecord } from "@/scripts/validate/common";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { wcsToTransform } from "@/scripts/validate/astrometryTruth";
import { listPhotos, loadDetected, outDir } from "@/scripts/validate/common";
import { magellanSolve } from "@/scripts/validate/expLandmarkAuto";
import { photoToSky } from "@/search/utils/wcs";

// 이정표 실험 5 (journey 57장): 마젤란 은하 자동 풀이를 묶음 전체에 돌려 틀린 확신이 없는지 본다.
// 대조 기준: astrometry 정답지(WCS)가 있으면 그것, 없으면 그 묶음의 풀이 기록 중 앱이 확신한 답(어느 측정이든)
//   npx tsx src/scripts/validate/expLandmarkBatch.ts <묶음>...
const angle = (a: Point3D, b: Point3D) =>
  (Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) *
    180) /
  Math.PI;

const appAnswers = (set: string) => {
  const dir = resolve(outDir(set), "runs");
  const out = new Map<string, Point3D>();

  if (!existsSync(dir)) {
    return out;
  }

  for (const f of readdirSync(dir).filter((f) => f.endsWith(".jsonl"))) {
    for (const line of readFileSync(resolve(dir, f), "utf-8").split("\n")) {
      if (!line) {
        continue;
      }

      const r = JSON.parse(line) as RunRecord;

      if (r.found && r.center && !out.has(r.file)) {
        out.set(r.file, r.center);
      }
    }
  }

  return out;
};

const main = async () => {
  const tally = {
    photos: 0,
    sure: 0,
    checked: 0,
    wrong: 0,
    fresh: [] as string[],
  };

  for (const set of process.argv.slice(2)) {
    const app = appAnswers(set);

    for (const file of listPhotos(set)) {
      if (!loadDetected(set, file)) {
        continue;
      }

      tally.photos++;

      const { results, W, H, ms } = await magellanSolve(`${set}/${file}`);
      const best = results[0]?.fit;

      if (!best || best.logOdds < 5) {
        continue;
      }

      const ours = photoToSky(best.TP, [W / 2, H / 2]);
      const wcs = resolve(
        process.cwd(),
        "build/validate/astrometry",
        set,
        file.replace(/\.[^.]+$/, ".wcs"),
      );
      const truth = existsSync(wcs)
        ? { kind: "정답지", v: photoToSky(wcsToTransform(wcs), [W / 2, H / 2]) }
        : app.has(file)
          ? { kind: "앱", v: app.get(file)! }
          : null;
      const off = truth ? angle(ours, truth.v) : null;
      const sure = best.logOdds >= 9;

      if (sure) {
        tally.sure++;

        if (off === null) {
          tally.fresh.push(`${set}/${file}`);
        } else {
          tally.checked++;

          if (off > 2) {
            tally.wrong++;
          }
        }
      }

      console.log(
        `${set}/${file}\tlo${best.logOdds.toFixed(1)}${sure ? " 확신" : ""}\t${best.inliers}쌍 시야${best.fovDeg.toFixed(0)}° 어긋남 ${best.drift.map((d) => d.toFixed(0)).join("·")}px\t` +
          `${truth ? `${truth.kind}과 ${off!.toFixed(1)}°${off! > 2 ? " ✗" : ""}` : "대조 기준 없음"}\t${(ms / 1000).toFixed(1)}초`,
      );
    }
  }

  console.log(
    `\n사진 ${tally.photos}장, 확신 ${tally.sure}장: 대조 가능 ${tally.checked}장 중 틀림 ${tally.wrong}장, 대조 기준 없이 새로 확신 ${tally.fresh.length}장 ${tally.fresh.join(" ")}`,
  );
};

void main();
