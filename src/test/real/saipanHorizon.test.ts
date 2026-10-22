import type { Point2D, Point3D } from "@/scripts/hash/types";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { answerVector, getSampleAnswer } from "@/plate-solver/sampleAnswers";
import { HORIZON_ACCEPT_LOG_ODDS, horizonSolve } from "@/search/horizonSolve";
import { detectHorizon } from "@/search/utils/horizonDetect";
import { rankForSolving } from "@/search/utils/selectStars";
import { detectLikeApp } from "@/test/real/detectImage";
import {
  catalogExists,
  contextStars,
  loadCatalog,
} from "@/test/synthetic/loadCatalog";

// 발표의 사이판 사진: 별이 10개 안팎이라 blind 풀이는 우연과 구분하지 못한다(log-odds 5대).
// 발표에서 사람이 쓴 단서 — 슬랙에 올라온 시각(2019-06-17 22:36 사이판, 캡처엔 한국 시각 21:36), 사이판, 바다 수평선 —
// 로 푼다. 정답(센타우루스·남십자, 사람 라벨 data/search/saipan.json)은 판정에 쓰지 않는다.
const FILE = "20190617-jarrod-saipan.jpg";
const POSTED_AT = new Date("2019-06-17T22:36:00+10:00");
const SAIPAN = { latDeg: 15.18, lonDeg: 145.75 };
// 바다 수평선 (사진을 잘라 눈으로 찾음)
const SEA_HORIZON: [Point2D, Point2D] = [
  [700, 1165],
  [1400, 1165],
];

const angleDeg = (a: Point3D, b: Point3D) =>
  (Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) *
    180) /
  Math.PI;

const ready =
  catalogExists() && existsSync(resolve(process.cwd(), "public/samples", FILE));

describe.skipIf(!ready)("사이판 사진: 시각·장소·수평선으로 풀기", () => {
  let input: Omit<Parameters<typeof horizonSolve>[0], "date">;

  beforeAll(async () => {
    const { stars, width, height } = await detectLikeApp(
      resolve(process.cwd(), "public/samples", FILE),
    );
    input = {
      photoStars: rankForSolving(stars, width, height).map(
        (s): Point2D => [s.x, s.y],
      ),
      width,
      height,
      horizon: SEA_HORIZON,
      observer: SAIPAN,
      catalog: contextStars(loadCatalog()).map((s) => ({
        vector: s.vector,
        mag: s.mag,
      })),
    };
  });

  it("올린 시각으로 정답(센타우루스·남십자)을 확신한다", () => {
    const r = horizonSolve({ ...input, date: POSTED_AT })!;

    expect(r.logOdds).toBeGreaterThanOrEqual(HORIZON_ACCEPT_LOG_ODDS);
    expect(
      angleDeg(r.centerVector, answerVector(getSampleAnswer(FILE)!)),
    ).toBeLessThan(2);
    // 찾은 촬영 시각은 올린 시각보다 25~30분 앞 (찍고 나서 올렸다)
    const minutes = (r.date.getTime() - POSTED_AT.getTime()) / 60000;
    expect(minutes).toBeGreaterThan(-60);
    expect(minutes).toBeLessThan(-15);
  }, 60000);

  it("사람이 찍지 않고 자동으로 찾은 지평선으로도 확신한다", async () => {
    const { data, info } = await sharp(
      resolve(process.cwd(), "public/samples", FILE),
    )
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const found = detectHorizon(
      data,
      info.width,
      info.height,
      info.channels,
      input.photoStars.slice(0, 60),
    )!;
    const r = horizonSolve({
      ...input,
      horizon: found.line,
      date: POSTED_AT,
    })!;

    expect(r.logOdds).toBeGreaterThanOrEqual(HORIZON_ACCEPT_LOG_ODDS);
    expect(
      angleDeg(r.centerVector, answerVector(getSampleAnswer(FILE)!)),
    ).toBeLessThan(2);
  }, 60000);

  it("넉 달 어긋난 날짜를 주면 확신하지 않는다", () => {
    const wrong = new Date(POSTED_AT.getTime() + 122 * 86400000);
    const r = horizonSolve({ ...input, date: wrong });

    expect(r === null || r.logOdds < HORIZON_ACCEPT_LOG_ODDS).toBe(true);
  }, 60000);
});
