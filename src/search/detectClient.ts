import type { DetectedStar } from "@/search/detectCore";

// 별 찾기 Worker를 앱 전체에서 하나만 두고 공유한다 (예전 services/cv.js 대신, OpenCV 없이).

interface Pending {
  resolve: (stars: DetectedStar[]) => void;
  reject: (error: Error) => void;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

const getWorker = (): Worker => {
  if (worker) {
    return worker;
  }

  worker = new Worker(
    new URL("@/search/workers/detectWorker.ts", import.meta.url),
  );

  worker.onmessage = (e: MessageEvent) => {
    const { id, stars, error } = e.data;
    const request = pending.get(id);

    if (!request) {
      return;
    }

    pending.delete(id);

    if (error) {
      request.reject(new Error(error));
    } else {
      request.resolve(stars);
    }
  };

  return worker;
};

// Worker를 미리 띄워 둔다 (받을 큰 파일이 없어 금방이다)
export const preloadDetector = () => {
  getWorker();
};

export const detectStars = (image: ImageData): Promise<DetectedStar[]> => {
  const id = nextId++;

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({
      id,
      data: image.data,
      width: image.width,
      height: image.height,
    });
  });
};
