import { Matrix } from "mathjs";
import * as math from "mathjs";
import { useCallback, useState } from "react";
import { Point3D } from "@/scripts/hash/types";
import { NearestConstellation2D } from "@/search/type";
import { toCartesian } from "@/search/utils/vector";
import _constellations from "@build/database/vectors-constellations.json";

interface Constellation {
  label: string;
  stars: Point3D[];
}

const constellations = _constellations as Constellation[];

interface Params {
  center: Point3D;
  matrix: Matrix;
}

export const useFindConstellations = () => {
  const [nearestConstellations, setNearestConstellations] = useState<
    NearestConstellation2D[]
  >([]);

  const isNearest = useCallback(
    (constellation: Constellation, target: Point3D) => {
      // 45도 이내의 별만 반환하도록 함
      const threshold = Math.cos(Math.PI / 4);

      // 주어진 벡터 v (필터 기준)
      const normalTarget = math.divide(target, math.norm(target)) as Point3D;

      return constellation.stars.some((star: Point3D) => {
        const dotProduct = math.dot(normalTarget, star); // 내적 계산

        return dotProduct >= threshold; // 각도가 threshold 이내인 경우
      });
    },
    [],
  );

  const find = ({ center, matrix }: Params) => {
    setNearestConstellations(
      constellations
        .filter((constellation) => isNearest(constellation, center))
        .map((constellation: Constellation) => ({
          ...constellation,
          stars: constellation.stars.map((star: Point3D) =>
            toCartesian(
              (math.multiply(matrix, star) as Matrix).toArray() as Point3D,
            ),
          ),
        })),
    );
  };

  return {
    find,
    nearestConstellations,
  };
};
