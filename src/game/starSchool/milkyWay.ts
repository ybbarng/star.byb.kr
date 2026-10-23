import type { Point3D } from "@/scripts/hash/types";
import { fromEcliptic } from "@/game/birthday/zodiac";
import { normalize, raDecVector } from "@/game/starSchool/skyMath";

// 은하수와 황도를 하늘 그림에 겹쳐 그리기 위한 큰 원들.
// 은하 좌표: 은하 북극 (적경 192.85948°, 적위 27.12825°), 은하 중심 (적경 266.40510°, 적위 −28.93617°) — J2000 표준값.

const GALACTIC_POLE = raDecVector(192.85948, 27.12825);
const GALACTIC_CENTER_DIR = raDecVector(266.4051, -28.93617);

// 은하 중심 방향을 극에 수직으로 다듬어 x축, 극을 z축으로 둔다
const GX = (() => {
  const k =
    GALACTIC_CENTER_DIR[0] * GALACTIC_POLE[0] +
    GALACTIC_CENTER_DIR[1] * GALACTIC_POLE[1] +
    GALACTIC_CENTER_DIR[2] * GALACTIC_POLE[2];

  return normalize(GALACTIC_CENTER_DIR.map((c, i) => c - k * GALACTIC_POLE[i]));
})();
const GZ = GALACTIC_POLE;
const GY: Point3D = [
  GZ[1] * GX[2] - GZ[2] * GX[1],
  GZ[2] * GX[0] - GZ[0] * GX[2],
  GZ[0] * GX[1] - GZ[1] * GX[0],
];

const D = Math.PI / 180;

// 은하 경도 l·위도 b(°) → 적도좌표 방향
export const galacticVector = (lDeg: number, bDeg: number): Point3D => {
  const cb = Math.cos(bDeg * D);
  const cl = Math.cos(lDeg * D);
  const sl = Math.sin(lDeg * D);
  const sb = Math.sin(bDeg * D);

  return [0, 1, 2].map(
    (i) => cb * cl * GX[i] + cb * sl * GY[i] + sb * GZ[i],
  ) as Point3D;
};

const wrap180 = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

export interface MilkyWayPatch {
  vector: Point3D;
  brightness: number; // 0~1
  widthDeg: number; // 이 조각이 번지는 반지름
  warm: number; // 0~1, 은하 중심 쪽 누런 빛
}

// 은하 경도별 밝기 (맨눈 사진을 보고 고른 값): 궁수(0°)가 가장 밝고, 방패(27°)·백조(75°)·용골(290°)·
// 센타우루스~전갈(320~350°)이 한 번 더 밝다. 반대쪽 마차부·쌍둥이(180~210°)는 희미하다
const BRIGHT: [number, number][] = [
  [0, 1],
  [12, 0.8],
  [27, 0.85],
  [42, 0.55],
  [60, 0.5],
  [76, 0.72],
  [95, 0.42],
  [120, 0.34],
  [150, 0.24],
  [180, 0.16],
  [210, 0.18],
  [240, 0.24],
  [265, 0.38],
  [290, 0.62],
  [310, 0.6],
  [330, 0.66],
  [348, 0.85],
  [360, 1],
];

// 띠의 두께 (위도 방향 표준편차, °): 중심 팽대부가 가장 두껍다
const SPREAD: [number, number][] = [
  [0, 8],
  [20, 5.5],
  [75, 5.5],
  [180, 3.5],
  [290, 4.5],
  [340, 6],
  [360, 8],
];

const lerpTable = (t: [number, number][], x: number) => {
  for (let i = 1; i < t.length; i++) {
    if (x <= t[i][0]) {
      const [x0, y0] = t[i - 1];
      const [x1, y1] = t[i];

      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }

  return t[t.length - 1][1];
};

const gauss = (x: number, s: number) => Math.exp(-0.5 * (x / s) ** 2);

// 먼지 구름이 가리는 몫 (0~1): 백조~독수리~뱀주인을 가르는 거대한 틈(Great Rift),
// 뱀주인자리 로 구름, 남십자 곁 석탄자루
const dust = (l: number, b: number) => {
  const d = wrap180(l);
  const rift =
    d > 12 && d < 88
      ? 0.6 * gauss(b - 1.5, 1.8) * Math.min(1, (d - 12) / 8, (88 - d) / 8)
      : 0;
  const ophiuchus = 0.45 * gauss(d - 4, 7) * gauss(b - 7, 3);
  const coalsack = 0.75 * gauss(d + 59, 2.2) * gauss(b + 0.5, 2.2);

  return Math.min(0.9, rift + ophiuchus + coalsack);
};

// 같은 자리면 늘 같은 얼룩이 나오는 별구름 무늬 (0.8~1.2)
const mottle = (l: number, b: number) => {
  const s = Math.sin(l * 12.9898 + b * 78.233) * 43758.5453;

  return 0.8 + 0.4 * (s - Math.floor(s));
};

// 은하수 띠를 은하 경도·위도 격자의 작은 빛 조각들로 나눈다. 조각끼리 겹쳐 하나의 띠가 되고,
// 격자가 하늘에 고정돼 있어 확대해도 띠가 하얗게 뭉개지지 않는다
export const milkyWayPatches = (stepDeg = 2): MilkyWayPatch[] => {
  const out: MilkyWayPatch[] = [];

  for (let l = 0; l < 360; l += stepDeg) {
    const d = wrap180(l);
    const bright = lerpTable(BRIGHT, l);
    const spread = lerpTable(SPREAD, l);
    // 팽대부는 조금 남쪽(은하 위도 −)으로 처진다
    const center = -2 * gauss(d, 15);

    for (let b = -18; b <= 18; b += stepDeg) {
      const brightness =
        bright * gauss(b - center, spread) * (1 - dust(l, b)) * mottle(l, b);

      if (brightness < 0.04) continue;

      out.push({
        vector: galacticVector(l, b),
        brightness,
        widthDeg: stepDeg * 2.2,
        warm: gauss(d, 25),
      });
    }
  }

  return out;
};

// 황도 (해가 1년 동안 지나는 길): J2000 황도 위의 점들
export const eclipticPoints = (stepDeg = 3): Point3D[] =>
  Array.from({ length: Math.round(360 / stepDeg) + 1 }, (_, i) =>
    fromEcliptic(i * stepDeg, 0),
  );
