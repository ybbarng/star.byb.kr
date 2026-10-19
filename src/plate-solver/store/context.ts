import { create } from "zustand";
import { PhotoStars } from "@/plate-solver/types";

interface ContextState {
  image?: HTMLImageElement;
  photoStars: PhotoStars[]; // 화면에 표시한(사람이 고친) 별
  // 화면에 띄우지 않은 나머지 자동 검출(밝기순). 사람이 마커를 고치지 않았을 때만 채운다.
  // 풀이가 지면을 뺀 위쪽 영역에서 별을 다시 고를 때 쓴다.
  hiddenStars: PhotoStars[];
  setImage: (image: HTMLImageElement) => void;
  setPhotoStars: (photoStars: PhotoStars[], hiddenStars?: PhotoStars[]) => void;
}

export const useContextStore = create<ContextState>((set) => ({
  file: undefined,
  photoStars: [],
  hiddenStars: [],
  setImage: (image: HTMLImageElement) =>
    set((state) => {
      return {
        ...state,
        image,
        photoStars: [],
        hiddenStars: [],
      };
    }),
  setPhotoStars: (photoStars: PhotoStars[], hiddenStars: PhotoStars[] = []) =>
    set((state) => {
      return {
        ...state,
        photoStars,
        hiddenStars,
      };
    }),
}));
