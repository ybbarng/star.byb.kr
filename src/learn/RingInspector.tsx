"use client";

import type { DetectedStar } from "@/plate-solver/detectPhotoStars";
import { useEffect, useMemo, useRef } from "react";

// 점 하나 들여다보기: 검출 주변을 크게 키워 별다움(ringContrast)을 재는 고리와 8부채꼴을 그리고,
// 부채꼴마다의 평균 밝기를 막대로 보여 준다. 막대 높이는 점의 꼭대기 밝기에 맞춰 그린다: 들쭉날쭉함은
// 고리의 차이를 점의 밝기로 나눈 값이라, 아주 밝은 불빛은 고리가 고르지 않아도 작게 나온다.
// 고리 크기는 search/detectCore.ts의 ringContrast와 같은 식이다. 들쭉날쭉함 값은 실제 검출이 잰 값이다.
// 점을 고르기 전에도 같은 크기의 자리를 차지해, 점을 눌러도 데모 배치가 움직이지 않는다.

const ZOOM_PX = 220;

export default function RingInspector({
  image,
  star,
  starlike,
}: {
  image: HTMLImageElement;
  star: DetectedStar | null;
  starlike: number;
}) {
  return star ? (
    <Inspector image={image} star={star} starlike={starlike} />
  ) : (
    <div className="bg-base-300/60 rounded-box flex flex-col items-center gap-3 p-3">
      <div
        className="rounded-box grid place-items-center bg-black p-4 text-center text-sm opacity-70"
        style={{ width: ZOOM_PX, height: ZOOM_PX }}
      >
        사진의 동그라미를 누르면 그 점을 크게 들여다봐요
      </div>
    </div>
  );
}

function Inspector({
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

  // 부채꼴 8개의 평균 밝기와 점의 꼭대기 밝기(안쪽 원의 최댓값, ringContrast와 같은 식)
  const { sectors, peak } = useMemo(() => {
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

    const lumaAt = (dx: number, dy: number) => {
      const i = ((dy + half) * size + dx + half) * 4;

      return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    };

    const inner = Math.max(2, Math.ceil(r1 / 2));
    let top = 0;

    for (let dy = -inner; dy <= inner; dy++) {
      for (let dx = -inner; dx <= inner; dx++) {
        top = Math.max(top, lumaAt(dx, dy));
      }
    }

    return {
      sectors: sums.map((s, i) => (counts[i] ? s / counts[i] : 0)),
      peak: top,
    };
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
  // 막대는 점의 꼭대기 밝기 기준으로: 고리 차이가 점에 비해 얼마나 큰지가 들쭉날쭉함이다
  const max = Math.max(1, peak, ...sectors);
  const bars = [
    ...sectors.map((v, i) => ({ v, label: String(i + 1), point: false })),
    { v: peak, label: "점", point: true },
  ];

  return (
    <div className="bg-base-300/60 rounded-box flex flex-col items-center gap-3 p-3">
      <canvas
        ref={canvas}
        width={ZOOM_PX}
        height={ZOOM_PX}
        className="rounded-box shrink-0 bg-black"
        style={{ width: ZOOM_PX, height: ZOOM_PX }}
      />
      <div className="flex w-full flex-col gap-2 text-sm">
        <div className="font-bold">
          들쭉날쭉함 {value.toFixed(2)} ·{" "}
          <span className={isStar ? "text-success" : "text-warning"}>
            {isStar ? "별다워요" : "별답지 않아요"}
          </span>
          <div className="text-xs font-normal opacity-60">
            작을수록 별다워요, {starlike} 미만이면 별
          </div>
        </div>
        <div className="flex h-20 items-end gap-1">
          {bars.map(({ v, label, point }) => (
            <div
              key={label}
              className="flex flex-1 flex-col items-center gap-1"
            >
              <div
                className={
                  point
                    ? "w-full rounded-t bg-white/80"
                    : "w-full rounded-t bg-amber-300/80"
                }
                style={{ height: `${Math.max(1, (v / max) * 64)}px` }}
              />
              <span className="text-[10px] opacity-60">{label}</span>
            </div>
          ))}
        </div>
        <p className="text-xs opacity-70">
          노란 두 원 사이 고리를 여덟 조각으로 나눠 조각마다 평균 밝기를 쟀어요
          (흰 막대는 점 자체의 밝기). 가장 밝은 조각과 가장 어두운 조각의 차이를
          점의 밝기로 나눈 값이 들쭉날쭉함이에요. 진짜 별은 사방이 고른 하늘이라
          노란 막대가 고르고, 지붕 경계·나뭇가지는 한쪽이 밝아 들쭉날쭉해요.
          점이 아주 밝으면 노란 막대 차이가 상대적으로 작아져 별답게 나오기도
          해요.
        </p>
      </div>
    </div>
  );
}
