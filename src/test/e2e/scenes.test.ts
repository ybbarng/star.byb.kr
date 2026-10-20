import type { Point3D } from "@/scripts/hash/types";
import type { SolverContext } from "@/search/solvers";
import { beforeAll, describe, expect, it } from "vitest";
import { solvePhoto } from "@/search/solvePhoto";
import { buildSolverContext } from "@/search/solverContext";
import { detectFromGray } from "@/test/synthetic/detectScene";
import {
  catalogExists,
  contextStars,
  hashesExist,
  loadCatalog,
  loadHashes,
} from "@/test/synthetic/loadCatalog";
import { renderScene, type SceneClutter } from "@/test/synthetic/renderScene";
import { yieldToEventLoop } from "@/test/yieldToEventLoop";

// 픽셀 단위 합성 장면(창문·전봇대·바다 반사·위성·비행기)을 실제 검출 → 풀이 흐름으로 푼다.
// 실제 사진에서 본 거짓 검출을 흉내 낸 장면에서, 정답을 찾고 오답은 확신하지 않는지 본다.
const ready = catalogExists() && hashesExist();
const W = 1200;
const H = 800;
const CENTER_TOLERANCE_DEG = 1.5;

const skyVector = (raDeg: number, decDeg: number): Point3D => {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;

  return [
    Math.cos(dec) * Math.cos(ra),
    Math.cos(dec) * Math.sin(ra),
    Math.sin(dec),
  ];
};

const angleDeg = (a: Point3D, b: Point3D): number =>
  (Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) *
    180) /
  Math.PI;

const DIRECTIONS: [number, number][] = [
  [85, 5],
  [200, -20],
  [330, 60],
  [150, 10],
  [20, -45],
  [270, 30],
  [110, -10],
  [50, 40],
];

const SCENES: { name: string; clutter: SceneClutter; minSolved: number }[] = [
  { name: "하늘만", clutter: {}, minSolved: 8 },
  {
    name: "도시(창문)",
    clutter: { groundFraction: 0.35, buildings: 3 },
    minSolved: 8,
  },
  {
    name: "숲·전봇대",
    clutter: { groundFraction: 0.3, poles: 5 },
    minSolved: 7,
  },
  {
    name: "바다 반사",
    clutter: { groundFraction: 0.4, water: true },
    minSolved: 8,
  },
  { name: "위성·비행기", clutter: { satellites: 2, planes: 2 }, minSolved: 8 },
  {
    name: "전부",
    clutter: {
      groundFraction: 0.35,
      buildings: 3,
      poles: 4,
      satellites: 2,
      planes: 2,
    },
    minSolved: 7,
  },
];

describe.skipIf(!ready)("합성 장면: 거짓 검출이 섞인 픽셀 영상", () => {
  let ctx: SolverContext;
  let catalog: ReturnType<typeof loadCatalog>;

  beforeAll(() => {
    catalog = loadCatalog();
    ctx = buildSolverContext(contextStars(catalog), loadHashes());
  });

  it.each(SCENES)(
    "$name: 정답을 찾고 틀린 해는 확신하지 않는다",
    async ({ clutter, minSolved }) => {
      let solved = 0;
      let wrong = 0;

      for (let k = 0; k < DIRECTIONS.length; k++) {
        const scene = renderScene(catalog, {
          center: skyVector(...DIRECTIONS[k]),
          fovDeg: 30 + ((k * 7) % 25),
          rotationDeg: k * 40,
          width: W,
          height: H,
          seed: 100 + k,
          clutter,
        });
        // 결정적이게 시간 상한을 끈다 (시계 기준 상한은 CPU 부하에 따라 결과가 바뀐다)
        const out = solvePhoto(
          detectFromGray(scene.gray, W, H),
          { width: W, height: H },
          ctx,
          undefined,
          { timeBudgetMs: Infinity },
        );

        if (out.found && out.centerVector) {
          if (angleDeg(out.centerVector, scene.center) < CENTER_TOLERANCE_DEG) {
            solved++;
          } else {
            wrong++;
          }
        }

        await yieldToEventLoop();
      }

      expect(wrong).toBe(0);
      expect(solved).toBeGreaterThanOrEqual(minSolved);
    },
    180000,
  );
});
