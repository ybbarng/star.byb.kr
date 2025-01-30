import { create } from "zustand";

interface StepsState {
  steps: string[];
  current: number;
  moveToPrev: () => void;
  moveToNext: () => void;
}

export const useStepsStore = create<StepsState>()((set) => ({
  steps: ["사진 선택", "별 감지", "Plate Solving"],
  current: 0,
  moveToPrev: () =>
    set((state) => {
      const minStep = 0;

      if (state.current <= minStep) {
        return { current: minStep };
      }

      return {
        current: state.current - 1,
      };
    }),
  moveToNext: () =>
    set((state) => {
      const maxStep = state.steps.length - 1;

      if (state.current >= maxStep) {
        return { current: maxStep };
      }

      return {
        current: state.current + 1,
      };
    }),
}));
