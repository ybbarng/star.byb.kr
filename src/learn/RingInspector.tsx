"use client";

import type { DetectedStar } from "@/plate-solver/detectPhotoStars";
import { useEffect, useMemo, useRef } from "react";

// 점 하나 들여다보기: 검출 주변을 크게 키워 별다움(ringContrast)을 재는 고리와 8부채꼴을 그리고,
// 부채꼴마다의 평균 밝기를 막대로 보여 준다. 진짜 별은 여덟 막대가 고르고, 지붕 경계·창문은 들쭉날쭉하다.
// 고리 크기는 search/detectCore.ts의 ringContrast와 같은 식이다. 아래 값은 실제 검출이 잰 값이다.

const ZOOM_PX = 220;

export default function RingInspector({
  image,
  star,
  starlike,
}: {
  image: HTMLImageElement;
  star: DetectedStar;
  starlike: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const unit = Math.max(1, Math.hypot(image.width, image.height) / 1400);
  const r1 = Math.round((3 * unit + star.brightness) * 2) / 2;
  const r2 = Math.round((6 * unit + star.brightness * 1.5) * 2) / 2;
  const half = Math.ceil(r2 * 1.6);

  // 부채꼴 8개의 평균 밝기
  const sectors = useMemo(() => {
    const size = half * 2 + 1;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const context = c.getContext("2d")!;
    context.drawImage(
      image,
      Math.round(star.x) - half,
      Math.round(star.y) - half,
      size,
      size,
      0,
      0,
      size,
      size,
    );
    const data = context.getImageData(0, 0, size, size).data;
    const sums = new Array(8).fill(0);
    const counts = new Array(8).fill(0);

    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const d = Math.hypot(dx, dy);

        if (d < r1 || d > r2) continue;

        const sector =
          Math.floor(((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * 8) % 8;
        const i = ((dy + half) * size + dx + half) * 4;
        sums[sector] +=
          0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        counts[sector]++;
      }
    }

    return sums.map((s, i) => (counts[i] ? s / counts[i] : 0));
  }, [image, star, half, r1, r2]);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");

    if (!context) return;

    const scale = ZOOM_PX / (half * 2 + 1);
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, ZOOM_PX, ZOOM_PX);
    context.drawImage(
      image,
      Math.round(star.x) - half,
      Math.round(star.y) - half,
      half * 2 + 1,
      half * 2 + 1,
      0,
      0,
      ZOOM_PX,
      ZOOM_PX,
    );
    const c = ZOOM_PX / 2;
    context.strokeStyle = "rgba(253,230,138,0.9)";
    context.lineWidth = 1.5;

    for (const r of [r1, r2]) {
      context.beginPath();
      context.arc(c, c, r * scale, 0, 2 * Math.PI);
      context.stroke();
    }

    context.strokeStyle = "rgba(253,230,138,0.4)";

    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * 2 * Math.PI;
      context.beginPath();
      context.moveTo(
        c + Math.cos(a) * r1 * scale,
        c + Math.sin(a) * r1 * scale,
      );
      context.lineTo(
        c + Math.cos(a) * r2 * scale,
        c + Math.sin(a) * r2 * scale,
      );
      context.stroke();
    }
  }, [image, star, half, r1, r2]);

  const value = star.ringContrast ?? 0;
  const isStar = value < starlike;
  const max = Math.max(1, ...sectors);

  return (
    <div className="bg-base-300/60 rounded-box flex flex-col gap-3 p-3 sm:flex-row">
      <canvas
        ref={canvas}
        width={ZOOM_PX}
        height={ZOOM_PX}
        className="rounded-box mx-auto shrink-0 bg-black"
        style={{ width: ZOOM_PX, height: ZOOM_PX }}
      />
      <div className="flex flex-1 flex-col gap-2 text-sm">
        <div className="font-bold">
          별다움 {value.toFixed(2)} ·{" "}
          <span className={isStar ? "text-success" : "text-warning"}>
            {isStar ? "별다워요" : "별답지 않아요"}
          </span>{" "}
          <span className="text-xs font-normal opacity-60">
            ({starlike} 미만이면 별로 봐요)
          </span>
        </div>
        <div className="flex h-20 items-end gap-1">
          {sectors.map((v, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-amber-300/80"
                style={{ height: `${(v / max) * 64}px` }}
              />
              <span className="text-[10px] opacity-60">{i + 1}</span>
            </div>
          ))}
        </div>
        <p className="text-xs opacity-70">
          노란 두 원 사이 고리를 여덟 조각으로 나눠 조각마다 평균 밝기를 쟀어요.
          가장 밝은 조각과 가장 어두운 조각의 차이를 별의 밝기로 나눈 값이
          별다움이에요. 진짜 별은 사방이 고른 하늘이라 막대가 고르고, 지붕
          경계·창문·나뭇가지는 한쪽이 밝아 들쭉날쭉해요.
        </p>
      </div>
    </div>
  );
}
