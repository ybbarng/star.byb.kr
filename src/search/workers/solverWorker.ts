import type { Point3D } from "@/scripts/hash/types";
import type { HashedQuad } from "@/search/findCandidatesCore";
import type {
  InputStar,
  SolveCandidateResult,
  SolveOutcome,
  SolverContext,
} from "@/search/solvers";
import { buildTriangleIndex } from "@/search/catalogGeometry";
import { buildCandidateIndex } from "@/search/findCandidatesCore";
import { improvedSolver, triangleSolver } from "@/search/solvers";

// 검출 노이즈 비율을 모르므로 입력을 여러 크기로 잘라 각각 풀고 합친다.
// 노이즈가 적은 크기에서 정답이 나오고, 후보군은 모두 합쳐 사람에게 제시한다.
const INPUT_SIZES = [15, 25, 40, 60];

// 후보들을 신뢰도 순으로 정렬하고 같은 하늘 위치(4도 이내)는 하나로 묶는다.
const mergeCandidates = (
  all: SolveCandidateResult[],
  maxN: number,
): SolveCandidateResult[] => {
  const cosThresh = Math.cos((4 * Math.PI) / 180);
  const sorted = [...all].sort(
    (a, b) => b.inlierCount - a.inlierCount || b.confidence - a.confidence,
  );
  const picked: SolveCandidateResult[] = [];

  for (const c of sorted) {
    if (picked.length >= maxN) {
      break;
    }

    const dup = picked.some(
      (p) =>
        p.centerVector[0] * c.centerVector[0] +
          p.centerVector[1] * c.centerVector[1] +
          p.centerVector[2] * c.centerVector[2] >=
        cosThresh,
    );

    if (!dup) {
      picked.push(c);
    }
  }

  return picked;
};

// 검증된 solver 코어(solveCore + solvers)를 브라우저에서 실행하는 Worker.
// DB(매칭 해시 + 검증 카탈로그)를 받아 ctx를 한 번 만들고, 사진 별 목록으로
// solver를 돌려 후보군(transform 포함)을 반환한다.

interface VectorStar {
  HR: string;
  N?: string;
  x: number;
  y: number;
  z: number;
}

let ctx: SolverContext | null = null;
let loadPromise: Promise<void> | null = null;

const loadDatabase = () => {
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

    ctx = {
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
  solverKey?: "improved" | "triangle";
}

onmessage = async function (e) {
  switch (e.data.fn) {
    case "loadDatabase": {
      await loadDatabase();
      postMessage({ fn: "onDatabaseLoaded" });
      break;
    }

    case "solve": {
      await loadDatabase();

      const { stars, width, height, solverKey } = e.data
        .payload as SolveRequest;
      const solver = solverKey === "improved" ? improvedSolver : triangleSolver;
      const sorted = [...stars].sort((a, b) => b.brightness - a.brightness);

      // 여러 입력 크기로 풀어 후보를 모은다 (노이즈 적은 크기에서 정답 나옴)
      const allCandidates: SolveCandidateResult[] = [];
      let best: SolveOutcome | null = null;

      for (const n of INPUT_SIZES) {
        const out = solver.solve(
          sorted.slice(0, n),
          { width, height },
          ctx as SolverContext,
        );
        allCandidates.push(...out.candidates);

        if (out.found && (best === null || out.confidence > best.confidence)) {
          best = out;
        }
      }

      const merged = mergeCandidates(allCandidates, 8);
      const outcome: SolveOutcome = best ?? {
        found: false,
        centerVector: null,
        fovDeg: null,
        confidence: 0,
        inlierCount: 0,
        candidatesEvaluated: 0,
        timeMs: 0,
        transform: null,
        candidates: [],
      };

      postMessage({
        fn: "onSolved",
        payload: { ...outcome, candidates: merged },
      });
      break;
    }

    default:
      break;
  }
};
