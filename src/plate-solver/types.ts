import type { Point2D } from "@/scripts/hash/types";

export interface PhotoStars {
  x: number;
  y: number;
  brightness: number;
  ringContrast?: number; // 별다움 (detectCore.ringContrast)
  trail?: boolean; // 별 궤적 점 (detectCore.findTrails)
}

// 사진 위에 사람이(또는 자동으로) 찍은 지평선 두 점과 달
export interface EstimateMarks {
  horizon: Point2D[]; // 최대 2개
  horizonAuto?: boolean; // 자동으로 찾은 지평선이면 true (사람이 다시 찍으면 false)
  moon: Point2D | null;
}

export const NO_MARKS: EstimateMarks = { horizon: [], moon: null };

// 화면: 사진 고르기 → 별자리 찾기(자동). 필요할 때만 별 고치기(별·지평선·달 찍기)로 갔다 온다.
export type SolverView = "select" | "solve" | "edit";

// 별 고치기 화면의 도구
export type EditTool = "select" | "move" | "horizon" | "moon";
