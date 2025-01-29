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

const zip = (arr1: number[], arr2: number[]) => {
  return arr1.map((value, index) => [value, arr2[index]]);
};

const calculateDistance = (v1: number[], v2: number[]) => {
  return zip(v1, v2)
    .map(([a, b]) => Math.pow(a - b, 2))
    .reduce((sum, a) => sum + a, 0);
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

const findNearestQuads = (quad: number[]) => {
  const nearest = tree.nearest(
    {
      i: 0,
      x: quad[0],
      y: quad[1],
      z: quad[2],
      w: quad[3],
    },
    1,
  );

  return nearest[0][0].i;
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
    const minIndex = findNearestQuads(quad.hash);

    if (minIndex === -1) {
      console.log("검색 결과가 없습니다.");

      return;
    }

    const found = hashes[minIndex].stars;
    const minDistance = calculateDistance(hashes[minIndex].hash, quad.hash);

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
