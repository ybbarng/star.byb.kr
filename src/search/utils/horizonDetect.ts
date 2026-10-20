import type { Point2D } from "@/scripts/hash/types";

// 사진에서 하늘의 아래 경계(지평선·산·건물 윗선)를 직선으로 찾는다. 시각 추정·시각 제약 풀이의
// 입력으로 제안하고, 틀리면 사람이 고친다.
//
// 1) 사진을 작게 줄이고, 열마다 "위쪽 띠와 아래쪽 띠의 밝기 차"가 큰 행 몇 개를 경계 후보로 잡는다.
//    땅은 하늘보다 어둡기도(밤 산) 밝기도(눈·모래·광해) 하므로 차이의 크기만 본다. 가장 센 것 하나만
//    보면 해변·구름 가장자리에 수평선이 묻힌다(사이판).
// 2) 열 후보들에 직선을 RANSAC으로 맞춘다. 사람·나무·전봇대처럼 가리는 것은 이탈값으로 빠진다.
//    사람은 대개 카메라를 수평으로 들므로 많이 기운 직선은 깎는다.
// 3) 별 검출이 경계 아래에 많으면(경계가 아니라 하늘 속 구름·오로라 띠) 그 직선은 깎는다.
//    하늘만 있는 사진은 지지하는 열이 적어 null이다.
//
// 사람이 그은 지평선 9장 + 하늘만 있는 4장으로 재면 12장 중 8장이 맞는다(3% 안, journey 26장).
// 틀리는 사진(산·나무가 들쭉날쭉한 땅)이 있어 제안으로만 쓰고, 사람이 고칠 수 있게 한다.

export interface DetectedHorizon {
  line: [Point2D, Point2D]; // 사진 왼쪽 끝과 오른쪽 끝의 경계 위치
  support: number; // 직선을 지지하는 열의 비율 (0~1)
}

const WORK_WIDTH = 240;
// 경계 위아래로 비교하는 띠의 높이 (작게 줄인 사진 높이 대비). 넓은 띠는 완만한 경계(광해 낀 산),
// 좁은 띠는 날카로운 경계(먼 수평선의 가는 띠)를 잡는다.
const BANDS = [0.06, 0.02];
// 경계로 보지 않는 위쪽 비율 (하늘 위쪽 끝의 비네팅·구름 가장자리)
const TOP_SKIP = 0.15;
const MAX_TILT_DEG = 20;
const RANSAC_ITERATIONS = 400;
// 직선으로 인정하는 최소 지지 비율
const MIN_SUPPORT = 0.3;
// 열마다 남기는 경계 후보 수
const PEAKS_PER_COLUMN = 3;
// 기울기를 깎는 정도: 이 각도만큼 기울면 점수가 1/e
const TILT_SCALE_DEG = 10;

export const detectHorizon = (
  gray: ArrayLike<number>,
  width: number,
  height: number,
  channels = 1,
  stars: Point2D[] = [],
): DetectedHorizon | null => {
  // 1) 블록 평균으로 줄인다
  const scale = width / WORK_WIDTH;
  const w = WORK_WIDTH;
  const h = Math.max(20, Math.round(height / scale));
  const small = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * scale);
    const y1 = Math.min(height, Math.floor((y + 1) * scale));

    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * scale);
      const x1 = Math.min(width, Math.floor((x + 1) * scale));
      let sum = 0;
      let n = 0;

      for (let yy = y0; yy < y1; yy += 2) {
        for (let xx = x0; xx < x1; xx += 2) {
          sum += gray[(yy * width + xx) * channels];
          n++;
        }
      }

      small[y * w + x] = n ? sum / n : 0;
    }
  }

  // 열마다 위아래 띠 밝기 차가 큰 행들
  const bands = BANDS.map((f) => Math.max(2, Math.round(h * f)));
  const minGap = Math.min(...bands);
  const candidates: { x: number; y: number; strength: number }[] = [];

  for (let x = 0; x < w; x++) {
    // 이웃 열과 함께 본다 (별·잡음에 덜 흔들리게)
    const col = (y: number) => {
      let s = 0;
      let n = 0;

      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;

        if (xx >= 0 && xx < w) {
          s += small[y * w + xx];
          n++;
        }
      }

      return s / n;
    };

    const prefix = new Float32Array(h + 1);

    for (let y = 0; y < h; y++) {
      prefix[y + 1] = prefix[y] + col(y);
    }

    // 띠 높이마다 지역 최대를 모은다
    const peaks: { y: number; strength: number }[] = [];

    for (const band of bands) {
      const y0 = Math.max(band, Math.round(h * TOP_SKIP));
      const diff = new Float32Array(h);

      for (let y = y0; y <= h - band; y++) {
        const above = (prefix[y] - prefix[y - band]) / band;
        const below = (prefix[y + band] - prefix[y]) / band;
        diff[y] = Math.abs(above - below);
      }

      for (let y = y0 + 1; y < h - band; y++) {
        if (diff[y] > 0 && diff[y] >= diff[y - 1] && diff[y] > diff[y + 1]) {
          peaks.push({ y, strength: diff[y] });
        }
      }
    }

    // 센 것 몇 개 (서로 좁은 띠 높이 이상 떨어진 것)
    peaks.sort((a, b) => b.strength - a.strength);
    const kept: typeof peaks = [];

    for (const pk of peaks) {
      if (kept.every((k) => Math.abs(k.y - pk.y) >= minGap)) {
        kept.push(pk);
      }

      if (kept.length >= PEAKS_PER_COLUMN) {
        break;
      }
    }

    for (const pk of kept) {
      candidates.push({ x, y: pk.y, strength: pk.strength });
    }
  }

  if (candidates.length < w * MIN_SUPPORT) {
    return null;
  }

  // 2) RANSAC 직선 (결정적인 의사난수)
  let seed = 12345;

  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;

    return seed / 0x7fffffff;
  };

  const tol = Math.max(1.5, h * 0.015);
  const maxSlope = Math.tan((MAX_TILT_DEG * Math.PI) / 180);
  const starsSmall = stars.map(([x, y]) => [x / scale, y / scale]);
  const lines: { a: number; b: number; score: number; support: number }[] = [];

  for (let it = 0; it < RANSAC_ITERATIONS; it++) {
    const p = candidates[Math.floor(rand() * candidates.length)];
    const q = candidates[Math.floor(rand() * candidates.length)];

    if (Math.abs(q.x - p.x) < w * 0.1) {
      continue;
    }

    const a = (q.y - p.y) / (q.x - p.x);

    if (Math.abs(a) > maxSlope) {
      continue;
    }

    const b = p.y - a * p.x;
    // 한 열은 한 번만 센다 (열마다 후보가 여럿이라)
    const usedColumn = new Uint8Array(w);
    let score = 0;
    let support = 0;

    for (const c of candidates) {
      if (!usedColumn[c.x] && Math.abs(c.y - (a * c.x + b)) <= tol) {
        usedColumn[c.x] = 1;
        score += c.strength;
        support++;
      }
    }

    const tiltDeg = (Math.atan(Math.abs(a)) * 180) / Math.PI;
    score *= Math.exp(-tiltDeg / TILT_SCALE_DEG);

    // 3) 경계 아래에 별 검출이 많으면 하늘 속 띠다. 아래쪽 별 비율만큼 깎는다.
    if (starsSmall.length > 0) {
      const below = starsSmall.filter(([x, y]) => y > a * x + b + tol).length;
      score *= 1 - below / starsSmall.length;
    }

    if (support >= w * MIN_SUPPORT) {
      lines.push({ a, b, score, support });
    }
  }

  if (lines.length === 0) {
    return null;
  }

  const best = lines.reduce((m, l) => (l.score > m.score ? l : m));

  // 지지하는 열들로 최소제곱 다듬기
  const usedColumn = new Uint8Array(w);
  const inliers = candidates.filter((c) => {
    if (usedColumn[c.x] || Math.abs(c.y - (best.a * c.x + best.b)) > tol) {
      return false;
    }

    usedColumn[c.x] = 1;

    return true;
  });
  const n = inliers.length;
  const mx = inliers.reduce((s, c) => s + c.x, 0) / n;
  const my = inliers.reduce((s, c) => s + c.y, 0) / n;
  const sxx = inliers.reduce((s, c) => s + (c.x - mx) ** 2, 0);
  const sxy = inliers.reduce((s, c) => s + (c.x - mx) * (c.y - my), 0);
  const a = sxx > 0 ? sxy / sxx : best.a;
  const b = my - a * mx;

  return {
    line: [
      [0, b * scale],
      [width, (a * w + b) * scale],
    ],
    support: n / w,
  };
};
