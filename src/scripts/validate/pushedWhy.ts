import { loadClasses, loadDetected } from "@/scripts/validate/common";
import { loadRun } from "@/scripts/validate/report";
import {
  rankForSolving,
  STARLIKE_RING_CONTRAST,
} from "@/search/utils/selectStars";
import { projectVecToPhoto } from "@/search/utils/wcs";
import { loadCatalog } from "@/test/synthetic/loadCatalog";

// 확인용: 풀린 사진에서 3등급까지 별에 겹친 검출이 상위 60 밖으로 밀린 이유 (별답지 않음·줄지음·밝기가 낮음)
const [name, cls] = process.argv.slice(2);
const cat = loadCatalog().filter((s) => s.v <= 3);
const why = { ring: 0, aligned: 0, dim: 0, top: 0 };

for (const set of ["web-2026-10", "web-2026-10b", "web-2026-10c"]) {
  const classes = loadClasses(set);

  for (const r of loadRun(set, name).filter(
    (x) =>
      x.found && x.transform && !x.trailAngleDeg && classes.get(x.file) === cls,
  )) {
    const d = loadDetected(set, r.file)!;
    const ranked = rankForSolving(
      d.stars.filter((s) => !s.trail),
      d.width,
      d.height,
    );
    const rad = Math.hypot(d.width, d.height) * 0.006;

    for (const s of cat) {
      const p = projectVecToPhoto(r.transform!, s.vector);

      if (!p || p[0] < 0 || p[1] < 0 || p[0] >= d.width || p[1] >= d.height)
        continue;

      let best = -1;
      let bd = rad;

      ranked.forEach((q, i) => {
        const dd = Math.hypot(q.x - p[0], q.y - p[1]);

        if (dd < bd) {
          bd = dd;
          best = i;
        }
      });

      if (best < 0) continue;

      const q = ranked[best];

      if (best < 60) why.top++;
      else if (q.aligned) why.aligned++;
      else if ((q.ringContrast ?? 0) >= STARLIKE_RING_CONTRAST) why.ring++;
      else why.dim++;
    }
  }
}

console.log(
  cls,
  "밝은 별 겹침: 상위 60 안",
  why.top,
  "/ 밀림 — 별답지 않음",
  why.ring,
  "· 줄지음",
  why.aligned,
  "· 별다운데 밝기가 낮음",
  why.dim,
);
