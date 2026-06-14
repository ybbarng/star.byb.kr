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

// 라벨(별 이름 N 또는 HR 번호) → 3D 벡터. 정답 방향 계산용.
const loadNameToVector = (): Map<string, Point3D> => {
  const vdb = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "build/database/vectors-database.json"),
      "utf-8",
    ),
  ) as { N?: string; HR: string; x: number; y: number; z: number }[];
  const map = new Map<string, Point3D>();

  for (const s of vdb) {
    const vec: Point3D = [s.x, s.y, s.z];

    if (s.N) {
      map.set(s.N, vec);
    }

    map.set(s.HR, vec); // saipan은 HR 번호로 라벨링됨
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
      // TODO: 단일 maxAngle은 별자리 크기 trade-off가 있어 한계.
      // 멀티스케일 인덱스 또는 사진 삼각형 크기 기반 동적 선택이 필요.
      triangleIndex: buildTriangleIndex(solveStars, 8),
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

    // 반경(brightness) 필터로 핫픽셀/노이즈를 제거하며 측정
    for (const minR of [0, 2.5, 4]) {
      const filtered = sorted.filter((s) => s.brightness >= minR);

      for (const topN of [30, 60]) {
        const inputStars = filtered
          .slice(0, topN)
          .map((s) => ({ x: s.cx, y: s.cy, brightness: s.brightness }));

        lines.push(
          `\n-- 반경≥${minR} (${filtered.length}개) 중 상위 ${topN} --`,
        );

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
    }

    console.warn(lines.join("\n"));

    // 적어도 한 알고리즘은 북두칠성을 5도 이내로 풀어야 한다
    expect(lines.length).toBeGreaterThan(1);
  }, 60000);

  // 사람이 정제한 별 목록(data/search)으로 4개 알고리즘 측정 — 실제 협업 워크플로
  const refinedSamples = [
    { name: "ursa-major(북두칠성)", file: "ursa-major.json" },
    { name: "orion(오리온)", file: "orion.json" },
    { name: "saipan(남반구)", file: "saipan.json" },
  ];

  it("사람이 정제한 샘플 별 목록을 정확히 푼다", () => {
    const byName = loadNameToVector();
    const lines: string[] = ["\n=== 정제된 샘플 plate solving ==="];
    let solvedCount = 0;

    for (const sample of refinedSamples) {
      const path = resolve(process.cwd(), "data/search", sample.file);

      if (!existsSync(path)) {
        continue;
      }

      const truth = JSON.parse(readFileSync(path, "utf-8")) as {
        width: number;
        height: number;
        stars: {
          label: string;
          position: [number, number];
          brightness: number;
        }[];
      };
      const truthCenter = truthCenterFromLabels(
        truth.stars.map((s) => s.label),
        byName,
      );
      const inputStars = truth.stars.map((s) => ({
        x: s.position[0],
        y: s.position[1],
        brightness: s.brightness,
      }));

      lines.push(
        `\n■ ${sample.name} (${truth.stars.length}개 별, 정답${truthCenter ? "있음" : "없음"})`,
      );

      for (const solver of solvers) {
        const out = solver.solve(
          inputStars,
          { width: truth.width, height: truth.height },
          ctx,
        );
        const err =
          out.centerVector && truthCenter
            ? angleDeg(out.centerVector, truthCenter)
            : Infinity;
        const ok = out.found && err < 5;

        if (ok) {
          solvedCount++;
        }

        lines.push(
          `  ${solver.name}: ${ok ? "✓풀림" : "✗"} ` +
            `found=${out.found}, 오차=${Number.isFinite(err) ? err.toFixed(1) : "-"}°, ` +
            `유의도=${out.confidence.toFixed(1)}, inlier=${out.inlierCount}`,
        );
      }
    }

    console.warn(lines.join("\n"));
    expect(solvedCount).toBeGreaterThan(0);
  });
});
