import type { SkyPose } from "@/game/myConstellation/visibility";
import type { HorizonView } from "@/search/horizonSolve";

// 하늘에서 보기 그림의 길잡이: 시야 고르기, 지평선 방위 눈금, 고도 등고선, 하늘 전체 둥근 지도.
// 모두 지평 좌표(고도·방위)만으로 계산하는 순수 함수다. 사진 변환(horizonCameraTP, 롤 0)과 같은 투영을 쓴다.

const D = Math.PI / 180;

type V3 = [number, number, number];

// 지평 좌표 → 동·북·천정 단위 벡터 (오른손 좌표계)
const enu = (altDeg: number, azDeg: number): V3 => [
  Math.cos(altDeg * D) * Math.sin(azDeg * D),
  Math.cos(altDeg * D) * Math.cos(azDeg * D),
  Math.sin(altDeg * D),
];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

// 시야(롤 0)로 본 화면 좌표. 카메라 뒤쪽이면 null. fovDeg는 짧은 변(세로) 기준
export const projectAltAz = (
  view: HorizonView,
  altDeg: number,
  azDeg: number,
  W: number,
  H: number,
): [number, number] | null => {
  const z = enu(view.altitudeDeg, view.azimuthDeg);
  const up: V3 = [0, 0, 1];
  const yRaw: V3 = [
    -(up[0] - z[0] * z[2]),
    -(up[1] - z[1] * z[2]),
    -(up[2] - z[2] * z[2]),
  ];
  const yn = Math.hypot(...yRaw);
  const y: V3 = [yRaw[0] / yn, yRaw[1] / yn, yRaw[2] / yn];
  const x = cross(y, z);
  const f = Math.min(W, H) / 2 / Math.tan((view.fovDeg / 2) * D);
  const v = enu(altDeg, azDeg);
  const depth = dot(z, v);

  return depth > 1e-6
    ? [W / 2 + (f * dot(x, v)) / depth, H / 2 + (f * dot(y, v)) / depth]
    : null;
};

// 지평선을 화면 아래쪽 이 비율 높이에 둔다 (그 아래는 땅)
const HORIZON_AT = 0.85;
// 지평선을 넣으려고 넓힐 수 있는 시야 한계. 이보다 넓으면 별자리가 너무 작아져 별자리 쪽을 보고 둥근 지도로 알려 준다
const MAX_FOV_WITH_HORIZON = 100;
const MIN_FOV = 60;
const MARGIN = 0.06; // 화면 가장자리 여유 (비율)

const inside = (
  p: [number, number] | null,
  W: number,
  H: number,
): p is [number, number] =>
  p !== null &&
  p[0] > W * MARGIN &&
  p[0] < W * (1 - MARGIN) &&
  p[1] > H * MARGIN &&
  p[1] < H * HORIZON_AT;

// 별자리가 다 들어오고, 그 아래 지평선과 동서남북이 같이 보이는 시야를 고른다.
// 별자리가 작아도 지평선까지 넣어 "실제 하늘에서 어디쯤인지" 알 수 있게 한다.
// 너무 높아(머리 위 가까이) 지평선까지 넣으면 별자리가 점처럼 작아질 때만 별자리 쪽을 본다.
export const viewFor = (
  pose: SkyPose,
  radiusDeg: number,
  W = 1200,
  H = 900,
): HorizonView => {
  const azimuthDeg = pose.centerAz;

  if (pose.centerAlt <= 0) {
    // 지평선 아래: 그 방위의 지평선을 본다
    const fovDeg = Math.max(MIN_FOV, Math.min(100, radiusDeg * 2.6 + 16));

    return { azimuthDeg, altitudeDeg: fovDeg * 0.32, rollDeg: 0, fovDeg };
  }

  const up = pose.stars.filter((s) => s.altDeg > 0);

  for (let fovDeg = MIN_FOV; fovDeg <= MAX_FOV_WITH_HORIZON; fovDeg += 2) {
    // 지평선(직선으로 보인다)이 화면 HORIZON_AT 높이에 오는 광축 고도
    const half = Math.tan((fovDeg / 2) * D);
    const altitudeDeg = Math.atan((2 * HORIZON_AT - 1) * half) / D;
    const view = { azimuthDeg, altitudeDeg, rollDeg: 0, fovDeg };

    if (
      up.every((s) => inside(projectAltAz(view, s.altDeg, s.azDeg, W, H), W, H))
    ) {
      return view;
    }
  }

  const fovDeg = Math.max(MIN_FOV, Math.min(100, radiusDeg * 2.6 + 16));

  return {
    azimuthDeg,
    altitudeDeg: Math.max(fovDeg * 0.32, Math.min(78, pose.centerAlt)),
    rollDeg: 0,
    fovDeg,
  };
};

// ── 지평선 방위 ────────────────────────────────────────────────────

export const DIRECTIONS_8 = [
  "북",
  "북동",
  "동",
  "남동",
  "남",
  "남서",
  "서",
  "북서",
] as const;

export interface HorizonMark {
  label: string | null; // 8방위면 이름, 10°마다 눈금은 null
  azDeg: number;
  x: number;
  y: number; // 지평선 위의 점
}

// 화면 안 지평선 위의 방위 눈금 (10°마다, 45°마다 이름)
export const horizonMarks = (
  view: HorizonView,
  W: number,
  H: number,
): HorizonMark[] => {
  const marks: HorizonMark[] = [];

  for (let az = 0; az < 360; az += 5) {
    const named = az % 45 === 0;

    if (!named && az % 10 !== 0) {
      continue;
    }

    const p = projectAltAz(view, 0, az, W, H);

    if (p && p[0] >= 0 && p[0] <= W && p[1] >= 0 && p[1] <= H) {
      marks.push({
        label: named ? DIRECTIONS_8[az / 45] : null,
        azDeg: az,
        x: p[0],
        y: p[1],
      });
    }
  }

  return marks;
};

// 화면 양 끝 너머의 가장 가까운 방위 이름: 시야가 좁아 8방위가 하나만 보여도 "← 남동 · 남서 →"로 방향을 잡는다
export const edgeDirections = (
  view: HorizonView,
  W: number,
  H: number,
): { left: string; right: string } => {
  const edgeAz = (sign: 1 | -1) => {
    let d = 0;

    for (; d < 180; d += 0.5) {
      const p = projectAltAz(view, 0, view.azimuthDeg + sign * d, W, H);

      if (!p || p[0] < 0 || p[0] > W) {
        break;
      }
    }

    return view.azimuthDeg + sign * d;
  };

  const name = (az: number) =>
    DIRECTIONS_8[((Math.round(az / 45) % 8) + 8) % 8];

  return {
    left: name(Math.floor(edgeAz(-1) / 45) * 45),
    right: name(Math.ceil(edgeAz(1) / 45) * 45),
  };
};

// 화면 아래 가운데가 지평선에서 몇 도 위인지 (지평선이 화면 아래로 빠졌을 때 알려 준다). 지평선이 보이면 0
// (세로 가운데 선은 큰 원이라 각도가 고르게 늘어선다: 화면 아래 끝은 광축에서 세로 시야의 절반 아래)
export const bottomAltitude = (view: HorizonView) =>
  Math.max(0, view.altitudeDeg - view.fovDeg / 2);

// ── 고도 등고선 ────────────────────────────────────────────────────

export const CONTOUR_ALTS = [10, 30, 60] as const;

// 고도 altDeg인 원을 화면에 그릴 꺾은선 (화면에 걸친 부분만 이어서)
export const altitudeContour = (
  view: HorizonView,
  altDeg: number,
  W: number,
  H: number,
): [number, number][][] => {
  const parts: [number, number][][] = [[]];
  const pad = Math.max(W, H);

  for (let d = -180; d <= 180; d += 1) {
    const p = projectAltAz(view, altDeg, view.azimuthDeg + d, W, H);
    const ok =
      p !== null &&
      p[0] > -pad &&
      p[0] < W + pad &&
      p[1] > -pad &&
      p[1] < H + pad;

    if (ok) {
      parts[parts.length - 1].push(p);
    } else if (parts[parts.length - 1].length) {
      parts.push([]);
    }
  }

  return parts.filter(
    (l) =>
      l.length > 1 && l.some(([x, y]) => x >= 0 && x <= W && y >= 0 && y <= H),
  );
};

// 등고선 이름표: "30° · 주먹 3개" (팔 뻗은 주먹 하나가 약 10°)
export const contourLabel = (altDeg: number) =>
  `${altDeg}° · 주먹 ${Math.round(altDeg / 10)}개`;

// ── 하늘 전체 둥근 지도 ─────────────────────────────────────────────

// 가운데가 머리 위(천정), 테두리가 지평선. 바라보는 방위가 아래쪽, 오른쪽이 바라보는 쪽의 오른쪽
// (큰 그림과 같은 방향이라 그대로 겹쳐 생각할 수 있다)
export const domePoint = (
  altDeg: number,
  azDeg: number,
  facingAzDeg: number,
  cx: number,
  cy: number,
  R: number,
): [number, number] => {
  const r = (R * (90 - Math.max(0, altDeg))) / 90;
  const a = (azDeg - facingAzDeg) * D;

  return [cx + r * Math.sin(a), cy + r * Math.cos(a)];
};
