import type { Point3D } from "@/scripts/hash/types";
import type { CatalogStar } from "@/test/synthetic/loadCatalog";
import type { Mat3 } from "@/test/synthetic/projection";
import {
  buildGroundTruthTransform,
  projectStarToPhoto,
} from "@/test/synthetic/projection";
import { createRng, gaussian } from "@/test/synthetic/rng";

// 정답을 아는 밤하늘을 픽셀 영상(회색조)으로 그린다. 별 좌표 목록만 만드는 generateSyntheticImage와
// 달리, 실제 검출 단계를 그대로 거치게 해서 지상·하늘의 거짓 검출(창문, 경계선, 선, 반사, 궤적)에 대한
// 강건성을 잰다. 각 요소는 실제 사진에서 본 거짓 검출을 흉내 낸다 (journey 17장).

export interface SceneClutter {
  // 사진 아래쪽에서 지면이 차지하는 비율 (0이면 하늘만). 지평선은 울퉁불퉁한 능선이다.
  groundFraction?: number;
  // 지평선 위로 솟은 건물 수. 창문 격자가 켜져 있다 (은하수 사진의 창문).
  buildings?: number;
  // 지면에서 하늘로 뻗은 밝은 선 수 (조명 받은 나무 줄기·전봇대, 오로라-03)
  poles?: number;
  // 지면이 물이면 지평선 불빛이 아래로 길게 비친다 (사이판의 바다 반사)
  water?: boolean;
  // 하늘을 가로지르는 위성 궤적 수 (가는 선)
  satellites?: number;
  // 하늘을 가로지르는 비행기 수 (깜빡이는 불빛의 점선)
  planes?: number;
}

export interface SceneOptions {
  center: Point3D;
  fovDeg: number; // 짧은 변 기준 시야각
  rotationDeg?: number;
  width: number;
  height: number;
  seed: number;
  magnitudeLimit?: number; // 이 등급까지 별을 그린다 (기본 5)
  skyNoise?: number; // 하늘 잡음 표준편차 (회색조 값, 기본 4)
  clutter?: SceneClutter;
}

export interface RenderedScene {
  gray: Uint8Array; // 1채널, width × height
  width: number;
  height: number;
  TP: Mat3; // 정답 변환
  center: Point3D;
  starsDrawn: number; // 그린 진짜 별 수 (지면에 가려진 별 제외)
}

// 별의 밝기(회색조 정점)와 퍼짐. 밝은 별일수록 정점이 높고(포화) 크게 번진다.
const starProfile = (v: number) => ({
  peak: Math.min(255, 60 * 10 ** (-0.4 * (v - 4))),
  sigma: 1.1 + Math.max(0, 3.5 - v) * 0.35,
});

export const renderScene = (
  catalog: CatalogStar[],
  opts: SceneOptions,
): RenderedScene => {
  const { width: W, height: H, seed } = opts;
  const clutter = opts.clutter ?? {};
  const magnitudeLimit = opts.magnitudeLimit ?? 5;
  const skyNoise = opts.skyNoise ?? 4;
  const rng = createRng(seed);
  const { TP } = buildGroundTruthTransform(
    opts.center,
    (opts.fovDeg * Math.PI) / 180,
    ((opts.rotationDeg ?? 0) * Math.PI) / 180,
    W,
    H,
  );
  const img = new Float32Array(W * H);

  const add = (x: number, y: number, value: number) => {
    const xi = Math.round(x);
    const yi = Math.round(y);

    if (xi >= 0 && xi < W && yi >= 0 && yi < H) {
      img[yi * W + xi] += value;
    }
  };

  const blob = (cx: number, cy: number, peak: number, sigma: number) => {
    const r = Math.ceil(sigma * 3);

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        add(
          cx + dx,
          cy + dy,
          peak * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma)),
        );
      }
    }
  };

  const line = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    value: number,
    halfWidth: number,
  ) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));

    for (let i = 0; i <= n; i++) {
      const t = i / Math.max(1, n);

      for (let w = -halfWidth; w <= halfWidth; w++) {
        add(x0 + (x1 - x0) * t + w, y0 + (y1 - y0) * t, value);
      }
    }
  };

  // 지평선: 지면 비율 주변에서 완만하게 오르내리는 능선
  const groundFraction = clutter.groundFraction ?? 0;
  const horizon = new Float32Array(W).fill(H);

  if (groundFraction > 0) {
    const base = H * (1 - groundFraction);
    const phase = rng() * Math.PI * 2;

    for (let x = 0; x < W; x++) {
      horizon[x] =
        base +
        Math.sin(x / (W / 5) + phase) * H * 0.03 +
        Math.sin(x / (W / 23) + phase * 2) * H * 0.01;
    }
  }

  // 하늘 배경: 위는 어둡고 지평선 쪽은 광해로 밝다
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const toHorizon = Math.max(0, 1 - (horizon[x] - y) / (H * 0.5));
      img[y * W + x] = 18 + 30 * toHorizon * toHorizon;
    }
  }

  // 진짜 별
  let starsDrawn = 0;

  for (const s of catalog) {
    if (s.v > magnitudeLimit) {
      continue;
    }

    const p = projectStarToPhoto(s.vector, TP);

    if (
      !p ||
      p[0] < 0 ||
      p[0] >= W ||
      p[1] < 0 ||
      p[1] >= horizon[Math.floor(p[0])]
    ) {
      continue;
    }

    const { peak, sigma } = starProfile(s.v);
    blob(p[0], p[1], peak, sigma);
    starsDrawn++;
  }

  // 하늘의 위성 궤적(가는 선)과 비행기(깜빡이는 점선)
  for (let i = 0; i < (clutter.satellites ?? 0); i++) {
    const y0 = rng() * H * 0.5;
    line(
      rng() * W * 0.3,
      y0,
      W * (0.6 + rng() * 0.4),
      y0 + rng() * H * 0.3,
      70,
      0,
    );
  }

  for (let i = 0; i < (clutter.planes ?? 0); i++) {
    const x0 = rng() * W * 0.2;
    const y0 = rng() * H * 0.5;
    const x1 = W * (0.7 + rng() * 0.3);
    const y1 = y0 + (rng() - 0.5) * H * 0.3;

    for (let t = 0; t <= 1; t += 0.04) {
      blob(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 160, 1.4);
    }
  }

  // 지면: 어두운 땅 + 경계 (밝은 하늘과 어두운 땅의 경계선)
  if (groundFraction > 0) {
    for (let x = 0; x < W; x++) {
      for (let y = Math.max(0, Math.floor(horizon[x])); y < H; y++) {
        img[y * W + x] = clutter.water
          ? 10 + 6 * Math.sin(y * 0.9 + x * 0.05) // 물결 무늬
          : 6;
      }
    }

    // 지평선 불빛 (물이면 아래로 길게 비친다)
    const lights = 6 + Math.floor(rng() * 6);

    for (let i = 0; i < lights; i++) {
      const x = rng() * W;
      const y = horizon[Math.floor(x)] - 2;
      blob(x, y, 200, 1.5);

      if (clutter.water) {
        for (let dy = 6; dy < H * 0.25; dy += 5 + rng() * 6) {
          blob(x + gaussian(rng) * 2, y + dy, 120 * (1 - dy / (H * 0.25)), 1.3);
        }
      }
    }
  }

  // 건물: 지평선 위로 솟은 어두운 직사각형 + 켜진 창문 격자
  for (let i = 0; i < (clutter.buildings ?? 0); i++) {
    const bw = W * (0.06 + rng() * 0.06);
    const bx = rng() * (W - bw);
    const top = horizon[Math.floor(bx)] - H * (0.08 + rng() * 0.15);
    const step = Math.max(6, bw / 8);

    for (let y = Math.floor(top); y < H; y++) {
      for (let x = Math.floor(bx); x < bx + bw; x++) {
        img[y * W + x] = 14;
      }
    }

    for (let wy = top + step; wy < H - step; wy += step) {
      for (let wx = bx + step / 2; wx < bx + bw - step / 2; wx += step) {
        if (rng() < 0.6) {
          blob(wx, wy, 150 + rng() * 100, 1.6);
        }
      }
    }
  }

  // 지면에서 하늘로 뻗은 밝은 선 (조명 받은 줄기·전봇대)
  for (let i = 0; i < (clutter.poles ?? 0); i++) {
    const x = rng() * W;
    const yTop = horizon[Math.floor(x)] - H * (0.1 + rng() * 0.25);
    line(x, H, x + (rng() - 0.5) * W * 0.05, yTop, 90, 1);
  }

  // 잡음과 회색조 변환
  const gray = new Uint8Array(W * H);

  for (let i = 0; i < W * H; i++) {
    gray[i] = Math.max(
      0,
      Math.min(255, Math.round(img[i] + gaussian(rng) * skyNoise)),
    );
  }

  return { gray, width: W, height: H, TP, center: opts.center, starsDrawn };
};
