import type { Point2D } from "@/scripts/hash/types";
import type { HorizonSolveResult } from "@/search/horizonSolve";
import type { Glow } from "@/search/milkyWayGlow";
import type { SolvePhase, SolvePhotoResult } from "@/search/solvePhoto";
import type { InputStar } from "@/search/solvers";
import type { Observer } from "@/search/utils/ephemeris";

// 풀이 Worker를 앱 전체에서 하나만 두고 공유한다.
// DB 로딩과 인덱스 구축은 무거우므로 페이지를 열 때 한 번 시작해(preloadSolver),
// 단계를 오가도 다시 하지 않는다. 화면 컴포넌트는 useSolve로 이 모듈을 쓴다.
// Worker가 통째로 죽으면(스크립트를 못 받음·시작하다 실패·응답을 못 읽음) 기다리던 요청을 모두 실패로 끝내고
// 다음 요청 때 새로 띄운다 (새 Worker는 풀이 요청을 받으면 DB부터 다시 만든다).

interface PendingSolve {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  onPhase?: (phase: SolvePhase) => void;
}

let worker: Worker | null = null;
let readyPromise: Promise<void> | null = null;
let nextRequestId = 1;
const pending = new Map<number, PendingSolve>();

const asError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

// 이 Worker를 버리고 기다리던 요청을 모두 실패로 끝낸다. 미리 만든 DB도 함께 사라지므로 준비 상태도 지운다
const failAll = (dead: Worker, error: Error) => {
  // 이미 버리고 새로 띄운 뒤에 옛 Worker의 소식이 오면 새 Worker의 요청을 건드리지 않는다
  if (worker !== dead) {
    return;
  }

  dead.terminate();
  worker = null;
  readyPromise = null;
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
    new URL("@/search/workers/solverWorker.ts", import.meta.url),
  );
  worker = created;

  created.onerror = (e: ErrorEvent) =>
    failAll(created, new Error(e.message || "풀이 Worker가 멈췄습니다."));
  created.onmessageerror = () =>
    failAll(created, new Error("풀이 Worker의 응답을 읽지 못했습니다."));

  created.onmessage = (e: MessageEvent) => {
    const { fn, id, payload } = e.data;
    const request = pending.get(id);

    if (!request) {
      return;
    }

    if (fn === "onPhase") {
      request.onPhase?.(payload as SolvePhase);
    } else if (fn === "onDone") {
      pending.delete(id);
      request.resolve(payload);
    } else if (fn === "onError") {
      pending.delete(id);
      request.reject(new Error(payload as string));
    }
  };

  return created;
};

const request = <T>(
  message: Record<string, unknown>,
  handlers: Omit<PendingSolve, "resolve" | "reject"> = {},
): Promise<T> => {
  const id = nextRequestId++;

  return new Promise<T>((resolve, reject) => {
    try {
      const target = getWorker();
      pending.set(id, {
        resolve: resolve as PendingSolve["resolve"],
        reject,
        ...handlers,
      });
      target.postMessage({ ...message, id });
    } catch (e) {
      // Worker를 못 띄우거나 보내지 못했다
      pending.delete(id);
      reject(asError(e));
    }
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

// glows(사진의 흐린 회색조 썸네일)를 주면, 확신하지 못했을 때 은하수 띠·지도 대조로 한 번 더 푼다 (journey 57장)
export const solveInWorker = (
  stars: InputStar[],
  width: number,
  height: number,
  onPhase?: (phase: SolvePhase) => void,
  glows?: { band: Glow; map: Glow } | null,
): Promise<SolvePhotoResult> =>
  request<SolvePhotoResult>(
    { fn: "solve", payload: { stars, width, height, glows } },
    { onPhase },
  );

// 촬영 시각·장소와 사진 속 지평선으로 푼다 (별이 적어 blind 풀이가 확신하지 못하는 사진용)
export const horizonSolveInWorker = (
  stars: InputStar[],
  width: number,
  height: number,
  horizon: [Point2D, Point2D],
  date: Date,
  observer: Observer,
): Promise<HorizonSolveResult | null> =>
  request<HorizonSolveResult | null>({
    fn: "horizonSolve",
    payload: {
      stars,
      width,
      height,
      horizon,
      dateMs: date.getTime(),
      observer,
    },
  });
