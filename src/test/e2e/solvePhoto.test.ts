import type { Point3D } from "@/scripts/hash/types";
import type { SolvePhase } from "@/search/solvePhoto";
import type { SolverContext } from "@/search/solvers";
import { beforeAll, describe, expect, it } from "vitest";
import { buildTriangleIndex } from "@/search/catalogGeometry";
import { buildCandidateIndex } from "@/search/findCandidatesCore";
import { DEFAULT_SOLVERS, solvePhoto } from "@/search/solvePhoto";
import { generateSyntheticImage } from "@/test/synthetic/generateSyntheticImage";
import {
  catalogExists,
  hashesExist,
  loadCatalog,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

const ready = catalogExists() && hashesExist();

const W = 1600;
const H = 1200;

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

// 앱(solverWorker)과 같은 흐름인 solvePhoto의 약속을 확인한다.
describe.skipIf(!ready)("solvePhoto: 앱의 풀이 흐름", () => {
  let ctx: SolverContext;

  beforeAll(() => {
    const catalog = loadCatalog();
    const solveStars = catalog.map((s) => ({ hr: s.hr, vector: s.vector }));
    // 앱과 같은 인덱스 설정
    ctx = {
      index: buildCandidateIndex(loadHashes()),
      catalog: solveStars,
      byHrVec: new Map(catalog.map((s) => [s.hr, s.vector])),
      triangleIndex: buildTriangleIndex(solveStars, 18),
    };
  });

  const center = skyVector(85, 5); // 오리온 부근
  const cleanImage = () =>
    generateSyntheticImage(loadCatalog(), {
      center,
      fovDeg: 20,
      rotationDeg: 25,
      width: W,
      height: H,
      magnitudeLimit: 5,
      seed: 7,
      noise: {},
    });

  it("깨끗한 합성 사진을 풀고, 확신하면 첫 입력 크기에서 멈춘다", () => {
    const phases: SolvePhase[] = [];
    const out = solvePhoto(
      cleanImage().stars,
      { width: W, height: H },
      ctx,
      DEFAULT_SOLVERS,
      { onPhase: (p) => phases.push(p) },
    );

    expect(out.found).toBe(true);
    expect(angleDeg(out.centerVector as Point3D, center)).toBeLessThan(0.5);
    // 첫 크기에서 확신했으므로 다른 입력 크기·어안 풀이는 돌지 않는다
    expect(phases).toHaveLength(1);
    expect(phases[0]).toMatchObject({
      kind: "linear",
      solverKey: DEFAULT_SOLVERS[0].key,
      inputSize: 15,
    });
    expect(out.timedOut).toBe(false);
  });

  it("시간 상한을 넘기면 확신하지 않고 멈춘다", () => {
    const out = solvePhoto(
      cleanImage().stars,
      { width: W, height: H },
      ctx,
      DEFAULT_SOLVERS,
      { timeBudgetMs: 0 },
    );

    expect(out.timedOut).toBe(true);
    expect(out.centerVector).toBeNull();
  });

  it("별이 입력 크기보다 적으면 같은 입력을 되풀이하지 않는다", () => {
    const phases: SolvePhase[] = [];
    const stars = cleanImage().stars.slice(0, 20);

    solvePhoto(stars, { width: W, height: H }, ctx, DEFAULT_SOLVERS, {
      onPhase: (p) => phases.push(p),
    });

    // solver·영역마다: 15개로 못 풀었을 때만 20개(전체)를 한 번 더 본다. 25·40·60은 같은 입력이라 건너뛴다.
    const seen = new Set<string>();

    for (const p of phases) {
      if (p.kind !== "linear") {
        continue;
      }

      const key = `${p.solverKey}/${p.region}/${p.inputSize}`;

      expect(p.inputSize).toBeLessThanOrEqual(20);
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("아래쪽에 밝은 지면 불빛이 몰려 있어도 위쪽 영역에서 찾는다", () => {
    const img = cleanImage();
    // 사진 아래 20%에 진짜 별보다 밝은 가짜 불빛 150개 (지평선 마을·가로등을 흉내)
    const groundLights = Array.from({ length: 150 }, (_, i) => ({
      x: ((i * 97) % 150) * (W / 150),
      y: H * 0.8 + ((i * 37) % 100) * (H * 0.002),
      brightness: 1000 + i,
    }));
    const phases: SolvePhase[] = [];
    const out = solvePhoto(
      [...img.stars, ...groundLights],
      { width: W, height: H },
      ctx,
      DEFAULT_SOLVERS,
      { timeBudgetMs: Infinity, onPhase: (p) => phases.push(p) },
    );

    expect(out.found).toBe(true);
    expect(angleDeg(out.centerVector as Point3D, center)).toBeLessThan(0.5);
    // 사진 전체로는 불빛에 묻혀 못 찾고, 위쪽 영역에서 찾았다
    const last = phases[phases.length - 1];

    expect(last.kind === "linear" && last.region).not.toBe("사진 전체");
  });
});
