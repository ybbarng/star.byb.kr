import type { Point3D } from "@/scripts/hash/types";
import { julianDay, ofDateToJ2000, sunVector } from "@/search/utils/ephemeris";

// 생일 별자리: 생일에 해가 "실제로" 있던 별자리(IAU 경계)와 점성술의 별자리(춘분점부터 30°씩)를 비교한다.
//
// 점성술의 열두 궁은 약 2천 년 전 춘분점을 양자리 시작(0°)으로 정해 30°씩 나눈 것이다. 그 뒤 지구 자전축의
// 세차 운동으로 춘분점이 1년에 약 50″씩 서쪽으로 밀려, 지금은 약 30°(거의 한 별자리) 어긋나 있다.
// 또 실제 별자리는 폭이 제각각이고(전갈자리 약 7°, 처녀자리 약 44°), 황도는 뱀주인자리도 지난다.

const D = Math.PI / 180;
// J2000 황도 경사
const EPS = 23.4392911 * D;

export interface ZodiacConstellation {
  label: string; // 별자리 데이터의 이름
  startLonDeg: number; // 해가 들어오는 황경 (J2000, IAU 경계와 황도가 만나는 곳)
}

// 황도가 지나는 13개 별자리, 해가 지나는 순서대로. 경계 경도는 IAU 별자리 경계와 J2000 황도의 교차점
// (약 0.1° 정도의 근사값). 실제 별자리 별들의 위치로 테스트에서 확인한다.
export const ZODIAC: ZodiacConstellation[] = [
  { label: "양자리", startLonDeg: 28.69 },
  { label: "황소자리", startLonDeg: 53.42 },
  { label: "쌍둥이자리", startLonDeg: 90.14 },
  { label: "게자리", startLonDeg: 118.26 },
  { label: "사자자리", startLonDeg: 138.18 },
  { label: "처녀자리", startLonDeg: 174.15 },
  { label: "천칭자리", startLonDeg: 218.02 },
  { label: "전갈자리", startLonDeg: 241.12 },
  { label: "뱀주인자리", startLonDeg: 247.69 },
  { label: "궁수자리", startLonDeg: 266.3 },
  { label: "염소자리", startLonDeg: 299.71 },
  { label: "물병자리", startLonDeg: 327.49 },
  { label: "물고기자리", startLonDeg: 351.57 },
];

// 점성술의 열두 궁 (춘분점부터 30°씩)
export const SIGNS = [
  "양자리",
  "황소자리",
  "쌍둥이자리",
  "게자리",
  "사자자리",
  "처녀자리",
  "천칭자리",
  "전갈자리",
  "궁수자리",
  "염소자리",
  "물병자리",
  "물고기자리",
];

const wrap = (deg: number) => ((deg % 360) + 360) % 360;

// 적도좌표(J2000) 방향 → J2000 황도 경도·위도 (°)
export const toEcliptic = (v: Point3D) => {
  const y = Math.cos(EPS) * v[1] + Math.sin(EPS) * v[2];
  const z = -Math.sin(EPS) * v[1] + Math.cos(EPS) * v[2];

  return {
    lonDeg: wrap(Math.atan2(y, v[0]) / D),
    latDeg: Math.asin(Math.max(-1, Math.min(1, z))) / D,
  };
};

// J2000 황도 경도·위도(°) → 적도좌표 방향
export const fromEcliptic = (lonDeg: number, latDeg: number): Point3D => {
  const x = Math.cos(latDeg * D) * Math.cos(lonDeg * D);
  const y = Math.cos(latDeg * D) * Math.sin(lonDeg * D);
  const z = Math.sin(latDeg * D);

  return [
    x,
    Math.cos(EPS) * y - Math.sin(EPS) * z,
    Math.sin(EPS) * y + Math.cos(EPS) * z,
  ];
};

// 황경(J2000)이 들어 있는 황도 별자리
export const zodiacAt = (lonDeg: number): ZodiacConstellation => {
  const l = wrap(lonDeg);
  let found = ZODIAC[ZODIAC.length - 1];

  for (const z of ZODIAC) {
    if (l >= z.startLonDeg) {
      found = z;
    }
  }

  // 물고기자리는 351.57°에서 다음 해 양자리 28.69°까지 이어진다
  return l < ZODIAC[0].startLonDeg ? ZODIAC[ZODIAC.length - 1] : found;
};

export const zodiacWidthDeg = (z: ZodiacConstellation): number => {
  const i = ZODIAC.indexOf(z);
  const next = ZODIAC[(i + 1) % ZODIAC.length];

  return wrap(next.startLonDeg - z.startLonDeg);
};

export interface BirthdaySky {
  sunLonJ2000: number; // 별자리와 비교하는 해의 황경 (J2000)
  sunLonOfDate: number; // 점성술이 쓰는 그날 춘분점 기준 황경
  constellation: ZodiacConstellation; // 해가 실제로 있던 별자리
  sign: string; // 점성술의 별자리
  precessionDeg: number; // 점성술 기준이 정해진 무렵부터 춘분점이 밀린 각도 (약)
}

// 생일(그날 정오, 세계시)의 해
export const birthdaySky = (
  year: number,
  month: number,
  day: number,
): BirthdaySky => {
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  const jd = julianDay(date);
  const ofDate = sunVector(jd);
  const sunLonOfDate = toEcliptic(ofDate).lonDeg;
  const sunLonJ2000 = toEcliptic(ofDateToJ2000(ofDate, jd)).lonDeg;

  return {
    sunLonJ2000,
    sunLonOfDate,
    constellation: zodiacAt(sunLonJ2000),
    sign: SIGNS[Math.floor(sunLonOfDate / 30)],
    // 기원전 2세기 히파르코스 무렵 춘분점이 양자리 시작에 있었다고 보고, 1년에 50.3″씩
    precessionDeg: ((year + 130) * 50.3) / 3600,
  };
};
