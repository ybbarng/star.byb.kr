import type { HashedQuad } from "@/search/findCandidatesCore";

// quad 해시 DB의 이진 형식. JSON(10.8MB)보다 작고(약 2MB) 파싱이 필요 없다.
// 빌드 스크립트가 만들고, 브라우저 Worker와 테스트가 같은 함수로 읽는다.
//
// 배치 (little-endian):
//   "SQD1" (4바이트 표식) | quad 수 (Uint32)
//   | 별 번호 Uint16 × 4 × quad 수 | (4바이트 정렬 채움)
//   | 해시 Float32 × 4 × quad 수
// 별 번호는 vectors-database.json의 순서(hrs 배열의 위치)다. 별이 65,535개를 넘으면 쓸 수 없다.

const MAGIC = "SQD1";
const HEADER_BYTES = 8;

const align4 = (n: number) => (n + 3) & ~3;

export const encodeHashedDatabase = (
  quads: HashedQuad[],
  hrs: string[],
): ArrayBuffer => {
  if (hrs.length > 0xffff) {
    throw new Error(`별이 너무 많아 Uint16 번호로 담을 수 없다: ${hrs.length}`);
  }

  const indexOfHr = new Map(hrs.map((hr, i) => [hr, i]));
  const count = quads.length;
  const starsBytes = align4(count * 4 * 2);
  const buffer = new ArrayBuffer(HEADER_BYTES + starsBytes + count * 4 * 4);
  const view = new DataView(buffer);

  for (let i = 0; i < MAGIC.length; i++) {
    view.setUint8(i, MAGIC.charCodeAt(i));
  }

  view.setUint32(4, count, true);

  const stars = new Uint16Array(buffer, HEADER_BYTES, count * 4);
  const hashes = new Float32Array(buffer, HEADER_BYTES + starsBytes, count * 4);

  quads.forEach((quad, q) => {
    quad.stars.forEach((hr, k) => {
      const index = indexOfHr.get(hr);

      if (index === undefined) {
        throw new Error(`카탈로그에 없는 별: HR ${hr}`);
      }

      stars[q * 4 + k] = index;
    });
    quad.hash.forEach((value, k) => {
      hashes[q * 4 + k] = value;
    });
  });

  return buffer;
};

export const decodeHashedDatabase = (
  buffer: ArrayBuffer,
  hrs: string[],
): HashedQuad[] => {
  const view = new DataView(buffer);
  const magic = String.fromCharCode(
    ...[0, 1, 2, 3].map((i) => view.getUint8(i)),
  );

  if (magic !== MAGIC) {
    throw new Error(`quad 해시 DB 형식이 아니다 (표식: ${magic})`);
  }

  const count = view.getUint32(4, true);
  const starsBytes = align4(count * 4 * 2);
  const stars = new Uint16Array(buffer, HEADER_BYTES, count * 4);
  const hashes = new Float32Array(buffer, HEADER_BYTES + starsBytes, count * 4);

  return Array.from(
    { length: count },
    (_, q): HashedQuad => ({
      stars: [
        hrs[stars[q * 4]],
        hrs[stars[q * 4 + 1]],
        hrs[stars[q * 4 + 2]],
        hrs[stars[q * 4 + 3]],
      ],
      hash: [
        hashes[q * 4],
        hashes[q * 4 + 1],
        hashes[q * 4 + 2],
        hashes[q * 4 + 3],
      ],
    }),
  );
};
