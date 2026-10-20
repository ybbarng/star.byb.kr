import type { Point2D, Point3D } from "@/scripts/hash/types";
import {
  CONSTELLATIONS,
  constellationCenter,
  uniqueStars,
} from "@/game/sky/catalog";
import { umeyamaSimilarity2D } from "@/search/utils/similarity";
import { projectionMatrix } from "@/search/utils/wcs";

// 점 찍어 별자리 찾기: 사람이 찍은 점들과 가장 닮은 실제 별자리를 고른다.
// 플레이트 솔버의 기하 해싱과 같은 생각 — 모양은 위치·회전·크기와 상관없다.
// 찍은 점 중 가장 먼 두 점을 별자리 별 두 개에 대응시켜 닮음변환을 정하고, 나머지 점이 별자리 별에
// 얼마나 가까운지(찍은 모양 크기 대비 오차)로 점수를 매긴다. 별이 많은 별자리는 아무 점에나 맞기 쉬우므로
// 찍은 점보다 남는 별이 많을수록 조금씩 깎는다.

export interface ShapeTemplate {
  label: string;
  points: Point2D[]; // 별자리 별들 (하늘을 올려다본 방향의 평면, y는 아래로)
  lines: Point2D[][]; // 별자리선
}

export interface ShapeMatch {
  label: string;
  score: number; // 작을수록 닮았다
  toScreen: (p: Point2D) => Point2D; // 별자리 평면 → 찍은 화면
  template: ShapeTemplate;
}

// 남는 별 하나당 깎는 정도 (별 수 대비)
const EXTRA_STAR_PENALTY = 0.15;

// 별자리마다 가운데에서 본 평면 모양 (동쪽이 왼쪽, 북쪽이 위 — 하늘을 올려다본 모양)
const toPlane = (P: number[][], v: Point3D): Point2D => {
  const x = P[0][0] * v[0] + P[0][1] * v[1] + P[0][2] * v[2];
  const y = P[1][0] * v[0] + P[1][1] * v[1] + P[1][2] * v[2];
  const z = P[2][0] * v[0] + P[2][1] * v[1] + P[2][2] * v[2];

  return [x / z, y / z];
};

export const TEMPLATES: ShapeTemplate[] = (() => {
  const labels = [...new Set(CONSTELLATIONS.map((c) => c.label))];

  return labels
    .map((label) => {
      const parts = CONSTELLATIONS.filter((c) => c.label === label);
      const center = constellationCenter(parts);
      // 북쪽이 위가 되도록 천구 북극을 향한 평면 기저를 직접 만든다
      const north: Point3D = [0, 0, 1];
      const e = [
        north[1] * center[2] - north[2] * center[1],
        north[2] * center[0] - north[0] * center[2],
        north[0] * center[1] - north[1] * center[0],
      ];
      const en = Math.hypot(e[0], e[1], e[2]) || 1;
      const east = e.map((x) => x / en);
      const up = [
        center[1] * east[2] - center[2] * east[1],
        center[2] * east[0] - center[0] * east[2],
        center[0] * east[1] - center[1] * east[0],
      ];
      // 화면: x는 서쪽(동쪽의 반대)으로, y는 아래로
      const P =
        en > 1e-6
          ? [east.map((x) => -x), up.map((x) => -x), [...center]]
          : projectionMatrix(center);
      const map = (v: Point3D) => toPlane(P, v);

      return {
        label,
        points: uniqueStars(parts).map(map),
        lines: parts.map((c) => c.stars.map(map)),
      };
    })
    .filter((t) => t.points.length >= 3);
})();

// a,b → A,B로 보내는 닮음변환 (복소수 곱으로)
const similarity = (a: Point2D, b: Point2D, A: Point2D, B: Point2D) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const DX = B[0] - A[0];
  const DY = B[1] - A[1];
  const n = dx * dx + dy * dy;
  // (DX + iDY) / (dx + idy)
  const re = (DX * dx + DY * dy) / n;
  const im = (DY * dx - DX * dy) / n;

  return (p: Point2D): Point2D => {
    const x = p[0] - a[0];
    const y = p[1] - a[1];

    return [A[0] + re * x - im * y, A[1] + im * x + re * y];
  };
};

export const matchShape = (drawn: Point2D[], top = 3): ShapeMatch[] => {
  const n = drawn.length;

  if (n < 3) {
    return [];
  }

  // 가장 먼 두 점을 기준으로
  let i0 = 0;
  let i1 = 1;
  let far = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = Math.hypot(
        drawn[i][0] - drawn[j][0],
        drawn[i][1] - drawn[j][1],
      );

      if (d > far) {
        far = d;
        i0 = i;
        i1 = j;
      }
    }
  }

  const restIdx = drawn.map((_, k) => k).filter((k) => k !== i0 && k !== i1);
  const results: ShapeMatch[] = [];

  for (const t of TEMPLATES) {
    const m = t.points.length;

    if (m < n) {
      continue;
    }

    // 가장 잘 맞는 대응 (별자리 별 번호, 찍은 점 번호)
    let best: { score: number; pairs: [number, number][] } | null = null;

    for (let a = 0; a < m; a++) {
      for (let b = 0; b < m; b++) {
        if (a === b) {
          continue;
        }

        const f = similarity(t.points[a], t.points[b], drawn[i0], drawn[i1]);
        const mapped = t.points.map(f);
        const used = new Set([a, b]);
        const pairs: [number, number][] = [
          [a, i0],
          [b, i1],
        ];
        let sum = 0;

        for (const r of restIdx) {
          const p = drawn[r];
          let bestK = -1;
          let bestD = Infinity;

          mapped.forEach((q, k) => {
            if (used.has(k)) {
              return;
            }

            const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;

            if (d < bestD) {
              bestD = d;
              bestK = k;
            }
          });

          used.add(bestK);
          pairs.push([bestK, r]);
          sum += bestD;
        }

        const rms = Math.sqrt(sum / Math.max(1, restIdx.length)) / far;

        if (!best || rms < best.score) {
          best = { score: rms, pairs };
        }
      }
    }

    if (best) {
      // 대응 전체로 닮음변환을 다시 맞춘다 (두 점으로 정한 변환보다 모든 점에 고르게 맞는다)
      const { matrix: T } = umeyamaSimilarity2D(
        best.pairs.map(([k]) => t.points[k]),
        best.pairs.map(([, d]) => drawn[d]),
      );
      const f = (q: Point2D): Point2D => [
        T[0][0] * q[0] + T[0][1] * q[1] + T[0][2],
        T[1][0] * q[0] + T[1][1] * q[1] + T[1][2],
      ];
      const sum = best.pairs.reduce((acc, [k, d]) => {
        const q = f(t.points[k]);

        return acc + (q[0] - drawn[d][0]) ** 2 + (q[1] - drawn[d][1]) ** 2;
      }, 0);

      results.push({
        label: t.label,
        score: Math.sqrt(sum / n) / far + (EXTRA_STAR_PENALTY * (m - n)) / m,
        toScreen: f,
        template: t,
      });
    }
  }

  return results.sort((x, y) => x.score - y.score).slice(0, top);
};

// 점수 → 상위 후보끼리의 대략적인 확률 (작은 점수일수록 크게)
export const likelihoods = (matches: ShapeMatch[]): number[] => {
  const w = matches.map((m) => Math.exp(-m.score / 0.05));
  const s = w.reduce((a, b) => a + b, 0) || 1;

  return w.map((x) => x / s);
};
