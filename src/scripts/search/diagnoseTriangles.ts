import type { Point2D, Point3D } from "@/scripts/hash/types";
import { detectVariant } from "@/scripts/search/robustnessBench";
import {
  pixelToCamera3D,
  projectTriangle,
  searchTriangle,
  triangleShape,
} from "@/search/catalogGeometry";
import { solveCandidate } from "@/search/solveCore";
import { buildSolverContext } from "@/search/solverContext";
import { isConfident } from "@/search/solvers/candidates";
import {
  rankForSolving,
  selectTopByPriority,
} from "@/search/utils/selectStars";
import { photoToSky } from "@/search/utils/wcs";
import { labelDetections, loadSolvedPoses } from "@/test/real/detectionLabels";
import {
  contextStars,
  loadCatalog,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

// 삼각형 매칭 진단: 상위 10개 별의 삼각형 중 진짜 별 셋으로 된 것마다
// ① 인덱스 검색(가장 가까운 FOV 후보)에서 정답 삼각형이 나오는가 ② 그 대응을 검증하면 확신하는가.
//   npx tsx src/scripts/search/diagnoseTriangles.ts "20220328-brice-Milky Way over Buzzvil.jpg" webp75

const FOV_CANDIDATES = [10, 14, 18, 23, 29, 37, 47, 60, 75];
const minDimOf = (w: number, h: number) => Math.min(w, h);
const [file, variant, inputArg] = process.argv.slice(2);
// 검증에 넣는 별 수 (앱은 우선순위 상위 15·25·40·60개를 차례로 넣는다)
const INPUT = Number(inputArg ?? 40);

const run = async () => {
  const pose = loadSolvedPoses()[file];
  const cat = contextStars(loadCatalog());
  const ctx = buildSolverContext(cat, loadHashes());
  const { stars, width, height } = await detectVariant(file, variant);
  const top = selectTopByPriority(stars, 15);
  const labels = labelDetections(top, pose, cat);
  // 정답 자세에서 사진 짧은 변의 시야각 (FOV 후보는 짧은 변 기준이다)
  const a = photoToSky(pose.TP, [
    width / 2,
    height / 2 - minDimOf(width, height) / 2,
  ]);
  const b = photoToSky(pose.TP, [
    width / 2,
    height / 2 + minDimOf(width, height) / 2,
  ]);
  const fov =
    (Math.acos(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) * 180) / Math.PI;
  const minDim = Math.min(width, height);
  const fovUse = FOV_CANDIDATES.reduce((a, b) =>
    Math.abs(b - fov) < Math.abs(a - fov) ? b : a,
  );
  const all: Point2D[] = rankForSolving(stars, width, height)
    .slice(0, INPUT)
    .map((s) => [s.x, s.y]);

  console.log(
    `${variant} FOV(정답) ${fov.toFixed(1)}° → 후보 ${fovUse}°, 상위15 ${labels.map((l) => (l ? "★" : "·")).join("")}`,
  );

  let real = 0;
  let found = 0;
  let confident = 0;

  for (let i = 0; i < 15; i++) {
    for (let j = i + 1; j < 15; j++) {
      for (let k = j + 1; k < 15; k++) {
        if (!labels[i] || !labels[j] || !labels[k]) {
          continue;
        }

        real++;
        const truth = new Set([labels[i], labels[j], labels[k]]);
        // FOV 후보 전부에서 가장 좋은 순위 (원근 보정 사진은 정답 FOV가 아닌 후보에서 모양이 맞기도 한다)
        let rank = -1;
        let which = "";
        let order: number[] = [i, j, k];

        for (const fovTry of FOV_CANDIDATES) {
          const focal = minDim / 2 / Math.tan(((fovTry / 2) * Math.PI) / 180);
          const dirs = [top[i], top[j], top[k]].map((p) =>
            pixelToCamera3D(p[0], p[1], focal, width / 2, height / 2),
          );
          const pp = projectTriangle(dirs);
          const d = (a: number, b: number) =>
            Math.hypot(pp[a][0] - pp[b][0], pp[a][1] - pp[b][1]);
          const tri = triangleShape(d(0, 1), d(0, 2), d(1, 2), [i, j, k]);

          for (const [name, index] of [
            ["전체", ctx.triangleIndex!],
            ["밝은", ctx.brightTriangleIndex!],
          ] as const) {
            const hits = searchTriangle(index, tri.shape, 50);
            const r = hits.findIndex((h) => h.hrs.every((hr) => truth.has(hr)));

            if (r >= 0 && (rank < 0 || r < rank)) {
              rank = r;
              which = `${name} FOV${fovTry}`;
              order = tri.order;
            }
          }
        }

        if (rank >= 0 && rank < 8) {
          found++;
          const photo3 = order.map((o) => top[o]);
          const hrs = order.map((o) => labels[o]!);
          const db = hrs.map((hr) => ctx.byHrVec.get(hr) as Point3D);
          const res = solveCandidate(photo3, db, all, ctx.catalog, {
            imageWidth: width,
            imageHeight: height,
            ransacIterations: 60,
          });

          if (res && isConfident(res)) {
            confident++;
          }

          console.log(
            `  (${i},${j},${k}) ${which} 인덱스 ${rank + 1}위 → 검증 ${res ? `log-odds ${res.logOdds.toFixed(1)} inlier ${res.inlierCount}` : "실패"}`,
          );
        } else {
          console.log(
            `  (${i},${j},${k}) 인덱스 상위 8 밖 (${rank < 0 ? "50 밖" : `${rank + 1}위 ${which}`})`,
          );
        }
      }
    }
  }

  console.log(
    `진짜 삼각형 ${real}개, 검색에서 찾음 ${found}, 검증 확신 ${confident}`,
  );
};

run();
