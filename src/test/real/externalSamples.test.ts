import type { Point3D } from "@/scripts/hash/types";
import type { SolverContext } from "@/search/solvers";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { solvePhoto } from "@/search/solvePhoto";
import { buildSolverContext } from "@/search/solverContext";
import { photoToSky, projectVecToPhoto } from "@/search/utils/wcs";
import { detectLikeApp } from "@/test/real/detectImage";
import {
  catalogExists,
  catalogPath,
  contextStars,
  hashesExist,
  loadCatalog,
  loadHashes,
} from "@/test/synthetic/loadCatalog";
import { yieldToEventLoop } from "@/test/yieldToEventLoop";

// 외부에서 받은 사진 (2026-10-09 화악산). 출처: 네이버 카페 "스카이가이드" 글
// https://cafe.naver.com/skyguide/392491 — 저작권이 있어 저장소에 올리지 않고
// public/samples-external/에 로컬로만 둔다. 파일이 없으면 건너뛴다.
// 파일 이름: hwaak-<원본 번호>.jpg, 작성자가 별자리를 그린 그림은 hwaak-<번호>-labeled.jpg
// 이 방법을 만들 때 한 번도 보지 않은 사진이라, 기준을 맞추는 데 쓴 샘플과 달리 일반화를 잰다.
const dir = resolve(process.cwd(), "public/samples-external");
const ready = catalogExists() && hashesExist() && existsSync(dir);

// 작성자가 플레이트 솔빙해 별자리를 그린 정답 그림에서 읽은 별 위치(px)
const LABELED: Record<string, [string, number, number][]> = {
  "hwaak-019.jpg": [
    ["Betelgeuse", 518, 606],
    ["Rigel", 811, 842],
    ["Sirius", 444, 1159],
    ["Aldebaran", 849, 258],
    ["Bellatrix", 669, 578],
  ],
  "hwaak-001.jpg": [
    ["Mirach", 580, 826],
    ["Almach", 648, 582],
    ["Hamal", 258, 649],
    ["Mirfak", 788, 242],
    ["Algol", 589, 314],
    ["Alpheratz", 573, 1120],
  ],
};

// 같은 자리에서 몇 분 사이에 찍은 달 사진들. 정답은 없지만, 각각 따로 푼 결과에서 달의
// 하늘 위치가 같아야 한다 (사진에서 눈으로 읽은 달 중심 px)
const MOON: Record<string, [number, number]> = {
  "hwaak-034.jpg": [640, 642],
  "hwaak-039.jpg": [577, 1070],
  "hwaak-040.jpg": [577, 1070],
};

const angleDeg = (a: Point3D, b: Point3D): number =>
  (Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) *
    180) /
  Math.PI;

describe.skipIf(!ready)("외부 사진 (화악산, 로컬 전용)", () => {
  let ctx: SolverContext;
  let byName: Map<string, Point3D>;

  beforeAll(() => {
    ctx = buildSolverContext(contextStars(loadCatalog()), loadHashes());
    const raw = JSON.parse(readFileSync(catalogPath, "utf8")) as {
      N?: string;
      x: number;
      y: number;
      z: number;
    }[];
    byName = new Map(
      raw.filter((s) => s.N).map((s) => [s.N!, [s.x, s.y, s.z] as Point3D]),
    );
  });

  const solve = async (file: string) => {
    const { stars, width, height } = await detectLikeApp(resolve(dir, file));
    const out = solvePhoto(stars, { width, height }, ctx, undefined, {
      timeBudgetMs: Infinity,
    });
    await yieldToEventLoop();

    return out;
  };

  it.each(Object.keys(LABELED))(
    "%s: 작성자의 정답 그림과 별 위치가 6px 안으로 맞는다",
    async (file) => {
      const out = await solve(file);

      expect(out.found).toBe(true);

      for (const [name, x, y] of LABELED[file]) {
        const p = projectVecToPhoto(out.transform!, byName.get(name)!);

        expect(p, name).not.toBeNull();
        // 작성자 표시는 손으로 찍은 점이다. 같은 점수(log-odds 61.4, 대응 93개)의 해도 출발한 후보에 따라
        // 시리우스가 4.9px·5.1px로 갈렸다 (2026-10-29, journey 38장)
        expect(Math.hypot(p![0] - x, p![1] - y), name).toBeLessThan(6);
      }
    },
    120000,
  );

  it("달 사진들을 각각 풀어도 달의 하늘 위치가 1° 안으로 같다", async () => {
    const moons: Point3D[] = [];

    for (const [file, xy] of Object.entries(MOON)) {
      const out = await solve(file);

      expect(out.found, file).toBe(true);
      moons.push(photoToSky(out.transform!, xy));
    }

    for (const m of moons.slice(1)) {
      expect(angleDeg(m, moons[0])).toBeLessThan(1);
    }
  }, 120000);
});
