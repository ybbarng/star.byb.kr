import { Matrix } from "mathjs";
import * as math from "mathjs";
import { Point2D, Point3D, StarVector } from "@/scripts/hash/types";
import { toCartesian } from "@/search/utils/vector";

export interface VerificationResult {
  matchedCount: number;
  unmatchedPhotoCount: number;
  projectedCatalogCount: number;
  matchRatio: number;
  catalogPrecision: number;
  averageError: number;
  score: number;
}

export function verifyCandidate(
  photoStars: Point2D[],
  transformMatrix: Matrix,
  catalog: StarVector[],
  imageSize: { width: number; height: number },
  tolerance = 15,
): VerificationResult {
  // DB 별들을 사진 좌표로 투영
  const projectedCatalog: Point2D[] = [];

  for (const star of catalog) {
    const vec: Point3D = [star.x, star.y, star.z];
    const projected = (
      math.multiply(transformMatrix, vec) as Matrix
    ).toArray() as Point3D;
    const p2d = toCartesian(projected);

    // 이미지 범위 내에 있는 별만 대상
    if (
      p2d[0] >= -tolerance &&
      p2d[0] < imageSize.width + tolerance &&
      p2d[1] >= -tolerance &&
      p2d[1] < imageSize.height + tolerance
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
