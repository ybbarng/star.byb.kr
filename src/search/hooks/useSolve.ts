import type { InputStar, SolveOutcome } from "@/search/solvers";
import { useCallback, useEffect, useRef, useState } from "react";

// 검증된 solver 코어를 Worker에서 돌려 후보군을 받는 hook.
export default function useSolve() {
  const [outcome, setOutcome] = useState<SolveOutcome | null>(null);
  const [solving, setSolving] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | undefined>(undefined);

  useEffect(() => {
    const worker = new Worker(
      new URL("@/search/workers/solverWorker.ts", import.meta.url),
    );

    worker.onmessage = (e: MessageEvent) => {
      if (e.data.fn === "onDatabaseLoaded") {
        setReady(true);
      } else if (e.data.fn === "onSolved") {
        setOutcome(e.data.payload as SolveOutcome);
        setSolving(false);
      } else if (e.data.fn === "onError") {
        setError(e.data.payload as string);
        setSolving(false);
      }
    };

    worker.postMessage({ fn: "loadDatabase" });
    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = undefined;
    };
  }, []);

  const solve = useCallback(
    (
      stars: InputStar[],
      width: number,
      height: number,
      solverKey?: "improved" | "triangle",
    ) => {
      setSolving(true);
      setOutcome(null);
      setError(null);
      workerRef.current?.postMessage({
        fn: "solve",
        payload: { stars, width, height, solverKey },
      });
    },
    [],
  );

  return { solve, outcome, solving, ready, error };
}
