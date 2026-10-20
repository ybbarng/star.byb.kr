import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { HorizonStar } from "@/search/horizonSolve";
import type { SolvePhase } from "@/search/solvePhoto";
import type { InputStar, SolverContext } from "@/search/solvers";
import type { Observer } from "@/search/utils/ephemeris";
import { horizonSolve } from "@/search/horizonSolve";
import { generateQuadDatabase } from "@/search/quadDatabase";
import { solvePhoto } from "@/search/solvePhoto";
import { buildSolverContext } from "@/search/solverContext";
import { rankForSolving } from "@/search/utils/selectStars";
import { koreanStarName } from "@/search/utils/starNames";
import catalogData from "@build/database/vectors-database.json";

// 검증된 풀이 코어(solvePhoto)를 브라우저에서 실행하는 Worker.
// 카탈로그로 quad 해시 DB와 인덱스(ctx)를 한 번 만들고, 사진 별 목록으로 풀어
// 결과(확신한 해 또는 후보군)를 돌려준다. 풀이 흐름 자체는 solvePhoto에 있다.

interface VectorStar {
  HR: string;
  N?: string;
  V: string;
  x: number;
  y: number;
  z: number;
}

let loadPromise: Promise<SolverContext> | null = null;
// 시각 제약 풀이(horizonSolve)는 별 밝기가 필요해 따로 들고 있는다
let horizonCatalog: HorizonStar[] = [];

// 별 카탈로그는 Worker 코드에 함께 실려 오고(따로 받지 않는다), quad 해시 DB는 여기서 만든다
// (예전에는 /data/hashed-database.bin 압축 1.5MB를 받았다 — quadDatabase.ts).
const loadDatabase = (): Promise<SolverContext> => {
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const vectors = catalogData as VectorStar[];
    const stars = vectors.map((s) => ({
      hr: s.HR,
      vector: [s.x, s.y, s.z] as Point3D,
      mag: parseFloat(s.V),
    }));
    const hashes = generateQuadDatabase(stars);
    horizonCatalog = stars.map(({ vector, mag }) => ({ vector, mag }));
    const nameMap = new Map<string, string | undefined>(
      vectors.map((s) => [s.HR, s.N && koreanStarName(s.N)]),
    );
    const nameOf = (hr: string) => nameMap.get(hr) ?? `HR ${hr}`;

    return buildSolverContext(stars, hashes, nameOf);
  })();

  return loadPromise;
};

interface SolveRequest {
  stars: InputStar[];
  width: number;
  height: number;
}

interface HorizonSolveRequest extends SolveRequest {
  horizon: [Point2D, Point2D];
  dateMs: number;
  observer: Observer;
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

      case "horizonSolve": {
        await loadDatabase();
        const { stars, width, height, horizon, dateMs, observer } = e.data
          .payload as HorizonSolveRequest;
        const result = horizonSolve({
          photoStars: rankForSolving(stars, width, height).map(
            (s): Point2D => [s.x, s.y],
          ),
          width,
          height,
          horizon,
          date: new Date(dateMs),
          observer,
          catalog: horizonCatalog,
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
