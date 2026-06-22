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

// 등거리 어안(r = f·θ) 카메라 모델. 초광각 은하수 사진처럼 직선투영(핀홀)으로
// 안 맞는 렌즈를 다룬다. 광학중심(pcx,pcy)·어안초점(ffish)을 자유 변수로 둔다.
// TP는 카탈로그 방향을 "직선투영 등가 평면 [tanθ·cosφ, tanθ·sinφ]"으로 보내는 변환.
export interface FisheyeCamera {
  TP: Mat3;
  pcx: number;
  pcy: number;
  ffish: number;
}

// 관측(어안) 픽셀 → 직선투영 등가 좌표
export const rectify = (
  x: number,
  y: number,
  pcx: number,
  pcy: number,
  ffish: number,
): Point2D => {
  const xc = x - pcx;
  const yc = y - pcy;
  const r = Math.hypot(xc, yc);

  if (r < 1e-9) {
    return [0, 0];
  }

  const t = Math.tan(r / ffish);

  return [(t * xc) / r, (t * yc) / r];
};

// 직선투영 등가 좌표 → 관측(어안) 픽셀
export const fisheyeForward = (
  u: number,
  v: number,
  pcx: number,
  pcy: number,
  ffish: number,
): Point2D => {
  const rt = Math.hypot(u, v);

  if (rt < 1e-9) {
    return [pcx, pcy];
  }

  const rObs = ffish * Math.atan(rt);

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

  return fisheyeForward(uv[0], uv[1], cam.pcx, cam.pcy, cam.ffish);
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
}

// 라벨 대응 {x,y,v}로 어안 카메라를 피팅한다(광학중심·어안초점 격자 탐색 → 정밀화).
// imageW/imageH로 탐색 범위를 잡는다. 대응은 화면 곳곳에 흩어질수록 좋다.
export const fitFisheyeCamera = (
  corr: { x: number; y: number; v: Point3D }[],
  imageW: number,
  imageH: number,
): FisheyeFit => {
  const diag = Math.hypot(imageW, imageH);

  const IDENTITY: Mat3 = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];

  // 격자 탐색 중 극단적 파라미터는 퇴화된 변환(det≈0)을 만들어 mat3Inv가 던질 수
  // 있다. 그런 조합은 실패로 보고 건너뛴다(RMS=Infinity).
  const evalModel = (pcx: number, pcy: number, ffish: number) => {
    try {
      const TP = fitPoseRect(
        corr.map((c) => ({ p: rectify(c.x, c.y, pcx, pcy, ffish), v: c.v })),
      );
      let sse = 0;
      let maxRes = 0;

      for (const c of corr) {
        const uv = projectVecToPhoto(TP, c.v);
        const obs = uv ? fisheyeForward(uv[0], uv[1], pcx, pcy, ffish) : null;
        const res = obs ? Math.hypot(obs[0] - c.x, obs[1] - c.y) : Infinity;
        sse += res * res;
        maxRes = Math.max(maxRes, res);
      }

      const rms = Math.sqrt(sse / corr.length);

      return { TP, rms: Number.isFinite(rms) ? rms : Infinity, maxRes };
    } catch {
      return { TP: IDENTITY, rms: Infinity, maxRes: Infinity };
    }
  };

  const search = (
    pcxR: [number, number, number],
    pcyR: [number, number, number],
    fR: [number, number, number],
    seed: { pcx: number; pcy: number; ffish: number; rms: number },
  ) => {
    let best = seed;

    for (let pcx = pcxR[0]; pcx <= pcxR[1]; pcx += pcxR[2]) {
      for (let pcy = pcyR[0]; pcy <= pcyR[1]; pcy += pcyR[2]) {
        for (let ffish = fR[0]; ffish <= fR[1]; ffish += fR[2]) {
          const r = evalModel(pcx, pcy, ffish);

          if (r.rms < best.rms) {
            best = { pcx, pcy, ffish, rms: r.rms };
          }
        }
      }
    }

    return best;
  };

  const init = { pcx: imageW / 2, pcy: imageH / 2, ffish: diag, rms: Infinity };
  const coarse = search(
    [-imageW, 2 * imageW, imageW / 12],
    [-imageH, 2 * imageH, imageH / 10],
    [diag * 0.4, diag * 4, diag / 15],
    init,
  );
  const fine = search(
    [coarse.pcx - imageW / 12, coarse.pcx + imageW / 12, imageW / 60],
    [coarse.pcy - imageH / 10, coarse.pcy + imageH / 10, imageH / 50],
    [coarse.ffish - diag / 15, coarse.ffish + diag / 15, diag / 75],
    coarse,
  );

  const m = evalModel(fine.pcx, fine.pcy, fine.ffish);

  return {
    camera: { TP: m.TP, pcx: fine.pcx, pcy: fine.pcy, ffish: fine.ffish },
    rms: m.rms,
    maxRes: m.maxRes,
  };
};
