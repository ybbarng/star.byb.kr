"use client";

import type { Point2D } from "@/scripts/hash/types";
import { useEffect, useRef } from "react";

// 별자리선이 별에서 별로 이어지며 그려지는 효과. 밑그림 캔버스 위에 같은 크기로 겹쳐 놓는다.
// 선이 닿은 별은 잠깐 반짝인다. lines가 바뀌면 처음부터 다시 그린다.

export default function LineReveal({
  width,
  height,
  lines,
  color = "rgba(250,210,80,0.95)",
  duration = 1200,
  lineWidth = 2.5,
  className,
}: {
  width: number;
  height: number;
  lines: Point2D[][];
  color?: string;
  duration?: number;
  lineWidth?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");

    if (!ctx) {
      return;
    }

    // 모든 선분을 한 줄로 이어 길이 순으로 그린다
    const segments = lines.flatMap((line) =>
      line.slice(1).map((b, i) => {
        const a = line[i];

        return { a, b, length: Math.hypot(b[0] - a[0], b[1] - a[1]) };
      }),
    );
    const total = segments.reduce((s, g) => s + g.length, 0) || 1;
    const start = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      let budget = k * total;
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;

      for (const g of segments) {
        if (budget <= 0) {
          break;
        }

        const f = Math.min(1, budget / (g.length || 1));
        budget -= g.length;
        ctx.beginPath();
        ctx.moveTo(g.a[0], g.a[1]);
        ctx.lineTo(
          g.a[0] + (g.b[0] - g.a[0]) * f,
          g.a[1] + (g.b[1] - g.a[1]) * f,
        );
        ctx.stroke();

        // 선이 닿은 별: 닿은 직후 크게 빛났다가 작아진다
        if (f >= 1) {
          const glow = Math.max(0, 1 - (Math.max(0, budget) / total) * 4);
          ctx.beginPath();
          ctx.arc(g.b[0], g.b[1], 3 + glow * 7, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
      }

      ctx.shadowBlur = 0;

      if (k < 1) {
        raf = requestAnimationFrame(frame);
      }
    };

    raf = requestAnimationFrame(frame);

    return () => cancelAnimationFrame(raf);
  }, [width, height, lines, color, duration, lineWidth]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      className={
        className ?? "pointer-events-none absolute inset-0 h-full w-full"
      }
    />
  );
}
