import type { Point3D } from "@/scripts/hash/types";
import type { HashedQuad } from "@/search/findCandidatesCore";
import type { InputStar, SolverContext } from "@/search/solvers";
import { buildTriangleIndex } from "@/search/catalogGeometry";
import { buildCandidateIndex } from "@/search/findCandidatesCore";
import { improvedSolver, triangleSolver } from "@/search/solvers";

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
      const outcome = solver.solve(
        stars,
        { width, height },
        ctx as SolverContext,
      );

      postMessage({ fn: "onSolved", payload: outcome });
      break;
    }

    default:
      break;
  }
};
