// 은하수 띠·지도 대조(search/milkyWaySolve, journey 57장)에 쓰는 사진의 흐린 밝기.
// 검출 Worker도 불러오므로 풀이 코드에 기대지 않는 가벼운 파일로 둔다

// 사진 흐린 밝기 (가로 GLOW_COLS칸 회색조, 가우스 흐림 σ1). 브라우저(검출 Worker)와 검증 스크립트가 같은 함수로 만든다
export const GLOW_COLS = 96;
// 지도 대조는 가로 48칸으로 한다 (속도, journey 51장)
export const TEMPLATE_COLS = 48;

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
