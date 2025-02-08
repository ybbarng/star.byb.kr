"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useContextStore } from "@/plate-solver/store/context";
import cv from "@/services/cv";
import samples from "@/services/samples";

/**
 * DetectStarStepForDemo는 Konva 쓰고 있어서, 서버 렌더링을 사용할 수 없습니다.
 */
const DetectStarStepForDemo = dynamic(
  () => import("@/app/demo/detect-stars/DetectStarsStepForDemo"),
  {
    ssr: false,
  },
);

export default function Page() {
  const image = useContextStore((state) => state.image);
  const setImage = useContextStore((state) => state.setImage);

  useEffect(() => {
    const init = async () => {
      await cv.load();

      // 버즈빌 은하수 샘플 이미지
      const selectedSampleId = 2;
      const selectedSample = samples[selectedSampleId];
      const image = new Image();
      image.src = selectedSample.src;
      setImage(image);
    };

    init();
  }, []);

  return (
    <div className="size-full p-8">
      <div className="flex size-full flex-col gap-6">
        <div className="flex-1 overflow-hidden">
          {image && <DetectStarStepForDemo />}
        </div>
      </div>
    </div>
  );
}
