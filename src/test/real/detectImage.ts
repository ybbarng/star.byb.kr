import type { DetectedStar } from "@/search/detectCore";
import type { InputStar } from "@/search/solvers";
import sharp from "sharp";
import { detectStarsInImage } from "@/search/detectImage";
import { mergeCloseStars, mergeDistancePx } from "@/search/utils/selectStars";

// node에서 실제 사진(JPG/PNG)을 읽어 별을 검출한다. sharp로 픽셀만 풀고, 검출은 브라우저 Worker와
// 같은 순수 JS(detectImage.ts: 회색조 → 흐림 → 차영상 → detectCore)를 쓴다.

export interface DetectImageResult {
  stars: DetectedStar[];
  width: number;
  height: number;
}

export const detectStarsFromFile = async (
  path: string,
): Promise<DetectImageResult> => {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    stars: detectStarsInImage(data, info.width, info.height, info.channels),
    width: info.width,
    height: info.height,
  };
};

// 앱의 검출 단계(DetectStarsStep)가 사람 손을 거치지 않고 풀이에 넘기는 별 목록을 만든다.
// 가까운 중복을 합친 검출 전체(별다움 값 포함). 풀이가 우선순위대로 필요한 만큼 고른다.
export const detectLikeApp = async (
  path: string,
): Promise<{ stars: InputStar[]; width: number; height: number }> => {
  const { stars, width, height } = await detectStarsFromFile(path);
  const merged = mergeCloseStars(
    stars.map((s) => ({
      x: s.cx,
      y: s.cy,
      brightness: s.brightness,
      ringContrast: s.ringContrast,
    })),
    mergeDistancePx(width, height),
  );

  return { stars: merged, width, height };
};
