import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { HorizonStar } from "@/search/horizonSolve";
import type { SolvePhase } from "@/search/solvePhoto";
import type { InputStar, SolverContext } from "@/search/solvers";
import type { Observer } from "@/search/utils/ephemeris";
import { decodeHashedDatabase } from "@/search/hashedDatabaseFormat";
import { horizonSolve } from "@/search/horizonSolve";
import { solvePhoto } from "@/search/solvePhoto";
import { buildSolverContext } from "@/search/solverContext";
import { rankForSolving } from "@/search/utils/selectStars";
import { koreanStarName } from "@/search/utils/starNames";

// 검증된 풀이 코어(solvePhoto)를 브라우저에서 실행하는 Worker.
// DB(매칭 해시 + 검증 카탈로그)를 받아 ctx를 한 번 만들고, 사진 별 목록으로 풀어
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

// 응답이 실패(404 등)면 바로 오류로 알린다 (그대로 파싱하면 엉뚱한 오류가 난다)
const fetchOk = async (url: URL): Promise<Response> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `별 데이터베이스를 받지 못했습니다 (${response.status} ${url.pathname})`,
    );
  }

  return response;
};

const loadDatabase = (): Promise<SolverContext> => {
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const origin = self.location.origin;
    // 두 파일을 함께 받는다. quad 해시는 이진 형식(약 2MB, 파싱 없음)이고 별 번호는
    // vectors-database.json의 순서를 따른다.
    const [hashesBuffer, vectors] = await Promise.all([
      fetchOk(new URL("/data/hashed-database.bin", origin)).then((r) =>
        r.arrayBuffer(),
      ),
      fetchOk(new URL("/data/vectors-database.json", origin)).then(
        (r) => r.json() as Promise<VectorStar[]>,
      ),
    ]);
    const hashes = decodeHashedDatabase(
      hashesBuffer,
      vectors.map((s) => s.HR),
    );

    const stars = vectors.map((s) => ({
      hr: s.HR,
      vector: [s.x, s.y, s.z] as Point3D,
      mag: parseFloat(s.V),
    }));
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
