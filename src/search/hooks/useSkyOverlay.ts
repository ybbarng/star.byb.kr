import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { useCallback, useState } from "react";
import { mat3MulVec } from "@/search/utils/wcs";
import constellationData from "@build/database/vectors-constellations.json";
import catalogData from "@build/database/vectors-database.json";

// 후보의 변환행렬(TP)로 카탈로그 별/별자리를 사진 좌표에 투영하는 hook.
// solver가 transform을 직접 주므로 quad 4점에서 TP를 다시 계산할 필요가 없다.

export interface SkyStar {
  label: string;
  x: number;
  y: number;
}

export interface SkyConstellation {
  label: string;
  lines: Point2D[];
}

interface VectorStar {
  HR: string;
  N?: string;
  x: number;
  y: number;
  z: number;
}

interface ConstellationData {
  label: string;
  stars: number[][];
}

const project = (tp: Mat3, vec: Point3D): Point2D => {
  const p = mat3MulVec(tp, vec);

  return [p[0] / p[2], p[1] / p[2]];
};

export default function useSkyOverlay() {
  const [stars, setStars] = useState<SkyStar[]>([]);
  const [constellations, setConstellations] = useState<SkyConstellation[]>([]);

  const update = useCallback(
    (
      transform: Mat3,
      center: Point3D,
      fovDeg: number,
      width: number,
      height: number,
    ) => {
      const fovRad = (fovDeg * Math.PI) / 180;
      const starThresh = Math.cos(fovRad * 0.75);
      const consThresh = Math.cos(fovRad * 1.2);

      const sk: SkyStar[] = [];

      for (const s of catalogData as VectorStar[]) {
        const dot = s.x * center[0] + s.y * center[1] + s.z * center[2];

        if (dot < starThresh) {
          continue;
        }

        const [x, y] = project(transform, [s.x, s.y, s.z]);

        if (x < -50 || x > width + 50 || y < -50 || y > height + 50) {
          continue;
        }

        sk.push({ label: s.N ?? `HR ${s.HR}`, x, y });
      }

      setStars(sk);

      const cons: SkyConstellation[] = [];

      for (const c of constellationData as ConstellationData[]) {
        const inFov = c.stars.some(
          (st) =>
            st[0] * center[0] + st[1] * center[1] + st[2] * center[2] >=
            consThresh,
        );

        if (!inFov) {
          continue;
        }

        cons.push({
          label: c.label,
          lines: c.stars.map((st) => project(transform, [st[0], st[1], st[2]])),
        });
      }

      setConstellations(cons);
    },
    [],
  );

  const clear = useCallback(() => {
    setStars([]);
    setConstellations([]);
  }, []);

  return { stars, constellations, update, clear };
}
