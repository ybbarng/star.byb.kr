import type { Point2D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";

// 2D 원근 변환(호모그래피, 8자유도)의 최소제곱 추정.
//
// 사진 편집에서 건물을 똑바로 세우는 원근(키스톤) 보정을 하면, 하늘 접선평면 → 사진
// 관계가 닮음변환(4자유도)에서 벗어나 가장자리 별이 수십 px 어긋난다. 그래도 직선투영
// 사진에 원근 보정을 한 것은 여전히 접선평면의 호모그래피라서, 이 변환으로 맞추면 된다.
// (임의의 내부 파라미터를 가진 핀홀 카메라 K·R과 같은 모델이다.)

// 동차 좌표 변환. 분모가 0 이하면(변환의 지평선 너머) null.
export const applyHomography = (m: Mat3, p: Point2D): Point2D | null => {
  const w = m[2][0] * p[0] + m[2][1] * p[1] + m[2][2];

  if (w <= 1e-12) {
    return null;
  }

  return [
    (m[0][0] * p[0] + m[0][1] * p[1] + m[0][2]) / w,
    (m[1][0] * p[0] + m[1][1] * p[1] + m[1][2]) / w,
  ];
};

// 점들을 평균 0, 평균 거리 √2가 되게 옮기는 정규화 (Hartley). 수치 안정성을 위해서다.
const normalizer = (pts: Point2D[]): Mat3 => {
  let mx = 0;
  let my = 0;

  for (const p of pts) {
    mx += p[0];
    my += p[1];
  }

  mx /= pts.length;
  my /= pts.length;

  let d = 0;

  for (const p of pts) {
    d += Math.hypot(p[0] - mx, p[1] - my);
  }

  const s = d > 0 ? (Math.SQRT2 * pts.length) / d : 1;

  return [
    [s, 0, -s * mx],
    [0, s, -s * my],
    [0, 0, 1],
  ];
};

const mul = (a: Mat3, b: Mat3): Mat3 => {
  const r: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
    }
  }

  return r;
};

// 정규화 변환의 역행렬 (s·x + t 꼴이라 바로 구한다)
const invertNormalizer = (n: Mat3): Mat3 => {
  const s = n[0][0];

  return [
    [1 / s, 0, -n[0][2] / s],
    [0, 1 / s, -n[1][2] / s],
    [0, 0, 1],
  ];
};

// 8×8 정규방정식을 부분 피벗 가우스 소거로 푼다. 특이하면 null.
const solveLinear = (a: number[][], b: number[]): number[] | null => {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);

  for (let i = 0; i < n; i++) {
    let p = i;

    for (let r = i + 1; r < n; r++) {
      if (Math.abs(m[r][i]) > Math.abs(m[p][i])) {
        p = r;
      }
    }

    if (Math.abs(m[p][i]) < 1e-12) {
      return null;
    }

    [m[i], m[p]] = [m[p], m[i]];

    for (let r = i + 1; r < n; r++) {
      const f = m[r][i] / m[i][i];

      for (let k = i; k <= n; k++) {
        m[r][k] -= f * m[i][k];
      }
    }
  }

  const x = new Array<number>(n).fill(0);

  for (let i = n - 1; i >= 0; i--) {
    let s = m[i][n];

    for (let k = i + 1; k < n; k++) {
      s -= m[i][k] * x[k];
    }

    x[i] = s / m[i][i];
  }

  return x;
};

// from[i] → to[i] 대응으로 최소제곱 호모그래피를 구한다 (대응 4쌍 이상 필요).
// h33 = 1로 두고 선형화한 대수적 오차를 최소화한다. 퇴화하면 null.
export const fitHomography2D = (
  from: Point2D[],
  to: Point2D[],
): Mat3 | null => {
  const n = Math.min(from.length, to.length);

  if (n < 4) {
    return null;
  }

  const nf = normalizer(from.slice(0, n));
  const nt = normalizer(to.slice(0, n));
  const ata = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
  const atb = new Array<number>(8).fill(0);

  const addRow = (row: number[], rhs: number) => {
    for (let i = 0; i < 8; i++) {
      atb[i] += row[i] * rhs;

      for (let j = 0; j < 8; j++) {
        ata[i][j] += row[i] * row[j];
      }
    }
  };

  for (let i = 0; i < n; i++) {
    const u = nf[0][0] * from[i][0] + nf[0][2];
    const v = nf[1][1] * from[i][1] + nf[1][2];
    const x = nt[0][0] * to[i][0] + nt[0][2];
    const y = nt[1][1] * to[i][1] + nt[1][2];
    addRow([u, v, 1, 0, 0, 0, -u * x, -v * x], x);
    addRow([0, 0, 0, u, v, 1, -u * y, -v * y], y);
  }

  const h = solveLinear(ata, atb);

  if (!h || h.some((x) => !Number.isFinite(x))) {
    return null;
  }

  const hn: Mat3 = [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1],
  ];
  const m = mul(invertNormalizer(nt), mul(hn, nf));
  const k = m[2][2];

  if (Math.abs(k) < 1e-12) {
    return null;
  }

  return m.map((row) => row.map((x) => x / k)) as Mat3;
};
