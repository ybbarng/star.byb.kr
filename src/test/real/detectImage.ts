import type { DetectedStar } from "@/search/detectCore";
import type { Glow } from "@/search/milkyWayGlow";
import type { InputStar } from "@/search/solvers";
import sharp from "sharp";
import {
  detectCoarseStars,
  detectStarsInImage,
  toGray,
} from "@/search/detectImage";
import { GLOW_COLS, makeGlow, TEMPLATE_COLS } from "@/search/milkyWayGlow";
import {
  mergeDetections,
  mergeDistancePx,
  rankForSolving,
} from "@/search/utils/selectStars";

// node에서 실제 사진(JPG/PNG)을 읽어 별을 검출한다. sharp로 픽셀만 풀고, 검출은 브라우저 Worker와
// 같은 순수 JS(detectImage.ts: 회색조 → 흐림 → 차영상 → detectCore)를 쓴다.

export interface DetectImageResult {
  stars: DetectedStar[];
  width: number;
  height: number;
}

// path 대신 파일 내용(Buffer)을 줘도 된다 (WebP 등 다른 형식으로 바꾼 사진을 디스크에 쓰지 않고 시험할 때)
export const detectStarsFromFile = async (
  path: string | Buffer,
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
  path: string | Buffer,
): Promise<{ stars: InputStar[]; width: number; height: number }> => {
  const { stars, width, height } = await detectStarsFromFile(path);
  const merged = mergeDetections(
    stars.map((s) => ({
      x: s.cx,
      y: s.cy,
      brightness: s.brightness,
      ringContrast: s.ringContrast,
      ...(s.trail ? { trail: true, chord: s.chord } : {}),
    })),
    mergeDistancePx(width, height),
  );

  return { stars: merged, width, height };
};

// 줄인 사진에서 찾은 별을 풀이 순서로 (coarse 표시, 좌표는 원래 사진 기준, journey 54장)
export const detectCoarseLikeApp = async (
  path: string | Buffer,
): Promise<InputStar[]> => {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const stars = detectCoarseStars(data, info.width, info.height, info.channels);

  return rankForSolving(
    mergeDetections(
      stars.map((s) => ({
        x: s.cx,
        y: s.cy,
        brightness: s.brightness,
        ringContrast: s.ringContrast,
        coarse: true,
      })),
      mergeDistancePx(info.width, info.height),
    ),
    info.width,
    info.height,
  );
};

// 앱의 검출 Worker가 은하수 띠·지도 대조용으로 만드는 흐린 썸네일 두 장 (journey 57장)
export const glowsLikeApp = async (
  path: string | Buffer,
): Promise<{ band: Glow; map: Glow }> => {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const gray = toGray(data, info.width, info.height, info.channels);

  return {
    band: makeGlow(gray, info.width, info.height, GLOW_COLS),
    map: makeGlow(gray, info.width, info.height, TEMPLATE_COLS),
  };
};
