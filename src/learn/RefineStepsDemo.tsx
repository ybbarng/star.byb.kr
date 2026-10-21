"use client";

import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { useEffect, useMemo, useRef, useState } from "react";
import { projectVecToPhoto } from "@/search/utils/wcs";

// 오차 보정 데모: 은하수 사진에서 겹친 별 30개가 답의 변환으로 어디에 놓이는지 단계별로 본다.
//   ① 짝지은 별 3개로만 맞추기 (V2): 짝 근처는 맞지만 멀어질수록 어긋난다
//   ② 겹친 별 전부로 맞추기 (닮음 변환: 돌리기·키우기·옮기기): 고르게 나아지지만 가장자리가 남는다
//   ③ 원근 변환까지: 비스듬히 보정된 사진의 키스톤까지 맞춘다 (V3)
// 흰 원이 사진의 별, 색 점이 변환이 놓은 자리, 선이 어긋남이다.
// 자료: public/learn/refine-milky.json (scripts/learn/buildDemoData.ts)

const SRC = "/samples/20220328-brice-Milky Way over Buzzvil.jpg";

type Stage = "seed" | "similarity" | "perspective";

interface Data {
  W: number;
  H: number;
  seeds: Point2D[];
  stages: Record<Stage, Mat3>;
  pairs: { photo: Point2D; vector: Point3D }[];
}

const STAGES: { key: Stage; label: string; note: string }[] = [
  {
    key: "seed",
    label: "① 짝지은 별로만 (V2 방식)",
    note: "짝 근처만 맞고, 멀어질수록 크게 어긋난다",
  },
  {
    key: "similarity",
    label: "② 겹친 별 전부로",
    note: "돌리기·키우기·옮기기만으로는 가장자리가 남는다",
  },
  {
    key: "perspective",
    label: "③ 원근 변환까지 (V3)",
    note: "비스듬히 보정된 사진의 기울어짐까지 맞춘다",
  },
];

export default function RefineStepsDemo() {
  const [data, setData] = useState<Data | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [stage, setStage] = useState<Stage>("seed");
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;

    fetch("/learn/refine-milky.json")
      .then((r) => r.json())
      .then((d: Data) => alive && setData(d));
    const img = new Image();
    img.onload = () => alive && setImage(img);
    img.src = SRC;

    return () => {
      alive = false;
    };
  }, []);

  const errors = useMemo(
    () =>
      data?.pairs.map(({ photo, vector }) => {
        const p = projectVecToPhoto(data.stages[stage], vector);

        return {
          photo,
          at: p,
          d: p ? Math.hypot(p[0] - photo[0], p[1] - photo[1]) : Infinity,
        };
      }) ?? [],
    [data, stage],
  );

  useEffect(() => {
    const el = canvas.current;
    const context = el?.getContext("2d");

    if (!el || !context || !data || !image) return;

    const W = 960;
    const k = W / data.W;
    const H = Math.round(data.H * k);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = W * dpr;
    el.height = H * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.drawImage(image, 0, 0, W, H);
    context.fillStyle = "rgba(5,8,20,0.5)";
    context.fillRect(0, 0, W, H);

    if (stage === "seed") {
      context.strokeStyle = "#60a5fa";
      context.lineWidth = 3;

      for (const [x, y] of data.seeds) {
        context.beginPath();
        context.arc(x * k, y * k, 15, 0, 2 * Math.PI);
        context.stroke();
      }
    }

    for (const { photo, at, d } of errors) {
      const [x, y] = [photo[0] * k, photo[1] * k];
      const bad = d > 20;
      context.strokeStyle = "rgba(255,255,255,0.8)";
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(x, y, 7, 0, 2 * Math.PI);
      context.stroke();

      if (!at) continue;

      const color = bad ? "#f87171" : d > 6 ? "#fde68a" : "#4ade80";
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(at[0] * k, at[1] * k);
      context.stroke();
      context.fillStyle = color;
      context.beginPath();
      context.arc(at[0] * k, at[1] * k, 3.5, 0, 2 * Math.PI);
      context.fill();
    }
  }, [data, image, stage, errors]);

  if (!data) {
    return <div className="text-sm opacity-60">자료를 불러오는 중…</div>;
  }

  const finite = errors.map((e) => e.d).filter(Number.isFinite);
  const mean = finite.reduce((a, b) => a + b, 0) / finite.length;
  const max = Math.max(...finite);
  const current = STAGES.find((s) => s.key === stage)!;

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_17rem]">
      <canvas
        ref={canvas}
        style={{ maxHeight: "80vh" }}
        className="rounded-box h-auto w-full"
      />
      <div className="flex flex-col gap-3 text-base">
        <div className="flex flex-col gap-2">
          {STAGES.map((s) => (
            <button
              key={s.key}
              className={`btn btn-sm justify-start ${stage === s.key ? "btn-primary" : ""}`}
              onClick={() => setStage(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="text-sm opacity-80">{current.note}</div>
        <div className="bg-base-300/60 rounded-box flex flex-col gap-1 p-3">
          <div>
            평균 어긋남 <b className="text-lg">{mean.toFixed(1)}px</b>
          </div>
          <div className="text-sm opacity-80">
            가장 크게 {max.toFixed(0)}px · 겹친 별 {data.pairs.length}개 기준
          </div>
        </div>
        <ul className="flex flex-col gap-1 text-sm">
          <li>
            <span className="opacity-80">○</span> 사진의 별
          </li>
          <li>
            <span className="text-green-400">●</span> 변환이 놓은 자리 (6px 안)
          </li>
          <li>
            <span className="text-amber-200">●</span> 6~20px 어긋남 ·{" "}
            <span className="text-red-400">●</span> 20px 넘게
          </li>
          {stage === "seed" && (
            <li>
              <span className="text-blue-400">◯</span> 짝지은 별
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
