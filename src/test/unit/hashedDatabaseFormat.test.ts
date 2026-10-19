import type { HashedQuad } from "@/search/findCandidatesCore";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  decodeHashedDatabase,
  encodeHashedDatabase,
} from "@/search/hashedDatabaseFormat";
import { loadCatalog, loadHashes } from "@/test/synthetic/loadCatalog";

const jsonPath = resolve(process.cwd(), "build/hash/hashed-database.json");

describe("quad 해시 DB 이진 형식", () => {
  const hrs = ["9", "21", "39", "45"];
  const quads: HashedQuad[] = [
    { stars: ["9", "21", "39", "45"], hash: [-0.04, 0.66, 0.91, 0.29] },
    { stars: ["45", "39", "21", "9"], hash: [0.5, -0.25, 1.28, 0.08] },
    // 별 번호(Uint16)가 홀수 개 바이트로 끝나도 해시 시작이 4바이트 정렬되는지
    { stars: ["21", "9", "45", "39"], hash: [1, 0, -1, 0.125] },
  ];

  it("인코딩한 뒤 디코딩하면 원래와 같다 (해시는 Float32 정밀도)", () => {
    const decoded = decodeHashedDatabase(encodeHashedDatabase(quads, hrs), hrs);

    expect(decoded.map((q) => q.stars)).toEqual(quads.map((q) => q.stars));
    decoded.forEach((q, i) =>
      q.hash.forEach((v, k) => expect(v).toBeCloseTo(quads[i].hash[k], 6)),
    );
  });

  it("카탈로그에 없는 별은 거부한다", () => {
    expect(() =>
      encodeHashedDatabase(
        [{ stars: ["1", "9", "21", "39"], hash: [0, 0, 0, 0] }],
        hrs,
      ),
    ).toThrow();
  });

  it("다른 형식의 파일은 거부한다", () => {
    expect(() =>
      decodeHashedDatabase(new TextEncoder().encode("[{}]...").buffer, hrs),
    ).toThrow();
  });

  it.skipIf(!existsSync(jsonPath))(
    "빌드된 이진 DB가 JSON DB와 같은 quad를 담는다",
    () => {
      const fromJson = JSON.parse(
        readFileSync(jsonPath, "utf-8"),
      ) as HashedQuad[];
      const fromBin = loadHashes();

      expect(fromBin.length).toBe(fromJson.length);
      expect(fromBin.map((q) => q.stars)).toEqual(fromJson.map((q) => q.stars));
      fromBin.forEach((q, i) =>
        q.hash.forEach((v, k) =>
          expect(Math.abs(v - fromJson[i].hash[k])).toBeLessThan(1e-6),
        ),
      );
      expect(loadCatalog().length).toBeLessThan(0xffff);
    },
    60000,
  );
});
