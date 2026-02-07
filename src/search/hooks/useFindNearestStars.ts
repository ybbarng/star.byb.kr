import * as math from "mathjs";
import { Matrix } from "mathjs";
import { useState } from "react";
import * as plane from "@/scripts/hash/plane";
import { Point2D, Point3D, StarVector } from "@/scripts/hash/types";
import { useFindConstellations } from "@/search/hooks/useFindConstellations";
import { NearestStar2D } from "@/search/type";
import { toCartesian } from "@/search/utils/vector";
import {
  verifyCandidate,
  VerificationResult,
} from "@/search/utils/verification";
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
  allPhotoStars?: Point2D[];
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
  const [verification, setVerification] = useState<
    VerificationResult | undefined
  >(undefined);
  const [fov, setFov] = useState<number>(Math.PI / 4);
  const { find: findNearestConstellations, nearestConstellations } =
    useFindConstellations();

  const find = ({
    photo,
    candidate,
    allPhotoStars,
  }: CalculateAlignmentParams) => {
    const databaseQuad: Point3D[] = candidate.map(({ hr }) => {
      const star: StarVector | undefined = catalog.get(hr);

      if (!star) {
        throw new Error(`카탈로그에서 별 HR ${hr}을 찾을 수 없습니다.`);
      }

      return [star.x, star.y, star.z];
    });
    const P = calculateProjectTransform(databaseQuad);
    const projectedDatabase = databaseQuad.map(
      (star) =>
        (math.multiply(P, star) as Matrix).toArray().splice(0, 2) as Point2D,
    );
    const photoQuad = photo.quad.map((star) => star.position);
    const T = calculateToPhotoTransform(photoQuad, projectedDatabase) as Matrix;

    const centerOfPhoto = [photo.width / 2, photo.height / 2, 1];
    const centerOfPhotoVector = (
      math.multiply(math.inv(P), math.inv(T), centerOfPhoto) as Matrix
    ).toArray() as Point3D;

    // 동적 FOV 계산
    const estimatedFov = estimateFOV(T, P, photo.width, photo.height);
    setFov(estimatedFov);

    const nearestStars = filterNearestStars(
      _catalog as StarVector[],
      centerOfPhotoVector,
      estimatedFov,
    );

    const TP = math.multiply(T, P) as Matrix;

    setNearestStars(
      nearestStars.map((star) => ({
        ...star,
        vector: toCartesian(
          (math.multiply(TP, star.vector) as Matrix).toArray() as Point3D,
        ),
      })),
    );

    // Verification 수행
    if (allPhotoStars && allPhotoStars.length > 0) {
      const result = verifyCandidate(
        allPhotoStars,
        TP,
        _catalog as StarVector[],
        { width: photo.width, height: photo.height },
      );
      setVerification(result);
    }

    findNearestConstellations({
      center: centerOfPhotoVector,
      matrix: TP,
      fov: estimatedFov,
    });
  };

  const calculateProjectTransform = (quad: Point3D[]): Matrix => {
    const center = plane.findCenter(quad);

    return plane.calculateProjectTransform(center) as unknown as Matrix;
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

  const estimateFOV = (
    T: Matrix,
    P: Matrix,
    width: number,
    height: number,
  ): number => {
    const invP = math.inv(P);
    const invT = math.inv(T);
    const center = [width / 2, height / 2, 1];
    const centerVec = math.divide(
      (math.multiply(invP, invT, center) as Matrix).toArray() as Point3D,
      math.norm(
        (math.multiply(invP, invT, center) as Matrix).toArray() as Point3D,
      ),
    ) as Point3D;

    // 사진 네 모서리를 역변환
    const corners = [
      [0, 0, 1],
      [width, 0, 1],
      [0, height, 1],
      [width, height, 1],
    ];

    let maxAngle = 0;

    for (const corner of corners) {
      const vec = (
        math.multiply(invP, invT, corner) as Matrix
      ).toArray() as Point3D;
      const norm = math.norm(vec) as number;
      const normalVec: Point3D = [vec[0] / norm, vec[1] / norm, vec[2] / norm];
      const dot =
        centerVec[0] * normalVec[0] +
        centerVec[1] * normalVec[1] +
        centerVec[2] * normalVec[2];
      const angle = Math.acos(Math.min(1, Math.max(-1, dot)));

      if (angle > maxAngle) {
        maxAngle = angle;
      }
    }

    return maxAngle;
  };

  const filterNearestStars = (
    catalog: StarVector[],
    target: Point3D,
    currentFov: number,
  ): NearestStar3D[] => {
    // FOV의 1.2배 범위 내의 별만 반환
    const threshold = Math.cos(currentFov * 1.2);

    // 주어진 벡터 v (필터 기준)
    const norm = Math.sqrt(
      target[0] * target[0] + target[1] * target[1] + target[2] * target[2],
    );
    const normalTarget: Point3D = [
      target[0] / norm,
      target[1] / norm,
      target[2] / norm,
    ];

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
        const dotProduct =
          normalTarget[0] * star.vector[0] +
          normalTarget[1] * star.vector[1] +
          normalTarget[2] * star.vector[2];

        return dotProduct >= threshold;
      });
  };

  return {
    find,
    nearestStars,
    nearestConstellations,
    verification,
    fov,
  };
}
