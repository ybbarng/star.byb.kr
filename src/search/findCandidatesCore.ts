import type {
  Hash,
  NamedPoint2D,
  NamedQuadrilateral2D,
} from "@/scripts/hash/types";
import type {
  Candidate,
  CandidateInput,
  CandidateOutput,
  Photo,
} from "@/search/type";
import type { KdTree4 } from "@/search/utils/kdTree4";
import * as hashLib from "@/scripts/hash/hash";
import * as quadrilateral from "@/scripts/hash/quadrilateral";
import { buildKdTree4, nearestK } from "@/search/utils/kdTree4";

// 매칭(후보 검색) 순수 코어. Web Worker(fetch/postMessage)와 분리되어
// node/vitest에서 직접 import해 테스트할 수 있다.

export interface HashedQuad {
  hash: Hash;
  stars: [string, string, string, string];
}

export interface CandidateIndex {
  hashes: HashedQuad[];
  tree: KdTree4;
  nameOf: (hr: string) => string;
}

// 4D 해시 KD-tree와 HR→이름 사전을 묶은 검색 인덱스를 만든다.
export const buildCandidateIndex = (
  hashes: HashedQuad[],
  nameOf: (hr: string) => string = (hr) => `HR ${hr}`,
): CandidateIndex => {
  const coords = new Float64Array(hashes.length * 4);

  hashes.forEach((q, i) => coords.set(q.hash, i * 4));

  return { hashes, tree: buildKdTree4(coords), nameOf };
};

export interface FindCandidatesOptions {
  k?: number; // KD-Tree 최근접 이웃 수 (기본 3)
  // 지정 시 전수조합(C(N,4)) 대신 각 별의 가까운 이웃으로만 compact quad를 만든다.
  // 큰 FOV에서 패턴이 작아져 gnomonic 왜곡이 줄고 DB(compact quad)와 잘 매칭된다.
  localNeighbors?: number;
  onProgress?: (progress: number, total: number) => void;
}

// 각 별 + 그 별의 가까운 이웃 3개로 compact quad를 만든다 (중복 제거).
const createLocalQuads = (
  stars: NamedPoint2D[],
  maxNeighbor: number,
): NamedQuadrilateral2D[] => {
  const result: NamedQuadrilateral2D[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < stars.length; i++) {
    const nb = stars
      .map((s, j) => {
        const dx = s.vector[0] - stars[i].vector[0];
        const dy = s.vector[1] - stars[i].vector[1];

        return { j, d: dx * dx + dy * dy };
      })
      .filter((x) => x.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, maxNeighbor)
      .map((x) => x.j);

    for (let a = 0; a < nb.length - 2; a++) {
      for (let b = a + 1; b < nb.length - 1; b++) {
        for (let c = b + 1; c < nb.length; c++) {
          const idx = [i, nb[a], nb[b], nb[c]].sort((x, y) => x - y);
          const key = idx.join(",");

          if (seen.has(key)) {
            continue;
          }

          seen.add(key);
          result.push([
            stars[idx[0]],
            stars[idx[1]],
            stars[idx[2]],
            stars[idx[3]],
          ]);
        }
      }
    }
  }

  return result;
};

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
  const quadStars: NamedQuadrilateral2D[] = options.localNeighbors
    ? createLocalQuads(namedStars, options.localNeighbors)
    : quadrilateral.create(namedStars).map((q) => q.stars);
  const quads = quadStars.map((stars4) => {
    const hash = hashLib.calculateHash(stars4);

    return { labels: hash.labels, hash: hash.hash };
  });

  // 중복 제거: 같은 DB quad(HR 4개 동일)가 여러 번 매칭되면 최소 distance만 유지
  const bestByDbQuad = new Map<string, Candidate>();
  const total = quads.length;

  quads.forEach((quad, i) => {
    options.onProgress?.(i, total);

    for (const result of nearestK(tree, quad.hash, k)) {
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
