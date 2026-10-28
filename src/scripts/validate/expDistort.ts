import type { InputStar } from "@/search/solvers";
import { judge, loadDetected } from "@/scripts/validate/common";
import { loadRun } from "@/scripts/validate/report";
import { polish } from "@/search/solvePhoto";
import { buildSolverContext } from "@/search/solverContext";
import { rankForSolving } from "@/search/utils/selectStars";
import {
  contextStars,
  loadCatalog,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

// 실험: 풀이 기록의 1위 후보(또는 확신한 해)에 ① 마무리 정밀화(polish)를, ② 렌즈 방사 왜곡 k1로
// 사진 별을 펴서 정밀화를 해 보면 log-odds가 얼마나 오르는가.
//   npx tsx src/scripts/validate/expDistort.ts web-2026-10 base [found|miss]

const undistort = (
  stars: InputStar[],
  w: number,
  h: number,
  k: number,
): InputStar[] => {
  const cx = w / 2;
  const cy = h / 2;
  const R2 = (w * w + h * h) / 4;

  return stars.map((s) => {
    const dx = s.x - cx;
    const dy = s.y - cy;
    const f = 1 + (k * (dx * dx + dy * dy)) / R2;

    return { ...s, x: cx + dx * f, y: cy + dy * f };
  });
};

const run = () => {
  const [set, name, which = "miss"] = process.argv.slice(2);
  const ctx = buildSolverContext(contextStars(loadCatalog()), loadHashes());
  const rows = loadRun(set, name).filter(
    (r) => r.transform && (which === "found" ? r.found : !r.found),
  );

  for (const r of rows) {
    const det = loadDetected(set, r.file)!;
    const size = { width: det.width, height: det.height };
    const ranked = rankForSolving(det.stars, det.width, det.height);
    const base = {
      found: false,
      centerVector: r.center,
      fovDeg: r.fovDeg,
      confidence: r.confidence,
      inlierCount: r.inliers,
      candidatesEvaluated: 0,
      timeMs: 0,
      transform: r.transform,
      candidates: [],
    };
    const p0 = polish(base, ranked, size, ctx);
    let bestK = 0;
    let bestLo = p0.confidence;
    let bestT = p0.transform;

    for (const k of [-0.25, -0.15, -0.08, 0.08, 0.15, 0.25]) {
      const und = undistort(ranked, det.width, det.height, k);
      const p = polish({ ...base, confidence: 0 }, und, size, ctx);

      if (p.confidence > bestLo) {
        bestLo = p.confidence;
        bestK = k;
        bestT = p.transform;
      }
    }

    const j0 = judge(det, r.transform!);
    const j1 = judge(det, p0.transform!);
    console.log(
      `${r.file} fov ${r.fovDeg?.toFixed(0)} lo ${r.confidence.toFixed(1)} → polish ${p0.confidence.toFixed(1)} (${j0.verdict}→${j1.verdict} 꼬리 ${j1.tail.toFixed(1)}) → k ${bestK} ${bestLo.toFixed(1)}${bestT ? "" : ""}`,
    );
  }
};

run();
