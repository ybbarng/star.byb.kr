"use client";

import { useState } from "react";
import { kmPerDegLon } from "@/learn/basics/skyMath";

// 시계가 틀린 만큼 경도가 틀린다: 4분 = 1°. 그 1°가 몇 km인지는 위도에 따라 다르다
export default function LongitudeErrorDemo() {
  const [minutes, setMinutes] = useState(4);
  const deg = minutes / 4;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <label className="flex items-center gap-3">
        <span className="w-28 shrink-0">
          시계 오차 <b>{minutes}분</b>
        </span>
        <input
          type="range"
          className="range range-xs flex-1"
          min={0}
          max={60}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
        />
      </label>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-base-300/50 rounded-box p-2">
          <div className="text-xs opacity-60">경도 오차</div>
          <div className="font-black">{deg.toFixed(2)}°</div>
        </div>
        <div className="bg-base-300/50 rounded-box p-2">
          <div className="text-xs opacity-60">적도에서</div>
          <div className="font-black">
            {Math.round(deg * kmPerDegLon(0)).toLocaleString("ko-KR")}km
          </div>
        </div>
        <div className="bg-base-300/50 rounded-box p-2">
          <div className="text-xs opacity-60">서울 위도에서</div>
          <div className="font-black">
            {Math.round(deg * kmPerDegLon(37.57)).toLocaleString("ko-KR")}km
          </div>
        </div>
      </div>
    </div>
  );
}
