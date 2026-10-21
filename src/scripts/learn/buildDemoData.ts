import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { SolveResult } from "@/search/solveCore";
import type { Mat3 } from "@/search/utils/similarity";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { answerVector, getSampleAnswer } from "@/plate-solver/sampleAnswers";
import { setVerifyListener } from "@/search/solveCore";
import { DEFAULT_SOLVERS, solvePhoto } from "@/search/solvePhoto";
import { buildSolverContext } from "@/search/solverContext";
import { ACCEPT } from "@/search/solvers/candidates";
import { selectTopByPriority } from "@/search/utils/selectStars";
import { umeyamaSimilarity2D } from "@/search/utils/similarity";
import {
  mat3Mul,
  mat3MulVec,
  projectionMatrix,
  projectVecToPhoto,
  recoverCenter,
} from "@/search/utils/wcs";
import { detectLikeApp } from "@/test/real/detectImage";
import {
  contextStars,
  loadCatalog,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

// 발표·원리 데모 자료 (public/learn/): 실제 풀이를 돌려 검증한 후보를 모은다.
//   candidates-seoul.json  서울 누각 사진에서 검증한 후보 전부 (겹친 수·짝 수·기대치·정답 여부)
//                          + 옛 점수(몇 배) 1등 가짜와 진짜 답의 겹침 그림
//   refine-milky.json      은하수 사진에서 짝 3개로만 / 겹친 별 전부로 닮음 변환 / 원근 변환까지 맞춘 변환
//
//   npx tsx src/scripts/learn/buildDemoData.ts

const OUT = resolve(process.cwd(), "public/learn");
const D = 180 / Math.PI;

const round = (x: number) => +x.toPrecision(6);
const roundMat = (m: Mat3) => m.map((row) => row.map(round));
const angleDeg = (a: Point3D, b: Point3D) =>
  Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) * D;

const ctx = buildSolverContext(contextStars(loadCatalog()), loadHashes());

// 변환 TP로 카탈로그를 사진에 투영해, 서로 가장 가까운 짝이 허용 반경 안이면 겹친 것으로 센다 (solveCore와 같은 규칙)
const matchesOf = (
  TP: Mat3,
  photo: Point2D[],
  W: number,
  H: number,
  tol: number,
): { photo: number; star: number }[] => {
  const pred: { xy: Point2D; star: number }[] = [];

  ctx.catalog.forEach((s, star) => {
    const xy = projectVecToPhoto(TP, s.vector);

    if (
      xy &&
      xy[0] >= -tol &&
      xy[0] < W + tol &&
      xy[1] >= -tol &&
      xy[1] < H + tol
    ) {
      pred.push({ xy, star });
    }
  });

  const nearest = <T>(from: Point2D, list: T[], at: (t: T) => Point2D) => {
    let best = -1;
    let bestD = Infinity;

    list.forEach((t, i) => {
      const p = at(t);
      const d = Math.hypot(p[0] - from[0], p[1] - from[1]);

      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });

    return { index: best, dist: bestD };
  };

  const out: { photo: number; star: number }[] = [];

  photo.forEach((p, i) => {
    const k = nearest(p, pred, (q) => q.xy);

    if (k.index < 0 || k.dist > tol) return;

    if (nearest(pred[k.index].xy, photo, (q) => q).index === i) {
      out.push({ photo: i, star: pred[k.index].star });
    }
  });

  return out;
};

interface Verified {
  result: SolveResult;
  photoQuad: Point2D[];
  databaseQuad: Point3D[];
  photoStars: Point2D[];
}

const solveCollecting = async (file: string) => {
  const { stars, width, height } = await detectLikeApp(
    readFileSync(resolve(process.cwd(), "public/samples", file)),
  );
  const verified: Verified[] = [];

  setVerifyListener((result, photoQuad, databaseQuad, photoStars) =>
    verified.push({ result, photoQuad, databaseQuad, photoStars }),
  );
  const out = solvePhoto(stars, { width, height }, ctx, DEFAULT_SOLVERS, {
    timeBudgetMs: 8000,
  });
  setVerifyListener(null);

  return {
    stars,
    W: width,
    H: height,
    verified,
    out,
    answer: answerVector(getSampleAnswer(file)!),
  };
};

const buildSeoul = async () => {
  const { W, H, verified, answer } = await solveCollecting(
    "20220607-berry-seoul.jpg",
  );
  const isReal = (v: Verified) => angleDeg(v.result.centerVector, answer) < 6;
  // 옛 기준: 겹친 별 6개 이상, 기대치의 5배 이상, 시야 80° 이하면 "찾았다". 그중 배수 1등을 골랐다
  const oldPick = verified
    .filter(
      ({ result: r }) =>
        r.inlierCount >= ACCEPT.minInlier &&
        r.significance >= ACCEPT.minSignificance &&
        r.fovDeg <= ACCEPT.maxFovDeg,
    )
    .sort((a, b) => b.result.significance - a.result.significance)[0];
  const realPick = verified
    .filter(isReal)
    .sort((a, b) => b.result.logOdds - a.result.logOdds)[0];

  const overlay = (v: Verified) => {
    const r = v.result;
    const matches = matchesOf(r.TP, v.photoStars, W, H, r.tolerancePx);
    const seeds = v.photoQuad.map((q) =>
      v.photoStars.findIndex((p) => p[0] === q[0] && p[1] === q[1]),
    );

    if (matches.length !== r.inlierCount) {
      throw new Error(
        `겹친 수가 풀이와 다르다: ${matches.length} vs ${r.inlierCount}`,
      );
    }

    return {
      TP: roundMat(r.TP),
      photo: v.photoStars.map((p) => [round(p[0]), round(p[1])]),
      seeds,
      matched: matches.map((m) => m.photo),
      count: r.inlierCount,
      expected: round(r.expectedRandom),
      score: round(r.significance),
      logOdds: round(r.logOdds),
      inView: r.projectedInFov,
    };
  };

  const data = {
    W,
    H,
    tol: round(Math.max(5, Math.hypot(W, H) * 0.006)),
    // 후보마다 [겹친 수, 짝지은 별 수, 우연 기대치, 우연일 확률(-log10), 정답이면 1]
    points: verified.map((v) => [
      v.result.inlierCount,
      v.photoQuad.length,
      +v.result.expectedRandom.toPrecision(3),
      +v.result.logOdds.toFixed(2),
      isReal(v) ? 1 : 0,
    ]),
    fake: overlay(oldPick),
    real: overlay(realPick),
  };

  writeFileSync(resolve(OUT, "candidates-seoul.json"), JSON.stringify(data));
  console.log(
    `서울 누각: 후보 ${verified.length}개, 옛 1등 ${oldPick.result.inlierCount}개 겹침(짝 ${oldPick.photoQuad.length}) ${oldPick.result.significance.toFixed(1)}배 정답 ${isReal(oldPick)}`,
  );
};

const buildMilky = async () => {
  const { stars, W, H, verified, out, answer } = await solveCollecting(
    "20220328-brice-Milky Way over Buzzvil.jpg",
  );

  if (!out.found || !out.transform) throw new Error("은하수를 풀지 못했다");

  const tol = Math.max(5, Math.hypot(W, H) * 0.006);
  const photo = selectTopByPriority(stars, 60);
  const final = out.transform;
  const matches = matchesOf(final, photo, W, H, tol);

  const plane = (P: Mat3, v: Point3D): Point2D => {
    const p = mat3MulVec(P, v);

    return [p[0] / p[2], p[1] / p[2]];
  };

  // 1) 정답 근처 후보 중 겹침이 가장 많은 것의 짝(별 3~4개)만으로 맞춘 닮음 변환 (V2가 하던 것)
  const seed = verified
    .filter((v) => angleDeg(v.result.centerVector, answer) < 6)
    .sort((a, b) => b.result.inlierCount - a.result.inlierCount)[0];
  const sum = seed.databaseQuad.reduce(
    (a, v) => [a[0] + v[0], a[1] + v[1], a[2] + v[2]],
    [0, 0, 0],
  );
  const n = Math.hypot(sum[0], sum[1], sum[2]);
  const P0 = projectionMatrix([sum[0] / n, sum[1] / n, sum[2] / n]);
  const seedTP = mat3Mul(
    umeyamaSimilarity2D(
      seed.databaseQuad.map((v) => plane(P0, v)),
      seed.photoQuad,
    ).matrix,
    P0,
  );
  // 2) 겹친 별 전부로 맞춘 닮음 변환 (돌리기·키우기·옮기기만)
  const P1 = projectionMatrix(recoverCenter(final, W, H));
  const similarityTP = mat3Mul(
    umeyamaSimilarity2D(
      matches.map((m) => plane(P1, ctx.catalog[m.star].vector)),
      matches.map((m) => photo[m.photo]),
    ).matrix,
    P1,
  );

  const data = {
    W,
    H,
    tol: round(tol),
    seeds: seed.photoQuad.map((p) => [round(p[0]), round(p[1])]),
    stages: {
      seed: roundMat(seedTP),
      similarity: roundMat(similarityTP),
      perspective: roundMat(final),
    },
    // 겹친 별: 사진 위치와 그 별의 방향
    pairs: matches.map((m) => ({
      photo: photo[m.photo].map(round),
      vector: ctx.catalog[m.star].vector.map(round),
    })),
  };

  writeFileSync(resolve(OUT, "refine-milky.json"), JSON.stringify(data));
  console.log(
    `은하수: 겹친 별 ${matches.length}개, 짝 ${seed.photoQuad.length}개`,
  );
};

const run = async () => {
  mkdirSync(OUT, { recursive: true });
  await buildSeoul();
  await buildMilky();
};

run();
