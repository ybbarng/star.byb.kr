// 사용: JOBS=8 node src/scripts/validate/astrometry/run-list.mjs <목록 파일>
// 목록(한 줄에 "묶음 파일", 파일 이름에 공백 가능)을 JOBS개(기본 8)씩 나란히 solve-one.sh로 푼다
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
const jobs = readFileSync(process.argv[2], "utf8")
  .trim()
  .split("\n")
  .map((l) => {
    const i = l.indexOf(" ");

    return [l.slice(0, i), l.slice(i + 1)];
  });
let next = 0;
const worker = () =>
  new Promise((done) => {
    const go = () => {
      if (next >= jobs.length) return done();
      const [set, file] = jobs[next++];
      spawn("sh", ["src/scripts/validate/astrometry/solve-one.sh", set, file], {
        stdio: "ignore",
      }).on("exit", go);
    };

    go();
  });
await Promise.all(
  Array.from({ length: Number(process.env.JOBS ?? 8) }, worker),
);
