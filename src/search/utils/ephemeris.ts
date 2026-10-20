import type { Point3D } from "@/scripts/hash/types";

// 해·달의 위치와 관측지의 고도·방위. 천문연감(Astronomical Almanac)의 저정밀 공식을 직접 옮겼다.
// 정확도는 해 약 0.01°, 달 약 0.3° — 사진 속 달을 찾거나 촬영 날짜·시각을 좁히기에는 충분하다.
// 좌표는 카탈로그와 같은 적도좌표 단위 벡터 (x: 춘분점, z: 천구 북극).

export interface Observer {
  latDeg: number;
  lonDeg: number; // 동경이 +
}

const D = Math.PI / 180;
const sinD = (x: number) => Math.sin(x * D);
const cosD = (x: number) => Math.cos(x * D);

const J2000 = 2451545;

// UTC 시각 → 율리우스일. Date의 기준(1970-01-01 0시 UTC)이 율리우스일 2440587.5다.
export const julianDay = (date: Date) => date.getTime() / 86400000 + 2440587.5;

// 그리니치 평균 항성시(도). 같은 항성시면 같은 하늘이 보인다.
export const gmstDeg = (jd: number) =>
  (((280.46061837 + 360.98564736629 * (jd - J2000)) % 360) + 360) % 360;

export const localSiderealDeg = (jd: number, observer: Observer) =>
  (((gmstDeg(jd) + observer.lonDeg) % 360) + 360) % 360;

const obliquityDeg = (jd: number) => 23.439 - 0.0000004 * (jd - J2000);

const eclipticToEquatorial = (
  lambdaDeg: number,
  betaDeg: number,
  jd: number,
): Point3D => {
  const eps = obliquityDeg(jd);
  const x = cosD(betaDeg) * cosD(lambdaDeg);
  const y = cosD(betaDeg) * sinD(lambdaDeg);
  const z = sinD(betaDeg);

  return [x, cosD(eps) * y - sinD(eps) * z, sinD(eps) * y + cosD(eps) * z];
};

// 해·달 공식은 그날의 춘분점 기준이다. 카탈로그(J2000)와 겹쳐 그리려면 세차(1년에 50″씩 춘분점이
// 황도를 따라 도는 것)만큼 되돌린다. 황도 자체의 움직임(100년에 47″)은 무시한다.
export const ofDateToJ2000 = (v: Point3D, jd: number): Point3D => {
  const eps = obliquityDeg(jd);
  const ex = v[0];
  const ey = cosD(eps) * v[1] + sinD(eps) * v[2];
  const ez = -sinD(eps) * v[1] + cosD(eps) * v[2];
  const lambda = Math.atan2(ey, ex) / D - (1.396971 * (jd - J2000)) / 36525;
  const beta = Math.asin(Math.max(-1, Math.min(1, ez))) / D;

  return eclipticToEquatorial(lambda, beta, J2000);
};

// 해의 방향 (지구 중심)
export const sunVector = (jd: number): Point3D => {
  const n = jd - J2000;
  const L = 280.46 + 0.9856474 * n;
  const g = 357.528 + 0.9856003 * n;
  const lambda = L + 1.915 * sinD(g) + 0.02 * sinD(2 * g);

  return eclipticToEquatorial(lambda, 0, jd);
};

export interface MoonPosition {
  vector: Point3D; // 지구 중심에서 본 방향
  distanceEarthRadii: number;
}

// 달의 방향과 거리 (지구 중심). 거리는 지평 시차로 구한다.
export const moonPosition = (jd: number): MoonPosition => {
  const T = (jd - J2000) / 36525;
  const lambda =
    218.32 +
    481267.881 * T +
    6.29 * sinD(135.0 + 477198.87 * T) -
    1.27 * sinD(259.3 - 413335.36 * T) +
    0.66 * sinD(235.7 + 890534.22 * T) +
    0.21 * sinD(269.9 + 954397.74 * T) -
    0.19 * sinD(357.5 + 35999.05 * T) -
    0.11 * sinD(186.5 + 966404.03 * T);
  const beta =
    5.13 * sinD(93.3 + 483202.02 * T) +
    0.28 * sinD(228.2 + 960400.89 * T) -
    0.28 * sinD(318.3 + 6003.15 * T) -
    0.17 * sinD(217.6 - 407332.21 * T);
  const parallax =
    0.9508 +
    0.0518 * cosD(135.0 + 477198.87 * T) +
    0.0095 * cosD(259.3 - 413335.36 * T) +
    0.0078 * cosD(235.7 + 890534.22 * T) +
    0.0028 * cosD(269.9 + 954397.74 * T);

  return {
    vector: eclipticToEquatorial(lambda, beta, jd),
    distanceEarthRadii: 1 / sinD(parallax),
  };
};

// 관측지의 천정 방향 (지구 반지름 1 기준 위치이기도 하다)
export const zenithVector = (jd: number, observer: Observer): Point3D => {
  const lst = localSiderealDeg(jd, observer);

  return [
    cosD(observer.latDeg) * cosD(lst),
    cosD(observer.latDeg) * sinD(lst),
    sinD(observer.latDeg),
  ];
};

// 관측지에서 본 달의 방향. 달은 가까워서 지구 중심에서 본 방향과 최대 1°쯤 다르다(시차).
export const moonVectorFrom = (jd: number, observer: Observer): Point3D => {
  const { vector, distanceEarthRadii } = moonPosition(jd);
  const o = zenithVector(jd, observer);
  const p = vector.map((c, i) => c * distanceEarthRadii - o[i]);
  const n = Math.hypot(p[0], p[1], p[2]);

  return [p[0] / n, p[1] / n, p[2] / n];
};

export interface AltAz {
  altDeg: number;
  azDeg: number; // 북 0°, 동 90°
}

export const altAzOf = (v: Point3D, jd: number, observer: Observer): AltAz => {
  const up = zenithVector(jd, observer);
  const lst = localSiderealDeg(jd, observer);
  const east: Point3D = [-sinD(lst), cosD(lst), 0];
  const north: Point3D = [
    up[1] * east[2] - up[2] * east[1],
    up[2] * east[0] - up[0] * east[2],
    up[0] * east[1] - up[1] * east[0],
  ];
  const dot = (a: Point3D) => a[0] * v[0] + a[1] * v[1] + a[2] * v[2];

  return {
    altDeg: Math.asin(Math.max(-1, Math.min(1, dot(up)))) / D,
    azDeg: (Math.atan2(dot(east), dot(north)) / D + 360) % 360,
  };
};

export interface HorizontalFrame {
  zenith: Point3D;
  east: Point3D;
  north: Point3D;
}

// 그 시각·장소의 수평 좌표계를 카탈로그와 같은 J2000 적도좌표로 (천정·동·북 단위 벡터)
export const horizontalFrameJ2000 = (
  jd: number,
  observer: Observer,
): HorizontalFrame => {
  const z = ofDateToJ2000(zenithVector(jd, observer), jd);
  const zn = Math.hypot(z[0], z[1], z[2]);
  const zenith: Point3D = [z[0] / zn, z[1] / zn, z[2] / zn];
  const en = Math.hypot(zenith[0], zenith[1]);
  const east: Point3D = [-zenith[1] / en, zenith[0] / en, 0];
  const north: Point3D = [
    zenith[1] * east[2] - zenith[2] * east[1],
    zenith[2] * east[0] - zenith[0] * east[2],
    zenith[0] * east[1] - zenith[1] * east[0],
  ];

  return { zenith, east, north };
};

// 수평 좌표계에서 고도·방위(°)의 방향 (J2000)
export const fromAltAzJ2000 = (
  frame: HorizontalFrame,
  altDeg: number,
  azDeg: number,
): Point3D => {
  const alt = altDeg * D;
  const az = azDeg * D;

  return [0, 1, 2].map(
    (i) =>
      Math.cos(alt) *
        (Math.cos(az) * frame.north[i] + Math.sin(az) * frame.east[i]) +
      Math.sin(alt) * frame.zenith[i],
  ) as Point3D;
};
