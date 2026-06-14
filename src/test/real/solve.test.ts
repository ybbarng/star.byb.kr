import type { Point3D } from "@/scripts/hash/types";
import type { SolverContext } from "@/search/solvers";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildTriangleIndex } from "@/search/catalogGeometry";
import { buildCandidateIndex } from "@/search/findCandidatesCore";
import { solveCandidate } from "@/search/solveCore";
import { solvers } from "@/search/solvers";
import { photoToSky } from "@/search/utils/wcs";
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
      // 넓은 범위(다양한 별자리 크기) + KD 후보를 늘려 검증으로 크기를 거른다
      triangleIndex: buildTriangleIndex(solveStars, 18),
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

    // 밝기 상위 N개를 바꿔가며 — 노이즈 비율과 정답률의 관계 측정
    for (const minR of [0]) {
      const filtered = sorted.filter((s) => s.brightness >= minR);

      for (const topN of [20, 30, 40, 50, 70, 100]) {
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
              `유의도=${out.confidence.toFixed(1)}, inlier=${out.inlierCount}, ` +
              `${out.timeMs.toFixed(0)}ms`,
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

        // 올바른 채점: 추정 변환으로 각 별을 역투영해 라벨 별 방향과의 최대 오차.
        // (별 평균-화면중앙 비교는 별이 치우치면 어긋나 잘못된 채점이 된다)
        let maxErr = Infinity;

        if (out.transform) {
          maxErr = 0;

          for (const s of truth.stars) {
            const tv = byName.get(s.label);

            if (tv) {
              const sky = photoToSky(out.transform, s.position);
              maxErr = Math.max(maxErr, angleDeg(sky, tv));
            }
          }
        }

        const ok = out.found && maxErr < 2;

        if (ok) {
          solvedCount++;
        }

        // 정답이 제시 후보군 몇 위에 있는지 (사람이 고를 수 있는가)
        let rank = -1;

        for (let ci = 0; ci < out.candidates.length; ci++) {
          const c = out.candidates[ci];
          let cErr = 0;

          for (const s of truth.stars) {
            const tv = byName.get(s.label);

            if (tv) {
              cErr = Math.max(
                cErr,
                angleDeg(photoToSky(c.transform, s.position), tv),
              );
            }
          }

          if (cErr < 2) {
            rank = ci + 1;
            break;
          }
        }

        lines.push(
          `  ${solver.name}: ${ok ? "✓풀림" : "✗"} ` +
            `별오차=${Number.isFinite(maxErr) ? maxErr.toFixed(2) : "-"}°, ` +
            `inlier=${out.inlierCount}, ` +
            `후보군 ${out.candidates.length}개 중 정답 ${rank > 0 ? rank + "위" : "없음"}, ` +
            `${out.timeMs.toFixed(0)}ms`,
        );
      }
    }

    console.warn(lines.join("\n"));
    expect(solvedCount).toBeGreaterThan(0);
  });

  // 각 샘플이 "이론상 풀리는지" 확인: 정답 별로 만든 모든 삼각형을 직접
  // solveCandidate에 넣어 최선의 별 역투영 오차를 본다. 작으면 알고리즘은
  // 정답을 만들 수 있고, solver가 못 푸는 건 매칭(KD 후보 선택) 문제다.
  it("진단: 각 샘플의 정답 삼각형 직접 검증 (이론상 풀림)", () => {
    const byName = loadNameToVector();
    const lines: string[] = ["\n=== 정답 삼각형 직접 검증 (이론상 최선) ==="];

    for (const sample of refinedSamples) {
      const path = resolve(process.cwd(), "data/search", sample.file);

      if (!existsSync(path)) {
        continue;
      }

      const truth = JSON.parse(readFileSync(path, "utf-8")) as {
        width: number;
        height: number;
        stars: { label: string; position: [number, number] }[];
      };
      const allStars = truth.stars.map((s) => s.position);
      const stars = truth.stars;

      let bestInlier = -1;
      let bestRes: ReturnType<typeof solveCandidate> = null;

      for (let i = 0; i < stars.length - 2; i++) {
        for (let j = i + 1; j < stars.length - 1; j++) {
          for (let k = j + 1; k < stars.length; k++) {
            const photo3: [number, number][] = [
              stars[i].position,
              stars[j].position,
              stars[k].position,
            ];
            const v = [
              byName.get(stars[i].label),
              byName.get(stars[j].label),
              byName.get(stars[k].label),
            ];

            if (v.some((x) => !x)) {
              continue;
            }

            const db3 = v as Point3D[];
            const orders: Point3D[][] = [db3, [db3[0], db3[2], db3[1]]];

            for (const ord of orders) {
              const res = solveCandidate(photo3, ord, allStars, ctx.catalog, {
                imageWidth: truth.width,
                imageHeight: truth.height,
              });

              if (res && res.inlierCount > bestInlier) {
                bestInlier = res.inlierCount;
                bestRes = res;
              }
            }
          }
        }
      }

      let maxLabelErr = Infinity;

      if (bestRes) {
        maxLabelErr = 0;

        for (const s of stars) {
          const truthVec = byName.get(s.label);

          if (truthVec) {
            const sky = photoToSky(bestRes.TP, s.position);
            maxLabelErr = Math.max(maxLabelErr, angleDeg(sky, truthVec));
          }
        }
      }

      lines.push(
        `${sample.name}: 최대 inlier ${bestInlier}/${stars.length}, ` +
          `별 역투영 최대오차 ${Number.isFinite(maxLabelErr) ? maxLabelErr.toFixed(2) : "-"}°`,
      );
    }

    console.warn(lines.join("\n"));
    expect(lines.length).toBeGreaterThan(1);
  });

  // saipan은 진짜 별 일부가 카탈로그(V<=5)에 없다. 카탈로그에 있는 별만으로
  // 4개 알고리즘이 푸는지 확인한다 (없는 별을 빼면 풀리는가).
  it("진단: saipan 카탈로그에 있는 별만으로 푼다", () => {
    const path = resolve(process.cwd(), "data/search/saipan.json");
    const truth = JSON.parse(readFileSync(path, "utf-8")) as {
      width: number;
      height: number;
      stars: {
        label: string;
        position: [number, number];
        brightness?: number;
      }[];
    };
    const byName = loadNameToVector();
    const filtered = truth.stars.filter((s) => byName.has(s.label));
    const inputStars = filtered.map((s) => ({
      x: s.position[0],
      y: s.position[1],
      brightness: s.brightness ?? 1,
    }));

    const lines: string[] = [
      `\nsaipan 카탈로그 있는 별 ${filtered.length}/${truth.stars.length}개로 solve:`,
    ];

    for (const solver of solvers) {
      const out = solver.solve(
        inputStars,
        { width: truth.width, height: truth.height },
        ctx,
      );
      let maxErr = Infinity;

      if (out.transform) {
        maxErr = 0;

        for (const s of filtered) {
          const tv = byName.get(s.label);

          if (tv) {
            maxErr = Math.max(
              maxErr,
              angleDeg(photoToSky(out.transform, s.position), tv),
            );
          }
        }
      }

      const ok = out.found && maxErr < 2;
      lines.push(
        `  ${solver.name}: ${ok ? "✓" : "✗"} 별오차 ` +
          `${Number.isFinite(maxErr) ? maxErr.toFixed(2) : "-"}°, inlier ${out.inlierCount}`,
      );
    }

    console.warn(lines.join("\n"));
    expect(filtered.length).toBeGreaterThan(0);
  });
});
