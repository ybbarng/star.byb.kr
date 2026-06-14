import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { SolveStar } from "@/search/solveCore";
import type { CatalogStar } from "@/test/synthetic/loadCatalog";
import { beforeAll, describe, expect, it } from "vitest";
import { solveCandidate } from "@/search/solveCore";
import { comparePose } from "@/test/metrics/poseMetrics";
import {
  generateSyntheticImage,
  toPhoto,
} from "@/test/synthetic/generateSyntheticImage";
import { catalogExists, loadCatalog } from "@/test/synthetic/loadCatalog";

const skyVector = (raDeg: number, decDeg: number): Point3D => {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;

  return [
    Math.cos(dec) * Math.cos(ra),
    Math.cos(dec) * Math.sin(ra),
    Math.sin(dec),
  ];
};

const CENTER = skyVector(85, 5);
const W = 1600;
const H = 1200;

describe.skipIf(!catalogExists())("검증 코어: solveCandidate", () => {
  let catalog: CatalogStar[];
  let solveStars: SolveStar[];

  beforeAll(() => {
    catalog = loadCatalog();
    solveStars = catalog.map((s) => ({ hr: s.hr, vector: s.vector }));
  });

  const makeImage = (noise: {
    jitterPx?: number;
    falseRatio?: number;
    missingProb?: number;
  }) =>
    generateSyntheticImage(catalog, {
      center: CENTER,
      fovDeg: 20,
      rotationDeg: 30,
      width: W,
      height: H,
      magnitudeLimit: 5,
      seed: 7,
      noise,
    });

  it("정답 quad로 pose를 정확히 복원하고 유의도가 높다", () => {
    const img = makeImage({ jitterPx: 1, falseRatio: 0.5 });
    const byHrVec = new Map(catalog.map((s) => [s.hr, s.vector]));
    const quad = img.trueStars.slice(0, 4);
    const photoQuad: Point2D[] = quad.map((t) => t.xy);
    const databaseQuad: Point3D[] = quad.map(
      (t) => byHrVec.get(t.hr) as Point3D,
    );
    const photoStars = toPhoto(img).stars;

    const res = solveCandidate(
      photoQuad,
      databaseQuad,
      photoStars,
      solveStars,
      {
        imageWidth: W,
        imageHeight: H,
      },
    );

    expect(res).not.toBeNull();

    const pose = comparePose(res!.TP, img.groundTruth);

    console.warn(
      `[정답] inlier=${res!.inlierCount}/${res!.projectedInFov}, ` +
        `sig=${res!.significance.toFixed(1)}, ` +
        `center=${pose.centerErrorDeg.toFixed(3)}°, ` +
        `fov=${res!.fovDeg.toFixed(1)}°(err ${pose.fovErrorPct.toFixed(1)}%)`,
    );

    expect(pose.centerErrorDeg).toBeLessThan(1);
    expect(pose.fovErrorPct).toBeLessThan(5);
    expect(res!.significance).toBeGreaterThan(5);
  });

  it("오답 quad(무관한 DB 별)는 유의도가 낮다", () => {
    const img = makeImage({ jitterPx: 1, falseRatio: 0.5 });
    const photoStars = toPhoto(img).stars;
    const photoQuad: Point2D[] = photoStars.slice(0, 4);

    // 사진 방향과 무관한(반대 반구 쪽) 카탈로그 별 중 서로 가까운 4개
    const opposite = catalog
      .filter((s) => {
        const dot =
          s.vector[0] * CENTER[0] +
          s.vector[1] * CENTER[1] +
          s.vector[2] * CENTER[2];

        return dot < -0.3;
      })
      .slice(0, 4);
    const databaseQuad: Point3D[] = opposite.map((s) => s.vector);

    const res = solveCandidate(
      photoQuad,
      databaseQuad,
      photoStars,
      solveStars,
      {
        imageWidth: W,
        imageHeight: H,
      },
    );

    if (res) {
      console.warn(
        `[오답] inlier=${res.inlierCount}, sig=${res.significance.toFixed(2)}`,
      );
      expect(res.significance).toBeLessThan(3);
    }
  });

  it("노이즈가 심해도(가짜 2배) 정답 quad의 유의도가 우연 수준을 넘는다", () => {
    const img = makeImage({ jitterPx: 1.5, falseRatio: 2.0 });
    const byHrVec = new Map(catalog.map((s) => [s.hr, s.vector]));
    const quad = img.trueStars.slice(0, 4);
    const photoQuad: Point2D[] = quad.map((t) => t.xy);
    const databaseQuad: Point3D[] = quad.map(
      (t) => byHrVec.get(t.hr) as Point3D,
    );
    const photoStars = toPhoto(img).stars;

    const res = solveCandidate(
      photoQuad,
      databaseQuad,
      photoStars,
      solveStars,
      {
        imageWidth: W,
        imageHeight: H,
      },
    );

    expect(res).not.toBeNull();
    console.warn(
      `[정답·고노이즈] inlier=${res!.inlierCount}, sig=${res!.significance.toFixed(1)}`,
    );
    expect(res!.significance).toBeGreaterThan(3);
  });
});
