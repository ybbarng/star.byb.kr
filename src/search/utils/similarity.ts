import type { Point2D } from "@/scripts/hash/types";

// 2D 닮음변환(similarity: 회전 + 균일 스케일 + 이동)의 최소제곱 추정.
//
// 현재 transform.ts는 첫 번째 대응점 하나로만 scale·angle을 정해 노이즈에
// 취약하다. 여기서는 모든 대응점을 쓰는 닫힌형 해를 제공한다.
// 반사가 없는 2D 닮음변환은 복소수 표현 q = c·p + t (c = s·e^{iθ})로 보면
// 최소제곱 해가 c = Σ conj(p)·q / Σ|p|² 로 정확히 떨어진다 (SVD 불필요).

export type Mat3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

export interface Similarity2D {
  matrix: Mat3; // 동차 3x3. q ≈ matrix · [px, py, 1]
  scale: number;
  rotation: number; // 라디안
  tx: number;
  ty: number;
}

export const applySimilarity = (m: Mat3, p: Point2D): Point2D => [
  m[0][0] * p[0] + m[0][1] * p[1] + m[0][2],
  m[1][0] * p[0] + m[1][1] * p[1] + m[1][2],
];

// from[i] → to[i] 대응으로 최소제곱 닮음변환을 구한다 (대응 2쌍 이상 필요).
export const umeyamaSimilarity2D = (
  from: Point2D[],
  to: Point2D[],
): Similarity2D => {
  const n = Math.min(from.length, to.length);

  let mfx = 0;
  let mfy = 0;
  let mtx = 0;
  let mty = 0;

  for (let i = 0; i < n; i++) {
    mfx += from[i][0];
    mfy += from[i][1];
    mtx += to[i][0];
    mty += to[i][1];
  }

  mfx /= n;
  mfy /= n;
  mtx /= n;
  mty /= n;

  // c = (a + i·b) = Σ conj(p)·q / Σ|p|²  (중심화 좌표 기준)
  let numRe = 0; // Σ (px·qx + py·qy)
  let numIm = 0; // Σ (px·qy - py·qx)
  let den = 0; // Σ (px² + py²)

  for (let i = 0; i < n; i++) {
    const px = from[i][0] - mfx;
    const py = from[i][1] - mfy;
    const qx = to[i][0] - mtx;
    const qy = to[i][1] - mty;

    numRe += px * qx + py * qy;
    numIm += px * qy - py * qx;
    den += px * px + py * py;
  }

  const a = den > 0 ? numRe / den : 1; // s·cosθ
  const b = den > 0 ? numIm / den : 0; // s·sinθ
  const scale = Math.hypot(a, b);
  const rotation = Math.atan2(b, a);

  // t = μq - c·μp
  const tx = mtx - (a * mfx - b * mfy);
  const ty = mty - (b * mfx + a * mfy);

  const matrix: Mat3 = [
    [a, -b, tx],
    [b, a, ty],
    [0, 0, 1],
  ];

  return { matrix, scale, rotation, tx, ty };
};
