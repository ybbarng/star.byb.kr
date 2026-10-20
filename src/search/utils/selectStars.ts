import type { Point2D } from "@/scripts/hash/types";
import type { ImageSize, InputStar } from "@/search/solvers/types";
import { findAlignedStars } from "@/search/utils/alignment";

// 매칭에 쓸 별을 고르는 전략들. quad 생성은 C(N,4)라 N을 제한해야 한다.

// 서로 minDistPx보다 가까운 검출은 하나로 본다(밝은 것만 남김). 검출 NMS가
// 작은 별에선 억제 반경이 작아 거의 같은 위치의 중복이 남는데, 이런 별쌍은
// 매칭의 tolerance 안이라 같은 카탈로그 별에 양쪽이 경쟁해 inlier를 왜곡하고
// quad/삼각형 형태를 흐린다. 밝기순으로 훑으며 이미 채택된 별과 너무 가까우면 버린다.
export const mergeCloseStars = <
  T extends { x: number; y: number; brightness: number },
>(
  stars: T[],
  minDistPx: number,
): T[] => {
  const min2 = minDistPx * minDistPx;
  const kept: T[] = [];

  for (const s of [...stars].sort((a, b) => b.brightness - a.brightness)) {
    let tooClose = false;

    for (const k of kept) {
      const dx = s.x - k.x;
      const dy = s.y - k.y;

      if (dx * dx + dy * dy < min2) {
        tooClose = true;
        break;
      }
    }

    if (!tooClose) {
      kept.push(s);
    }
  }

  return kept;
};

// 검출 단계에서 가까운 중복을 합치는 거리. 매칭 tolerance(대각선×0.006)보다 살짝 작다.
export const mergeDistancePx = (width: number, height: number): number =>
  Math.max(6, Math.hypot(width, height) * 0.005);

// 주변 고리 대비(ringContrast)가 이 값보다 작으면 별답다고 본다. 14장 실제 샘플에서
// 진짜 별은 중앙값 0.02~0.19, 거짓 검출(창문·경계선·줄기)은 0.3~1.6이었다. 0.08~0.2에서 결과가 비슷하다.
export const STARLIKE_RING_CONTRAST = 0.12;

export const isStarlike = (s: {
  ringContrast?: number;
  aligned?: boolean;
}): boolean =>
  !s.aligned &&
  (s.ringContrast === undefined || s.ringContrast < STARLIKE_RING_CONTRAST);

// 풀이에 쓸 우선순위: 별다운 검출 먼저, 그 안에서는 밝은 순.
// 밝기만 보면 조명 받은 창문·나무 줄기·지붕 경계선이 진짜 별보다 앞에 온다.
type Prioritized = {
  brightness: number;
  ringContrast?: number;
  aligned?: boolean;
};

export const byStarPriority = (a: Prioritized, b: Prioritized): number =>
  Number(isStarlike(b)) - Number(isStarlike(a)) || b.brightness - a.brightness;

// 우선순위 상위 검출 중 한 직선에 줄지은 것을 표시하고(aligned), 다시 우선순위 순으로 정렬한다.
// 점 하나는 별처럼 생겨도 줄지어 있으면 비행기 불빛·창문 줄일 가능성이 높아 뒤로 민다.
export const rankForSolving = <
  T extends Prioritized & { x: number; y: number },
>(
  stars: T[],
  width: number,
  height: number,
): T[] => {
  const sorted = [...stars].sort(byStarPriority);
  const aligned = findAlignedStars(sorted, width, height);

  return sorted
    .map((s, i) => (aligned.has(i) ? { ...s, aligned: true } : s))
    .sort(byStarPriority);
};

// 검출 단계가 화면에 기본으로 띄우고 풀이에 넘기는 별 수(밝기 상위).
// 전부 그리면 노이즈 마커가 진짜 별을 가린다.
export const DEFAULT_DISPLAY_STARS = 100;

// 우선순위(별다움 → 밝기) 상위 N개.
export const selectTopByPriority = (stars: InputStar[], n: number): Point2D[] =>
  [...stars]
    .sort(byStarPriority)
    .slice(0, n)
    .map((s) => [s.x, s.y]);

// 화면을 격자로 나눠 각 셀에서 우선순위 상위 perCell개씩 고른 뒤 합쳐 maxTotal개 (최선 방식).
// 가짜 별이 한 영역에 몰려도 다른 영역의 진짜 별을 확보해 quad가 화면 전체를 덮는다.
export const selectByGrid = (
  stars: InputStar[],
  size: ImageSize,
  gridX: number,
  gridY: number,
  perCell: number,
  maxTotal: number,
): Point2D[] => {
  const cells = new Map<string, InputStar[]>();

  for (const s of stars) {
    const gx = Math.min(
      gridX - 1,
      Math.max(0, Math.floor((s.x / size.width) * gridX)),
    );
    const gy = Math.min(
      gridY - 1,
      Math.max(0, Math.floor((s.y / size.height) * gridY)),
    );
    const key = `${gx},${gy}`;
    const cell = cells.get(key);

    if (cell) {
      cell.push(s);
    } else {
      cells.set(key, [s]);
    }
  }

  const picked: InputStar[] = [];

  for (const cell of cells.values()) {
    cell.sort(byStarPriority);
    picked.push(...cell.slice(0, perCell));
  }

  return picked
    .sort(byStarPriority)
    .slice(0, maxTotal)
    .map((s) => [s.x, s.y]);
};
