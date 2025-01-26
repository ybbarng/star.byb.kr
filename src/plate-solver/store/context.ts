import { create } from "zustand";

interface ContextState {
  image?: HTMLImageElement;
  setImage: (image: HTMLImageElement) => void;
}

export const useContextStore = create<ContextState>((set) => ({
  file: undefined,
  setImage: (image: HTMLImageElement) =>
    set((state) => {
      return {
        ...state,
        image,
      };
    }),
}));
