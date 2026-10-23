import type { Hemisphere } from "@/game/starSchool/asterisms";
import type { SkyPlace } from "@/game/starSchool/skyMath";
import type { Point3D } from "@/scripts/hash/types";
import { findTargets } from "@/game/findConstellation/targets";
import {
  constellationCenter,
  constellationParts,
  uniqueStars,
} from "@/game/sky/catalog";
import { ASTERISMS } from "@/game/starSchool/asterisms";
import { DEEP_SKY } from "@/game/starSchool/deepSky";
import {
  altAzAt,
  centerOf,
  dateAt,
  directionWord,
  hrVector,
  observerOf,
  raDecVector,
  SEOUL_PLACE,
  STAR_BY_HR,
  sunAltAt,
  SYDNEY_PLACE,
} from "@/game/starSchool/skyMath";
import { FAMOUS } from "@/game/tonight/report";

// 도감: 별자리 88개, 길잡이 모양, 맨눈 딥스카이. 계절·방향은 서울 저녁 9시의 실제 하늘로 계산한다
// (서울에서 높이 10° 넘게 뜨지 않는 남쪽 것은 시드니 저녁 9시로).

export type DexKind = "constellation" | "asterism" | "deepSky";

export interface DexEntry {
  id: string; // "c:오리온자리", "a:summer-triangle", "d:m31"
  kind: DexKind;
  name: string;
  fame: 1 | 2 | 3; // 3: 가장 유명 (쉬움), 2: 맨눈으로 찾을 만함, 1: 나머지
  season: string;
  story: string;
  howTo?: string;
  hemisphere: Hemisphere;
  center: Point3D;
  vectors: Point3D[]; // 하늘에서 이 항목을 이루는 별들(딥스카이는 그 자리 하나)
  brightStars: { name: string; mag: number }[];
  extra?: string; // 거리 등 한 줄
}

const FAMOUS_TIPS = new Map(FAMOUS.map((f) => [f.label, f.tip]));
const EASY = new Set(findTargets("easy").map((t) => t.label));
const NORMAL = new Set(findTargets("normal").map((t) => t.label));

// 서울에서 가장 높이 떠도 이보다 낮으면 남반구 것으로 친다
const SOUTH_MAX_ALT = 10;

export const maxAltitudeAt = (center: Point3D, latDeg: number) =>
  90 - Math.abs(latDeg - (Math.asin(center[2]) * 180) / Math.PI);

const hemisphereOf = (center: Point3D): Hemisphere =>
  maxAltitudeAt(center, SEOUL_PLACE.latDeg) < SOUTH_MAX_ALT ? "south" : "north";

const brightStarsOf = (vs: Point3D[]) =>
  vs
    .map((v) =>
      [...STAR_BY_HR.values()].find(
        (s) =>
          s.vector[0] * v[0] + s.vector[1] * v[1] + s.vector[2] * v[2] >
          0.9999999,
      ),
    )
    .filter((s): s is NonNullable<typeof s> => !!s?.name)
    .sort((a, b) => a.mag - b.mag)
    .slice(0, 3)
    .map((s) => ({ name: s.name!, mag: s.mag }));

const constellationEntries = (): DexEntry[] =>
  findTargets("hard").map((t) => {
    const parts = constellationParts(t.label);
    const vectors = uniqueStars(parts);
    const center = constellationCenter(parts);

    return {
      id: `c:${t.label}`,
      kind: "constellation",
      name: t.label,
      fame: EASY.has(t.label) ? 3 : NORMAL.has(t.label) ? 2 : 1,
      season: t.season,
      story: t.story,
      howTo: FAMOUS_TIPS.get(t.label),
      hemisphere: hemisphereOf(center),
      center,
      vectors,
      brightStars: brightStarsOf(vectors),
    };
  });

const asterismEntries = (): DexEntry[] =>
  ASTERISMS.map((a) => {
    const vectors = [...new Set([...a.vertices, ...a.path.flat()])].map(
      hrVector,
    );

    return {
      id: `a:${a.id}`,
      kind: "asterism",
      name: a.name,
      fame: 3,
      season: a.season,
      story: a.story,
      howTo: a.howTo,
      hemisphere: a.hemisphere,
      center: centerOf(vectors),
      vectors,
      brightStars: brightStarsOf(vectors),
    };
  });

const deepSkyEntries = (): DexEntry[] =>
  DEEP_SKY.map((d) => {
    const v = raDecVector(d.raDeg, d.decDeg);

    return {
      id: `d:${d.id}`,
      kind: "deepSky",
      name: d.name,
      fame: 2,
      season: d.season,
      story: d.fact,
      howTo: d.howTo,
      hemisphere: d.hemisphere,
      center: v,
      vectors: [v],
      brightStars: [],
      extra: `${d.kind} · ${d.constellation} · ${d.distance}`,
    };
  });

let entries: DexEntry[] | null = null;

export const dexEntries = (): DexEntry[] =>
  (entries ??= [
    ...asterismEntries(),
    ...constellationEntries(),
    ...deepSkyEntries(),
  ]);

export const dexEntry = (id: string) => dexEntries().find((e) => e.id === id);

// ── 저녁 9시의 하늘에서 ─────────────────────────────────────────

export interface EveningBest {
  place: SkyPlace;
  month: number; // 저녁 9시에 가장 높이 뜨는 달
  altDeg: number;
  direction: string; // "남", "북" …
  allYear: boolean; // 그곳에서 지지 않는다 (주극)
  neverRises: boolean;
}

const SEASON_OF_MONTH = [
  "겨울",
  "겨울",
  "봄",
  "봄",
  "봄",
  "여름",
  "여름",
  "여름",
  "가을",
  "가을",
  "가을",
  "겨울",
];

export const seasonOfMonth = (month: number, south = false) => {
  const s = SEASON_OF_MONTH[month - 1];

  return south ? { 봄: "가을", 여름: "겨울", 가을: "봄", 겨울: "여름" }[s]! : s;
};

// 매달 15일 저녁 9시(그곳 시계)에 가장 높이 뜨는 달과 그때 높이·방향
export const eveningBest = (center: Point3D, year = 2026): EveningBest => {
  const south = hemisphereOf(center) === "south";
  const place = south ? SYDNEY_PLACE : SEOUL_PLACE;
  const observer = observerOf(place);
  let best = { month: 1, altDeg: -90, azDeg: 0 };

  for (let month = 1; month <= 12; month++) {
    const date = dateAt(place, { y: year, m: month, d: 15, h: 21, min: 0 });
    const { altDeg, azDeg } = altAzAt(center, date, observer);

    if (altDeg > best.altDeg) {
      best = { month, altDeg, azDeg };
    }
  }

  const decDeg = (Math.asin(center[2]) * 180) / Math.PI;
  const lat = place.latDeg;

  return {
    place,
    month: best.month,
    altDeg: best.altDeg,
    direction: directionWord(best.azDeg),
    allYear:
      Math.abs(lat + decDeg) - 90 > 0 && Math.sign(lat) === Math.sign(decDeg),
    neverRises: maxAltitudeAt(center, lat) <= 0,
  };
};

// ── 오늘 밤 ─────────────────────────────────────────────────────

export interface TonightSky {
  rise: Date | null; // 밤 동안 지평선 위로 올라오는 때
  set: Date | null;
  highest: { date: Date; altDeg: number; direction: string } | null; // 어두운 동안 가장 높을 때
  upAllNight: boolean;
  neverUp: boolean;
}

const MINUTE = 60000;

// 오늘 저녁 5시부터 다음 날 아침 7시까지 10분 간격으로 훑는다. 가장 높은 때는 해가 −12° 아래인 동안만 본다
export const tonightSky = (
  center: Point3D,
  place: SkyPlace,
  today: { y: number; m: number; d: number },
): TonightSky => {
  const observer = observerOf(place);
  const start = dateAt(place, { ...today, h: 17, min: 0 }).getTime();
  let rise: Date | null = null;
  let set: Date | null = null;
  let highest: TonightSky["highest"] = null;
  let prevAlt: number | null = null;
  let anyUp = false;
  let allUp = true;

  for (let m = 0; m <= 14 * 60; m += 10) {
    const date = new Date(start + m * MINUTE);
    const { altDeg, azDeg } = altAzAt(center, date, observer);
    const dark = sunAltAt(date, observer) < -12;

    if (prevAlt !== null && prevAlt <= 0 && altDeg > 0 && !rise) {
      rise = date;
    }

    if (prevAlt !== null && prevAlt > 0 && altDeg <= 0 && !set) {
      set = date;
    }

    if (dark) {
      if (altDeg > 0) {
        anyUp = true;
      } else {
        allUp = false;
      }

      if (altDeg > 0 && (!highest || altDeg > highest.altDeg)) {
        highest = { date, altDeg, direction: directionWord(azDeg) };
      }
    }

    prevAlt = altDeg;
  }

  return {
    rise,
    set,
    highest,
    upAllNight: anyUp && allUp,
    neverUp: !anyUp,
  };
};
