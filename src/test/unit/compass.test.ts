import type { Point2D } from "@/scripts/hash/types";
import type { HorizonView } from "@/search/horizonSolve";
import { describe, expect, it } from "vitest";
import { compassMarks, frameFromZenith } from "@/search/compass";
import { horizonCameraTP } from "@/search/horizonSolve";
import { zenithFromHorizon } from "@/search/shotTimeEstimate";
import {
  fromAltAzJ2000,
  horizontalFrameJ2000,
  julianDay,
} from "@/search/utils/ephemeris";
import { photoToSky, projectVecToPhoto } from "@/search/utils/wcs";

// 정답 포즈를 아는 합성 사진: 서울, 2021-10-03 04:30 KST, 1500×1000, 짧은 변 시야각 60°
const W = 1500;
const H = 1000;
const date = new Date("2021-10-02T19:30:00Z");
const seoul = { latDeg: 37.5, lonDeg: 127 };
const frame = horizontalFrameJ2000(julianDay(date), seoul);
const options = { width: W, height: H, margin: 20, minGap: 60 };

const scene = (view: Partial<HorizonView>) => {
  const TP = horizonCameraTP(
    date,
    seoul,
    { azimuthDeg: 0, altitudeDeg: 20, rollDeg: 0, fovDeg: 60, ...view },
    W,
    H,
  );

  return {
    TP,
    project: (v: Parameters<typeof projectVecToPhoto>[1]) =>
      projectVecToPhoto(TP, v),
  };
};

describe("지평선이 사진을 지날 때: 지평선 위 그 방위 점", () => {
  it("북쪽을 보고 찍었으면 '북'이 지평선 위 가운데에 온다", () => {
    const { project } = scene({ azimuthDeg: 0, altitudeDeg: 20 });
    const marks = compassMarks(project, frame, options);
    const north = marks.find((m) => m.label === "북")!;

    expect(north.onHorizon).toBe(true);
    expect(north.x).toBeCloseTo(W / 2, 0);
    // 지평선은 광축보다 20° 아래 → 사진 가운데보다 아래
    expect(north.y).toBeGreaterThan(H / 2);
    // 시야각 60°(가로 약 82°)로는 북동·북서 지평선 점이 사진 밖이다
    expect(marks.map((m) => m.label)).toEqual(["북"]);
  });

  it("남동쪽을 보면 남동이 가운데, 양옆에 동·남", () => {
    const { project } = scene({ azimuthDeg: 135, altitudeDeg: 10, fovDeg: 80 });
    const marks = compassMarks(project, frame, options);

    // 가로 시야 약 103°라 ±45°의 동·남 지평선 점도 사진 안이다
    expect(marks.map((m) => m.label)).toEqual(["동", "남동", "남"]);
    expect(marks[1].x).toBeCloseTo(W / 2, 0);
    // 사진 오른쪽(x가 큰 쪽)이 방위가 커지는 쪽 (동 → 남동 → 남)
    expect(marks[0].x).toBeLessThan(marks[1].x);
    expect(marks[1].x).toBeLessThan(marks[2].x);
  });

  it("지평선 두 점으로 만든 좌표계가 시각·장소로 만든 것과 같은 자리를 낸다", () => {
    const { TP, project } = scene({
      azimuthDeg: 250,
      altitudeDeg: 15,
      rollDeg: 3,
    });
    const a = project(fromAltAzJ2000(frame, 0, 240))!;
    const b = project(fromAltAzJ2000(frame, 0, 260))!;
    const zenith = zenithFromHorizon(
      photoToSky(TP, a),
      photoToSky(TP, b),
      photoToSky(TP, [W / 2, 0]),
    )!;
    const fromHorizon = compassMarks(
      project,
      frameFromZenith(zenith)!,
      options,
    );
    const fromClock = compassMarks(project, frame, options);

    expect(fromHorizon.map((m) => m.label)).toEqual(
      fromClock.map((m) => m.label),
    );
    fromHorizon.forEach((m, i) => {
      expect(
        Math.hypot(m.x - fromClock[i].x, m.y - fromClock[i].y),
      ).toBeLessThan(1);
    });
    expect(fromClock.map((m) => m.label)).toContain("서");
  });
});

describe("하늘만 찍었을 때: 그 방위가 사진에 들어오는 가장자리", () => {
  it("북쪽 하늘 높이(고도 50°) 찍었으면 '북'은 아래 가장자리 가운데", () => {
    const { project } = scene({ azimuthDeg: 0, altitudeDeg: 50 });
    const marks = compassMarks(project, frame, options);
    const north = marks.find((m) => m.label === "북")!;

    expect(north.onHorizon).toBe(false);
    expect(north.x).toBeCloseTo(W / 2, 0);
    expect(north.y).toBeGreaterThan(H - 30);
    // 카메라 뒤쪽(남)은 없다
    expect(marks.some((m) => m.label === "남")).toBe(false);
  });

  it("천정을 찍으면 모든 방위가 사진에 들어오고, 서로 겹치지 않는다", () => {
    const { project } = scene({ azimuthDeg: 0, altitudeDeg: 89, fovDeg: 90 });
    const marks = compassMarks(project, frame, options);

    expect(marks.filter((m) => m.cardinal).map((m) => m.label)).toEqual([
      "북",
      "동",
      "남",
      "서",
    ]);

    for (const a of marks) {
      for (const b of marks) {
        if (a !== b) {
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(60);
        }
      }
    }
  });
});

describe("좌표계를 만들 수 없을 때", () => {
  it("천정이 천구의 북극이면 방위가 정해지지 않는다", () => {
    expect(frameFromZenith([0, 0, 1])).toBeNull();
  });

  it("방위 점이 모두 뒤쪽이면 아무것도 쓰지 않는다", () => {
    const none = (): Point2D | null => null;

    expect(compassMarks(none, frame, options)).toEqual([]);
  });
});
