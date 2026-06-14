import type { Solver } from "./types";
import { baselineSolver } from "./baseline";
import { improvedSolver } from "./improved";
import { triangleSolver } from "./triangle";
import { votingSolver } from "./voting";

export * from "./types";
export { baselineSolver } from "./baseline";
export { improvedSolver } from "./improved";
export { triangleSolver } from "./triangle";
export { votingSolver } from "./voting";

// 비교 실행에 등록된 알고리즘들 (원본 / 개선 / 최선A·B).
export const solvers: Solver[] = [
  baselineSolver,
  improvedSolver,
  votingSolver,
  triangleSolver,
];
