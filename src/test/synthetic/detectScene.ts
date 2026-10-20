import type { InputStar } from "@/search/solvers";
import { detectStarsFromDiff, ringContrast } from "@/search/detectCore";
import { mergeCloseStars, mergeDistancePx } from "@/search/utils/selectStars";

// 회색조 영상에서 앱과 같은 방식으로 별을 검출한다 (detectImage.detectLikeApp과 같은 흐름).
// 차영상 = 회색조 - 가우시안 블러(σ=8, cv.worker의 51×51과 같음) → 검출 → 별다움 → 중복 합치기.
const BLUR_SIGMA = 8;

const gaussianBlur = (
  src: Uint8Array,
  width: number,
  height: number,
  sigma: number,
): Float32Array => {
  const r = Math.ceil(sigma * 3);
  const kernel = new Float32Array(2 * r + 1);
  let sum = 0;

  for (let i = -r; i <= r; i++) {
    kernel[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
    sum += kernel[i + r];
  }

  for (let i = 0; i < kernel.length; i++) {
    kernel[i] /= sum;
  }

  const tmp = new Float32Array(width * height);
  const out = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0;

      for (let k = -r; k <= r; k++) {
        const xx = Math.min(width - 1, Math.max(0, x + k));
        acc += src[y * width + xx] * kernel[k + r];
      }

      tmp[y * width + x] = acc;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0;

      for (let k = -r; k <= r; k++) {
        const yy = Math.min(height - 1, Math.max(0, y + k));
        acc += tmp[yy * width + x] * kernel[k + r];
      }

      out[y * width + x] = acc;
    }
  }

  return out;
};

export const detectFromGray = (
  gray: Uint8Array,
  width: number,
  height: number,
): InputStar[] => {
  const blurred = gaussianBlur(gray, width, height, BLUR_SIGMA);
  const diff = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    // 앱(OpenCV subtract)처럼 정수 회색조 차이를 0 아래로 자른다
    const v = gray[i] - Math.round(blurred[i]);
    diff[i] = v > 0 ? v : 0;
  }

  const stars = detectStarsFromDiff(diff, width, height);

  return mergeCloseStars(
    stars.map((s) => ({
      x: s.cx,
      y: s.cy,
      brightness: s.brightness,
      ringContrast: ringContrast(gray, width, height, s),
    })),
    mergeDistancePx(width, height),
  );
};
