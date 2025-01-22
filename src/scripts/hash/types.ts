export interface StarVector {
  C?: string; // "Peg"
  Dec: string; // "+13° 23′ 46″"
  F?: string; // "86"
  HR: string; // "4"
  K: string; // "5500"
  RA: string; // "00h 05m 42.0s"
  V: string; // "5.51"
  x: number; // 0.9947729755573012
  y: number; // 0.023160836124704105
  z: number; // -0.09945000136187948
}

export interface Quadrilateral<T> {
  id: string;
  stars: [T, T, T, T];
}

export type Point2D = [number, number];
export type Point3D = [number, number, number];
export type Quadrilateral2D = [Point2D, Point2D, Point2D, Point2D];
export type Hash = [number, number, number, number];
