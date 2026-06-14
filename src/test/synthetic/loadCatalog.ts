import type { Point3D } from "@/scripts/hash/types";
import type { HashedQuad } from "@/search/findCandidatesCore";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// 빌드 산출물(build/database/vectors-database.json)을 테스트용으로 로드한다.
// 시스템 DB와 동일한 별 집합·좌표를 써야 합성 데이터가 의미를 갖는다.

export interface CatalogStar {
  hr: string;
  vector: Point3D;
  v: number; // 시등급(V). 작을수록 밝다.
}

export const catalogPath = resolve(
  process.cwd(),
  "build/database/vectors-database.json",
);

export const catalogExists = (): boolean => existsSync(catalogPath);

export const loadCatalog = (): CatalogStar[] => {
  const raw = JSON.parse(readFileSync(catalogPath, "utf-8")) as {
    HR: string;
    x: number;
    y: number;
    z: number;
    V: string;
  }[];

  return raw.map((s) => ({
    hr: s.HR,
    vector: [s.x, s.y, s.z],
    v: parseFloat(s.V),
  }));
};

// 미리 계산된 DB quad 해시(build/hash/hashed-database.json) 로더.
export const hashesPath = resolve(
  process.cwd(),
  "build/hash/hashed-database.json",
);

export const hashesExist = (): boolean => existsSync(hashesPath);

export const loadHashes = (): HashedQuad[] =>
  JSON.parse(readFileSync(hashesPath, "utf-8")) as HashedQuad[];
