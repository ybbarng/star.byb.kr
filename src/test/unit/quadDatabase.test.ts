import { describe, expect, it } from "vitest";
import {
  catalogExists,
  loadCatalog,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

// quad 해시 DB를 카탈로그에서 만든다 (브라우저 Worker와 같은 함수). 받던 이진 파일과 같은 82,703개였고,
// 북쪽왕관자리 T(폭발 때 밝기로 실린 별)를 별 지도에서 뺀 뒤 82,605개
describe.skipIf(!catalogExists())("quad 해시 DB 만들기", () => {
  const quads = loadHashes();
  const vec = new Map(loadCatalog().map((s) => [s.hr, s.vector]));
  const cos10 = Math.cos((10 * Math.PI) / 180);

  it("이웃 칸에서 겹친 것을 뺀 82,605개", () => {
    expect(quads.length).toBe(82605);
    expect(new Set(quads.map((q) => [...q.stars].sort().join())).size).toBe(
      quads.length,
    );
  });

  it("모든 별쌍이 10° 안에 모인 compact quad다", () => {
    for (const q of quads.slice(0, 5000)) {
      const v = q.stars.map((hr) => vec.get(hr)!);

      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          const d = v[i][0] * v[j][0] + v[i][1] * v[j][1] + v[i][2] * v[j][2];

          expect(d).toBeGreaterThanOrEqual(cos10 - 1e-12);
        }
      }
    }
  });

  it("해시는 대칭을 없앤 꼴 (남은 두 점의 x 합이 1 이하)", () => {
    for (const q of quads) {
      expect(q.hash[0] + q.hash[2]).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});
