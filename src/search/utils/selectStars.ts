import type { Point2D } from "@/scripts/hash/types";
import type { ImageSize, InputStar } from "@/search/solvers/types";

// 매칭에 쓸 별을 고르는 전략들. quad 생성은 C(N,4)라 N을 제한해야 한다.

// 밝기 상위 N개 (원본·개선 방식). 가짜 별이 밝으면 진짜 별을 밀어낼 수 있다.
export const selectTopByBrightness = (
  stars: InputStar[],
  n: number,
): Point2D[] =>
  [...stars]
    .sort((a, b) => b.brightness - a.brightness)
    .slice(0, n)
    .map((s) => [s.x, s.y]);

// 화면을 격자로 나눠 각 셀에서 밝기 상위 perCell개씩 고른 뒤 합쳐 maxTotal개 (최선 방식).
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
    cell.sort((a, b) => b.brightness - a.brightness);
    picked.push(...cell.slice(0, perCell));
  }

  return picked
    .sort((a, b) => b.brightness - a.brightness)
    .slice(0, maxTotal)
    .map((s) => [s.x, s.y]);
};
