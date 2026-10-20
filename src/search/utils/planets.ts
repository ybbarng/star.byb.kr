import type { Point3D } from "@/scripts/hash/types";

// 행성 위치. JPL의 "Keplerian Elements for Approximate Positions of the Major Planets"
// (E. M. Standish) 표 1(1800~2050년)의 궤도 요소로 케플러 운동을 풀어 직접 계산한다.
// 정확도는 1분각(0.02°) 안팎 — 사진 위에 행성 이름을 붙이기에 충분하다.
// 궤도 요소가 J2000 황도 기준이라 결과도 카탈로그와 같은 J2000 적도좌표 단위 벡터다.

export type PlanetName =
  | "Mercury"
  | "Venus"
  | "Mars"
  | "Jupiter"
  | "Saturn"
  | "Uranus"
  | "Neptune";

type Elements = [
  number, // a: 긴반지름 (au)
  number, // e: 이심률
  number, // I: 궤도 경사 (°)
  number, // L: 평균 경도 (°)
  number, // ϖ: 근일점 경도 (°)
  number, // Ω: 승교점 경도 (°)
];

// [J2000 값, 100년(율리우스 세기)당 변화]
const ELEMENTS: Record<PlanetName | "EarthMoon", [Elements, Elements]> = {
  Mercury: [
    [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593],
    [
      0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689,
      -0.12534081,
    ],
  ],
  Venus: [
    [
      0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718,
      76.67984255,
    ],
    [
      0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329,
      -0.27769418,
    ],
  ],
  EarthMoon: [
    [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0],
    [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0],
  ],
  Mars: [
    [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    [
      0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088,
      -0.29257343,
    ],
  ],
  Jupiter: [
    [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    [
      -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668,
      0.20469106,
    ],
  ],
  Saturn: [
    [
      9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831,
      113.66242448,
    ],
    [
      -0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216,
      -0.28867794,
    ],
  ],
  Uranus: [
    [
      19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763,
      74.01692503,
    ],
    [
      -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281,
      0.04240589,
    ],
  ],
  Neptune: [
    [
      30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227,
      131.78422574,
    ],
    [
      0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464,
      -0.00508664,
    ],
  ],
};

export const PLANET_NAMES = Object.keys(ELEMENTS).filter(
  (k) => k !== "EarthMoon",
) as PlanetName[];

const D = Math.PI / 180;
const OBLIQUITY_J2000 = 23.43928;

// 해 중심 J2000 황도 좌표 (au)
const heliocentric = (
  body: PlanetName | "EarthMoon",
  jd: number,
): [number, number, number] => {
  const T = (jd - 2451545) / 36525;
  const [base, rate] = ELEMENTS[body];
  const [a, e, I, L, peri, node] = base.map((v, i) => v + rate[i] * T);
  const omega = peri - node; // 근일점 인수
  const M = ((((L - peri) % 360) + 540) % 360) - 180; // 평균 근점 이각, -180~180

  // 케플러 방정식 M = E - e·sin E (뉴턴법)
  let E = M + (e / D) * Math.sin(M * D);

  for (let i = 0; i < 10; i++) {
    const dE =
      (M - (E - (e / D) * Math.sin(E * D))) / (1 - e * Math.cos(E * D));
    E += dE;

    if (Math.abs(dE) < 1e-8) {
      break;
    }
  }

  const xp = a * (Math.cos(E * D) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E * D);
  const [cw, sw] = [Math.cos(omega * D), Math.sin(omega * D)];
  const [cn, sn] = [Math.cos(node * D), Math.sin(node * D)];
  const [ci, si] = [Math.cos(I * D), Math.sin(I * D)];

  return [
    (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp,
    (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp,
    sw * si * xp + cw * si * yp,
  ];
};

export interface PlanetPosition {
  vector: Point3D; // 지구에서 본 방향 (J2000 적도)
  distanceAu: number;
}

// 지구에서 본 행성. 빛이 오는 시간만큼 앞선 위치를 쓴다(목성이면 약 40분).
export const planetPosition = (
  name: PlanetName,
  jd: number,
): PlanetPosition => {
  const earth = heliocentric("EarthMoon", jd);
  let t = jd;
  let g: number[] = [0, 0, 0];
  let r = 0;

  for (let i = 0; i < 2; i++) {
    const p = heliocentric(name, t);
    g = p.map((c, k) => c - earth[k]);
    r = Math.hypot(g[0], g[1], g[2]);
    t = jd - r * 0.0057755; // 1au를 빛이 가는 시간(일)
  }

  const ce = Math.cos(OBLIQUITY_J2000 * D);
  const se = Math.sin(OBLIQUITY_J2000 * D);

  return {
    vector: [
      g[0] / r,
      (ce * g[1] - se * g[2]) / r,
      (se * g[1] + ce * g[2]) / r,
    ],
    distanceAu: r,
  };
};
