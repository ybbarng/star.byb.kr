"use client";

import DetectStarStep from "@/plate-solver/DetectStarsStep";
import SelectPhotoStep from "@/plate-solver/SelectPhotoStep";
import { useStepsStore } from "@/plate-solver/store/steps";

export default function PageBody() {
  const current = useStepsStore((state) => state.current);

  const StepPage = StepPages[current];

  return (
    <>
      <StepPage />
    </>
  );
}

const StepPages = [SelectPhotoStep, DetectStarStep];
