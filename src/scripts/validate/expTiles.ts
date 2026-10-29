import type { InputStar } from "@/search/solvers";
import type { Mat3 } from "@/search/utils/similarity";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  judge,
  listPhotos,
  loadClasses,
  loadDetected,
} from "@/scripts/validate/common";
import { loadRun } from "@/scripts/validate/report";
import { scorePose } from "@/search/solveCore";
import { DEFAULT_SOLVERS, solvePhoto } from "@/search/solvePhoto";
import { buildSolverContext } from "@/search/solverContext";
import { rankForSolving } from "@/search/utils/selectStars";
import { photoToSky } from "@/search/utils/wcs";
import {
  contextStars,
  loadCatalog,
  loadDeepStars,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

// 실험 (journey 53장, 사용자 제안: web-074는 오른쪽 위 4분의 1만 보면 풀린다): 사진을 조각으로 잘라 각 조각을 독립된 사진으로 푼다.
// 영역 풀이(위쪽 75% 등)는 시야각을 사진 전체 기준으로 잡아, 이어 붙인 파노라마·가장자리가 휘는 초광각에서는 쓸모가 없었다.
// 조각 하나는 시야가 좁아 직선투영에 가깝다. 정답지가 있으면 조각 가운데 픽셀의 하늘 방향을 대조한다.
//   npx tsx src/scripts/validate/expTiles.ts <풀이 이름> <조각당 ms> <묶음>...
const TILES: [string, number, number, number, number][] = [
  ["왼쪽 위", 0, 0, 0.5, 0.5],
  ["오른쪽 위", 0.5, 0, 0.5, 0.5],
  ["왼쪽 아래", 0, 0.5, 0.5, 0.5],
  ["오른쪽 아래", 0.5, 0.5, 0.5, 0.5],
  ["왼쪽 반", 0, 0, 0.5, 1],
  ["오른쪽 반", 0.5, 0, 0.5, 1],
  ["가운데", 0.25, 0.25, 0.5, 0.5],
];

const angle = (a: number[], b: number[]) =>
  (Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) *
    180) /
  Math.PI;

const run = () => {
  const [name, perTile, ...sets] = process.argv.slice(2);
  const ctx = buildSolverContext(
    contextStars(loadCatalog()),
    loadHashes(),
    undefined,
    loadDeepStars(),
  );
  let tried = 0;
  const records: unknown[] = [];
  let solved = 0;
  let truthOk = 0;
  let truthBad = 0;

  for (const set of sets) {
    const tp = resolve(
      process.cwd(),
      "build/validate/astrometry",
      set,
      "truth.json",
    );
    const truth: Record<string, Mat3> = existsSync(tp)
      ? JSON.parse(readFileSync(tp, "utf8"))
      : {};
    const runs = new Map(loadRun(set, name).map((r) => [r.file, r]));
    const classes = loadClasses(set);

    for (const file of listPhotos(set)) {
      const r = runs.get(file);
      const d = loadDetected(set, file);

      if (!d || r?.found) continue;

      tried++;
      const W = d.width;
      const H = d.height;
      const hits: string[] = [];

      for (const [label, fx, fy, fw, fh] of TILES) {
        const x0 = fx * W;
        const y0 = fy * H;
        const w = fw * W;
        const h = fh * H;
        const st = d.stars
          .filter((s) => s.x >= x0 && s.x < x0 + w && s.y >= y0 && s.y < y0 + h)
          .map((s) => ({ ...s, x: s.x - x0, y: s.y - y0 })) as InputStar[];

        if (st.length < 20) continue;

        const out = solvePhoto(
          st,
          { width: w, height: h },
          ctx,
          DEFAULT_SOLVERS,
          {
            timeBudgetMs: Number(perTile),
            brightFallbackShare: 0.4,
          },
        );

        if (!out.found || !out.transform) continue;

        const t = truth[file];
        const vsTruth = t
          ? angle(out.centerVector!, photoToSky(t, [x0 + w / 2, y0 + h / 2]))
          : null;
        // 조각 좌표의 변환을 사진 전체 좌표로 옮긴다 (픽셀만 평행 이동)
        const T = out.transform;
        const full: Mat3 = [
          [
            T[0][0] + x0 * T[2][0],
            T[0][1] + x0 * T[2][1],
            T[0][2] + x0 * T[2][2],
          ],
          [
            T[1][0] + y0 * T[2][0],
            T[1][1] + y0 * T[2][1],
            T[1][2] + y0 * T[2][2],
          ],
          [T[2][0], T[2][1], T[2][2]],
        ];
        // 둘레 확인: 조각을 사방 25% 넓힌 띠(조각 밖) 검출만, 사진 전체 우선순위 상위 150개로 채점
        const mx0 = Math.max(0, x0 - 0.25 * w);
        const my0 = Math.max(0, y0 - 0.25 * h);
        const mx1 = Math.min(W, x0 + 1.25 * w);
        const my1 = Math.min(H, y0 + 1.25 * h);
        const ring = rankForSolving(
          d.stars.filter((st2) => !st2.trail),
          W,
          H,
        )
          .filter(
            (st2) =>
              st2.x >= mx0 &&
              st2.x < mx1 &&
              st2.y >= my0 &&
              st2.y < my1 &&
              !(st2.x >= x0 && st2.x < x0 + w && st2.y >= y0 && st2.y < y0 + h),
          )
          .slice(0, 150)
          .map((st2): [number, number] => [st2.x, st2.y]);
        const held =
          ring.length >= 10
            ? (scorePose(full, ring, ctx.catalog, {
                imageWidth: W,
                imageHeight: H,
              })?.logOdds ?? 0)
            : null;

        records.push({
          set,
          file,
          label,
          rect: [x0, y0, w, h],
          full,
          center: out.centerVector!,
          lo: out.confidence,
          fov: out.fovDeg ?? 0,
          held,
          truth: vsTruth,
        });
        const j = judge(
          { ...d, stars: st, width: w, height: h },
          out.transform,
          false,
        );
        hits.push(
          `${label}(lo ${out.confidence.toFixed(1)} 시야 ${out.fovDeg?.toFixed(0)}° 판정 ${j.verdict} 둘레 ${held === null ? "-" : held.toFixed(1)}${vsTruth === null ? "" : ` 정답지 ${vsTruth.toFixed(1)}°`})`,
        );

        if (vsTruth !== null) {
          if (vsTruth < 2) truthOk++;
          else truthBad++;
        }
      }

      if (hits.length) solved++;

      if (hits.length)
        console.log(
          `${set}/${file} ${classes.get(file) ?? ""} → ${hits.join(", ")}`,
        );
    }
  }

  writeFileSync(
    resolve(
      process.cwd(),
      `build/validate/tiles-${name}-${sets.join("+")}.json`,
    ),
    JSON.stringify(records),
  );
  console.log(
    `못 푼 사진 ${tried}장 중 조각 하나라도 확신 ${solved}장 · 정답지 대조: 맞음 ${truthOk} · 틀림 ${truthBad}`,
  );
};

run();
