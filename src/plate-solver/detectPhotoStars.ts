import type { DetectedStar as RawStar } from "@/search/detectCore";
import type { Glow } from "@/search/milkyWayGlow";
import {
  detectStars as detectStarsInWorker,
  photoGlows,
} from "@/search/detectClient";
import {
  mergeDetections,
  mergeDistancePx,
  rankForSolving,
} from "@/search/utils/selectStars";

// 사진에서 별을 찾아 풀이 순서(별다운 것 먼저, 그 안에서 밝은 순, 줄지은 것은 뒤로)로 돌려준다.
// 풀이 화면이 사진을 고르자마자 부르고, 별 고치기 화면이 영역 다시 찾기에 쓴다.

export interface DetectedStar {
  x: number;
  y: number;
  brightness: number;
  radius?: number; // 유효 반경(px, detectCore). 별다움 고리 크기에 쓴다
  fwhm: number; // 퍼짐 크기
  ringContrast?: number; // 별다움 (detectCore.ringContrast)
  trail?: boolean; // 별 궤적 점 (detectCore.findTrails)
  chord?: [number, number, number, number]; // 별 궤적 양 끝점
}

export const imageDataOf = (image: HTMLImageElement): ImageData => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (context === null) {
    throw new Error("canvas의 context를 얻을 수 없습니다.");
  }

  canvas.width = image.width;
  canvas.height = image.height;
  context.drawImage(image, 0, 0, image.width, image.height);

  return context.getImageData(0, 0, image.width, image.height);
};

// 너무 가까운 중복 검출은 밝은 것만 남기고(거의 같은 위치의 별쌍 정리) 풀이 순서로 정렬한다.
// 밝기만 보면 조명 받은 창문·나무 줄기·지붕 경계선이 진짜 별보다 앞에 온다.
const toRanked = (raw: RawStar[], width: number, height: number) =>
  rankForSolving(
    mergeDetections(
      raw.map((star) => ({
        x: star.cx,
        y: star.cy,
        brightness: star.brightness,
        radius: star.radius,
        fwhm: star.fwhm ?? 0,
        ringContrast: star.ringContrast,
        ...(star.trail ? { trail: true, chord: star.chord } : {}),
      })),
      mergeDistancePx(width, height),
    ),
    width,
    height,
  );

export const detectPhotoStars = async (
  image: HTMLImageElement,
): Promise<DetectedStar[]> => {
  const imageData = imageDataOf(image);

  return toRanked(
    await detectStarsInWorker(imageData),
    imageData.width,
    imageData.height,
  );
};

// 원래 검출과 줄인 사진 검출(빛무리가 넓은 사진용, journey 54장)을 함께. 줄인 사진 검출은 화면에 띄우지 않고
// 원래 검출로 확신 못 했을 때만 풀이가 쓴다. 은하수 띠·지도 대조에 쓸 흐린 썸네일도 함께 만든다 (journey 57장).
// 줄인 사진 검출·썸네일이 실패해도 원래 검출은 돌려준다
export const detectPhotoStarsWithCoarse = async (
  image: HTMLImageElement,
): Promise<{
  stars: DetectedStar[];
  coarse: DetectedStar[];
  glows: { band: Glow; map: Glow } | null;
}> => {
  const imageData = imageDataOf(image);
  const { width, height } = imageData;
  const stars = toRanked(await detectStarsInWorker(imageData), width, height);
  const coarse = await detectStarsInWorker(imageData, true)
    .then((raw) => toRanked(raw, width, height))
    .catch(() => []);
  const glows = await photoGlows(imageData).catch(() => null);

  return { stars, coarse, glows };
};
