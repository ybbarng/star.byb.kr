/**
 * 후보 검증 Web Worker
 * mathjs 의존 없이 순수 JS 행렬 연산으로 구현
 */

type Point2D = [number, number];
type Point3D = [number, number, number];
type Mat3 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]; // row-major 9개

interface StarVector {
  HR: string;
  x: number;
  y: number;
  z: number;
}

interface VerificationResult {
  matchedCount: number;
  unmatchedPhotoCount: number;
  projectedCatalogCount: number;
  matchRatio: number;
  catalogPrecision: number;
  averageError: number;
  score: number;
}

interface CandidateData {
  input: number[];
  output: { hr: string; label: string }[];
}

interface VerifyRequest {
  candidates: CandidateData[];
  photoStars: Point2D[];
  imageWidth: number;
  imageHeight: number;
}

// === 순수 JS 3x3 행렬 연산 ===

function mat3Mul(a: Mat3, b: Mat3): Mat3 {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
    a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
    a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
    a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
    a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
    a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
    a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
}

function mat3MulVec(m: Mat3, v: Point3D): Point3D {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

function mat3Inv(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);

  if (Math.abs(det) < 1e-12) throw new Error("Matrix not invertible");
  const invDet = 1 / det;

  return [
    (e * i - f * h) * invDet,
    (c * h - b * i) * invDet,
    (b * f - c * e) * invDet,
    (f * g - d * i) * invDet,
    (a * i - c * g) * invDet,
    (c * d - a * f) * invDet,
    (d * h - e * g) * invDet,
    (b * g - a * h) * invDet,
    (a * e - b * d) * invDet,
  ];
}

function mat3Chain(...matrices: Mat3[]): Mat3 {
  let result = matrices[0];

  for (let i = 1; i < matrices.length; i++) {
    result = mat3Mul(result, matrices[i]);
  }

  return result;
}

// === 벡터 연산 ===

function vec3Normalize(v: Point3D): Point3D {
  const norm = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);

  return [v[0] / norm, v[1] / norm, v[2] / norm];
}

function vec3Cross(a: Point3D, b: Point3D): Point3D {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function vec2Norm(v: Point2D): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
}

// === 접선 평면 투영 (plane.ts 순수 JS 재구현) ===

function findCenter(vectors: Point3D[]): Point3D {
  const n = vectors.length;
  const mean: Point3D = [0, 0, 0];

  for (const v of vectors) {
    mean[0] += v[0] / n;
    mean[1] += v[1] / n;
    mean[2] += v[2] / n;
  }

  return vec3Normalize(mean);
}

function calculateProjectTransform(center: Point3D): Mat3 {
  const c = center;
  const arbitrary: Point3D =
    c[0] !== 0 || c[2] !== 0 ? [-c[2], 0, c[1]] : [0, -c[2], c[1]];
  const u = vec3Normalize(vec3Cross(c, arbitrary));
  const v = vec3Cross(c, u);

  // transpose([u, v, c]) then invert
  // transpose = columns are u, v, c
  const T: Mat3 = [u[0], v[0], c[0], u[1], v[1], c[1], u[2], v[2], c[2]];

  return mat3Inv(T);
}

// === 아핀 변환 (transform.ts 순수 JS 재구현) ===

function computeTransformMatrix(
  photoQuad: Point2D[],
  databaseQuad: Point3D[],
): Mat3 {
  const P = calculateProjectTransform(findCenter(databaseQuad));

  const projectedDatabase = databaseQuad.map((star) => {
    const projected = mat3MulVec(P, star);

    return [
      projected[0] / projected[2],
      projected[1] / projected[2],
    ] as Point2D;
  });

  const T = calculateToPhotoTransform(photoQuad, projectedDatabase);

  return mat3Mul(T, P);
}

function calculateToPhotoTransform(
  photo: Point2D[],
  database: Point2D[],
): Mat3 {
  const n = photo.length;
  const centroidP: Point2D = [0, 0];
  const centroidD: Point2D = [0, 0];

  for (let i = 0; i < n; i++) {
    centroidP[0] += photo[i][0] / n;
    centroidP[1] += photo[i][1] / n;
    centroidD[0] += database[i][0] / n;
    centroidD[1] += database[i][1] / n;
  }

  const centeredP0: Point2D = [
    photo[0][0] - centroidP[0],
    photo[0][1] - centroidP[1],
  ];
  const centeredD0: Point2D = [
    database[0][0] - centroidD[0],
    database[0][1] - centroidD[1],
  ];

  const scaleP = vec2Norm(centeredP0);
  const scaleD = vec2Norm(centeredD0);

  const normalP0: Point2D = [centeredP0[0] / scaleP, centeredP0[1] / scaleP];
  const normalD0: Point2D = [centeredD0[0] / scaleD, centeredD0[1] / scaleD];

  const dot2d = normalP0[0] * normalD0[0] + normalP0[1] * normalD0[1];
  const cross2d = normalP0[0] * normalD0[1] - normalP0[1] * normalD0[0];
  const angle = -Math.atan2(cross2d, dot2d);

  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  const DtoZero: Mat3 = [1, 0, -centroidD[0], 0, 1, -centroidD[1], 0, 0, 1];
  const SDtoN: Mat3 = [1 / scaleD, 0, 0, 0, 1 / scaleD, 0, 0, 0, 1];
  const R: Mat3 = [cosA, -sinA, 0, sinA, cosA, 0, 0, 0, 1];
  const NtoSP: Mat3 = [scaleP, 0, 0, 0, scaleP, 0, 0, 0, 1];
  const zeroToP: Mat3 = [1, 0, centroidP[0], 0, 1, centroidP[1], 0, 0, 1];

  return mat3Chain(zeroToP, NtoSP, R, SDtoN, DtoZero);
}

// === 검증 (verification.ts 순수 JS 재구현) ===

function verifyCandidate(
  photoStars: Point2D[],
  TP: Mat3,
  catalog: StarVector[],
  imageWidth: number,
  imageHeight: number,
  tolerance = 15,
): VerificationResult {
  const projectedCatalog: Point2D[] = [];

  for (const star of catalog) {
    const projected = mat3MulVec(TP, [star.x, star.y, star.z]);
    const p2d: Point2D = [
      projected[0] / projected[2],
      projected[1] / projected[2],
    ];

    if (
      p2d[0] >= -tolerance &&
      p2d[0] < imageWidth + tolerance &&
      p2d[1] >= -tolerance &&
      p2d[1] < imageHeight + tolerance
    ) {
      projectedCatalog.push(p2d);
    }
  }

  const projectedCatalogCount = projectedCatalog.length;

  if (projectedCatalogCount === 0) {
    return {
      matchedCount: 0,
      unmatchedPhotoCount: photoStars.length,
      projectedCatalogCount: 0,
      matchRatio: 0,
      catalogPrecision: 0,
      averageError: Infinity,
      score: 0,
    };
  }

  // 양방향 매칭: 사진별→카탈로그별, 카탈로그별→사진별 모두 최근접이어야 매칭
  const toleranceSq = tolerance * tolerance;

  // 사진 별 → 최근접 카탈로그 별
  const photoNearest: { idx: number; distSq: number }[] = photoStars.map(
    (ps) => {
      let minDistSq = Infinity;
      let minIdx = -1;

      for (let j = 0; j < projectedCatalog.length; j++) {
        const dx = ps[0] - projectedCatalog[j][0];
        const dy = ps[1] - projectedCatalog[j][1];
        const distSq = dx * dx + dy * dy;

        if (distSq < minDistSq) {
          minDistSq = distSq;
          minIdx = j;
        }
      }

      return { idx: minIdx, distSq: minDistSq };
    },
  );

  // 카탈로그 별 → 최근접 사진 별
  const catalogNearest: { idx: number; distSq: number }[] =
    projectedCatalog.map((cs) => {
      let minDistSq = Infinity;
      let minIdx = -1;

      for (let j = 0; j < photoStars.length; j++) {
        const dx = cs[0] - photoStars[j][0];
        const dy = cs[1] - photoStars[j][1];
        const distSq = dx * dx + dy * dy;

        if (distSq < minDistSq) {
          minDistSq = distSq;
          minIdx = j;
        }
      }

      return { idx: minIdx, distSq: minDistSq };
    });

  // 양쪽 모두 최근접이고 tolerance 이내인 경우만 매칭
  let matchedCount = 0;
  let totalError = 0;

  for (let i = 0; i < photoStars.length; i++) {
    const nearest = photoNearest[i];

    if (nearest.distSq > toleranceSq || nearest.idx < 0) continue;

    if (catalogNearest[nearest.idx].idx === i) {
      matchedCount++;
      totalError += Math.sqrt(nearest.distSq);
    }
  }

  const unmatchedPhotoCount = photoStars.length - matchedCount;
  const matchRatio =
    photoStars.length > 0 ? matchedCount / photoStars.length : 0;
  const catalogPrecision =
    projectedCatalogCount > 0 ? matchedCount / projectedCatalogCount : 0;
  const averageError = matchedCount > 0 ? totalError / matchedCount : Infinity;
  const photoTrustPenalty = Math.exp(-0.5 * unmatchedPhotoCount);
  const score =
    matchedCount *
    catalogPrecision *
    photoTrustPenalty *
    (1 / (1 + averageError));

  return {
    matchedCount,
    unmatchedPhotoCount,
    projectedCatalogCount,
    matchRatio,
    catalogPrecision,
    averageError,
    score,
  };
}

// === Worker 메인 로직 ===

let catalog: StarVector[] = [];
const catalogMap = new Map<string, StarVector>();

const loadCatalog = async () => {
  if (catalog.length > 0) return;
  const response = await fetch(
    new URL("/data/vectors-database.json", self.location.origin),
  );
  catalog = (await response.json()) as StarVector[];
  catalog.forEach((star) => catalogMap.set(star.HR, star));
};

function runVerification(req: VerifyRequest) {
  const { candidates, photoStars, imageWidth, imageHeight } = req;
  const scores = new Map<number, VerificationResult>();

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];

    try {
      const photoQuad: Point2D[] = candidate.input.map(
        (idx) => photoStars[idx],
      );

      const databaseQuad: Point3D[] = candidate.output.map(({ hr }) => {
        const star = catalogMap.get(hr);
        if (!star) throw new Error(`Star HR ${hr} not found`);

        return [star.x, star.y, star.z] as Point3D;
      });

      const TP = computeTransformMatrix(photoQuad, databaseQuad);
      const result = verifyCandidate(
        photoStars,
        TP,
        catalog,
        imageWidth,
        imageHeight,
      );

      scores.set(i, result);
    } catch {
      // 검증 실패 시 무시
    }

    // 진행률 보고 (50개마다)
    if (i % 50 === 0) {
      postMessage({
        fn: "onProgress",
        payload: { progress: i, total: candidates.length },
      });
    }
  }

  // 합의 계산 (매칭 수 3개 이상인 후보만 참여)
  const MIN_MATCH_FOR_CONSENSUS = 3;
  const skyDirections: (Point3D | null)[] = candidates.map((candidate, i) => {
    const result = scores.get(i);

    if (!result || result.matchedCount < MIN_MATCH_FOR_CONSENSUS) return null;

    let sx = 0,
      sy = 0,
      sz = 0;

    for (const { hr } of candidate.output) {
      const star = catalogMap.get(hr);
      if (!star) return null;
      sx += star.x;
      sy += star.y;
      sz += star.z;
    }

    const norm = Math.sqrt(sx * sx + sy * sy + sz * sz);
    if (norm === 0) return null;

    return [sx / norm, sy / norm, sz / norm] as Point3D;
  });

  const consensusThreshold = Math.cos((15 * Math.PI) / 180);
  const neighbors = new Map<number, number>();

  for (let i = 0; i < candidates.length; i++) {
    if (!scores.has(i) || !skyDirections[i]) continue;
    const dir = skyDirections[i]!;
    let count = 0;

    for (let j = 0; j < skyDirections.length; j++) {
      if (i === j || !skyDirections[j]) continue;
      const other = skyDirections[j]!;
      const dot = dir[0] * other[0] + dir[1] * other[1] + dir[2] * other[2];

      if (dot >= consensusThreshold) count++;
    }

    neighbors.set(i, count);
  }

  // score 기반 정렬
  const sorted = Array.from({ length: candidates.length }, (_, i) => i);
  sorted.sort((a, b) => {
    const scoreA = scores.get(a);
    const scoreB = scores.get(b);

    if (scoreA && scoreB) {
      return scoreB.score - scoreA.score;
    }

    if (scoreA) return -1;
    if (scoreB) return 1;

    return 0;
  });

  const bestIndex = sorted.find((i) => scores.has(i)) ?? -1;

  // Map → 직렬화 가능한 형태로 변환
  const scoresObj: Record<number, VerificationResult> = {};
  scores.forEach((v, k) => {
    scoresObj[k] = v;
  });
  const neighborsObj: Record<number, number> = {};
  neighbors.forEach((v, k) => {
    neighborsObj[k] = v;
  });

  return { scores: scoresObj, neighbors: neighborsObj, sorted, bestIndex };
}

onmessage = async function (messageEvent) {
  switch (messageEvent.data.fn) {
    case "verify": {
      await loadCatalog();
      const result = runVerification(messageEvent.data.payload);
      postMessage({ fn: "onVerified", payload: result });
      break;
    }

    default:
      break;
  }
};
