import type { DetectedStar } from "@/search/detectCore";
import { detectStarsFromDiff, ringContrast } from "@/search/detectCore";

// 사진(RGBA 픽셀)에서 별을 찾는다 — 순수 JS라 브라우저 Worker와 node 테스트가 같은 코드를 쓴다.
// 예전에는 회색조·흐림·빼기를 OpenCV.js(압축 3.9MB)로 했지만 쓰는 기능이 이것뿐이라 옮겼다.
//
// 차영상 = 회색조 - 흐린 회색조(σ=8, 예전 OpenCV GaussianBlur 51×51과 같은 세기) → detectCore.
// 흐림은 상자 흐림 세 번으로 가우시안을 흉내 낸다 (반지름과 상관없이 픽셀당 몇 번의 덧셈이라
// 1,200만 화소 사진도 빠르다).

const BLUR_SIGMA = 8;
const BOX_PASSES = 3;

// 가우시안 σ에 가까운 상자 너비들 (Kutskir, "Fastest Gaussian Blur")
export const boxSizesForGauss = (sigma: number, n = BOX_PASSES) => {
  const ideal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(ideal);

  if (wl % 2 === 0) {
    wl--;
  }

  const wu = wl + 2;
  const m = Math.round(
    (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4),
  );

  return Array.from({ length: n }, (_, i) => (i < m ? wl : wu));
};

// 한 방향 상자 흐림 (가장자리는 끝 픽셀을 늘인다). stride로 가로·세로를 같이 쓴다.
const boxPass = (
  src: Float32Array,
  dst: Float32Array,
  lines: number,
  length: number,
  lineStride: number,
  step: number,
  r: number,
) => {
  const scale = 1 / (2 * r + 1);

  for (let l = 0; l < lines; l++) {
    const base = l * lineStride;
    const at = (i: number) =>
      src[base + Math.min(length - 1, Math.max(0, i)) * step];
    let acc = 0;

    for (let i = -r; i <= r; i++) {
      acc += at(i);
    }

    for (let i = 0; i < length; i++) {
      dst[base + i * step] = acc * scale;
      acc += at(i + r + 1) - at(i - r);
    }
  }
};

export const gaussianBlurApprox = (
  gray: Float32Array,
  width: number,
  height: number,
  sigma = BLUR_SIGMA,
): Float32Array => {
  const a = Float32Array.from(gray);
  const b = new Float32Array(gray.length);

  for (const w of boxSizesForGauss(sigma)) {
    const r = (w - 1) / 2;
    boxPass(a, b, height, width, width, 1, r); // 가로
    boxPass(b, a, width, height, 1, width, r); // 세로
  }

  return a;
};

// RGBA → 회색조 (밝기 가중치 0.299·0.587·0.114, 0~255 정수)
export const toGray = (
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  channels = 4,
): Uint8Array => {
  const gray = new Uint8Array(width * height);

  for (let i = 0; i < gray.length; i++) {
    const k = i * channels;
    gray[i] =
      channels < 3
        ? rgba[k]
        : Math.round(
            0.299 * rgba[k] + 0.587 * rgba[k + 1] + 0.114 * rgba[k + 2],
          );
  }

  return gray;
};

export const detectStarsInImage = (
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  channels = 4,
): DetectedStar[] => {
  const gray = toGray(rgba, width, height, channels);
  const blurred = gaussianBlurApprox(Float32Array.from(gray), width, height);
  const diff = new Float32Array(gray.length);

  for (let i = 0; i < diff.length; i++) {
    // 예전 OpenCV처럼 흐린 값을 정수로 맞추고 음수는 0
    const v = gray[i] - Math.round(blurred[i]);
    diff[i] = v > 0 ? v : 0;
  }

  return detectStarsFromDiff(diff, width, height).map((s) => ({
    ...s,
    ringContrast: ringContrast(gray, width, height, s),
  }));
};
