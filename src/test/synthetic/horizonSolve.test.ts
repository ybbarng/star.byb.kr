import type { Point3D } from "@/scripts/hash/types";
import type { HorizonStar } from "@/search/horizonSolve";
import type { CatalogStar } from "@/test/synthetic/loadCatalog";
import { beforeAll, describe, expect, it } from "vitest";
import { HORIZON_ACCEPT_LOG_ODDS, horizonSolve } from "@/search/horizonSolve";
import { makeHorizonScene } from "@/test/synthetic/horizonScene";
import {
  catalogExists,
  contextStars,
  loadCatalog,
} from "@/test/synthetic/loadCatalog";
import { createRng } from "@/test/synthetic/rng";
import { yieldToEventLoop } from "@/test/yieldToEventLoop";

// 시각·장소·지평선 제약 풀이가 사진 한 장(사이판)에 맞춰진 게 아니라, 별이 10개 안팎인 비슷한
// 사진들에서 두루 되는지 정답을 아는 합성 장면으로 잰다 (journey 25장).

const angleDeg = (a: Point3D, b: Point3D) =>
  (Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) *
    180) /
  Math.PI;

const SCENES = 10;

describe.skipIf(!catalogExists())("시각·장소·지평선 제약 풀이 (합성)", () => {
  let catalog: CatalogStar[];
  let stars: HorizonStar[];

  beforeAll(() => {
    catalog = loadCatalog();
    stars = contextStars(catalog).map((s) => ({
      vector: s.vector,
      mag: s.mag,
    }));
  });

  it("확신한 답은 모두 정답이고, 밝은 별이 8개 이상인 장면은 대부분 푼다", async () => {
    const rng = createRng(21);
    let confident = 0;
    let wrongConfident = 0;
    let enoughStars = 0;
    let solvedWithEnough = 0;

    for (let i = 0; i < SCENES; i++) {
      const scene = makeHorizonScene(catalog, rng);
      const r = horizonSolve({
        ...scene,
        date: scene.postedAt,
        catalog: stars,
      });
      // 장면 하나가 몇 초씩 걸려, 전체 테스트와 함께 돌면 60초 넘게 이벤트 루프를 막았다 (yieldToEventLoop.ts)
      await yieldToEventLoop();
      const ok = r !== null && angleDeg(r.centerVector, scene.center) < 2;
      const accepted = r !== null && r.logOdds >= HORIZON_ACCEPT_LOG_ODDS;

      if (accepted) {
        confident++;

        if (!ok) {
          wrongConfident++;
        }
      }

      if (scene.trueStars >= 8) {
        enoughStars++;

        if (accepted && ok) {
          solvedWithEnough++;
        }
      }
    }

    expect(wrongConfident).toBe(0);
    expect(confident).toBeGreaterThan(0);
    expect(solvedWithEnough).toBeGreaterThanOrEqual(enoughStars * 0.6);
  }, 120000);

  it("틀린 날짜를 주면 확신하지 않는다", async () => {
    const rng = createRng(22);

    for (let i = 0; i < 5; i++) {
      const scene = makeHorizonScene(catalog, rng);
      // 3~9달 어긋난 날짜 (같은 시각이면 하늘이 6~18시간 어긋난다)
      const wrong = new Date(
        scene.postedAt.getTime() + (90 + rng() * 180) * 86400000,
      );
      const r = horizonSolve({ ...scene, date: wrong, catalog: stars });
      await yieldToEventLoop();

      // 우연히 같은 하늘이 되는 시각(한 달에 2시간)을 찾았다면 그건 정답이다
      if (r && angleDeg(r.centerVector, scene.center) > 5) {
        expect(r.logOdds).toBeLessThan(HORIZON_ACCEPT_LOG_ODDS);
      }
    }
  }, 120000);
});
