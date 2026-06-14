import { Star } from "@/scripts/database/types";
import {
  buildCandidateIndex,
  findCandidates,
  type CandidateIndex,
  type HashedQuad,
} from "@/search/findCandidatesCore";
import { Photo } from "@/search/type";
import catalog from "@build/database/reduced-database.json";

// 매칭 알고리즘은 findCandidatesCore에 있고, 이 worker는 DB 로딩(fetch)과
// 메인 스레드와의 메시지 전달(progress 포함)만 담당한다.

const dictionary = new Map<string, string | undefined>();
catalog.map((star: Star) => {
  dictionary.set(star.HR, star.N);
});
const nameOf = (hr: string) => dictionary.get(hr) ?? `HR ${hr}`;

let index: CandidateIndex | null = null;
let loadPromise: Promise<void> | null = null;

const loadDatabase = () => {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const response = await fetch(
      new URL("/data/hashed-database.json", self.location.origin),
    );
    const hashes = (await response.json()) as HashedQuad[];
    index = buildCandidateIndex(hashes, nameOf);
  })();

  return loadPromise;
};

onmessage = async function (messageEvent) {
  switch (messageEvent.data.fn) {
    case "loadDatabase": {
      await loadDatabase();
      postMessage({ fn: "onDatabaseLoaded" });
      break;
    }

    case "findCandidates": {
      if (!index) {
        await loadDatabase();
      }

      const result = findCandidates(
        messageEvent.data.payload as Photo,
        index as CandidateIndex,
        {
          onProgress: (progress, total) =>
            postMessage({ fn: "onProgress", payload: { total, progress } }),
        },
      );
      postMessage({ fn: "onCandidatesFound", payload: result });
      break;
    }

    default:
      break;
  }
};
