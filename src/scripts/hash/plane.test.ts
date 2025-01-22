import { expect, test } from "vitest";
import * as plane from "./plane";
import { Point2D, Point3D } from "./types";

class Point2DArrayComparator {
  public points: Point2D[];

  constructor(points: Point2D[]) {
    this.points = points;
  }

  equals(other: Point2DArrayComparator): boolean {
    const tolerance = 1e-6;

    return this.points.every((thisPoint2DArrayi, i) => {
      return thisPoint2DArrayi.every(
        (thisPoint2DArrayij, j) =>
          Math.abs(thisPoint2DArrayij - other.points[i][j]) < tolerance,
      );
    });
  }
}

function isPoint2DArrayComparator(a: unknown): a is Point2DArrayComparator {
  return a instanceof Point2DArrayComparator;
}

function arePoint2DArraysEqual(a: unknown, b: unknown): boolean | undefined {
  const isAPoint2DArrayComparator = isPoint2DArrayComparator(a);
  const isBPoint2DArrayComparator = isPoint2DArrayComparator(b);

  if (isAPoint2DArrayComparator && isBPoint2DArrayComparator) {
    return (a as Point2DArrayComparator).equals(b);
  } else if (isAPoint2DArrayComparator === isBPoint2DArrayComparator) {
    return undefined;
  } else {
    return false;
  }
}

expect.addEqualityTesters([arePoint2DArraysEqual]);

test("projectToTangentPlane()", () => {
  const given: Point3D[] = [
    [-0.4591115674024834, 0.11504758911126119, 0.8808976222677193],
    [-0.5359150995023587, 0.1389921440572375, 0.832752178031225],
    [-0.5918728610028255, 0.015938076508263857, 0.8058737457725911],
    [-0.5429309331397354, -0.03660080679866315, 0.8389793696996983],
  ];

  // 과거 계산에서 나왔던 값으로 동차 좌표입니다.
  const expectedH: Point3D[] = [
    [-0.05319170051932333, 0.08641597298549719, 0.9948381388994054],
    [-0.08095038548270216, -0.003116408779236912, 0.9967132602140512],
    [0.039547713112145666, -0.07002104735658571, 0.996761270974493],
    [0.09459437288987987, -0.013278516849674682, 0.9954273381858886],
  ];

  // 새로운 로직에서는 동차 좌표를 2차원 좌표로 변환하여 사용하므로, 미리 변환합니다.
  const expected: Point2D[] = expectedH.map((hPoint: Point3D) =>
    plane.toCartesian(hPoint),
  );

  const result = plane.projectToTangentPlane(given);
  expect(result).toHaveLength(4);

  expect(new Point2DArrayComparator(result)).toEqual(
    new Point2DArrayComparator(expected),
  );
});
