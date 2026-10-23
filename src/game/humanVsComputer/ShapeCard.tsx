"use client";

import { useEffect, useRef } from "react";
import { constellationShape } from "@/game/humanVsComputer/rounds";

// 보기 카드의 별자리 모양: 북쪽이 위인 별자리선 (사진 속 모양은 돌아가 있을 수 있다)
const W = 200;
const H = 130;

export default function ShapeCard({
  label,
  color = "rgba(250,220,80,0.9)",
}: {
  label: string;
  color?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");

    if (!ctx) {
      return;
    }

    const parts = constellationShape(label);
    const all = parts.flat();
    ctx.clearRect(0, 0, W, H);

    if (all.length === 0) {
      return;
    }

    const xs = all.map((p) => p[0]);
    const ys = all.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const spanX = Math.max(...xs) - minX || 1e-3;
    const spanY = Math.max(...ys) - minY || 1e-3;
    const k = 0.82 * Math.min(W / spanX, H / spanY);
    const ox = (W - spanX * k) / 2;
    const oy = (H - spanY * k) / 2;
    const map = ([x, y]: [number, number]): [number, number] => [
      ox + (x - minX) * k,
      oy + (y - minY) * k,
    ];

    ctx.strokeStyle = color;
    ctx.fillStyle = "white";
    ctx.lineWidth = 1.6;

    for (const part of parts) {
      ctx.beginPath();
      part
        .map(map)
        .forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();

      for (const [x, y] of part.map(map)) {
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [label, color]);

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      className="rounded-box block w-full bg-[#0b1020]"
    />
  );
}
