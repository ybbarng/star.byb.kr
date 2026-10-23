import type { Cloud } from "@/game/sky/drawSky";
import type { Place } from "@/game/tonight/places";
import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { HorizonView } from "@/search/horizonSolve";
import type { HorizontalFrame, Observer } from "@/search/utils/ephemeris";
import type { Mat3 } from "@/search/utils/similarity";
import { CONSTELLATIONS, STARS } from "@/game/sky/catalog";
import { CITIES } from "@/game/tonight/places";
import { horizonCameraTP } from "@/search/horizonSolve";
import {
  altAzOf,
  horizontalFrameJ2000,
  julianDay,
  sunVector,
} from "@/search/utils/ephemeris";
import { mat3Inv, mat3MulVec, projectVecToPhoto } from "@/search/utils/wcs";
import { createRng } from "@/utils/rng";

// 어느 쪽을 찍었을까: 같은 밤·같은 곳에서 휴대폰으로 찍은 하늘 사진 여러 장을 보고,
// 사진마다 카메라가 향한 방위·고도를 전천 하늘 지도에 찍는다. 채점은 찍은 자리와 실제 광축 사이의 각.
// 사진은 SkyGuessr와 같은 drawSky + horizonCameraTP로 그린다 (정답 변환을 알고 그리니 어긋나지 않는다).

export type WhichWayDifficulty = "intro" | "easy" | "normal" | "hard";

export interface WhichWaySettings {
  photos: number; // 한 판의 사진 수
  compass: boolean; // 사진 지평선에 여덟 방위
  faintLines: boolean; // 사진에 별자리선을 흐리게
  mapNames: boolean; // 전천 지도에 사진 속 별자리 이름
  fovDeg: [number, number]; // 짧은 변 기준 시야각 범위
  rollMaxDeg: number; // 사진이 기운 정도 (휴대폰을 비스듬히 든 것)
  highShotChance: number; // 지평선이 안 보이게 높이 든 사진의 비율
  clouds: number;
  magLimit: number;
  lightPollution: number;
  minSepDeg: number; // 사진끼리 방위가 이만큼은 떨어진다
}

export const WHICH_WAY_SETTINGS: Record<WhichWayDifficulty, WhichWaySettings> =
  {
    intro: {
      photos: 2,
      compass: true,
      faintLines: true,
      mapNames: true,
      fovDeg: [60, 70],
      rollMaxDeg: 2,
      highShotChance: 0,
      clouds: 0,
      magLimit: 5,
      lightPollution: 0.1,
      minSepDeg: 90,
    },
    easy: {
      photos: 3,
      compass: false,
      faintLines: false,
      mapNames: true,
      fovDeg: [55, 70],
      rollMaxDeg: 3,
      highShotChance: 0.15,
      clouds: 0,
      magLimit: 4.8,
      lightPollution: 0.2,
      minSepDeg: 60,
    },
    normal: {
      photos: 4,
      compass: false,
      faintLines: false,
      mapNames: false,
      fovDeg: [35, 50],
      rollMaxDeg: 25,
      highShotChance: 0.25,
      clouds: 2,
      magLimit: 4.5,
      lightPollution: 0.35,
      minSepDeg: 50,
    },
    hard: {
      photos: 4,
      compass: false,
      faintLines: false,
      mapNames: false,
      fovDeg: [25, 40],
      rollMaxDeg: 70,
      highShotChance: 0.4,
      clouds: 4,
      magLimit: 4.2,
      lightPollution: 0.5,
      minSepDeg: 45,
    },
  };

export const PHOTO_W = 800;
export const PHOTO_H = 600;

// 사진 안에 이만큼은 밝은 별(4등급까지)이 들어와야 풀 만하다
const MIN_BRIGHT_STARS = 5;
// 해가 이보다 낮아야 밤
const NIGHT_SUN_ALT_DEG = -15;
// 사진 귀퉁이가 천정을 넘지 않게 (파노라마에서 방위가 한 바퀴 꼬이지 않게)
const MAX_CORNER_ALT_DEG = 84;
const YEAR = 2026;

const D = Math.PI / 180;

export interface WhichWayPhoto {
  view: HorizonView;
  TP: Mat3;
  constellations: string[]; // 사진에 들어온 별자리 (보이는 별이 많은 순)
}

export interface WhichWayRound {
  seed: number;
  difficulty: WhichWayDifficulty;
  place: Place;
  date: Date; // 촬영 순간 (UTC)
  observer: Observer;
  photos: WhichWayPhoto[];
  clouds: Cloud[];
  groundSeed: number; // 같은 곳이라 모든 사진의 땅 모양이 같다
}

// 별 걱정 없이 그릴 수 있게 사람이 사는 위도의 도시만 (백야 근처는 뺀다)
const ROUND_PLACES = CITIES.filter((c) => Math.abs(c.latDeg) <= 56);

// 사진 대각선 절반이 하늘에서 몇 도인지 (귀퉁이까지의 각)
export const diagonalHalfDeg = (fovDeg: number, W = PHOTO_W, H = PHOTO_H) =>
  Math.atan((Math.tan((fovDeg / 2) * D) * Math.hypot(W, H)) / Math.min(W, H)) /
  D;

const sunAltAt = (date: Date, observer: Observer) => {
  const jd = julianDay(date);

  return altAzOf(sunVector(jd), jd, observer).altDeg;
};

const BRIGHT = STARS.filter((s) => s.mag <= 4);

const dot = (a: Point3D, b: Point3D) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const inFrame = (p: Point2D | null, W: number, H: number) =>
  !!p && p[0] >= 0 && p[0] < W && p[1] >= 0 && p[1] < H;

// 지평선 위에서 사진 안에 들어온 밝은 별 수
export const brightStarsInPhoto = (
  TP: Mat3,
  frame: HorizontalFrame,
  W = PHOTO_W,
  H = PHOTO_H,
) =>
  BRIGHT.filter(
    (s) =>
      dot(s.vector, frame.zenith) > Math.sin(3 * D) &&
      inFrame(projectVecToPhoto(TP, s.vector), W, H),
  ).length;

// 사진에 들어온 별자리: 별자리선의 별이 지평선 위·사진 안에 둘 이상 있는 것, 많은 순
export const constellationsInPhoto = (
  TP: Mat3,
  frame: HorizontalFrame,
  W = PHOTO_W,
  H = PHOTO_H,
): string[] => {
  const counts = new Map<string, Set<string>>();

  for (const c of CONSTELLATIONS) {
    for (const v of c.stars) {
      if (dot(v, frame.zenith) > 0 && inFrame(projectVecToPhoto(TP, v), W, H)) {
        const set = counts.get(c.label) ?? new Set<string>();
        set.add(v.map((x) => x.toFixed(5)).join(","));
        counts.set(c.label, set);
      }
    }
  }

  return [...counts]
    .filter(([, s]) => s.size >= 2)
    .sort((a, b) => b[1].size - a[1].size)
    .map(([label]) => label);
};

const wrap180 = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

// 그 도시의 밤 (현지 평균시 20시~다음 날 4시 사이, 해가 15° 아래)
const nightMoment = (place: Place, rng: () => number): Date | null => {
  const day = Math.floor(rng() * 365);
  const localHour = 20 + rng() * 8;
  const date = new Date(
    Date.UTC(YEAR, 0, 1) +
      day * 86400000 +
      (localHour - place.lonDeg / 15) * 3600000,
  );
  const observer = { latDeg: place.latDeg, lonDeg: place.lonDeg };

  return sunAltAt(date, observer) < NIGHT_SUN_ALT_DEG ? date : null;
};

// 사진 한 장의 방향: 대개는 지평선이 보이게 낮게, 가끔 높이 든다
const pickView = (
  rng: () => number,
  set: WhichWaySettings,
  taken: number[],
): HorizonView | null => {
  const azimuthDeg = rng() * 360;

  if (taken.some((az) => Math.abs(wrap180(az - azimuthDeg)) < set.minSepDeg)) {
    return null;
  }

  const [lo, hi] = set.fovDeg;
  const fovDeg = lo + rng() * (hi - lo);
  const diag = diagonalHalfDeg(fovDeg);
  const high = rng() < set.highShotChance;
  const altitudeDeg = high
    ? Math.min(MAX_CORNER_ALT_DEG - diag, fovDeg * 0.6 + rng() * 30)
    : fovDeg * (0.2 + rng() * 0.15);

  if (altitudeDeg + diag > MAX_CORNER_ALT_DEG || altitudeDeg < 5) {
    return null;
  }

  return {
    azimuthDeg,
    altitudeDeg,
    rollDeg: (rng() * 2 - 1) * set.rollMaxDeg,
    fovDeg,
  };
};

export const makeWhichWayRound = (
  seed: number,
  difficulty: WhichWayDifficulty,
): WhichWayRound => {
  const rng = createRng(seed);
  const set = WHICH_WAY_SETTINGS[difficulty];

  for (;;) {
    const place = ROUND_PLACES[Math.floor(rng() * ROUND_PLACES.length)];
    const date = nightMoment(place, rng);

    if (!date) {
      continue;
    }

    const observer = { latDeg: place.latDeg, lonDeg: place.lonDeg };
    const frame = horizontalFrameJ2000(julianDay(date), observer);
    const photos: WhichWayPhoto[] = [];

    for (let tries = 0; tries < 400 && photos.length < set.photos; tries++) {
      const view = pickView(
        rng,
        set,
        photos.map((p) => p.view.azimuthDeg),
      );

      if (!view) {
        continue;
      }

      const TP = horizonCameraTP(date, observer, view, PHOTO_W, PHOTO_H);

      if (brightStarsInPhoto(TP, frame) < MIN_BRIGHT_STARS) {
        continue;
      }

      photos.push({
        view,
        TP,
        constellations: constellationsInPhoto(TP, frame),
      });
    }

    if (photos.length < set.photos) {
      continue; // 이 밤은 별이 모자란 쪽이 많다 (밝은 달 등) — 다른 밤으로
    }

    const clouds: Cloud[] = Array.from({ length: set.clouds }, () => ({
      azDeg: rng() * 360,
      altDeg: 15 + rng() * 45,
      sizeDeg: 8 + rng() * 12,
      seed: Math.floor(rng() * 1e9),
    }));

    return {
      seed,
      difficulty,
      place,
      date,
      observer,
      photos,
      clouds,
      groundSeed: Math.floor(rng() * 1e9),
    };
  }
};

// ---------- 방향과 각 ----------

export interface AltAz {
  altDeg: number;
  azDeg: number; // 북 0°, 동 90°
}

// 수평 좌표계의 단위 벡터 (북·동·천정)
const localVec = ({ altDeg, azDeg }: AltAz): Point3D => [
  Math.cos(altDeg * D) * Math.cos(azDeg * D),
  Math.cos(altDeg * D) * Math.sin(azDeg * D),
  Math.sin(altDeg * D),
];

// 두 방향 사이의 각 (°)
export const angleBetweenDeg = (a: AltAz, b: AltAz) =>
  Math.acos(Math.max(-1, Math.min(1, dot(localVec(a), localVec(b))))) / D;

// 하늘 방향(J2000) → 그 시각·장소의 고도·방위
export const altAzInFrame = (v: Point3D, frame: HorizontalFrame): AltAz => ({
  altDeg: Math.asin(Math.max(-1, Math.min(1, dot(v, frame.zenith)))) / D,
  azDeg:
    (((Math.atan2(dot(v, frame.east), dot(v, frame.north)) / D) % 360) + 360) %
    360,
});

export const roundFrame = (round: WhichWayRound) =>
  horizontalFrameJ2000(julianDay(round.date), round.observer);

// 사진의 정답 방향 (광축)
export const photoAim = (photo: WhichWayPhoto): AltAz => ({
  altDeg: photo.view.altitudeDeg,
  azDeg: photo.view.azimuthDeg,
});

// 사진 픽셀 → 하늘 방향(J2000). 역행렬을 한 번만 구해 둔다
export const photoToSkyFn = (TP: Mat3) => {
  const inv = mat3Inv(TP);

  return (x: number, y: number): Point3D => {
    const v = mat3MulVec(inv, [x, y, 1]);
    const n = Math.hypot(v[0], v[1], v[2]);

    return [v[0] / n, v[1] / n, v[2] / n];
  };
};

// 사진 테두리를 하늘 방향으로 (변마다 steps 조각, 시계 방향으로 한 바퀴)
export const photoOutline = (
  TP: Mat3,
  steps = 12,
  W = PHOTO_W,
  H = PHOTO_H,
): Point3D[] => {
  const toSky = photoToSkyFn(TP);
  const out: Point3D[] = [];
  const corners: Point2D[] = [
    [0, 0],
    [W, 0],
    [W, H],
    [0, H],
  ];

  for (let k = 0; k < 4; k++) {
    const [ax, ay] = corners[k];
    const [bx, by] = corners[(k + 1) % 4];

    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      out.push(toSky(ax + (bx - ax) * t, ay + (by - ay) * t));
    }
  }

  return out;
};

// ---------- 점수 ----------

export const PHOTO_POINTS = 1000;

// 3° 안이면 만점, 그다음은 18°마다 1/e로 준다 (10° → 약 680점, 20° → 약 390점)
export const pointsFor = (errDeg: number) =>
  errDeg <= 3
    ? PHOTO_POINTS
    : Math.round(PHOTO_POINTS * Math.exp(-(errDeg - 3) / 18));

export interface PhotoScore {
  errDeg: number | null; // 안 찍었으면 null
  points: number;
}

export const scoreRound = (
  round: WhichWayRound,
  guesses: (AltAz | null)[],
): { photos: PhotoScore[]; total: number } => {
  const photos = round.photos.map((p, i) => {
    const g = guesses[i];

    if (!g) {
      return { errDeg: null, points: 0 };
    }

    const errDeg = angleBetweenDeg(g, photoAim(p));

    return { errDeg, points: pointsFor(errDeg) };
  });

  return { photos, total: photos.reduce((s, p) => s + p.points, 0) };
};

// ---------- 말로 옮기기 ----------

const DIRECTIONS = [
  "북",
  "북북동",
  "북동",
  "동북동",
  "동",
  "동남동",
  "남동",
  "남남동",
  "남",
  "남남서",
  "남서",
  "서남서",
  "서",
  "서북서",
  "북서",
  "북북서",
];

// 방위 → "남동쪽" (16방위)
export const directionLabel = (azDeg: number) =>
  `${DIRECTIONS[Math.round((((azDeg % 360) + 360) % 360) / 22.5) % 16]}쪽`;

// 고도 → 말 (주먹 하나를 팔 뻗어 들면 하늘에서 약 10°)
export const heightLabel = (altDeg: number) =>
  altDeg < 15
    ? "지평선 가까이"
    : altDeg < 35
      ? "낮은 하늘"
      : altDeg < 60
        ? "중간 높이"
        : "높은 하늘";

export const aimLabel = (a: AltAz) =>
  `${directionLabel(a.azDeg)} (방위 ${Math.round(a.azDeg)}°) · 고도 ${Math.round(a.altDeg)}°`;
