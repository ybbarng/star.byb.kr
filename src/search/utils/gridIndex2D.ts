// 2차원 점들의 k-최근접 검색용 격자 인덱스.
// 점이 많고(수십만~백만) 좌표 범위가 좁을 때, KD-Tree보다 구축이 훨씬 빠르다
// (정렬 대신 칸별 개수 세기 한 번). 검색 결과는 전수 검색과 같은 정확한 k-최근접이다.

export interface GridIndex2D {
  xs: Float64Array;
  ys: Float64Array;
  gridSize: number; // 한 축의 칸 수
  minX: number;
  minY: number;
  cellW: number;
  cellH: number;
  cellStart: Int32Array; // 칸 c의 점들은 order[cellStart[c] .. cellStart[c+1])
  order: Int32Array; // 칸 순서로 정렬한 점 번호
}

const cellCoord = (v: number, min: number, size: number, n: number): number =>
  Math.min(n - 1, Math.max(0, Math.floor((v - min) / size)));

// 점 하나당 평균 pointsPerCell개가 들어가도록 칸 수를 정한다.
export const buildGridIndex2D = (
  xs: Float64Array,
  ys: Float64Array,
  pointsPerCell = 16,
): GridIndex2D => {
  const count = xs.length;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < count; i++) {
    minX = Math.min(minX, xs[i]);
    maxX = Math.max(maxX, xs[i]);
    minY = Math.min(minY, ys[i]);
    maxY = Math.max(maxY, ys[i]);
  }

  const gridSize = Math.max(
    1,
    Math.ceil(Math.sqrt(Math.max(1, count) / pointsPerCell)),
  );
  // 범위가 0이어도 나눗셈이 되도록 아주 작은 폭을 둔다
  const cellW = Math.max(maxX - minX, 1e-12) / gridSize;
  const cellH = Math.max(maxY - minY, 1e-12) / gridSize;

  const cellOf = new Int32Array(count);
  const cellStart = new Int32Array(gridSize * gridSize + 1);

  for (let i = 0; i < count; i++) {
    const c =
      cellCoord(ys[i], minY, cellH, gridSize) * gridSize +
      cellCoord(xs[i], minX, cellW, gridSize);
    cellOf[i] = c;
    cellStart[c + 1]++;
  }

  for (let c = 0; c < gridSize * gridSize; c++) {
    cellStart[c + 1] += cellStart[c];
  }

  const fill = cellStart.slice(0, gridSize * gridSize);
  const order = new Int32Array(count);

  for (let i = 0; i < count; i++) {
    order[fill[cellOf[i]]++] = i;
  }

  return { xs, ys, gridSize, minX, minY, cellW, cellH, cellStart, order };
};

// (qx, qy)에서 가까운 순으로 k개 점 번호. 질의 칸에서 바깥 고리로 넓혀 가며,
// 다음 고리의 어떤 점도 지금 k번째보다 가까울 수 없으면 멈춘다.
export const nearestInGrid = (
  index: GridIndex2D,
  qx: number,
  qy: number,
  k: number,
): number[] => {
  const { xs, ys, gridSize: n, cellStart, order } = index;
  const qcx = cellCoord(qx, index.minX, index.cellW, n);
  const qcy = cellCoord(qy, index.minY, index.cellH, n);
  const ringStep = Math.min(index.cellW, index.cellH);

  // 거리 오름차순으로 유지하는 상위 k개
  const ids: number[] = [];
  const dists: number[] = [];

  const consider = (cx: number, cy: number) => {
    if (cx < 0 || cy < 0 || cx >= n || cy >= n) {
      return;
    }

    const c = cy * n + cx;

    for (let p = cellStart[c]; p < cellStart[c + 1]; p++) {
      const i = order[p];
      const dx = xs[i] - qx;
      const dy = ys[i] - qy;
      const d = dx * dx + dy * dy;

      if (ids.length === k && d >= dists[k - 1]) {
        continue;
      }

      let pos = ids.length === k ? k - 1 : ids.length;

      while (pos > 0 && dists[pos - 1] > d) {
        pos--;
      }

      ids.splice(pos, 0, i);
      dists.splice(pos, 0, d);

      if (ids.length > k) {
        ids.pop();
        dists.pop();
      }
    }
  };

  for (let r = 0; r <= n; r++) {
    if (r === 0) {
      consider(qcx, qcy);
    } else {
      for (let x = qcx - r; x <= qcx + r; x++) {
        consider(x, qcy - r);
        consider(x, qcy + r);
      }

      for (let y = qcy - r + 1; y <= qcy + r - 1; y++) {
        consider(qcx - r, y);
        consider(qcx + r, y);
      }
    }

    // 고리 r+1에 있는 점까지의 거리는 적어도 r칸만큼이다
    const bound = r * ringStep;

    if (ids.length === k && dists[k - 1] <= bound * bound) {
      break;
    }
  }

  return ids;
};
