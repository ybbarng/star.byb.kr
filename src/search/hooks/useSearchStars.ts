import { useCallback, useEffect, useRef, useState } from "react";
import { Candidate, Photo } from "@/search/type";

export default function useSearchStars() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const workerRef = useRef<Worker | undefined>(undefined);

  const onCandidatesFound = useCallback(
    (candidates: Candidate[]) => {
      setCandidates(candidates);
    },
    [setCandidates],
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

  const search = (photo: Photo) => {
    workerRef.current?.postMessage({ fn: "findCandidates", payload: photo });
  };

  return {
    search,
    candidates,
  };
}
