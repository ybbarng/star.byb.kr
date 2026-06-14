export interface DetectedStar {
  cx: number;
  cy: number;
  brightness: number; // 유효 반경 (밝은 별일수록 큼)
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

  // 3단계: weighted centroid (서브픽셀)
  return merged.map((star) => {
    const centroidRadius = Math.max(2, Math.ceil(star.effectiveRadius));
    let sumW = 0;
    let sumWx = 0;
    let sumWy = 0;

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
      }
    }

    return {
      cx: sumW > 0 ? sumWx / sumW : star.x,
      cy: sumW > 0 ? sumWy / sumW : star.y,
      brightness: star.effectiveRadius,
    };
  });
};
