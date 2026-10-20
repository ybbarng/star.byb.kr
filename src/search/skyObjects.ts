import type { Point3D } from "@/scripts/hash/types";
import type { Observer } from "@/search/utils/ephemeris";
import type { PlanetName } from "@/search/utils/planets";
import {
  julianDay,
  moonPosition,
  moonVectorFrom,
  ofDateToJ2000,
  sunVector,
} from "@/search/utils/ephemeris";
import { planetPosition } from "@/search/utils/planets";

// 별 말고 사진에 이름을 붙일 천체: 일반 카메라에도 찍히는 유명한 딥스카이(위치 고정)와
// 촬영 시각을 알 때만 위치가 정해지는 해·달·행성. 모두 J2000 적도좌표 단위 벡터.

export type SkyObjectKind = "sun" | "moon" | "planet" | "deepSky";

export interface SkyObject {
  name: string;
  kind: SkyObjectKind;
  vector: Point3D;
  radiusDeg: number; // 겉보기 반지름 (딥스카이는 대략의 크기)
}

const D = Math.PI / 180;

const fromRaDec = (raDeg: number, decDeg: number): Point3D => [
  Math.cos(decDeg * D) * Math.cos(raDeg * D),
  Math.cos(decDeg * D) * Math.sin(raDeg * D),
  Math.sin(decDeg * D),
];

// [이름, 적경(°), 적위(°), 긴 쪽 크기(분각)] — 맨눈이나 휴대폰·DSLR 장노출로 보이는 것만
const DEEP_SKY: [string, number, number, number][] = [
  ["안드로메다 은하 M31", 10.685, 41.269, 190],
  ["삼각형자리 은하 M33", 23.462, 30.66, 70],
  ["플레이아데스 성단 M45", 56.75, 24.117, 110],
  ["히아데스 성단", 66.75, 15.87, 330],
  ["오리온 대성운 M42", 83.822, -5.391, 85],
  ["벌집 성단 M44", 130.1, 19.67, 95],
  ["헤라클레스 구상성단 M13", 250.423, 36.46, 20],
  ["석호 성운 M8", 270.904, -24.384, 90],
  ["프톨레마이오스 성단 M7", 268.463, -34.793, 80],
  ["북아메리카 성운", 314.75, 44.33, 120],
  ["페르세우스 이중성단", 35.0, 57.13, 60],
  ["용골자리 성운", 161.265, -59.868, 120],
  ["오메가 센타우리", 201.697, -47.48, 36],
  ["큰부리새자리 47", 6.024, -72.081, 31],
  ["대마젤란은하", 80.894, -69.756, 650],
  ["소마젤란은하", 13.187, -72.829, 320],
];

export const DEEP_SKY_OBJECTS: SkyObject[] = DEEP_SKY.map(
  ([name, ra, dec, sizeArcmin]) => ({
    name,
    kind: "deepSky",
    vector: fromRaDec(ra, dec),
    radiusDeg: sizeArcmin / 120,
  }),
);

// 맨눈으로 보이는 행성만 (천왕성·해왕성은 일반 사진에서 별과 구분하기 어렵다)
const PLANETS: [PlanetName, string][] = [
  ["Mercury", "수성"],
  ["Venus", "금성"],
  ["Mars", "화성"],
  ["Jupiter", "목성"],
  ["Saturn", "토성"],
];

const MOON_RADIUS_KM = 1737.4;
const EARTH_RADIUS_KM = 6378.14;

// 그 시각의 해·달·행성. 관측지를 알면 달은 관측지에서 본 방향(최대 1° 차이)으로 쓴다.
export const solarSystemObjects = (
  date: Date,
  observer?: Observer,
): SkyObject[] => {
  const jd = julianDay(date);
  const moon = moonPosition(jd);
  const moonRadiusDeg =
    Math.asin(MOON_RADIUS_KM / (moon.distanceEarthRadii * EARTH_RADIUS_KM)) / D;

  return [
    {
      name: "해",
      kind: "sun",
      vector: ofDateToJ2000(sunVector(jd), jd),
      radiusDeg: 0.267,
    },
    {
      name: "달",
      kind: "moon",
      vector: ofDateToJ2000(
        observer ? moonVectorFrom(jd, observer) : moon.vector,
        jd,
      ),
      radiusDeg: moonRadiusDeg,
    },
    ...PLANETS.map(
      ([key, name]): SkyObject => ({
        name,
        kind: "planet",
        vector: planetPosition(key, jd).vector,
        radiusDeg: 0,
      }),
    ),
  ];
};
