import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { applyHomography, fitHomography2D } from "@/search/utils/homography";
import { umeyamaSimilarity2D } from "@/search/utils/similarity";
import { poissonTailNegLog10 } from "@/search/utils/stats";
import {
  mat3Inv,
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
  // 시드 밖 inlier가 우연히 이만큼 맞을 확률의 -log10 (Poisson 꼬리).
  // 후보를 수천 개 검사해도 우연으로 설명되지 않는지 판정하는 기준이다.
  logOdds: number;
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
  vec: Point3D; // 카탈로그 별 벡터 (광축 재추정 시 재투영에 필요)
  plane: Point2D;
  photo: Point2D;
  dist: number;
}

// 카탈로그를 z(적위의 sin) 순으로 정렬해 둔다. 같은 카탈로그는 한 번만 정렬한다.
const byZCache = new WeakMap<
  SolveStar[],
  { stars: SolveStar[]; zs: Float64Array }
>();

const sortedByZ = (catalog: SolveStar[]) => {
  let cached = byZCache.get(catalog);

  if (!cached) {
    const stars = [...catalog].sort((a, b) => a.vector[2] - b.vector[2]);
    cached = { stars, zs: Float64Array.from(stars, (s) => s.vector[2]) };
    byZCache.set(catalog, cached);
  }

  return cached;
};

// 정렬된 배열에서 value 이상이 처음 나오는 위치
const lowerBound = (xs: Float64Array, value: number): number => {
  let lo = 0;
  let hi = xs.length;

  while (lo < hi) {
    const mid = (lo + hi) >> 1;

    if (xs[mid] < value) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  return lo;
};

// 사진 별을 허용오차 크기 칸의 격자에 담는다 (대응 수집에서 근처 칸만 보려고).
// 투영 별은 사진 ±허용오차 안에만 있으므로, 둘레에 2칸을 더 둔 고정 격자면 된다.
// 한 solver 실행은 같은 사진 별 배열로 후보 수천 개를 검증하므로 배열마다 한 번만 만든다.
interface PhotoGrid {
  key: string;
  gridW: number;
  cellOf: (x: number, y: number) => number;
  cellStart: Int32Array; // 칸 c의 사진 별 번호는 cellOrder[cellStart[c] .. cellStart[c+1])
  cellOrder: Int32Array;
}

const photoGridCache = new WeakMap<Point2D[], PhotoGrid>();

const photoGridOf = (
  photoStars: Point2D[],
  W: number,
  H: number,
  tolerancePx: number,
): PhotoGrid => {
  const key = `${W}x${H}/${tolerancePx}/${photoStars.length}`;
  const cached = photoGridCache.get(photoStars);

  if (cached && cached.key === key) {
    return cached;
  }

  const PAD = 2;
  const gridW = Math.ceil(W / tolerancePx) + 2 * PAD + 1;
  const gridH = Math.ceil(H / tolerancePx) + 2 * PAD + 1;

  const cellOf = (x: number, y: number) => {
    const cx = Math.min(
      gridW - 1,
      Math.max(0, Math.floor(x / tolerancePx) + PAD),
    );
    const cy = Math.min(
      gridH - 1,
      Math.max(0, Math.floor(y / tolerancePx) + PAD),
    );

    return cy * gridW + cx;
  };

  const cellStart = new Int32Array(gridW * gridH + 1);
  const photoCell = photoStars.map(([x, y]) => cellOf(x, y));

  for (const c of photoCell) {
    cellStart[c + 1]++;
  }

  for (let c = 0; c < gridW * gridH; c++) {
    cellStart[c + 1] += cellStart[c];
  }

  const cellOrder = new Int32Array(photoStars.length);
  const fill = cellStart.slice(0, gridW * gridH);

  photoCell.forEach((c, i) => {
    cellOrder[fill[c]++] = i;
  });

  const grid = { key, gridW, cellOf, cellStart, cellOrder };
  photoGridCache.set(photoStars, grid);

  return grid;
};

// 원근 변환이 받아들일 만큼 완만한가. 사진 중심 광축 기준의 접선평면 → 사진 변환에서,
// 분모 w(원근 항)가 사진 네 모서리에서 모두 양수이고(변환의 지평선이 사진 밖) 선형 배율 비가
// MAX_PERSPECTIVE_SCALE_RATIO 이하여야 한다. 정상 해는 1.0~1.15, 원근 보정된 은하수가 1.58이었다.
// 지평선이 사진을 가로지르는 퇴화 해는 카탈로그 별을 한 줄로 몰아 지면 불빛 줄과 우연히
// 겹치게 만들어 log-odds를 부풀린다(오로라-02에서 시야 0.57°짜리 오답이 9.8로 확신된 적이 있다).
const MAX_PERSPECTIVE_SCALE_RATIO = 2.5;

export const isMildPerspective = (TP: Mat3, W: number, H: number): boolean => {
  const P = projectionMatrix(recoverCenter(TP, W, H));
  // P는 직교행렬이라 역행렬이 전치다
  const Pt: Mat3 = [
    [P[0][0], P[1][0], P[2][0]],
    [P[0][1], P[1][1], P[2][1]],
    [P[0][2], P[1][2], P[2][2]],
  ];
  const T = mat3Mul(TP, Pt);
  const inv = mat3Inv(T);
  let wMin = Infinity;
  let wMax = -Infinity;

  for (const [x, y] of [
    [0, 0],
    [W, 0],
    [0, H],
    [W, H],
  ]) {
    const q = mat3MulVec(inv, [x, y, 1]);

    if (Math.abs(q[2]) < 1e-12) {
      return false;
    }

    // 모서리의 접선평면 좌표에서 T의 분모 (T[2][2]로 나눠 중심에서 1이 되게)
    const w =
      (T[2][0] * (q[0] / q[2]) + T[2][1] * (q[1] / q[2]) + T[2][2]) / T[2][2];
    wMin = Math.min(wMin, w);
    wMax = Math.max(wMax, w);
  }

  return wMin > 0 && (wMax / wMin) ** 1.5 <= MAX_PERSPECTIVE_SCALE_RATIO;
};

// 원근 정밀화를 시도할 최소 대응 수. 대응이 적으면 8자유도 변환이 노이즈에 끌려간다.
const PERSPECTIVE_MIN_MATCHES = 8;

// 검증의 출발점: 매칭이 준 대응(사진 별 ↔ 카탈로그 별) 몇 쌍, 또는 이미 찾은 변환
type SolveStart =
  | { kind: "seeds"; photoQuad: Point2D[]; databaseQuad: Point3D[] }
  | { kind: "pose"; TP: Mat3 }
  | { kind: "fixed"; TP: Mat3 };

type VerifyListener = (
  result: SolveResult,
  photoQuad: Point2D[],
  databaseQuad: Point3D[],
  photoStars: Point2D[],
) => void;

let verifyListener: VerifyListener | null = null;

// 검증한 후보를 하나씩 받아 본다. 발표·원리 데모 자료를 만들 때만 쓴다 (scripts/learn)
export const setVerifyListener = (listener: VerifyListener | null) => {
  verifyListener = listener;
};

export const solveCandidate = (
  photoQuad: Point2D[],
  databaseQuad: Point3D[],
  photoStars: Point2D[],
  catalog: SolveStar[],
  options: SolveOptions,
): SolveResult | null => {
  const result = solveFrom(
    { kind: "seeds", photoQuad, databaseQuad },
    photoStars,
    catalog,
    options,
  );

  if (result && verifyListener) {
    verifyListener(result, photoQuad, databaseQuad, photoStars);
  }

  return result;
};

// 이미 확신한 변환에서 출발해, 더 많은 사진 별로 대응을 다시 모으고 정밀화한다.
// 처음 확신한 순간 멈추면 적은 별로 잰 점수(log-odds)가 기준 근처에서 출렁인다.
// 변환은 다른 대응으로 이미 정해졌으므로 우연 비교에서 원근 변환과 같이 4쌍을 뺀다.
export const refineSolution = (
  TP: Mat3,
  photoStars: Point2D[],
  catalog: SolveStar[],
  options: SolveOptions,
): SolveResult | null =>
  solveFrom({ kind: "pose", TP }, photoStars, catalog, options);

// 변환을 그대로 두고 점수만 매긴다 (다시 맞추지 않는다). 변환을 정할 때 쓰지 않은 별로 채점하면
// 맞춰 놓고 같은 별로 채점해 부푼 점수를 걸러 낼 수 있다 (solvePhoto의 교차 검증).
export const scorePose = (
  TP: Mat3,
  photoStars: Point2D[],
  catalog: SolveStar[],
  options: SolveOptions,
): SolveResult | null =>
  solveFrom({ kind: "fixed", TP }, photoStars, catalog, options);

const POSE_FIXED_MATCHES = 4;
// 국소 밀도를 재는 반지름 (허용오차 칸 수). 사진 대각선의 약 10%
const LOCAL_RADIUS_TOL = 16;

const solveFrom = (
  start: SolveStart,
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

  const { gridW, cellOf, cellStart, cellOrder } = photoGridOf(
    photoStars,
    W,
    H,
    tolerancePx,
  );

  // 변환 T로 사진(허용오차 여백 포함)에 들어오는 접선평면 영역의 가장 먼 모서리를 구해,
  // 광축과 이루는 각의 코사인 하한으로 돌려준다. 모서리가 지평선 너머면 거르지 않는다(-1).
  const minCosInView = (Tcur: Mat3): number => {
    const inv = mat3Inv(Tcur);
    let r2 = 0;

    for (const [x, y] of [
      [-tolerancePx, -tolerancePx],
      [W + tolerancePx, -tolerancePx],
      [-tolerancePx, H + tolerancePx],
      [W + tolerancePx, H + tolerancePx],
    ]) {
      const q = applyHomography(inv, [x, y]);

      if (!q) {
        return -1;
      }

      r2 = Math.max(r2, q[0] * q[0] + q[1] * q[1]);
    }

    // 접선평면 반지름 r은 광축에서 atan(r)만큼 떨어진 방향이다. 경계 오차를 위해 약간 넓힌다.
    return 1 / Math.sqrt(1 + r2 * 1.05) - 1e-9;
  };

  // collectMatches: 주어진 광축 P·변환 T로 카탈로그를 사진에 투영해 photoStars와
  // 양방향 최근접 대응을 수집한다 (광축 재추정에 쓰도록 카탈로그 벡터도 보유).
  const collectMatches = (
    Tcur: Mat3,
    Pcur: Mat3,
  ): {
    matches: Correspondence[];
    projectedInFov: number;
    projected: Point2D[];
  } => {
    const pred: { vec: Point3D; plane: Point2D; xy: Point2D }[] = [];
    const [ax, ay, az] = Pcur[2];
    const cosMax = minCosInView(Tcur);

    // 광축에서 시야 반경 안의 별은 z(적위)가 [sin(δ-ρ), sin(δ+ρ)] 띠에 있다. 띠만 훑는다.
    const byZ = sortedByZ(catalog);
    const rho = Math.acos(Math.max(-1, Math.min(1, cosMax)));
    const dec = Math.asin(Math.max(-1, Math.min(1, az)));
    const zLo = Math.sin(Math.max(-Math.PI / 2, dec - rho));
    const zHi = Math.sin(Math.min(Math.PI / 2, dec + rho));

    for (let n = lowerBound(byZ.zs, zLo); n < byZ.zs.length; n++) {
      if (byZ.zs[n] > zHi) {
        break;
      }

      const s = byZ.stars[n];
      const v = s.vector;

      // 사진에 들어올 수 없는 먼 별은 광축과의 내적만으로 먼저 거른다 (대부분이 여기서 빠진다)
      if (ax * v[0] + ay * v[1] + az * v[2] < cosMax) {
        continue;
      }

      const plane = toPlane(Pcur, v);

      if (!plane) {
        continue;
      }

      const xy = applyHomography(Tcur, plane);

      if (
        xy &&
        xy[0] >= -tolerancePx &&
        xy[0] < W + tolerancePx &&
        xy[1] >= -tolerancePx &&
        xy[1] < H + tolerancePx
      ) {
        pred.push({ vec: s.vector, plane, xy });
      }
    }

    // 허용오차 안의 쌍만 본다. 서로 가장 가까운 쌍이 허용오차 안이면 그 둘의 최근접도
    // 허용오차 안에 있으므로, 전체 쌍을 다 보는 것과 결과가 같다.
    const photoBest = new Float64Array(photoStars.length).fill(Infinity);
    const photoBestK = new Int32Array(photoStars.length).fill(-1);
    const predBestI = new Int32Array(pred.length).fill(-1);

    for (let k = 0; k < pred.length; k++) {
      const [px, py] = pred[k].xy;
      const center = cellOf(px, py);
      let bestD = Infinity;

      for (let dy = -gridW; dy <= gridW; dy += gridW) {
        for (let dx = -1; dx <= 1; dx++) {
          const c = center + dy + dx;

          for (let p = cellStart[c]; p < cellStart[c + 1]; p++) {
            const i = cellOrder[p];
            const ex = photoStars[i][0] - px;
            const ey = photoStars[i][1] - py;
            const d = ex * ex + ey * ey;

            if (d > tol2) {
              continue;
            }

            if (d < bestD) {
              bestD = d;
              predBestI[k] = i;
            }

            if (d < photoBest[i]) {
              photoBest[i] = d;
              photoBestK[i] = k;
            }
          }
        }
      }
    }

    const matches: Correspondence[] = [];

    for (let i = 0; i < photoStars.length; i++) {
      const k = photoBestK[i];

      if (k >= 0 && predBestI[k] === i) {
        matches.push({
          vec: pred[k].vec,
          plane: pred[k].plane,
          photo: photoStars[i],
          dist: Math.sqrt(photoBest[i]),
        });
      }
    }

    return {
      matches,
      projectedInFov: pred.length,
      projected: pred.map((q) => q.xy),
    };
  };

  // 초기 광축 P와 변환 T. 대응에서 출발하면 DB quad 중심 광축 + quad 최소제곱,
  // 변환에서 출발하면 사진 중심 광축 + 그 광축 기준으로 나눈 변환(TP = T·P).
  const seedCount =
    start.kind === "seeds"
      ? start.photoQuad.length
      : start.kind === "pose"
        ? POSE_FIXED_MATCHES
        : 0;
  let P: Mat3;
  let T: Mat3;

  if (start.kind === "seeds") {
    P = projectionMatrix(findCenter(start.databaseQuad));

    const dbQuadPlane: Point2D[] = [];

    for (const v of start.databaseQuad) {
      const pl = toPlane(P, v);

      if (!pl) {
        return null;
      }

      dbQuadPlane.push(pl);
    }

    T = umeyamaSimilarity2D(dbQuadPlane, start.photoQuad).matrix;
  } else {
    P = projectionMatrix(recoverCenter(start.TP, W, H));
    // P는 직교행렬이라 역행렬이 전치다
    T = mat3Mul(start.TP, [
      [P[0][0], P[1][0], P[2][0]],
      [P[0][1], P[1][1], P[2][1]],
      [P[0][2], P[1][2], P[2][2]],
    ]);

    const k = T[2][2];
    T = T.map((row) => row.map((x) => x / k)) as Mat3;
  }

  // 광축 재추정 한 번: 지금 변환이 가리키는 화면 중심을 새 광축으로 잡고, 대응들을 새 광축
  // 기준으로 다시 맞춘 뒤 대응을 다시 모은다. 큰 FOV에서는 quad 중심 광축이 화면 가장자리에
  // 안 맞아 변환이 부정확한데, 이렇게 하면 맞는 별이 늘어난다.
  const recenter = (
    matches: Correspondence[],
    Tcur: Mat3,
    Pcur: Mat3,
  ): { T: Mat3; P: Mat3; matches: Correspondence[] } | null => {
    const Pnew = projectionMatrix(recoverCenter(mat3Mul(Tcur, Pcur), W, H));
    const planes: Point2D[] = [];
    const photos: Point2D[] = [];

    for (const c of matches) {
      const pl = toPlane(Pnew, c.vec);

      if (pl) {
        planes.push(pl);
        photos.push(c.photo);
      }
    }

    if (planes.length < 2) {
      return null;
    }

    const Tnew = umeyamaSimilarity2D(planes, photos).matrix;

    return { T: Tnew, P: Pnew, matches: collectMatches(Tnew, Pnew).matches };
  };

  // 초기 대응
  let best = collectMatches(T, P).matches;

  // 시드 별 말고는 하나도 맞지 않는 후보는 RANSAC·광축 재추정을 해도 그럴듯한 해가
  // 되지 못한다. 대부분의 오답 후보가 여기서 걸러져 검증 비용이 크게 준다.
  // 다만 시야가 넓으면 시드 중심 광축으로는 가장자리가 어긋나 시드만 맞을 수 있어,
  // 광축을 한 번 다시 잡아 보고도 그대로일 때만 버린다.
  const minUseful = seedCount + 1;

  if (best.length < minUseful && start.kind === "fixed") {
    return null;
  }

  if (best.length < minUseful) {
    const r = recenter(best, T, P);

    if (!r || r.matches.length < minUseful) {
      return null;
    }

    ({ T, P } = r);
    best = r.matches;
  }

  // 변환에서 출발했으면(마무리 정밀화) 닮음변환으로 다시 맞추지 않는다. 그 변환에 담긴
  // 원근(키스톤)을 버리게 되어, 원근이 센 사진은 점수가 무너졌다 (journey 22장).
  const fromPose = start.kind !== "seeds";

  // RANSAC: 2쌍으로 변환을 추정하며 최대 inlier 모델 탐색
  if (!fromPose && best.length >= 4) {
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
        const xy = applyHomography(Tc, c.plane)!;
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

  // inlier 전체로 변환 refine
  if (!fromPose && best.length >= 2) {
    T = umeyamaSimilarity2D(
      best.map((c) => c.plane),
      best.map((c) => c.photo),
    ).matrix;
  }

  // 광축 재추정 정제: 새 광축으로 더 많은 별이 맞으면 그 대응으로 바꾸며 수렴시킨다.
  for (let iter = 0; iter < (fromPose ? 0 : 2); iter++) {
    const r = recenter(best, T, P);

    if (!r) {
      break;
    }

    ({ T, P } = r);

    if (r.matches.length >= best.length) {
      best = r.matches;
    }
  }

  // 원근 정밀화: 닮음변환으로 모은 대응에 호모그래피를 맞춰 다시 모은다.
  // 원근(키스톤) 보정된 사진은 가장자리가 닮음변환에서 어긋나 거기 별을 놓친다.
  let perspective = false;

  if (start.kind !== "fixed" && best.length >= PERSPECTIVE_MIN_MATCHES) {
    for (let iter = 0; iter < 3; iter++) {
      const Hm = fitHomography2D(
        best.map((c) => c.plane),
        best.map((c) => c.photo),
      );

      if (!Hm || !isMildPerspective(mat3Mul(Hm, P), W, H)) {
        break;
      }

      const m = collectMatches(Hm, P).matches;

      if (m.length <= best.length) {
        break;
      }

      T = Hm;
      best = m;
      perspective = true;
    }
  }

  // 투영 별마다 주변(반지름 LOCAL_RADIUS_TOL × 허용오차)의 검출 밀도로 우연히 맞을 기대를 더한다.
  // 사진 전체 평균 밀도로 잰 기대는 검출이 고르게 퍼져 있다고 보는데, 지면 불빛·구름 가장자리처럼
  // 검출이 몰린 곳에 별을 많이 투영하는 오답은 그 가정에서 점수가 부푼다.
  const localExpected = (projected: Point2D[]): number => {
    const reach = LOCAL_RADIUS_TOL;
    const rho2 = (reach * tolerancePx) ** 2;
    let sum = 0;

    for (const [px, py] of projected) {
      const center = cellOf(px, py);
      let count = 0;

      for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
          const c = center + dy * gridW + dx;

          if (c < 0 || c >= cellStart.length - 1) {
            continue;
          }

          for (let q = cellStart[c]; q < cellStart[c + 1]; q++) {
            const i = cellOrder[q];
            const ex = photoStars[i][0] - px;
            const ey = photoStars[i][1] - py;

            if (ex * ex + ey * ey <= rho2) {
              count++;
            }
          }
        }
      }

      // 원이 사진 밖으로 나간 만큼 넓이를 줄인다 (사각형 겹침으로 어림)
      const r = reach * tolerancePx;
      const inside =
        ((Math.min(W, px + r) - Math.max(0, px - r)) *
          (Math.min(H, py + r) - Math.max(0, py - r))) /
        (4 * r * r);
      sum += (count * tol2) / (rho2 * Math.max(0.25, inside));
    }

    return sum;
  };

  // 최종 검증
  const final = collectMatches(T, P);
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
  const expectedRandom = Math.max(
    photoStars.length * projectedInFov * areaRatio,
    // 변환을 고정해 채점할 때는 검출이 한곳에 몰린 사진(지면 불빛 띠)도 따진다
    start.kind === "fixed" ? localExpected(final.projected) : 0,
  );
  const significance = inlierCount / Math.max(1e-6, expectedRandom);
  // 시드 별(photoQuad)은 대응이 정해진 채 들어오므로 우연 비교에서 뺀다.
  // 원근 변환은 대응 4쌍으로 정해지므로, 그때는 적어도 4개를 뺀다.
  const fixedMatches = perspective ? Math.max(seedCount, 4) : seedCount;
  const logOdds = poissonTailNegLog10(
    inlierCount - fixedMatches,
    expectedRandom,
  );

  return {
    TP,
    inlierCount,
    projectedInFov,
    inlierRatio: projectedInFov > 0 ? inlierCount / projectedInFov : 0,
    rmsError,
    expectedRandom,
    significance,
    logOdds,
    centerVector,
    fovDeg,
    tolerancePx,
  };
};
