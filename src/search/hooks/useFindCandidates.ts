import { useCallback, useEffect, useRef, useState } from "react";
import { Candidate, Photo } from "@/search/type";

export default function useFindCandidates() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const workerRef = useRef<Worker | undefined>(undefined);

  const onCandidatesFound = useCallback(
    (candidates: Candidate[]) => {
      setCandidates(candidates);
    },
    [setCandidates],
  );

  const onProgress = useCallback(
    ({ total, progress }: { total: number; progress: number }) => {
      console.log(`onProgress: ${progress} / ${total}`);
    },
    [],
  );

  useEffect(() => {
    const worker = new Worker(
      new URL("@/search/workers/findCandidatesWorker.ts", import.meta.url),
    );

    worker.onmessage = (messageEvent) => {
      switch (messageEvent.data.fn) {
        case "onCandidatesFound":
          onCandidatesFound(messageEvent.data.payload);
          break;
        case "onProgress":
          onProgress(messageEvent.data.payload);
          break;
      }
    };

    worker.onerror = (errorEvent) => {
      console.error(errorEvent.message);
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = undefined;
    };
  }, []);

  const find = (photo: Photo) => {
    workerRef.current?.postMessage({ fn: "findCandidates", payload: photo });
  };

  return {
    find,
    candidates,
  };
}
