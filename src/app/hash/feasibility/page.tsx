"use client";

import Graph from "@/app/hash/feasibility/components/Graph";
import { GraphType } from "@/app/hash/feasibility/hooks/useThreeData";

// 해시 타당성 시각화: 카탈로그 quad 해시를 세 축 평면(XYZ·YZX)에 뿌려 본다 (발표 데모)
export default function Page() {
  return (
    <div className="flex flex-col items-start gap-5 p-4">
      <div className="columns-2">
        <Graph graphType={GraphType.XYZ} />
        <Graph graphType={GraphType.YZX} />
      </div>
    </div>
  );
}
