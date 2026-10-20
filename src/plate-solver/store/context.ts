import type { DetectedStar } from "@/plate-solver/detectPhotoStars";
import type {
  EditTool,
  EstimateMarks,
  PhotoStars,
  SolverView,
} from "@/plate-solver/types";
import { create } from "zustand";
import { NO_MARKS } from "@/plate-solver/types";

interface ContextState {
  image?: HTMLImageElement;
  view: SolverView;
  editTool: EditTool; // 별 고치기 화면을 열 때 고를 도구
  photoStars: PhotoStars[]; // 화면에 표시한(사람이 고친) 별
  // 화면에 띄우지 않은 나머지 자동 검출(밝기순). 사람이 마커를 고치지 않았을 때만 채운다.
  // 풀이가 지면을 뺀 위쪽 영역에서 별을 다시 고를 때 쓴다.
  hiddenStars: PhotoStars[];
  // 자동 검출 전체(풀이 순서). 별 고치기에서 영역 다시 찾기·되돌리기에 쓴다. 비어 있으면 아직 검출 전이다.
  detections: DetectedStar[];
  marks: EstimateMarks;
  setImage: (image: HTMLImageElement) => void;
  setPhotoStars: (photoStars: PhotoStars[], hiddenStars?: PhotoStars[]) => void;
  setDetections: (detections: DetectedStar[]) => void;
  setMarks: (marks: EstimateMarks) => void;
  goTo: (view: SolverView, editTool?: EditTool) => void;
}

export const useContextStore = create<ContextState>((set) => ({
  view: "select",
  editTool: "select",
  photoStars: [],
  hiddenStars: [],
  detections: [],
  marks: NO_MARKS,
  // 사진이 바뀌면 별·찍은 점을 모두 지운다
  setImage: (image: HTMLImageElement) =>
    set({
      image,
      photoStars: [],
      hiddenStars: [],
      detections: [],
      marks: NO_MARKS,
    }),
  setPhotoStars: (photoStars: PhotoStars[], hiddenStars: PhotoStars[] = []) =>
    set({ photoStars, hiddenStars }),
  setDetections: (detections: DetectedStar[]) => set({ detections }),
  setMarks: (marks: EstimateMarks) => set({ marks }),
  goTo: (view: SolverView, editTool: EditTool = "select") =>
    set({ view, editTool }),
}));
