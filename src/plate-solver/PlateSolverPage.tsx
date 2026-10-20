"use client";

import { useEffect } from "react";
import PageBody from "@/plate-solver/PageBody";
import { preloadDetector } from "@/search/detectClient";
import { preloadSolver } from "@/search/solverClient";

export default function PlateSolverPage() {
  useEffect(() => {
    preloadDetector();
    // 풀이 인덱스 만들기를 사진을 고르는 동안 미리 해 둔다.
    // 실패하면 풀이 단계에서 다시 시도하며 오류를 보여 준다.
    preloadSolver().catch(() => {});
  }, []);

  return <PageBody />;
}
