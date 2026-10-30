import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Glow } from "@/search/milkyWayGlow";
import type { SolvePhotoOptions, SolvePhotoResult } from "@/search/solvePhoto";
import type {
  ImageSize,
  InputStar,
  SolveOutcome,
  SolverContext,
} from "@/search/solvers";
import type { Mat3 } from "@/search/utils/similarity";
import { galacticToEquatorial } from "@/search/hooks/useSkyOverlay";
import { scorePose } from "@/search/solveCore";
import { heldOutLogOdds, polish, solvePhoto } from "@/search/solvePhoto";
import { ACCEPT, isConfident } from "@/search/solvers/candidates";
import { rankForSolving } from "@/search/utils/selectStars";
import { photoToSky } from "@/search/utils/wcs";

// 은하수 띠·지도 대조 풀이 (journey 50·51·57장). 별 모양 맞추기(blind)가 은하수 빛에 묻혀 출발점을 못 잡는 사진에서,
// 사진의 흐린 밝기로 은하수 띠의 중심선(은위 0°, 직선투영에서 직선)을 찾아 사진 회전을 정하고,
// 남은 은경은 검출 별과 카탈로그 별의 "띠 기준 위도가 같은 짝"으로 투표한다. 표가 몰린 자세들을
// 별 점수 순과 은하수 지도 대조 순으로 고르고, 앱과 같은 확신 기준(국소 밀도·교차 검증)을 넘은 것만 받는다.
// 띠와 지도는 후보를 만드는 데만 쓰고 확신은 별로 판단하므로 틀린 확신 위험은 늘지 않는다.

// 은하수 밝기 지도: 은하 좌표 등장방형(가운데가 은하 중심, 은경은 왼쪽으로 커진다), 회색조, 흐림까지 적용한 값.
// 출처: ESO/S. Brunier (eso0932a), CC BY 4.0. 360×180으로 줄이고 흐림 2px를 줘도 원본(1280×640)과 같은 사진을 푼다 (journey 57장)
export interface SkyMap {
  data: Uint8Array;
  w: number;
  h: number;
}

// 띠 반폭(짧은 변 비율), 선 후보 수
const BAND = 0.08;
const LINE_TOP = 5;
// 짧은 변 시야각(도) 후보
const FOVS = [12, 16, 20, 25, 30, 36, 42, 50, 58, 66, 75];
const VOTE_STARS = 80;
const PEAKS = 3;
// 찾은 선은 은위 0°에서 1~2° 어긋나도 짝이 엇나가 각도(±6°)·위치(은위 ±8°)를 흔들어 투표한다.
// 가장 밝은 줄은 암흑대 때문에 대개 은위 0°에서 4° 안팎 어긋난다 (풀린 은하수 86장 평균 단면의 최고점 −4°, journey 50장)
const JITTER_STEPS = [-3, -2, -1, 0, 1, 2, 3];
const OFFSET_DEG = 8;
// 별 점수로 고를 표 많은 자세 수, 지도 대조할 자세 수와 그중 고를 수, 정밀화할 상위 수 (속도: journey 51장)
export interface MilkyWayTuning {
  starPool: number;
  templatePool: number;
  mapPick: number;
}

// 별 점수로 고를 표 많은 자세 수, 지도 대조할 자세 수와 그중 고를 수. 300·1000·300(지도 48칸)이면 2.1초에 7장,
// 600·3000·600(지도 96칸)이면 4.5초에 8장 (못 푼 은하수 76장, journey 57장)
export const DEFAULT_MILKY_WAY_TUNING: MilkyWayTuning = {
  starPool: 600,
  templatePool: 3000,
  mapPick: 600,
};
const POLISH_TOP = 8;
// 지도 대조 점수에 곱하는 무게 (별 점수 + 10 × 상관)
const MAP_WEIGHT = 10;
// 교차 검증 하한 (solvePhoto와 같다)
const MIN_HELD_OUT = 3;
// 선 찾기에 쓸 하늘 칸이 이보다 적으면 풀지 않는다
const MIN_SKY_CELLS = 60;

const dot = (a: number[], b: number[]) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: number[], b: number[]): Point3D => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const norm = (a: number[]): Point3D => {
  const n = Math.hypot(a[0], a[1], a[2]);

  return [a[0] / n, a[1] / n, a[2] / n];
};

const NGP = galacticToEquatorial(0, 90);
const GAL_L0 = galacticToEquatorial(0, 0);
const GAL_L90 = galacticToEquatorial(90, 0);

// 검출이 있는 칸과 그 이웃만 하늘로 본다 (지상 제외)
const skyMask = (
  stars: { x: number; y: number }[],
  W: number,
  H: number,
  cols: number,
  rows: number,
) => {
  const has = new Uint8Array(cols * rows);

  for (const st of stars) {
    has[
      Math.min(rows - 1, Math.max(0, Math.floor((st.y / H) * rows))) * cols +
        Math.min(cols - 1, Math.max(0, Math.floor((st.x / W) * cols)))
    ] = 1;
  }

  const mask = new Uint8Array(cols * rows);

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      for (let dj = -1; dj <= 1 && !mask[j * cols + i]; dj++) {
        for (let di = -1; di <= 1; di++) {
          const jj = j + dj;
          const ii = i + di;

          if (
            jj >= 0 &&
            jj < rows &&
            ii >= 0 &&
            ii < cols &&
            has[jj * cols + ii]
          ) {
            mask[j * cols + i] = 1;
            break;
          }
        }
      }
    }
  }

  return mask;
};

// 하늘 칸에서 밝기 평면(a + b·i + c·j)을 최소제곱으로 맞춰 뺀다 (지평선 빛·광해 기울기)
const planeResidual = (
  vals: ArrayLike<number>,
  cols: number,
  rows: number,
  mask: Uint8Array,
) => {
  let n = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  let sv = 0;
  let sxv = 0;
  let syv = 0;

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (!mask[j * cols + i]) {
        continue;
      }

      const v = vals[j * cols + i];
      n++;
      sx += i;
      sy += j;
      sxx += i * i;
      syy += j * j;
      sxy += i * j;
      sv += v;
      sxv += i * v;
      syv += j * v;
    }
  }

  const A = [
    [n, sx, sy],
    [sx, sxx, sxy],
    [sy, sxy, syy],
  ];
  const B = [sv, sxv, syv];
  const det3 = (M: number[][]) =>
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
    M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
    M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  const D = det3(A);
  const coef =
    Math.abs(D) > 1e-9
      ? [0, 1, 2].map(
          (k) =>
            det3(A.map((row, r) => row.map((x, c) => (c === k ? B[r] : x)))) /
            D,
        )
      : [n ? sv / n : 0, 0, 0];
  const out = new Float32Array(cols * rows);

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      out[j * cols + i] =
        vals[j * cols + i] - (coef[0] + coef[1] * i + coef[2] * j);
    }
  }

  return out;
};

// ─── 띠 중심선 ─────────────────────────────────────────────────
// 직선: 법선 각 θ(도), 사진 가운데에서 거리 ρ(칸). 모든 직선(2°·1칸 간격) 중
// "선 둘레 띠(±BAND)의 평균 − 바깥 평균"이 큰 것을 서로 떨어진 것끼리 LINE_TOP개
const findBandLines = (
  res: Float32Array,
  cols: number,
  rows: number,
  mask: Uint8Array,
) => {
  const skyN = mask.reduce((a, b) => a + b, 0);
  const half = BAND * Math.min(cols, rows);
  const cx = cols / 2;
  const cy = rows / 2;
  const rMax = Math.hypot(cx, cy);
  const all: { theta: number; rho: number; score: number }[] = [];

  for (let t = 0; t < 180; t += 2) {
    const c = Math.cos((t * Math.PI) / 180);
    const s = Math.sin((t * Math.PI) / 180);

    for (let rho = -rMax * 0.8; rho <= rMax * 0.8; rho += 1) {
      let inS = 0;
      let inN = 0;
      let outS = 0;
      let outN = 0;

      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          if (!mask[j * cols + i]) {
            continue;
          }

          const d = Math.abs((i + 0.5 - cx) * c + (j + 0.5 - cy) * s - rho);
          const v = res[j * cols + i];

          if (d < half) {
            inS += v;
            inN++;
          } else {
            outS += v;
            outN++;
          }
        }
      }

      if (inN < 0.05 * skyN || outN < 0.2 * skyN) {
        continue;
      }

      all.push({ theta: t, rho, score: inS / inN - outS / outN });
    }
  }

  all.sort((a, b) => b.score - a.score);

  const top: typeof all = [];
  const minDim = Math.min(cols, rows);

  for (const l of all) {
    if (top.length >= LINE_TOP) {
      break;
    }

    const far = top.every((o) => {
      let dt = Math.abs(o.theta - l.theta);
      let dr = Math.abs(o.rho - l.rho);

      if (dt > 90) {
        dt = 180 - dt;
        dr = Math.abs(o.rho + l.rho);
      }

      return dt > 10 || dr > 0.1 * minDim;
    });

    if (far) {
      top.push(l);
    }
  }

  return top;
};

// ─── 은경 투표 ─────────────────────────────────────────────────
// 카탈로그 별의 "은하 북극(또는 남극) 기준 위도·경도". 위도 순 정렬 (이분 탐색용). 풀이 묶음마다 한 번
const galacticCache = new WeakMap<
  SolverContext,
  { lat: number; lon: number }[][]
>();

const catalogGalactic = (ctx: SolverContext) => {
  const hit = galacticCache.get(ctx);

  if (hit) {
    return hit;
  }

  const out = ([1, -1] as const).map((sign) => {
    const target = sign === 1 ? NGP : (NGP.map((v) => -v) as Point3D);
    const aEq = norm(GAL_L0.map((v, k) => v - dot(GAL_L0, target) * target[k]));
    const bEq = cross(target, aEq);

    return ctx.catalog
      .map((s) => ({
        lat: (Math.asin(dot(s.vector, target)) * 180) / Math.PI,
        lon:
          (Math.atan2(dot(s.vector, bEq), dot(s.vector, aEq)) * 180) / Math.PI,
      }))
      .sort((a, b) => a.lat - b.lat);
  });

  galacticCache.set(ctx, out);

  return out;
};

// 띠 중심선(픽셀: 법선 n, 가운데에서 거리 rhoPx) · 초점 거리 f · 북/남으로 후보 자세들.
// 선은 카메라 좌표에서 원점을 지나는 평면이다. 그 법선을 은하 북극(남극)에 맞추면 남는 자유도는 은경 φ 하나:
// 은위가 같은 짝마다 φ = 카탈로그 경도 − 검출 경도에 한 표(0.5° 칸)
const posesForLine = (
  n2: [number, number],
  rhoPx: number,
  f: number,
  sign: 1 | -1,
  W: number,
  H: number,
  vote: Point2D[],
  catalog: { lat: number; lon: number }[][],
): { TP: Mat3; votes: number }[] => {
  const cx = W / 2;
  const cy = H / 2;
  const t2: [number, number] = [-n2[1], n2[0]];
  const foot: [number, number] = [cx + rhoPx * n2[0], cy + rhoPx * n2[1]];
  const dirOf = (p: Point2D): Point3D =>
    norm([(p[0] - cx) / f, (p[1] - cy) / f, 1]);
  const d1 = dirOf([foot[0] + 1000 * t2[0], foot[1] + 1000 * t2[1]]);
  const d2 = dirOf([foot[0] - 1000 * t2[0], foot[1] - 1000 * t2[1]]);
  const nCam = norm(cross(d1, d2));
  const fd = dirOf(foot);
  const aCam = norm(fd.map((v, k) => v - dot(fd, nCam) * nCam[k]));
  const bCam = cross(nCam, aCam);
  const target = sign === 1 ? NGP : (NGP.map((v) => -v) as Point3D);
  const aEq = norm(GAL_L0.map((v, k) => v - dot(GAL_L0, target) * target[k]));
  const bEq = cross(target, aEq);
  const tolDeg =
    ((Math.max(5, Math.hypot(W, H) * 0.006) * 1.5) / f) * (180 / Math.PI);
  const bins = new Float32Array(720);
  const cat = catalog[sign === 1 ? 0 : 1];

  for (const p of vote) {
    const d = dirOf(p);
    const lat =
      (Math.asin(Math.max(-1, Math.min(1, dot(d, nCam)))) * 180) / Math.PI;
    const lon = (Math.atan2(dot(d, bCam), dot(d, aCam)) * 180) / Math.PI;
    let lo = 0;
    let hi = cat.length;

    while (lo < hi) {
      const mid = (lo + hi) >> 1;

      if (cat[mid].lat < lat - tolDeg) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    for (let k = lo; k < cat.length && cat[k].lat <= lat + tolDeg; k++) {
      const phi = (((cat[k].lon - lon) % 360) + 360) % 360;
      bins[Math.floor(phi * 2) % 720] += 1;
    }
  }

  // 이웃 칸까지 합친 점수로 상위 봉우리 (이미 고른 봉우리 ±3° 안은 건너뛴다)
  const sm = new Float32Array(720);

  for (let i = 0; i < 720; i++) {
    sm[i] = bins[(i + 719) % 720] + bins[i] + bins[(i + 1) % 720];
  }

  const peaks: { phi: number; votes: number }[] = [];

  while (peaks.length < PEAKS) {
    let bi = -1;

    for (let i = 0; i < 720; i++) {
      if (bi >= 0 && sm[i] <= sm[bi]) {
        continue;
      }

      if (
        peaks.some((pk) => Math.abs(((pk.phi - i / 2 + 540) % 360) - 180) < 3)
      ) {
        continue;
      }

      bi = i;
    }

    if (bi < 0) {
      break;
    }

    peaks.push({ phi: bi / 2 + 0.25, votes: sm[bi] });
  }

  return peaks.map(({ phi, votes }) => {
    const c = Math.cos((phi * Math.PI) / 180);
    const s = Math.sin((phi * Math.PI) / 180);

    // 카메라 방향 d → 적도: α(c·aEq + s·bEq) + β(−s·aEq + c·bEq) + γ·target
    const toEq = (d: Point3D): Point3D => {
      const al = dot(d, aCam);
      const be = dot(d, bCam);
      const ga = dot(d, nCam);

      return [0, 1, 2].map(
        (k) =>
          al * (c * aEq[k] + s * bEq[k]) +
          be * (-s * aEq[k] + c * bEq[k]) +
          ga * target[k],
      ) as Point3D;
    };

    // R(적도 → 카메라)의 행 = 카메라 축을 적도로 옮긴 것
    const R = [toEq([1, 0, 0]), toEq([0, 1, 0]), toEq([0, 0, 1])];
    const TP: Mat3 = [
      [0, 1, 2].map((k) => f * R[0][k] + cx * R[2][k]),
      [0, 1, 2].map((k) => f * R[1][k] + cy * R[2][k]),
      [R[2][0], R[2][1], R[2][2]],
    ] as Mat3;

    return { TP, votes };
  });
};

// ─── 지도 대조 ─────────────────────────────────────────────────
// 적도 방향 → 지도 밝기 (가까운 칸)
const mapAt = (m: SkyMap, v: Point3D): number => {
  const l = Math.atan2(dot(v, GAL_L90), dot(v, GAL_L0));
  const b = Math.asin(Math.max(-1, Math.min(1, dot(v, NGP))));
  const x = Math.round(m.w / 2 - (l / (2 * Math.PI)) * m.w);
  const y = Math.round(m.h / 2 - (b / Math.PI) * m.h);

  return m.data[
    Math.min(m.h - 1, Math.max(0, y)) * m.w + (((x % m.w) + m.w) % m.w)
  ];
};

// 자세마다 사진 칸의 은경·은위에서 지도를 읽어 "보여야 할 은하수"를 만들고, 사진의 흐린 밝기와 상관을 잰다 (둘 다 밝기 평면을 뺀 뒤)
const templateCorr = (
  m: SkyMap,
  photoRes: Float32Array,
  cols: number,
  rows: number,
  mask: Uint8Array,
  pose: Mat3,
  W: number,
  H: number,
): number => {
  const tmpl = new Float32Array(cols * rows);

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (mask[j * cols + i]) {
        tmpl[j * cols + i] = mapAt(
          m,
          photoToSky(pose, [((i + 0.5) * W) / cols, ((j + 0.5) * H) / rows]),
        );
      }
    }
  }

  const b = planeResidual(tmpl, cols, rows, mask);
  let ma = 0;
  let mb = 0;
  let n = 0;

  for (let k = 0; k < b.length; k++) {
    if (mask[k]) {
      ma += photoRes[k];
      mb += b[k];
      n++;
    }
  }

  ma /= n;
  mb /= n;

  let cov = 0;
  let va = 0;
  let vb = 0;

  for (let k = 0; k < b.length; k++) {
    if (mask[k]) {
      cov += (photoRes[k] - ma) * (b[k] - mb);
      va += (photoRes[k] - ma) ** 2;
      vb += (b[k] - mb) ** 2;
    }
  }

  return va > 1e-9 && vb > 1e-9 ? cov / Math.sqrt(va * vb) : 0;
};

// ─── 풀이 ─────────────────────────────────────────────────────
export const solveByMilkyWay = (
  allStars: InputStar[],
  size: ImageSize,
  ctx: SolverContext,
  glows: { band: Glow; map: Glow },
  skyMap: SkyMap | null,
  deadline: number,
  tuning: MilkyWayTuning = DEFAULT_MILKY_WAY_TUNING,
): SolveOutcome | null => {
  const t0 = performance.now();
  const W = size.width;
  const H = size.height;
  // 하늘 칸은 별 궤적 점까지 포함한 검출로, 풀이 입력은 궤적 점을 뺀 검출로 (실험과 같게)
  const detected = allStars.filter((s) => !s.coarse);
  const stars = detected.filter((s) => !s.trail);
  const glow = glows.band;
  const { cols, rows } = glow;
  const mask = skyMask(detected, W, H, cols, rows);

  if (mask.reduce((a, b) => a + b, 0) < MIN_SKY_CELLS) {
    return null;
  }

  const lines = findBandLines(
    planeResidual(glow.data, cols, rows, mask),
    cols,
    rows,
    mask,
  );
  const cell = W / cols;
  const ranked = rankForSolving(stars, W, H) as InputStar[];
  // 투표에는 우선순위 상위와 밝기 상위를 함께 (띠 속 밝은 별이 별다움에서 밀려도 들어가게)
  const byBright = [...ranked].sort((a, b) => b.brightness - a.brightness);
  const voteSet = new Map<string, Point2D>();

  for (const s of [
    ...ranked.slice(0, VOTE_STARS),
    ...byBright.slice(0, VOTE_STARS),
  ]) {
    voteSet.set(`${s.x},${s.y}`, [s.x, s.y]);
  }

  const vote = [...voteSet.values()];
  const top150 = ranked.slice(0, 150).map((s): Point2D => [s.x, s.y]);
  const opts = { imageWidth: W, imageHeight: H };
  const catalog = catalogGalactic(ctx);
  const voted: { TP: Mat3; votes: number }[] = [];

  for (const ln of lines) {
    if (performance.now() >= deadline) {
      return null;
    }

    for (const dt of JITTER_STEPS) {
      const th = ((ln.theta + dt * 2) * Math.PI) / 180;

      for (const fov of FOVS) {
        const f = Math.min(W, H) / 2 / Math.tan((fov * Math.PI) / 360);

        for (let off = -OFFSET_DEG; off <= OFFSET_DEG; off++) {
          for (const sign of [1, -1] as const) {
            voted.push(
              ...posesForLine(
                [Math.cos(th), Math.sin(th)],
                ln.rho * cell + f * Math.tan((off * Math.PI) / 180),
                f,
                sign,
                W,
                H,
                vote,
                catalog,
              ),
            );
          }
        }
      }
    }
  }

  voted.sort((a, b) => b.votes - a.votes);

  // 두 가지로 줄 세워 상위를 함께 정밀화한다: 가. 표 많은 자세를 별 점수 순으로, 나. 지도 대조 상관으로 고른 뒤 별 점수 + 10 × 상관 순으로
  const cands: Mat3[] = [];
  const byStar: { TP: Mat3; quick: number }[] = [];

  for (const { TP } of voted.slice(0, tuning.starPool)) {
    const q = scorePose(TP, top150, ctx.catalog, opts);

    if (q) {
      byStar.push({ TP: q.TP, quick: q.logOdds });
    }
  }

  byStar.sort((x, y) => y.quick - x.quick);
  cands.push(...byStar.slice(0, POLISH_TOP).map((c) => c.TP));

  if (skyMap && performance.now() < deadline) {
    const small = glows.map;

    {
      const m2 = skyMask(detected, W, H, small.cols, small.rows);
      const photoRes = planeResidual(small.data, small.cols, small.rows, m2);
      const pool = voted.slice(0, tuning.templatePool).map((v) => ({
        TP: v.TP,
        corr: templateCorr(
          skyMap,
          photoRes,
          small.cols,
          small.rows,
          m2,
          v.TP,
          W,
          H,
        ),
      }));
      const byMap: { TP: Mat3; quick: number }[] = [];

      pool.sort((x, y) => y.corr - x.corr);

      for (const { TP, corr } of pool.slice(0, tuning.mapPick)) {
        const q = scorePose(TP, top150, ctx.catalog, opts);

        if (q) {
          byMap.push({ TP: q.TP, quick: q.logOdds + MAP_WEIGHT * corr });
        }
      }

      byMap.sort((x, y) => y.quick - x.quick);
      cands.push(...byMap.slice(0, POLISH_TOP).map((c) => c.TP));
    }
  }

  // 정밀화한 뒤 앱과 같은 기준: 확신 판정 + 국소 밀도(우선순위 상위 150개) ≥ 9 + 교차 검증 ≥ 3,
  // 또는 그럴듯한 해가 6등급 별까지 넣은 같은 기준을 넘으면 (journey 48장)
  let best: { out: SolveOutcome; local: number; ok: boolean } | null = null;

  for (const TP of cands) {
    if (performance.now() >= deadline) {
      break;
    }

    const out = polish(
      {
        found: false,
        centerVector: photoToSky(TP, [W / 2, H / 2]),
        fovDeg: 0,
        transform: TP,
        confidence: 0,
        inlierCount: 0,
        candidatesEvaluated: 0,
        timeMs: 0,
        candidates: [],
      },
      ranked,
      size,
      ctx,
    );

    if (!out.transform || !out.centerVector) {
      continue;
    }

    const local =
      scorePose(out.transform, top150, ctx.catalog, opts)?.logOdds ?? 0;
    const cand = {
      centerVector: out.centerVector,
      fovDeg: out.fovDeg ?? 0,
      transform: out.transform,
      confidence: out.confidence,
      inlierCount: out.inlierCount ?? 0,
    };
    let ok =
      isConfident({
        inlierCount: cand.inlierCount,
        fovDeg: cand.fovDeg,
        logOdds: out.confidence,
      }) &&
      local >= ACCEPT.minLogOdds &&
      heldOutLogOdds(cand, ranked, size, ctx) >= MIN_HELD_OUT;

    // 그럴듯한가(inlier·시야)는 점수를 빼고 확신 판정으로 본다 (실험과 같게)
    if (
      !ok &&
      ctx.verifyCatalog &&
      isConfident({
        inlierCount: cand.inlierCount,
        fovDeg: cand.fovDeg,
        logOdds: 99,
      })
    ) {
      const deep = { ...ctx, catalog: ctx.verifyCatalog };
      const deepLocal =
        scorePose(out.transform, top150, deep.catalog, opts)?.logOdds ?? 0;

      ok =
        deepLocal >= ACCEPT.minLogOdds &&
        heldOutLogOdds(cand, ranked, size, deep) >= MIN_HELD_OUT;
    }

    if (!best || (ok && !best.ok) || (ok === best.ok && local > best.local)) {
      best = { out, local, ok };
    }

    if (ok) {
      break;
    }
  }

  if (!best?.ok) {
    return null;
  }

  return {
    ...best.out,
    found: true,
    candidates: [],
    timeMs: performance.now() - t0,
  };
};

// ─── 앱 흐름에 붙이기 ──────────────────────────────────────────
// 기존 풀이(solvePhoto, 8초 상한)가 확신하지 못했을 때만, 그 뒤에 이 시간 동안 은하수 단계를 돌린다.
// 지금 풀리는 사진은 그대로 풀리고, 늘어나는 시간은 못 푼 사진에만 생긴다 (journey 57장)
export const MILKY_WAY_BUDGET_MS = 6000;

export interface MilkyWayInput {
  glows: { band: Glow; map: Glow };
  skyMap: SkyMap | null;
  budgetMs?: number;
  tuning?: MilkyWayTuning;
}

export const solvePhotoWithMilkyWay = (
  stars: InputStar[],
  size: ImageSize,
  ctx: SolverContext,
  milkyWay: MilkyWayInput | null,
  options: SolvePhotoOptions = {},
): SolvePhotoResult => {
  const t0 = performance.now();
  const first = solvePhoto(stars, size, ctx, undefined, options);

  if (first.found || !milkyWay) {
    return first;
  }

  options.onPhase?.({ kind: "milkyWay" });

  const out = solveByMilkyWay(
    stars,
    size,
    ctx,
    milkyWay.glows,
    milkyWay.skyMap,
    performance.now() + (milkyWay.budgetMs ?? MILKY_WAY_BUDGET_MS),
    milkyWay.tuning,
  );

  return out
    ? {
        ...out,
        timedOut: false,
        // 사람이 고를 후보는 기존 풀이의 것을 그대로 (확신한 답이 맨 앞)
        candidates: [
          {
            centerVector: out.centerVector!,
            fovDeg: out.fovDeg ?? 0,
            transform: out.transform!,
            confidence: out.confidence,
            inlierCount: out.inlierCount ?? 0,
          },
          ...first.candidates,
        ],
        timeMs: performance.now() - t0,
      }
    : { ...first, timeMs: performance.now() - t0 };
};
