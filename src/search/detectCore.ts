export interface DetectedStar {
  cx: number;
  cy: number;
  brightness: number; // 밝을수록 큰 값
  radius: number; // 유효 반경(px): 문턱을 넘는 영역의 반지름
  elongation: number; // 1=원형, 클수록 길쭉 (물결 반사광/궤적은 큼)
  fwhm: number; // 밝기 분포 크기(px)
  ringContrast?: number; // 별다움 (ringContrast, 회색조 영상을 줄 때만)
  trail?: boolean; // 별 궤적 덩어리에서 고른 점 (findTrails). 선이 고리를 지나 별다움을 재지 않는다
  chord?: [number, number, number, number]; // 별 궤적 덩어리의 양 끝점 (x1, y1, x2, y2). 회전 중심을 찾는 데 쓴다
}

// 별 검출의 핵심 (예전 브라우저 cv.worker.js의 findStars에서 옮겨 왔다).
// 입력은 차영상 diff = grayscale - blur (음수 클램프, 1채널). 회색조·흐림·빼기는 detectImage.ts가 만든다
// (브라우저 Worker와 node 테스트가 같은 코드).
// 적응적 threshold(mean+3σ) → local maxima → 유효 반경 → NMS → weighted centroid·빛 총량.
export const detectStarsFromDiff = (
  diff: Float32Array | Uint8Array | Uint8ClampedArray,
  cols: number,
  rows: number,
  sigmaK = 3, // threshold = mean + sigmaK·σ. 높일수록 노이즈에 엄격
): DetectedStar[] => {
  const n = cols * rows;

  let sum = 0;

  for (let i = 0; i < n; i++) {
    sum += diff[i];
  }

  const meanVal = sum / n;

  let varSum = 0;

  for (let i = 0; i < n; i++) {
    const d = diff[i] - meanVal;
    varSum += d * d;
  }

  const stddevVal = Math.sqrt(varSum / n);
  const threshold = meanVal + sigmaK * stddevVal;

  // 1단계: local maxima 후보 + 유효 반경
  const candidates: {
    x: number;
    y: number;
    peakVal: number;
    effectiveRadius: number;
  }[] = [];
  const margin = 3;
  const maxRadius = 50;
  const dirs = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];

  for (let y = margin; y < rows - margin; y++) {
    for (let x = margin; x < cols - margin; x++) {
      const val = diff[y * cols + x];

      if (val < threshold) {
        continue;
      }

      let isMax = true;

      for (let dy = -1; dy <= 1 && isMax; dy++) {
        for (let dx = -1; dx <= 1 && isMax; dx++) {
          if (dy === 0 && dx === 0) {
            continue;
          }

          if (diff[(y + dy) * cols + (x + dx)] > val) {
            isMax = false;
          }
        }
      }

      if (!isMax) {
        continue;
      }

      let radiusSum = 0;

      for (const [ddx, ddy] of dirs) {
        let r = 1;

        while (r <= maxRadius) {
          const ny = y + ddy * r;
          const nx = x + ddx * r;

          if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) {
            break;
          }

          if (diff[ny * cols + nx] < threshold) {
            break;
          }

          r++;
        }

        radiusSum += r - 1;
      }

      candidates.push({
        x,
        y,
        peakVal: val,
        effectiveRadius: radiusSum / dirs.length,
      });
    }
  }

  // 2단계: NMS — 반경 큰 후보부터, 억제 반경(2×) 내 작은 후보 제거
  candidates.sort(
    (a, b) => b.effectiveRadius - a.effectiveRadius || b.peakVal - a.peakVal,
  );

  const suppressed = new Uint8Array(candidates.length);
  const merged: typeof candidates = [];

  for (let i = 0; i < candidates.length; i++) {
    if (suppressed[i]) {
      continue;
    }

    const star = candidates[i];
    const suppressRadius = Math.max(3, star.effectiveRadius * 2);
    const suppressRadiusSq = suppressRadius * suppressRadius;

    for (let j = i + 1; j < candidates.length; j++) {
      if (suppressed[j]) {
        continue;
      }

      const dx = candidates[j].x - star.x;
      const dy = candidates[j].y - star.y;

      if (dx * dx + dy * dy <= suppressRadiusSq) {
        suppressed[j] = 1;
      }
    }

    merged.push(star);
  }

  // 3단계: weighted centroid (서브픽셀) + 2차 모멘트로 모양(elongation/fwhm)
  const stars = merged.map((star) => {
    const centroidRadius = Math.max(2, Math.ceil(star.effectiveRadius));
    let sumW = 0;
    let sumWx = 0;
    let sumWy = 0;
    let sumWxx = 0;
    let sumWyy = 0;
    let sumWxy = 0;

    for (let dy = -centroidRadius; dy <= centroidRadius; dy++) {
      for (let dx = -centroidRadius; dx <= centroidRadius; dx++) {
        const ny = star.y + dy;
        const nx = star.x + dx;

        if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) {
          continue;
        }

        const w = diff[ny * cols + nx];
        sumW += w;
        sumWx += w * nx;
        sumWy += w * ny;
        sumWxx += w * nx * nx;
        sumWyy += w * ny * ny;
        sumWxy += w * nx * ny;
      }
    }

    const cx = sumW > 0 ? sumWx / sumW : star.x;
    const cy = sumW > 0 ? sumWy / sumW : star.y;
    // 2차 중심 모멘트 → 공분산 고유값으로 elongation, fwhm
    const mu20 = sumW > 0 ? sumWxx / sumW - cx * cx : 0;
    const mu02 = sumW > 0 ? sumWyy / sumW - cy * cy : 0;
    const mu11 = sumW > 0 ? sumWxy / sumW - cx * cy : 0;
    const half = (mu20 + mu02) / 2;
    const common = Math.sqrt(((mu20 - mu02) / 2) ** 2 + mu11 * mu11);
    const l1 = half + common;
    const l2 = half - common;
    const elongation = l2 > 1e-6 ? Math.sqrt(l1 / l2) : Infinity;
    const fwhm = 2.3548 * Math.sqrt(Math.max(0, half));

    return {
      cx,
      cy,
      // 밝기는 차영상의 빛 총량(중심 둘레 창의 합)이다. 예전에는 유효 반경을 썼는데, 1920px 사진에서는
      // 대부분 0~3px에 몰려 직녀성(0.03등급)이 832위로 밀리기도 했다 (journey 39장)
      brightness: sumW,
      radius: star.effectiveRadius,
      elongation,
      fwhm,
    };
  });

  // 별 궤적 점은 따로 표시해 덧붙인다. 점 검출은 그대로 두어 일반 사진의 입력이 바뀌지 않는다
  return [...stars, ...findTrails(diff, cols, rows, threshold)];
};

// 별 궤적: 문턱을 넘는 픽셀을 8방향으로 이은 덩어리 중 가늘고 긴 것. 덩어리마다 무게 중심에 가장 가까운 픽셀 하나를 별로 둔다. 원호의 무게 중심에 가장 가까운 점은 원호의 가운데,
// 곧 노출 중간 순간의 별 자리라 모든 궤적이 같은 순간의 하늘을 가리킨다.
export const findTrails = (
  diff: Float32Array | Uint8Array | Uint8ClampedArray,
  cols: number,
  rows: number,
  threshold: number,
): DetectedStar[] => {
  const unit = Math.max(1, Math.hypot(cols, rows) / 1400);
  const minLength = Math.max(14, 10 * unit);
  const maxWidth = Math.max(4, 3 * unit);
  const maxLength = Math.hypot(cols, rows) * 0.5;
  const labels = new Int32Array(cols * rows);
  const stack = new Int32Array(cols * rows);
  const stars: DetectedStar[] = [];
  let next = 1;

  for (let start = 0; start < cols * rows; start++) {
    if (labels[start] !== 0 || diff[start] < threshold) {
      continue;
    }

    const label = next++;
    let top = 0;
    stack[top++] = start;
    labels[start] = label;
    const pixels: number[] = [];
    let sw = 0;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let syy = 0;
    let sxy = 0;
    let minX = cols;
    let maxX = 0;
    let minY = rows;
    let maxY = 0;

    while (top > 0) {
      const i = stack[--top];
      const x = i % cols;
      const y = (i - x) / cols;
      const w = diff[i];
      pixels.push(i);
      sw += w;
      sx += w * x;
      sy += w * y;
      sxx += w * x * x;
      syy += w * y * y;
      sxy += w * x * y;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;

          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) {
            continue;
          }

          const j = ny * cols + nx;

          if (labels[j] === 0 && diff[j] >= threshold) {
            labels[j] = label;
            stack[top++] = j;
          }
        }
      }
    }

    const length = Math.hypot(maxX - minX + 1, maxY - minY + 1);
    const cx = sx / sw;
    const cy = sy / sw;
    const mu20 = sxx / sw - cx * cx;
    const mu02 = syy / sw - cy * cy;
    const mu11 = sxy / sw - cx * cy;
    const half = (mu20 + mu02) / 2;
    const common = Math.sqrt(((mu20 - mu02) / 2) ** 2 + mu11 * mu11);
    const elongation = Math.sqrt(
      (half + common) / Math.max(1e-6, half - common),
    );

    if (
      length < minLength ||
      length > maxLength ||
      pixels.length / length > maxWidth ||
      elongation < 3
    ) {
      continue;
    }

    let best = pixels[0];
    let bestD = Infinity;

    for (const i of pixels) {
      const x = i % cols;
      const d = (x - cx) ** 2 + ((i - x) / cols - cy) ** 2;

      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }

    // 양 끝점: 무게 중심에서 가장 먼 픽셀, 다시 그 픽셀에서 가장 먼 픽셀
    const farthest = (fx: number, fy: number) => {
      let far = pixels[0];
      let farD = -1;

      for (const i of pixels) {
        const x = i % cols;
        const d = (x - fx) ** 2 + ((i - x) / cols - fy) ** 2;

        if (d > farD) {
          farD = d;
          far = i;
        }
      }

      return [far % cols, Math.floor(far / cols)];
    };

    const [ax, ay] = farthest(cx, cy);
    const [ex, ey] = farthest(ax, ay);
    const bx = best % cols;
    stars.push({
      chord: [ax, ay, ex, ey],
      cx: bx,
      cy: (best - bx) / cols,
      brightness: sw,
      radius: pixels.length / length / 2,
      elongation,
      fwhm: 0,
      trail: true,
    });
  }

  return stars;
};

// 고리(반지름 r1~r2) 안 픽셀의 (dx, dy, 부채꼴 번호) 목록. 반지름 쌍마다 한 번만 만든다.
// 고리가 큰 사진(지름 수십 px)에서는 한 칸 건너 표본을 뽑는다(평균만 쓰므로 충분하다).
const ringOffsetCache = new Map<string, Int32Array>();

const ringOffsets = (r1: number, r2: number, step: number): Int32Array => {
  const key = `${r1}/${r2}/${step}`;
  let offsets = ringOffsetCache.get(key);

  if (!offsets) {
    const list: number[] = [];
    const reach = Math.ceil(r2);

    for (let dy = -reach; dy <= reach; dy += step) {
      for (let dx = -reach; dx <= reach; dx += step) {
        const r = Math.hypot(dx, dy);

        if (r < r1 || r > r2) {
          continue;
        }

        const sector =
          Math.floor(((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * 8) % 8;
        list.push(dx, dy, sector);
      }
    }

    offsets = Int32Array.from(list);
    ringOffsetCache.set(key, offsets);
  }

  return offsets;
};

// 검출 주변이 사방으로 고른 하늘인지 잰다 (작을수록 별답다).
// 주변 고리(별 크기 바깥)를 8부채꼴로 나눠 회색조 평균의 (최대 - 최소)를 별의 대비(정점 - 배경)로
// 나눈 값이다. 배경은 부채꼴 평균 8개의 중앙값이다. 진짜 별은 고른 하늘 위에 떠 있어 0.1 안팎이다.
// 밝기 경계선(지붕·능선)은 한쪽만, 줄기·전선은 마주 보는 두 쪽이, 창문은 이웃 창문과 벽이 고리에
// 걸려 커진다. unit은 사진 크기 단위(대각선/1400, 최소 1)라 큰 사진에서도 같은 비율의 고리를 본다.
export const ringContrast = (
  gray: Uint8Array | Uint8ClampedArray,
  cols: number,
  rows: number,
  star: { cx: number; cy: number; radius: number },
  channels = 1,
): number => {
  const unit = Math.max(1, Math.hypot(cols, rows) / 1400);
  // 반지름은 0.5px 단위로 맞춰 고리 목록을 재사용한다
  const r1 = Math.round((3 * unit + star.radius) * 2) / 2;
  const r2 = Math.round((6 * unit + star.radius * 1.5) * 2) / 2;
  const offsets = ringOffsets(r1, r2, r2 > 12 ? 2 : 1);

  const at = (x: number, y: number) => {
    const cx = Math.min(cols - 1, Math.max(0, x));
    const cy = Math.min(rows - 1, Math.max(0, y));

    return gray[(cy * cols + cx) * channels];
  };

  const x0 = Math.round(star.cx);
  const y0 = Math.round(star.cy);
  const sums = [0, 0, 0, 0, 0, 0, 0, 0];
  const counts = [0, 0, 0, 0, 0, 0, 0, 0];

  for (let k = 0; k < offsets.length; k += 3) {
    const sector = offsets[k + 2];
    sums[sector] += at(x0 + offsets[k], y0 + offsets[k + 1]);
    counts[sector]++;
  }

  // 별의 정점: 안쪽 원의 최댓값 (작은 별은 중심 픽셀이 정점에서 비껴 있을 수 있다)
  let peak = 0;
  const inner = Math.max(2, Math.ceil(r1 / 2));

  for (let dy = -inner; dy <= inner; dy++) {
    for (let dx = -inner; dx <= inner; dx++) {
      peak = Math.max(peak, at(x0 + dx, y0 + dy));
    }
  }

  const means = sums
    .map((sum, i) => (counts[i] > 0 ? sum / counts[i] : NaN))
    .filter((m) => !Number.isNaN(m))
    .sort((a, b) => a - b);

  if (means.length === 0) {
    return 0;
  }

  const background = means[means.length >> 1];

  return (means[means.length - 1] - means[0]) / Math.max(1, peak - background);
};
