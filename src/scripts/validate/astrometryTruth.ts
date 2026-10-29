import type { Mat3 } from "@/search/utils/similarity";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { listPhotos } from "@/scripts/validate/common";
import { loadRun } from "@/scripts/validate/report";
import { projectVecToPhoto } from "@/search/utils/wcs";
import { loadCatalog } from "@/test/synthetic/loadCatalog";

// 분석용 정답지: astrometry.net(로컬 solve-field)이 푼 WCS를 우리 변환 행렬(하늘 벡터 → 픽셀, 직선투영)로 바꾼다.
// 앱 풀이에는 쓰지 않는다 (원칙 1). 왜곡 다항식(SIP)은 버리고 직선투영(TAN)만 쓴다.
//   npx tsx src/scripts/validate/astrometryTruth.ts <묶음>... → build/validate/astrometry/<묶음>/truth.json
// 우리 풀이가 확신한 사진이 있으면 두 답으로 밝은 별을 투영해 픽셀 차이를 보여 준다 (변환 확인)

const dir = (set: string) =>
  resolve(process.cwd(), "build/validate/astrometry", set);

export const wcsToTransform = (wcsPath: string): Mat3 => {
  const info = Object.fromEntries(
    execFileSync("wcsinfo", [wcsPath], { encoding: "utf8" })
      .trim()
      .split("\n")
      .map((l) => l.split(" "))
      .map(([k, v]) => [k, Number(v)]),
  );
  const a0 = (info.crval0 * Math.PI) / 180;
  const d0 = (info.crval1 * Math.PI) / 180;
  const c = [
    Math.cos(d0) * Math.cos(a0),
    Math.cos(d0) * Math.sin(a0),
    Math.sin(d0),
  ];
  const e = [-Math.sin(a0), Math.cos(a0), 0];
  const n = [
    -Math.sin(d0) * Math.cos(a0),
    -Math.sin(d0) * Math.sin(a0),
    Math.cos(d0),
  ];
  // CD⁻¹: (ξ, η)[도] → 픽셀 차이
  const det = info.cd11 * info.cd22 - info.cd12 * info.cd21;
  const m = [
    [info.cd22 / det, -info.cd12 / det],
    [-info.cd21 / det, info.cd11 / det],
  ];
  const k = 180 / Math.PI;
  // FITS 픽셀은 1부터 센다
  const cx = info.crpix0 - 1;
  const cy = info.crpix1 - 1;
  const row = (r: number, cp: number) =>
    [0, 1, 2].map((i) => k * (m[r][0] * e[i] + m[r][1] * n[i]) + cp * c[i]);

  return [row(0, cx), row(1, cy), c] as Mat3;
};

const run = () => {
  const cat = loadCatalog().filter((s) => s.v <= 3.5);

  for (const set of process.argv.slice(2)) {
    if (!existsSync(dir(set))) continue;

    const truth: Record<string, Mat3> = {};

    // WCS 파일 이름은 사진 이름에서 확장자만 뺀 것이다
    const photos = new Map(
      listPhotos(set).map((f) => [f.replace(/\.[^.]+$/, ""), f]),
    );

    for (const f of readdirSync(dir(set)).filter((x) => x.endsWith(".wcs"))) {
      const photo = photos.get(f.replace(/\.wcs$/, ""));

      if (photo) {
        truth[photo] = wcsToTransform(resolve(dir(set), f));
      }
    }

    writeFileSync(resolve(dir(set), "truth.json"), JSON.stringify(truth));
    console.log(set, "정답", Object.keys(truth).length, "장");

    // 우리 답과 비교 (확신한 사진만)
    for (const r of loadRun(set, "final3").filter(
      (x) => x.found && x.transform && truth[x.file],
    )) {
      const diffs = cat
        .flatMap((s) => {
          const p = projectVecToPhoto(r.transform!, s.vector);
          const q = projectVecToPhoto(truth[r.file], s.vector);

          return p && q && p[0] > 0 && p[1] > 0 && p[0] < 1920 && p[1] < 1440
            ? [Math.hypot(p[0] - q[0], p[1] - q[1])]
            : [];
        })
        .sort((x, y) => x - y);
      console.log(
        "  ",
        r.file,
        "밝은 별",
        diffs.length,
        "개 픽셀 차이 중앙",
        diffs[diffs.length >> 1]?.toFixed(1),
      );
    }
  }
};

if (process.argv[1]?.endsWith("astrometryTruth.ts")) {
  run();
}
