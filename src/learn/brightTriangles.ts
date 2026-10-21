import type { Point3D } from "@/scripts/hash/types";
import { STARS } from "@/game/sky/catalog";
import { projectTriangle } from "@/search/catalogGeometry";

// 밝은 별(3.5등급까지) 삼각형 색인: 한 별과, 그 별에서 30° 안의 두 별로 만든 삼각형 (같은 삼각형은 한 번만).
// 풀이의 밝은 별 삼각형 색인(search/solverContext.ts: 3.5등급, 30°)과 같은 규칙이다. 삼각형 데모들이 같이 쓴다.

const MAX_MAG = 3.5;
const MAX_ANGLE_DEG = 30;
const D = Math.PI / 180;

export interface CatalogTriangle {
  stars: [number, number, number]; // STARS 번호
  shape: [number, number]; // (짧은÷긴, 중간÷긴)
  sizeDeg: number; // 하늘에서 가장 긴 변 (각도)
  points: [number, number][]; // 접선 평면 위 모양 (그리기용)
}

// 세 변의 길이로 모양 값 (돌리고 키워도 그대로)
export const shapeOfSides = (sides: number[]): [number, number] => {
  const d = [...sides].sort((a, b) => a - b);

  return [d[0] / d[2], d[1] / d[2]];
};

export const shapeOf = (pts: [number, number][]): [number, number] =>
  shapeOfSides([
    Math.hypot(pts[1][0] - pts[2][0], pts[1][1] - pts[2][1]),
    Math.hypot(pts[0][0] - pts[2][0], pts[0][1] - pts[2][1]),
    Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]),
  ]);

const dot = (a: Point3D, b: Point3D) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const angleDeg = (a: Point3D, b: Point3D) =>
  Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) / D;

export const buildBrightTriangles = (): CatalogTriangle[] => {
  const bright = STARS.map((s, i) => ({ s, i })).filter(
    ({ s }) => s.mag <= MAX_MAG,
  );
  const cos = Math.cos(MAX_ANGLE_DEG * D);
  const seen = new Set<number>();
  const out: CatalogTriangle[] = [];

  for (const center of bright) {
    const near = bright.filter(
      (o) => o.i !== center.i && dot(o.s.vector, center.s.vector) >= cos,
    );

    for (let a = 0; a < near.length; a++) {
      for (let b = a + 1; b < near.length; b++) {
        const ids = [center.i, near[a].i, near[b].i].sort((x, y) => x - y);
        const key = ids[0] * 4e6 + ids[1] * 2e3 + ids[2];

        if (seen.has(key)) continue;

        seen.add(key);
        const v = ids.map((id) => STARS[id].vector as Point3D);
        const points = projectTriangle(v) as [number, number][];
        out.push({
          stars: ids as [number, number, number],
          shape: shapeOf(points),
          sizeDeg: Math.max(
            angleDeg(v[0], v[1]),
            angleDeg(v[0], v[2]),
            angleDeg(v[1], v[2]),
          ),
          points,
        });
      }
    }
  }

  return out;
};
