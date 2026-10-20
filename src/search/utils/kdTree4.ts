// 4차원 점(quad 해시)의 최근접 이웃 검색용 KD-tree. 점 좌표와 순서를 타입 배열 두 개에 담는
// 암묵적 균형 트리다 (구간 [lo, hi)의 가운데가 노드, 깊이에 따라 나누는 축이 돈다).
// 범용 라이브러리(kd-tree-javascript)는 점·노드마다 객체를 만들어 8만 개에 0.3초·수십 MB가 들었다.

const DIM = 4;

export interface KdTree4 {
  coords: Float64Array; // 점 i의 좌표는 coords[4i .. 4i+3]
  order: Int32Array; // 트리 배치 순서의 점 번호
}

export interface Neighbor {
  index: number;
  distance: number; // 제곱 거리
}

// order[lo..hi)에서 nth번째가 axis 기준으로 제자리에 오게 나눈다 (quickselect)
const select = (
  coords: Float64Array,
  order: Int32Array,
  lo: number,
  hi: number,
  nth: number,
  axis: number,
) => {
  let left = lo;
  let right = hi - 1;

  while (left < right) {
    const pivot = coords[order[(left + right) >> 1] * DIM + axis];
    let i = left;
    let j = right;

    while (i <= j) {
      while (coords[order[i] * DIM + axis] < pivot) {
        i++;
      }

      while (coords[order[j] * DIM + axis] > pivot) {
        j--;
      }

      if (i <= j) {
        const t = order[i];
        order[i] = order[j];
        order[j] = t;
        i++;
        j--;
      }
    }

    if (nth <= j) {
      right = j;
    } else if (nth >= i) {
      left = i;
    } else {
      return;
    }
  }
};

export const buildKdTree4 = (coords: Float64Array): KdTree4 => {
  const n = coords.length / DIM;
  const order = new Int32Array(n);

  for (let i = 0; i < n; i++) {
    order[i] = i;
  }

  // 재귀 대신 스택으로 (깊이는 log n이지만 함수 호출을 줄인다)
  const stack: number[] = [0, n, 0];

  while (stack.length) {
    const depth = stack.pop()!;
    const hi = stack.pop()!;
    const lo = stack.pop()!;

    if (hi - lo <= 1) {
      continue;
    }

    const mid = (lo + hi) >> 1;
    select(coords, order, lo, hi, mid, depth % DIM);
    stack.push(lo, mid, depth + 1, mid + 1, hi, depth + 1);
  }

  return { coords, order };
};

// q에서 가장 가까운 k개 (제곱 거리 오름차순)
export const nearestK = (
  tree: KdTree4,
  q: ArrayLike<number>,
  k: number,
): Neighbor[] => {
  const { coords, order } = tree;
  const best: Neighbor[] = [];
  const worst = () =>
    best.length < k ? Infinity : best[best.length - 1].distance;

  const visit = (lo: number, hi: number, depth: number) => {
    if (lo >= hi) {
      return;
    }

    const mid = (lo + hi) >> 1;
    const p = order[mid];
    const base = p * DIM;
    let d = 0;

    for (let a = 0; a < DIM; a++) {
      const t = q[a] - coords[base + a];
      d += t * t;
    }

    if (d < worst()) {
      // 정렬을 유지하며 넣는다 (k는 한 자리 수)
      let at = best.length;

      while (at > 0 && best[at - 1].distance > d) {
        at--;
      }

      best.splice(at, 0, { index: p, distance: d });

      if (best.length > k) {
        best.pop();
      }
    }

    const axis = depth % DIM;
    const diff = q[axis] - coords[base + axis];
    const [near, far] = diff < 0 ? [lo, mid + 1] : [mid + 1, lo];
    const nearHi = diff < 0 ? mid : hi;
    const farHi = diff < 0 ? hi : mid;
    visit(near, nearHi, depth + 1);

    if (diff * diff < worst()) {
      visit(far, farHi, depth + 1);
    }
  };

  visit(0, order.length, 0);

  return best;
};
