import type { P } from "@/scripts/validate/landmarkPose";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { loadDetected } from "@/scripts/validate/common";
import { LMC, refineFromPair, SMC } from "@/scripts/validate/landmarkPose";
import { photoToSky } from "@/search/utils/wcs";
import { loadCatalog } from "@/test/synthetic/loadCatalog";

// 이정표 실험 4 (journey 57장): 대·소마젤란 은하 후보 덩어리를 자동으로 찾고, 후보 쌍마다 두 배정을 모두 다듬어 본다.
// 덩어리: 긴 변 320px 회색조에서 작은 흐림 − 큰 흐림의 극댓값, 반지름(고리 평균이 꼭대기의 절반 아래로 떨어지는 곳)이
// 점(별)보다 크고 너무 크지 않은 것. 크기 × 세기 순 상위 N개
//   npx tsx src/scripts/validate/expLandmarkAuto.ts <묶음/파일>   (NSTARS=400, NBLOBS=8)
const M = 320;

const blur = (src: Float32Array, w: number, h: number, r: number) => {
  let a = src;

  for (let pass = 0; pass < 3; pass++) {
    const tmp = new Float32Array(w * h);
    const out = new Float32Array(w * h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        let n = 0;

        for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) {
          s += a[y * w + k];
          n++;
        }

        tmp[y * w + x] = s / n;
      }
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        let n = 0;

        for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) {
          s += tmp[k * w + x];
          n++;
        }

        out[y * w + x] = s / n;
      }
    }

    a = out;
  }

  return a;
};

export const magellanSolve = async (photo: string, verbose = false) => {
  const [set, file] = photo.split("/");
  const det = loadDetected(set, file)!;
  const W = det.width;
  const H = det.height;
  const g = await sharp(
    resolve(process.cwd(), "public/samples-external", photo),
  )
    .resize(M, M, { fit: "inside" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = g.info.width;
  const h = g.info.height;
  const gray = Float32Array.from(g.data.subarray(0, w * h));
  const fine = blur(gray, w, h, 2);
  const wide = blur(gray, w, h, 14);
  const dog = fine.map((v, i) => v - wide[i]);
  let mean = 0;

  for (const v of dog) {
    mean += v / dog.length;
  }

  let sd = 0;

  for (const v of dog) {
    sd += (v - mean) ** 2 / dog.length;
  }

  sd = Math.sqrt(sd);

  const blobs: { x: number; y: number; peak: number; radius: number }[] = [];
  const LOCAL = 5;

  for (let y = LOCAL; y < h - LOCAL; y++) {
    for (let x = LOCAL; x < w - LOCAL; x++) {
      const v = dog[y * w + x];

      if (v < mean + Number(process.env.SIG ?? 3) * sd) {
        continue;
      }

      let isMax = true;

      for (let dy = -LOCAL; dy <= LOCAL && isMax; dy++) {
        for (let dx = -LOCAL; dx <= LOCAL; dx++) {
          if ((dx || dy) && dog[(y + dy) * w + x + dx] > v) {
            isMax = false;
            break;
          }
        }
      }

      if (!isMax) {
        continue;
      }

      // 반지름: 고리 평균이 꼭대기의 절반 아래로 처음 떨어지는 곳
      let radius = 0;

      for (let r = 1; r <= 30; r++) {
        let s = 0;
        let n = 0;

        for (let t = 0; t < 24; t++) {
          const xx = Math.round(x + r * Math.cos((t * Math.PI) / 12));
          const yy = Math.round(y + r * Math.sin((t * Math.PI) / 12));

          if (xx >= 0 && yy >= 0 && xx < w && yy < h) {
            s += dog[yy * w + xx];
            n++;
          }
        }

        if (n && s / n < v / 2) {
          radius = r;
          break;
        }
      }

      // 점(별)은 반지름 1~2, 너무 큰 덩어리(은하수 띠·하늘 밝기 차)는 0(끝까지 안 떨어짐)
      if (process.env.PROBE) {
        const [px, py] = process.env.PROBE.split(",").map(Number);

        if (
          Math.hypot(((x + 0.5) * W) / w - px, ((y + 0.5) * H) / h - py) < 60
        ) {
          console.log(
            `  확인: (${x},${y}) 값 ${v.toFixed(1)} (평균+${((v - mean) / sd).toFixed(1)}σ) 반지름 ${radius}`,
          );
        }
      }

      if (radius >= 3) {
        blobs.push({ x, y, peak: v, radius });
      }
    }
  }

  const top = blobs
    .sort((p, q) => q.peak * q.radius ** 2 - p.peak * p.radius ** 2)
    .slice(0, Number(process.env.NBLOBS ?? 8));
  const full = (b: { x: number; y: number }): P => [
    ((b.x + 0.5) * W) / w - 0.5,
    ((b.y + 0.5) * H) / h - 0.5,
  ];

  if (verbose) {
    console.log(
      `${photo}\t덩어리 ${blobs.length}개 중 상위: ` +
        top
          .map(
            (b, i) =>
              `${i}:(${full(b).map(Math.round).join(",")}) r${b.radius}`,
          )
          .join(" "),
    );
  }

  const stars = det.stars
    .slice(0, Number(process.env.NSTARS ?? 400))
    .map((s) => [s.x, s.y] as P);
  const catalog = loadCatalog().map((s) => ({ hr: s.hr, vector: s.vector }));
  const t0 = performance.now();
  const results: {
    i: number;
    j: number;
    fit: NonNullable<ReturnType<typeof refineFromPair>>;
  }[] = [];

  for (let i = 0; i < top.length; i++) {
    for (let j = 0; j < top.length; j++) {
      // i가 대마젤란: 대마젤란이 더 크다 (실제 약 2배). 너무 작으면 건너뛴다
      if (i === j || top[i].radius < 0.8 * top[j].radius) {
        continue;
      }

      const fit = refineFromPair(
        full(top[i]),
        full(top[j]),
        LMC,
        SMC,
        stars,
        catalog,
        W,
        H,
      );

      if (fit) {
        results.push({ i, j, fit });
      }
    }
  }

  results.sort((p, q) => q.fit.logOdds - p.fit.logOdds);

  const ms = performance.now() - t0;

  if (verbose) {
    console.log(
      `  쌍 ${results.length}개를 ${(ms / 1000).toFixed(1)}초에. 상위:`,
    );

    if (results[0] && process.env.SAVETP) {
      writeFileSync(process.env.SAVETP, JSON.stringify(results[0].fit.TP));
    }

    if (results[0]) {
      const v = photoToSky(results[0].fit.TP, [W / 2, H / 2]);
      const ra = ((Math.atan2(v[1], v[0]) * 180) / Math.PI + 360) % 360;
      const dec = (Math.asin(v[2]) * 180) / Math.PI;

      console.log(
        `  1위 답의 사진 가운데: 적경 ${ra.toFixed(2)}° 적위 ${dec.toFixed(2)}°`,
      );
    }

    for (const r of results.slice(0, 4)) {
      console.log(
        `   대${r.i}·소${r.j}  ${r.fit.inliers}쌍 lo${r.fit.logOdds.toFixed(1)} 시야${r.fit.fovDeg.toFixed(0)}° 잔차${r.fit.rms.toFixed(1)}px 어긋남 ${r.fit.drift.map((d) => d.toFixed(0)).join("·")}px${r.fit.logOdds >= 9 ? "  확신" : ""}`,
      );
    }
  }

  return { blobs: top.map(full), results, W, H, ms };
};

// 직접 실행할 때만 (전체 대조 스크립트는 magellanSolve만 가져다 쓴다)
if (process.argv[1]?.endsWith("expLandmarkAuto.ts")) {
  void magellanSolve(process.argv[2], true);
}
