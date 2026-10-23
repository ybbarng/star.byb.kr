import { dayDate, sunDeclinationDeg } from "@/game/shadow/shadow";

// 에라토스테네스 되어 보기 (docs/game-plans.md): 같은 날 정오, 남북으로 떨어진 두 도시에서 막대 그림자 각도를 재고
// 각도 차이 : 360° = 두 도시 사이 남북 거리 : 지구 둘레 로 둘레를 구한다.
// 정오 그림자 각(막대와 햇빛 사이) = 위도 − 해의 적위. 날짜를 바꾸면 적위만 바뀌어 두 각이 똑같이 움직이고
// 차이(= 위도 차이)는 그대로다.

export interface City {
  name: string;
  latDeg: number;
  lonDeg: number;
}

export interface CityPair {
  id: string;
  title: string;
  a: City; // 북쪽 도시
  b: City;
  note?: string;
}

export const CITY_PAIRS: CityPair[] = [
  {
    id: "egypt",
    title: "알렉산드리아 · 시에네",
    a: { name: "알렉산드리아", latDeg: 31.2, lonDeg: 29.92 },
    b: { name: "시에네(아스완)", latDeg: 24.09, lonDeg: 32.9 },
    note: "에라토스테네스가 쓴 두 도시예요. 그는 같은 경도라고 여겼지만 실제로는 3°쯤 어긋나요.",
  },
  {
    id: "korea",
    title: "서울 · 제주",
    a: { name: "서울", latDeg: 37.57, lonDeg: 126.98 },
    b: { name: "제주", latDeg: 33.5, lonDeg: 126.53 },
  },
  {
    id: "europe",
    title: "파리 · 바르셀로나",
    a: { name: "파리", latDeg: 48.86, lonDeg: 2.35 },
    b: { name: "바르셀로나", latDeg: 41.39, lonDeg: 2.17 },
  },
  {
    id: "north",
    title: "헬싱키 · 아테네",
    a: { name: "헬싱키", latDeg: 60.17, lonDeg: 24.94 },
    b: { name: "아테네", latDeg: 37.98, lonDeg: 23.73 },
  },
  {
    id: "equator",
    title: "서울 · 다윈",
    a: { name: "서울", latDeg: 37.57, lonDeg: 126.98 },
    b: { name: "다윈(호주)", latDeg: -12.46, lonDeg: 130.84 },
    note: "적도를 사이에 두면 그림자가 서로 반대쪽을 가리킬 수 있어요.",
  },
];

// 지구 둘레: 남북으로(자오선을 따라) 한 바퀴
export const EARTH_MERIDIAN_KM = 40008;
export const KM_PER_DEG = EARTH_MERIDIAN_KM / 360;

// 두 도시 사이 남북 거리 (실제 지도에서 잰 값과 같다)
export const northSouthKm = (a: City, b: City) =>
  Math.abs(a.latDeg - b.latDeg) * KM_PER_DEG;

// 정오 그림자 각: 막대와 햇빛 사이의 각. + 면 그림자가 북쪽을, − 면 남쪽을 가리킨다
export const noonShadowAngleDeg = (city: City, day: number) =>
  city.latDeg - sunDeclinationDeg(dayDate(day, 12 - city.lonDeg / 15));

// 각도 차이와 거리로 지구 둘레
export const circumferenceKm = (angleDiffDeg: number, distanceKm: number) =>
  angleDiffDeg > 0 ? (distanceKm * 360) / angleDiffDeg : Infinity;

export const lonGapDeg = (pair: { a: City; b: City }) =>
  Math.abs(((((pair.a.lonDeg - pair.b.lonDeg) % 360) + 540) % 360) - 180);

export const cityLabel = (c: City) =>
  `${c.latDeg >= 0 ? "북위" : "남위"} ${Math.abs(c.latDeg).toFixed(1)}°`;
