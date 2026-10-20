import { detectStars as detectStarsInWorker } from "@/search/detectClient";
import {
  mergeCloseStars,
  mergeDistancePx,
  rankForSolving,
} from "@/search/utils/selectStars";

// 사진에서 별을 찾아 풀이 순서(별다운 것 먼저, 그 안에서 밝은 순, 줄지은 것은 뒤로)로 돌려준다.
// 풀이 화면이 사진을 고르자마자 부르고, 별 고치기 화면이 영역 다시 찾기에 쓴다.

export interface DetectedStar {
  x: number;
  y: number;
  brightness: number;
  fwhm: number; // 퍼짐 크기
  ringContrast?: number; // 별다움 (detectCore.ringContrast)
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

export const detectPhotoStars = async (
  image: HTMLImageElement,
): Promise<DetectedStar[]> => {
  const imageData = imageDataOf(image);
  const raw = await detectStarsInWorker(imageData);
  // 너무 가까운 중복 검출은 밝은 것만 남긴다(거의 같은 위치의 별쌍 정리).
  const all = mergeCloseStars(
    raw.map((star) => ({
      x: star.cx,
      y: star.cy,
      brightness: star.brightness,
      fwhm: star.fwhm ?? 0,
      ringContrast: star.ringContrast,
    })),
    mergeDistancePx(imageData.width, imageData.height),
  );

  // 밝기만 보면 조명 받은 창문·나무 줄기·지붕 경계선이 진짜 별보다 앞에 온다.
  return rankForSolving(all, imageData.width, imageData.height);
};
