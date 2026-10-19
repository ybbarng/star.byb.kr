import type { InputStar } from "@/search/solvers";
import sharp from "sharp";
import { detectStarsFromDiff, type DetectedStar } from "@/search/detectCore";
import {
  DEFAULT_DISPLAY_STARS,
  mergeCloseStars,
  mergeDistancePx,
} from "@/search/utils/selectStars";

// node에서 실제 사진(JPG/PNG)을 읽어 별을 검출한다.
// OpenCV에 의존하는 grayscale/blur/subtract는 sharp로 대체하고, 나머지 검출
// 로직은 브라우저(cv.worker)와 동일한 detectCore를 쓴다.
//
// cv.worker는 GaussianBlur 51×51을 쓴다 — OpenCV의 자동 sigma ≈ 8.0이므로
// sharp.blur(8)로 맞춘다.
const BLUR_SIGMA = 8;

export interface DetectImageResult {
  stars: DetectedStar[];
  width: number;
  height: number;
}

export const detectStarsFromFile = async (
  path: string,
): Promise<DetectImageResult> => {
  const grayRaw = await sharp(path)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const blurRaw = await sharp(path)
    .greyscale()
    .blur(BLUR_SIGMA)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = grayRaw.info;
  const g = grayRaw.data;
  const b = blurRaw.data;

  // 차영상 diff = gray - blur (음수 클램프). greyscale이어도 채널 수가 1이
  // 아닐 수 있어 첫 채널만 쓴다.
  const diff = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const v = g[i * channels] - b[i * channels];
    diff[i] = v > 0 ? v : 0;
  }

  const stars = detectStarsFromDiff(diff, width, height);

  return { stars, width, height };
};

// 앱의 검출 단계(DetectStarsStep)가 사람 손을 거치지 않고 풀이에 넘기는 별 목록을 만든다.
// 가까운 중복을 합치고 밝기 상위 DEFAULT_DISPLAY_STARS개를 고른다.
export const detectLikeApp = async (
  path: string,
): Promise<{ stars: InputStar[]; width: number; height: number }> => {
  const { stars, width, height } = await detectStarsFromFile(path);
  const merged = mergeCloseStars(
    stars.map((s) => ({ x: s.cx, y: s.cy, brightness: s.brightness })),
    mergeDistancePx(width, height),
  );

  return { stars: merged.slice(0, DEFAULT_DISPLAY_STARS), width, height };
};
