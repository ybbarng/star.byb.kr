// 학습 자료(은하수 사진, /learn/milky-way)의 띠 중심선 데모 전용 계산. 앱의 풀이 흐름에는 들어가지 않는다.
// journey 50장의 실험을 옮겨 온 것: 사진을 가로 GLOW_COLS칸으로 흐리게 줄이고, 하늘 칸(검출이 있는 칸과 이웃)에서
// 밝기 평면을 뺀 뒤, 모든 직선 중 "선 둘레 띠의 평균 − 바깥 평균"이 큰 것을 은하수 띠의 중심선 후보로 고른다.
// (실험에서는 이 선으로 자세를 좁히고 은하수 지도와 대조해 은하수 사진 몇 장을 더 풀었지만, 앱에는 넣지 않았다 — journey 58·59장)

// 사진 흐린 밝기 (가로 GLOW_COLS칸 회색조, 가우스 흐림 σ1). 브라우저(검출 Worker)와 검증 스크립트가 같은 함수로 만든다
export const GLOW_COLS = 96;

export interface Glow {
  data: Float32Array;
  cols: number;
  rows: number;
}

// 회색조(0~255, w×h)를 가로 cols칸으로 칸 평균한 뒤 가우스 흐림(σ1, 5칸)
export const makeGlow = (
  gray: ArrayLike<number>,
  w: number,
  h: number,
  cols = GLOW_COLS,
): Glow => {
  const rows = Math.max(1, Math.round((h * cols) / w));
  const sum = new Float64Array(cols * rows);
  const cnt = new Float64Array(cols * rows);

  for (let y = 0; y < h; y++) {
    const j = Math.min(rows - 1, Math.floor((y * rows) / h));

    for (let x = 0; x < w; x++) {
      const k = j * cols + Math.min(cols - 1, Math.floor((x * cols) / w));
      sum[k] += gray[y * w + x];
      cnt[k]++;
    }
  }

  const avg = new Float32Array(cols * rows);

  for (let k = 0; k < avg.length; k++) {
    avg[k] = cnt[k] ? sum[k] / cnt[k] : 0;
  }

  return { data: gauss1(avg, cols, rows), cols, rows };
};

const KERNEL = [-2, -1, 0, 1, 2].map((d) => Math.exp(-(d * d) / 2));
const KSUM = KERNEL.reduce((a, b) => a + b, 0);

const gauss1 = (src: Float32Array, cols: number, rows: number) => {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      let s = 0;

      for (let d = -2; d <= 2; d++) {
        const ii = Math.min(cols - 1, Math.max(0, i + d));
        s += src[j * cols + ii] * KERNEL[d + 2];
      }

      tmp[j * cols + i] = s / KSUM;
    }
  }

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      let s = 0;

      for (let d = -2; d <= 2; d++) {
        const jj = Math.min(rows - 1, Math.max(0, j + d));
        s += tmp[jj * cols + i] * KERNEL[d + 2];
      }

      out[j * cols + i] = s / KSUM;
    }
  }

  return out;
};

const BAND = 0.08;
const LINE_TOP = 5;

// 검출이 있는 칸과 그 이웃만 하늘로 본다 (지상 제외)
export const skyMask = (
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
export const planeResidual = (
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
export const findBandLines = (
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
