import type { Point3D } from "@/scripts/hash/types";
import type { SolverContext } from "@/search/solvers";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { solveByMilkyWay } from "@/search/milkyWaySolve";
import { buildSolverContext } from "@/search/solverContext";
import { photoToSky } from "@/search/utils/wcs";
import { detectLikeApp, glowsLikeApp } from "@/test/real/detectImage";
import {
  catalogExists,
  contextStars,
  loadCatalog,
  loadDeepStars,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

// 은하수 띠·지도 대조 풀이(journey 57장)를 저장소의 실제 샘플로 확인한다.
// 별 모양 맞추기를 거치지 않고 이 단계만 돌린다
const MAP = resolve(process.cwd(), "public/sky/milky-way-360x180.bin");
const ready = catalogExists() && existsSync(MAP);
const poses = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "src/test/real/solvedPoses.json"),
    "utf8",
  ),
);

const angleDeg = (a: Point3D, b: Point3D) =>
  (Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) *
    180) /
  Math.PI;

describe.skipIf(!ready)("은하수 띠·지도 대조 풀이 (실제 샘플)", () => {
  let ctx: SolverContext;
  const skyMap = () => ({
    data: new Uint8Array(readFileSync(MAP)),
    w: 360,
    h: 180,
  });

  beforeAll(() => {
    ctx = buildSolverContext(
      contextStars(loadCatalog()),
      loadHashes(),
      undefined,
      loadDeepStars(),
    );
  });

  const solve = async (file: string) => {
    const path = resolve(process.cwd(), "public/samples", file);
    const d = await detectLikeApp(path);
    const out = solveByMilkyWay(
      d.stars,
      { width: d.width, height: d.height },
      ctx,
      await glowsLikeApp(path),
      skyMap(),
      // 전체 테스트와 함께 돌면 CPU를 나눠 느려진다
      performance.now() + 30_000,
    );

    return { out, d };
  };

  it("남반구 은하수 사진을 은하수 띠의 모양만으로 정답 0.5° 안에 푼다", async () => {
    const file = "20231012-nike-aust-01.jpg";
    const { out, d } = await solve(file);

    expect(out?.found).toBe(true);
    expect(
      angleDeg(
        out!.centerVector as Point3D,
        photoToSky(poses[file].TP, [d.width / 2, d.height / 2]),
      ),
    ).toBeLessThan(0.5);
  }, 90_000);

  it.each(["big-dipper.jpg", "cafe-orion.jpg"])(
    "은하수가 없는 사진(%s)에서 틀린 답을 확신하지 않는다",
    async (file) => {
      const { out, d } = await solve(file);

      if (out) {
        expect(
          angleDeg(
            out.centerVector as Point3D,
            photoToSky(poses[file].TP, [d.width / 2, d.height / 2]),
          ),
        ).toBeLessThan(1);
      }
    },
    90_000,
  );
});
