import type { Hash, NamedPoint2D } from "@/scripts/hash/types";
import type {
  Candidate,
  CandidateInput,
  CandidateOutput,
  Photo,
} from "@/search/type";
import * as kdtree from "kd-tree-javascript";
import * as hashLib from "@/scripts/hash/hash";
import * as quadrilateral from "@/scripts/hash/quadrilateral";

// 매칭(후보 검색) 순수 코어. Web Worker(fetch/postMessage)와 분리되어
// node/vitest에서 직접 import해 테스트할 수 있다.

export interface HashedQuad {
  hash: Hash;
  stars: [string, string, string, string];
}

export interface CandidateIndex {
  hashes: HashedQuad[];
  tree: InstanceType<typeof kdtree.kdTree>;
  nameOf: (hr: string) => string;
}

const calculateDistance = (v1: number[], v2: number[]): number => {
  let sum = 0;

  for (let i = 0; i < v1.length; i++) {
    const d = v1[i] - v2[i];
    sum += d * d;
  }

  return sum;
};

// 4D 해시 KD-Tree와 HR→이름 사전을 묶은 검색 인덱스를 만든다.
export const buildCandidateIndex = (
  hashes: HashedQuad[],
  nameOf: (hr: string) => string = (hr) => `HR ${hr}`,
): CandidateIndex => {
  const tree = new kdtree.kdTree(
    hashes.map((hash, i) => ({
      i,
      x: hash.hash[0],
      y: hash.hash[1],
      z: hash.hash[2],
      w: hash.hash[3],
    })),
    (p1, p2) =>
      calculateDistance([p1.x, p1.y, p1.z, p1.w], [p2.x, p2.y, p2.z, p2.w]),
    ["x", "y", "z", "w"],
  );

  return { hashes, tree, nameOf };
};

const findNearestQuads = (
  tree: InstanceType<typeof kdtree.kdTree>,
  quad: number[],
  k: number,
): { index: number; distance: number }[] => {
  const nearest = tree.nearest(
    { i: 0, x: quad[0], y: quad[1], z: quad[2], w: quad[3] },
    k,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return nearest.map((result: any) => ({
    index: result[0].i as number,
    distance: result[1] as number,
  }));
};

export interface FindCandidatesOptions {
  k?: number; // KD-Tree 최근접 이웃 수 (기본 3)
  onProgress?: (progress: number, total: number) => void;
}

// 사진 별들로 quad를 만들어 DB와 매칭한 후보 목록을 distance 오름차순으로 반환한다.
// (사진 별을 상위 N개로 제한하는 것은 호출 측 책임이다.)
export const findCandidates = (
  photo: Photo,
  index: CandidateIndex,
  options: FindCandidatesOptions = {},
): Candidate[] => {
  const k = options.k ?? 3;
  const { hashes, tree, nameOf } = index;

  const namedStars: NamedPoint2D[] = photo.stars.map((star, i) => ({
    label: String(i),
    vector: star,
  }));
  const quads = quadrilateral.create(namedStars).map((q) => {
    const hash = hashLib.calculateHash(q.stars);

    return { labels: hash.labels, hash: hash.hash };
  });

  // 중복 제거: 같은 DB quad(HR 4개 동일)가 여러 번 매칭되면 최소 distance만 유지
  const bestByDbQuad = new Map<string, Candidate>();
  const total = quads.length;

  quads.forEach((quad, i) => {
    options.onProgress?.(i, total);

    const nearestResults = findNearestQuads(tree, quad.hash, k);

    for (const result of nearestResults) {
      if (result.index === -1) {
        continue;
      }

      const found = hashes[result.index].stars;
      const distance = result.distance * 1000;
      const dbKey = found.join(",");
      const existing = bestByDbQuad.get(dbKey);

      if (!existing || distance < existing.distance) {
        bestByDbQuad.set(dbKey, {
          input: quad.labels.map((label) => Number(label)) as CandidateInput,
          output: found.map((hr) => ({
            hr,
            label: nameOf(hr),
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
