import { create } from "zustand";
import { PhotoStars } from "@/plate-solver/types";

interface ContextState {
  image?: HTMLImageElement;
  photoStars: PhotoStars[];
  setImage: (image: HTMLImageElement) => void;
  setPhotoStars: (photoStars: PhotoStars[]) => void;
}

export const useContextStore = create<ContextState>((set) => ({
  file: undefined,
  photoStars: [],
  setImage: (image: HTMLImageElement) =>
    set((state) => {
      return {
        ...state,
        image,
      };
    }),
  setPhotoStars: (photoStars: PhotoStars[]) =>
    set((state) => {
      return {
        ...state,
        photoStars,
      };
    }),
}));
