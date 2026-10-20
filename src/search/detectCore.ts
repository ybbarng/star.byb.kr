export interface DetectedStar {
  cx: number;
  cy: number;
  brightness: number; // 유효 반경 (밝은 별일수록 큼)
  elongation: number; // 1=원형, 클수록 길쭉 (물결 반사광/궤적은 큼)
  fwhm: number; // 밝기 분포 크기(px)
  ringContrast?: number; // 별다움 (ringContrast, 회색조 영상을 줄 때만)
}

// 별 검출의 순수 JS 부분 (cv.worker.js findStars에서 포팅).
// 입력은 차영상 diff = grayscale - blur (음수 클램프, 1채널). OpenCV에 의존하는
// grayscale/blur/subtract는 호출 측에서(브라우저는 OpenCV, node는 sharp) 만든다.
// 적응적 threshold(mean+3σ) → local maxima → 유효 반경 → NMS → weighted centroid.
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
  return merged.map((star) => {
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
      brightness: star.effectiveRadius,
      elongation,
      fwhm,
    };
  });
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
// public/js/cv.worker.js에 같은 계산을 옮겨 두었다 — 바꿀 때 둘을 같이 바꾼다.
export const ringContrast = (
  gray: Uint8Array | Uint8ClampedArray,
  cols: number,
  rows: number,
  star: { cx: number; cy: number; brightness: number },
  channels = 1,
): number => {
  const unit = Math.max(1, Math.hypot(cols, rows) / 1400);
  // 반지름은 0.5px 단위로 맞춰 고리 목록을 재사용한다
  const r1 = Math.round((3 * unit + star.brightness) * 2) / 2;
  const r2 = Math.round((6 * unit + star.brightness * 1.5) * 2) / 2;
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
