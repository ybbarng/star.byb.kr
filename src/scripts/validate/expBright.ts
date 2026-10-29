import { loadClasses, loadDetected } from "@/scripts/validate/common";
import { loadRun } from "@/scripts/validate/report";
import { rankForSolving } from "@/search/utils/selectStars";
import { projectVecToPhoto } from "@/search/utils/wcs";
import { loadCatalog } from "@/test/synthetic/loadCatalog";

// 실험: 확신한 사진에서 밝은 별(3등급까지)에 겹친 검출이 앱 우선순위 몇 위인지, 왜 밀렸는지(별다움·줄지음),
// 그리고 그 둘레가 얼마나 빽빽한지(반지름 30px 안 검출 수)를 센다.
//   npx tsx src/scripts/validate/expBright.ts web-2026-10 promote

const [set, name] = process.argv.slice(2);
const catalog = loadCatalog().filter((s) => s.v <= 3);
const rows: string[] = [];
let total = 0;
let pushed = 0;
let pushedDense = 0;
const ringOf: number[] = [];
const ringPushedNeighbors: number[] = [];
const ringKeptNeighbors: number[] = [];

const onlyClass = process.argv[4];
const classOf = loadClasses(set);

for (const r of loadRun(set, name).filter(
  (x) =>
    x.found &&
    x.transform &&
    !x.trailAngleDeg &&
    (!onlyClass || classOf.get(x.file) === onlyClass),
)) {
  const det = loadDetected(set, r.file)!;
  const ranked = rankForSolving(
    det.stars.filter((s) => !s.trail),
    det.width,
    det.height,
  );
  const rad = Math.hypot(det.width, det.height) * 0.006;

  for (const s of catalog) {
    const p = projectVecToPhoto(r.transform!, s.vector);

    if (!p || p[0] < 0 || p[1] < 0 || p[0] >= det.width || p[1] >= det.height) {
      continue;
    }

    let best = -1;
    let bd = rad;

    ranked.forEach((d, i) => {
      const dd = Math.hypot(d.x - p[0], d.y - p[1]);

      if (dd < bd) {
        bd = dd;
        best = i;
      }
    });

    if (best < 0) {
      continue;
    }

    const d = ranked[best];
    const neighbors =
      ranked.filter((o) => Math.hypot(o.x - d.x, o.y - d.y) < 30).length - 1;
    total++;
    ringOf.push(d.ringContrast ?? 0);

    if (best >= 150) {
      pushed++;
      ringPushedNeighbors.push(neighbors);

      if (neighbors >= 3) {
        pushedDense++;
      }

      rows.push(
        `${r.file} V${s.v} rank ${best} ring ${(d.ringContrast ?? 0).toFixed(2)} aligned ${Boolean(d.aligned)} 이웃 ${neighbors} 밝기 ${d.brightness.toFixed(1)}`,
      );
    } else {
      ringKeptNeighbors.push(neighbors);
    }
  }
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
console.log(rows.slice(0, 40).join("\n"));
console.log(
  `밝은 별 겹침 ${total}, 150위 밖 ${pushed} (그중 이웃 3개 이상 ${pushedDense}), 이웃 평균: 밀린 것 ${avg(ringPushedNeighbors).toFixed(1)} · 안 밀린 것 ${avg(ringKeptNeighbors).toFixed(1)}`,
);
