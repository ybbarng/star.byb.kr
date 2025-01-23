import { Star } from "@/scripts/database/types";
import * as hashLib from "@/scripts/hash/hash";
import * as quadrilateral from "@/scripts/hash/quadrilateral";
import { Hash, NamedPoint2D } from "@/scripts/hash/types";
import {
  Candidate,
  CandidateInput,
  CandidateOutput,
  Photo,
} from "@/search/type";
import catalog from "@build/database/reduced-database.json";
import _hashes from "@build/hash/hashed-database.json";
const hashes = _hashes as HashedQuad[];

interface HashedQuad {
  hash: Hash;
  stars: [string, string, string, string];
}

const dictionary = new Map<string, string | undefined>();
catalog.map((star: Star) => {
  dictionary.set(star.HR, star.N);
});

const zip = (arr1: number[], arr2: number[]) => {
  return arr1.map((value, index) => [value, arr2[index]]);
};

const calculateDistance = (v1: number[], v2: number[]) => {
  return zip(v1, v2)
    .map(([a, b]) => Math.pow(a - b, 2))
    .reduce((sum, a) => sum + a, 0);
};

const findCandidates = (photo: Photo) => {
  const namedStars: NamedPoint2D[] = photo.stars.map((star, i) => ({
    label: String(i),
    vector: star,
  }));
  const quads = quadrilateral.create(namedStars).map((quadrilateral) => {
    const hash = hashLib.calculateHash(quadrilateral.stars);

    return {
      labels: hash.labels,
      hash: hash.hash,
    };
  });

  const candidates: Candidate[] = [];

  const total = quads.length;
  quads.forEach((quad, i) => {
    postMessage({ fn: "onProgress", payload: { total, progress: i } });
    let minDistance = Number.MAX_VALUE;
    let minIndex = -1;

    for (let i = 0; i < hashes.length; i += 1) {
      const index = hashes[i];
      const distance = calculateDistance(index.hash, quad.hash);

      if (minDistance < distance) {
        continue;
      }

      minDistance = distance;
      minIndex = i;
    }

    if (minIndex === -1) {
      console.log("검색 결과가 없습니다.");

      return;
    }

    const found = hashes[minIndex].stars;

    const getName = (hr: string) => {
      const name = dictionary.get(hr);

      return name ? name : `HR ${hr}`;
    };

    candidates.push({
      input: quad.labels.map((label) => Number(label)) as CandidateInput,
      output: found.map((hr) => ({
        hr,
        label: getName(hr),
      })) as CandidateOutput,
      distance: minDistance * 1000,
    });
  });

  return candidates.sort((ca, cb) => ca.distance - cb.distance);
};

onmessage = async function (messageEvent) {
  switch (messageEvent.data.fn) {
    case "findCandidates": {
      const result = findCandidates(messageEvent.data.payload);
      postMessage({ fn: "onCandidatesFound", payload: result });
      break;
    }

    default:
      break;
  }
};
