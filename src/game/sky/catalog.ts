import type { DrawConstellation, DrawStar, SkyItem } from "@/game/sky/drawSky";
import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { koreanStarName } from "@/search/utils/starNames";
import { projectVecToPhoto } from "@/search/utils/wcs";
import constellationData from "@build/database/vectors-constellations.json";
import catalogData from "@build/database/vectors-database.json";

// 게임들이 같이 쓰는 별·별자리 데이터 (5등급까지의 별 1,625개, 별자리선 88개)

interface VectorStar {
  HR: string;
  N?: string;
  V: string;
  K?: string;
  x: number;
  y: number;
  z: number;
}

// name은 게임에 보여 줄 한글 이름 (starNames.ts), latinName은 카탈로그의 원래 이름
export const STARS: (DrawStar & { hr: string; latinName?: string })[] = (
  catalogData as VectorStar[]
).map((s) => ({
  hr: s.HR,
  vector: [s.x, s.y, s.z],
  mag: parseFloat(s.V),
  kelvin: s.K ? parseFloat(s.K) : 6000,
  name: s.N ? koreanStarName(s.N) : undefined,
  latinName: s.N,
  id: s.HR,
}));

export const CONSTELLATIONS: DrawConstellation[] = (
  constellationData as { label: string; stars: number[][] }[]
).map((c) => ({ label: c.label, stars: c.stars as Point3D[] }));

// 한 별자리의 선 묶음들 (남십자·뱀자리처럼 선이 두 갈래로 나뉜 별자리가 있다)
export const constellationParts = (label: string): DrawConstellation[] =>
  CONSTELLATIONS.filter((c) => c.label === label);

// 별자리를 이루는 서로 다른 별들 (선 데이터에는 같은 별이 여러 번 나온다)
export const uniqueStars = (parts: DrawConstellation[]): Point3D[] => {
  const out: Point3D[] = [];

  for (const v of parts.flatMap((c) => c.stars)) {
    if (
      !out.some(
        (u) =>
          Math.abs(u[0] - v[0]) < 1e-9 &&
          Math.abs(u[1] - v[1]) < 1e-9 &&
          Math.abs(u[2] - v[2]) < 1e-9,
      )
    ) {
      out.push(v);
    }
  }

  return out;
};

// 별자리 가운데 방향 (별들의 평균)
export const constellationCenter = (parts: DrawConstellation[]): Point3D => {
  const stars = uniqueStars(parts);
  const s = stars.reduce(
    (a, v) => [a[0] + v[0], a[1] + v[1], a[2] + v[2]],
    [0, 0, 0],
  );
  const n = Math.hypot(s[0], s[1], s[2]);

  return [s[0] / n, s[1] / n, s[2] / n];
};

// 누른 자리의 천체: 반지름 안에 든 것 중 달·행성·이름 있는 별을 먼저, 그다음 가까운 것
export const pickItem = (
  items: SkyItem[],
  x: number,
  y: number,
): SkyItem | null => {
  const rank = (it: SkyItem) =>
    it.kind === "moon"
      ? 0
      : it.kind === "planet"
        ? 1
        : it.kind === "star" && it.label !== "이름 없는 별"
          ? 2
          : 3;
  const hits = items
    .map((it) => ({ it, d: Math.hypot(it.x - x, it.y - y) }))
    .filter(({ it, d }) => d <= it.radius)
    .sort((a, b) => rank(a.it) - rank(b.it) || a.d - b.d);

  return hits[0]?.it ?? null;
};

// 별자리선들을 사진 좌표 꺾은선으로 (카메라 뒤로 가는 별에서 선을 끊는다). 선이 그려지는 효과(LineReveal)에 쓴다
export const projectLines = (
  TP: Mat3,
  parts: DrawConstellation[],
): Point2D[][] =>
  parts.flatMap((c) => {
    const lines: Point2D[][] = [[]];

    for (const v of c.stars) {
      const p = projectVecToPhoto(TP, v);

      if (p) {
        lines[lines.length - 1].push(p);
      } else if (lines[lines.length - 1].length) {
        lines.push([]);
      }
    }

    return lines.filter((l) => l.length > 1);
  });
