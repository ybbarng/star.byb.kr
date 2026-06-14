import type { Solver } from "./types";
import { baselineSolver } from "./baseline";
import { improvedSolver } from "./improved";

export * from "./types";
export { baselineSolver } from "./baseline";
export { improvedSolver } from "./improved";

// 비교 실행에 등록된 알고리즘들. 최선(voting·triangle)은 추후 추가된다.
export const solvers: Solver[] = [baselineSolver, improvedSolver];
