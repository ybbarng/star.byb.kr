import * as kdtree from "kd-tree-javascript";
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

const calculateDistance = (v1: number[], v2: number[]) => {
  let sum = 0;

  for (let i = 0; i < v1.length; i++) {
    const d = v1[i] - v2[i];
    sum += d * d;
  }

  return sum;
};

const tree = new kdtree.kdTree(
  hashes.map((hash, i) => {
    return {
      i,
      x: hash.hash[0],
      y: hash.hash[1],
      z: hash.hash[2],
      w: hash.hash[3],
    };
  }),
  (p1, p2) =>
    calculateDistance([p1.x, p1.y, p1.z, p1.w], [p2.x, p2.y, p2.z, p2.w]),
  ["x", "y", "z", "w"],
);

const findNearestQuads = (
  quad: number[],
): { index: number; distance: number }[] => {
  const nearest = tree.nearest(
    {
      i: 0,
      x: quad[0],
      y: quad[1],
      z: quad[2],
      w: quad[3],
    },
    3,
  );

  return nearest.map((result: [{ i: number }, number]) => ({
    index: result[0].i,
    distance: result[1],
  }));
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

  const getName = (hr: string) => {
    const name = dictionary.get(hr);

    return name ? name : `HR ${hr}`;
  };

  // 중복 제거를 위한 Map: DB quad의 HR 키 → 최소 distance
  const bestByDbQuad = new Map<string, Candidate>();

  const total = quads.length;
  quads.forEach((quad, i) => {
    postMessage({ fn: "onProgress", payload: { total, progress: i } });
    const nearestResults = findNearestQuads(quad.hash);

    for (const result of nearestResults) {
      if (result.index === -1) continue;

      const found = hashes[result.index].stars;
      const distance = result.distance * 1000;

      // 중복 제거: 같은 DB quad(HR 4개 동일)가 여러 번 매칭되면 최소 distance만 유지
      const dbKey = found.join(",");
      const existing = bestByDbQuad.get(dbKey);

      if (!existing || distance < existing.distance) {
        bestByDbQuad.set(dbKey, {
          input: quad.labels.map((label) => Number(label)) as CandidateInput,
          output: found.map((hr) => ({
            hr,
            label: getName(hr),
          })) as CandidateOutput,
          distance,
        });
      }
    }
  });

  return Array.from(bestByDbQuad.values()).sort(
    (ca, cb) => ca.distance - cb.distance,
  );
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
