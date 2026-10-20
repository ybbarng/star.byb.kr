import type { Point3D } from "@/scripts/hash/types";
import bounds from "@build/database/constellation-bounds.json";

// IAU 별자리 경계(88개 구역). 오늘날 천문학에서 별자리는 선 그림이 아니라 하늘을 빈틈없이 나눈 구역이다.
// 원본은 꼭짓점(J2000 적경·적위)뿐이고, 변은 적경 또는 적위가 일정한 선이라 꼭짓점 사이를 적경·적위
// 평면에서 곧게 1° 간격으로 잇는다 (data/database/d3-celestial/README.md).

const D = Math.PI / 180;
const STEP_DEG = 1;

export interface BoundaryRing {
  label: string;
  points: Point3D[]; // 그리기용 닫힌 고리 (처음 점으로 돌아온다)
  vertices: number[][]; // 원래 꼭짓점 [적경°, 적위°] (닫힌 고리)
  // 천구의 극을 감싸는 구역(작은곰·팔분의자리)이면 그 극 (1 북극, -1 남극), 아니면 0
  pole: -1 | 0 | 1;
}

const toVector = (raDeg: number, decDeg: number): Point3D => [
  Math.cos(decDeg * D) * Math.cos(raDeg * D),
  Math.cos(decDeg * D) * Math.sin(raDeg * D),
  Math.sin(decDeg * D),
];

// 적경 차이를 -180~180°로 (0°/360°를 넘어가는 쪽으로 짧게)
const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

const close = (ring: number[][]) =>
  ring[0][0] === ring[ring.length - 1][0] &&
  ring[0][1] === ring[ring.length - 1][1]
    ? ring
    : [...ring, ring[0]];

const densify = (closed: number[][]): Point3D[] => {
  const points: Point3D[] = [];

  for (let i = 0; i < closed.length - 1; i++) {
    const [ra1, dec1] = closed[i];
    const [ra2, dec2] = closed[i + 1];
    const dRa = wrap(ra2 - ra1);
    const dDec = dec2 - dec1;
    const steps = Math.max(
      1,
      Math.ceil(Math.max(Math.abs(dRa), Math.abs(dDec)) / STEP_DEG),
    );

    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      points.push(toVector(ra1 + dRa * t, dec1 + dDec * t));
    }
  }

  points.push(points[0]);

  return points;
};

let rings: BoundaryRing[] | null = null;

// 처음 쓸 때 한 번 만든다
export const boundaryRings = (): BoundaryRing[] => {
  if (rings) return rings;

  rings = (bounds as { label: string; ring: number[][] }[]).map(
    ({ label, ring }) => {
      const vertices = close(ring);
      // 적경이 한 바퀴(±360°) 돌면 극을 감싼다. 어느 극인지는 꼭짓점들의 적위 부호로
      let turn = 0;

      for (let i = 0; i < vertices.length - 1; i++) {
        turn += wrap(vertices[i + 1][0] - vertices[i][0]);
      }

      const pole =
        Math.abs(turn) > 180 ? (vertices[0][1] > 0 ? 1 : -1) : (0 as const);

      return { label, points: densify(vertices), vertices, pole };
    },
  );

  return rings;
};

let edges: Point3D[][] | null = null;

// 그리기용 경계 변. 이웃한 두 구역이 같은 변을 나눠 가지므로 한 번씩만 (두 번 그리면 점선이 겹쳐 실선처럼 보인다)
export const boundaryEdges = (): Point3D[][] => {
  if (edges) return edges;

  const seen = new Set<string>();
  const key = (p: number[]) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
  edges = [];

  for (const ring of boundaryRings()) {
    const v = ring.vertices;

    for (let i = 0; i < v.length - 1; i++) {
      const a = key(v[i]);
      const b = key(v[i + 1]);
      const id = a < b ? `${a}|${b}` : `${b}|${a}`;

      if (seen.has(id)) continue;

      seen.add(id);
      // 변 하나를 1° 간격으로 (densify는 닫힌 고리용이라 마지막 점을 직접 붙인다)
      const pts = densify([v[i], v[i + 1]]);
      pts[pts.length - 1] = toVector(v[i + 1][0], v[i + 1][1]);
      edges.push(pts);
    }
  }

  return edges;
};

// 적경·적위 평면에서 점에서 극 쪽으로 쏜 반직선이 경계를 몇 번 넘는지 (홀수면 안).
// 극을 감싸는 구역은 그 극의 반대쪽으로 쏜다.
const inside = (raDeg: number, decDeg: number, ring: BoundaryRing) => {
  const towardNorth = ring.pole !== 1;
  let crossings = 0;
  const v = ring.vertices;

  for (let i = 0; i < v.length - 1; i++) {
    const x1 = wrap(v[i][0] - raDeg);
    const x2 = x1 + wrap(v[i + 1][0] - v[i][0]);

    // 이 변이 점의 적경(x = 0)을 지나는가 (한쪽 끝만 포함해 두 번 세지 않는다)
    if (x1 <= 0 === x2 <= 0) continue;

    const dec = v[i][1] + ((v[i + 1][1] - v[i][1]) * (0 - x1)) / (x2 - x1);

    if (towardNorth ? dec > decDeg : dec < decDeg) crossings++;
  }

  return crossings % 2 === 1;
};

// 방향 v가 속한 별자리 구역
export const constellationAt = (v: Point3D): string | null => {
  const ra = (Math.atan2(v[1], v[0]) / D + 360) % 360;
  const dec = Math.asin(Math.max(-1, Math.min(1, v[2]))) / D;

  for (const ring of boundaryRings()) {
    if (inside(ra, dec, ring)) {
      return ring.label;
    }
  }

  return null;
};

// 방향 v가 속한 구역들 (테스트: 하늘의 모든 방향은 정확히 한 구역이어야 한다)
export const constellationsContaining = (v: Point3D): string[] => {
  const ra = (Math.atan2(v[1], v[0]) / D + 360) % 360;
  const dec = Math.asin(Math.max(-1, Math.min(1, v[2]))) / D;

  return boundaryRings()
    .filter((ring) => inside(ra, dec, ring))
    .map((r) => r.label);
};
