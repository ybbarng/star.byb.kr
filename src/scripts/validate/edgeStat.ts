import { loadClasses, loadDetected } from "@/scripts/validate/common";
import { loadRun } from "@/scripts/validate/report";
import { rankForSolving } from "@/search/utils/selectStars";

// 확인용: 우선순위 상위 30 검출 중 사진 가장자리 띠(짧은 변의 3%) 안 비율 — 분류·풀림별 평균
const [name, cls] = process.argv.slice(2);

for (const set of ["web-2026-10", "web-2026-10b", "web-2026-10c"]) {
  const classes = loadClasses(set);
  const acc = { found: [] as number[], miss: [] as number[] };

  for (const r of loadRun(set, name).filter(
    (x) => classes.get(x.file) === cls,
  )) {
    const d = loadDetected(set, r.file)!;
    const band = Math.min(d.width, d.height) * 0.03;
    const top = rankForSolving(
      d.stars.filter((s) => !s.trail),
      d.width,
      d.height,
    ).slice(0, 30);
    const edge = top.filter(
      (s) =>
        s.x < band ||
        s.y < band ||
        s.x > d.width - band ||
        s.y > d.height - band,
    ).length;
    acc[r.found ? "found" : "miss"].push(edge / top.length);
  }

  const avg = (xs: number[]) =>
    (xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)).toFixed(2);
  console.log(
    set,
    `풀림 ${acc.found.length}장 평균 ${avg(acc.found)}`,
    `못 풂 ${acc.miss.length}장 평균 ${avg(acc.miss)}`,
  );
}
