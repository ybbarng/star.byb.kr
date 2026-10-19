import type { Point3D } from "@/scripts/hash/types";
import type { HashedQuad } from "@/search/findCandidatesCore";
import type { SolvePhase } from "@/search/solvePhoto";
import type { InputStar, SolverContext } from "@/search/solvers";
import { buildTriangleIndex } from "@/search/catalogGeometry";
import { buildCandidateIndex } from "@/search/findCandidatesCore";
import { solvePhoto } from "@/search/solvePhoto";

// 검증된 풀이 코어(solvePhoto)를 브라우저에서 실행하는 Worker.
// DB(매칭 해시 + 검증 카탈로그)를 받아 ctx를 한 번 만들고, 사진 별 목록으로 풀어
// 결과(확신한 해 또는 후보군)를 돌려준다. 풀이 흐름 자체는 solvePhoto에 있다.

interface VectorStar {
  HR: string;
  N?: string;
  x: number;
  y: number;
  z: number;
}

let loadPromise: Promise<SolverContext> | null = null;

const loadDatabase = (): Promise<SolverContext> => {
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const origin = self.location.origin;
    const hashes = (await (
      await fetch(new URL("/data/hashed-database.json", origin))
    ).json()) as HashedQuad[];
    const vectors = (await (
      await fetch(new URL("/data/vectors-database.json", origin))
    ).json()) as VectorStar[];

    const solveStars = vectors.map((s) => ({
      hr: s.HR,
      vector: [s.x, s.y, s.z] as Point3D,
    }));
    const byHrVec = new Map<string, Point3D>(
      vectors.map((s) => [s.HR, [s.x, s.y, s.z]]),
    );
    const nameMap = new Map<string, string | undefined>(
      vectors.map((s) => [s.HR, s.N]),
    );
    const nameOf = (hr: string) => nameMap.get(hr) ?? `HR ${hr}`;

    return {
      index: buildCandidateIndex(hashes, nameOf),
      catalog: solveStars,
      byHrVec,
      triangleIndex: buildTriangleIndex(solveStars, 18),
    };
  })();

  return loadPromise;
};

interface SolveRequest {
  stars: InputStar[];
  width: number;
  height: number;
}

// 메시지마다 요청 번호(id)를 그대로 돌려줘, 화면이 어느 요청의 응답인지 구분하게 한다.
// 응답: onPhase(진행 단계) → onDone(결과) 또는 onError(오류 메시지)
onmessage = async function (e) {
  const { fn, id } = e.data;

  try {
    switch (fn) {
      case "loadDatabase": {
        await loadDatabase();
        postMessage({ fn: "onDone", id });
        break;
      }

      case "solve": {
        const ctx = await loadDatabase();
        const { stars, width, height } = e.data.payload as SolveRequest;
        const result = solvePhoto(stars, { width, height }, ctx, undefined, {
          onPhase: (phase: SolvePhase) =>
            postMessage({ fn: "onPhase", id, payload: phase }),
        });

        postMessage({ fn: "onDone", id, payload: result });
        break;
      }

      default:
        break;
    }
  } catch (error) {
    // 실패한 로딩은 다음 요청에서 다시 시도할 수 있게 비운다
    loadPromise = null;
    postMessage({
      fn: "onError",
      id,
      payload: error instanceof Error ? error.message : String(error),
    });
  }
};
