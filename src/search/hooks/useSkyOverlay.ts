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
  // 폴리라인 정점들. 카메라 뒤쪽(반대 반구)이거나 화면에서 너무 먼 정점은
  // null로 두어, 그 정점에 닿는 선분은 그리지 않는다(반대편 하늘 겹침 방지).
  lines: (Point2D | null)[];
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

// 카메라 앞쪽(p[2] > 0)일 때만 사진 좌표를 돌려준다. 뒤쪽 반구 별은 접선평면
// 투영에서 좌표가 거울처럼 뒤집혀 엉뚱한 위치에 찍히므로 null로 거른다
// (solveCore.toPlane과 같은 규약).
const project = (tp: Mat3, vec: Point3D): Point2D | null => {
  const p = mat3MulVec(tp, vec);

  if (p[2] <= 1e-9) {
    return null;
  }

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

      const sk: SkyStar[] = [];

      for (const s of catalogData as VectorStar[]) {
        const dot = s.x * center[0] + s.y * center[1] + s.z * center[2];

        if (dot < starThresh) {
          continue;
        }

        const p = project(transform, [s.x, s.y, s.z]);

        if (!p) {
          continue;
        }

        if (
          p[0] < -50 ||
          p[0] > width + 50 ||
          p[1] < -50 ||
          p[1] > height + 50
        ) {
          continue;
        }

        sk.push({ label: s.N ?? `HR ${s.HR}`, x: p[0], y: p[1] });
      }

      setStars(sk);

      // 정점이 화면에서 이만큼 벗어나면 선이 사진 밖으로 길게 뻗으므로 끊는다
      const marginX = width;
      const marginY = height;
      const cons: SkyConstellation[] = [];

      for (const c of constellationData as ConstellationData[]) {
        const lines: (Point2D | null)[] = c.stars.map((st) => {
          const p = project(transform, [st[0], st[1], st[2]]);

          if (!p) {
            return null;
          }

          if (
            p[0] < -marginX ||
            p[0] > width + marginX ||
            p[1] < -marginY ||
            p[1] > height + marginY
          ) {
            return null;
          }

          return p;
        });

        // 화면 안에 들어오는 정점이 하나도 없으면 그리지 않는다
        const anyVisible = lines.some(
          (p) =>
            p !== null &&
            p[0] >= 0 &&
            p[0] < width &&
            p[1] >= 0 &&
            p[1] < height,
        );

        if (!anyVisible) {
          continue;
        }

        cons.push({ label: c.label, lines });
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
