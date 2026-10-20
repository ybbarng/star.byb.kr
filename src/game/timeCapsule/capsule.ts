import type { Point3D } from "@/scripts/hash/types";
import { STARS } from "@/game/sky/catalog";
import { EARTH_RADIUS_KM, PLANETS } from "@/search/skyObjects";
import { julianDay, moonPosition } from "@/search/utils/ephemeris";
import { planetPosition } from "@/search/utils/planets";
import parallaxData from "@build/database/parallax.json";

// 빛의 타임캡슐: 별빛이 지금 우리 눈에 닿기까지 걸린 시간 = 그 별까지의 거리(광년).
// 별을 누르면 빛이 출발한 해와, 그 무렵 지구(주로 한국)에서 있었던 일을 보여 준다.
// 거리는 BSC5의 연주 시차(각초)로 구한다: 거리(광년) = 3.2616 / 시차. 시차가 0.01″보다 작은 먼 별은
// 오차가 커서 "약"으로만 말한다.

const PARALLAX = parallaxData as Record<string, number>;
const LY_PER_PARSEC = 3.2616;
// 이보다 작은 시차는 오차가 커서 대략으로만 말한다 (약 300광년보다 먼 별)
export const RELIABLE_PARALLAX = 0.01;

export interface HistoryEvent {
  year: number; // 기원전은 음수
  text: string;
}

// 연도가 널리 알려진 사건들 (전설상 연도는 그렇게 적는다)
export const EVENTS: HistoryEvent[] = [
  { year: -2560, text: "이집트 쿠푸왕의 대피라미드가 지어질 무렵" },
  { year: -2333, text: "단군이 고조선을 세웠다고 전해지는 해" },
  { year: -776, text: "첫 고대 올림픽이 열렸다고 전해지는 해" },
  { year: -221, text: "진시황이 중국을 통일한 해" },
  { year: -57, text: "신라가 세워졌다고 전해지는 해" },
  { year: -37, text: "고구려가 세워졌다고 전해지는 해" },
  { year: -18, text: "백제가 세워졌다고 전해지는 해" },
  { year: 105, text: "중국의 채륜이 종이 만드는 법을 개량한 해" },
  { year: 372, text: "고구려가 불교를 받아들이고 태학을 세운 해" },
  { year: 476, text: "서로마 제국이 무너진 해" },
  { year: 612, text: "을지문덕의 살수대첩" },
  { year: 676, text: "신라가 삼국을 통일한 해" },
  { year: 751, text: "불국사와 석굴암을 짓기 시작한 해" },
  { year: 918, text: "왕건이 고려를 세운 해" },
  {
    year: 1054,
    text: "동아시아 천문학자들이 낮에도 보이는 초신성(지금의 게성운)을 기록한 해",
  },
  { year: 1096, text: "첫 십자군 원정이 시작된 해" },
  { year: 1251, text: "팔만대장경이 완성된 해" },
  { year: 1377, text: "금속활자로 『직지』를 찍은 해" },
  { year: 1392, text: "조선이 세워진 해" },
  { year: 1441, text: "세종 때 측우기를 만든 해" },
  { year: 1446, text: "훈민정음을 반포한 해" },
  { year: 1492, text: "콜럼버스가 아메리카에 닿은 해" },
  { year: 1543, text: "코페르니쿠스가 지동설 책을 낸 해" },
  { year: 1592, text: "임진왜란이 일어난 해" },
  { year: 1609, text: "갈릴레이가 망원경으로 하늘을 보기 시작한 무렵" },
  { year: 1636, text: "병자호란이 일어난 해" },
  { year: 1687, text: "뉴턴이 『프린키피아』로 만유인력을 밝힌 해" },
  { year: 1776, text: "미국 독립 선언" },
  { year: 1789, text: "프랑스 혁명" },
  { year: 1796, text: "수원 화성이 완공된 해" },
  { year: 1876, text: "벨이 전화를 발명(특허)한 해" },
  { year: 1903, text: "라이트 형제가 처음 동력 비행에 성공한 해" },
  { year: 1905, text: "아인슈타인이 특수 상대성 이론을 낸 해" },
  { year: 1945, text: "광복" },
  { year: 1969, text: "아폴로 11호가 달에 내린 해" },
  { year: 1988, text: "서울 올림픽" },
  { year: 2002, text: "한일 월드컵" },
];

export interface StarDistance {
  lightYears: number;
  reliable: boolean;
}

export const distanceOf = (hr: string): StarDistance | null => {
  const p = PARALLAX[hr];

  return p
    ? { lightYears: LY_PER_PARSEC / p, reliable: p >= RELIABLE_PARALLAX }
    : null;
};

// 빛이 출발한 해와 그 무렵의 사건 (가장 가까운 해)
export const departure = (lightYears: number, nowYear: number) => {
  const year = Math.round(nowYear - lightYears);
  const event = EVENTS.reduce((best, e) =>
    Math.abs(e.year - year) < Math.abs(best.year - year) ? e : best,
  );

  return { year, event, gap: Math.abs(event.year - year) };
};

export const yearLabel = (year: number) =>
  year < 0 ? `기원전 ${-year}년` : `${year}년`;

export interface AgeStar {
  hr: string;
  name: string | null;
  vector: Point3D;
  mag: number;
  lightYears: number;
}

// 내 나이만큼 떨어진 별 (빛이 내가 태어날 무렵 출발한 별): 나이와 8%(최소 1.5광년) 안, 밝은 별부터
export const ageStars = (age: number, limit = 5): AgeStar[] =>
  STARS.flatMap((s) => {
    const d = distanceOf(s.hr);

    return d?.reliable
      ? [
          {
            hr: s.hr,
            name: s.name ?? null,
            vector: s.vector,
            mag: s.mag,
            lightYears: d.lightYears,
          },
        ]
      : [];
  })
    .filter((s) => Math.abs(s.lightYears - age) <= Math.max(1.5, age * 0.08))
    // 하늘에서 찾아볼 수 있게 밝은 별부터
    .sort((a, b) => a.mag - b.mag)
    .slice(0, limit);

// 저녁 9시 무렵 남쪽 하늘 높이 뜨는 달 (적경으로 어림: 1월 중순에 4시, 한 달에 2시간씩)
export const bestMonthOf = (v: Point3D) => {
  const raHours = ((Math.atan2(v[1], v[0]) * 12) / Math.PI + 24) % 24;

  return (((Math.round((raHours - 4) / 2) % 12) + 12) % 12) + 1;
};

// 별빛 도감의 업적: 별을 누를 때마다 확인한다 (collected는 지금까지 모은 별 수, 이번 별 포함)
export interface CapsuleBadge {
  id: string;
  title: string;
  note: string;
  test: (trip: {
    lightYears: number;
    year: number;
    collected: number;
  }) => boolean;
}

export const CAPSULE_BADGES: CapsuleBadge[] = [
  {
    id: "neighbor",
    title: "이웃 별",
    note: "20광년 안의 별",
    test: (t) => t.lightYears <= 20,
  },
  {
    id: "my-century",
    title: "20세기의 빛",
    note: "1901~2000년에 출발한 빛",
    test: (t) => t.year >= 1901 && t.year <= 2000,
  },
  {
    id: "joseon",
    title: "조선의 빛",
    note: "조선 시대(1392~1897)에 출발한 빛",
    test: (t) => t.year >= 1392 && t.year <= 1897,
  },
  {
    id: "millennium",
    title: "천 년 여행자",
    note: "1,000광년보다 먼 별",
    test: (t) => t.lightYears >= 1000,
  },
  {
    id: "collector",
    title: "별빛 수집가",
    note: "별 10개 모으기",
    test: (t) => t.collected >= 10,
  },
];

// 이번에 새로 딴 업적
export const newBadges = (
  trip: { lightYears: number; year: number; collected: number },
  owned: ReadonlySet<string>,
) => CAPSULE_BADGES.filter((b) => !owned.has(b.id) && b.test(trip));

// 해·달·행성의 빛이 지구까지 오는 데 걸린 시간 (초). 별과 달리 몇 초~몇십 분이다
const LIGHT_KM_PER_S = 299792.458;
const AU_KM = 149597870.7;

export const solarLightSeconds = (name: string, date: Date): number | null => {
  const jd = julianDay(date);

  if (name === "달") {
    return (
      (moonPosition(jd).distanceEarthRadii * EARTH_RADIUS_KM) / LIGHT_KM_PER_S
    );
  }

  const planet = PLANETS.find(([, korean]) => korean === name);

  return planet
    ? (planetPosition(planet[0], jd).distanceAu * AU_KM) / LIGHT_KM_PER_S
    : null;
};

// 몇 초 → "1.3초", "43분 12초"
export const durationLabel = (seconds: number) =>
  seconds < 60
    ? `${seconds.toFixed(1)}초`
    : `${Math.floor(seconds / 60)}분 ${Math.round(seconds % 60)}초`;
