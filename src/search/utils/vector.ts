import { Point2D, Point3D } from "@/scripts/hash/types";

export const toCartesian = (vector: Point3D): Point2D => {
  return [vector[0] / vector[2], vector[1] / vector[2]];
};
