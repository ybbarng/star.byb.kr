import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { umeyamaSimilarity2D } from "@/search/utils/similarity";
import {
  mat3Mul,
  mat3MulVec,
  projectionMatrix,
  projectVecToPhoto,
  recoverCenter,
} from "@/search/utils/wcs";

// 어안 카메라 모델. 기본은 등거리(r = f·θ)이고, 실제 렌즈의 이탈을 잡으려 θ 다항식
// 항 k1을 둔다: r = f·(θ + k1·θ³). 광학중심(pcx,pcy)도 자유 변수(크롭/디센터 대응).
// TP는 카탈로그 방향을 "직선투영 등가 평면 [tanθ·cosφ, tanθ·sinφ]"으로 보내는 변환.
export interface FisheyeCamera {
  TP: Mat3;
  pcx: number;
  pcy: number;
  ffish: number;
  k1: number;
}

// 관측 반경 r에서 광축 각도 θ를 구한다 (r/f = θ + k1·θ³, Newton).
const angleFromRadius = (rOverF: number, k1: number): number => {
  let theta = rOverF;

  for (let i = 0; i < 6; i++) {
    const g = theta + k1 * theta * theta * theta - rOverF;
    const gp = 1 + 3 * k1 * theta * theta;
    theta -= g / gp;
  }

  return theta;
};

// 관측(어안) 픽셀 → 직선투영 등가 좌표
export const rectify = (
  x: number,
  y: number,
  pcx: number,
  pcy: number,
  ffish: number,
  k1: number,
): Point2D => {
  const xc = x - pcx;
  const yc = y - pcy;
  const r = Math.hypot(xc, yc);

  if (r < 1e-9) {
    return [0, 0];
  }

  const theta = angleFromRadius(r / ffish, k1);
  const t = Math.tan(theta);

  return [(t * xc) / r, (t * yc) / r];
};

// 직선투영 등가 좌표 → 관측(어안) 픽셀
export const fisheyeForward = (
  u: number,
  v: number,
  pcx: number,
  pcy: number,
  ffish: number,
  k1: number,
): Point2D => {
  const rt = Math.hypot(u, v);

  if (rt < 1e-9) {
    return [pcx, pcy];
  }

  const theta = Math.atan(rt);
  const rObs = ffish * (theta + k1 * theta * theta * theta);

  return [pcx + (rObs * u) / rt, pcy + (rObs * v) / rt];
};

// 카탈로그 방향 → 어안 사진 픽셀. 광축 반대 반구면 null.
export const projectFisheye = (
  cam: FisheyeCamera,
  v: Point3D,
): Point2D | null => {
  const uv = projectVecToPhoto(cam.TP, v);

  if (!uv) {
    return null;
  }

  return fisheyeForward(uv[0], uv[1], cam.pcx, cam.pcy, cam.ffish, cam.k1);
};

// 직선투영 등가 좌표(rectified)와 카탈로그 방향 대응으로 포즈(TP) 피팅.
// rectified는 광학중심(원점) 기준이므로 광축은 rectified 원점([0,0])이다.
const fitPoseRect = (pts: { p: Point2D; v: Point3D }[]): Mat3 => {
  let cx = 0;
  let cy = 0;
  let cz = 0;

  for (const c of pts) {
    cx += c.v[0];
    cy += c.v[1];
    cz += c.v[2];
  }

  const n = Math.hypot(cx, cy, cz);
  let center: Point3D = [cx / n, cy / n, cz / n];
  let P = projectionMatrix(center);

  const planeOf = (p: Mat3): Point2D[] =>
    pts.map((c) => {
      const t = mat3MulVec(p, c.v);

      return [t[0] / t[2], t[1] / t[2]] as Point2D;
    });

  let T = umeyamaSimilarity2D(
    planeOf(P),
    pts.map((c) => c.p),
  ).matrix;

  for (let iter = 0; iter < 8; iter++) {
    center = recoverCenter(mat3Mul(T, P), 0, 0);
    P = projectionMatrix(center);
    T = umeyamaSimilarity2D(
      planeOf(P),
      pts.map((c) => c.p),
    ).matrix;
  }

  return mat3Mul(T, P);
};

export interface FisheyeFit {
  camera: FisheyeCamera;
  rms: number;
  maxRes: number;
  used: number; // 피팅에 실제로 쓴 라벨 수
  dropped: number; // 이상치로 제외한 라벨 수
}

const IDENTITY: Mat3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

type Corr = { x: number; y: number; v: Point3D };

// 한 점 집합에 대한 평가 함수 (파라미터 → TP·RMS). 부분집합 재피팅에 재사용한다.
const makeEval =
  (pts: Corr[]) => (pcx: number, pcy: number, ffish: number, k1: number) => {
    try {
      const TP = fitPoseRect(
        pts.map((c) => ({ p: rectify(c.x, c.y, pcx, pcy, ffish, k1), v: c.v })),
      );
      let sse = 0;
      let maxRes = 0;

      for (const c of pts) {
        const uv = projectVecToPhoto(TP, c.v);
        const obs = uv
          ? fisheyeForward(uv[0], uv[1], pcx, pcy, ffish, k1)
          : null;
        const res = obs ? Math.hypot(obs[0] - c.x, obs[1] - c.y) : Infinity;
        sse += res * res;
        maxRes = Math.max(maxRes, res);
      }

      const rms = Math.sqrt(sse / pts.length);

      return { TP, rms: Number.isFinite(rms) ? rms : Infinity, maxRes };
    } catch {
      return { TP: IDENTITY, rms: Infinity, maxRes: Infinity };
    }
  };

type EvalFn = ReturnType<typeof makeEval>;

// (pcx,pcy,ffish,k1) 좌표하강. 시작점 P0에서 스텝을 줄여가며 픽셀 RMS를 최소화.
const descend = (ev: EvalFn, P0: number[], scale: number[]) => {
  let P = P0.slice();
  const m = ev(P[0], P[1], P[2], P[3]);
  let bestRms = m.rms;
  let bestTP = m.TP;
  const step = scale.slice();

  for (let round = 0; round < 400; round++) {
    let improved = false;

    for (let i = 0; i < 4; i++) {
      for (const dir of [1, -1]) {
        const cand = P.slice();
        cand[i] += dir * step[i];
        const c = ev(cand[0], cand[1], cand[2], cand[3]);

        if (c.rms < bestRms - 1e-6) {
          bestRms = c.rms;
          bestTP = c.TP;
          P = cand;
          improved = true;
        }
      }
    }

    if (!improved) {
      for (let i = 0; i < 4; i++) {
        step[i] *= 0.5;
      }

      if (step[0] < 0.02 && step[2] < 0.02) {
        break;
      }
    }
  }

  return { P, rms: bestRms, TP: bestTP };
};

const camOf = (P: number[], TP: Mat3): FisheyeCamera => ({
  TP,
  pcx: P[0],
  pcy: P[1],
  ffish: P[2],
  k1: P[3],
});

// 시작점 P0에서 좌표하강 + 이상치 robust 제거로 카메라를 푼다(격자 탐색 없이).
const solveFrom = (
  corr: Corr[],
  P0: number[],
  imageW: number,
  imageH: number,
): FisheyeFit => {
  const diag = Math.hypot(imageW, imageH);
  const scale = [imageW / 20, imageH / 20, diag / 20, 0.05];

  let pts = corr.slice();
  let r = descend(makeEval(pts), P0, scale);
  let cam = camOf(r.P, r.TP);
  let curRms = r.rms;

  // robust: 가장 어긋난 점을 빼고 다시 맞춰 RMS가 크게 좋아질 때만(0.8배 미만) 버린다.
  // 이미 충분히 정확하면(≤4px) 건드리지 않는다.
  let dropped = 0;

  for (let iter = 0; iter < 4 && pts.length > 6 && curRms > 4; iter++) {
    const res = pts.map((c) => {
      const p = projectFisheye(cam, c.v);

      return p ? Math.hypot(p[0] - c.x, p[1] - c.y) : Infinity;
    });
    let worst = 0;
    let wi = -1;

    res.forEach((v, i) => {
      if (v > worst) {
        worst = v;
        wi = i;
      }
    });

    if (wi < 0) {
      break;
    }

    const trialPts = pts.filter((_, i) => i !== wi);
    const tr = descend(makeEval(trialPts), r.P, scale);

    if (tr.rms >= curRms * 0.8) {
      break;
    }

    pts = trialPts;
    r = tr;
    cam = camOf(r.P, r.TP);
    curRms = tr.rms;
    dropped++;
  }

  const fm = makeEval(pts)(cam.pcx, cam.pcy, cam.ffish, cam.k1);

  return {
    camera: cam,
    rms: fm.rms,
    maxRes: fm.maxRes,
    used: pts.length,
    dropped,
  };
};

// 라벨 대응 {x,y,v}로 어안 카메라를 피팅한다.
// (1) 광학중심·초점 격자 탐색 → (2) 좌표하강 + 이상치 robust 제거.
export const fitFisheyeCamera = (
  corr: Corr[],
  imageW: number,
  imageH: number,
): FisheyeFit => {
  const diag = Math.hypot(imageW, imageH);
  const ev0 = makeEval(corr);
  let P = [imageW / 2, imageH / 2, diag, 0];
  let gridRms = Infinity;

  for (let pcx = -imageW; pcx <= 2 * imageW; pcx += imageW / 12) {
    for (let pcy = -imageH; pcy <= 2 * imageH; pcy += imageH / 10) {
      for (let ffish = diag * 0.4; ffish <= diag * 4; ffish += diag / 15) {
        const m = ev0(pcx, pcy, ffish, 0);

        if (m.rms < gridRms) {
          gridRms = m.rms;
          P = [pcx, pcy, ffish, 0];
        }
      }
    }
  }

  return solveFrom(corr, P, imageW, imageH);
};

// 이미 거의 맞는 카메라에서 시작해 격자 없이 따뜻하게 재피팅(inlier 정밀화용).
export const refitFisheyeCamera = (
  corr: Corr[],
  start: FisheyeCamera,
  imageW: number,
  imageH: number,
): FisheyeFit =>
  solveFrom(
    corr,
    [start.pcx, start.pcy, start.ffish, start.k1],
    imageW,
    imageH,
  );

// 거친 카메라에서 시작해, 검출된 별로 카메라를 정밀화한다.
// 카탈로그 별을 투영 → 그 자리의 검출 별 중심에 맞춰 대응을 모으고 재피팅. 반복하며
// 허용오차를 좁힌다. 손라벨 몇 개보다 훨씬 많은 정확한 대응으로 정밀도·견고성↑.
export const refineFisheyeWithDetections = (
  start: FisheyeCamera,
  catalog: Point3D[],
  detected: Point2D[],
  imageW: number,
  imageH: number,
  iterations = 4,
): FisheyeFit & { matched: number } => {
  let cam = start;
  let fit: FisheyeFit = {
    camera: start,
    rms: 0,
    maxRes: 0,
    used: 0,
    dropped: 0,
  };
  let matched = 0;

  for (let it = 0; it < iterations; it++) {
    const tol = Math.max(12, 32 - it * 8); // 32→24→16→12px로 좁힘
    const tol2 = tol * tol;
    const corr: Corr[] = [];

    for (const v of catalog) {
      const p = projectFisheye(cam, v);

      if (!p || p[0] < 0 || p[0] >= imageW || p[1] < 0 || p[1] >= imageH) {
        continue;
      }

      let best = tol2;
      let bx = 0;
      let by = 0;
      let found = false;

      for (const d of detected) {
        const dd = (d[0] - p[0]) ** 2 + (d[1] - p[1]) ** 2;

        if (dd < best) {
          best = dd;
          bx = d[0];
          by = d[1];
          found = true;
        }
      }

      if (found) {
        corr.push({ x: bx, y: by, v });
      }
    }

    if (corr.length < 6) {
      break;
    }

    matched = corr.length;
    fit = solveFrom(
      corr,
      [cam.pcx, cam.pcy, cam.ffish, cam.k1],
      imageW,
      imageH,
    );
    cam = fit.camera;
  }

  return { ...fit, matched };
};
