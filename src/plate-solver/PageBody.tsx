"use client";

import dynamic from "next/dynamic";
import ChooseCandidateStep from "@/plate-solver/ChooseCandidateStep";
import SelectPhotoStep from "@/plate-solver/SelectPhotoStep";
import { useStepsStore } from "@/plate-solver/store/steps";

/**
 * DetectStarStep은 Konva 쓰고 있어서, 서버 렌더링을 사용할 수 없습니다.
 */
const DetectStarStep = dynamic(() => import("@/plate-solver/DetectStarsStep"), {
  ssr: false,
});

export default function PageBody() {
  const current = useStepsStore((state) => state.current);

  const StepPage = StepPages[current];

  return (
    <>
      <StepPage />
    </>
  );
}

const StepPages = [SelectPhotoStep, DetectStarStep, ChooseCandidateStep];
