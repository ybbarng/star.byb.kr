import { loadClasses, loadDetected } from "@/scripts/validate/common";
import { loadRun } from "@/scripts/validate/report";
import { rankForSolving } from "@/search/utils/selectStars";
import { projectVecToPhoto } from "@/search/utils/wcs";
import { loadCatalog } from "@/test/synthetic/loadCatalog";

// 확인용: 풀린 사진에서 풀이가 고르는 상위 N 검출 중 카탈로그(5등급까지) 별과 겹치는 비율 — 분류별
const [name, n = "60"] = process.argv.slice(2);
const cat = loadCatalog();
const share: Record<string, number[]> = {};

for (const set of ["web-2026-10", "web-2026-10b", "web-2026-10c"]) {
  const classes = loadClasses(set);

  for (const r of loadRun(set, name).filter(
    (x) => x.found && x.transform && !x.trailAngleDeg && !x.fisheyeCamera,
  )) {
    const d = loadDetected(set, r.file)!;
    const rad = Math.hypot(d.width, d.height) * 0.006;
    const projected = cat.flatMap((s) => {
      const p = projectVecToPhoto(r.transform!, s.vector);

      return p && p[0] >= 0 && p[1] >= 0 && p[0] < d.width && p[1] < d.height
        ? [p]
        : [];
    });
    const top = rankForSolving(
      d.stars.filter((s) => !s.trail),
      d.width,
      d.height,
    ).slice(0, Number(n));
    const hit = top.filter((s) =>
      projected.some(([x, y]) => (x - s.x) ** 2 + (y - s.y) ** 2 < rad * rad),
    ).length;
    const cls = classes.get(r.file) ?? "?";
    (share[cls] ??= []).push(hit / top.length);
  }
}

for (const [cls, xs] of Object.entries(share).sort(
  (a, b) => b[1].length - a[1].length,
)) {
  xs.sort((a, b) => a - b);
  console.log(
    cls.padEnd(6),
    String(xs.length).padStart(4),
    "장 · 상위",
    n,
    "중 카탈로그 별 비율 중앙",
    xs[xs.length >> 1].toFixed(2),
    "· 하위 25%",
    xs[Math.floor(xs.length / 4)].toFixed(2),
  );
}
