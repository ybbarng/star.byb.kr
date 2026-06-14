import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import {
  applySimilarity,
  umeyamaSimilarity2D,
} from "@/search/utils/similarity";
import {
  mat3Mul,
  mat3MulVec,
  projectionMatrix,
  recoverCenter,
  recoverFov,
} from "@/search/utils/wcs";

// 검증·solving 순수 코어. 후보 quad 하나를 받아 RANSAC으로 변환을 추정하고,
// 전체 카탈로그로 검증해 inlier 수·잔차·우연매칭 대비 유의도를 계산한다.
// mathjs/worker에 의존하지 않아 node/vitest에서 직접 테스트할 수 있다.

export interface SolveStar {
  hr: string;
  vector: Point3D;
}

export interface SolveOptions {
  imageWidth: number;
  imageHeight: number;
  tolerancePx?: number; // 미지정 시 화면 크기 기반 동적 계산
  ransacIterations?: number; // 기본 200
  seed?: number;
}

export interface SolveResult {
  TP: Mat3;
  inlierCount: number;
  projectedInFov: number; // 화면 안에 투영된 카탈로그 별 수
  inlierRatio: number; // inlierCount / projectedInFov
  rmsError: number; // inlier 잔차 RMS(px)
  expectedRandom: number; // 우연히 맞을 inlier 기대 수
  significance: number; // inlierCount / expectedRandom (>1이면 우연 이상)
  centerVector: Point3D;
  fovDeg: number;
  tolerancePx: number;
}

// 결정적 RNG (RANSAC 재현성). test/synthetic/rng와 동일한 mulberry32.
const makeRng = (seed: number): (() => number) => {
  let a = seed >>> 0;

  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const findCenter = (vs: Point3D[]): Point3D => {
  let x = 0;
  let y = 0;
  let z = 0;

  for (const v of vs) {
    x += v[0];
    y += v[1];
    z += v[2];
  }

  const n = Math.sqrt(x * x + y * y + z * z);

  return [x / n, y / n, z / n];
};

// 별 벡터를 (P 기준) 접선평면 2D로. 광축 반대 반구면 null.
const toPlane = (P: Mat3, v: Point3D): Point2D | null => {
  const p = mat3MulVec(P, v);

  if (p[2] <= 0) {
    return null;
  }

  return [p[0] / p[2], p[1] / p[2]];
};

interface Correspondence {
  plane: Point2D;
  photo: Point2D;
  dist: number;
}

export const solveCandidate = (
  photoQuad: Point2D[],
  databaseQuad: Point3D[],
  photoStars: Point2D[],
  catalog: SolveStar[],
  options: SolveOptions,
): SolveResult | null => {
  const W = options.imageWidth;
  const H = options.imageHeight;
  const ransacIterations = options.ransacIterations ?? 200;
  const rng = makeRng(options.seed ?? 12345);
  const diag = Math.hypot(W, H);
  const tolerancePx = options.tolerancePx ?? Math.max(5, diag * 0.006);
  const tol2 = tolerancePx * tolerancePx;

  // 1. 기준 투영 P (DB quad 중심을 광축으로 근사)
  const P = projectionMatrix(findCenter(databaseQuad));

  // 2. DB quad의 접선평면 좌표
  const dbQuadPlane: Point2D[] = [];

  for (const v of databaseQuad) {
    const pl = toPlane(P, v);

    if (!pl) {
      return null;
    }

    dbQuadPlane.push(pl);
  }

  // 3. 초기 변환 T (quad 4점 최소제곱)
  let T = umeyamaSimilarity2D(dbQuadPlane, photoQuad).matrix;

  // 4. 카탈로그 별의 접선평면 좌표 (P 고정, 앞 반구만)
  const catPlane: Point2D[] = [];

  for (const s of catalog) {
    const pl = toPlane(P, s.vector);

    if (pl) {
      catPlane.push(pl);
    }
  }

  // 현재 T로 카탈로그를 사진에 투영한 뒤 photoStars와 양방향 최근접 대응 수집
  const collectMatches = (
    Tcur: Mat3,
  ): { matches: Correspondence[]; projectedInFov: number } => {
    const pred: { plane: Point2D; xy: Point2D }[] = [];

    for (const plane of catPlane) {
      const xy = applySimilarity(Tcur, plane);

      if (
        xy[0] >= -tolerancePx &&
        xy[0] < W + tolerancePx &&
        xy[1] >= -tolerancePx &&
        xy[1] < H + tolerancePx
      ) {
        pred.push({ plane, xy });
      }
    }

    // photoStar → 최근접 pred
    const photoNearest = photoStars.map((ps) => {
      let bestK = -1;
      let bestD = Infinity;

      for (let k = 0; k < pred.length; k++) {
        const dx = ps[0] - pred[k].xy[0];
        const dy = ps[1] - pred[k].xy[1];
        const d = dx * dx + dy * dy;

        if (d < bestD) {
          bestD = d;
          bestK = k;
        }
      }

      return { k: bestK, d: bestD };
    });

    // pred → 최근접 photoStar
    const predNearest = pred.map((p) => {
      let bestI = -1;
      let bestD = Infinity;

      for (let i = 0; i < photoStars.length; i++) {
        const dx = p.xy[0] - photoStars[i][0];
        const dy = p.xy[1] - photoStars[i][1];
        const d = dx * dx + dy * dy;

        if (d < bestD) {
          bestD = d;
          bestI = i;
        }
      }

      return { i: bestI, d: bestD };
    });

    const matches: Correspondence[] = [];

    for (let i = 0; i < photoStars.length; i++) {
      const nn = photoNearest[i];

      if (nn.k < 0 || nn.d > tol2) {
        continue;
      }

      // 양방향(서로 최근접)일 때만 대응 인정
      if (predNearest[nn.k].i === i) {
        matches.push({
          plane: pred[nn.k].plane,
          photo: photoStars[i],
          dist: Math.sqrt(nn.d),
        });
      }
    }

    return { matches, projectedInFov: pred.length };
  };

  // 5. 초기 대응
  const initial = collectMatches(T);
  let best = initial.matches;

  // 6. RANSAC: 2쌍으로 변환을 추정하며 최대 inlier 모델 탐색
  if (best.length >= 4) {
    const m = best;

    for (let iter = 0; iter < ransacIterations; iter++) {
      const a = Math.floor(rng() * m.length);
      let b = Math.floor(rng() * m.length);

      if (b === a) {
        b = (b + 1) % m.length;
      }

      const Tc = umeyamaSimilarity2D(
        [m[a].plane, m[b].plane],
        [m[a].photo, m[b].photo],
      ).matrix;

      const inliers: Correspondence[] = [];

      for (const c of m) {
        const xy = applySimilarity(Tc, c.plane);
        const dx = xy[0] - c.photo[0];
        const dy = xy[1] - c.photo[1];

        if (dx * dx + dy * dy <= tol2) {
          inliers.push(c);
        }
      }

      if (inliers.length > best.length) {
        best = inliers;
      }
    }
  }

  // 7. inlier 전체로 변환 refine
  if (best.length >= 2) {
    T = umeyamaSimilarity2D(
      best.map((c) => c.plane),
      best.map((c) => c.photo),
    ).matrix;
  }

  // 8. refine된 변환으로 최종 검증
  const final = collectMatches(T);
  const inlierCount = final.matches.length;
  const projectedInFov = final.projectedInFov;

  let sumSq = 0;

  for (const c of final.matches) {
    sumSq += c.dist * c.dist;
  }

  const rmsError = inlierCount > 0 ? Math.sqrt(sumSq / inlierCount) : Infinity;

  const TP = mat3Mul(T, P);
  const centerVector = recoverCenter(TP, W, H);
  const fovDeg = (recoverFov(TP, W, H) * 180) / Math.PI;

  // 우연매칭 기대치: 화면에 투영된 카탈로그 밀도 × photoStar당 tolerance 면적
  const areaRatio = (Math.PI * tol2) / (W * H);
  const expectedRandom = photoStars.length * projectedInFov * areaRatio;
  const significance = inlierCount / Math.max(1e-6, expectedRandom);

  return {
    TP,
    inlierCount,
    projectedInFov,
    inlierRatio: projectedInFov > 0 ? inlierCount / projectedInFov : 0,
    rmsError,
    expectedRandom,
    significance,
    centerVector,
    fovDeg,
    tolerancePx,
  };
};
