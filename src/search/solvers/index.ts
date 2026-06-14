import type { Solver } from "./types";
import { baselineSolver } from "./baseline";
import { improvedSolver } from "./improved";
import { triangleSolver } from "./triangle";

export * from "./types";
export { baselineSolver } from "./baseline";
export { improvedSolver } from "./improved";
export { triangleSolver } from "./triangle";

// 비교 실행에 등록된 알고리즘들. Geometric Voting(최선A)은 추후 추가된다.
export const solvers: Solver[] = [
  baselineSolver,
  improvedSolver,
  triangleSolver,
];
