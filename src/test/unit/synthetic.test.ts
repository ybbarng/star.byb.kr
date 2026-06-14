import type { Point3D } from "@/scripts/hash/types";
import type { GenerateOptions } from "@/test/synthetic/generateSyntheticImage";
import type { CatalogStar } from "@/test/synthetic/loadCatalog";
import { beforeAll, describe, expect, it } from "vitest";
import { comparePose } from "@/test/metrics/poseMetrics";
import { generateSyntheticImage } from "@/test/synthetic/generateSyntheticImage";
import { catalogExists, loadCatalog } from "@/test/synthetic/loadCatalog";
import { photoToSky } from "@/test/synthetic/projection";

const hasCatalog = catalogExists();

const skyVector = (raDeg: number, decDeg: number): Point3D => {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;

  return [
    Math.cos(dec) * Math.cos(ra),
    Math.cos(dec) * Math.sin(ra),
    Math.sin(dec),
  ];
};

describe.skipIf(!hasCatalog)("합성 이미지 생성기", () => {
  let catalog: CatalogStar[];

  beforeAll(() => {
    catalog = loadCatalog();
  });

  // 황소자리/오리온 근처(별이 많은 방향), 넓은 FOV
  const base = (): GenerateOptions => ({
    center: skyVector(85, 5),
    fovDeg: 50,
    rotationDeg: 20,
    width: 1600,
    height: 1200,
    magnitudeLimit: 5,
    seed: 12345,
  });

  it("노이즈 없는 이미지는 진짜 별만 담는다", () => {
    const img = generateSyntheticImage(catalog, base());

    expect(img.trueStars.length).toBeGreaterThan(10);
    expect(img.stars.length).toBe(img.trueStars.length);
    expect(img.stars.every((s) => !s.isFalse)).toBe(true);
  });

  it("진짜 별을 역투영하면 카탈로그 별 방향과 일치한다 (자기일관성)", () => {
    const img = generateSyntheticImage(catalog, base());
    const byHr = new Map(catalog.map((s) => [s.hr, s.vector]));

    for (const ts of img.trueStars.slice(0, 30)) {
      const v = photoToSky(ts.xy, img.groundTruth.TP);
      const cv = byHr.get(ts.hr);

      expect(cv).toBeDefined();

      const dot = v[0] * cv![0] + v[1] * cv![1] + v[2] * cv![2];

      // 부동소수점 누적 한도. 1e-4도 ≈ 0.36 arcsec로 사실상 완벽한 일치다.
      expect((Math.acos(Math.min(1, dot)) * 180) / Math.PI).toBeLessThan(1e-4);
    }
  });

  it("정답 TP를 채점하면 오차가 0에 가깝다", () => {
    const img = generateSyntheticImage(catalog, base());
    const m = comparePose(img.groundTruth.TP, img.groundTruth);

    expect(m.centerErrorDeg).toBeLessThan(1e-6);
    expect(m.fovErrorPct).toBeLessThan(1e-6);
  });

  it("jitter는 별 수를 유지하면서 위치를 흔든다", () => {
    const clean = generateSyntheticImage(catalog, base());
    const noisy = generateSyntheticImage(catalog, {
      ...base(),
      noise: { jitterPx: 3 },
    });

    expect(noisy.stars.length).toBe(clean.stars.length);
    // 적어도 일부 별의 위치가 달라야 한다
    const moved = noisy.stars.some((s, i) => s.x !== clean.stars[i]?.x);

    expect(moved).toBe(true);
  });

  it("falseRatio는 가짜 별을 추가한다", () => {
    const img = generateSyntheticImage(catalog, {
      ...base(),
      noise: { falseRatio: 1.0 },
    });
    const falses = img.stars.filter((s) => s.isFalse).length;

    expect(falses).toBeGreaterThan(0);
    expect(img.stars.length).toBe(img.trueStars.length + falses);
  });

  it("missingProb는 진짜 별을 누락시킨다", () => {
    const img = generateSyntheticImage(catalog, {
      ...base(),
      noise: { missingProb: 0.5 },
    });

    expect(img.stars.length).toBeLessThan(img.trueStars.length);
  });

  it("같은 seed는 같은 결과를 낸다 (결정적)", () => {
    const opts: GenerateOptions = {
      ...base(),
      noise: { jitterPx: 2, falseRatio: 0.5, missingProb: 0.2 },
    };
    const a = generateSyntheticImage(catalog, opts);
    const b = generateSyntheticImage(catalog, opts);

    expect(a.stars).toEqual(b.stars);
  });
});
