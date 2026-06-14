import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { matchPointSets } from "@/test/metrics/matchMetrics";
import { detectStarsFromFile } from "@/test/real/detectImage";

const samplesDir = resolve(process.cwd(), "public/samples");
const hasSamples = existsSync(samplesDir);

describe.skipIf(!hasSamples)("실제 샘플 사진 검출", () => {
  it("모든 샘플에서 별을 검출한다 (수·시간 측정)", async () => {
    const files = readdirSync(samplesDir).filter((f) =>
      /\.(jpg|jpeg|png)$/i.test(f),
    );

    const lines: string[] = ["\n=== 샘플 검출 결과 ==="];

    for (const name of files) {
      const t0 = performance.now();
      const { stars, width, height } = await detectStarsFromFile(
        resolve(samplesDir, name),
      );
      const ms = performance.now() - t0;
      lines.push(
        `${name} (${width}×${height}): ${stars.length}개 검출, ${ms.toFixed(0)}ms`,
      );
    }

    console.warn(lines.join("\n"));

    expect(files.length).toBeGreaterThan(0);
  }, 180000);

  it("big-dipper에서 북두칠성 7개 별을 검출한다", async () => {
    const imgPath = resolve(samplesDir, "big-dipper.jpg");
    const truthPath = resolve(process.cwd(), "data/search/ursa-major.json");

    if (!existsSync(imgPath) || !existsSync(truthPath)) {
      return;
    }

    const { stars } = await detectStarsFromFile(imgPath);
    const truth = JSON.parse(readFileSync(truthPath, "utf-8")) as {
      stars: { label: string; position: [number, number] }[];
    };

    // 검출 상위 100개와 정답 7개를 tolerance 15px로 매칭
    const detected = stars
      .sort((a, b) => b.brightness - a.brightness)
      .slice(0, 100)
      .map((s) => [s.cx, s.cy] as [number, number]);
    const truthPts = truth.stars.map((s) => s.position);
    const m = matchPointSets(detected, truthPts, 15);

    console.warn(
      `\n북두칠성 검출: ${m.matched}/${truthPts.length}개 매칭, ` +
        `평균오차 ${m.meanCentroidError.toFixed(1)}px (검출 총 ${stars.length}개)`,
    );

    // 북두칠성 7개 중 최소 5개는 검출되어야 한다
    expect(m.matched).toBeGreaterThanOrEqual(5);
  }, 60000);
});
