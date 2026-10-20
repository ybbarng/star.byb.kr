// 여러 검출이 한 직선 위에 줄지어 있는지 찾는다.
// 비행기의 깜빡이는 불빛(점선), 건물 창문의 가로·세로 줄, 해안선 불빛은 점 하나하나는 별처럼
// 생겨서 주변 고리 대비(ringContrast)로는 못 거른다. 대신 여럿이 1~2px 오차로 한 줄에 선다.
// 진짜 별도 우연히 3개쯤은 늘어설 수 있지만(오리온 허리띠), 5개 이상은 드물다.

// 한 직선 위에 이만큼 이상 모이면 줄지은 검출로 본다
export const MIN_ALIGNED_POINTS = 5;

// 줄 위 점들의 간격이 규칙적인가: 모든 간격이 기준 간격의 정수배(±15%)이고, 기준 간격 그대로인
// 간격이 둘 이상이어야 한다. 비행기 불빛은 같은 간격으로 깜빡이고, 창문은 꺼진 창문 자리만큼
// 정수배로 벌어진다. 별이 빽빽한 사진에서 우연히 한 줄에 선 별들은 간격이 제멋대로라 여기서 빠진다.
// 배수는 MAX_GAP_MULTIPLE까지만 인정한다: 허용 오차가 배수에 비례해 커져서, 큰 배수면 아무 간격이나
// 정수배가 된다 (사이판 사진에서 바다 불빛 기둥 + 잡음 + 진짜 별 하나가 12px의 9~12배 간격으로 묶였다).
const MAX_GAP_MULTIPLE = 4;

const isRegularlySpaced = (positions: number[]): boolean => {
  const gaps = positions
    .slice(1)
    .map((t, i) => t - positions[i])
    .filter((g) => g > 1e-6);

  if (gaps.length < MIN_ALIGNED_POINTS - 1) {
    return false;
  }

  const base = Math.min(...gaps);
  let unitGaps = 0;

  for (const g of gaps) {
    const ratio = g / base;
    const multiple = Math.round(ratio);

    if (
      multiple > MAX_GAP_MULTIPLE ||
      Math.abs(ratio - multiple) > 0.15 * multiple
    ) {
      return false;
    }

    if (multiple === 1) {
      unitGaps++;
    }
  }

  return unitGaps >= 2;
};

// 상위 candidates개 검출 중에서 줄지은 것의 번호를 돌려준다.
// 두 점을 잇는 직선마다 허용오차 안에 드는 점을 센다 (O(N³), N은 수백 이하).
export const findAlignedStars = (
  stars: { x: number; y: number }[],
  width: number,
  height: number,
  candidates = 400,
): Set<number> => {
  const n = Math.min(stars.length, candidates);
  const unit = Math.max(1, Math.hypot(width, height) / 1400);
  const tol = 1.5 * unit; // 직선에서 벗어나도 되는 거리(px)
  // 줄의 이웃 간격 상한: 사진 대각선의 8%보다 먼 두 점은 같은 줄로 묶지 않는다
  const maxGap = Math.hypot(width, height) * 0.08;
  const aligned = new Set<number>();

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = stars[j].x - stars[i].x;
      const dy = stars[j].y - stars[i].y;
      const len = Math.hypot(dx, dy);

      if (len === 0 || len > maxGap) {
        continue;
      }

      const ux = dx / len;
      const uy = dy / len;
      // 직선 위 점들의 위치(직선 방향 좌표)
      const along: { t: number; k: number }[] = [];

      for (let k = 0; k < n; k++) {
        const px = stars[k].x - stars[i].x;
        const py = stars[k].y - stars[i].y;

        if (Math.abs(px * uy - py * ux) <= tol) {
          along.push({ t: px * ux + py * uy, k });
        }
      }

      if (along.length < MIN_ALIGNED_POINTS) {
        continue;
      }

      // i를 포함하는, 이웃 간격이 maxGap 이하로 이어진 구간만 한 줄로 본다
      along.sort((a, b) => a.t - b.t);

      const at = along.findIndex((p) => p.k === i);
      let lo = at;
      let hi = at;

      while (lo > 0 && along[lo].t - along[lo - 1].t <= maxGap) {
        lo--;
      }

      while (hi < along.length - 1 && along[hi + 1].t - along[hi].t <= maxGap) {
        hi++;
      }

      if (
        hi - lo + 1 >= MIN_ALIGNED_POINTS &&
        isRegularlySpaced(along.slice(lo, hi + 1).map((p) => p.t))
      ) {
        for (let m = lo; m <= hi; m++) {
          aligned.add(along[m].k);
        }
      }
    }
  }

  return aligned;
};
