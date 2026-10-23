import type { Point3D } from "@/scripts/hash/types";
import type { Observer } from "@/search/utils/ephemeris";
import {
  gmstDeg,
  horizontalFrameJ2000,
  julianDay,
  sunVector,
} from "@/search/utils/ephemeris";

// "하늘 읽기 기초" 페이지들이 보여 주는 숫자를 계산하는 순수 함수 모음.
// 화면은 이 값을 그대로 보여 주고, 단위 테스트(src/test/unit/skyBasics.test.ts)가 값을 확인한다.
// 좌표는 카탈로그와 같은 J2000 적도좌표 단위 벡터 (x: 춘분점, z: 천구 북극).

const D = Math.PI / 180;

export const SEOUL: Observer & { name: string } = {
  name: "서울",
  latDeg: 37.57,
  lonDeg: 126.98,
};

export const raDecToVector = (raDeg: number, decDeg: number): Point3D => [
  Math.cos(decDeg * D) * Math.cos(raDeg * D),
  Math.cos(decDeg * D) * Math.sin(raDeg * D),
  Math.sin(decDeg * D),
];

export const vectorToRaDec = (v: Point3D) => ({
  raDeg: (Math.atan2(v[1], v[0]) / D + 360) % 360,
  decDeg: Math.asin(Math.max(-1, Math.min(1, v[2]))) / D,
});

const dot = (a: Point3D, b: Point3D) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const cross = (a: Point3D, b: Point3D): Point3D => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export const angleBetweenDeg = (a: Point3D, b: Point3D) =>
  Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) / D;

// 적경(도)을 "5h 35m" 꼴로
export const raLabel = (raDeg: number) => {
  const totalMin = Math.round((((raDeg % 360) + 360) % 360) * 4);
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;

  return `${h}h ${String(m).padStart(2, "0")}m`;
};

// ── 항성일 ──────────────────────────────────────────────
// 그리니치 항성시가 하루(태양일 86,400초)에 360°보다 조금 더 돈다. 그 남는 각도만큼 별이 일찍 뜬다.
const GMST_EXTRA_DEG_PER_DAY = (() => {
  const jd = 2451545;
  const diff = gmstDeg(jd + 1) - gmstDeg(jd);

  return ((diff % 360) + 360) % 360;
})();

// 별 기준으로 지구가 한 바퀴 도는 시간 (초). 약 23시간 56분 4초
export const SIDEREAL_DAY_SECONDS =
  (86400 * 360) / (360 + GMST_EXTRA_DEG_PER_DAY);

// 같은 별이 하루에 몇 초 일찍 뜨는가 (약 3분 56초)
export const DAILY_EARLIER_SECONDS = 86400 - SIDEREAL_DAY_SECONDS;

export const hmsLabel = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);

  return h > 0 ? `${h}시간 ${m}분 ${s}초` : `${m}분 ${s}초`;
};

// ── 해의 적위와 계절 ─────────────────────────────────────
export const sunDeclinationDeg = (date: Date) =>
  vectorToRaDec(sunVector(julianDay(date))).decDeg;

// 정오(해가 정남·정북에 올 때)의 해 높이. 위도와 해의 적위만으로 정해진다
export const noonSunAltitudeDeg = (latDeg: number, sunDecDeg: number) =>
  90 - Math.abs(latDeg - sunDecDeg);

// 그해 해의 적위가 가장 높은·낮은 날의 값 (하루 간격으로 찾는다)
export const sunDeclinationExtremes = (year: number) => {
  let max = -90;
  let min = 90;

  for (let day = 0; day < 366; day++) {
    const dec = sunDeclinationDeg(new Date(Date.UTC(year, 0, 1 + day, 12)));
    max = Math.max(max, dec);
    min = Math.min(min, dec);
  }

  return { max, min };
};

// ── 은하 좌표 ─────────────────────────────────────────────
// IAU 은하 좌표계의 J2000 기준값 (Hipparcos 소개 문서 1997, 1.5.3절)
export const GALACTIC_NORTH_POLE = { raDeg: 192.85948, decDeg: 27.12825 };
export const GALACTIC_CENTER = { raDeg: 266.40499, decDeg: -28.93617 };

const NGP = raDecToVector(
  GALACTIC_NORTH_POLE.raDeg,
  GALACTIC_NORTH_POLE.decDeg,
);
// 발표된 두 값은 반올림 때문에 정확히 직각이 아니다(10⁻⁵ 라디안). 극을 기준으로 중심 쪽을 직각으로 맞춘다
const GC = (() => {
  const c = raDecToVector(GALACTIC_CENTER.raDeg, GALACTIC_CENTER.decDeg);
  const k = dot(c, NGP);
  const v = c.map((x, i) => x - k * NGP[i]);
  const n = Math.hypot(v[0], v[1], v[2]);

  return v.map((x) => x / n) as Point3D;
})();
const GY = cross(NGP, GC);

// 은하면과 천구 적도가 이루는 각 = 90° − 은하 북극의 적위 (약 62.9°)
export const GALACTIC_TILT_DEG = 90 - GALACTIC_NORTH_POLE.decDeg;

// 은하 경도 l·위도 b → 적도좌표 벡터 (l=0: 은하 중심, l=180: 반대쪽)
export const galacticToVector = (lDeg: number, bDeg: number): Point3D => {
  const cb = Math.cos(bDeg * D);
  const cl = Math.cos(lDeg * D);
  const sl = Math.sin(lDeg * D);
  const sb = Math.sin(bDeg * D);

  return [0, 1, 2].map(
    (i) => cb * cl * GC[i] + cb * sl * GY[i] + sb * NGP[i],
  ) as Point3D;
};

export const vectorToGalactic = (v: Point3D) => ({
  lDeg: (Math.atan2(dot(v, GY), dot(v, GC)) / D + 360) % 360,
  bDeg: Math.asin(Math.max(-1, Math.min(1, dot(v, NGP)))) / D,
});

// 은하 적도(은하수 한가운데 선)를 stepDeg 간격의 점으로
export const galacticEquator = (stepDeg = 2): Point3D[] =>
  Array.from({ length: Math.round(360 / stepDeg) + 1 }, (_, i) =>
    galacticToVector(i * stepDeg, 0),
  );

// 천구 적도·황도도 같은 방법으로
export const celestialEquator = (stepDeg = 2): Point3D[] =>
  Array.from({ length: Math.round(360 / stepDeg) + 1 }, (_, i) =>
    raDecToVector(i * stepDeg, 0),
  );

export const OBLIQUITY_J2000_DEG = 23.4392911;

export const ecliptic = (stepDeg = 2): Point3D[] => {
  const e = OBLIQUITY_J2000_DEG * D;

  return Array.from({ length: Math.round(360 / stepDeg) + 1 }, (_, i) => {
    const l = i * stepDeg * D;
    const y = Math.sin(l);

    return [Math.cos(l), Math.cos(e) * y, Math.sin(e) * y] as Point3D;
  });
};

// ── 지평 좌표 ─────────────────────────────────────────────
export const altAzAt = (v: Point3D, t: number, observer: Observer) => {
  const f = horizontalFrameJ2000(julianDay(new Date(t)), observer);

  return {
    altDeg: Math.asin(Math.max(-1, Math.min(1, dot(v, f.zenith)))) / D,
    azDeg: (Math.atan2(dot(v, f.east), dot(v, f.north)) / D + 360) % 360,
  };
};

// ── 계절별 밝은 별 세기 ──────────────────────────────────
export interface CountStar {
  vector: Point3D;
  mag: number;
  hr?: string;
}

// 그 순간 고도 minAltDeg 위에 있는, magLimit 등급보다 밝은 별
export const brightStarsUp = (
  stars: CountStar[],
  t: number,
  observer: Observer,
  magLimit: number,
  minAltDeg: number,
): CountStar[] => {
  const f = horizontalFrameJ2000(julianDay(new Date(t)), observer);
  const minUp = Math.sin(minAltDeg * D);

  return stars.filter(
    (s) => s.mag <= magLimit && dot(s.vector, f.zenith) >= minUp,
  );
};

// 같은 별(쌍성의 두 별 등)이 따로 실린 경우를 하나로: BSC5에는 겹쳐 보이는 별이 두 줄로 실린 경우가 있다
// (예: 남십자자리 알파 A·B). 맨눈에는 하나로 보이니 0.05° 안의 별은 밝은 쪽만 센다.
export const mergeCloseStars = (stars: CountStar[], withinDeg = 0.05) => {
  const sorted = [...stars].sort((a, b) => a.mag - b.mag);
  const out: CountStar[] = [];
  const minDot = Math.cos(withinDeg * D);

  for (const s of sorted) {
    if (!out.some((o) => dot(o.vector, s.vector) >= minDot)) {
      out.push(s);
    }
  }

  return out;
};

export interface SeasonCountOptions {
  observer: Observer;
  year: number;
  utcOffsetHours: number; // 그 나라 시각 = UTC + 이 값
  localHour: number; // 저녁 몇 시의 하늘인가 (예: 21)
  magLimits: number[];
  minAltDeg: number;
}

export interface MonthCount {
  month: number; // 1~12
  counts: number[]; // magLimits 순서대로
}

// 달마다 15일 저녁 같은 시각에 떠 있는 밝은 별 수
export const monthlyEveningCounts = (
  stars: CountStar[],
  o: SeasonCountOptions,
): MonthCount[] => {
  const merged = mergeCloseStars(stars);

  return Array.from({ length: 12 }, (_, i) => {
    const t = Date.UTC(o.year, i, 15, o.localHour - o.utcOffsetHours);

    return {
      month: i + 1,
      counts: o.magLimits.map(
        (m) => brightStarsUp(merged, t, o.observer, m, o.minAltDeg).length,
      ),
    };
  });
};

// 계절: 12·1·2월 겨울, 3·4·5월 봄, 6·7·8월 여름, 9·10·11월 가을 (석 달 평균)
export const SEASONS = [
  { key: "spring", label: "봄", months: [3, 4, 5] },
  { key: "summer", label: "여름", months: [6, 7, 8] },
  { key: "autumn", label: "가을", months: [9, 10, 11] },
  { key: "winter", label: "겨울", months: [12, 1, 2] },
] as const;

export const seasonAverages = (monthly: MonthCount[]) =>
  SEASONS.map((s) => {
    const rows = monthly.filter((m) =>
      (s.months as readonly number[]).includes(m.month),
    );

    return {
      key: s.key,
      label: s.label,
      averages: rows[0].counts.map(
        (_, k) => rows.reduce((a, r) => a + r.counts[k], 0) / rows.length,
      ),
    };
  });

// ── 밝기와 거리 ───────────────────────────────────────────
// 등급 차이 → 밝기 비 (5등급 차이가 정확히 100배)
export const brightnessRatio = (magDiff: number) => 10 ** (0.4 * magDiff);

// 연주 시차(각초) → 거리 (광년). 1파섹 = 3.2616광년
export const parallaxToLightYears = (parallaxArcsec: number) =>
  3.2616 / parallaxArcsec;

// 대기를 지나는 길이(대기량): 천정이 1, 지평선 쪽으로 갈수록 길어진다 (Kasten·Young 1989 근사)
export const airmass = (altDeg: number) => {
  const z = 90 - altDeg;

  return 1 / (Math.cos(z * D) + 0.50572 * (96.07995 - z) ** -1.6364);
};

// 대기 소광: 맑은 날 맨눈(V)에서 대기량 1당 약 0.2~0.3등급 어두워진다. 여기서는 0.25로 둔다
export const EXTINCTION_MAG_PER_AIRMASS = 0.25;

export const extinctionMag = (altDeg: number, k = EXTINCTION_MAG_PER_AIRMASS) =>
  k * airmass(altDeg);
