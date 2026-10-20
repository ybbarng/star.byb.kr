"use client";

import { useState } from "react";

// 위도와 하늘의 기울기: 천구의 극은 지평선에서 위도만큼 떠 있고, 하늘은 극을 축으로 돈다.
// 그래서 사진의 지평선과 별들의 방향을 알면 위도를, 그 순간 머리 위에 있는 하늘로 하늘 시계를 안다.

const W = 320;
const H = 200;
const CX = 160;
const CY = 150;
const R = 120;
const D = Math.PI / 180;

const PLACES = [
  { lat: 37.6, name: "서울" },
  { lat: 15.2, name: "사이판" },
  { lat: -33.9, name: "시드니" },
  { lat: 64.1, name: "레이캬비크" },
];

export default function PoleHeightDemo() {
  const [lat, setLat] = useState(37.6);
  const north = lat >= 0;
  const alt = Math.abs(lat) * D;
  // 북쪽을 오른쪽에 둔다 (남반구면 남극이 왼쪽 위로)
  const dir = north ? 1 : -1;
  const pole = { x: CX + dir * R * Math.cos(alt), y: CY - R * Math.sin(alt) };
  // 극을 도는 별들의 길 (적위 60°·75°)
  const circles = [15, 30].map((r) => r * D);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex flex-1 items-center gap-3">
          위도 {lat.toFixed(1)}°
          <input
            type="range"
            className="range range-xs flex-1"
            min={-60}
            max={70}
            step={0.1}
            value={lat}
            onChange={(e) => setLat(Number(e.target.value))}
          />
        </label>
        {PLACES.map((p) => (
          <button
            key={p.name}
            className="btn btn-xs"
            onClick={() => setLat(p.lat)}
          >
            {p.name}
          </button>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="rounded-box w-full bg-[#0b0f22]"
      >
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="rgba(70,90,180,0.12)"
          stroke="rgba(165,180,252,0.3)"
        />
        <rect
          x="0"
          y={CY}
          width={W}
          height={H - CY}
          fill="rgba(30,40,30,0.9)"
        />
        <line
          x1="0"
          y1={CY}
          x2={W}
          y2={CY}
          stroke="#86efac"
          strokeWidth="1.5"
        />
        <text
          x={CX + R - 4}
          y={CY + 16}
          fontSize="10"
          fill="white"
          opacity="0.7"
          textAnchor="end"
        >
          {north ? "북" : "남"}
        </text>
        <text
          x={CX - R + 4}
          y={CY + 16}
          fontSize="10"
          fill="white"
          opacity="0.7"
        >
          {north ? "남" : "북"}
        </text>
        {circles.map((c, i) => (
          <ellipse
            key={i}
            cx={pole.x}
            cy={pole.y}
            rx={R * Math.sin(c)}
            ry={R * Math.sin(c) * 0.35}
            transform={`rotate(${-dir * (90 - Math.abs(lat))} ${pole.x} ${pole.y})`}
            fill="none"
            stroke="rgba(253,230,138,0.45)"
            strokeDasharray="3 3"
          />
        ))}
        <line
          x1={CX}
          y1={CY}
          x2={pole.x}
          y2={pole.y}
          stroke="#fde68a"
          strokeWidth="1.5"
        />
        <path
          d={`M ${CX + dir * 36} ${CY} A 36 36 0 0 ${north ? 0 : 1} ${CX + dir * 36 * Math.cos(alt)} ${CY - 36 * Math.sin(alt)}`}
          fill="none"
          stroke="white"
          strokeOpacity="0.7"
        />
        <text
          x={CX + dir * 44}
          y={CY - 8}
          fontSize="11"
          fill="white"
          textAnchor={north ? "start" : "end"}
        >
          {Math.abs(lat).toFixed(0)}°
        </text>
        <circle cx={pole.x} cy={pole.y} r="5" fill="#fde68a" />
        <text
          x={pole.x + dir * 8}
          y={pole.y - 8}
          fontSize="11"
          fill="#fde68a"
          textAnchor={north ? "start" : "end"}
        >
          {north ? "북극성 (천구 북극)" : "천구 남극"}
        </text>
        <circle cx={CX} cy={CY} r="4" fill="white" />
      </svg>
      <p className="text-xs opacity-70">
        천구의 극은 지평선에서 <b>위도만큼</b> 떠 있어요. 서울에서는 북극성이
        37° 높이에, 적도에서는 지평선에 붙고, 남반구에서는 보이지 않아요. 하늘은
        이 극을 축으로 하루에 한 바퀴 돌아요.
      </p>
    </div>
  );
}
