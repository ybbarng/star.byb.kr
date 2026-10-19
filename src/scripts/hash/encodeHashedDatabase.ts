import * as file from "@/scripts/file";
import { encodeHashedDatabase } from "@/search/hashedDatabaseFormat";

// hashed-database.json을 브라우저가 받는 이진 형식(hashed-database.bin)으로 바꾼다.
// 별 번호는 vectors-database.json의 순서를 따른다(Worker가 같은 파일로 HR을 되찾는다).
const run = () => {
  const quads = file.loadJson("build/hash", "hashed-database.json");
  const vectors: { HR: string }[] = file.loadJson(
    "build/database",
    "vectors-database.json",
  );
  const buffer = encodeHashedDatabase(
    quads,
    vectors.map((s) => s.HR),
  );

  file.saveBinary("build/hash", "hashed-database.bin", buffer);
  console.log(
    `quad ${quads.length}개 → ${(buffer.byteLength / 1e6).toFixed(2)}MB`,
  );
};

run();
