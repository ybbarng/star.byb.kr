import type { Point3D } from "@/scripts/hash/types";
import type { HashedQuad } from "@/search/findCandidatesCore";
import * as healpix from "@hscmap/healpix";
import { calculateHash } from "@/scripts/hash/hash";
import { projectToTangentPlane } from "@/scripts/hash/plane";

// 별 네 개 모양(quad) 해시 DB를 별 목록에서 만든다. 브라우저 Worker·테스트·빌드가 같은 함수를 쓴다.
//
// 예전에는 빌드에서 만들어 이진 파일(압축 1.5MB)로 내려받았지만, 별 위치만 있으면 같은 규칙으로
// 언제든 다시 만들 수 있어 받지 않고 만든다 (node 기준 수백 ms).
//
// 규칙: 하늘을 HEALPix nside=4의 192칸으로 나누고, 칸 중심에서 10° 안의 별들로
//   네 별 조합을 만든 뒤, 모든 별쌍이 10° 안인 것(compact)만 남긴다. 칸끼리 겹쳐 같은 quad가
//   여러 칸에서 나오면 처음 것만 남긴다. 해시는 접선 평면 투영 → 가장 먼 두 점을 (0,0)·(1,1)로.

const NSIDE = 4;
const CELL_RADIUS_DEG = 10;
const MAX_PAIR_ANGLE_DEG = 10;

export interface QuadStar {
  hr: string;
  vector: Point3D;
}

export const generateQuadDatabase = (stars: QuadStar[]): HashedQuad[] => {
  const cosCell = Math.cos((CELL_RADIUS_DEG * Math.PI) / 180);
  const cosPair = Math.cos((MAX_PAIR_ANGLE_DEG * Math.PI) / 180);
  const npix = healpix.nside2npix(NSIDE);
  const seen = new Set<string>();
  const out: HashedQuad[] = [];
  const dot = (a: Point3D, b: Point3D) =>
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  for (let ipix = 0; ipix < npix; ipix++) {
    const center = healpix.pix2vec_nest(NSIDE, ipix) as Point3D;
    // 칸 안의 별 (카탈로그 순서 그대로)
    const cell = stars.filter((s) => dot(s.vector, center) >= cosCell);
    const k = cell.length;
    // 칸 안 별쌍이 10° 안인지 미리 표로
    const near = new Uint8Array(k * k);

    for (let i = 0; i < k; i++) {
      for (let j = i + 1; j < k; j++) {
        if (dot(cell[i].vector, cell[j].vector) >= cosPair) {
          near[i * k + j] = 1;
          near[j * k + i] = 1;
        }
      }
    }

    for (let a = 0; a < k - 3; a++) {
      for (let b = a + 1; b < k - 2; b++) {
        if (!near[a * k + b]) {
          continue;
        }

        for (let c = b + 1; c < k - 1; c++) {
          if (!near[a * k + c] || !near[b * k + c]) {
            continue;
          }

          for (let d = c + 1; d < k; d++) {
            if (!near[a * k + d] || !near[b * k + d] || !near[c * k + d]) {
              continue;
            }

            const quad = [cell[a], cell[b], cell[c], cell[d]];
            const key = `${quad[0].hr},${quad[1].hr},${quad[2].hr},${quad[3].hr}`;

            if (seen.has(key)) {
              continue;
            }

            seen.add(key);
            const projected = projectToTangentPlane(quad.map((s) => s.vector));
            const hash = calculateHash(
              projected.map((vector, i) => ({ label: quad[i].hr, vector })) as [
                { label: string; vector: [number, number] },
                { label: string; vector: [number, number] },
                { label: string; vector: [number, number] },
                { label: string; vector: [number, number] },
              ],
            );
            out.push({
              stars: hash.labels as HashedQuad["stars"],
              hash: hash.hash as HashedQuad["hash"],
            });
          }
        }
      }
    }
  }

  return out;
};
