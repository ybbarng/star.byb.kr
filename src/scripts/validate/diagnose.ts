import type { Mat3 } from "@/search/utils/similarity";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadClasses, loadDetected } from "@/scripts/validate/common";
import { loadRun } from "@/scripts/validate/report";
import { DEFAULT_SOLVERS, solvePhoto } from "@/search/solvePhoto";
import { buildSolverContext } from "@/search/solverContext";
import {
  rankForSolving,
  STARLIKE_RING_CONTRAST,
} from "@/search/utils/selectStars";
import { photoToSky, projectVecToPhoto, recoverFov } from "@/search/utils/wcs";
import {
  contextStars,
  loadCatalog,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

// 못 푼 사진을 분석용 정답지(astrometryTruth.ts)로 단계별로 진단한다.
//   npx tsx src/scripts/validate/diagnose.ts <풀이 이름> <묶음>...
// 사진마다: 시야각, 시야 안 카탈로그 별 수, 밝은 별(4등급까지)의 검출·순위·밀린 이유,
// 정답 별만 넣어 풀기(oracle), 우리 1위 후보와 정답의 거리 → 막힌 단계를 정한다.

const cat = loadCatalog();
const ctx = buildSolverContext(contextStars(cat), loadHashes());
const angle = (a: number[], b: number[]) =>
  (Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) *
    180) /
  Math.PI;

const run = () => {
  const [name, ...sets] = process.argv.slice(2);
  const rows: Record<string, unknown>[] = [];

  for (const set of sets) {
    const truthPath = resolve(
      process.cwd(),
      "build/validate/astrometry",
      set,
      "truth.json",
    );

    if (!existsSync(truthPath)) continue;

    const truth: Record<string, Mat3> = JSON.parse(
      readFileSync(truthPath, "utf8"),
    );
    const classes = loadClasses(set);

    for (const r of loadRun(set, name).filter(
      (x) => !x.found && truth[x.file],
    )) {
      const d = loadDetected(set, r.file)!;
      const T = truth[r.file];
      const { width: W, height: H } = d;
      const rad = Math.hypot(W, H) * 0.012;
      const inFrame = cat.flatMap((s) => {
        const p = projectVecToPhoto(T, s.vector);

        return p && p[0] >= 0 && p[1] >= 0 && p[0] < W && p[1] < H
          ? [{ s, p }]
          : [];
      });
      const ranked = rankForSolving(
        d.stars.filter((s) => !s.trail),
        W,
        H,
      );
      const bright = inFrame.filter(({ s }) => s.v <= 4);
      const fate = { top60: 0, ring: 0, aligned: 0, dim: 0, missing: 0 };
      const matched: typeof ranked = [];

      for (const { p } of bright) {
        let best = -1;
        let bd = rad;

        ranked.forEach((q, i) => {
          const dd = Math.hypot(q.x - p[0], q.y - p[1]);

          if (dd < bd) {
            bd = dd;
            best = i;
          }
        });

        if (best < 0) {
          fate.missing++;
          continue;
        }

        const q = ranked[best];
        matched.push(q);

        if (best < 60) fate.top60++;
        else if (q.aligned) fate.aligned++;
        else if ((q.ringContrast ?? 0) >= STARLIKE_RING_CONTRAST) fate.ring++;
        else fate.dim++;
      }

      // 정답 별만 넣어 풀기: 밝은 별과 겹친 검출만 (별다움 표시를 지우고 밝기 순)
      const oracleInput = matched.map(
        ({ aligned: _a, ringContrast: _r, ...s }) => s,
      );
      const oracle =
        oracleInput.length >= 4
          ? solvePhoto(
              oracleInput,
              { width: W, height: H },
              ctx,
              DEFAULT_SOLVERS,
              { timeBudgetMs: 8000, skipCircular: true },
            )
          : null;
      const truthCenter = photoToSky(T, [W / 2, H / 2]);
      const near = r.center ? angle(r.center, truthCenter) : 180;
      const fov = (recoverFov(T, W, H) * 180) / Math.PI;
      const stage =
        bright.length < 6
          ? "별 적음(카탈로그)"
          : oracle && !oracle.found
            ? "매칭·검증"
            : near < 2
              ? "검증(후보는 정답)"
              : fate.top60 < 6
                ? fate.missing > fate.ring + fate.dim + fate.aligned
                  ? "검출(밝은 별 못 찾음)"
                  : "순위(밝은 별 밀림)"
                : "기타";
      rows.push({
        file: r.file,
        set,
        class: classes.get(r.file),
        fov: fov.toFixed(0),
        n5: inFrame.length,
        bright: bright.length,
        ...fate,
        oracle: oracle
          ? oracle.found
            ? `확신 ${oracle.confidence.toFixed(0)}`
            : "못 풂"
          : "-",
        near: near.toFixed(1),
        stage,
      });
    }
  }

  writeFileSync(
    resolve(process.cwd(), "build/validate/astrometry/diagnosis.json"),
    JSON.stringify(rows, null, 1),
  );

  for (const r of rows) {
    console.log(
      `${r.file} ${String(r.class).padEnd(5)} 시야 ${r.fov}° 5등급 ${r.n5} 4등급 ${r.bright} | 상위60 ${r.top60} 별답지않음 ${r.ring} 줄지음 ${r.aligned} 어두움 ${r.dim} 못찾음 ${r.missing} | 정답별만 ${r.oracle} | 1위후보 ${r.near}° → ${r.stage}`,
    );
  }

  const byStage: Record<string, number> = {};

  for (const r of rows)
    byStage[r.stage as string] = (byStage[r.stage as string] ?? 0) + 1;

  console.log("막힌 단계:", byStage);
};

run();
