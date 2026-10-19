import type { Point3D } from "@/scripts/hash/types";
import type { SolverContext } from "@/search/solvers";
import type { CatalogStar } from "@/test/synthetic/loadCatalog";
import { beforeAll, describe, expect, it } from "vitest";
import { buildTriangleIndex } from "@/search/catalogGeometry";
import { buildCandidateIndex } from "@/search/findCandidatesCore";
import { solveCandidate } from "@/search/solveCore";
import { solvers } from "@/search/solvers";
import { comparePose } from "@/test/metrics/poseMetrics";
import { generateSyntheticImage } from "@/test/synthetic/generateSyntheticImage";
import {
  catalogExists,
  hashesExist,
  loadCatalog,
  loadHashes,
} from "@/test/synthetic/loadCatalog";
import { yieldToEventLoop } from "@/test/yieldToEventLoop";

const ready = catalogExists() && hashesExist();

const skyVector = (raDeg: number, decDeg: number): Point3D => {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;

  return [
    Math.cos(dec) * Math.cos(ra),
    Math.cos(dec) * Math.sin(ra),
    Math.sin(dec),
  ];
};

const W = 1600;
const H = 1200;
const CENTER_TOL_DEG = 1.5;

// 별이 충분히 많은 방향들
const directions: [number, number][] = [
  [85, 5],
  [200, -20],
  [330, 60],
  [150, 10],
  [270, 30],
  [50, 40],
];

// 작은 별자리(망원)부터 큰 별자리(광각)까지. orion(~20도)·북두칠성(~25도)은 큰 편.
const fovs = [12, 20, 30, 45];

describe.skipIf(!ready)("견고성: FOV별 정답률", () => {
  let catalog: CatalogStar[];
  let ctx: SolverContext;

  beforeAll(() => {
    catalog = loadCatalog();
    const solveStars = catalog.map((s) => ({ hr: s.hr, vector: s.vector }));
    ctx = {
      index: buildCandidateIndex(loadHashes()),
      catalog: solveStars,
      byHrVec: new Map(catalog.map((s) => [s.hr, s.vector])),
      triangleIndex: buildTriangleIndex(solveStars, 18),
    };
  });

  it("FOV별로 4개 알고리즘 정답률을 측정한다", async () => {
    // solverKey → fovDeg → {solved, total}
    const tally: Record<
      string,
      Record<number, { solved: number; total: number }>
    > = {};

    for (const solver of solvers) {
      tally[solver.key] = {};

      for (const fov of fovs) {
        tally[solver.key][fov] = { solved: 0, total: 0 };
      }
    }

    for (const fovDeg of fovs) {
      for (let d = 0; d < directions.length; d++) {
        const [ra, dec] = directions[d];
        const img = generateSyntheticImage(catalog, {
          center: skyVector(ra, dec),
          fovDeg,
          rotationDeg: 25,
          width: W,
          height: H,
          magnitudeLimit: 5,
          seed: 3000 + d,
          noise: { jitterPx: 1, falseRatio: 0.3 }, // 약한 노이즈(L1 수준)
        });

        if (img.trueStars.length < 6) {
          continue;
        }

        const inputStars = img.stars.map((s) => ({
          x: s.x,
          y: s.y,
          brightness: s.brightness,
        }));

        for (const solver of solvers) {
          const cell = tally[solver.key][fovDeg];
          cell.total++;

          const out = solver.solve(inputStars, { width: W, height: H }, ctx);
          // 동기 계산이 60초 넘게 이어지면 vitest 워커 RPC가 타임아웃난다.
          await yieldToEventLoop();

          if (out.found && out.transform) {
            const pose = comparePose(out.transform, img.groundTruth);

            if (pose.centerErrorDeg < CENTER_TOL_DEG) {
              cell.solved++;
            }
          }
        }
      }
    }

    const lines: string[] = ["\n=== FOV별 정답률 (약노이즈) ==="];
    lines.push(
      `알고리즘\\FOV   ${fovs.map((f) => `${f}°`.padStart(7)).join("")}`,
    );

    for (const solver of solvers) {
      const cells = fovs
        .map((f) => {
          const c = tally[solver.key][f];

          return `${c.solved}/${c.total}`.padStart(7);
        })
        .join("");
      lines.push(`${solver.name.slice(0, 12).padEnd(14)}${cells}`);
    }

    console.warn(lines.join("\n"));
    expect(Object.keys(tally).length).toBe(solvers.length);
  }, 180000);

  // 큰 FOV에서 무너지는 게 매칭인지 변환인지: 정답 quad를 직접 검증한다.
  // inlier가 잘 나오고 center가 정확하면 변환은 OK이고 매칭이 원인,
  // inlier가 적거나 center가 틀리면 변환(큰 FOV gnomonic) 자체가 문제다.
  it("진단: 큰 FOV(45도) 정답 quad 직접 검증", () => {
    const img = generateSyntheticImage(catalog, {
      center: skyVector(85, 5),
      fovDeg: 45,
      rotationDeg: 25,
      width: W,
      height: H,
      magnitudeLimit: 5,
      seed: 3000,
    });
    const ts = img.trueStars.slice(0, 10);
    const allStars = img.stars.map((s) => [s.x, s.y] as [number, number]);

    let bestInlier = -1;
    let bestErr = Infinity;

    for (let i = 0; i < ts.length - 3; i++) {
      for (let j = i + 1; j < ts.length - 2; j++) {
        for (let k = j + 1; k < ts.length - 1; k++) {
          for (let l = k + 1; l < ts.length; l++) {
            const photo4: [number, number][] = [
              ts[i].xy,
              ts[j].xy,
              ts[k].xy,
              ts[l].xy,
            ];
            const v = [
              ctx.byHrVec.get(ts[i].hr),
              ctx.byHrVec.get(ts[j].hr),
              ctx.byHrVec.get(ts[k].hr),
              ctx.byHrVec.get(ts[l].hr),
            ];

            if (v.some((x) => !x)) {
              continue;
            }

            const res = solveCandidate(
              photo4,
              v as Point3D[],
              allStars,
              ctx.catalog,
              { imageWidth: W, imageHeight: H },
            );

            if (res && res.inlierCount > bestInlier) {
              bestInlier = res.inlierCount;
              bestErr = comparePose(res.TP, img.groundTruth).centerErrorDeg;
            }
          }
        }
      }
    }

    console.warn(
      `\nFOV45 정답 quad 직접: 최대 inlier ${bestInlier}/${img.trueStars.length}, ` +
        `center오차 ${Number.isFinite(bestErr) ? bestErr.toFixed(2) : "-"}°`,
    );
    expect(bestInlier).toBeGreaterThan(0);
  });
});
