import type { Point2D } from "@/scripts/hash/types";
import { detectHorizon } from "@/search/utils/horizonDetect";

// 브라우저에서 사진의 지평선을 자동으로 찾아, 사람이 찍는 지평선 두 점과 같은 꼴(사진 좌우 10%·90%)로
// 돌려준다. 검출은 작게 줄인 사진으로 충분하므로 긴 변 960px로 줄여 밝기만 뽑는다.
const WORK_SIZE = 960;

export const autoHorizon = (
  image: HTMLImageElement,
  stars: Point2D[],
): [Point2D, Point2D] | null => {
  const k = Math.min(1, WORK_SIZE / Math.max(image.width, image.height));
  const w = Math.max(1, Math.round(image.width * k));
  const h = Math.max(1, Math.round(image.height * k));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0, w, h);
  const rgba = context.getImageData(0, 0, w, h).data;
  const gray = new Uint8Array(w * h);

  for (let i = 0; i < w * h; i++) {
    gray[i] = Math.round(
      0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2],
    );
  }

  const found = detectHorizon(
    gray,
    w,
    h,
    1,
    stars.map(([x, y]): Point2D => [x * k, y * k]),
  );

  if (!found) {
    return null;
  }

  const [[, y0], [, y1]] = found.line;
  const at = (fx: number): Point2D => [
    image.width * fx,
    (y0 + (y1 - y0) * fx) / k,
  ];

  return [at(0.1), at(0.9)];
};
