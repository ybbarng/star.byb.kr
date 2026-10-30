import type { DetectedStar } from "@/search/detectCore";

// 별 찾기 Worker를 앱 전체에서 하나만 두고 공유한다 (예전 services/cv.js 대신, OpenCV 없이).
// Worker가 통째로 죽으면(스크립트를 못 받음·시작하다 실패·응답을 못 읽음) 기다리던 요청을 모두 실패로 끝내고
// 다음 요청 때 새로 띄운다. 그러지 않으면 요청이 끝나지 않아 화면이 "찾는 중"에 머문다.

interface Pending {
  resolve: (stars: DetectedStar[]) => void;
  reject: (error: Error) => void;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

const asError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

// 이 Worker를 버리고 기다리던 요청을 모두 실패로 끝낸다
const failAll = (dead: Worker, error: Error) => {
  // 이미 버리고 새로 띄운 뒤에 옛 Worker의 소식이 오면 새 Worker의 요청을 건드리지 않는다
  if (worker !== dead) {
    return;
  }

  dead.terminate();
  worker = null;
  const requests = [...pending.values()];
  pending.clear();

  for (const request of requests) {
    request.reject(error);
  }
};

const getWorker = (): Worker => {
  if (worker) {
    return worker;
  }

  const created = new Worker(
    new URL("@/search/workers/detectWorker.ts", import.meta.url),
  );
  worker = created;

  created.onerror = (e: ErrorEvent) =>
    failAll(created, new Error(e.message || "별 찾기 Worker가 멈췄습니다."));
  created.onmessageerror = () =>
    failAll(created, new Error("별 찾기 Worker의 응답을 읽지 못했습니다."));

  created.onmessage = (e: MessageEvent) => {
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

  return created;
};

// Worker를 미리 띄워 둔다 (받을 큰 파일이 없어 금방이다).
// 못 띄워도 여기서는 넘어간다: 실제로 별을 찾을 때 다시 띄워 보고, 그때 실패를 알린다
export const preloadDetector = () => {
  try {
    getWorker();
  } catch {
    // detectStars가 다시 시도하고 실패를 돌려준다
  }
};

// coarse면 줄인 사진에서 찾은 별 (좌표는 원래 사진 기준, journey 54장)
export const detectStars = (
  image: ImageData,
  coarse = false,
): Promise<DetectedStar[]> => {
  const id = nextId++;

  return new Promise((resolve, reject) => {
    try {
      const target = getWorker();
      pending.set(id, { resolve, reject });
      target.postMessage({
        id,
        data: image.data,
        width: image.width,
        height: image.height,
        coarse,
      });
    } catch (e) {
      // Worker를 못 띄우거나 보내지 못했다
      pending.delete(id);
      reject(asError(e));
    }
  });
};
