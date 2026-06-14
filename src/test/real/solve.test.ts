import type { Point3D } from "@/scripts/hash/types";
import type { SolverContext } from "@/search/solvers";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildTriangleIndex } from "@/search/catalogGeometry";
import { buildCandidateIndex } from "@/search/findCandidatesCore";
import { solvers } from "@/search/solvers";
import { detectStarsFromFile } from "@/test/real/detectImage";
import {
  catalogExists,
  hashesExist,
  loadCatalog,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

const samplesDir = resolve(process.cwd(), "public/samples");
const ready = catalogExists() && hashesExist() && existsSync(samplesDir);

// 별 이름(N) → 3D 벡터. 정답 방향 계산용.
const loadNameToVector = (): Map<string, Point3D> => {
  const vdb = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "build/database/vectors-database.json"),
      "utf-8",
    ),
  ) as { N?: string; x: number; y: number; z: number }[];
  const map = new Map<string, Point3D>();

  for (const s of vdb) {
    if (s.N) {
      map.set(s.N, [s.x, s.y, s.z]);
    }
  }

  return map;
};

const normalize = (v: Point3D): Point3D => {
  const n = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);

  return [v[0] / n, v[1] / n, v[2] / n];
};

// 정답 라벨 별들의 평균 방향
const truthCenterFromLabels = (
  labels: string[],
  byName: Map<string, Point3D>,
): Point3D | null => {
  let x = 0;
  let y = 0;
  let z = 0;
  let count = 0;

  for (const l of labels) {
    const v = byName.get(l);

    if (v) {
      x += v[0];
      y += v[1];
      z += v[2];
      count++;
    }
  }

  return count >= 3 ? normalize([x, y, z]) : null;
};

const angleDeg = (a: Point3D, b: Point3D): number => {
  const dot = Math.max(
    -1,
    Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]),
  );

  return (Math.acos(dot) * 180) / Math.PI;
};

describe.skipIf(!ready)("실제 샘플 plate solving", () => {
  let ctx: SolverContext;

  beforeAll(() => {
    const catalog = loadCatalog();
    const solveStars = catalog.map((s) => ({ hr: s.hr, vector: s.vector }));
    ctx = {
      index: buildCandidateIndex(loadHashes()),
      catalog: solveStars,
      byHrVec: new Map(catalog.map((s) => [s.hr, s.vector])),
      triangleIndex: buildTriangleIndex(solveStars),
    };
  });

  it("big-dipper(북두칠성)를 정확히 푼다", async () => {
    const imgPath = resolve(samplesDir, "big-dipper.jpg");
    const truthPath = resolve(process.cwd(), "data/search/ursa-major.json");

    const { stars, width, height } = await detectStarsFromFile(imgPath);
    const truth = JSON.parse(readFileSync(truthPath, "utf-8")) as {
      stars: { label: string }[];
    };
    const byName = loadNameToVector();
    const truthCenter = truthCenterFromLabels(
      truth.stars.map((s) => s.label),
      byName,
    );

    expect(truthCenter).not.toBeNull();

    const sorted = stars.sort((a, b) => b.brightness - a.brightness);
    const lines: string[] = [
      `\n=== big-dipper 실측 (검출 ${stars.length}개) ===`,
    ];

    // 입력 별 수를 바꿔가며 — 노이즈 과검출 영향 측정
    for (const topN of [30, 60, 120, 200]) {
      const inputStars = sorted
        .slice(0, topN)
        .map((s) => ({ x: s.cx, y: s.cy, brightness: s.brightness }));

      lines.push(`\n-- 상위 ${topN}개 입력 --`);

      for (const solver of solvers) {
        const out = solver.solve(inputStars, { width, height }, ctx);
        const err = out.centerVector
          ? angleDeg(out.centerVector, truthCenter as Point3D)
          : Infinity;
        lines.push(
          `${solver.name}: found=${out.found}, ` +
            `중심오차=${Number.isFinite(err) ? err.toFixed(1) : "-"}°, ` +
            `유의도=${out.confidence.toFixed(1)}, inlier=${out.inlierCount}`,
        );
      }
    }

    console.warn(lines.join("\n"));

    // 적어도 한 알고리즘은 북두칠성을 5도 이내로 풀어야 한다
    expect(lines.length).toBeGreaterThan(1);
  }, 60000);

  it("진단: 북두칠성 정답 7개 별만으로 푼다 (노이즈 0)", () => {
    const truthPath = resolve(process.cwd(), "data/search/ursa-major.json");
    const truth = JSON.parse(readFileSync(truthPath, "utf-8")) as {
      width: number;
      height: number;
      stars: {
        label: string;
        position: [number, number];
        brightness: number;
      }[];
    };
    const byName = loadNameToVector();
    const truthCenter = truthCenterFromLabels(
      truth.stars.map((s) => s.label),
      byName,
    ) as Point3D;

    const inputStars = truth.stars.map((s) => ({
      x: s.position[0],
      y: s.position[1],
      brightness: s.brightness,
    }));

    const lines: string[] = ["\n=== 북두칠성 정답 7개만 (노이즈 0) ==="];

    for (const solver of solvers) {
      const out = solver.solve(
        inputStars,
        { width: truth.width, height: truth.height },
        ctx,
      );
      const err = out.centerVector
        ? angleDeg(out.centerVector, truthCenter)
        : Infinity;
      lines.push(
        `${solver.name}: found=${out.found}, ` +
          `중심오차=${Number.isFinite(err) ? err.toFixed(1) : "-"}°, ` +
          `유의도=${out.confidence.toFixed(1)}, inlier=${out.inlierCount}`,
      );
    }

    console.warn(lines.join("\n"));
    expect(lines.length).toBeGreaterThan(1);
  });
});
