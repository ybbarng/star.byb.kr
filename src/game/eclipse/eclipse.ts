import type { Point3D } from "@/scripts/hash/types";
import type { Observer } from "@/search/utils/ephemeris";
import {
  altAzOf,
  gmstDeg,
  julianDay,
  moonPosition,
  moonVectorFrom,
  sunVector,
} from "@/search/utils/ephemeris";

// 식 예측하기 (src/game/eclipse): 식이 일어나는 두 조건을 우리 계산(ephemeris.ts)으로 본다.
// ① 삭(해와 달의 황경이 같다) 또는 망(180° 차이) ② 그때 달이 황도에서 멀지 않다(황위가 작다 = 교점 근처).
// 달 위치 오차가 0.3~0.5°라 황위가 경계(1~1.6°) 근처인 식은 우리 계산으로 가를 수 없다.
// 그래서 정답은 NASA 목록(eclipseList.ts)이고, 여기 계산은 그 목록을 확인하고 그래프를 그리는 데만 쓴다.

const D = Math.PI / 180;
const DAY_MS = 86400000;
const OBLIQUITY = 23.439;

export const SEOUL: Observer = { latDeg: 37.57, lonDeg: 126.98 };

const wrap360 = (deg: number) => ((deg % 360) + 360) % 360;
const wrap180 = (deg: number) => wrap360(deg + 180) - 180;

// 그날 춘분점 기준 적도 벡터 → 황경·황위(°)
export const eclipticOf = (v: Point3D) => {
  const ey = Math.cos(OBLIQUITY * D) * v[1] + Math.sin(OBLIQUITY * D) * v[2];
  const ez = -Math.sin(OBLIQUITY * D) * v[1] + Math.cos(OBLIQUITY * D) * v[2];

  return {
    lonDeg: wrap360(Math.atan2(ey, v[0]) / D),
    latDeg: Math.asin(Math.max(-1, Math.min(1, ez))) / D,
  };
};

export const sunLonDeg = (jd: number) => eclipticOf(sunVector(jd)).lonDeg;

export const moonEcliptic = (jd: number) => eclipticOf(moonPosition(jd).vector);

// 해에서 달까지 황경 차 (0 삭, 180 망)
export const elongationDeg = (jd: number) =>
  wrap360(moonEcliptic(jd).lonDeg - sunLonDeg(jd));

// 달이 빛나는 비율 (지구 중심에서 본 어림)
export const litFraction = (jd: number) =>
  (1 - Math.cos(elongationDeg(jd) * D)) / 2;

// 달 궤도의 평균 승교점 황경 (천문연감 공식). 실제 교점은 이것과 최대 1.7°쯤 다르다
export const meanNodeDeg = (jd: number) =>
  wrap360(125.04452 - (1934.136261 * (jd - 2451545)) / 36525);

// 해에서 가까운 교점(두 교점 중)까지 황경 차 (°)
export const sunNodeGapDeg = (jd: number) =>
  Math.abs(wrap180(2 * (sunLonDeg(jd) - meanNodeDeg(jd))) / 2);

export type SyzygyKind = "new" | "full";

export interface Syzygy {
  kind: SyzygyKind; // new 삭, full 망
  jd: number;
  day: number; // 그해 몇 번째 날 (0 = 1월 1일, 세계시)
  moonLatDeg: number; // 그 순간 달의 황위
  date: string; // YYYY-MM-DD (세계시)
}

export const yearStartJd = (year: number) =>
  julianDay(new Date(Date.UTC(year, 0, 1)));

export const daysInYear = (year: number) =>
  (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY_MS;

export const jdToDate = (jd: number) => new Date((jd - 2440587.5) * DAY_MS);

export const isoDateOfJd = (jd: number) =>
  jdToDate(jd).toISOString().slice(0, 10);

// "YYYY-MM-DD" → 그해 몇 번째 날 (0부터)
export const dayOfIso = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);

  return (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / DAY_MS;
};

// 그해 몇 번째 날 → "M월 D일"
export const dayLabel = (year: number, day: number) => {
  const t = new Date(Date.UTC(year, 0, 1) + Math.round(day) * DAY_MS);

  return `${t.getUTCMonth() + 1}월 ${t.getUTCDate()}일`;
};

export const isoLabel = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);

  return `${y}년 ${m}월 ${d}일`;
};

// 그해의 삭·망: 반나절 간격으로 황경 차가 목표를 넘는 곳을 찾고 반씩 좁힌다 (1분 안쪽)
export const findSyzygies = (year: number): Syzygy[] => {
  const start = yearStartJd(year);
  const end = start + daysInYear(year);
  const out: Syzygy[] = [];
  const kinds: { kind: SyzygyKind; target: number }[] = [
    { kind: "new", target: 0 },
    { kind: "full", target: 180 },
  ];

  for (const { kind, target } of kinds) {
    const f = (jd: number) => wrap180(elongationDeg(jd) - target);
    let a = start;
    let fa = f(a);

    while (a < end) {
      const b = a + 0.5;
      const fb = f(b);

      // 아래에서 위로 0을 지나는 곳 (반대편 ±180 건너뜀은 버린다)
      if (fa < 0 && fb >= 0 && fb - fa < 90) {
        let lo = a;
        let hi = b;

        for (let i = 0; i < 20; i++) {
          const mid = (lo + hi) / 2;

          if (f(mid) < 0) {
            lo = mid;
          } else {
            hi = mid;
          }
        }

        const jd = (lo + hi) / 2;

        if (jd >= start && jd < end) {
          out.push({
            kind,
            jd,
            day: Math.floor(jd - start),
            moonLatDeg: moonEcliptic(jd).latDeg,
            date: isoDateOfJd(jd),
          });
        }
      }

      a = b;
      fa = fb;
    }
  }

  return out.sort((x, y) => x.jd - y.jd);
};

// ---------- 식이 날 수 있는 황위 (지구 중심 어림) ----------

// 일식: 달 시차 − 해 시차 + 해 반지름 + 달 반지름. 달이 가깝고 멀 때 1.41°~1.58°
// 월식(반영식 포함): 반영 반지름 + 달 반지름 1.43°~1.60°, 본영식(부분·개기): 0.88°~1.06°
export const LIMITS = {
  solarSure: 1.41,
  solarMax: 1.58,
  penumbralSure: 1.43,
  penumbralMax: 1.6,
  umbralSure: 0.88,
  umbralMax: 1.06,
};

// 화면에 보이는 대략의 규칙 (입문 띠)
export const RULE = { sure: 1.0, maybe: 1.6 };

export type Chance = "sure" | "maybe" | "none";

export const chanceOf = (moonLatDeg: number): Chance => {
  const b = Math.abs(moonLatDeg);

  return b < RULE.sure ? "sure" : b < RULE.maybe ? "maybe" : "none";
};

// ---------- 그해 그래프 재료 ----------

export interface DaySample {
  day: number;
  moonLatDeg: number;
  lit: number;
}

export interface EclipseSeason {
  startDay: number;
  endDay: number;
}

export interface YearSky {
  year: number;
  days: number;
  samples: DaySample[]; // 하루에 네 번
  syzygies: Syzygy[];
  seasons: EclipseSeason[]; // 해가 교점에서 18.5° 안에 있는 기간 (식 철)
}

export const SEASON_HALF_WIDTH_DEG = 18.5;

export const yearSky = (year: number): YearSky => {
  const start = yearStartJd(year);
  const days = daysInYear(year);
  const samples: DaySample[] = [];

  for (let q = 0; q <= days * 4; q++) {
    const jd = start + q / 4;
    const elong = elongationDeg(jd);
    samples.push({
      day: q / 4,
      moonLatDeg: moonEcliptic(jd).latDeg,
      lit: (1 - Math.cos(elong * D)) / 2,
    });
  }

  const seasons: EclipseSeason[] = [];
  let open: number | null = null;

  for (let d = 0; d <= days; d++) {
    const jd = start + d;
    const inside = sunNodeGapDeg(jd) < SEASON_HALF_WIDTH_DEG;

    if (inside && open === null) {
      open = d;
    } else if (!inside && open !== null) {
      seasons.push({ startDay: open, endDay: d - 1 });
      open = null;
    }
  }

  if (open !== null) {
    seasons.push({ startDay: open, endDay: days });
  }

  return { year, days, samples, syzygies: findSyzygies(year), seasons };
};

// ---------- 어디서 보이나 ----------

// 월식은 그 순간 달이 떠 있는 곳 어디서나 보인다: 서울에서 달 높이(°)
export const moonAltFromSeoul = (jd: number) =>
  altAzOf(moonVectorFrom(jd, SEOUL), jd, SEOUL).altDeg;

// 달이 머리 위에 있는 곳의 경도 (그 반구의 밤 쪽에서 월식이 보인다)
export const subLunarLonDeg = (jd: number) => {
  const v = moonPosition(jd).vector;
  const ra = Math.atan2(v[1], v[0]) / D;

  return wrap180(ra - gmstDeg(jd));
};

export const regionOfLon = (lonDeg: number) =>
  lonDeg >= 60 && lonDeg < 150
    ? "아시아·호주"
    : lonDeg >= 150 || lonDeg < -120
      ? "태평양 둘레"
      : lonDeg >= -120 && lonDeg < -30
        ? "아메리카"
        : "유럽·아프리카";

// 서울에서 본 해와 달의 거리(°)가 가장 작은 때 (삭 앞뒤 4시간, 5분 간격). 일식이 한국에서 보이는지 확인용
export const closestFromSeoul = (jd: number) => {
  let best = { sepDeg: 180, jd, sunAltDeg: 0 };

  for (let k = -48; k <= 48; k++) {
    const t = jd + (k * 5) / 1440;
    const s = sunVector(t);
    const m = moonVectorFrom(t, SEOUL);
    const sep =
      Math.acos(
        Math.max(-1, Math.min(1, s[0] * m[0] + s[1] * m[1] + s[2] * m[2])),
      ) / D;

    if (sep < best.sepDeg) {
      best = { sepDeg: sep, jd: t, sunAltDeg: altAzOf(s, t, SEOUL).altDeg };
    }
  }

  return best;
};
