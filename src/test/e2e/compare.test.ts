import type { Point3D } from "@/scripts/hash/types";
import type { SolverContext } from "@/search/solvers";
import type { CatalogStar } from "@/test/synthetic/loadCatalog";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildCandidateIndex } from "@/search/findCandidatesCore";
import { solvers } from "@/search/solvers";
import {
  generateSyntheticImage,
  type GenerateOptions,
} from "@/test/synthetic/generateSyntheticImage";
import {
  catalogExists,
  hashesExist,
  loadCatalog,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

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
const CENTER_TOLERANCE_DEG = 1.5;

// 하늘 전역 12방향
const directions: [number, number][] = [
  [85, 5],
  [200, -20],
  [330, 60],
  [150, 10],
  [20, -45],
  [270, 30],
  [110, -10],
  [50, 40],
  [300, -35],
  [10, 70],
  [240, 0],
  [170, -60],
];

const noiseLevels: { name: string; noise: GenerateOptions["noise"] }[] = [
  { name: "L0_clean", noise: {} },
  { name: "L1_약", noise: { jitterPx: 1, falseRatio: 0.3 } },
  { name: "L2_중", noise: { jitterPx: 2, falseRatio: 1.0, missingProb: 0.1 } },
  { name: "L3_강", noise: { jitterPx: 3, falseRatio: 2.0, missingProb: 0.2 } },
];

interface LevelStat {
  total: number;
  correct: number; // found & center 오차 < tolerance
  falsePositive: number; // found 인데 틀림 (위험: 오답을 확신)
  missed: number; // 못 찾음 (found=false)
  meanCenterErrDeg: number;
  meanTimeMs: number;
}

describe.skipIf(!ready)("알고리즘 비교 벤치마크", () => {
  let catalog: CatalogStar[];
  let ctx: SolverContext;

  beforeAll(() => {
    catalog = loadCatalog();
    ctx = {
      index: buildCandidateIndex(loadHashes()),
      catalog: catalog.map((s) => ({ hr: s.hr, vector: s.vector })),
      byHrVec: new Map(catalog.map((s) => [s.hr, s.vector])),
    };
  });

  it("모든 알고리즘을 같은 합성 데이터로 비교한다", () => {
    const report: Record<
      string,
      { name: string; description: string; levels: Record<string, LevelStat> }
    > = {};

    for (const solver of solvers) {
      const levels: Record<string, LevelStat> = {};

      for (const lvl of noiseLevels) {
        let total = 0;
        let correct = 0;
        let falsePositive = 0;
        let missed = 0;
        const errs: number[] = [];
        const times: number[] = [];

        for (let d = 0; d < directions.length; d++) {
          const [ra, dec] = directions[d];
          const gtc = skyVector(ra, dec);
          const img = generateSyntheticImage(catalog, {
            center: gtc,
            fovDeg: 20,
            rotationDeg: 25,
            width: W,
            height: H,
            magnitudeLimit: 5,
            seed: 2000 + d,
            noise: lvl.noise,
          });

          if (img.trueStars.length < 8) {
            continue;
          }

          total++;

          const outcome = solver.solve(img.stars, { width: W, height: H }, ctx);
          times.push(outcome.timeMs);

          let errDeg = Infinity;

          if (outcome.centerVector) {
            const dot = Math.max(
              -1,
              Math.min(
                1,
                outcome.centerVector[0] * gtc[0] +
                  outcome.centerVector[1] * gtc[1] +
                  outcome.centerVector[2] * gtc[2],
              ),
            );
            errDeg = (Math.acos(dot) * 180) / Math.PI;
          }

          if (outcome.found && errDeg < CENTER_TOLERANCE_DEG) {
            correct++;
            errs.push(errDeg);
          } else if (outcome.found) {
            falsePositive++;
          } else {
            missed++;
          }
        }

        levels[lvl.name] = {
          total,
          correct,
          falsePositive,
          missed,
          meanCenterErrDeg:
            errs.length > 0
              ? errs.reduce((a, b) => a + b, 0) / errs.length
              : NaN,
          meanTimeMs:
            times.length > 0
              ? times.reduce((a, b) => a + b, 0) / times.length
              : NaN,
        };
      }

      report[solver.key] = {
        name: solver.name,
        description: solver.description,
        levels,
      };
    }

    // 콘솔 표
    const lines: string[] = [
      "\n=== 알고리즘 비교 (정답/전체, 평균오차°, 평균ms) ===",
    ];

    for (const solver of solvers) {
      const r = report[solver.key];
      lines.push(`\n■ ${r.name}`);

      for (const lvl of noiseLevels) {
        const s = r.levels[lvl.name];
        lines.push(
          `  ${lvl.name}: 정답 ${s.correct}/${s.total}` +
            ` (오답확신 ${s.falsePositive}, 못찾음 ${s.missed})` +
            ` | 오차 ${Number.isNaN(s.meanCenterErrDeg) ? "-" : s.meanCenterErrDeg.toFixed(2)}°` +
            ` | ${s.meanTimeMs.toFixed(0)}ms`,
        );
      }
    }

    console.warn(lines.join("\n"));

    // 발표 자료용 JSON 저장
    const outDir = resolve(process.cwd(), "docs");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      resolve(outDir, "benchmark-results.json"),
      JSON.stringify(report, null, 2),
    );

    expect(Object.keys(report).length).toBe(solvers.length);
  }, 180000);
});
