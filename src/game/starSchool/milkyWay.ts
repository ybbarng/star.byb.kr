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
  widthDeg: number; // 반폭
}

// 은하수 띠: 은하 중심(궁수자리) 쪽이 가장 굵고 밝고, 백조자리 쪽이 한 번 더 밝다. 반대쪽(마차부자리)은 희미하다.
export const milkyWayPatches = (stepDeg = 4): MilkyWayPatch[] => {
  const out: MilkyWayPatch[] = [];

  for (let l = 0; l < 360; l += stepDeg) {
    const d = wrap180(l);
    const core = Math.exp(-((d / 45) ** 2));
    const cygnus = Math.exp(-(((d - 75) / 22) ** 2));
    const brightness = 0.3 + 0.6 * core + 0.3 * cygnus;
    const widthDeg = 5 + 6 * core + 2 * cygnus;
    // 은하 중심 둘레는 위아래로 부푼다 (팽대부)
    const offsets = core > 0.5 ? [-4, 0, 4] : [0];

    for (const b of offsets) {
      out.push({
        vector: galacticVector(l, b),
        brightness: b === 0 ? brightness : brightness * 0.6,
        widthDeg,
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
