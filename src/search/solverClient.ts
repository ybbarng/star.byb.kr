import type { SolvePhase, SolvePhotoResult } from "@/search/solvePhoto";
import type { InputStar } from "@/search/solvers";

// 풀이 Worker를 앱 전체에서 하나만 두고 공유한다.
// DB 로딩과 인덱스 구축은 무거우므로 페이지를 열 때 한 번 시작해(preloadSolver),
// 단계를 오가도 다시 하지 않는다. 화면 컴포넌트는 useSolve로 이 모듈을 쓴다.

interface PendingSolve {
  resolve: (result: SolvePhotoResult) => void;
  reject: (error: Error) => void;
  onPhase?: (phase: SolvePhase) => void;
}

let worker: Worker | null = null;
let readyPromise: Promise<void> | null = null;
let nextRequestId = 1;
const pending = new Map<number, PendingSolve>();

const getWorker = (): Worker => {
  if (worker) {
    return worker;
  }

  worker = new Worker(
    new URL("@/search/workers/solverWorker.ts", import.meta.url),
  );

  worker.onmessage = (e: MessageEvent) => {
    const { fn, id, payload } = e.data;
    const request = pending.get(id);

    if (!request) {
      return;
    }

    if (fn === "onPhase") {
      request.onPhase?.(payload as SolvePhase);
    } else if (fn === "onDone") {
      pending.delete(id);
      request.resolve(payload as SolvePhotoResult);
    } else if (fn === "onError") {
      pending.delete(id);
      request.reject(new Error(payload as string));
    }
  };

  return worker;
};

const request = <T>(
  message: Record<string, unknown>,
  handlers: Omit<PendingSolve, "resolve" | "reject"> = {},
): Promise<T> => {
  const id = nextRequestId++;

  return new Promise<T>((resolve, reject) => {
    pending.set(id, {
      resolve: resolve as PendingSolve["resolve"],
      reject,
      ...handlers,
    });
    getWorker().postMessage({ ...message, id });
  });
};

// DB를 미리 받아 인덱스를 만든다. 여러 번 불러도 한 번만 한다. 실패하면 다음 호출에서 다시 한다.
export const preloadSolver = (): Promise<void> => {
  if (!readyPromise) {
    readyPromise = request<void>({ fn: "loadDatabase" }).catch((error) => {
      readyPromise = null;
      throw error;
    });
  }

  return readyPromise;
};

export const solveInWorker = (
  stars: InputStar[],
  width: number,
  height: number,
  onPhase?: (phase: SolvePhase) => void,
): Promise<SolvePhotoResult> =>
  request<SolvePhotoResult>(
    { fn: "solve", payload: { stars, width, height } },
    { onPhase },
  );
