import type { SolvePhase, SolvePhotoResult } from "@/search/solvePhoto";
import type { InputStar } from "@/search/solvers";
import { useCallback, useEffect, useRef, useState } from "react";
import { preloadSolver, solveInWorker } from "@/search/solverClient";

// 공유 풀이 Worker(solverClient)로 사진을 풀고 진행 상황·결과를 화면 상태로 돌려주는 hook.
export default function useSolve() {
  const [outcome, setOutcome] = useState<SolvePhotoResult | null>(null);
  const [solving, setSolving] = useState(false);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<SolvePhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 마지막 요청만 화면에 반영한다(앞선 요청의 응답이 늦게 와도 덮어쓰지 않게)
  const latestRequestRef = useRef(0);

  useEffect(() => {
    let alive = true;

    preloadSolver()
      .then(() => alive && setReady(true))
      .catch((e: Error) => alive && setError(e.message));

    return () => {
      alive = false;
      // 화면을 떠나면 진행 중인 요청의 응답은 버린다
      latestRequestRef.current++;
    };
  }, []);

  const solve = useCallback(
    (stars: InputStar[], width: number, height: number) => {
      const requestNo = ++latestRequestRef.current;
      const isLatest = () => requestNo === latestRequestRef.current;

      setSolving(true);
      setOutcome(null);
      setPhase(null);
      setError(null);

      solveInWorker(stars, width, height, (p) => isLatest() && setPhase(p))
        .then((result) => isLatest() && setOutcome(result))
        .catch((e: Error) => isLatest() && setError(e.message))
        .finally(() => isLatest() && setSolving(false));
    },
    [],
  );

  return { solve, outcome, solving, ready, phase, error };
}
