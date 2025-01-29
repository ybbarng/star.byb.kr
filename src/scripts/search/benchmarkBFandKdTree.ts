console.log(`[${new Date()}] Benchmark 스크립트 로드를 시작합니다.`);

import * as kdtree from "kd-tree-javascript";
import { Star } from "@/scripts/database/types";
import { Hash } from "@/scripts/hash/types";
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

const nTreeStart = new Date().getTime();
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

const nTreeEnd = new Date().getTime(); //종료시간 체크(단위 ms)
const nTreeDiff = nTreeEnd - nTreeStart; //두 시간차 계산(단위 ms)
console.log(`kdtree를 준비하는데에 ${nTreeDiff}ms 가 소요되었습니다.`);

const findNearestQuadByBruteForce = (quad: number[]) => {
  let minDistance = Number.MAX_VALUE;
  let minIndex = -1;

  for (let i = 0; i < hashes.length; i += 1) {
    const index = hashes[i];
    const distance = calculateDistance(index.hash, quad);

    if (minDistance < distance) {
      continue;
    }

    minDistance = distance;
    minIndex = i;
  }

  return minIndex;
};

const findNearestQuadsByKdTree = (quad: number[]) => {
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

const benchmark = (
  quad: number[],
  iterations: number,
  useBruteForce: boolean,
) => {
  const fnName = useBruteForce ? "BruteForce" : "KdTree";
  console.log(`${fnName}를  ${iterations} 회 실행합니다.`);

  const findNearestQuadFn = useBruteForce
    ? findNearestQuadByBruteForce
    : findNearestQuadsByKdTree;

  const nStart = new Date().getTime(); //종료시간 체크(단위 ms)

  for (let i = 0; i < iterations; i++) {
    findNearestQuadFn(quad);
  }

  const nEnd = new Date().getTime(); //종료시간 체크(단위 ms)
  const nDiff = nEnd - nStart; //두 시간차 계산(단위 ms)
  console.log(
    `${fnName}를 ${iterations} 회 실행하는데에 ${nDiff}ms 가 소요되었습니다.`,
  );
};

const run = (testQuad: number[]) => {
  benchmark(testQuad, 1, true);
  benchmark(testQuad, 3000, false);
};

const testSet = [
  [
    0.32096622274206754, 0.18395542640098925, 0.409652485468758,
    0.40679161734569014,
  ],
];
run(testSet[0]);
