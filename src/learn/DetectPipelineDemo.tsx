"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gaussianBlurApprox, toGray } from "@/search/detectImage";
import { cn } from "@/utils/cn";

// 별 찾기 단계별 데모: 사진을 줄여 흑백 → 배경(크게 흐림) → 빼기 → 솟은 점 + 문턱을 차례로 보여 준다.
// 실제 검출(search/detectImage.ts)과 같은 흐림 함수를 쓰되, 화면용으로 줄인 사진이라 흐림 폭도 같은 비율로 줄인다.
// 사진 옆에는 가로줄 하나의 밝기 단면을 단계마다 그린다: 원본 RGB → 흑백 → 배경(느린 변화만) → 빼기(바닥이 평평)
// → 꼭대기와 문턱 선. 사진을 누르면 그 높이로 줄을 옮긴다. 그래프 칸과 사진 칸(4:3)은 단계가 바뀌어도 크기가 같다.

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
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
  gray: Uint8Array;
  background: Float32Array;
  diff: Float32Array;
  mean: number;
  std: number;
  peaks: { x: number; y: number; v: number }[]; // 주변보다 밝은 모든 꼭대기
}

const GRAPH_W = 320;
const GRAPH_H = 180;
const BAND = 2; // 단면은 줄 위아래 2줄까지 본다

// 처음 단면 줄: 가장 강한 꼭대기를 지나는 줄 (별이나 불빛 가시가 반드시 하나는 보인다)
const defaultRow = (work: Work) =>
  work.peaks.reduce((a, b) => (b.v > a.v ? b : a), work.peaks[0])?.y ??
  Math.round(work.height / 2);

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

  return {
    image,
    rgba,
    width,
    height,
    gray,
    background,
    diff,
    mean,
    std,
    peaks,
  };
};

export default function DetectPipelineDemo() {
  const [work, setWork] = useState<Work | null>(null);
  const [stage, setStage] = useState<Stage>("photo");
  const [k, setK] = useState(3);
  const [photo, setPhoto] = useState<(typeof PHOTOS)[number]>(PHOTOS[0]);
  const [row, setRow] = useState<number | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;
    const image = new Image();

    image.onload = () => {
      if (!alive) return;

      const next = prepare(image);
      setWork(next);
      setRow(defaultRow(next));
    };

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

    // 단면 줄: 사진 위에 가는 점선으로
    const drawRow = () => {
      if (row === null) return;

      context.save();
      context.strokeStyle = "rgba(125,211,252,0.9)";
      context.lineWidth = Math.max(1, width / 600);
      context.setLineDash([8, 6]);
      context.beginPath();
      context.moveTo(0, row + 0.5);
      context.lineTo(width, row + 0.5);
      context.stroke();
      context.restore();
    };

    if (stage === "photo") {
      context.drawImage(work.image, 0, 0, width, height);
      drawRow();

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

    drawRow();
  }, [work, stage, passed, row]);

  // 단면 그래프: 이 단계에서 줄을 따라 밝기가 어떻게 오르내리는지
  const graph = useMemo(() => {
    if (!work || row === null) return null;

    const { width } = work;

    // 줄 위아래 2줄(5줄 띠)에서 열마다 가장 밝은 값: 별 가시는 몇 줄에 걸쳐 있어 한 줄만 보면 꼭대기를 놓친다
    const at = (arr: ArrayLike<number>, x: number, stride = 1, offset = 0) => {
      let v = 0;

      for (
        let y = Math.max(0, row - BAND);
        y <= Math.min(work.height - 1, row + BAND);
        y++
      ) {
        v = Math.max(v, arr[(y * width + x) * stride + offset]);
      }

      return v;
    };

    const xs = Array.from({ length: width }, (_, x) => x);
    const threshold = work.mean + k * work.std;
    const diffMode = stage === "diff" || stage === "peaks";
    const rowDiff = xs.map((x) => at(work.diff, x));
    // 빼기 그래프는 문턱 근처가 잘 보이게 위를 자른다: 아주 밝은 불빛 하나가 나머지를 납작하게 누르지 않게
    const top = diffMode
      ? Math.max(1, threshold * 2, work.mean + 12 * work.std)
      : 255;
    const path = (values: number[]) =>
      values
        .map(
          (v, x) =>
            `${((x / (width - 1)) * GRAPH_W).toFixed(1)},${(GRAPH_H - (Math.min(v, top) / top) * GRAPH_H).toFixed(1)}`,
        )
        .join(" ");
    const gray = xs.map((x) => at(work.gray, x));
    const lines: { points: string; color: string; faint?: boolean }[] =
      stage === "photo"
        ? [
            {
              points: path(xs.map((x) => at(work.rgba, x, 4, 0))),
              color: "#f87171",
            },
            {
              points: path(xs.map((x) => at(work.rgba, x, 4, 1))),
              color: "#4ade80",
            },
            {
              points: path(xs.map((x) => at(work.rgba, x, 4, 2))),
              color: "#60a5fa",
            },
          ]
        : stage === "gray"
          ? [{ points: path(gray), color: "#e5e5e5" }]
          : stage === "background"
            ? [
                { points: path(gray), color: "#e5e5e5", faint: true },
                {
                  points: path(xs.map((x) => at(work.background, x))),
                  color: "#fbbf24",
                },
              ]
            : [{ points: path(rowDiff), color: "#e5e5e5" }];
    const rowPeaks = work.peaks
      .filter((p) => Math.abs(p.y - row) <= BAND)
      .map((p) => ({
        x: (p.x / (width - 1)) * GRAPH_W,
        y: GRAPH_H - (Math.min(p.v, top) / top) * GRAPH_H,
        pass: p.v > threshold,
      }));

    return {
      lines,
      top,
      thresholdY: GRAPH_H - (threshold / top) * GRAPH_H,
      rowPeaks,
    };
  }, [work, row, stage, k]);

  const GRAPH_NOTES: Record<Stage, string> = {
    photo:
      "빨강·초록·파랑 밝기. 하늘 빛이 한쪽으로 갈수록 밝아지는 기울기도 보여요.",
    gray: "세 색을 한 줄로. 별은 뾰족한 가시, 땅·지붕은 넓은 언덕이에요.",
    background:
      "노란 줄이 배경이에요. 하늘 기울기 같은 느린 변화만 따라가고 별 가시는 무시해요.",
    diff: "흑백 − 배경. 기울기가 사라져 바닥이 평평해지고 가시만 남아요.",
    peaks: "초록 점은 문턱(점선)을 넘은 꼭대기, 회색 점은 못 넘은 꼭대기예요.",
  };

  // 사진은 4:3 칸 안에 비율을 지켜 들어가 있어(object-contain) 남는 여백을 빼고 잰다
  const pickRow = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!work) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const scale = Math.min(rect.width / work.width, rect.height / work.height);
    const top = rect.top + (rect.height - work.height * scale) / 2;
    const y = Math.round((e.clientY - top) / scale);

    if (y >= 0 && y < work.height) setRow(y);
  };

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
      <div className="grid items-start gap-3 md:grid-cols-[1fr_20rem]">
        <div className="rounded-box relative aspect-[4/3] overflow-hidden bg-black">
          <canvas
            ref={canvas}
            width={work?.width ?? WORK_WIDTH}
            height={work?.height ?? 540}
            className="block h-full w-full cursor-crosshair object-contain"
            onClick={pickRow}
          />
        </div>
        <div className="bg-base-300/60 rounded-box flex flex-col gap-2 p-3 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="font-bold">점선 줄의 밝기</span>
            <span className="text-xs opacity-60">
              사진을 누르면 줄을 옮겨요
            </span>
          </div>
          <svg
            viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`}
            className="w-full rounded bg-black/60"
          >
            {graph && (
              <>
                {graph.lines.map((l, i) => (
                  <polyline
                    key={i}
                    points={l.points}
                    fill="none"
                    stroke={l.color}
                    strokeOpacity={l.faint ? 0.35 : 0.9}
                    strokeWidth="1.2"
                  />
                ))}
                {stage === "peaks" && (
                  <>
                    <line
                      x1="0"
                      x2={GRAPH_W}
                      y1={graph.thresholdY}
                      y2={graph.thresholdY}
                      stroke="#4ade80"
                      strokeDasharray="5 4"
                    />
                    {graph.rowPeaks.map((p, i) => (
                      <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={p.pass ? 3.5 : 2}
                        fill={p.pass ? "#4ade80" : "rgba(160,160,160,0.7)"}
                      />
                    ))}
                  </>
                )}
                <text x="4" y="12" fontSize="10" fill="white" opacity="0.5">
                  {Math.round(graph.top)}
                </text>
                <text
                  x="4"
                  y={GRAPH_H - 4}
                  fontSize="10"
                  fill="white"
                  opacity="0.5"
                >
                  0
                </text>
              </>
            )}
          </svg>
          <p className="min-h-[3lh] text-xs opacity-75">{GRAPH_NOTES[stage]}</p>
          {/* 문턱은 ⑤에서만 쓰지만 자리는 늘 둬서 배치가 움직이지 않게 한다 */}
          <label
            className={cn(
              "flex items-center gap-3",
              stage !== "peaks" && "opacity-30",
            )}
          >
            문턱: 평균 + {k}σ
            <input
              type="range"
              className="range range-xs flex-1"
              min={1}
              max={8}
              step={0.5}
              value={k}
              disabled={stage !== "peaks"}
              onChange={(e) => setK(Number(e.target.value))}
            />
          </label>
        </div>
      </div>
      <p className="min-h-[2lh] text-sm opacity-80">{NOTES[stage]}</p>
    </div>
  );
}
