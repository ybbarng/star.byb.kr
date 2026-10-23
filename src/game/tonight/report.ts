import type { DrawConstellation } from "@/game/sky/drawSky";
import type { Place } from "@/game/tonight/places";
import type { Point3D } from "@/scripts/hash/types";
import type { HorizontalFrame, Observer } from "@/search/utils/ephemeris";
import type { PlanetName } from "@/search/utils/planets";
import {
  constellationCenter,
  constellationParts,
  STARS,
  uniqueStars,
} from "@/game/sky/catalog";
import { distanceOf } from "@/game/timeCapsule/capsule";
import { localParts, localToUtc } from "@/game/tonight/time";
import { PLANETS } from "@/search/skyObjects";
import { constellationAt } from "@/search/utils/constellationBounds";
import {
  horizontalFrameJ2000,
  julianDay,
  moonPosition,
  moonVectorFrom,
  ofDateToJ2000,
  sunVector,
} from "@/search/utils/ephemeris";
import { planetPosition } from "@/search/utils/planets";

// 오늘 밤 내 하늘 (docs/game-plans.md): 장소와 날짜로 그날 밤 볼 만한 것을 실제 하늘 계산으로 고른다.
// 해·달은 천문연감 저정밀 공식(ephemeris.ts), 행성은 JPL 궤도 요소(planets.ts)를 그대로 쓴다.
// 뜨고 지는 시각은 5분 간격으로 고도를 재고, 지평선을 넘는 구간을 반씩 좁혀 찾는다 (분 단위 어림).
// 모든 방향은 카탈로그와 같은 J2000 적도좌표 단위 벡터, 고도·방위는 그 시각 관측지의 수평 좌표계로 잰다.

const D = Math.PI / 180;
const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const STEP = 5 * MINUTE;

// 지평선을 넘는 고도 (대기 굴절 34′ + 겉보기 반지름). 해·달은 윗가장자리, 행성·별은 점
export const SUN_HORIZON = -0.833;
export const MOON_HORIZON = -0.833;
const POINT_HORIZON = -0.567;

const SYNODIC_MONTH = 29.530589;
const OBLIQUITY_J2000 = 23.4393;

type Vec = Point3D;

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const norm = (v: number[]): Vec => {
  const n = Math.hypot(v[0], v[1], v[2]);

  return [v[0] / n, v[1] / n, v[2] / n];
};

const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export const separationDeg = (a: Vec, b: Vec) =>
  Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) / D;

const wrap360 = (deg: number) => ((deg % 360) + 360) % 360;
const wrap180 = (deg: number) => wrap360(deg + 180) - 180;

const jdOf = (t: number) => julianDay(new Date(t));

// ── 천체의 방향 (J2000) ─────────────────────────────────────────────

export const sunAt = (t: number): Vec => {
  const jd = jdOf(t);

  return ofDateToJ2000(sunVector(jd), jd);
};

// 관측지에서 본 달 (지구 중심과 최대 1° 다르다)
export const moonAt = (t: number, observer: Observer): Vec => {
  const jd = jdOf(t);

  return ofDateToJ2000(moonVectorFrom(jd, observer), jd);
};

const moonGeoAt = (t: number): Vec => {
  const jd = jdOf(t);

  return ofDateToJ2000(moonPosition(jd).vector, jd);
};

export const planetAt = (name: PlanetName, t: number): Vec =>
  planetPosition(name, jdOf(t)).vector;

export const frameAt = (t: number, observer: Observer) =>
  horizontalFrameJ2000(jdOf(t), observer);

export const altOf = (v: Vec, frame: HorizontalFrame) =>
  Math.asin(Math.max(-1, Math.min(1, dot(v, frame.zenith)))) / D;

export const azOf = (v: Vec, frame: HorizontalFrame) =>
  wrap360(Math.atan2(dot(v, frame.east), dot(v, frame.north)) / D);

// 황경 (J2000 황도)
const eclipticLonDeg = (v: Vec) => {
  const e = OBLIQUITY_J2000 * D;

  return wrap360(Math.atan2(v[1] * Math.cos(e) + v[2] * Math.sin(e), v[0]) / D);
};

// ── 말로 옮기기 ────────────────────────────────────────────────────

const DIRECTIONS = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];

// 방위 → "남동쪽"
export const directionName = (azDeg: number) =>
  `${DIRECTIONS[Math.round(wrap360(azDeg) / 45) % 8]}쪽`;

// 고도 → 말 (주먹 하나를 팔 뻗어 들면 하늘에서 약 10°)
export const heightName = (altDeg: number) =>
  altDeg >= 75
    ? "머리 꼭대기"
    : altDeg >= 55
      ? "높이"
      : altDeg >= 30
        ? "중간 높이"
        : altDeg >= 12
          ? "낮게"
          : "지평선 가까이";

export const fistsLabel = (altDeg: number) => {
  const n = Math.round(altDeg / 10);

  return n <= 0 ? "주먹 반 개 높이" : `주먹 ${n}개 높이`;
};

// 각거리 → 손으로 재는 말. 하늘 읽기 기초(별 건너뛰기)와 같은 값을 쓴다:
// 팔 뻗은 새끼손가락 약 1°, 손가락 세 개 약 5°, 주먹 약 10°
export const fingersLabel = (deg: number) =>
  deg < 1.2
    ? "새끼손가락 하나로 둘 다 가릴 만큼"
    : deg < 3.5
      ? `새끼손가락 ${Math.round(deg)}개 너비`
      : deg < 7.5
        ? "손가락 세 개 너비"
        : "주먹 하나 너비";

// ── 고도를 따라가며 지평선 넘는 시각 찾기 ─────────────────────────────

export interface Crossing {
  t: number;
  rising: boolean;
}

// 표본(times·values)에서 h0를 넘는 구간을 찾아, 그 구간을 반씩 좁혀 1분보다 촘촘하게 맞춘다
export const findCrossings = (
  times: number[],
  values: number[],
  fn: (t: number) => number,
  h0: number,
): Crossing[] => {
  const out: Crossing[] = [];

  for (let i = 0; i + 1 < times.length; i++) {
    const a = values[i] - h0;
    const b = values[i + 1] - h0;

    if (a < 0 === b < 0) {
      continue;
    }

    let lo = times[i];
    let hi = times[i + 1];
    let flo = a;

    for (let k = 0; k < 12; k++) {
      const mid = (lo + hi) / 2;
      const fm = fn(mid) - h0;

      if (fm < 0 === flo < 0) {
        lo = mid;
        flo = fm;
      } else {
        hi = mid;
      }
    }

    out.push({ t: (lo + hi) / 2, rising: b > a });
  }

  return out;
};

// ── 행성 밝기 ───────────────────────────────────────────────────────

// Meeus 『Astronomical Algorithms』 41장 (천문연감 1984 공식). 토성은 고리 몫(최대 -1등급쯤)을 뺐다
const MAG: Record<string, (i: number) => number> = {
  Mercury: (i) => -0.42 + 0.038 * i - 0.000273 * i * i + 0.000002 * i ** 3,
  Venus: (i) => -4.4 + 0.0009 * i + 0.000239 * i * i - 0.00000065 * i ** 3,
  Mars: (i) => -1.52 + 0.016 * i,
  Jupiter: (i) => -9.4 + 0.005 * i,
  Saturn: () => -8.88,
};

// 지구-해 거리 (au)
const sunDistanceAu = (t: number) => {
  const g = (357.528 + 0.9856003 * (jdOf(t) - 2451545)) * D;

  return 1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g);
};

export const planetMagnitude = (name: PlanetName, t: number) => {
  const jd = jdOf(t);
  const { vector, distanceAu: delta } = planetPosition(name, jd);
  const R = sunDistanceAu(t);
  const s = sunAt(t);
  const helio = [0, 1, 2].map((k) => vector[k] * delta - s[k] * R);
  const r = Math.hypot(helio[0], helio[1], helio[2]);
  const cosI = (r * r + delta * delta - R * R) / (2 * r * delta);
  const i = Math.acos(Math.max(-1, Math.min(1, cosI))) / D;

  return 5 * Math.log10(r * delta) + MAG[name](i);
};

export const brightnessWord = (mag: number) =>
  mag < -3
    ? "눈부시게 밝아요"
    : mag < -1.5
      ? "아주 밝아요"
      : mag < 0.5
        ? "밝은 별만큼 밝아요"
        : mag < 2
          ? "보통 별만큼 밝아요"
          : "흐려서 어두운 곳이어야 보여요";

// ── 달 ────────────────────────────────────────────────────────────

// 해에서 달까지 황경 차 (0 삭, 90 상현, 180 보름, 270 하현)
export const moonPhaseDeg = (t: number) =>
  wrap360(eclipticLonDeg(moonGeoAt(t)) - eclipticLonDeg(sunAt(t)));

export const moonLitFraction = (t: number) =>
  (1 - dot(sunAt(t), moonGeoAt(t))) / 2;

export const moonPhaseName = (phaseDeg: number) =>
  phaseDeg < 10 || phaseDeg >= 350
    ? "삭 (달이 안 보이는 날)"
    : phaseDeg < 80
      ? "초승달"
      : phaseDeg < 100
        ? "상현달"
        : phaseDeg < 170
          ? "차오르는 볼록달"
          : phaseDeg < 190
            ? "보름달"
            : phaseDeg < 260
              ? "기우는 볼록달"
              : phaseDeg < 280
                ? "하현달"
                : "그믐달";

// t 이후 처음으로 위상이 target°(0 삭, 180 보름)가 되는 순간
export const nextPhase = (t: number, target: number) => {
  const f = (x: number) => wrap180(moonPhaseDeg(x) - target);
  const step = 6 * HOUR;
  let a = t;
  let fa = f(a);

  for (let k = 0; k < 4 * 32; k++) {
    const b = a + step;
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

      return (lo + hi) / 2;
    }

    a = b;
    fa = fb;
  }

  return null;
};

// ── 유성우 ─────────────────────────────────────────────────────────

// 국제유성기구(IMO) 유성우 달력의 대표 값: 극대 때 해의 황경(J2000), 활동 기간(극대 앞뒤 날수),
// 천정 시간당 유성 수(ZHR, 복사점이 머리 위이고 아주 어두운 하늘일 때), 복사점(적경·적위), 극대에서 멀어질 때
// 하루에 줄어드는 정도(log10)
export interface Shower {
  name: string;
  peakLonDeg: number;
  before: number;
  after: number;
  zhr: number;
  raDeg: number;
  decDeg: number;
  fade: number;
  note: string;
}

export const SHOWERS: Shower[] = [
  {
    name: "사분의자리 유성우",
    peakLonDeg: 283.15,
    before: 5,
    after: 8,
    zhr: 110,
    raDeg: 230,
    decDeg: 49,
    fade: 0.8,
    note: "극대가 몇 시간뿐인 짧고 굵은 유성우예요. 옛 별자리 '사분의자리'에서 이름을 땄어요.",
  },
  {
    name: "거문고자리 유성우",
    peakLonDeg: 32.32,
    before: 8,
    after: 8,
    zhr: 18,
    raDeg: 271,
    decDeg: 34,
    fade: 0.25,
    note: "2,700년 전 중국 기록에도 나오는, 가장 오래 관측된 유성우예요.",
  },
  {
    name: "물병자리 에타 유성우",
    peakLonDeg: 45.5,
    before: 10,
    after: 10,
    zhr: 50,
    raDeg: 338,
    decDeg: -1,
    fade: 0.06,
    note: "핼리 혜성이 흘린 부스러기예요. 남반구에서 더 잘 보여요.",
  },
  {
    name: "남쪽 물병자리 델타 유성우",
    peakLonDeg: 127,
    before: 10,
    after: 10,
    zhr: 25,
    raDeg: 340,
    decDeg: -16,
    fade: 0.05,
    note: "여름밤 남쪽 낮은 하늘에서 은은하게 떨어져요.",
  },
  {
    name: "페르세우스자리 유성우",
    peakLonDeg: 140,
    before: 14,
    after: 8,
    zhr: 100,
    raDeg: 48,
    decDeg: 58,
    fade: 0.1,
    note: "스위프트-터틀 혜성의 부스러기예요. 여름 휴가철 최고의 유성우!",
  },
  {
    name: "용자리 유성우",
    peakLonDeg: 195.4,
    before: 2,
    after: 2,
    zhr: 10,
    raDeg: 262,
    decDeg: 54,
    fade: 0.4,
    note: "초저녁에 잘 보이는 드문 유성우예요. 몇 해에 한 번 갑자기 쏟아지기도 해요.",
  },
  {
    name: "오리온자리 유성우",
    peakLonDeg: 208,
    before: 10,
    after: 10,
    zhr: 20,
    raDeg: 95,
    decDeg: 16,
    fade: 0.06,
    note: "물병자리 에타 유성우처럼 핼리 혜성이 흘린 부스러기예요. 빠르고 밝은 꼬리를 남겨요.",
  },
  {
    name: "사자자리 유성우",
    peakLonDeg: 235.27,
    before: 8,
    after: 8,
    zhr: 15,
    raDeg: 152,
    decDeg: 22,
    fade: 0.15,
    note: "33년마다 '유성 폭풍'으로 쏟아진 적이 있는 유성우예요 (1833년, 1966년).",
  },
  {
    name: "쌍둥이자리 유성우",
    peakLonDeg: 262.2,
    before: 8,
    after: 4,
    zhr: 150,
    raDeg: 112,
    decDeg: 33,
    fade: 0.2,
    note: "한 해 중 가장 많이 떨어지는 유성우예요. 혜성이 아니라 소행성 파에톤의 부스러기예요.",
  },
  {
    name: "작은곰자리 유성우",
    peakLonDeg: 270.7,
    before: 4,
    after: 4,
    zhr: 10,
    raDeg: 217,
    decDeg: 76,
    fade: 0.3,
    note: "동지 무렵 북쪽 하늘에서 조용히 떨어지는 유성우예요.",
  },
];

const fromRaDec = (raDeg: number, decDeg: number): Vec => [
  Math.cos(decDeg * D) * Math.cos(raDeg * D),
  Math.cos(decDeg * D) * Math.sin(raDeg * D),
  Math.sin(decDeg * D),
];

// 해의 황경 → 극대까지 남은 날 (해는 하루에 약 0.9856°씩 황도를 돈다)
export const daysFromPeak = (shower: Shower, t: number) =>
  wrap180(eclipticLonDeg(sunAt(t)) - shower.peakLonDeg) / 0.98561;

// ── 별자리와 밝은 별 이야기 ──────────────────────────────────────────

// 찾기 쉬운 유명한 별자리와 찾는 법
// fame: 얼마나 널리 알려졌나 (1~3). 높이가 비슷하면 더 유명한 별자리를 고른다
export const FAMOUS: { label: string; fame: number; tip: string }[] = [
  {
    label: "오리온자리",
    fame: 3,
    tip: "나란히 선 별 셋(허리띠)부터 찾아요. 한쪽 어깨엔 붉은 베텔게우스, 반대쪽 발엔 하얀 리겔이 있어요.",
  },
  {
    label: "큰곰자리",
    fame: 3,
    tip: "국자 모양 북두칠성이 큰곰의 엉덩이와 꼬리예요. 국자 끝 두 별 사이를 다섯 번 이으면 북극성!",
  },
  {
    label: "카시오페이아자리",
    fame: 2,
    tip: "W(또는 M) 모양 별 다섯 개. 북두칠성이 낮을 때 대신 북극성을 찾게 도와줘요.",
  },
  {
    label: "백조자리",
    fame: 3,
    tip: "은하수 위를 나는 커다란 십자가 모양. 꼬리 별 데네브는 여름의 대삼각형 꼭짓점이에요.",
  },
  {
    label: "거문고자리",
    fame: 2,
    tip: "아주 밝은 직녀성 옆에 작은 평행사변형이 매달려 있어요.",
  },
  {
    label: "독수리자리",
    fame: 2,
    tip: "견우성 양옆에 작은 별이 하나씩. 은하수 건너 직녀성과 마주 보고 있어요.",
  },
  {
    label: "전갈자리",
    fame: 3,
    tip: "S자로 휜 긴 꼬리, 심장 자리엔 붉은 안타레스가 빛나요.",
  },
  {
    label: "궁수자리",
    fame: 2,
    tip: "주전자 모양을 찾아보세요. 주둥이에서 김처럼 은하수 한가운데가 피어올라요.",
  },
  {
    label: "사자자리",
    fame: 2,
    tip: "물음표를 뒤집은 듯한 낫 모양이 사자 머리, 그 끝에 레굴루스가 있어요.",
  },
  {
    label: "목동자리",
    fame: 1,
    tip: "북두칠성 손잡이의 곡선을 쭉 따라가면 주황빛 아크투루스에 닿아요.",
  },
  {
    label: "처녀자리",
    fame: 1,
    tip: "아크투루스에서 곡선을 한 번 더 이어 가면 하얀 스피카예요.",
  },
  {
    label: "쌍둥이자리",
    fame: 2,
    tip: "나란히 선 밝은 두 별, 카스토르와 폴룩스가 쌍둥이의 머리예요.",
  },
  {
    label: "황소자리",
    fame: 2,
    tip: "V자 얼굴에 붉은 눈 알데바란, 어깨엔 보석 같은 좀생이별(플레이아데스).",
  },
  {
    label: "마차부자리",
    fame: 1,
    tip: "노란 카펠라가 이끄는 커다란 오각형이에요.",
  },
  {
    label: "큰개자리",
    fame: 2,
    tip: "밤하늘에서 가장 밝은 별 시리우스가 큰 개의 코끝에서 빛나요.",
  },
  {
    label: "페가수스자리",
    fame: 2,
    tip: "하늘 높이 떠 있는 커다란 네모(가을의 대사각형)를 찾아요.",
  },
  {
    label: "안드로메다자리",
    fame: 1,
    tip: "페가수스 네모의 한 귀퉁이에서 뻗은 두 줄. 그 옆에 맨눈으로 보이는 이웃 은하가 있어요.",
  },
  {
    label: "페르세우스자리",
    fame: 1,
    tip: "카시오페이아와 마차부 사이. 8월 페르세우스자리 유성우의 고향이에요.",
  },
  {
    label: "남십자자리",
    fame: 3,
    tip: "작지만 또렷한 십자가. 긴 쪽을 네 배 반 늘이면 남쪽 하늘의 중심(남극)이에요.",
  },
  {
    label: "센타우루스자리",
    fame: 2,
    tip: "아주 밝은 두 별(알파 센타우리·하다르)이 남십자를 가리켜요.",
  },
  {
    label: "용골자리",
    fame: 1,
    tip: "밤하늘에서 두 번째로 밝은 별 카노푸스가 이 배의 바닥에 있어요.",
  },
];

// 밝은 별 이야기 (카탈로그의 한글 이름)
export const STAR_STORIES: Record<string, string> = {
  시리우스:
    "밤하늘에서 가장 밝은 별이에요. 옛 이집트 사람들은 이 별이 새벽에 처음 보이는 날로 나일강 홍수를 알았대요.",
  카노푸스:
    "두 번째로 밝은 별. 우리나라에선 남쪽 지평선에 아주 잠깐 보여 '노인성'이라 부르며 보면 오래 산다고 했어요.",
  "알파 센타우리":
    "해 다음으로 가장 가까운 별이에요. 사실은 별 세 개가 함께 도는 가족이에요.",
  아크투루스:
    "주황빛 거인 별. 1933년 시카고 박람회 개막 때 이 별빛을 모아 불을 켰다는 이야기가 있어요.",
  직녀성:
    "칠월칠석의 직녀. 1만 2천 년쯤 뒤에는 지구 자전축이 돌아 이 별이 북극성이 돼요.",
  카펠라:
    "노랗게 빛나는 카펠라는 사실 해와 비슷한 노란 거인 별 두 개가 꼭 붙어 도는 쌍둥이예요.",
  리겔: "푸르게 빛나는 아주 뜨거운 거인 별. 해보다 수만 배 밝아요.",
  프로키온: "작은개자리의 으뜸별. '개보다 먼저(뜨는 별)'라는 뜻이에요.",
  베텔게우스:
    "붉은 초거성. 언젠가 초신성으로 터지면 낮에도 보일 만큼 밝아질 거예요.",
  견우성: "칠월칠석의 견우. 아주 빨리 돌아서 적도가 불룩한 럭비공 모양이에요.",
  알데바란:
    "황소의 붉은 눈. 사실 앞에 보이는 히아데스 성단보다 두 배쯤 가까이 있어요.",
  안타레스:
    "'화성의 맞수'라는 뜻. 붉은빛이 화성과 닮아서, 둘이 가까이 오면 누가 더 붉은지 겨뤄요.",
  스피카: "처녀자리의 이삭. 서로 아주 가까이 붙어 도는 뜨거운 별 두 개예요.",
  폴룩스: "쌍둥이 중 더 밝은 쪽. 행성을 거느린 것이 확인된 별이에요.",
  포말하우트:
    "'물고기의 입'이라는 뜻. 가을 남쪽 하늘에 외로이 빛나는 밝은 별이에요.",
  데네브:
    "백조의 꼬리. 수천 광년 떨어져 있는데도 이만큼 밝은, 엄청나게 큰 별이에요.",
  레굴루스: "'작은 왕'이라는 뜻. 너무 빨리 돌아 납작해진 별이에요.",
  북극성: "밤새 거의 움직이지 않는 별. 아주 밝지는 않지만 늘 북쪽을 알려 줘요.",
};

// ── 리포트 ────────────────────────────────────────────────────────

export type SkyLevel = 0 | 1 | 2 | 3 | 4; // 낮, 시민 박명, 항해 박명, 천문 박명, 깜깜한 밤

export const skyLevelOf = (sunAlt: number): SkyLevel =>
  sunAlt > SUN_HORIZON
    ? 0
    : sunAlt > -6
      ? 1
      : sunAlt > -12
        ? 2
        : sunAlt > -18
          ? 3
          : 4;

export interface TimelineSlot {
  t: number;
  level: SkyLevel;
  moon: number; // 떠 있는 달의 밝기 (빛나는 비율, 지면 0)
}

export interface Window {
  from: number;
  to: number;
}

export interface PlanetReport {
  key: PlanetName;
  name: string;
  visible: boolean;
  why?: string; // 안 보이는 까닭
  rise: number | null;
  set: number | null;
  window: Window | null; // 해가 진 뒤(-6° 아래) 고도 5° 위에 있는 동안
  best: { t: number; altDeg: number; azDeg: number } | null;
  magnitude: number;
  constellation: string | null;
  elongationDeg: number;
}

export interface FeaturedConstellation {
  label: string;
  tip: string;
  season: string;
  altDeg: number;
  azDeg: number;
  sketch: Sketch;
}

export interface Sketch {
  lines: [number, number][][]; // -1~1 (오른쪽 +x, 위 +y)
  stars: { x: number; y: number; mag: number }[];
}

export interface ShowerReport {
  shower: Shower;
  peak: number; // 극대 시각
  daysFromPeak: number;
  active: boolean;
  radiantRise: number | null;
  best: { t: number; altDeg: number } | null;
  perHour: number; // 어두운 곳에서 한 시간에 볼 수 있는 어림
}

export interface Approach {
  a: string;
  b: string;
  t: number;
  sepDeg: number;
}

export interface StarStory {
  name: string;
  text: string;
  altDeg: number;
  azDeg: number;
  mag: number;
  lightYears: number | null;
}

export interface TonightReport {
  place: Place;
  year: number;
  month: number;
  day: number;
  start: number; // 그날 정오
  end: number; // 다음 날 정오
  viewTime: number;
  sun: {
    set: number | null;
    rise: number | null;
    civilDusk: number | null;
    nauticalDusk: number | null;
    astroDusk: number | null;
    astroDawn: number | null;
    nauticalDawn: number | null;
    civilDawn: number | null;
    mode: "normal" | "midnightSun" | "polarNight" | "noDark";
  };
  timeline: TimelineSlot[];
  darkMinutes: number;
  goodWindow: (Window & { kind: "dark" | "twilight" | "moonlit" }) | null;
  moon: {
    phaseDeg: number;
    lit: number;
    ageDays: number;
    name: string;
    waxing: boolean;
    events: Crossing[];
    interference: number; // 0 달빛 없음 ~ 1 밤새 보름달
    constellation: string | null;
    nextFull: number | null;
    nextNew: number | null;
  };
  planets: PlanetReport[];
  constellations: FeaturedConstellation[];
  showers: ShowerReport[];
  nextShower: ShowerReport | null;
  tonightApproaches: Approach[];
  upcomingApproaches: Approach[];
  starStory: StarStory | null;
  score: number; // 별 보기 좋은 정도 1~5
  headline: string;
}

interface Sample {
  t: number;
  frame: HorizontalFrame;
  sun: Vec;
  sunAlt: number;
  moon: Vec;
  moonAlt: number;
  planets: Vec[];
  planetAlts: number[];
}

const NORTH_SEASONS = ["겨울", "봄", "여름", "가을"];

// 별자리 가운데 적경으로 "북반구 저녁에 잘 보이는 계절" (남반구는 계절이 반대)
export const seasonOf = (center: Vec, latDeg: number) => {
  const raH = wrap360(Math.atan2(center[1], center[0]) / D) / 15;
  const k = Math.floor(wrap360((raH - 4) * 15) / 90);

  return `${NORTH_SEASONS[(k + (latDeg < 0 ? 2 : 0)) % 4]} 별자리`;
};

// 별자리를 그 자리에서 올려다본 모습 그대로 (위가 천정 쪽)
export const sketchOf = (
  parts: DrawConstellation[],
  frame: HorizontalFrame,
) => {
  const c = constellationCenter(parts);
  const z = frame.zenith;
  const k = dot(z, c);
  const raw = [0, 1, 2].map((i) => z[i] - k * c[i]);
  const up =
    Math.hypot(raw[0], raw[1], raw[2]) < 1e-3 ? frame.north : norm(raw);
  const right = cross(c, up);

  const proj = (v: Vec): [number, number] => {
    const w = 1 / Math.max(0.2, dot(v, c));

    return [dot(v, right) * w, dot(v, up) * w];
  };

  const stars = uniqueStars(parts);
  const pts = stars.map(proj);
  const scale =
    Math.max(...pts.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y)))) || 1;
  const fit = ([x, y]: [number, number]): [number, number] => [
    x / scale,
    y / scale,
  ];

  return {
    lines: parts.map((p) => p.stars.map((v) => fit(proj(v)))),
    stars: stars.map((v, i) => {
      const [x, y] = fit(pts[i]);
      const known = STARS.find((s) => dot(s.vector, v) > 0.99999);

      return { x, y, mag: known?.mag ?? 4.5 };
    }),
  };
};

// 연속으로 조건을 만족하는 가장 긴 구간
const longestRun = (samples: Sample[], ok: (s: Sample) => boolean) => {
  let best: Window | null = null;
  let from: number | null = null;

  samples.forEach((s, i) => {
    const last = i === samples.length - 1;

    if (ok(s) && from === null) {
      from = s.t;
    }

    if (from !== null && (!ok(s) || last)) {
      const to = ok(s) ? s.t : samples[i - 1].t;

      if (!best || to - from > best.to - best.from) {
        best = { from, to };
      }

      from = null;
    }
  });

  return best as Window | null;
};

export interface ReportInput {
  place: Place;
  year: number;
  month: number;
  day: number;
  time?: string | null; // "21:30" — 12시 전이면 다음 날 새벽으로 본다
}

export const buildReport = (input: ReportInput): TonightReport => {
  const { place, year, month, day } = input;
  const observer: Observer = { latDeg: place.latDeg, lonDeg: place.lonDeg };
  const start = localToUtc(year, month, day, 12, 0, place.tz);
  const end = localToUtc(year, month, day + 1, 12, 0, place.tz);

  // 5분마다 하늘을 잰다
  const samples: Sample[] = [];

  for (let t = start; t <= end; t += STEP) {
    const frame = frameAt(t, observer);
    const sun = sunAt(t);
    const moon = moonAt(t, observer);
    const planets = PLANETS.map(([key]) => planetAt(key, t));
    samples.push({
      t,
      frame,
      sun,
      sunAlt: altOf(sun, frame),
      moon,
      moonAlt: altOf(moon, frame),
      planets,
      planetAlts: planets.map((v) => altOf(v, frame)),
    });
  }

  const times = samples.map((s) => s.t);
  const sunAltAt = (t: number) => altOf(sunAt(t), frameAt(t, observer));
  const sunAlts = samples.map((s) => s.sunAlt);

  const sunCross = (h0: number) => {
    const c = findCrossings(times, sunAlts, sunAltAt, h0);
    const down = c.find((x) => !x.rising) ?? null;
    const up = c.find((x) => x.rising && (!down || x.t > down.t)) ?? null;

    return [down?.t ?? null, up?.t ?? null] as const;
  };

  const [set, rise] = sunCross(SUN_HORIZON);
  const [civilDusk, civilDawn] = sunCross(-6);
  const [nauticalDusk, nauticalDawn] = sunCross(-12);
  const [astroDusk, astroDawn] = sunCross(-18);
  const minSun = Math.min(...sunAlts);
  const maxSun = Math.max(...sunAlts);
  const mode =
    minSun > SUN_HORIZON
      ? "midnightSun"
      : maxSun < SUN_HORIZON
        ? "polarNight"
        : minSun > -18
          ? "noDark"
          : "normal";

  // 보는 시각: 정했으면 그때, 아니면 밤 9시 (그때 하늘이 아직 밝으면 해가 가장 낮은 때)
  const viewTime = (() => {
    const m = input.time?.match(/^(\d{1,2}):(\d{2})$/);

    if (m) {
      const h = Number(m[1]);

      return localToUtc(
        year,
        month,
        h < 12 ? day + 1 : day,
        h,
        Number(m[2]),
        place.tz,
      );
    }

    const nine = localToUtc(year, month, day, 21, 0, place.tz);

    if (sunAltAt(nine) < -12) {
      return nine;
    }

    return samples.reduce((a, b) => (b.sunAlt < a.sunAlt ? b : a)).t;
  })();

  // 달
  const phaseAtView = moonPhaseDeg(viewTime);
  const litAtView = moonLitFraction(viewTime);
  const moonAltAt = (t: number) =>
    altOf(moonAt(t, observer), frameAt(t, observer));
  const moonEvents = findCrossings(
    times,
    samples.map((s) => s.moonAlt),
    moonAltAt,
    MOON_HORIZON,
  );
  const litAt = samples.map((s) => (1 - dot(s.sun, s.moon)) / 2);
  const moonUp = (i: number) => samples[i].moonAlt > MOON_HORIZON;

  // 깜깜한 동안(없으면 항해 박명 아래) 달빛이 얼마나 하늘을 밝히나
  const darkLimit = mode === "normal" ? -18 : -12;
  const darkIdx = samples
    .map((s, i) => (s.sunAlt < darkLimit ? i : -1))
    .filter((i) => i >= 0);
  const interference = darkIdx.length
    ? darkIdx.reduce(
        (sum, i) =>
          sum +
          (moonUp(i)
            ? litAt[i] * Math.min(1, 0.4 + samples[i].moonAlt / 30)
            : 0),
        0,
      ) / darkIdx.length
    : 0;

  // 별 보기 좋은 때: 깜깜하고 달이 없는(또는 아주 가는) 가장 긴 구간
  const moonQuiet = (s: Sample, i: number) =>
    s.moonAlt < MOON_HORIZON || litAt[i] < 0.12;
  const idx = new Map(samples.map((s, i) => [s, i]));
  const darkRun = longestRun(
    samples,
    (s) => s.sunAlt < -18 && moonQuiet(s, idx.get(s)!),
  );
  const twilightRun = darkRun
    ? null
    : longestRun(samples, (s) => s.sunAlt < -12 && moonQuiet(s, idx.get(s)!));
  const moonlitRun =
    darkRun || twilightRun ? null : longestRun(samples, (s) => s.sunAlt < -12);
  const goodWindow = darkRun
    ? { ...darkRun, kind: "dark" as const }
    : twilightRun
      ? { ...twilightRun, kind: "twilight" as const }
      : moonlitRun
        ? { ...moonlitRun, kind: "moonlit" as const }
        : null;

  // 시간 막대: 해 지기 조금 전부터 해 뜬 조금 뒤까지 10분마다
  const barFrom = set ? set - HOUR : start;
  const barTo = rise ? rise + HOUR : end;
  const timeline: TimelineSlot[] = samples
    .filter((s, i) => i % 2 === 0 && s.t >= barFrom && s.t <= barTo)
    .map((s) => {
      const i = idx.get(s)!;

      return {
        t: s.t,
        level: skyLevelOf(s.sunAlt),
        moon: s.moonAlt > MOON_HORIZON ? litAt[i] : 0,
      };
    });

  // 행성
  const planets: PlanetReport[] = PLANETS.map(([key, name], p) => {
    const altAt = (t: number) => altOf(planetAt(key, t), frameAt(t, observer));
    const c = findCrossings(
      times,
      samples.map((s) => s.planetAlts[p]),
      altAt,
      POINT_HORIZON,
    );
    const seen = samples.filter((s) => s.sunAlt < -6 && s.planetAlts[p] > 5);
    // 가장 좋은 때는 하늘이 충분히 어두울 때(-12° 아래) 중에서 고른다. 그런 때가 없으면 박명 때라도
    const darkSeen = seen.filter((s) => s.sunAlt < -12);
    const pool = darkSeen.length ? darkSeen : seen;
    const bestS = pool.length
      ? pool.reduce((a, b) => (b.planetAlts[p] > a.planetAlts[p] ? b : a))
      : null;
    const atView = planetAt(key, viewTime);
    const elongationDeg = separationDeg(atView, sunAt(viewTime));
    const darkSamples = samples.filter((s) => s.sunAlt < -6);

    return {
      key,
      name,
      visible: seen.length >= 3, // 15분은 넘게 보여야 친다
      why:
        elongationDeg < 15
          ? "해와 너무 가까이 있어 햇빛에 묻혀요"
          : darkSamples.every((s) => s.planetAlts[p] <= 5)
            ? "밤에는 지평선 아래에 있어요"
            : "해 진 뒤 너무 잠깐, 너무 낮게 떠요",
      rise: c.find((x) => x.rising)?.t ?? null,
      set: c.find((x) => !x.rising)?.t ?? null,
      window: seen.length
        ? { from: seen[0].t, to: seen[seen.length - 1].t }
        : null,
      best: bestS
        ? {
            t: bestS.t,
            altDeg: bestS.planetAlts[p],
            azDeg: azOf(bestS.planets[p], bestS.frame),
          }
        : null,
      magnitude: planetMagnitude(key, viewTime),
      constellation: constellationAt(atView),
      elongationDeg,
    };
  });

  // 하늘 한가운데의 별자리 (보는 시각 기준)
  const viewFrame = frameAt(viewTime, observer);
  const featuredAll = FAMOUS.map((f) => {
    const parts = constellationParts(f.label);
    const center = constellationCenter(parts);

    return {
      ...f,
      parts,
      center,
      altDeg: altOf(center, viewFrame),
      azDeg: azOf(center, viewFrame),
    };
  }).sort(
    (a, b) =>
      Math.min(b.altDeg, 50) +
      8 * b.fame -
      (Math.min(a.altDeg, 50) + 8 * a.fame),
  );
  const featured = featuredAll.filter((f) => f.altDeg > 25).slice(0, 3);
  const constellations: FeaturedConstellation[] = (
    featured.length >= 2
      ? featured
      : [...featuredAll]
          .sort((a, b) => b.altDeg - a.altDeg)
          .filter((f) => f.altDeg > 5)
          .slice(0, 2)
  ).map((f) => ({
    label: f.label,
    tip: f.tip,
    season: seasonOf(f.center, place.latDeg),
    altDeg: f.altDeg,
    azDeg: f.azDeg,
    sketch: sketchOf(f.parts, viewFrame),
  }));

  // 유성우
  const midnight = localToUtc(year, month, day + 1, 0, 0, place.tz);

  const showerReport = (shower: Shower, ref: number): ShowerReport => {
    const radiant = fromRaDec(shower.raDeg, shower.decDeg);
    const days = daysFromPeak(shower, ref);
    const alts = samples.map((s) => altOf(radiant, s.frame));
    const c = findCrossings(
      times,
      alts,
      (t) => altOf(radiant, frameAt(t, observer)),
      0,
    );
    const darkI = samples
      .map((s, i) => (s.sunAlt < -12 ? i : -1))
      .filter((i) => i >= 0);
    const bestI = darkI.length
      ? darkI.reduce((a, b) => (alts[b] > alts[a] ? b : a))
      : -1;
    const best =
      bestI >= 0 && alts[bestI] > 0
        ? { t: samples[bestI].t, altDeg: alts[bestI] }
        : null;
    const moonFactor = bestI >= 0 && moonUp(bestI) ? 1 - 0.7 * litAt[bestI] : 1;
    const perHour = best
      ? shower.zhr *
        10 ** (-shower.fade * Math.abs(days)) *
        Math.sin(best.altDeg * D) *
        moonFactor
      : 0;

    return {
      shower,
      peak: ref - days * DAY,
      daysFromPeak: days,
      // 활동 기간 안이어도 극대에서 멀어 한 시간에 2개도 안 되면 빼 둔다
      active:
        days >= -shower.before &&
        days <= shower.after &&
        shower.zhr * 10 ** (-shower.fade * Math.abs(days)) >= 2,
      radiantRise: c.find((x) => x.rising)?.t ?? null,
      best,
      perHour,
    };
  };

  const showers = SHOWERS.map((s) => showerReport(s, midnight))
    .filter((r) => r.active)
    .sort((a, b) => Math.abs(a.daysFromPeak) - Math.abs(b.daysFromPeak));
  const upcoming = SHOWERS.map((s) => ({
    s,
    days: -daysFromPeak(s, midnight),
  }))
    .map(({ s, days }) => ({ s, days: days <= 0 ? days + 365.25 : days }))
    .sort((a, b) => a.days - b.days)[0];
  const nextShower = showers.length
    ? null
    : {
        ...showerReport(upcoming.s, midnight),
        peak: midnight + upcoming.days * DAY,
        daysFromPeak: -upcoming.days,
      };

  // 오늘 밤 가까이 붙는 것들 (해가 진 뒤 둘 다 떠 있을 때)
  const brightStars = STARS.filter((s) => s.mag < 1.6 && s.name);
  const tonightApproaches: Approach[] = [];
  const nightIdx = samples
    .map((s, i) => (s.sunAlt < -6 ? i : -1))
    .filter((i) => i >= 0 && i % 2 === 0);

  const closest = (
    a: string,
    b: string,
    va: (s: Sample) => Vec,
    vb: (s: Sample) => Vec,
    up: (s: Sample) => boolean,
    limit: number,
  ) => {
    let best: Approach | null = null;

    for (const i of nightIdx) {
      const s = samples[i];

      if (!up(s)) {
        continue;
      }

      const sep = separationDeg(va(s), vb(s));

      if (sep < limit && (!best || sep < best.sepDeg)) {
        best = { a, b, t: s.t, sepDeg: sep };
      }
    }

    if (best) {
      tonightApproaches.push(best);
    }
  };

  PLANETS.forEach(([, name], p) => {
    closest(
      "달",
      name,
      (s) => s.moon,
      (s) => s.planets[p],
      (s) => s.moonAlt > 3 && s.planetAlts[p] > 3,
      6,
    );

    for (let q = p + 1; q < PLANETS.length; q++) {
      closest(
        name,
        PLANETS[q][1],
        (s) => s.planets[p],
        (s) => s.planets[q],
        (s) => s.planetAlts[p] > 3 && s.planetAlts[q] > 3,
        5,
      );
    }

    for (const star of brightStars) {
      closest(
        name,
        star.name!,
        (s) => s.planets[p],
        () => star.vector,
        (s) => s.planetAlts[p] > 3 && altOf(star.vector, s.frame) > 3,
        2.5,
      );
    }
  });

  for (const star of brightStars) {
    closest(
      "달",
      star.name!,
      (s) => s.moon,
      () => star.vector,
      (s) => s.moonAlt > 3 && altOf(star.vector, s.frame) > 3,
      3,
    );
  }

  tonightApproaches.sort((a, b) => a.sepDeg - b.sepDeg);

  // 앞으로 2주: 달이 행성 곁을 지나는 날 (지구 중심 기준, 2시간 간격의 가장 가까운 때)
  const upcomingApproaches: Approach[] = [];

  PLANETS.forEach(([key, name]) => {
    let prev = Infinity;
    let prev2 = Infinity;
    let prevT = 0;

    for (let t = end; t < end + 14 * DAY; t += 2 * HOUR) {
      const sep = separationDeg(moonGeoAt(t), planetAt(key, t));

      if (prev < prev2 && prev <= sep && prev < 4) {
        const elong = separationDeg(planetAt(key, prevT), sunAt(prevT));

        if (elong > 20) {
          upcomingApproaches.push({ a: "달", b: name, t: prevT, sepDeg: prev });
        }
      }

      prev2 = prev;
      prev = sep;
      prevT = t;
    }
  });

  upcomingApproaches.sort((a, b) => a.t - b.t);

  // 밝은 별 이야기: 보는 시각에 15° 넘게 떠 있는 이야기 있는 별 중 가장 밝은 별
  const storyStar = STARS.filter(
    (s) => s.name && STAR_STORIES[s.name] && altOf(s.vector, viewFrame) > 15,
  ).sort((a, b) => a.mag - b.mag)[0];
  const starStory: StarStory | null = storyStar
    ? {
        name: storyStar.name!,
        text: STAR_STORIES[storyStar.name!],
        altDeg: altOf(storyStar.vector, viewFrame),
        azDeg: azOf(storyStar.vector, viewFrame),
        mag: storyStar.mag,
        lightYears: distanceOf(storyStar.hr)?.lightYears ?? null,
      }
    : null;

  const darkMinutes = samples.filter((s) => s.sunAlt < -18).length * 5;
  const moonReport = {
    phaseDeg: phaseAtView,
    lit: litAtView,
    ageDays: (phaseAtView / 360) * SYNODIC_MONTH,
    name: moonPhaseName(phaseAtView),
    waxing: phaseAtView < 180,
    events: moonEvents,
    interference,
    constellation: constellationAt(moonGeoAt(viewTime)),
    nextFull: nextPhase(start, 180),
    nextNew: nextPhase(start, 0),
  };

  const visiblePlanets = planets.filter((p) => p.visible);
  const goodMinutes = goodWindow
    ? (goodWindow.to - goodWindow.from) / MINUTE
    : 0;
  const score =
    mode === "midnightSun"
      ? 1
      : goodWindow?.kind !== "dark"
        ? goodWindow?.kind === "twilight"
          ? 2
          : 1
        : goodMinutes >= 360
          ? 5
          : goodMinutes >= 240
            ? 4
            : goodMinutes >= 120
              ? 3
              : 2;

  return {
    place,
    year,
    month,
    day,
    start,
    end,
    viewTime,
    sun: {
      set,
      rise,
      civilDusk,
      nauticalDusk,
      astroDusk,
      astroDawn,
      nauticalDawn,
      civilDawn,
      mode,
    },
    timeline,
    darkMinutes,
    goodWindow,
    moon: moonReport,
    planets,
    constellations,
    showers,
    nextShower,
    tonightApproaches: tonightApproaches.slice(0, 4),
    upcomingApproaches: upcomingApproaches.slice(0, 4),
    starStory,
    score,
    headline: headlineOf({
      mode,
      moonEvents,
      interference,
      lit: litAtView,
      goodWindow,
      astroDusk,
      astroDawn,
      planetCount: visiblePlanets.length,
    }),
  };
};

// 오늘 밤 한 줄 요약
const headlineOf = (o: {
  mode: TonightReport["sun"]["mode"];
  moonEvents: Crossing[];
  interference: number;
  lit: number;
  goodWindow: TonightReport["goodWindow"];
  astroDusk: number | null;
  astroDawn: number | null;
  planetCount: number;
}) => {
  if (o.mode === "midnightSun") {
    return "해가 지지 않는 밤(백야)이에요. 오늘은 별 대신 밤의 햇살을 즐겨요";
  }

  if (o.mode === "polarNight") {
    return "해가 뜨지 않는 긴 밤(극야)이에요. 하루 종일 별을 볼 수 있어요";
  }

  if (o.mode === "noDark") {
    return "밤새 하늘이 아주 깜깜해지지는 않아요. 밝은 별과 행성을 찾아봐요";
  }

  if (o.interference < 0.05) {
    return o.lit < 0.15
      ? "달 없는 깜깜한 밤이에요. 별 보기 딱 좋아요!"
      : "달이 밤하늘을 비키는 밤이에요. 별 보기 딱 좋아요!";
  }

  const moonRise = o.moonEvents.find((e) => e.rising)?.t ?? null;
  const moonSet = o.moonEvents.find((e) => !e.rising)?.t ?? null;
  const dusk = o.astroDusk ?? 0;
  const dawn = o.astroDawn ?? Infinity;

  if (o.lit > 0.85 && o.interference > 0.5) {
    return "밝은 달이 밤새 떠 있어요. 별보다 달 구경하기 좋은 밤이에요";
  }

  if (
    moonSet !== null &&
    moonSet > dusk &&
    moonSet < dawn &&
    (moonRise === null || moonRise < moonSet)
  ) {
    return "달이 밤중에 져요. 달이 지고 나면 별이 쏟아져요";
  }

  if (moonRise !== null && moonRise > dusk && moonRise < dawn) {
    return "달이 늦게 떠서, 초저녁에 별 보기 좋은 밤이에요";
  }

  return o.planetCount > 0
    ? "달빛이 조금 있지만, 밝은 별과 행성은 잘 보여요"
    : "달빛이 조금 있지만, 밝은 별은 잘 보여요";
};

// 오늘 밤 시각들이 같은 날인지 판단할 때 쓰는 기준일 (그날의 일)
export const baseDayOf = (report: TonightReport) =>
  localParts(report.start, report.place.tz).day;
