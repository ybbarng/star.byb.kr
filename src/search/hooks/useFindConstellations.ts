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
  fov: number;
}

export const useFindConstellations = () => {
  const [nearestConstellations, setNearestConstellations] = useState<
    NearestConstellation2D[]
  >([]);

  const isNearest = useCallback(
    (constellation: Constellation, target: Point3D, fov: number) => {
      // 동적 FOV 기반 threshold
      const threshold = Math.cos(fov * 1.2);

      // 주어진 벡터 v (필터 기준)
      const norm = Math.sqrt(
        target[0] * target[0] + target[1] * target[1] + target[2] * target[2],
      );
      const normalTarget: Point3D = [
        target[0] / norm,
        target[1] / norm,
        target[2] / norm,
      ];

      return constellation.stars.some((star: Point3D) => {
        const dotProduct =
          normalTarget[0] * star[0] +
          normalTarget[1] * star[1] +
          normalTarget[2] * star[2];

        return dotProduct >= threshold;
      });
    },
    [],
  );

  const find = ({ center, matrix, fov }: Params) => {
    setNearestConstellations(
      constellations
        .filter((constellation) => isNearest(constellation, center, fov))
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
