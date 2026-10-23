import type { Point3D } from "@/scripts/hash/types";
import {
  constellationCenter,
  constellationParts,
  STARS,
  uniqueStars,
} from "@/game/sky/catalog";
import { asterismById } from "@/game/starSchool/asterisms";
import {
  centerOf,
  hrVector,
  separationDeg,
  STAR_BY_HR,
} from "@/game/starSchool/skyMath";

// 카드에 그릴 별자리·길잡이 모양: 가운데에서 본 평면(북쪽이 위, 동쪽이 왼쪽 — 하늘을 올려다본 모양)으로 펴서
// −1~1 상자에 맞춘다. 둘레의 어두운 별(field)도 같이 담아, 선을 지운 연습에서 진짜 하늘처럼 보이게 한다.

export interface FigureStar {
  x: number;
  y: number; // 아래로 +
  mag: number;
  name?: string;
  key: string; // 같은 별인지 가리는 열쇠 (HR, 없으면 좌표)
}

export interface Figure {
  stars: FigureStar[]; // 모양을 이루는 별
  lines: [number, number][][]; // 선 (꺾은선, 좌표)
  edges: [string, string][]; // 선분 (별 열쇠 쌍) — 선 잇기 채점에 쓴다
  field: FigureStar[]; // 둘레의 다른 별
}

const keyOf = (v: Point3D) => {
  const s = STARS.find(
    (x) =>
      x.vector[0] * v[0] + x.vector[1] * v[1] + x.vector[2] * v[2] > 0.9999999,
  );

  return s ? s.hr : v.map((c) => c.toFixed(5)).join(",");
};

const magOf = (key: string) => STAR_BY_HR.get(key)?.mag ?? 4.5;
const nameOf = (key: string) => STAR_BY_HR.get(key)?.name;

// 가운데 방향 c에서 본 평면 좌표 (gnomonic): x는 서쪽(오른쪽)으로, y는 남쪽(아래)으로
const planeOf = (c: Point3D) => {
  const north: Point3D = Math.abs(c[2]) > 0.999 ? [1, 0, 0] : [0, 0, 1];
  const e = [
    north[1] * c[2] - north[2] * c[1],
    north[2] * c[0] - north[0] * c[2],
    north[0] * c[1] - north[1] * c[0],
  ];
  const en = Math.hypot(e[0], e[1], e[2]);
  const east = e.map((x) => x / en);
  const up = [
    c[1] * east[2] - c[2] * east[1],
    c[2] * east[0] - c[0] * east[2],
    c[0] * east[1] - c[1] * east[0],
  ];

  return (v: Point3D): [number, number] => {
    const z = v[0] * c[0] + v[1] * c[1] + v[2] * c[2];
    const x = v[0] * east[0] + v[1] * east[1] + v[2] * east[2];
    const y = v[0] * up[0] + v[1] * up[1] + v[2] * up[2];

    return [-x / z, -y / z];
  };
};

const build = (
  center: Point3D,
  lineVectors: Point3D[][],
  memberVectors: Point3D[],
  fieldMag: number,
): Figure => {
  const plane = planeOf(center);
  const keys = memberVectors.map(keyOf);
  const raw = memberVectors.map(plane);
  const radiusDeg = Math.max(
    ...memberVectors.map((v) => separationDeg(v, center)),
    2,
  );
  const scale =
    Math.max(...raw.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y))), 1e-6) *
    1.08;
  const fit = ([x, y]: [number, number]): [number, number] => [
    x / scale,
    y / scale,
  ];
  const memberSet = new Set(keys);
  const field = STARS.filter(
    (s) =>
      s.mag <= fieldMag &&
      !memberSet.has(s.hr) &&
      separationDeg(s.vector, center) < radiusDeg * 1.6 + 2,
  )
    .map((s) => {
      const [x, y] = fit(plane(s.vector));

      return { x, y, mag: s.mag, key: s.hr };
    })
    .filter((s) => Math.abs(s.x) <= 1.25 && Math.abs(s.y) <= 1.25);
  const edges: [string, string][] = [];

  for (const line of lineVectors) {
    for (let i = 0; i + 1 < line.length; i++) {
      const a = keyOf(line[i]);
      const b = keyOf(line[i + 1]);

      if (
        a !== b &&
        !edges.some(([p, q]) => (p === a && q === b) || (p === b && q === a))
      ) {
        edges.push([a, b]);
      }
    }
  }

  return {
    stars: raw.map((p, i) => {
      const [x, y] = fit(p);

      return { x, y, mag: magOf(keys[i]), name: nameOf(keys[i]), key: keys[i] };
    }),
    lines: lineVectors.map((l) => l.map((v) => fit(plane(v)))),
    edges,
    field,
  };
};

const cache = new Map<string, Figure>();

// 별자리 (catalog 라벨)
export const constellationFigure = (label: string): Figure => {
  const id = `c:${label}`;
  const hit = cache.get(id);

  if (hit) {
    return hit;
  }

  const parts = constellationParts(label);
  const f = build(
    constellationCenter(parts),
    parts.map((p) => p.stars),
    uniqueStars(parts),
    4.6,
  );
  cache.set(id, f);

  return f;
};

// 길잡이 모양 (asterisms.ts의 id)
export const asterismFigure = (id: string): Figure => {
  const key = `a:${id}`;
  const hit = cache.get(key);

  if (hit) {
    return hit;
  }

  const a = asterismById(id);
  const members = [...new Set([...a.vertices, ...a.path.flat()])];
  const vs = members.map(hrVector);
  const f = build(
    centerOf(vs),
    a.path.map((l) => l.map(hrVector)),
    vs,
    3.8,
  );
  cache.set(key, f);

  return f;
};
