import { Matrix } from "mathjs";
import * as math from "mathjs";
import { Point2D, Point3D, StarVector } from "@/scripts/hash/types";
import { toCartesian } from "@/search/utils/vector";

export interface VerificationResult {
  matchedCount: number;
  unmatchedPhotoCount: number;
  matchRatio: number;
  averageError: number;
  score: number;
}

export function verifyCandidate(
  photoStars: Point2D[],
  transformMatrix: Matrix,
  catalog: StarVector[],
  imageSize: { width: number; height: number },
  tolerance = 20,
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

  if (projectedCatalog.length === 0) {
    return {
      matchedCount: 0,
      unmatchedPhotoCount: photoStars.length,
      matchRatio: 0,
      averageError: Infinity,
      score: 0,
    };
  }

  // 각 사진 별에 대해 가장 가까운 투영 별과의 거리 측정
  let matchedCount = 0;
  let totalError = 0;
  const toleranceSq = tolerance * tolerance;

  for (const photoStar of photoStars) {
    let minDistSq = Infinity;

    for (const catStar of projectedCatalog) {
      const dx = photoStar[0] - catStar[0];
      const dy = photoStar[1] - catStar[1];
      const distSq = dx * dx + dy * dy;

      if (distSq < minDistSq) {
        minDistSq = distSq;
      }
    }

    if (minDistSq <= toleranceSq) {
      matchedCount++;
      totalError += Math.sqrt(minDistSq);
    }
  }

  const unmatchedPhotoCount = photoStars.length - matchedCount;
  const matchRatio =
    photoStars.length > 0 ? matchedCount / photoStars.length : 0;
  const averageError = matchedCount > 0 ? totalError / matchedCount : Infinity;
  // score: 사진 별은 사람이 검증한 것이므로, 매칭되지 않은 사진 별에 강한 패널티
  // exp(-0.5 * unmatched): 미매칭 1개당 ~39% 감소
  const photoTrustPenalty = Math.exp(-0.5 * unmatchedPhotoCount);
  const score = matchedCount * photoTrustPenalty * (1 / (1 + averageError));

  return { matchedCount, unmatchedPhotoCount, matchRatio, averageError, score };
}
