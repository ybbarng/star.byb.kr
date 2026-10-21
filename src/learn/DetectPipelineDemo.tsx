"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gaussianBlurApprox, toGray } from "@/search/detectImage";
import { cn } from "@/utils/cn";

// 별 찾기 단계별 데모: 사진을 줄여 흑백 → 배경(크게 흐림) → 빼기 → 솟은 점 + 문턱을 차례로 보여 준다.
// 실제 검출(search/detectImage.ts)과 같은 흐림 함수를 쓰되, 화면용으로 줄인 사진이라 흐림 폭도 같은 비율로 줄인다.

// 고를 수 있는 사진: 나무 사이 북두칠성, 불빛 많은 누각
const PHOTOS = [
  { key: "dipper", label: "북두칠성 (나무)", src: "/samples/big-dipper.jpg" },
  {
    key: "seoul",
    label: "누각 (불빛)",
    src: "/samples/20220607-berry-seoul.jpg",
  },
] as const;
const WORK_WIDTH = 720;
const FULL_SIGMA = 8; // 원본 크기에서의 흐림 폭 (detectImage.ts의 BLUR_SIGMA)
const PEAK_RADIUS = 1; // 3×3 안에서 가장 밝으면 꼭대기 (detectCore.ts와 같다)

const STAGES = [
  { key: "photo", label: "① 원본" },
  { key: "gray", label: "② 흑백" },
  { key: "background", label: "③ 배경 (크게 흐림)" },
  { key: "diff", label: "④ 빼기" },
  { key: "peaks", label: "⑤ 솟은 점 + 문턱" },
] as const;

type Stage = (typeof STAGES)[number]["key"];

interface Work {
  image: HTMLImageElement;
  width: number;
  height: number;
  gray: Uint8Array;
  background: Float32Array;
  diff: Float32Array;
  mean: number;
  std: number;
  peaks: { x: number; y: number; v: number }[]; // 주변보다 밝은 모든 꼭대기
}

const prepare = (image: HTMLImageElement): Work => {
  const scale = WORK_WIDTH / image.width;
  const width = WORK_WIDTH;
  const height = Math.round(image.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.drawImage(image, 0, 0, width, height);
  const rgba = context.getImageData(0, 0, width, height).data;
  const gray = toGray(rgba, width, height);
  const background = gaussianBlurApprox(
    Float32Array.from(gray),
    width,
    height,
    Math.max(1, FULL_SIGMA * scale),
  );
  const diff = new Float32Array(gray.length);
  let sum = 0;

  for (let i = 0; i < gray.length; i++) {
    diff[i] = Math.max(0, gray[i] - background[i]);
    sum += diff[i];
  }

  const mean = sum / diff.length;
  let sq = 0;

  for (let i = 0; i < diff.length; i++) sq += (diff[i] - mean) ** 2;

  const std = Math.sqrt(sq / diff.length);
  const peaks: Work["peaks"] = [];

  for (let y = PEAK_RADIUS; y < height - PEAK_RADIUS; y++) {
    for (let x = PEAK_RADIUS; x < width - PEAK_RADIUS; x++) {
      const v = diff[y * width + x];

      if (v <= mean) continue;

      let top = true;

      for (let dy = -PEAK_RADIUS; dy <= PEAK_RADIUS && top; dy++) {
        for (let dx = -PEAK_RADIUS; dx <= PEAK_RADIUS; dx++) {
          if ((dx || dy) && diff[(y + dy) * width + x + dx] > v) {
            top = false;
            break;
          }
        }
      }

      if (top) peaks.push({ x, y, v });
    }
  }

  return { image, width, height, gray, background, diff, mean, std, peaks };
};

export default function DetectPipelineDemo() {
  const [work, setWork] = useState<Work | null>(null);
  const [stage, setStage] = useState<Stage>("photo");
  const [k, setK] = useState(3);
  const [photo, setPhoto] = useState<(typeof PHOTOS)[number]>(PHOTOS[0]);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;
    const image = new Image();
    image.onload = () => alive && setWork(prepare(image));
    image.src = photo.src;

    return () => {
      alive = false;
    };
  }, [photo]);

  const passed = useMemo(
    () =>
      work ? work.peaks.filter((p) => p.v > work.mean + k * work.std) : [],
    [work, k],
  );

  useEffect(() => {
    const context = canvas.current?.getContext("2d");

    if (!context || !work) return;

    const { width, height } = work;

    if (stage === "photo") {
      context.drawImage(work.image, 0, 0, width, height);

      return;
    }

    const out = context.createImageData(width, height);
    // 빼기 단계는 차이가 작아 어둡게 보이니 밝기를 키워 보여 준다
    const boost = 255 / Math.max(1, work.mean + 8 * work.std);

    for (let i = 0; i < work.gray.length; i++) {
      const v =
        stage === "gray"
          ? work.gray[i]
          : stage === "background"
            ? work.background[i]
            : Math.min(255, work.diff[i] * boost);

      out.data[i * 4] = v;
      out.data[i * 4 + 1] = v;
      out.data[i * 4 + 2] = v;
      out.data[i * 4 + 3] = 255;
    }

    context.putImageData(out, 0, 0);

    // 발표 화면에서도 보이게 원 크기를 사진 크기에 맞춘다
    if (stage === "peaks") {
      const unit = Math.hypot(width, height) / 1000;
      context.lineWidth = 1.5 * unit;
      context.strokeStyle = "rgba(120,240,170,0.9)";

      for (const p of passed) {
        context.beginPath();
        context.arc(p.x, p.y, 5 * unit, 0, 2 * Math.PI);
        context.stroke();
      }
    }
  }, [work, stage, passed]);

  const NOTES: Record<Stage, string> = {
    photo: `${photo.label} 샘플을 화면용으로 줄인 사진이에요.`,
    gray: "밝기만 남겨요 (빨강 0.299 + 초록 0.587 + 파랑 0.114). 별 찾기에는 색이 필요 없어요.",
    background:
      "크게 흐린 사진이에요. 별처럼 작은 점은 사라지고, 하늘이 밝은 정도(광해·노을)만 남아요.",
    diff: "원본 흑백에서 배경을 빼면, 하늘의 밝기와 상관없이 '주변보다 밝은 점'만 남아요. (보기 좋게 밝기를 키웠어요)",
    peaks: `바로 옆 8칸보다 밝은 꼭대기 ${work?.peaks.length.toLocaleString("ko-KR") ?? "…"}개 중, 평균보다 표준편차의 ${k}배 넘게 밝은 ${passed.length.toLocaleString("ko-KR")}개를 별 후보로 남겨요.`,
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {PHOTOS.map((p) => (
          <button
            key={p.key}
            className={cn("btn btn-sm", photo.key === p.key && "btn-secondary")}
            onClick={() => setPhoto(p)}
          >
            {p.label}
          </button>
        ))}
        <span className="mx-1 opacity-30">|</span>
        {STAGES.map((s) => (
          <button
            key={s.key}
            className={cn("btn btn-sm", stage === s.key && "btn-primary")}
            onClick={() => setStage(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="rounded-box overflow-hidden bg-black">
        <canvas
          ref={canvas}
          width={work?.width ?? WORK_WIDTH}
          height={work?.height ?? 512}
          className="block h-auto w-full"
        />
      </div>
      {stage === "peaks" && (
        <label className="flex items-center gap-3 text-sm">
          문턱: 평균 + {k}σ
          <input
            type="range"
            className="range range-xs flex-1"
            min={1}
            max={8}
            step={0.5}
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
          />
        </label>
      )}
      <p className="text-sm opacity-80">{NOTES[stage]}</p>
    </div>
  );
}
