import { useMemo, useState } from "react";
import { Star } from "@/scripts/database/types";
import * as hashLib from "@/scripts/hash/hash";
import * as quadrilateral from "@/scripts/hash/quadrilateral";
import { Hash, NamedQuadrilateral2D } from "@/scripts/hash/types";
import { Photo } from "@/search/type";
import catalog from "@build/database/reduced-database.json";
import _hashes from "@build/hash/hashed-database.json";

interface HashedQuad {
  hash: Hash;
  stars: [number, number, number, number];
}

type CandidateInput = [number, number, number, number];

interface CandidateOutputItem {
  hr: number;
  label: string;
}

type CandidateOutput = [
  CandidateOutputItem,
  CandidateOutputItem,
  CandidateOutputItem,
  CandidateOutputItem,
];

interface Candidate {
  input: CandidateInput;
  output: CandidateOutput;
  distance: number;
}

const hashes = _hashes as HashedQuad[];

export default function useSearchStars() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const dictionary = useMemo(() => {
    const dictionary = new Map();
    catalog.map((star: Star) => {
      dictionary.set(star.HR, star.N);
    });

    return dictionary;
  }, [catalog]);

  const zip = (arr1: number[], arr2: number[]) => {
    return arr1.map((value, index) => [value, arr2[index]]);
  };

  const calculateDistance = (v1: number[], v2: number[]) => {
    return zip(v1, v2)
      .map(([a, b]) => Math.pow(a - b, 2))
      .reduce((sum, a) => sum + a, 0);
  };

  const search = (photo: Photo) => {
    const quads = quadrilateral.create(photo.stars).map((quadrilateral) => {
      const hash = hashLib.calculateHash(
        quadrilateral.stars.map((vector, i) => ({
          label: String(i),
          vector,
        })) as NamedQuadrilateral2D,
      );

      return {
        labels: hash.labels,
        hash: hash.hash,
      };
    });

    const candidates: Candidate[] = [];

    quads.forEach((quad) => {
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

      const getName = (hr: number) => {
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
    setCandidates(candidates.sort((ca, cb) => ca.distance - cb.distance));
  };

  return {
    search,
    candidates,
  };
}
