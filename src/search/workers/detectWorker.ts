import { detectCoarseStars, detectStarsInImage } from "@/search/detectImage";

// 별 찾기 Worker: 사진 픽셀(RGBA)을 받아 별 목록을 돌려준다. 순수 JS(detectImage.ts)라 OpenCV를 받지 않는다.
// 큰 사진은 1~2초 걸리므로 화면이 멈추지 않게 Worker에서 한다.
// coarse면 줄인 사진에서 찾은 별을 돌려준다 (빛무리가 넓은 사진용, journey 54장)
self.onmessage = (e: MessageEvent) => {
  const { id, data, width, height, coarse } = e.data as {
    id: number;
    data: Uint8ClampedArray;
    width: number;
    height: number;
    coarse?: boolean;
  };

  try {
    const stars = coarse
      ? detectCoarseStars(data, width, height)
      : detectStarsInImage(data, width, height);
    self.postMessage({ id, stars });
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
};
