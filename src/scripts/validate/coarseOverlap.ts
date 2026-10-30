import { readFileSync } from "node:fs";
import { loadCoarse, loadDetected } from "@/scripts/validate/common";
import { mergeDistancePx, rankForSolving } from "@/search/utils/selectStars";

// 줄인 사진 검출 상위 TOP개 중 원래 검출 우선순위 상위 FINE개 근처에 있는 비율 (journey 54장).
// 빛무리 사진은 줄인 사진의 밝은 별이 원래 검출 상위에 잘 안 든다고 보고, 비교 결과(ab25.all.txt)의 얻음·잃음과 견준다.
//   npx tsx src/scripts/validate/coarseOverlap.ts build/validate/scale/ab25.all.txt
const TOP = 10;
const FINE = 25;

const lines = readFileSync(process.argv[2], "utf8").trim().split("\n");
const rows: { key: string; tag: string; overlap: number }[] = [];

for (const line of lines) {
  const [key, , a, b] = line.split("\t");
  const [set, file] = key.split("/");
  const d = loadDetected(set, file);

  if (!d) continue;

  const coarse = loadCoarse(set, file).slice(0, TOP);
  const fine = rankForSolving(d.stars, d.width, d.height).slice(0, FINE);
  const near = mergeDistancePx(d.width, d.height) * 2;
  const hit = coarse.filter((c) =>
    fine.some((f) => Math.hypot(f.x - c.x, f.y - c.y) < near),
  ).length;
  const A = a.startsWith("O");
  const B = b.startsWith("O");
  const tag = A && B ? "둘다" : A ? "잃음" : B ? "얻음" : "못풂";

  rows.push({ key, tag, overlap: coarse.length ? hit / coarse.length : 1 });
}

for (const tag of ["얻음", "잃음", "둘다", "못풂"]) {
  const xs = rows.filter((r) => r.tag === tag).map((r) => r.overlap);
  const hist = [0, 0.2, 0.4, 0.6, 0.8].map(
    (lo) =>
      xs.filter((x) => x >= lo && (lo === 0.8 ? x <= 1 : x < lo + 0.2)).length,
  );

  console.log(
    `${tag} ${xs.length}장 겹침 0~.2/.2~.4/.4~.6/.6~.8/.8~1: ${hist.join(" / ")}`,
  );
}

for (const r of rows.filter((r) => r.tag === "얻음" || r.tag === "잃음")) {
  console.log(r.tag, r.key, r.overlap.toFixed(1));
}
