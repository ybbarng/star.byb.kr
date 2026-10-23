import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { HorizontalFrame } from "@/search/utils/ephemeris";
import { fromAltAzJ2000 } from "@/search/utils/ephemeris";

// 사진 위에 방위(동·서·남·북과 그 사이)를 쓴다. 방위는 지평선 좌표계(천정)가 있어야 정해진다:
// - 지평선 두 점을 찍었으면: 그 천정(zenithFromHorizon)과 풀이로 아는 천구의 북극으로 (촬영 시각 없이도)
// - 촬영 시각·장소를 알면: 그 순간의 천정(horizontalFrameJ2000)으로
// 둘 다 없으면 그리지 않는다 (추측하지 않는다).
//
// 자리: 지평선이 사진을 지나면 지평선 위 그 방위 점에. 지평선이 사진 밖(하늘만 찍은 사진)이면
// 그 방위의 수직 대원을 지평선에서 위로 올라가다 처음 사진 안에 들어오는 곳(보통 아래 가장자리)에.

export interface CompassMark {
  label: string;
  azDeg: number;
  cardinal: boolean; // 동·서·남·북 (사이 방위보다 크게 쓴다)
  x: number;
  y: number;
  onHorizon: boolean; // 지평선 위의 점이다 (아니면 사진 가장자리 쪽 자리)
}

const DIRECTIONS = [
  "북",
  "북동",
  "동",
  "남동",
  "남",
  "남서",
  "서",
  "북서",
] as const;

// 천정 하나로 동·북 방향을 만든다 (horizontalFrameJ2000과 같은 식: 동 = 북극 × 천정)
export const frameFromZenith = (zenith: Point3D): HorizontalFrame | null => {
  const en = Math.hypot(zenith[0], zenith[1]);

  if (en < 1e-6) {
    return null; // 천정이 천구의 북극·남극이면 방위가 정해지지 않는다
  }

  const east: Point3D = [-zenith[1] / en, zenith[0] / en, 0];
  const north: Point3D = [
    zenith[1] * east[2] - zenith[2] * east[1],
    zenith[2] * east[0] - zenith[0] * east[2],
    zenith[0] * east[1] - zenith[1] * east[0],
  ];

  return { zenith, east, north };
};

export interface CompassOptions {
  width: number;
  height: number;
  margin: number; // 가장자리에서 이만큼 안쪽에 쓴다 (px)
  minGap: number; // 이름표끼리 이보다 가까우면 뒤의 것(사이 방위)을 뺀다 (px)
}

export const compassMarks = (
  project: (v: Point3D) => Point2D | null, // 뒤쪽이면 null
  frame: HorizontalFrame,
  { width: W, height: H, margin: m, minGap }: CompassOptions,
): CompassMark[] => {
  const inside = (p: Point2D | null): p is Point2D =>
    p !== null && p[0] >= m && p[0] <= W - m && p[1] >= m && p[1] <= H - m;
  const at = (alt: number, az: number) =>
    project(fromAltAzJ2000(frame, alt, az));

  // 지평선이 사진을 지나는가 (5°마다 본다)
  let horizonVisible = false;

  for (let az = 0; az < 360 && !horizonVisible; az += 5) {
    horizonVisible = inside(at(0, az));
  }

  const marks: CompassMark[] = [];

  DIRECTIONS.forEach((label, i) => {
    const azDeg = i * 45;
    let p: Point2D | null = null;

    if (horizonVisible) {
      const q = at(0, azDeg);
      p = inside(q) ? q : null;
    } else {
      // 천정 바로 앞(89°)까지만: 천정에서는 모든 방위가 한 점에 모인다
      for (let alt = 0; alt < 90 && !p; alt += 1) {
        const q = at(alt, azDeg);

        if (inside(q)) {
          // 1° 사이에서 가장자리를 좁혀 찾는다 (넓은 사진은 1°가 수십 px이다)
          let lo = alt - 1;
          let hi = alt;
          p = q;

          for (let k = 0; k < 12 && lo >= 0; k++) {
            const mid = (lo + hi) / 2;
            const r = at(mid, azDeg);

            if (inside(r)) {
              hi = mid;
              p = r;
            } else {
              lo = mid;
            }
          }
        }
      }
    }

    if (p) {
      marks.push({
        label,
        azDeg,
        cardinal: i % 2 === 0,
        x: p[0],
        y: p[1],
        onHorizon: horizonVisible,
      });
    }
  });

  // 겹치면 동서남북을 먼저 남긴다
  const kept: CompassMark[] = [];

  for (const mark of [...marks].sort(
    (a, b) => Number(b.cardinal) - Number(a.cardinal),
  )) {
    if (kept.every((k) => Math.hypot(k.x - mark.x, k.y - mark.y) >= minGap)) {
      kept.push(mark);
    }
  }

  return kept.sort((a, b) => a.azDeg - b.azDeg);
};
