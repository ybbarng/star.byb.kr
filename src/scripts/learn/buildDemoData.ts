import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { SolveResult } from "@/search/solveCore";
import type { Mat3 } from "@/search/utils/similarity";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { answerVector, getSampleAnswer } from "@/plate-solver/sampleAnswers";
import {
  buildCandidateIndex,
  findCandidates,
} from "@/search/findCandidatesCore";
import { setVerifyListener } from "@/search/solveCore";
import { DEFAULT_SOLVERS, solvePhoto } from "@/search/solvePhoto";
import { buildSolverContext } from "@/search/solverContext";
import { ACCEPT } from "@/search/solvers/candidates";
import { fitHomography2D } from "@/search/utils/homography";
import { selectTopByPriority } from "@/search/utils/selectStars";
import { umeyamaSimilarity2D } from "@/search/utils/similarity";
import {
  mat3Mul,
  mat3MulVec,
  photoToSky,
  projectionMatrix,
  projectVecToPhoto,
  recoverCenter,
} from "@/search/utils/wcs";
import { detectLikeApp } from "@/test/real/detectImage";
import { labelDetections, loadSolvedPoses } from "@/test/real/detectionLabels";
import {
  contextStars,
  loadCatalog,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

// 발표·원리 데모 자료 (public/learn/): 실제 풀이를 돌려 검증한 후보를 모은다.
//   candidates-seoul.json  서울 누각 사진에서 검증한 후보 전부 (겹친 수·짝 수·기대치·정답 여부)
//                          + V2가 고른 답(지문 거리 1등), 옛 점수(몇 배) 1등 가짜, 진짜 답의 겹침 그림
//   refine-milky.json      은하수 사진에서 짝 3개로만 / 겹친 별 전부로 닮음 변환 / 같은 짝으로 원근 변환까지 맞춘 변환
//   triangle-dipper.json   북두칠성 사진에서 일곱 별의 자리와 실제 화각 (삼각형 크기 거르기 데모)
//   zenith-seoul.json      누각 사진의 정답 자세와 먼 능선 두 점 (지평선 → 천정 → 하늘 시계 데모)
//
//   npx tsx src/scripts/learn/buildDemoData.ts

const OUT = resolve(process.cwd(), "public/learn");
const SEOUL = "20220607-berry-seoul.jpg";
// 옛 판정 규칙 ①: 겹친 별 ÷ 우연 기대치가 이 배수 이상이면 필연 (지금 풀이는 쓰지 않는다)
const OLD_MIN_RATIO = 5;
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
  const { stars, W, H, verified, answer } = await solveCollecting(SEOUL);
  // 진짜 답: 식별이 맞은 후보. 식별에 쓴 지도 별들을 정답 자세로 사진에 내렸을 때 각각 짝지은 사진 별의
  // 허용 반경 안에 오면 맞게 식별한 것이다 (중심 방향만 보면 회전·화각이 엉뚱한 오답이 섞인다)
  const truth = loadSolvedPoses()[SEOUL].TP;
  const tolPx = Math.max(5, Math.hypot(W, H) * 0.006);
  const identified = (photoPts: Point2D[], vectors: Point3D[]) =>
    vectors.every((v, k) => {
      const xy = projectVecToPhoto(truth, v);

      return (
        xy !== null &&
        Math.hypot(xy[0] - photoPts[k][0], xy[1] - photoPts[k][1]) <= tolPx * 2
      );
    });
  const isReal = (v: Verified) => identified(v.photoQuad, v.databaseQuad);
  const nearCenter = verified.filter(
    (v) => angleDeg(v.result.centerVector, answer) < 6,
  ).length;
  // 옛 기준: 겹친 별 6개 이상, 기대치의 5배 이상, 시야 80° 이하면 "찾았다". 그중 배수 1등을 골랐다
  const oldPick = verified
    .filter(
      ({ result: r }) =>
        r.inlierCount >= ACCEPT.minInlier &&
        r.significance >= OLD_MIN_RATIO &&
        r.fovDeg <= ACCEPT.maxFovDeg,
    )
    .sort((a, b) => b.result.significance - a.result.significance)[0];
  const realPick = verified
    .filter(isReal)
    .sort((a, b) => b.result.logOdds - a.result.logOdds)[0];

  // V2 방식: 사람이 별을 고친 것처럼 진짜 별만 남기고(정답 자세로 확인), 앞쪽 15개로 quad를 만들어
  // 지문이 가장 가까운 quad를 답으로 낸다. 그 넷으로만 닮음 변환을 구해 별 지도를 겹친다.
  // 비교용으로 지문 순위에서 처음 나오는 정답 quad도 같은 방법으로 겹친다.
  const tol = Math.max(5, Math.hypot(W, H) * 0.006);
  const top200 = selectTopByPriority(stars, 200);
  const labels = labelDetections(top200, loadSolvedPoses()[SEOUL], ctx.catalog);
  const clean = top200.filter((_, i) => labels[i] !== null).slice(0, 60);
  const clean15 = clean.slice(0, 15);
  const quads = findCandidates(
    { stars: clean15 } as Parameters<typeof findCandidates>[0],
    buildCandidateIndex(loadHashes()),
    { k: 1 },
  );
  const vectorOf = (hr: string) => ctx.catalog.find((c) => c.hr === hr)!.vector;

  const seedTP = (q: (typeof quads)[number]) => {
    const vectors = q.output.map(({ hr }) => vectorOf(hr));
    const sum = vectors.reduce(
      (acc, v) => [acc[0] + v[0], acc[1] + v[1], acc[2] + v[2]],
      [0, 0, 0],
    );
    const len = Math.hypot(sum[0], sum[1], sum[2]);
    const P0 = projectionMatrix([sum[0] / len, sum[1] / len, sum[2] / len]);

    const toPlane = (v: Point3D): Point2D => {
      const m = mat3MulVec(P0, v);

      return [m[0] / m[2], m[1] / m[2]];
    };

    return mat3Mul(
      umeyamaSimilarity2D(
        vectors.map(toPlane),
        q.input.map((i) => clean15[i]),
      ).matrix,
      P0,
    );
  };

  // findCandidates의 distance는 지문 거리의 제곱 × 1000이다. 데모에는 지문 네 숫자 사이의 실제 거리로 싣는다
  const quadIdentified = (q: (typeof quads)[number]) =>
    identified(
      q.input.map((i) => clean15[i]),
      q.output.map(({ hr }) => vectorOf(hr)),
    );

  const quadOverlay = (rank: number) => {
    const q = quads[rank - 1];
    const TP = seedTP(q);
    const matches = matchesOf(TP, clean, W, H, tol);

    return {
      rank,
      TP: roundMat(TP),
      seeds: [...q.input],
      matched: matches.map((m) => m.photo),
      count: matches.length,
      distance: round(Math.sqrt(q.distance / 1000)),
      stars: q.output.map((o) => o.label),
      real: quadIdentified(q),
    };
  };

  const rightRank = quads.findIndex(quadIdentified) + 1;

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
    // 후보마다 [겹친 수, 짝지은 별 수(3 삼각형, 4 quad), 우연 기대치, 우연일 확률(-log10), 정답이면 1, 넣은 사진 별 수]
    points: verified.map((v) => [
      v.result.inlierCount,
      v.photoQuad.length,
      +v.result.expectedRandom.toPrecision(3),
      +v.result.logOdds.toFixed(2),
      isReal(v) ? 1 : 0,
      v.photoStars.length,
    ]),
    // V2 방식으로 고른 후보 quad: 지문 거리 순 앞쪽 20개 (정답 quad가 그 안에 있다)
    v2: {
      photo: clean.map((p) => [round(p[0]), round(p[1])]),
      quads: quads.length,
      right: rightRank,
      list: Array.from({ length: Math.max(20, rightRank) }, (_, i) =>
        quadOverlay(i + 1),
      ),
    },
    fake: overlay(oldPick),
    real: overlay(realPick),
  };

  writeFileSync(resolve(OUT, "candidates-seoul.json"), JSON.stringify(data));
  console.log(
    `서울 누각: 중심이 6° 안인 후보 ${nearCenter}개, 식별이 맞은 후보 ${verified.filter(isReal).length}개`,
  );
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
  const skyPlane = matches.map((m) => plane(P1, ctx.catalog[m.star].vector));
  const photoPlane = matches.map((m) => photo[m.photo]);
  const similarityTP = mat3Mul(
    umeyamaSimilarity2D(skyPlane, photoPlane).matrix,
    P1,
  );
  // 3) 같은 짝으로 원근 변환만 바꿔 맞춘다 — ②와 짝은 같고 모델만 다르다.
  //    풀이의 최종 변환(final)은 별 60개로 다듬기까지 거친 것이라, 짝을 고르는 데만 쓴다.
  const homography = fitHomography2D(skyPlane, photoPlane);

  if (!homography) throw new Error("원근 변환을 맞추지 못했다");

  const perspectiveTP = mat3Mul(homography, P1);

  const data = {
    W,
    H,
    tol: round(tol),
    seeds: seed.photoQuad.map((p) => [round(p[0]), round(p[1])]),
    stages: {
      seed: roundMat(seedTP),
      similarity: roundMat(similarityTP),
      perspective: roundMat(perspectiveTP),
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

// 북두칠성 일곱 별 (HR)
const DIPPER = [
  ["두베", "4301"],
  ["메라크", "4295"],
  ["페크다", "4554"],
  ["메그레즈", "4660"],
  ["알리오트", "4905"],
  ["미자르", "5054"],
  ["알카이드", "5191"],
];

const buildDipper = async () => {
  const { W, H, out } = await solveCollecting("big-dipper.jpg");

  if (!out.found || !out.transform) throw new Error("북두칠성을 풀지 못했다");

  const TP = out.transform;
  const stars = DIPPER.map(([name, hr]) => {
    const s = ctx.catalog.find((c) => c.hr === hr);

    if (!s) throw new Error(`카탈로그에 없다: ${hr}`);

    const xy = projectVecToPhoto(TP, s.vector)!;

    return { name, hr, x: round(xy[0]), y: round(xy[1]) };
  });
  // 짧은 변 기준 시야각 (풀이의 FOV 후보와 같은 기준)
  const minDim = Math.min(W, H);
  const a = photoToSky(TP, [W / 2, H / 2 - minDim / 2]);
  const b = photoToSky(TP, [W / 2, H / 2 + minDim / 2]);

  writeFileSync(
    resolve(OUT, "triangle-dipper.json"),
    JSON.stringify({ W, H, fovDeg: round(angleDeg(a, b)), stars }),
  );
  console.log(`북두칠성: 짧은 변 시야 ${angleDeg(a, b).toFixed(1)}°`);
};

// 누각 사진의 정답 자세와 먼 능선 두 점 (지평선 → 천정 → 하늘 시계 데모). test/real/shotTimeSamples.test.ts와 같은 점
const buildZenith = () => {
  const pose = loadSolvedPoses()["20220607-berry-seoul.jpg"];

  writeFileSync(
    resolve(OUT, "zenith-seoul.json"),
    JSON.stringify({
      W: pose.width,
      H: pose.height,
      TP: pose.TP, // 반올림하면 계산한 시각이 1분 달라진다
      horizon: [
        [10, 843],
        [330, 850],
      ],
    }),
  );
};

const run = async () => {
  mkdirSync(OUT, { recursive: true });
  buildZenith();
  await buildSeoul();
  await buildMilky();
  await buildDipper();
};

run();
