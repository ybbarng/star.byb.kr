import {
  altAzOf,
  gmstDeg,
  julianDay,
  sunVector,
} from "@/search/utils/ephemeris";

// 해 그림자 계산 (그림자 시계·에라토스테네스 공용, docs/game-plans.md).
// 땅에 수직으로 세운 길이 1의 막대가 드리우는 그림자를 실제 해 위치(ephemeris.ts)로 구한다.
// 시각은 "해시계 시각"(지방 시태양시)으로 다룬다: 해가 가장 높이 뜨는 때(남중)가 12시다.
// 시간대·균시차와 상관없이 그림자만으로 읽을 수 있는 시각이 이것이다.

const D = Math.PI / 180;
export const YEAR = 2026;
const DAY_MS = 86400000;

// 그 해 day번째 날(0 = 1월 1일)의 UTC 시각
export const dayDate = (day: number, utcHours = 12) =>
  new Date(Date.UTC(YEAR, 0, 1) + day * DAY_MS + utcHours * 3600000);

export const dayLabel = (day: number) => {
  const d = dayDate(day);

  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
};

// 월·일 → 그 해 몇 번째 날
export const dayOf = (month: number, date: number) =>
  Math.round((Date.UTC(YEAR, month - 1, date) - Date.UTC(YEAR, 0, 1)) / DAY_MS);

// 해시계 시각(시, 소수) → "9:20"
export const solarClock = (hours: number) => {
  const m = Math.round(hours * 60);

  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
};

const wrap180 = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

// 해의 적위(°): 해가 천구의 적도에서 북(+)·남(−)으로 떨어진 각. 하지 +23.4°, 동지 −23.4°
export const sunDeclinationDeg = (date: Date) => {
  const s = sunVector(julianDay(date));

  return Math.asin(Math.max(-1, Math.min(1, s[2]))) / D;
};

// 경도 lonDeg에서 그 날 해시계 시각이 solarHours인 순간 (해의 시간각을 맞춰 세 번 고친다)
export const solarMoment = (
  day: number,
  lonDeg: number,
  solarHours: number,
) => {
  let t = dayDate(day, solarHours - lonDeg / 15).getTime();

  for (let i = 0; i < 3; i++) {
    const jd = julianDay(new Date(t));
    const s = sunVector(jd);
    const ra = Math.atan2(s[1], s[0]) / D;
    const hourAngle = wrap180(gmstDeg(jd) + lonDeg - ra);
    t +=
      ((wrap180((solarHours - 12) * 15 - hourAngle) / 15) * 3600000) / 1.0027;
  }

  return new Date(t);
};

export interface SunPlace {
  altDeg: number; // 해 높이
  azDeg: number; // 해 방위 (북 0°, 동 90°)
}

// 위도 latDeg, day번째 날, 해시계 시각 solarHours의 해 위치. 경도는 해시계 시각에 들어 있어 0으로 둔다
export const sunAt = (
  latDeg: number,
  day: number,
  solarHours: number,
): SunPlace => {
  const date = solarMoment(day, 0, solarHours);
  const jd = julianDay(date);

  return altAzOf(sunVector(jd), jd, { latDeg, lonDeg: 0 });
};

export interface Shadow {
  length: number; // 막대 길이의 몇 배
  azDeg: number; // 그림자가 가리키는 방위 (해의 반대쪽)
  x: number; // 그림자 끝, 동쪽 +
  y: number; // 그림자 끝, 북쪽 +
}

// 해 높이·방위 → 길이 1 막대의 그림자. 해가 지평선 아래면 null
export const shadowOf = (sun: SunPlace): Shadow | null => {
  if (sun.altDeg <= 0) {
    return null;
  }

  const length = 1 / Math.tan(sun.altDeg * D);
  const azDeg = (sun.azDeg + 180) % 360;

  return {
    length,
    azDeg,
    x: length * Math.sin(azDeg * D),
    y: length * Math.cos(azDeg * D),
  };
};

// 그림자 길이 → 해 높이 (풀이 설명의 첫 걸음: 높이 1 ÷ 길이 L의 각)
export const altitudeFromShadow = (length: number) => Math.atan2(1, length) / D;

// 정오(해시계 12시)의 해 높이 = 90° − |위도 − 적위|
export const noonAltitudeDeg = (latDeg: number, decDeg: number) =>
  90 - Math.abs(latDeg - decDeg);

// 해돋이·해넘이의 해시계 시각과 낮 길이 (해 중심이 지평선에 닿는 때, 대기 굴절은 뺀다).
// 백야면 낮 24시간, 극야면 0시간
export const dayLight = (latDeg: number, decDeg: number) => {
  const c = -Math.tan(latDeg * D) * Math.tan(decDeg * D);

  if (c <= -1) {
    return { sunrise: 0, sunset: 24, hours: 24 };
  }

  if (c >= 1) {
    return { sunrise: 12, sunset: 12, hours: 0 };
  }

  const h = Math.acos(c) / D / 15;

  return { sunrise: 12 - h, sunset: 12 + h, hours: 2 * h };
};

export interface CurvePoint {
  hours: number;
  sun: SunPlace;
  shadow: Shadow;
}

// 하루 동안 그림자 끝이 그리는 곡선 (stepHours 간격, 해가 minAltDeg보다 높을 때만)
export const shadowCurve = (
  latDeg: number,
  day: number,
  stepHours = 1 / 6,
  minAltDeg = 3,
): CurvePoint[] => {
  const points: CurvePoint[] = [];

  for (let h = 0; h <= 24 + 1e-9; h += stepHours) {
    const sun = sunAt(latDeg, day, h);
    const shadow = sun.altDeg > minAltDeg ? shadowOf(sun) : null;

    if (shadow) {
      points.push({ hours: h, sun, shadow });
    }
  }

  return points;
};

// 적위가 같은 다른 날 (봄·가을처럼 그림자로는 가를 수 없는 짝). 하지·동지 근처면 null
export const twinDay = (day: number) => {
  const dec = sunDeclinationDeg(dayDate(day));
  let best: { day: number; err: number } | null = null;

  for (let d = 0; d < 365; d++) {
    const gap = Math.min(Math.abs(d - day), 365 - Math.abs(d - day));

    if (gap < 20) {
      continue;
    }

    const err = Math.abs(sunDeclinationDeg(dayDate(d)) - dec);

    if (!best || err < best.err) {
      best = { day: d, err };
    }
  }

  return best && best.err < 0.4 ? best.day : null;
};
