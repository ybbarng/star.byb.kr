import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Observer } from "@/search/utils/ephemeris";
import type { CatalogStar } from "@/test/synthetic/loadCatalog";
import { horizonCameraTP } from "@/search/horizonSolve";
import {
  altAzOf,
  julianDay,
  ofDateToJ2000,
  sunVector,
} from "@/search/utils/ephemeris";
import { recoverCenter } from "@/search/utils/wcs";
import { gaussian } from "@/test/synthetic/rng";

// 지평선이 보이고 밝은 별이 10개 안팎인 사진(사이판 같은 휴대폰 사진)을 정답과 함께 만든다.
// 시각 제약 풀이(horizonSolve)가 사진 한 장에 맞춰진 게 아니라 비슷한 사진에서 두루 되는지 잰다.
// 실제 사진에서 본 어려움을 넣는다: 구름에 가린 별, 거짓 점(불빛·구름 가장자리), 실제보다 1° 안팎
// 높거나 기운 지평선(먼 섬·산), 실제 촬영보다 늦은 "올린 시각".

export interface HorizonScene {
  photoStars: Point2D[]; // 밝기 순 (거짓 점 섞임)
  width: number;
  height: number;
  horizon: [Point2D, Point2D];
  observer: Observer;
  shotAt: Date; // 실제 촬영 시각
  postedAt: Date; // 알려 준 시각 (촬영보다 0~150분 늦다)
  center: Point3D; // 정답 광축
  trueStars: number;
}

const D = Math.PI / 180;

export const makeHorizonScene = (
  catalog: CatalogStar[],
  rng: () => number,
): HorizonScene => {
  const portrait = rng() < 0.5;
  const width = portrait ? 1440 : 1920;
  const height = portrait ? 1920 : 1440;

  // 해가 18° 아래인 밤 시각·장소를 고른다
  let shotAt: Date;
  let observer: Observer;

  for (;;) {
    shotAt = new Date(Date.UTC(2019, 0, 1) + rng() * 5 * 365 * 86400000);
    observer = { latDeg: -40 + rng() * 90, lonDeg: -180 + rng() * 360 };
    const jd = julianDay(shotAt);

    if (altAzOf(sunVector(jd), jd, observer).altDeg < -18) {
      break;
    }
  }

  const fovDeg = 35 + rng() * 40;
  // 지평선이 사진 아래쪽 1/5~2/5 높이에 오도록 광축을 든다
  const view = {
    azimuthDeg: rng() * 360,
    altitudeDeg: fovDeg * (0.15 + rng() * 0.25),
    rollDeg: (rng() - 0.5) * 6,
    fovDeg,
  };
  const TP = horizonCameraTP(shotAt, observer, view, width, height);

  const project = (v: Point3D): Point2D | null => {
    const z = TP[2][0] * v[0] + TP[2][1] * v[1] + TP[2][2] * v[2];

    return z > 0
      ? [
          (TP[0][0] * v[0] + TP[0][1] * v[1] + TP[0][2] * v[2]) / z,
          (TP[1][0] * v[0] + TP[1][1] * v[1] + TP[1][2] * v[2]) / z,
        ]
      : null;
  };

  const jd = julianDay(shotAt);
  const inside = (p: Point2D | null): p is Point2D =>
    p !== null && p[0] >= 0 && p[0] < width && p[1] >= 0 && p[1] < height;

  // 휴대폰에 찍히는 밝기까지(2.5~3.3등급), 지평선 위 1° 이상, 구름에 20%가 가린다
  const magLimit = 2.5 + rng() * 0.8;
  const stars: { p: Point2D; brightness: number }[] = [];

  for (const s of catalog) {
    if (s.v > magLimit || rng() < 0.2) {
      continue;
    }

    // 지평선 근처는 대기에 묻혀 안 보인다
    const v = s.vector;
    const altDeg = altAzOf(toOfDate(v, jd), jd, observer).altDeg;

    if (altDeg < 1) {
      continue;
    }

    const p = project(v);

    if (inside(p)) {
      stars.push({
        p: [p[0] + gaussian(rng) * 1.5, p[1] + gaussian(rng) * 1.5],
        brightness: 10 - s.v + gaussian(rng) * 0.3,
      });
    }
  }

  const trueStars = stars.length;

  // 사진 속 지평선: 고도 0° 방향 두 개를 투영하고, 먼 섬·산처럼 ±1° 안팎 높이·기울기 오차를 준다
  const horizonAt = (dAz: number): Point2D => {
    const azr = (view.azimuthDeg + dAz) * D;
    const lift = (rng() - 0.3) * 1.5 * D;

    return project(fromAltAz(jd, observer, lift, azr)) as Point2D;
  };

  const horizon: [Point2D, Point2D] = [
    horizonAt(-fovDeg / 4),
    horizonAt(fovDeg / 4),
  ];

  // 거짓 점: 불빛·구름 가장자리 (하늘 쪽 아무 데나, 밝기도 별과 섞인다)
  const falseCount = 3 + Math.floor(rng() * 5);

  for (let i = 0; i < falseCount; i++) {
    const t = rng();
    const base: Point2D = [
      horizon[0][0] + (horizon[1][0] - horizon[0][0]) * t,
      horizon[0][1] + (horizon[1][1] - horizon[0][1]) * t,
    ];
    stars.push({
      p: [rng() * width, base[1] - rng() * base[1]],
      brightness: 10 - (1 + rng() * 2.5),
    });
  }

  stars.sort((a, b) => b.brightness - a.brightness);

  return {
    photoStars: stars.map((s) => s.p),
    width,
    height,
    horizon,
    observer,
    shotAt,
    postedAt: new Date(shotAt.getTime() + rng() * 150 * 60000),
    center: recoverCenter(TP, width, height),
    trueStars,
  };
};

// J2000 방향을 그날 춘분점 기준으로 (고도 계산용; 세차 0.3° 수준이라 근사로 충분)
const toOfDate = (v: Point3D, jd: number): Point3D => {
  const back = ofDateToJ2000(v, jd);

  return [2 * v[0] - back[0], 2 * v[1] - back[1], 2 * v[2] - back[2]];
};

// 그 시각·장소의 고도·방위(라디안) → J2000 방향
const fromAltAz = (
  jd: number,
  observer: Observer,
  alt: number,
  az: number,
): Point3D => {
  const lst =
    (280.46061837 + 360.98564736629 * (jd - 2451545) + observer.lonDeg) * D;
  const lat = observer.latDeg * D;
  const Z: Point3D = [
    Math.cos(lat) * Math.cos(lst),
    Math.cos(lat) * Math.sin(lst),
    Math.sin(lat),
  ];
  const E: Point3D = [-Math.sin(lst), Math.cos(lst), 0];
  const N: Point3D = [
    Z[1] * E[2] - Z[2] * E[1],
    Z[2] * E[0] - Z[0] * E[2],
    Z[0] * E[1] - Z[1] * E[0],
  ];
  const v: Point3D = [0, 1, 2].map(
    (i) =>
      Math.cos(alt) * (Math.cos(az) * N[i] + Math.sin(az) * E[i]) +
      Math.sin(alt) * Z[i],
  ) as Point3D;

  return ofDateToJ2000(v, jd);
};
