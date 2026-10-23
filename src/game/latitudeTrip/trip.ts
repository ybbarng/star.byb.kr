import type { Point3D } from "@/scripts/hash/types";

// 극지방·적도 하늘 여행: 위도와 하늘 시각(지방 항성시)만으로 별의 고도·방위를 구한다.
// 날짜·경도는 쓰지 않는다 — 같은 위도·같은 항성시면 어디서나 같은 하늘이다.
// 별은 J2000 위치 그대로 쓴다 (세차·고유 운동은 무시, 하늘이 도는 모습을 보는 데는 충분하다).

const D = Math.PI / 180;

export interface Equatorial {
  raDeg: number;
  decDeg: number;
}

// 적도좌표 단위 벡터 → 적경·적위 (°)
export const equatorialOf = (v: Point3D): Equatorial => ({
  raDeg: (((Math.atan2(v[1], v[0]) / D) % 360) + 360) % 360,
  decDeg: Math.asin(Math.max(-1, Math.min(1, v[2]))) / D,
});

export interface AltAz {
  altDeg: number;
  azDeg: number; // 북 0°, 동 90°
}

// 적위·시간각(°, 지방 항성시 - 적경)·위도 → 고도·방위
export const altAzAt = (
  decDeg: number,
  hourAngleDeg: number,
  latDeg: number,
): AltAz => {
  const d = decDeg * D;
  const h = hourAngleDeg * D;
  const p = latDeg * D;
  const up =
    Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(h);
  const north =
    Math.cos(p) * Math.sin(d) - Math.sin(p) * Math.cos(d) * Math.cos(h);
  const east = -Math.cos(d) * Math.sin(h);

  return {
    altDeg: Math.asin(Math.max(-1, Math.min(1, up))) / D,
    azDeg: (((Math.atan2(east, north) / D) % 360) + 360) % 360,
  };
};

// 하루 동안 별이 가장 높이·가장 낮게 오는 고도
export const maxAltDeg = (decDeg: number, latDeg: number) =>
  90 - Math.abs(latDeg - decDeg);
export const minAltDeg = (decDeg: number, latDeg: number) =>
  Math.abs(latDeg + decDeg) - 90;

// 지지 않는 별 / 뜨고 지는 별 / 아예 뜨지 않는 별
export type StarPath = "always" | "riseSet" | "never";

export const starPath = (decDeg: number, latDeg: number): StarPath =>
  minAltDeg(decDeg, latDeg) > 0
    ? "always"
    : maxAltDeg(decDeg, latDeg) < 0
      ? "never"
      : "riseSet";

export interface SkyShare {
  always: number; // 0~1
  riseSet: number;
  never: number;
}

// 그 위도에서 별들 중 지지 않는 별·뜨고 지는 별·볼 수 없는 별의 비율
export const skyShare = (decs: number[], latDeg: number): SkyShare => {
  const n = { always: 0, riseSet: 0, never: 0 };

  for (const dec of decs) {
    n[starPath(dec, latDeg)]++;
  }

  return {
    always: n.always / decs.length,
    riseSet: n.riseSet / decs.length,
    never: n.never / decs.length,
  };
};

// 별이 지평선을 지날 때 지평선과 이루는 각 (°): 적도에서 90°(수직), 위도가 높을수록 눕는다
export const risingAngleDeg = (latDeg: number) => 90 - Math.abs(latDeg);

export interface LatitudeNote {
  place: string;
  title: string;
  text: string;
}

const latLabel = (latDeg: number) =>
  Math.abs(latDeg) < 0.5
    ? "적도"
    : `${latDeg > 0 ? "북위" : "남위"} ${Math.round(Math.abs(latDeg))}°`;

// 위도마다 짧은 설명
export const latitudeNote = (latDeg: number): LatitudeNote => {
  const a = Math.abs(latDeg);
  const north = latDeg >= 0;
  const pole = north ? "천구의 북극" : "천구의 남극";
  const label = latLabel(latDeg);

  if (a >= 85) {
    return {
      place: north ? `북극 (${label})` : `남극 (${label})`,
      title: north ? "북극에선 별이 지지 않아요" : "남극에선 별이 지지 않아요",
      text: `${pole}이 바로 머리 위에 있어요. 별은 지평선과 나란히 빙빙 돌 뿐 뜨지도 지지도 않아요. 대신 ${north ? "남쪽" : "북쪽"} 하늘 별은 하나도 볼 수 없어요.`,
    };
  }

  if (a >= 55) {
    return {
      place: `${north ? "북유럽·알래스카" : "남극 가까운 바다"} 쯤 (${label})`,
      title: "극이 높이 떠서 지지 않는 별이 많아요",
      text: `${pole}이 지평선에서 ${Math.round(a)}° 높이에 떠 있어요. 극 둘레 넓은 하늘이 밤새 지지 않고, 별은 지평선에 비스듬히 낮게 누워서 떠요.`,
    };
  }

  if (a >= 12) {
    return {
      place: north
        ? `서울·도쿄·뉴욕 쯤 (${label})`
        : `시드니·부에노스아이레스 쯤 (${label})`,
      title: "별이 비스듬히 떠서 비스듬히 져요",
      text: `${pole}의 높이가 곧 위도(${Math.round(a)}°)예요. 극 가까운 별은 지지 않고, 나머지는 ${north ? "동쪽에서 비스듬히 떠 남쪽 하늘을 지나" : "동쪽에서 비스듬히 떠 북쪽 하늘을 지나"} 서쪽으로 져요.`,
    };
  }

  return {
    place: `적도 둘레 — 싱가포르·에콰도르 쯤 (${label})`,
    title: "적도에선 별이 똑바로 뜨고 똑바로 져요",
    text: "천구의 북극과 남극이 둘 다 지평선에 걸쳐 있어요. 모든 별이 동쪽에서 수직으로 솟아 서쪽으로 수직으로 져요. 지지 않는 별은 없지만, 하늘의 모든 별을 언젠가는 볼 수 있어요.",
  };
};

// "이 하늘은 어디?" 보기
export interface QuizPlace {
  id: string;
  label: string;
  latDeg: number;
}

export const QUIZ_PLACES: QuizPlace[] = [
  { id: "north-pole", label: "북극", latDeg: 90 },
  { id: "north-high", label: "북유럽 (북위 65°)", latDeg: 65 },
  { id: "seoul", label: "서울 (북위 37°)", latDeg: 37.6 },
  { id: "equator", label: "적도", latDeg: 0 },
  { id: "sydney", label: "시드니 (남위 34°)", latDeg: -33.9 },
  { id: "south-pole", label: "남극", latDeg: -90 },
];

// 문제: 정답 하나와 보기 네 개 (rng는 0~1)
export const makeQuiz = (rng: () => number) => {
  const answer = QUIZ_PLACES[Math.floor(rng() * QUIZ_PLACES.length)];
  const others = QUIZ_PLACES.filter((p) => p.id !== answer.id)
    .map((p) => ({ p, k: rng() }))
    .sort((a, b) => a.k - b.k)
    .slice(0, 3)
    .map(({ p }) => p);
  const choices = [answer, ...others]
    .map((p) => ({ p, k: rng() }))
    .sort((a, b) => a.k - b.k)
    .map(({ p }) => p);

  return { answer, choices };
};
