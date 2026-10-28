import type { Point2D, Point3D } from "@/scripts/hash/types";
import { describe, expect, it } from "vitest";
import { drawSky } from "@/game/sky/drawSky";
import { makeSkyScene } from "@/game/sky/scene";
import {
  fromAltAzJ2000,
  horizontalFrameJ2000,
  julianDay,
} from "@/search/utils/ephemeris";

// 별자리선: 한쪽 끝 별이 졌거나 카메라 뒤에 있어도 보이는 부분은 긋는다 (예전엔 선이 통째로 사라졌다)

const LINE_COLOR = "rgba(250,220,80,0.75)";

// 그리는 명령을 받아 두는 가짜 canvas. 별자리선 색으로 그은 선분만 모은다
const fakeContext = () => {
  const lines: Point2D[][] = [];
  let path: Point2D[] = [];
  const state: Record<string | symbol, unknown> = {
    beginPath: () => {
      path = [];
    },
    moveTo: (x: number, y: number) => path.push([x, y]),
    lineTo: (x: number, y: number) => path.push([x, y]),
    stroke: () => {
      if (state.strokeStyle === LINE_COLOR) {
        lines.push(path);
      }
    },
  };
  const ctx = new Proxy(state, {
    get: (target, key) =>
      key in target
        ? target[key]
        : () => ({ addColorStop: () => {}, width: 0 }),
    set: (target, key, value) => {
      target[key] = value;

      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

  return { ctx, lines };
};

const scene = makeSkyScene(20261028, "easy");
const frame = horizontalFrameJ2000(julianDay(scene.date), scene.observer);
const at = (altDeg: number, dAzDeg: number): Point3D =>
  fromAltAzJ2000(frame, altDeg, scene.view.azimuthDeg + dAzDeg);

const linesOf = (stars: Point3D[]) => {
  const { ctx, lines } = fakeContext();
  drawSky(ctx, {
    ...scene,
    azimuthDeg: scene.view.azimuthDeg,
    groundSeed: 1,
    stars: [],
    constellations: [{ label: "", stars }],
  });

  return lines;
};

describe("drawSky 별자리선", () => {
  it("두 별이 다 떠 있으면 긋는다", () => {
    expect(linesOf([at(15, 0), at(25, 5)])).toHaveLength(1);
  });

  it("한쪽 별이 지평선 아래여도 긋는다 (아래 부분은 땅이 가린다)", () => {
    expect(linesOf([at(10, 0), at(-5, 5)])).toHaveLength(1);
  });

  it("두 별이 다 졌으면 긋지 않는다", () => {
    expect(linesOf([at(-3, 0), at(-8, 5)])).toHaveLength(0);
  });

  it("한쪽 별이 카메라 뒤여도 보이는 별에서 화면 밖까지 긋는다", () => {
    const [line] = linesOf([at(20, 0), at(20, 150)]);
    const start = linesOf([at(20, 0), at(25, 0)])[0][0];

    expect(line).toBeDefined();
    expect(line[0][0]).toBeCloseTo(start[0], 6);
    expect(line[0][1]).toBeCloseTo(start[1], 6);
    // 다른 끝은 화면 밖이다
    const [x, y] = line[1];
    expect(x < 0 || x > scene.width || y < 0 || y > scene.height).toBe(true);
  });

  it("두 별이 다 카메라 뒤면 긋지 않는다", () => {
    expect(linesOf([at(20, 160), at(20, 200)])).toHaveLength(0);
  });
});
