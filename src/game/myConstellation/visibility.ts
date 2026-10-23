import type { Place } from "@/game/tonight/places";
import type { Point3D } from "@/scripts/hash/types";
import type { Observer } from "@/search/utils/ephemeris";
import { STAR_BY_HR } from "@/game/myConstellation/shape";
import { STARS } from "@/game/sky/catalog";
import {
  altOf,
  azOf,
  directionName,
  fingersLabel,
  fistsLabel,
  frameAt,
  moonAt,
  separationDeg,
  sunAt,
} from "@/game/tonight/report";
import { localParts, localToUtc } from "@/game/tonight/time";
import { constellationAt } from "@/search/utils/constellationBounds";

// 나만의 별자리를 실제 하늘에 놓아 본다: 그 시각·장소에서 높이·방위, 가장 잘 보이는 달·시각, 찾는 길잡이.
// 해·별의 위치는 오늘 밤 내 하늘과 같은 계산(ephemeris.ts, J2000 → 그 시각 수평 좌표)을 쓴다.
// "밤"의 시각은 오늘 밤 내 하늘과 같은 규칙: 고른 날짜의 저녁 5시부터 다음 날 아침 7시까지, 정오 전 시각은 다음 날 새벽이다.

const D = Math.PI / 180;
const MINUTE = 60000;

const wrap360 = (deg: number) => ((deg % 360) + 360) % 360;
const wrap180 = (deg: number) => wrap360(deg + 180) - 180;

// 해가 이보다 낮으면 별 보기 좋은 밤으로 친다 (항해 박명이 끝날 무렵, 3등급 별이 다 나온다)
export const DARK_SUN_ALT = -12;
// 밤을 훑는 범위와 간격
const NIGHT_FROM_HOUR = 17;
const NIGHT_HOURS = 14;
const NIGHT_STEP_MIN = 10;

// ── 하늘 밝기: 맨눈으로 보이는 가장 어두운 별 등급 ─────────────────────

export interface SkyDarkness {
  limit: number; // 머리 위 하늘에서 보이는 가장 어두운 별 등급
  title: string;
  note: string;
  lightPollution: number; // 하늘 그림의 지평선 광해 (drawSky)
}

export const DARKNESS: SkyDarkness[] = [
  {
    limit: 3,
    title: "대도시 한가운데",
    note: "서울 도심에선 3등급 별까지 보이면 잘 보이는 날이에요",
    lightPollution: 0.85,
  },
  {
    limit: 4,
    title: "도시 변두리·작은 도시",
    note: "밝은 별자리의 뼈대는 다 보여요",
    lightPollution: 0.5,
  },
  {
    limit: 5,
    title: "불빛 적은 시골",
    note: "은하수가 희미하게 보이기 시작해요",
    lightPollution: 0.22,
  },
  {
    limit: 6,
    title: "아주 어두운 곳",
    note: "별 지도의 별이 거의 다 보여요",
    lightPollution: 0.06,
  },
];

// 큰 도시는 대도시 하늘, 별 보기 명소는 아주 어두운 하늘, 나머지(작은 도시·지도에서 고른 곳)는 도시 변두리로 어림한다
const BIG_CITIES = new Set([
  "서울",
  "인천",
  "대전",
  "대구",
  "광주",
  "부산",
  "도쿄",
  "베이징",
  "타이베이",
  "방콕",
  "싱가포르",
  "델리",
  "두바이",
  "런던",
  "파리",
  "로마",
  "카이로",
  "나이로비",
  "뉴욕",
  "로스앤젤레스",
  "밴쿠버",
  "멕시코시티",
  "부에노스아이레스",
  "시드니",
  "오클랜드",
  "케이프타운",
]);
const DARK_SITES = ["영양", "마우나케아", "아타카마", "울루루", "테카포"];

export const defaultDarkness = (place: Pick<Place, "name">): number =>
  BIG_CITIES.has(place.name)
    ? 3
    : DARK_SITES.some((d) => place.name.includes(d))
      ? 6
      : 4;

export const darknessOf = (limit: number) =>
  DARKNESS.find((d) => d.limit === limit) ?? DARKNESS[1];

// 지평선 가까이는 공기를 비스듬히 오래 지나 별이 흐려진다 (1등급 ≈ 고도 10°). drawSky와 같은 식
export const effectiveLimit = (limit: number, altDeg: number) =>
  limit - 0.25 * (1 / Math.max(0.05, Math.sin(Math.max(0, altDeg) * D)) - 1);

// ── 모양 ─────────────────────────────────────────────────────────

const norm = (v: number[]): Point3D => {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;

  return [v[0] / n, v[1] / n, v[2] / n];
};

// 별들의 가운데 방향과, 가운데에서 가장 먼 별까지 각 (°), 가장 먼 두 별 사이 각 (°)
export const shapeGeometry = (vectors: Point3D[]) => {
  const center = norm(
    vectors.reduce(
      (s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]],
      [0, 0, 0],
    ),
  );
  let radiusDeg = 0;
  let spanDeg = 0;

  vectors.forEach((a, i) => {
    radiusDeg = Math.max(radiusDeg, separationDeg(a, center));

    for (let j = i + 1; j < vectors.length; j++) {
      spanDeg = Math.max(spanDeg, separationDeg(a, vectors[j]));
    }
  });

  return { center, radiusDeg, spanDeg };
};

export const decOf = (v: Point3D) =>
  Math.asin(Math.max(-1, Math.min(1, v[2]))) / D;
export const raOf = (v: Point3D) => wrap360(Math.atan2(v[1], v[0]) / D);

// 하루 중 가장 높이 뜰 때(남중)와 가장 낮을 때의 고도. 0° 아래로만 다니면 그곳에선 아예 뜨지 않는다
export const culmination = (center: Point3D, latDeg: number) => {
  const dec = decOf(center);
  const maxAlt = 90 - Math.abs(latDeg - dec);
  const minAlt = Math.abs(latDeg + dec) - 90;

  return { maxAlt, minAlt, neverRises: maxAlt <= 0, neverSets: minAlt > 0 };
};

// 별자리가 걸친 진짜 별자리 구역들 (별이 많은 순)
export const homeConstellations = (vectors: Point3D[]) => {
  const count = new Map<string, number>();

  for (const v of vectors) {
    const label = constellationAt(v);

    if (label) {
      count.set(label, (count.get(label) ?? 0) + 1);
    }
  }

  return [...count]
    .sort((a, b) => b[1] - a[1])
    .map(([label, n]) => ({ label, n }));
};

// ── 그 시각의 모습 ──────────────────────────────────────────────────

export interface StarPose {
  hr: string;
  name?: string;
  mag: number;
  altDeg: number;
  azDeg: number;
  visible: boolean; // 그 하늘 밝기·높이에서 맨눈으로 보일 만한지
}

export interface SkyPose {
  t: number;
  centerAlt: number;
  centerAz: number;
  sunAlt: number;
  moonGlow: number; // 달빛이 하늘을 밝히는 정도 0~1 (drawSky와 같은 식)
  stars: StarPose[];
  above: number; // 지평선 위 별 수
  visible: number; // 보일 만한 별 수
}

// 달빛 세기 0~1. 밝은 달이 떠 있으면 어두운 별이 묻힌다 (보름달이 높이 뜨면 1.5등급쯤)
export const moonGlowAt = (t: number, observer: Observer) => {
  const frame = frameAt(t, observer);
  const sun = sunAt(t);
  const moon = moonAt(t, observer);
  const moonAlt = altOf(moon, frame);
  const moonLit =
    (1 - (sun[0] * moon[0] + sun[1] * moon[1] + sun[2] * moon[2])) / 2;

  return moonAlt > 0 ? moonLit * Math.min(1, Math.sin(moonAlt * D) * 3) : 0;
};

export const poseAt = (
  hrs: string[],
  t: number,
  observer: Observer,
  limit: number,
): SkyPose => {
  const frame = frameAt(t, observer);
  const vectors = hrs.map((hr) => STAR_BY_HR.get(hr)!.vector);
  const { center } = shapeGeometry(vectors);
  const sunAlt = altOf(sunAt(t), frame);
  // 해가 덜 졌으면 하늘이 밝아 어두운 별이 지워진다 (박명 동안 한계 등급이 크게 떨어진다)
  const twilight = Math.max(0, Math.min(1, (sunAlt + 18) / 18));
  const moonGlow = moonGlowAt(t, observer);
  const stars = hrs.map((hr, i) => {
    const s = STAR_BY_HR.get(hr)!;
    const altDeg = altOf(vectors[i], frame);

    return {
      hr,
      name: s.name,
      mag: s.mag,
      altDeg,
      azDeg: azOf(vectors[i], frame),
      visible:
        altDeg > 0 &&
        sunAlt < -0.833 &&
        s.mag <=
          effectiveLimit(limit, altDeg) - 4 * twilight ** 2 - 1.5 * moonGlow,
    };
  });

  return {
    t,
    centerAlt: altOf(center, frame),
    centerAz: azOf(center, frame),
    sunAlt,
    moonGlow,
    stars,
    above: stars.filter((s) => s.altDeg > 0).length,
    visible: stars.filter((s) => s.visible).length,
  };
};

// ── 가장 잘 보이는 때 ───────────────────────────────────────────────

export interface BestTime {
  t: number;
  altDeg: number; // 그때 가운데 높이
  azDeg: number;
}

// 그날 밤 (저녁 5시 ~ 다음 날 아침 7시, 해가 -12° 아래인 동안) 별자리 가운데가 가장 높을 때
export const bestOnNight = (
  center: Point3D,
  place: Place,
  year: number,
  month: number,
  day: number,
): BestTime | null => {
  const observer = { latDeg: place.latDeg, lonDeg: place.lonDeg };
  const start = localToUtc(year, month, day, NIGHT_FROM_HOUR, 0, place.tz);
  let best: BestTime | null = null;

  for (let m = 0; m <= NIGHT_HOURS * 60; m += NIGHT_STEP_MIN) {
    const t = start + m * MINUTE;
    const frame = frameAt(t, observer);

    if (altOf(sunAt(t), frame) > DARK_SUN_ALT) {
      continue;
    }

    const altDeg = altOf(center, frame);

    if (!best || altDeg > best.altDeg + 1e-9) {
      best = { t, altDeg, azDeg: azOf(center, frame) };
    }
  }

  return best && best.altDeg > 0 ? best : null;
};

export interface MonthBest {
  year: number;
  month: number;
  best: BestTime | null; // 그달 15일 밤
}

// 고른 달부터 열두 달, 달마다 15일 밤에 가장 잘 보이는 때
export const yearlyBest = (
  center: Point3D,
  place: Place,
  fromYear: number,
  fromMonth: number,
): MonthBest[] =>
  Array.from({ length: 12 }, (_, i) => {
    const k = fromMonth - 1 + i;
    const year = fromYear + Math.floor(k / 12);
    const month = (k % 12) + 1;

    return { year, month, best: bestOnNight(center, place, year, month, 15) };
  });

// 그달에서 달빛이 가장 적은 밤의 가장 잘 보이는 때. 15일로만 정하면 보름 무렵에 걸려 어두운 별이 지워지기 쉽다.
// 달빛이 거의 같으면(하루에 0.003씩 깎는다) 15일에 가까운 날
export const moonlessNight = (
  center: Point3D,
  place: Place,
  year: number,
  month: number,
): BestTime | null => {
  const observer = { latDeg: place.latDeg, lonDeg: place.lonDeg };
  let best: BestTime | null = null;
  let bestScore = Infinity;

  for (let day = 1; day <= 28; day++) {
    const b = bestOnNight(center, place, year, month, day);

    if (!b) {
      continue;
    }

    const score = moonGlowAt(b.t, observer) + Math.abs(day - 15) * 0.003;

    if (score < bestScore) {
      bestScore = score;
      best = b;
    }
  }

  return best;
};

// 저녁 9시에서 몇 시간 떨어졌는지 (새벽은 다음 날로 센다)
export const hoursFromEvening = (t: number, tz: string) => {
  const p = localParts(t, tz);
  const h = p.hour + p.minute / 60;

  return Math.abs((h < 12 ? h + 24 : h) - 21);
};

// 가장 높이 뜨는 달. 높이가 비슷하면(시간당 2°로 친다) 저녁 9시에 가까운, 보기 편한 때를 고른다
export const pickBestMonth = (months: MonthBest[], tz: string) => {
  let best: MonthBest | null = null;
  let bestScore = -Infinity;

  for (const m of months) {
    if (!m.best) {
      continue;
    }

    const score = m.best.altDeg - 2 * hoursFromEvening(m.best.t, tz);

    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }

  return best;
};

// ── 찾아가는 말 ────────────────────────────────────────────────────

// 바라보는 쪽에서 본 상대 방향: 방위가 커지면 오른쪽, 고도가 높으면 위
export const relativeDirection = (
  from: { altDeg: number; azDeg: number },
  to: { altDeg: number; azDeg: number },
) => {
  const dx =
    wrap180(to.azDeg - from.azDeg) *
    Math.cos(((from.altDeg + to.altDeg) / 2) * D);
  const dy = to.altDeg - from.altDeg;

  if (Math.hypot(dx, dy) < 1e-6) {
    return "바로 그 자리";
  }

  const words = [
    "오른쪽",
    "오른쪽 위",
    "위",
    "왼쪽 위",
    "왼쪽",
    "왼쪽 아래",
    "아래",
    "오른쪽 아래",
  ];

  return words[Math.round(wrap360(Math.atan2(dy, dx) / D) / 45) % 8];
};

// 고도 → "높이 떠 있어요"에 들어갈 말
export const heightWord = (altDeg: number) =>
  altDeg >= 75
    ? "머리 꼭대기에"
    : altDeg >= 55
      ? "높이"
      : altDeg >= 30
        ? "중간 높이에"
        : altDeg >= 12
          ? "낮게"
          : "지평선 가까이";

// 각거리를 팔 뻗은 손으로 (손가락 하나 2°, 주먹 하나 10°)
export const handSpan = (deg: number) =>
  deg < 12
    ? fingersLabel(deg)
    : `주먹 ${Math.max(1, Math.round(deg / 10))}개 거리`;

export interface Guide {
  name: string;
  mag: number;
  member: boolean; // 내 별자리의 별인지
  direction: string; // 길잡이에서 내 별자리 가운데 쪽
  sepDeg: number;
}

// 길잡이 별: 내 별자리에 2등급보다 밝은 별이 떠 있으면 그 별, 아니면 가까운 이름난 밝은 별 (지평선 위 10° 넘게)
export const guideStar = (
  hrs: string[],
  t: number,
  observer: Observer,
): Guide | null => {
  const frame = frameAt(t, observer);
  const mine = new Set(hrs);
  const vectors = hrs.map((hr) => STAR_BY_HR.get(hr)!.vector);
  const { center } = shapeGeometry(vectors);
  const centerAt = { altDeg: altOf(center, frame), azDeg: azOf(center, frame) };
  const up = (v: Point3D) => altOf(v, frame) > 10;

  const member = hrs
    .map((hr) => STAR_BY_HR.get(hr)!)
    .filter((s) => s.mag <= 2 && s.name && up(s.vector))
    .sort((a, b) => a.mag - b.mag)[0];

  if (member) {
    return {
      name: member.name!,
      mag: member.mag,
      member: true,
      direction: "",
      sepDeg: separationDeg(member.vector, center),
    };
  }

  const near = STARS.filter(
    (s) =>
      !mine.has(s.hr) &&
      s.mag <= 2 &&
      s.name &&
      up(s.vector) &&
      separationDeg(s.vector, center) < 45,
  )
    .map((s) => ({
      s,
      // 밝을수록 멀어도 낫다: 1등급 차이를 10°로 친다
      score: separationDeg(s.vector, center) + 10 * s.mag,
    }))
    .sort((a, b) => a.score - b.score)[0]?.s;

  if (!near) {
    return null;
  }

  return {
    name: near.name!,
    mag: near.mag,
    member: false,
    direction: relativeDirection(
      { altDeg: altOf(near.vector, frame), azDeg: azOf(near.vector, frame) },
      centerAt,
    ),
    sepDeg: separationDeg(near.vector, center),
  };
};

export interface FindingTip {
  icon: string;
  text: string;
}

// "실제로 찾아보세요" 안내 몇 줄
export const findingTips = (input: {
  pose: SkyPose;
  guide: Guide | null;
  spanDeg: number;
  limit: number;
  placeName: string;
  bestLabel: string | null; // "3월 15일 저녁 9시"처럼, 더 잘 보이는 때
}): FindingTip[] => {
  const { pose, guide, spanDeg, limit, placeName, bestLabel } = input;
  const tips: FindingTip[] = [];
  const hidden = pose.stars.filter((s) => s.altDeg > 0 && !s.visible).length;

  if (pose.sunAlt > -0.833) {
    tips.push({
      icon: "☀️",
      text: `이 시각엔 해가 떠 있어서 별이 보이지 않아요.${bestLabel ? ` ${bestLabel}에 다시 올려다보세요.` : ""}`,
    });
  } else if (pose.centerAlt <= 0) {
    tips.push({
      icon: "🌏",
      text: `이 시각엔 지평선 아래에 있어요.${bestLabel ? ` ${bestLabel}에 가장 잘 보여요.` : ""}`,
    });
  } else {
    tips.push({
      icon: "🧭",
      text: `${directionName(pose.centerAz)} 하늘을 보세요. 지평선에서 ${fistsLabel(pose.centerAlt)}(${Math.round(pose.centerAlt)}°), ${heightWord(pose.centerAlt)} 떠 있어요.`,
    });

    if (pose.sunAlt > DARK_SUN_ALT) {
      tips.push({
        icon: "🌆",
        text: "아직 하늘이 덜 어두워요. 한두 시간 뒤면 별이 더 많이 나와요.",
      });
    }

    if (pose.moonGlow > 0.4) {
      tips.push({
        icon: "🌕",
        text: "밝은 달이 떠 있어 어두운 별이 달빛에 묻혀요. 달이 진 뒤나 그믐 무렵이 더 좋아요.",
      });
    }
  }

  tips.push({
    icon: "✋",
    text: `별자리 크기는 끝에서 끝까지 약 ${Math.round(spanDeg)}°, 팔을 쭉 뻗어 ${handSpan(spanDeg)}예요.`,
  });

  if (guide && pose.centerAlt > 0 && pose.sunAlt <= -0.833) {
    tips.push({
      icon: "⭐",
      text: guide.member
        ? `내 별자리에서 가장 밝은 별은 ${guide.name}(${guide.mag.toFixed(1)}등급)이에요. 그 별부터 찾고 선을 따라가 보세요.`
        : `길잡이는 ${guide.name}(${guide.mag.toFixed(1)}등급)이에요. 거기서 ${guide.direction} 쪽으로 ${handSpan(guide.sepDeg)}에 내 별자리가 있어요.`,
    });
  }

  if (pose.above > 0 && pose.sunAlt <= -0.833) {
    tips.push({
      icon: "💡",
      text:
        hidden === 0
          ? `${placeName} 하늘(${limit}등급까지 보인다고 쳤어요)에서도 떠 있는 별이 모두 보일 만해요.`
          : `${placeName} 하늘에선 ${limit}등급 별까지만 보인다고 쳤어요. 떠 있는 별 ${pose.above}개 중 ${hidden}개는 너무 어두워 안 보일 수 있어요 (점선 동그라미). 어두운 곳으로 가면 다 보여요.`,
    });
  }

  return tips;
};
