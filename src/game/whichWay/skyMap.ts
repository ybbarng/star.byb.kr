import type { AltAz } from "@/game/whichWay/problem";
import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { HorizontalFrame } from "@/search/utils/ephemeris";

// 전천 하늘 지도(오늘 밤 내 하늘의 drawAllSky와 같은 그림)의 좌표와, 사진을 지도·파노라마 위에 펴는 그리기.
// 지도는 남쪽을 보고 서서 하늘을 머리 위로 든 모습: 천정이 가운데, 가장자리가 지평선, 북쪽이 위, 동쪽이 왼쪽.
// 평사 투영이라 중심에서 r = R·tan(천정 거리 / 2) — 하늘의 원은 지도에서도 원이지만 지평선 쪽은 넓게 늘어난다.

const D = Math.PI / 180;

// drawAllSky와 같은 반지름 (정사각형 한 변 size)
export const mapRadius = (size: number) => size / 2 - size * 0.07;

export const altAzToMap = ({ altDeg, azDeg }: AltAz, size: number): Point2D => {
  const c = size / 2;
  const r = mapRadius(size) * Math.tan(((90 - altDeg) * D) / 2);

  return [c - r * Math.sin(azDeg * D), c - r * Math.cos(azDeg * D)];
};

// 지도 위 점 → 고도·방위. 지평선 밖을 누르면 지평선으로 붙인다
export const mapToAltAz = (x: number, y: number, size: number): AltAz => {
  const c = size / 2;
  const dx = c - x;
  const dy = c - y;
  const r = Math.hypot(dx, dy) / mapRadius(size);
  const altDeg = Math.max(0, 90 - (2 * Math.atan(r)) / D);
  const azDeg = r < 1e-9 ? 0 : (((Math.atan2(dx, dy) / D) % 360) + 360) % 360;

  return { altDeg, azDeg };
};

const dot = (a: Point3D, b: Point3D) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// 하늘 방향(J2000) → 지도 위 점 (drawAllSky의 project와 같은 식). 천정 반대쪽 끝은 null
export const vecToMap = (
  v: Point3D,
  frame: HorizontalFrame,
  size: number,
): Point2D | null => {
  const up = dot(frame.zenith, v);

  if (up < -0.9) {
    return null;
  }

  const c = size / 2;
  const k = mapRadius(size) / (1 + up);

  return [c - k * dot(frame.east, v), c - k * dot(frame.north, v)];
};

// ---------- 파노라마 (가로 방위 0~360°, 세로 고도) ----------

export const PANO_ALT_TOP = 90;
export const PANO_ALT_BOTTOM = -10;

// 방위는 북(0°)에서 시작해 동·남·서를 지나 다시 북. azRef 둘레로 풀어서(±180°) 이음매를 넘는 사진도 이어지게
export const panoXY = (
  { altDeg, azDeg }: AltAz,
  W: number,
  H: number,
  azRef = 180,
): Point2D => {
  const az = azRef + ((((azDeg - azRef + 180) % 360) + 360) % 360) - 180;

  return [
    (az / 360) * W,
    ((PANO_ALT_TOP - altDeg) / (PANO_ALT_TOP - PANO_ALT_BOTTOM)) * H,
  ];
};

// ---------- 사진을 휘어서 붙이기 ----------

// 사진을 격자로 잘라 조각마다 삼각형 두 개를 아핀 변환으로 붙인다 (원근으로 휜 사다리꼴을 흉내 낸다).
// to(x, y)가 null이면 그 조각은 건너뛴다.
export const drawWarped = (
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  W: number,
  H: number,
  to: (x: number, y: number) => Point2D | null,
  cols = 10,
  rows = 8,
) => {
  const grid: (Point2D | null)[][] = [];

  for (let j = 0; j <= rows; j++) {
    grid.push([]);

    for (let i = 0; i <= cols; i++) {
      grid[j].push(to((i / cols) * W, (j / rows) * H));
    }
  }

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x0 = (i / cols) * W;
      const x1 = ((i + 1) / cols) * W;
      const y0 = (j / rows) * H;
      const y1 = ((j + 1) / rows) * H;
      const a = grid[j][i];
      const b = grid[j][i + 1];
      const c = grid[j + 1][i + 1];
      const d = grid[j + 1][i];

      if (a && b && c) {
        drawTriangle(ctx, img, [x0, y0], [x1, y0], [x1, y1], a, b, c);
      }

      if (a && c && d) {
        drawTriangle(ctx, img, [x0, y0], [x1, y1], [x0, y1], a, c, d);
      }
    }
  }
};

// 원본 삼각형 (s0,s1,s2)을 (d0,d1,d2)로 옮겨 그린다. 이음매가 안 보이게 조금 넓혀 자른다
const drawTriangle = (
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  s0: Point2D,
  s1: Point2D,
  s2: Point2D,
  d0: Point2D,
  d1: Point2D,
  d2: Point2D,
) => {
  const m = affineFromTriangles(s0, s1, s2, d0, d1, d2);

  if (!m) {
    return;
  }

  const cx = (d0[0] + d1[0] + d2[0]) / 3;
  const cy = (d0[1] + d1[1] + d2[1]) / 3;

  const grow = (p: Point2D): Point2D => {
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    const l = Math.hypot(dx, dy) || 1;

    return [p[0] + (dx / l) * 0.7, p[1] + (dy / l) * 0.7];
  };

  const [g0, g1, g2] = [grow(d0), grow(d1), grow(d2)];

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(g0[0], g0[1]);
  ctx.lineTo(g1[0], g1[1]);
  ctx.lineTo(g2[0], g2[1]);
  ctx.closePath();
  ctx.clip();
  ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
};

// 세 점의 대응으로 아핀 변환 [a, b, c, d, e, f] (캔버스 transform 순서: x' = a x + c y + e, y' = b x + d y + f)
export const affineFromTriangles = (
  s0: Point2D,
  s1: Point2D,
  s2: Point2D,
  d0: Point2D,
  d1: Point2D,
  d2: Point2D,
): [number, number, number, number, number, number] | null => {
  const ux = s1[0] - s0[0];
  const uy = s1[1] - s0[1];
  const vx = s2[0] - s0[0];
  const vy = s2[1] - s0[1];
  const det = ux * vy - uy * vx;

  if (Math.abs(det) < 1e-12) {
    return null;
  }

  const px = d1[0] - d0[0];
  const py = d1[1] - d0[1];
  const qx = d2[0] - d0[0];
  const qy = d2[1] - d0[1];
  // [a c; b d] · [u v] = [p q]
  const a = (px * vy - qx * uy) / det;
  const c = (qx * ux - px * vx) / det;
  const b = (py * vy - qy * uy) / det;
  const d = (qy * ux - py * vx) / det;
  const e = d0[0] - a * s0[0] - c * s0[1];
  const f = d0[1] - b * s0[0] - d * s0[1];

  return [a, b, c, d, e, f];
};

// 테두리 꺾은선 (점이 크게 튀는 곳에서 끊는다: 파노라마 이음매·지도 바깥 끝)
export const strokeOutline = (
  ctx: CanvasRenderingContext2D,
  pts: (Point2D | null)[],
  maxJump: number,
) => {
  ctx.beginPath();
  let prev: Point2D | null = null;

  for (const p of [...pts, pts[0]]) {
    if (p && prev && Math.hypot(p[0] - prev[0], p[1] - prev[1]) < maxJump) {
      ctx.lineTo(p[0], p[1]);
    } else if (p) {
      ctx.moveTo(p[0], p[1]);
    }

    prev = p;
  }

  ctx.stroke();
};
