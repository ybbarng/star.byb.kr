import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { byStarPriority } from "@/search/utils/selectStars";
import { detectLikeApp } from "@/test/real/detectImage";
import { labelDetections, loadSolvedPoses } from "@/test/real/detectionLabels";
import { catalogExists, loadCatalog } from "@/test/synthetic/loadCatalog";
import { yieldToEventLoop } from "@/test/yieldToEventLoop";

const samplesDir = resolve(process.cwd(), "public/samples");
const ready = catalogExists() && existsSync(samplesDir);
const TOP = 25;

// 풀이는 우선순위 상위 몇십 개만 쓴다. 거기에 진짜 별(카탈로그와 맞는 검출)이 얼마나 들어오는지가
// 지면·창문·경계선 같은 거짓 검출에 대한 강건성이다. 자동으로 풀리는 14장의 정답 포즈로 잰다.
describe.skipIf(!ready)("검출 품질: 우선순위 상위의 진짜 별", () => {
  it(`사진 전체에서 상위 ${TOP}개 안의 진짜 별이 밝기순보다 많고 기준 이상이다`, async () => {
    const catalog = loadCatalog();
    let byBrightness = 0;
    let byPriority = 0;
    const rows: string[] = [];

    for (const [file, pose] of Object.entries(loadSolvedPoses())) {
      const { stars } = await detectLikeApp(resolve(samplesDir, file));
      const count = (sorted: typeof stars) =>
        labelDetections(
          sorted.slice(0, TOP).map((s) => [s.x, s.y]),
          pose,
          catalog,
        ).filter(Boolean).length;
      const b = count([...stars].sort((x, y) => y.brightness - x.brightness));
      const p = count([...stars].sort(byStarPriority));
      byBrightness += b;
      byPriority += p;
      rows.push(`${file}: 밝기순 ${b} → 우선순위 ${p}`);
      await yieldToEventLoop();
    }

    console.warn(
      `${rows.join("\n")}\n합계: 밝기순 ${byBrightness} → 우선순위 ${byPriority}`,
    );

    // 2026-10-20: 밝기순 124 → 별다움 우선 280
    expect(byPriority).toBeGreaterThan(byBrightness * 1.5);
    expect(byPriority).toBeGreaterThanOrEqual(250);
  }, 120000);
});
