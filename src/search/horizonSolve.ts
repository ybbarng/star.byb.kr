import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Observer } from "@/search/utils/ephemeris";
import type { Mat3 } from "@/search/utils/similarity";
import {
  julianDay,
  ofDateToJ2000,
  zenithVector,
} from "@/search/utils/ephemeris";
import { poissonTailNegLog10 } from "@/search/utils/stats";
import { recoverCenter } from "@/search/utils/wcs";

// 촬영 시각·장소와 사진 속 지평선을 알 때의 풀이 (발표의 사이판 사진을 사람이 푼 방법을 계산으로).
//
// blind 풀이는 하늘 전체 × 모든 회전 × 모든 크기를 뒤져서, 별이 10개쯤인 사진은 우연과 구분이 안 된다.
// 그런데 시각과 장소를 알면 별마다 고도·방위가 정해지고, 사진에 지평선이 보이면 시야각 하나를 가정할 때
// 카메라의 위아래·좌우 기울기가 정해진다. 남는 미지수는 카메라가 바라보는 방위와 시야각 둘뿐이다.
// 1) 시각 후보 × 시야각 후보마다, 사진 별의 고도와 비슷한 고도의 밝은 하늘 별을 짝지어 방위 차이를 투표한다.
// 2) 표를 많이 받은 후보마다, 이 모델 안에서만(시각·방위·시야각·지평선 높이·기울기 오차) 맞는 별 수가
//    최대가 되게 다듬는다. 자유 변환(닮음·원근)으로 다듬으면 별이 적을 때 우연한 점에 끼워 맞춰진다.
// 3) 우연 확률은 하늘 쪽 면적 기준으로 계산하고, 살펴본 매개변수 칸 수만큼 깎아서 판정한다.
//
// 시각은 범위로 받는다. 메신저에 올린 시각은 찍은 시각보다 늦고(수십 분~몇 시간), 시간대가 섞이기도 한다.
// 지평선도 먼 섬·산이면 실제 고도 0°보다 1~2° 높을 수 있어 그만큼 다듬는다.
//
// 카메라 모델: 핀홀(직선투영), 주점은 사진 중앙, 정사각 화소. TP = K·R (R: 천구 → 카메라, y는 아래로).

// 판정 기준. logOdds는 살펴본 모든 후보 칸으로 깎은 값이라, 0 이상이면 "어느 후보에서든 우연히 이만큼
// 맞을 기대 횟수가 1번 미만"이다. 합성 장면 130개(별 10개 안팎, 거짓 점, 1° 안팎 틀린 지평선, 늦게 올린
// 시각)에서 틀린 답의 최고 점수는 -2.1, 틀린 시각을 준 대조군의 최고 점수는 -2.2였다 (journey 25·26장).
export const HORIZON_ACCEPT_LOG_ODDS = 0;

export interface HorizonStar {
  vector: Point3D; // J2000
  mag: number;
}

export interface HorizonSolveInput {
  photoStars: Point2D[]; // 우선순위 순 (지평선 아래 것은 알아서 뺀다)
  width: number;
  height: number;
  horizon: [Point2D, Point2D]; // 사진 속 지평선 위 두 점 (바다 수평선이 가장 좋다)
  date: Date; // 알려진 시각 (올린 시각 등)
  // 실제 촬영 시각이 date에서 얼마나 앞·뒤일 수 있는지 (분). 기본: 3시간 전 ~ 1시간 30분 뒤
  minutesBefore?: number;
  minutesAfter?: number;
  observer: Observer;
  catalog: HorizonStar[];
}

export interface HorizonSolveResult {
  TP: Mat3;
  centerVector: Point3D;
  fovDeg: number; // 짧은 변 기준
  azimuthDeg: number; // 카메라 수평 기준축의 방위 (북 0°, 동 90°)
  date: Date; // 가장 잘 맞는 촬영 시각
  inlierCount: number;
  photoCount: number; // 비교에 쓴 사진 별 수
  expectedRandom: number;
  hypotheses: number; // 살펴본 매개변수 칸 수
  logOdds: number; // 하늘 면적 기준 우연 확률에서 칸 수만큼 깎은 값
}

const D = Math.PI / 180;

type V = Point3D;
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const norm = (a: V): V => {
  const n = Math.hypot(a[0], a[1], a[2]);

  return [a[0] / n, a[1] / n, a[2] / n];
};

const scale = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const add = (...vs: V[]): V =>
  vs.reduce((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]], [0, 0, 0]);
// 축 k(단위)를 중심으로 a를 각 t만큼 돌린다 (로드리게스)
const rotate = (a: V, k: V, t: number): V =>
  add(
    scale(a, Math.cos(t)),
    scale(cross(k, a), Math.sin(t)),
    scale(k, dot(k, a) * (1 - Math.cos(t))),
  );

// 대기 굴절: 지평선 근처 별은 실제보다 높아 보인다 (지평선에서 약 0.5°). Bennett 공식(분각).
const refractionDeg = (altDeg: number) =>
  altDeg < -1 ? 0 : 1 / 60 / Math.tan((altDeg + 7.31 / (altDeg + 4.4)) * D);

// 시야각(짧은 변) 후보: 15°~100°, 3%씩
const FOV_STEP = 1.03;
const FOV_CANDIDATES: number[] = [];

for (let f = 15; f <= 100; f *= FOV_STEP) {
  FOV_CANDIDATES.push(f);
}

const AZ_BIN_DEG = 1;
// 시각 후보 간격(분). 5분이면 하늘이 1.25° 돈다 — 투표 허용오차 안이고, 다듬기에서 1분 단위로 맞춘다.
const TIME_STEP_MIN = 5;
const DEFAULT_MINUTES_BEFORE = 180;
const DEFAULT_MINUTES_AFTER = 90;
// 투표 고도 허용오차의 하한. 지평선을 찍은 오차·렌즈 왜곡으로 1~2° 어긋나도 표가 모이게 넉넉히 둔다.
const VOTE_ALT_TOL_DEG = 1.5;
// 사진에 찍힐 만한 밝기의 하늘 별만 투표에 쓴다 (휴대폰 사진은 3~4등급까지 보인다)
const VOTE_MAX_MAG = 4;
// 다듬을 후보 수
const TOP_PEAKS = 60;
// 다듬을 후보를 고를 때 넓히는 허용오차 배수 (지평선 높이 오차 ±1.5°쯤을 견딘다)
const COARSE_TOLERANCE = 3;
// 다듬는 범위: 지평선 높이(카메라 위아래 기울기)와 좌우 기울기 오차
const PITCH_RANGE_DEG = 3;
const ROLL_RANGE_DEG = 2;
const FINE_STEP_DEG = 0.25;
// 비교 규모: 사진 별 몇 개(우선순위 상위)를, 그 몇 배의 밝은 하늘 별과 비교할지. 하늘 별을 사진에
// 보이는 만큼만 써야 어두운 카탈로그 별이 우연 기대치를 부풀리지 않는다. 이 풀이는 blind 풀이가 확신하지
// 못하는 별 적은 사진(10개 안팎)용이라 작게 본다. 별 40개로도 보게 해 봤더니 거짓 검출이 섞여 틀린 시각의
// 점수가 정답 가까이 올라왔다(journey 25장). 별 많은 사진은 blind 풀이가 이미 푼다.
interface CompareSetting {
  photoStars: number;
  catalogRatio: number;
}
const COMPARE_SETTINGS: CompareSetting[] = [
  { photoStars: 15, catalogRatio: 2 },
];

interface Frame {
  Z: V;
  E: V;
  N: V;
}

interface SkyStar extends HorizonStar {
  apparent: V; // 굴절만큼 실제보다 높이 보이는 방향
  alt: number; // 겉보기 고도 (°)
  az: number; // 방위 (라디안)
}

interface Params {
  minutes: number; // 알려진 시각에서 몇 분 앞·뒤인지
  fovDeg: number;
  theta: number; // 카메라 수평 기준축의 방위 (°)
  pitch: number; // 지평선 높이 오차 (°)
  roll: number; // 지평선 기울기 오차 (°)
}

export const horizonSolve = (
  input: HorizonSolveInput,
): HorizonSolveResult | null => {
  let best: HorizonSolveResult | null = null;

  for (const compare of COMPARE_SETTINGS) {
    const r = solveWith(input, compare);

    if (r && (!best || r.logOdds > best.logOdds)) {
      best = r;
    }
  }

  if (!best) {
    return null;
  }

  const penalty = Math.log10(COMPARE_SETTINGS.length);

  return {
    ...best,
    hypotheses: best.hypotheses * COMPARE_SETTINGS.length,
    logOdds: best.logOdds - penalty,
  };
};

const solveWith = (
  input: HorizonSolveInput,
  compare: CompareSetting,
): HorizonSolveResult | null => {
  const { width: W, height: H, horizon, observer } = input;
  const cx = W / 2;
  const cy = H / 2;
  const before = input.minutesBefore ?? DEFAULT_MINUTES_BEFORE;
  const after = input.minutesAfter ?? DEFAULT_MINUTES_AFTER;

  // 그 시각의 하늘 (분 단위로 기억한다)
  const skyCache = new Map<number, { frame: Frame; sky: SkyStar[] }>();

  const skyAt = (minutes: number) => {
    const key = Math.round(minutes);
    const cached = skyCache.get(key);

    if (cached) {
      return cached;
    }

    const jd = julianDay(new Date(input.date.getTime() + key * 60000));
    const Z = norm(ofDateToJ2000(zenithVector(jd, observer), jd));
    const E = norm(cross([0, 0, 1], Z));
    const frame: Frame = { Z, E, N: cross(Z, E) };
    const sky = input.catalog
      .map((s): SkyStar => {
        const alt = Math.asin(Math.max(-1, Math.min(1, dot(s.vector, Z)))) / D;
        const r = refractionDeg(alt);

        return {
          ...s,
          apparent: rotateTowardZenith(s.vector, Z, r * D),
          alt: alt + r,
          az: Math.atan2(dot(s.vector, E), dot(s.vector, frame.N)),
        };
      })
      .filter((s) => s.alt > 0)
      .sort((a, b) => a.mag - b.mag);
    const value = { frame, sky };
    skyCache.set(key, value);

    return value;
  };

  // 지평선보다 위(하늘 쪽)에 있는 사진 별만
  const [h1, h2] = horizon;
  const sideOf = (p: Point2D) =>
    (h2[0] - h1[0]) * (p[1] - h1[1]) - (h2[1] - h1[1]) * (p[0] - h1[0]);
  const skySign = Math.sign(sideOf([(h1[0] + h2[0]) / 2, -1e6]));
  const isSky = (p: Point2D) => Math.sign(sideOf(p)) === skySign;
  const photo = input.photoStars.filter(isSky).slice(0, compare.photoStars);

  if (photo.length < 4) {
    return null;
  }

  const tolPx = Math.max(5, Math.hypot(W, H) * 0.006);
  const bins = Math.round(360 / AZ_BIN_DEG);

  // 카메라 좌표계의 천정과 수평 기준축. pitch·roll은 지평선을 찍은 오차를 고치는 작은 회전.
  const cameraBasis = (f: number, pitch: number, roll: number) => {
    const dir = (p: Point2D): V => norm([(p[0] - cx) / f, (p[1] - cy) / f, 1]);
    let zc = norm(cross(dir(h1), dir(h2)));

    if (dot(zc, dir([(h1[0] + h2[0]) / 2, -H])) < 0) {
      zc = scale(zc, -1);
    }

    zc = rotate(rotate(zc, [1, 0, 0], pitch), [0, 0, 1], roll);

    // 광축을 수평면에 내린 방향이 e1. (e1, e2, zc)는 (N, E, Z)와 같은 손잡이.
    const e1 = norm(add([0, 0, 1], scale(zc, -zc[2])));

    return { dir, zc, e1, e2: cross(e1, zc) };
  };

  // 1) 투표: 시각 후보 × 시야각 후보 × 방위 칸
  const timeSteps: number[] = [];

  for (let m = -before; m <= after; m += TIME_STEP_MIN) {
    timeSteps.push(m);
  }

  const peaks: { votes: number; p: Params }[] = [];

  for (const minutes of timeSteps) {
    const voters = skyAt(minutes).sky.filter((s) => s.mag <= VOTE_MAX_MAG);

    for (const fovDeg of FOV_CANDIDATES) {
      const f = focal(fovDeg, W, H);
      const { dir, zc, e1, e2 } = cameraBasis(f, 0, 0);
      const altTol = Math.max(VOTE_ALT_TOL_DEG, (2 * tolPx) / f / D);
      // 사진 별 하나가 같은 칸에 여러 번 투표하지 않게 칸마다 마지막 투표 별을 기억한다
      const votes = new Int32Array(bins);
      const lastVoter = new Int32Array(bins).fill(-1);

      photo.forEach((p, i) => {
        const d = dir(p);
        const alt = Math.asin(dot(d, zc)) / D;
        const phi = Math.atan2(dot(d, e2), dot(d, e1));

        for (const s of voters) {
          if (Math.abs(s.alt - alt) > altTol) {
            continue;
          }

          const theta = ((((s.az - phi) / D) % 360) + 360) % 360;
          const center = Math.round(theta / AZ_BIN_DEG);

          // 이웃 칸까지 (칸 경계에 걸친 경우)
          for (let k = -1; k <= 1; k++) {
            const b = (center + k + bins) % bins;

            if (lastVoter[b] !== i) {
              lastVoter[b] = i;
              votes[b]++;
            }
          }
        }
      });

      // 이 시각·시야각에서 표가 지역 최대인 방위들
      for (let b = 0; b < bins; b++) {
        const v = votes[b];

        if (
          v >= 3 &&
          v >= votes[(b + bins - 1) % bins] &&
          v > votes[(b + 1) % bins]
        ) {
          peaks.push({
            votes: v,
            p: { minutes, fovDeg, theta: b * AZ_BIN_DEG, pitch: 0, roll: 0 },
          });
        }
      }
    }
  }

  // 2) 후보마다 모델 안에서 다듬기 (매개변수 하나씩 돌아가며 훑는 좌표 하강)
  const camera = (p: Params): Mat3 => {
    const f = focal(p.fovDeg, W, H);
    const { zc, e1, e2 } = cameraBasis(f, p.pitch * D, p.roll * D);

    return cameraTP(
      skyAt(p.minutes).frame,
      p.theta * D,
      f,
      [e1, e2, zc],
      cx,
      cy,
    );
  };

  const score = (p: Params) =>
    countInliers(
      camera(p),
      photo,
      skyAt(p.minutes).sky,
      W,
      H,
      tolPx,
      isSky,
      compare.catalogRatio,
    );

  // 표 수는 시야각이 작을수록 부풀어(고도 허용오차가 상대적으로 넓다) 순위로 믿기 어렵다.
  // 후보마다 그 자리에서 맞는 별 수를 한 번 세서, 그 순서로 다듬을 후보를 고른다. 이때는 허용오차를
  // 넓혀 센다 — 지평선을 1~2° 틀리게 찍으면(자동으로 찾은 지평선) 다듬기 전에는 정답 후보도 맞는 별이
  // 0개라 탈락했다 (journey 26장). 최종 판정은 원래 허용오차로 한다.
  const coarseScore = (p: Params) =>
    countInliers(
      camera(p),
      photo,
      skyAt(p.minutes).sky,
      W,
      H,
      tolPx * COARSE_TOLERANCE,
      isSky,
      compare.catalogRatio,
    );
  const ranked = peaks
    .map((peak) => ({ ...peak, inliers: coarseScore(peak.p).inliers }))
    .sort((a, b) => b.inliers - a.inliers || b.votes - a.votes);

  let best: {
    p: Params;
    inliers: number;
    sumSq: number;
    catalogInView: number;
  } | null = null;

  for (const peak of ranked.slice(0, TOP_PEAKS)) {
    let p = peak.p;
    let s = score(p);

    for (let round = 0; round < 3; round++) {
      const inliersBefore = s.inliers;

      for (const [key, range, step] of [
        ["theta", 2, FINE_STEP_DEG],
        ["pitch", PITCH_RANGE_DEG, FINE_STEP_DEG],
        ["roll", ROLL_RANGE_DEG, FINE_STEP_DEG * 2],
        ["fovDeg", p.fovDeg * (FOV_STEP - 1) * 2, p.fovDeg * 0.005],
        ["minutes", TIME_STEP_MIN, 1],
      ] as const) {
        const center = p[key];
        // 지평선 높이·기울기 오차는 정해진 범위 밖으로 나가지 않는다
        const lo =
          key === "pitch"
            ? -PITCH_RANGE_DEG
            : key === "roll"
              ? -ROLL_RANGE_DEG
              : center - range;
        const hi =
          key === "pitch"
            ? PITCH_RANGE_DEG
            : key === "roll"
              ? ROLL_RANGE_DEG
              : center + range;

        for (let v = lo; v <= hi + 1e-9; v += step) {
          const q = { ...p, [key]: v };
          const t = score(q);

          if (
            t.inliers > s.inliers ||
            (t.inliers === s.inliers && t.sumSq < s.sumSq)
          ) {
            p = q;
            s = t;
          }
        }
      }

      if (s.inliers === inliersBefore) {
        break;
      }
    }

    if (
      !best ||
      s.inliers > best.inliers ||
      (s.inliers === best.inliers && s.sumSq < best.sumSq)
    ) {
      best = { p, ...s };
    }
  }

  if (!best) {
    return null;
  }

  // 3) 판정. 칸 수: 시각 × 시야각 × 방위 × 지평선 높이 × 기울기 (미세 조정은 이 칸들 안이다)
  const hypotheses =
    timeSteps.length *
    FOV_CANDIDATES.length *
    bins *
    ((2 * PITCH_RANGE_DEG) / FINE_STEP_DEG + 1) *
    ((2 * ROLL_RANGE_DEG) / (FINE_STEP_DEG * 2) + 1);
  const skyArea = W * H * skyFraction(W, H, isSky);
  const expectedRandom =
    (photo.length * best.catalogInView * Math.PI * tolPx * tolPx) / skyArea;
  // 방위 하나는 짝 하나로 정해지므로 우연 비교에서 1개를 뺀다 (나머지는 칸 수로 깎았다)
  const logOdds =
    poissonTailNegLog10(best.inliers - 1, expectedRandom) -
    Math.log10(hypotheses);
  const TP = camera(best.p);

  return {
    TP,
    centerVector: recoverCenter(TP, W, H),
    fovDeg: best.p.fovDeg,
    azimuthDeg: best.p.theta,
    date: new Date(input.date.getTime() + Math.round(best.p.minutes) * 60000),
    inlierCount: best.inliers,
    photoCount: photo.length,
    expectedRandom,
    hypotheses,
    logOdds,
  };
};

export interface HorizonView {
  azimuthDeg: number; // 광축 방위 (북 0°, 동 90°)
  altitudeDeg: number; // 광축 고도
  rollDeg: number; // 광축을 축으로 돈 각도 (0이면 사진 위쪽이 천정 쪽)
  fovDeg: number; // 짧은 변 기준 시야각
}

// 시각·장소·카메라 방향으로 변환을 만든다 (합성 시험용). 사진 오른쪽은 x, 아래쪽은 y.
export const horizonCameraTP = (
  date: Date,
  observer: Observer,
  view: HorizonView,
  W: number,
  H: number,
): Mat3 => {
  const jd = julianDay(date);
  const Z = norm(ofDateToJ2000(zenithVector(jd, observer), jd));
  const E = norm(cross([0, 0, 1], Z));
  const N = cross(Z, E);
  const az = view.azimuthDeg * D;
  const alt = view.altitudeDeg * D;
  const z = add(
    scale(N, Math.cos(alt) * Math.cos(az)),
    scale(E, Math.cos(alt) * Math.sin(az)),
    scale(Z, Math.sin(alt)),
  );
  // 아래쪽(y)은 천정의 반대쪽, 오른쪽(x)은 y × z. 그다음 광축을 축으로 roll만큼 돌린다.
  const y0 = norm(scale(add(Z, scale(z, -dot(Z, z))), -1));
  const x0 = cross(y0, z);
  const x = rotate(x0, z, view.rollDeg * D);
  const y = rotate(y0, z, view.rollDeg * D);
  const f = focal(view.fovDeg, W, H);

  return [
    add(scale(x, f), scale(z, W / 2)),
    add(scale(y, f), scale(z, H / 2)),
    z,
  ];
};

const focal = (fovDeg: number, W: number, H: number) =>
  Math.min(W, H) / 2 / Math.tan((fovDeg / 2) * D);

const rotateTowardZenith = (v: V, Z: V, t: number): V => {
  if (t === 0) {
    return v;
  }

  const axis = cross(v, Z);
  const n = Math.hypot(axis[0], axis[1], axis[2]);

  return n < 1e-9 ? v : rotate(v, scale(axis, 1 / n), t);
};

// 카메라 → 하늘: d = a1·e1 + a2·e2 + a3·zc 이면 하늘 방향은
// a1(cosθN + sinθE) + a2(−sinθN + cosθE) + a3·Z. TP의 R은 카메라 x·y·z축의 하늘 방향이 행이다.
const cameraTP = (
  { Z, E, N }: Frame,
  theta: number,
  f: number,
  B: [V, V, V],
  cx: number,
  cy: number,
): Mat3 => {
  const col1 = add(scale(N, Math.cos(theta)), scale(E, Math.sin(theta)));
  const col2 = add(scale(N, -Math.sin(theta)), scale(E, Math.cos(theta)));
  const toSky = (c: V): V =>
    add(
      scale(col1, dot(c, B[0])),
      scale(col2, dot(c, B[1])),
      scale(Z, dot(c, B[2])),
    );
  const R = [toSky([1, 0, 0]), toSky([0, 1, 0]), toSky([0, 0, 1])];

  return [
    add(scale(R[0], f), scale(R[2], cx)),
    add(scale(R[1], f), scale(R[2], cy)),
    R[2],
  ];
};

// 사진에 보이는 만큼의 밝은 하늘 별(사진 별 수 × 배수)을 투영해 서로 가장 가까운 짝을 센다
const countInliers = (
  TP: Mat3,
  photo: Point2D[],
  sky: SkyStar[],
  W: number,
  H: number,
  tolPx: number,
  isSky: (p: Point2D) => boolean,
  catalogRatio: number,
) => {
  const inView: Point2D[] = [];
  const limit = photo.length * catalogRatio;

  for (const s of sky) {
    const v = s.apparent;
    const z = dot(TP[2], v);

    if (z <= 0) {
      continue;
    }

    const p: Point2D = [dot(TP[0], v) / z, dot(TP[1], v) / z];

    if (p[0] >= 0 && p[0] < W && p[1] >= 0 && p[1] < H && isSky(p)) {
      inView.push(p);

      if (inView.length >= limit) {
        break;
      }
    }
  }

  const tol2 = tolPx * tolPx;
  const d2 = (a: Point2D, b: Point2D) =>
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

  const nearest = (p: Point2D, list: Point2D[]) => {
    let k = -1;
    let bestD = tol2;

    list.forEach((q, i) => {
      const d = d2(p, q);

      if (d <= bestD) {
        bestD = d;
        k = i;
      }
    });

    return { k, d: bestD };
  };

  let inliers = 0;
  let sumSq = 0;

  photo.forEach((p, i) => {
    const { k, d } = nearest(p, inView);

    if (k >= 0 && nearest(inView[k], photo).k === i) {
      inliers++;
      sumSq += d;
    }
  });

  return { inliers, sumSq, catalogInView: inView.length };
};

// 사진에서 지평선 위(하늘 쪽) 면적의 비율 (격자로 어림)
const skyFraction = (W: number, H: number, isSky: (p: Point2D) => boolean) => {
  let n = 0;

  for (let i = 0; i < 20; i++) {
    for (let j = 0; j < 20; j++) {
      if (isSky([((i + 0.5) * W) / 20, ((j + 0.5) * H) / 20])) {
        n++;
      }
    }
  }

  return Math.max(n, 1) / 400;
};
