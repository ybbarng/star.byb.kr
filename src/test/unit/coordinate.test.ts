import type { Point3D } from "@/scripts/hash/types";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as math from "mathjs";
import { describe, expect, it } from "vitest";
import {
  convertTo3DCoordinates,
  parseDMS,
  parseHMS,
} from "@/scripts/database/coordinates";
import { calculateProjectTransform } from "@/scripts/hash/plane";

const normalize = (v: Point3D): Point3D => {
  const n = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);

  return [v[0] / n, v[1] / n, v[2] / n];
};

describe("좌표 변환: RA/Dec 파싱", () => {
  it("parseHMS는 시각을 도(degree)로 변환한다 (1h = 15도)", () => {
    expect(parseHMS("00h 00m 00.0s")).toBeCloseTo(0, 9);
    expect(parseHMS("06h 00m 00.0s")).toBeCloseTo(90, 9);
    expect(parseHMS("12h 00m 00.0s")).toBeCloseTo(180, 9);
    expect(parseHMS("01h 30m 00.0s")).toBeCloseTo(22.5, 9);
  });

  it("parseDMS는 부호를 유지하며 도(degree)로 변환한다", () => {
    expect(parseDMS("+90° 00′ 00″")).toBeCloseTo(90, 9);
    expect(parseDMS("-30° 30′ 00″")).toBeCloseTo(-30.5, 9);
    // +0도대/-0도대는 부호 정보가 degrees(=0)에 남지 않으므로 문자열 부호를 봐야 한다
    expect(parseDMS("+00° 30′ 00″")).toBeCloseTo(0.5, 9);
    expect(parseDMS("-00° 30′ 00″")).toBeCloseTo(-0.5, 9);
  });
});

describe("좌표 변환: RA/Dec → 3D 단위 벡터", () => {
  it("결과 벡터의 노름은 항상 1이다", () => {
    const cases: [string, string][] = [
      ["+13° 23′ 46″", "00h 05m 42.0s"],
      ["-45° 00′ 00″", "12h 30m 00.0s"],
      ["+89° 59′ 59″", "23h 59m 59.9s"],
      ["-89° 59′ 59″", "06h 00m 00.0s"],
    ];

    for (const [dec, ra] of cases) {
      const { x, y, z } = convertTo3DCoordinates(dec, ra);

      expect(Math.sqrt(x * x + y * y + z * z)).toBeCloseTo(1, 12);
    }
  });

  it("적위 +90도는 북극(z=1)을 가리킨다", () => {
    const { x, y, z } = convertTo3DCoordinates("+90° 00′ 00″", "00h 00m 00.0s");

    expect(z).toBeCloseTo(1, 12);
    expect(x).toBeCloseTo(0, 12);
    expect(y).toBeCloseTo(0, 12);
  });

  it("적경 0h·적위 0도는 x축(1,0,0)을 가리킨다", () => {
    const { x, y, z } = convertTo3DCoordinates("+00° 00′ 00″", "00h 00m 00.0s");

    expect(x).toBeCloseTo(1, 12);
    expect(y).toBeCloseTo(0, 12);
    expect(z).toBeCloseTo(0, 12);
  });

  it("적경 6h·적위 0도는 y축(0,1,0)을 가리킨다", () => {
    const { x, y, z } = convertTo3DCoordinates("+00° 00′ 00″", "06h 00m 00.0s");

    expect(x).toBeCloseTo(0, 12);
    expect(y).toBeCloseTo(1, 12);
    expect(z).toBeCloseTo(0, 12);
  });
});

describe("접선평면(gnomonic) 투영 왕복", () => {
  it("투영 후 역변환하면 원래 방향이 복원된다 (<1e-9)", () => {
    const center = normalize([0.3, 0.5, 0.8]);
    const T = calculateProjectTransform(center) as unknown as number[][];
    const Tinv = math.inv(T) as unknown as number[][];

    const stars: Point3D[] = [
      normalize([0.31, 0.51, 0.8]),
      normalize([0.28, 0.52, 0.79]),
      normalize([0.3, 0.48, 0.82]),
      center,
    ];

    for (const v of stars) {
      const projected = math.multiply(T, v) as unknown as number[];
      const p2d = [projected[0] / projected[2], projected[1] / projected[2]];

      // 역변환: 동차좌표 [px, py, 1] → inv(T) → 정규화 → 원래 방향
      const back = math.multiply(Tinv, [
        p2d[0],
        p2d[1],
        1,
      ]) as unknown as Point3D;
      const recovered = normalize(back);

      expect(recovered[0]).toBeCloseTo(v[0], 9);
      expect(recovered[1]).toBeCloseTo(v[1], 9);
      expect(recovered[2]).toBeCloseTo(v[2], 9);
    }
  });

  it("중심 방향은 투영 평면의 원점(0,0)으로 간다", () => {
    const center = normalize([0.1, -0.4, 0.9]);
    const T = calculateProjectTransform(center) as unknown as number[][];
    const projected = math.multiply(T, center) as unknown as number[];

    expect(projected[0] / projected[2]).toBeCloseTo(0, 12);
    expect(projected[1] / projected[2]).toBeCloseTo(0, 12);
  });
});

// 빌드 산출물(gitignore)이 있을 때만: 저장된 x,y,z가 RA/Dec 재계산과 일치하는지 확인.
// 합성 데이터 생성기가 쓰는 좌표 규약이 시스템 DB와 동일함을 보증한다.
const dbPath = resolve(process.cwd(), "build/database/vectors-database.json");
const dbExists = existsSync(dbPath);

describe.skipIf(!dbExists)("DB 산출물과 좌표 규약 일치", () => {
  it("저장된 x,y,z가 RA/Dec로부터 재계산한 값과 일치한다", () => {
    const stars = JSON.parse(readFileSync(dbPath, "utf-8")) as {
      Dec: string;
      RA: string;
      x: number;
      y: number;
      z: number;
    }[];

    expect(stars.length).toBeGreaterThan(0);

    for (const star of stars.slice(0, 30)) {
      const { x, y, z } = convertTo3DCoordinates(star.Dec, star.RA);

      expect(x).toBeCloseTo(star.x, 9);
      expect(y).toBeCloseTo(star.y, 9);
      expect(z).toBeCloseTo(star.z, 9);
    }
  });
});
