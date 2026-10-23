import type { CountStar } from "@/learn/basics/skyMath";
import { STARS } from "@/game/sky/catalog";
import {
  eveningRegionStars,
  galacticLongitudeHistogram,
  maxAltitudeDeg,
  mergeCloseStars,
  monthlyEveningCounts,
  seasonAverages,
  SEASONS,
  SEOUL,
  vectorToRaDec,
} from "@/learn/basics/skyMath";

// 「겨울 별은 정말 더 밝을까?」에 보여 줄 숫자. 모두 별 지도(BSC5, 5등급까지)로 센다.

// BSC5에 폭발했을 때의 밝기(2.0등급)로 실린 재발 신성 북쪽왕관자리 T(HR 5958). 평소에는 10등급 남짓이라
// 맨눈에 보이지 않으니 센 수에서 뺀다
export const EXCLUDED_HR = ["5958"];

export const COUNT_STARS: (CountStar & { name?: string })[] = STARS.filter(
  (s) => !EXCLUDED_HR.includes(s.hr),
).map((s) => ({ vector: s.vector, mag: s.mag, hr: s.hr, name: s.name }));

export const MAG_LIMITS = [1.5, 2.0];
export const EVENING_HOUR = 21;
export const MIN_ALT_DEG = 10;

const BASE = {
  observer: SEOUL,
  year: 2026,
  utcOffsetHours: 9,
  localHour: EVENING_HOUR,
};

// ① 달마다 15일 저녁 9시, 고도 10° 위에 떠 있는 밝은 별 수
export const MONTHLY = monthlyEveningCounts(COUNT_STARS, {
  ...BASE,
  magLimits: MAG_LIMITS,
  minAltDeg: MIN_ALT_DEG,
});

export const SEASON_AVERAGES = seasonAverages(MONTHLY);

// ② 계절 가운데 달(1·4·7·10월) 저녁 9시에 자오선 ±3시간 안 (그 계절의 별자리 자리)
export const REGION_MONTHS = [
  { season: "겨울", month: 1 },
  { season: "봄", month: 4 },
  { season: "여름", month: 7 },
  { season: "가을", month: 10 },
];

export const REGIONS = REGION_MONTHS.map((r) => ({
  ...r,
  stars: MAG_LIMITS.map(
    (magLimit) =>
      eveningRegionStars(COUNT_STARS, {
        ...BASE,
        month: r.month,
        magLimit,
        halfWidthHours: 3,
        minMaxAltDeg: MIN_ALT_DEG,
      }) as (CountStar & { name?: string })[],
  ),
}));

// 서울에서 고도 10° 넘게 뜰 수 있는 1.5등급보다 밝은 별과, 그중 오리온자리 둘레(적경 4.5h~8h)에 있는 별
export const VISIBLE = mergeCloseStars(COUNT_STARS).filter((s) => {
  const { decDeg } = vectorToRaDec(s.vector);

  return (
    s.mag <= MAG_LIMITS[0] &&
    maxAltitudeDeg(SEOUL.latDeg, decDeg) >= MIN_ALT_DEG
  );
}) as (CountStar & { name?: string })[];

export const HEXAGON = VISIBLE.filter((s) => {
  const h = vectorToRaDec(s.vector).raDeg / 15;

  return h >= 4.5 && h <= 8;
});

// ③ 뜨거운 젊은 별(표면 1만 K 이상, 3등급까지)이 은하 경도 어디에 몰려 있나 (온 하늘)
export const HOT_MIN_KELVIN = 10000;
export const HOT_MAG_LIMIT = 3;

export const HOT_HISTOGRAM = galacticLongitudeHistogram(
  mergeCloseStars(
    STARS.filter(
      (s) =>
        !EXCLUDED_HR.includes(s.hr) &&
        s.mag <= HOT_MAG_LIMIT &&
        s.kelvin >= HOT_MIN_KELVIN,
    ).map((s) => ({ vector: s.vector, mag: s.mag })),
  ),
);

export const ALL_HISTOGRAM = galacticLongitudeHistogram(
  mergeCloseStars(
    STARS.filter(
      (s) => !EXCLUDED_HR.includes(s.hr) && s.mag <= HOT_MAG_LIMIT,
    ).map((s) => ({ vector: s.vector, mag: s.mag })),
  ),
);

export { SEASONS };
