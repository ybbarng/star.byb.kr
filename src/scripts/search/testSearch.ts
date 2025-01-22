import { Star } from "@/scripts/database/types";
import * as file from "@/scripts/file";
import * as hashLib from "@/scripts/hash/hash";
import * as quadrilateral from "@/scripts/hash/quadrilateral";
import { Hash, NamedQuadrilateral2D, Point2D } from "@/scripts/hash/types";

interface HashedQuad {
  hash: Hash;
  stars: [number, number, number, number];
}
const hashes: HashedQuad[] = file.loadJson(
  "build/hash",
  "hashed-database.json",
);
const catalog: Star[] = file.loadJson(
  "build/database",
  "reduced-database.json",
);

const samples = [
  file.loadJson("data/search", "ursa-major.json"),
  file.loadJson("data/search", "orion.json"),
  file.loadJson("data/search", "saipan.json"),
];

interface SampleStar {
  label: string;
  position: Point2D;
  brightness: number;
}

interface Sample {
  width: number;
  height: number;
  stars: SampleStar[];
}

const sample: Sample = samples[2];

// 프론트에서는 감지된 밝기를 기준으로 별을 정렬해서 보내주므로, 이를 시뮬레이션 (샘플 데이터에서는 밝을수록 숫자가 큼)
const stars = sample.stars.sort((a, b) => b.brightness - a.brightness);

const quads = quadrilateral.create(stars).map((quadrilateral) => {
  const hash = hashLib.calculateHash(
    quadrilateral.stars.map((item) => ({
      label: item.label,
      vector: item.position,
    })) as NamedQuadrilateral2D,
  );

  return {
    labels: hash.labels,
    hash: hash.hash,
  };
});

console.log(`미리 계산한 해시 목록 정보: ${hashes.length}개`);

const zip = (arr1: number[], arr2: number[]) => {
  return arr1.map((value, index) => [value, arr2[index]]);
};

const calculateDistance = (v1: number[], v2: number[]) => {
  return zip(v1, v2)
    .map(([a, b]) => Math.pow(a - b, 2))
    .reduce((sum, a) => sum + a, 0);
};

const dictionary = new Map();
catalog.map((star: Star) => {
  dictionary.set(star.HR, star.N);
});

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

  const candidate = hashes[minIndex].stars.map((hr: number) => {
    const name = dictionary.get(hr);

    return name ? name : `HR ${hr}`;
  });
  const printName = true;

  if (printName) {
    console.log(`${quad.labels} => ${candidate}`);
  } else {
    console.log(`${quad.labels} => ${hashes[minIndex].stars}`);
  }
});
