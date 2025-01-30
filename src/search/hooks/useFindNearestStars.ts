import * as math from "mathjs";
import { Matrix } from "mathjs";
import { useState } from "react";
import * as plane from "@/scripts/hash/plane";
import { Point2D, Point3D, StarVector } from "@/scripts/hash/types";
import { NearestStar2D } from "@/search/type";
import { toCartesian } from "@/search/utils/vector";
import _catalog from "@build/database/vectors-database.json";

interface PhotoStar {
  position: Point2D;
}

interface Photo {
  width: number;
  height: number;
  quad: PhotoStar[];
}

interface Candidate {
  hr: string;
}

interface CalculateAlignmentParams {
  photo: Photo;
  candidate: Candidate[];
}

interface NearestStar3D {
  hr: string;
  label: string;
  vector: Point3D;
}

const catalog = new Map<string, StarVector>();

_catalog.forEach((star: StarVector) => {
  catalog.set(star.HR, star);
});

export default function useFindNearestStars() {
  const [nearestStars, setNearestStars] = useState<NearestStar2D[]>([]);

  const find = ({ photo, candidate }: CalculateAlignmentParams) => {
    const databaseQuad: Point3D[] = candidate.map(({ hr }) => {
      const star: StarVector | undefined = catalog.get(hr);

      if (!star) {
        throw new Error(`카탈로그에서 별 HR ${hr}을 찾을 수 없습니다.`);
      }

      return [star.x, star.y, star.z];
    });
    const P = calculateProjectTransform(databaseQuad);
    const projectedDatabase = databaseQuad.map(
      (star) => math.multiply(P, star).splice(0, 2) as Point2D,
    );
    const photoQuad = photo.quad.map((star) => star.position);
    const T = calculateToPhotoTransform(photoQuad, projectedDatabase) as Matrix;

    const centerOfPhoto = [photo.width / 2, photo.height / 2, 1];
    const centerOfPhotoVector = (
      math.multiply(math.inv(P), math.inv(T), centerOfPhoto) as Matrix
    ).toArray() as Point3D;

    const nearestStars = filterNearestStars(
      _catalog as StarVector[],
      centerOfPhotoVector,
    );

    setNearestStars(
      nearestStars.map((star) => ({
        ...star,
        vector: toCartesian(
          (math.multiply(T, P, star.vector) as Matrix).toArray() as Point3D,
        ),
      })),
    );
  };

  const calculateProjectTransform = (quad: Point3D[]) => {
    const center = plane.findCenter(quad);

    return plane.calculateProjectTransform(center);
  };

  const calculateToPhotoTransform = (photo: Point2D[], database: Point2D[]) => {
    // 각 quad의 중심점 계산
    const centroidPhoto = math.mean(photo, 0) as unknown as Point2D;
    const centroidDatabase = math.mean(database, 0) as unknown as Point2D;

    // 중심점이 원점이 되도록 이동
    const centeredPhoto = photo.map(
      (point) => math.subtract(point, centroidPhoto) as Point2D,
    );
    const centeredDatabase = database.map(
      (point) => math.subtract(point, centroidDatabase) as Point2D,
    );

    // 사진과 데이터베이스의 스케일 차이 계산
    const scalePhoto = math.norm(centeredPhoto[0]);
    const scaleDatabase = math.norm(centeredDatabase[0]) as number;

    const normalPhoto0 = math.divide(centeredPhoto[0], scalePhoto) as Point2D;
    const normalDatabase0 = math.divide(
      centeredDatabase[0],
      scaleDatabase,
    ) as Point2D;

    const angle = -calculateRotationAngle(normalPhoto0, normalDatabase0);

    const DtoZero = [
      [1, 0, -centroidDatabase[0]],
      [0, 1, -centroidDatabase[1]],
      [0, 0, 1],
    ];

    const SDtoN = [
      [1 / scaleDatabase, 0, 0],
      [0, 1 / scaleDatabase, 0],
      [0, 0, 1],
    ];

    const R = getRotationMatrix(angle);

    const NtoSP = [
      [scalePhoto, 0, 0],
      [0, scalePhoto, 0],
      [0, 0, 1],
    ];

    const zeroToP = [
      [1, 0, centroidPhoto[0]],
      [0, 1, centroidPhoto[1]],
      [0, 0, 1],
    ];

    // Construct transformation matrix
    return math.multiply(zeroToP, NtoSP, R, SDtoN, DtoZero);
  };

  const calculateRotationAngle = (A: Point2D, B: Point2D) => {
    const dotProduct = math.dot(A, B);

    const crossProduct = A[0] * B[1] - A[1] * B[0];

    // 회전 각도
    return Math.atan2(crossProduct, dotProduct);
  };

  // 회전 행렬 계산 함수
  const getRotationMatrix = (theta: number) => {
    return math.matrix([
      [Math.cos(theta), -Math.sin(theta), 0],
      [Math.sin(theta), Math.cos(theta), 0],
      [0, 0, 1],
    ]);
  };

  const filterNearestStars = (
    catalog: StarVector[],
    target: Point3D,
  ): NearestStar3D[] => {
    // 45도 이내의 별만 반환하도록 함
    const threshold = Math.cos(Math.PI / 4);

    // 주어진 벡터 v (필터 기준)
    const normalTarget = math.divide(target, math.norm(target)) as Point3D;

    // 필터링
    return catalog
      .map((star) => {
        return {
          hr: star.HR,
          label: star.N ? star.N : star.HR,
          vector: [star.x, star.y, star.z] as Point3D,
        };
      })
      .filter((star) => {
        const dotProduct = math.dot(normalTarget, star.vector); // 내적 계산

        return dotProduct >= threshold; // 각도가 threshold 이내인 경우
      });
  };

  return {
    find,
    nearestStars,
  };
}
