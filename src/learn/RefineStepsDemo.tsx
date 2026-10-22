"use client";

import type { Point2D } from "@/scripts/hash/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/utils/cn";

// 오차 보정 데모: 시야가 넓은 사진에서 같은 짝(겹친 별)으로 여러 모델을 맞춰, 지도 별이 어디에 놓이는지 본다.
//   ① 짝지은 별 3~4개로만 맞추기 (V2): 짝 근처는 맞지만 멀어질수록 어긋난다
//   ② 겹친 별 전부로 닮음 변환 (돌리기·키우기·옮기기)
//   ③ ② + 방사형 렌즈 왜곡 (가장자리로 갈수록 늘거나 줄어든다)
//   ④ 어안 렌즈 (등거리 투영 + 광학중심·왜곡)
//   ⑤ 원근 변환 (V3)
// 흰 점이 사진의 별, 노란 점이 모델로 배치한 지도 별, 빨간 선이 어긋남, 초록 테두리가 매칭한 별(짝)이다.
// 자료: public/learn/refine-<사진>.json (scripts/learn/buildDemoData.ts가 모델마다 별 자리와 격자를 미리 계산)

const PHOTOS = [
  { key: "milky", label: "은하수 (원근 보정)" },
  { key: "seoul", label: "누각" },
  { key: "aust", label: "호주" },
  { key: "jeungseun", label: "증선" },
] as const;

type Model = "seed" | "similarity" | "radial" | "fisheye" | "perspective";

interface Data {
  src: string;
  W: number;
  H: number;
  seeds: Point2D[];
  photo: Point2D[];
  models: Record<Model, { placed: (Point2D | null)[]; grid: Point2D[][] }>;
}

const MODELS: { key: Model; label: string; note: string }[] = [
  {
    key: "seed",
    label: "① 짝지은 별로만: V2",
    note: "짝 근처만 맞고, 멀어질수록 크게 어긋난다",
  },
  {
    key: "similarity",
    label: "② 겹친 별 전부로 닮음 변환",
    note: "돌리기·키우기·옮기기만. 고르게 나아지지만 가장자리가 남는다",
  },
  {
    key: "radial",
    label: "③ ② + 렌즈 왜곡",
    note: "가장자리로 갈수록 늘거나 줄어드는 렌즈 왜곡 하나를 더한다",
  },
  {
    key: "fisheye",
    label: "④ 어안 렌즈",
    note: "광축에서의 각도에 비례해 펼치는 어안 렌즈로 본다",
  },
  {
    key: "perspective",
    label: "⑤ 원근 변환: V3",
    note: "비스듬히 찍거나 보정한 사진의 기울어짐까지 맞춘다",
  },
];

export default function RefineStepsDemo() {
  const [photo, setPhoto] = useState<(typeof PHOTOS)[number]["key"]>("milky");
  const [data, setData] = useState<Data | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [model, setModel] = useState<Model>("seed");
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;

    fetch(`/learn/refine-${photo}.json`)
      .then((r) => r.json())
      .then((d: Data) => {
        if (!alive) return;

        setData(d);
        const img = new Image();
        img.onload = () => alive && setImage(img);
        img.src = d.src;
      });

    return () => {
      alive = false;
    };
  }, [photo]);

  const errors = useMemo(
    () =>
      data?.photo.map((p, i) => {
        const at = data.models[model].placed[i];

        return {
          photo: p,
          at,
          d: at ? Math.hypot(at[0] - p[0], at[1] - p[1]) : Infinity,
        };
      }) ?? [],
    [data, model],
  );

  useEffect(() => {
    const el = canvas.current;
    const context = el?.getContext("2d");

    if (
      !el ||
      !context ||
      !data ||
      !image ||
      image.src.indexOf(encodeURI(data.src)) < 0
    )
      return;

    // 사진마다 비율이 달라도 그림 칸은 4:3 그대로, 사진은 가운데에 맞춘다
    const W = 960;
    const H = 720;
    const k = Math.min(W / data.W, H / data.H);
    const ox = (W - data.W * k) / 2;
    const oy = (H - data.H * k) / 2;
    const X = (x: number) => ox + x * k;
    const Y = (y: number) => oy + y * k;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = W * dpr;
    el.height = H * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = "#000";
    context.fillRect(0, 0, W, H);
    context.save();
    context.beginPath();
    context.rect(ox, oy, data.W * k, data.H * k);
    context.clip();
    context.drawImage(image, ox, oy, data.W * k, data.H * k);
    context.fillStyle = "rgba(5,8,20,0.5)";
    context.fillRect(0, 0, W, H);

    // 하늘의 같은 간격 격자를 이 모델로 사진에 그린다: 닮음이면 반듯, 원근이면 사다리꼴, 왜곡·어안이면 휜다
    context.strokeStyle = "rgba(147,197,253,0.35)";
    context.lineWidth = 1;

    for (const line of data.models[model].grid) {
      context.beginPath();
      line.forEach(([x, y], i) =>
        i === 0 ? context.moveTo(X(x), Y(y)) : context.lineTo(X(x), Y(y)),
      );
      context.stroke();
    }

    if (model === "seed") {
      context.strokeStyle = "#4ade80";
      context.lineWidth = 3;

      for (const [x, y] of data.seeds) {
        context.beginPath();
        context.arc(X(x), Y(y), 15, 0, 2 * Math.PI);
        context.stroke();
      }
    }

    // 흰 점 = 사진 별, 노란 점 = 배치한 별(같은 크기), 빨간 선 = 어긋남.
    // 선 → 사진 별 → 배치한 별 순으로 그려, 잘 맞으면 노란 점이 흰 점을 덮는다.
    context.lineWidth = 3;
    context.strokeStyle = "#f87171";

    for (const { photo: p, at } of errors) {
      if (!at) continue;

      context.beginPath();
      context.moveTo(X(p[0]), Y(p[1]));
      context.lineTo(X(at[0]), Y(at[1]));
      context.stroke();
    }

    context.fillStyle = "#ffffff";
    context.strokeStyle = "rgba(0,0,0,0.6)";
    context.lineWidth = 1.5;

    for (const { photo: p } of errors) {
      context.beginPath();
      context.arc(X(p[0]), Y(p[1]), 6, 0, 2 * Math.PI);
      context.fill();
      context.stroke();
    }

    context.fillStyle = "#fde047";

    for (const { at } of errors) {
      if (!at) continue;

      context.beginPath();
      context.arc(X(at[0]), Y(at[1]), 6, 0, 2 * Math.PI);
      context.fill();
      context.stroke();
    }

    context.restore();
  }, [data, image, model, errors]);

  const finite = errors.map((e) => e.d).filter(Number.isFinite);
  const mean = finite.length
    ? finite.reduce((a, b) => a + b, 0) / finite.length
    : 0;
  const max = finite.length ? Math.max(...finite) : 0;
  const current = MODELS.find((m) => m.key === model)!;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {PHOTOS.map((p) => (
          <button
            key={p.key}
            className={cn("btn btn-sm", photo === p.key && "btn-secondary")}
            onClick={() => setPhoto(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_17rem]">
        <canvas
          ref={canvas}
          style={{ maxHeight: "80vh" }}
          className="rounded-box aspect-[4/3] h-auto w-full bg-black"
        />
        <div className="flex flex-col gap-3 text-base">
          <div className="flex flex-col gap-2">
            {MODELS.map((m) => (
              <button
                key={m.key}
                className={cn(
                  "btn btn-sm justify-start",
                  model === m.key && "btn-primary",
                )}
                onClick={() => setModel(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="min-h-[2lh] text-sm opacity-80">{current.note}</div>
          <div className="bg-base-300/60 rounded-box flex flex-col gap-1 p-3">
            <div>
              평균 어긋남 <b className="text-lg">{mean.toFixed(1)}px</b>
            </div>
            <div className="text-sm opacity-80">
              가장 크게 {max.toFixed(0)}px · 겹친 별 {data?.photo.length ?? "…"}
              개 기준
            </div>
          </div>
          <ul className="flex flex-col gap-1 text-sm">
            <li>
              <span className="text-white">●</span> 사진의 별
            </li>
            <li>
              <span className="text-blue-300">▦</span> 하늘의 같은 간격 격자
            </li>
            <li>
              <span className="text-yellow-300">●</span> 모델로 배치한 지도 별
            </li>
            <li>
              <span className="text-red-400">━</span> 어긋남 (길수록 크게
              어긋남)
            </li>
            <li className={model === "seed" ? "" : "invisible"}>
              <span className="text-green-400">◯</span> 매칭한 별 (짝)
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
