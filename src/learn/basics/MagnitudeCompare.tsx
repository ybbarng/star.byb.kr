"use client";

import { useState } from "react";
import { brightnessRatio } from "@/learn/basics/skyMath";

// 두 별을 골라 등급 차이 → 밝기 비율을 본다
export interface MagStar {
  name: string;
  mag: number;
}

export default function MagnitudeCompare({ stars }: { stars: MagStar[] }) {
  const [a, setA] = useState(0);
  const [b, setB] = useState(stars.length - 1);
  const diff = stars[b].mag - stars[a].mag;
  const ratio = brightnessRatio(Math.abs(diff));
  const brighter = diff >= 0 ? stars[a] : stars[b];
  const fainter = diff >= 0 ? stars[b] : stars[a];

  const select = (value: number, set: (n: number) => void) => (
    <select
      className="select select-sm min-w-0 flex-1"
      value={value}
      onChange={(e) => set(Number(e.target.value))}
    >
      {stars.map((s, i) => (
        <option key={s.name} value={i}>
          {s.name} ({s.mag.toFixed(2)}등급)
        </option>
      ))}
    </select>
  );

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {select(a, setA)}
        <span className="opacity-60">와</span>
        {select(b, setB)}
      </div>
      <div className="bg-base-300/50 rounded-box p-3">
        등급 차이 <b>{Math.abs(diff).toFixed(2)}</b> →{" "}
        {ratio < 1.05 ? (
          <b>거의 같은 밝기</b>
        ) : (
          <>
            <b>{brighter.name}</b>이(가) <b>{fainter.name}</b>보다 약{" "}
            <b className="text-amber-200">
              {ratio < 10
                ? ratio.toFixed(1)
                : Math.round(ratio).toLocaleString("ko-KR")}
              배
            </b>{" "}
            밝아요.
          </>
        )}
      </div>
    </div>
  );
}
