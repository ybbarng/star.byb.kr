"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import PlateSolvingStep from "@/plate-solver/PlateSolvingStep";
import SelectPhotoStep from "@/plate-solver/SelectPhotoStep";
import { useContextStore } from "@/plate-solver/store/context";

/**
 * StarEditor는 Konva를 써서 서버 렌더링을 할 수 없다.
 */
const StarEditor = dynamic(() => import("@/plate-solver/StarEditor"), {
  ssr: false,
});

// 사진 고르기 → 별자리 찾기(자동). 필요할 때만 별 고치기로 갔다 온다.
export default function PageBody() {
  const view = useContextStore((state) => state.view);
  const hasImage = useContextStore((state) => Boolean(state.image));

  // 화면이 바뀌면 맨 위로
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  if (view === "select" || !hasImage) {
    return <SelectPhotoStep />;
  }

  return view === "edit" ? <StarEditor /> : <PlateSolvingStep />;
}
