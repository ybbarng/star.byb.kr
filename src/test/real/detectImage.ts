import sharp from "sharp";
import { detectStarsFromDiff, type DetectedStar } from "@/search/detectCore";

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
