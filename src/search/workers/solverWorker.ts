import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { HorizonStar } from "@/search/horizonSolve";
import type { Glow } from "@/search/milkyWayGlow";
import type { SkyMap } from "@/search/milkyWaySolve";
import type { SolvePhase } from "@/search/solvePhoto";
import type { InputStar, SolverContext } from "@/search/solvers";
import type { Observer } from "@/search/utils/ephemeris";
import { horizonSolve } from "@/search/horizonSolve";
import { solvePhotoWithMilkyWay } from "@/search/milkyWaySolve";
import { generateQuadDatabase } from "@/search/quadDatabase";
import { buildSolverContext, unpackDeepStars } from "@/search/solverContext";
import { rankForSolving } from "@/search/utils/selectStars";
import { koreanStarName } from "@/search/utils/starNames";
import deepStarsData from "@build/database/deep-stars.json";
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

// 별 카탈로그(검증 전용 어두운 별 포함)는 Worker 코드에 함께 실려 오고(따로 받지 않는다), quad 해시 DB는 여기서 만든다
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

    return buildSolverContext(
      stars,
      hashes,
      nameOf,
      unpackDeepStars(deepStarsData as number[]),
    );
  })();

  return loadPromise;
};

interface SolveRequest {
  stars: InputStar[];
  width: number;
  height: number;
  glows?: { band: Glow; map: Glow } | null;
}

// 은하수 밝기 지도(360×180 회색조, 흐림까지 적용, 약 13KB 압축). 처음 필요할 때 한 번만 받는다.
// 못 받으면 지도 없이(띠 중심선만으로) 푼다. 출처: ESO/S. Brunier (eso0932a), CC BY 4.0
let skyMapPromise: Promise<SkyMap | null> | null = null;

const loadSkyMap = (): Promise<SkyMap | null> => {
  skyMapPromise ??= fetch("/sky/milky-way-360x180.bin")
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
    .then((buf) => ({ data: new Uint8Array(buf), w: 360, h: 180 }))
    .catch(() => {
      skyMapPromise = null;

      return null;
    });

  return skyMapPromise;
};

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
        const { stars, width, height, glows } = e.data.payload as SolveRequest;
        const result = solvePhotoWithMilkyWay(
          stars,
          { width, height },
          ctx,
          glows ? { glows, skyMap: await loadSkyMap() } : null,
          {
            onPhase: (phase: SolvePhase) =>
              postMessage({ fn: "onPhase", id, payload: phase }),
          },
        );

        postMessage({ fn: "onDone", id, payload: result });
        break;
      }

      case "horizonSolve": {
        await loadDatabase();
        const { stars, width, height, horizon, dateMs, observer } = e.data
          .payload as HorizonSolveRequest;
        const result = horizonSolve({
          // 별 궤적 점은 노출 중간 순간의 자리라 시각을 아는 풀이에는 쓰지 않는다
          photoStars: rankForSolving(stars, width, height)
            .filter((s) => !s.trail)
            .map((s): Point2D => [s.x, s.y]),
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

      // 모르는 요청에도 답해, 화면 쪽 요청이 끝나지 않고 남지 않게 한다.
      // 던지지 않는다: 아래 catch는 만들어 둔 DB를 비운다
      default:
        postMessage({ fn: "onError", id, payload: `모르는 요청: ${fn}` });
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
