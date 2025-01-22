import { Hash } from "node:crypto";
import * as file from "@/scripts/file";

const run = () => {
  const database = loadDatabase();
  const photo = loadPhoto();

  for (const key of database.keys()) {
    console.log(key);
    console.log(database.get(key));
    console.log(photo.get(key));
  }
};

interface QuadrilateralRecord {
  id: string;
  hash: Hash;
  stars: never;
}

interface Quadrilateral {
  id: string;
  hash: Hash;
}

const loadDatabase = () => {
  const quads = file.loadJson(
    "build/hash/sample",
    "hashed-sample-database.json",
  );
  console.log(
    `로드한 카탈로그에는 총 ${quads.length} 개의 사각형 정보가 있습니다.`,
  );
  const database = quads.map((quad: QuadrilateralRecord): Quadrilateral => {
    return {
      id: quad.id,
      hash: quad.hash,
    };
  });
  const result = new Map();
  database.forEach((row: Quadrilateral) => {
    result.set(row.id, row.hash);
  });

  return result;
};

const loadPhoto = () => {
  const quads = file.loadJson("build/hash/sample", "hashed-photo.json");
  console.log(
    `로드한 사진 데이터에는 총 ${quads.length} 개의 사각형 정보가 있습니다.`,
  );
  const database = quads.map((quad: QuadrilateralRecord): Quadrilateral => {
    return {
      id: quad.id,
      hash: quad.hash,
    };
  });
  const result = new Map();
  database.forEach((row: Quadrilateral) => {
    result.set(row.id, row.hash);
  });

  return result;
};

run();
