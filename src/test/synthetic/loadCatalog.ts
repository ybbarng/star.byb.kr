import type { Point3D } from "@/scripts/hash/types";
import type { HashedQuad } from "@/search/findCandidatesCore";
import type { ContextStar } from "@/search/solverContext";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { decodeHashedDatabase } from "@/search/hashedDatabaseFormat";

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

// 미리 계산된 DB quad 해시 로더. 앱(Worker)과 같은 이진 파일(build/hash/hashed-database.bin)을
// 같은 함수로 읽는다. 별 번호는 카탈로그(vectors-database.json) 순서를 따른다.
export const hashesPath = resolve(
  process.cwd(),
  "build/hash/hashed-database.bin",
);

export const hashesExist = (): boolean => existsSync(hashesPath);

export const loadHashes = (): HashedQuad[] => {
  const file = readFileSync(hashesPath);
  const buffer = file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength,
  );

  return decodeHashedDatabase(
    buffer,
    loadCatalog().map((s) => s.hr),
  );
};

// 풀이 컨텍스트(buildSolverContext)가 받는 형태로 바꾼다.
export const contextStars = (catalog: CatalogStar[]): ContextStar[] =>
  catalog.map((s) => ({ hr: s.hr, vector: s.vector, mag: s.v }));
