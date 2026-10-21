"use client";

import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  projectionMatrix,
  projectVecToPhoto,
  recoverCenter,
} from "@/search/utils/wcs";

// 오차 보정 데모: 은하수 사진에서 겹친 별 30개가 답의 변환으로 어디에 놓이는지 단계별로 본다.
//   ① 짝지은 별 3개로만 맞추기 (V2): 짝 근처는 맞지만 멀어질수록 어긋난다
//   ② 겹친 별 전부로 맞추기 (닮음 변환: 돌리기·키우기·옮기기): 고르게 나아지지만 가장자리가 남는다
//   ③ 원근 변환까지: 비스듬히 보정된 사진의 키스톤까지 맞춘다 (V3)
// 흰 점이 사진의 별, 노란 점이 변환으로 배치한 지도 별, 빨간 선이 어긋남, 초록 테두리가 매칭한 별(짝)이다.
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
    label: "① 짝지은 별로만: V2",
    note: "짝 근처만 맞고, 멀어질수록 크게 어긋난다",
  },
  {
    key: "similarity",
    label: "② 겹치는 별 전부로 평균내기",
    note: "돌리기·키우기·옮기기만으로는 가장자리가 남는다",
  },
  {
    key: "perspective",
    label: "③ ② + 원근 변환까지: V3",
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

    // 하늘의 같은 간격 격자를 이 단계의 변환으로 사진에 그린다: 닮음 변환이면 반듯하고, 원근 변환이면 사다리꼴
    {
      const TP = data.stages[stage];
      const P = projectionMatrix(
        recoverCenter(data.stages.perspective, data.W, data.H),
      );

      const toSky = (x: number, y: number): Point3D => {
        const v = [0, 1, 2].map((k) => P[0][k] * x + P[1][k] * y + P[2][k]);
        const n = Math.hypot(v[0], v[1], v[2]);

        return [v[0] / n, v[1] / n, v[2] / n];
      };

      context.strokeStyle = "rgba(147,197,253,0.35)";
      context.lineWidth = 1;

      for (let g = -6; g <= 6; g++) {
        for (const vertical of [true, false]) {
          context.beginPath();

          for (let t = -6; t <= 6; t += 0.25) {
            const [x, y] = vertical
              ? [g * 0.08, t * 0.08]
              : [t * 0.08, g * 0.08];
            const p = projectVecToPhoto(TP, toSky(x, y));

            if (!p) continue;

            if (t === -6) context.moveTo(p[0] * k, p[1] * k);
            else context.lineTo(p[0] * k, p[1] * k);
          }

          context.stroke();
        }
      }
    }

    if (stage === "seed") {
      context.strokeStyle = "#4ade80";
      context.lineWidth = 3;

      for (const [x, y] of data.seeds) {
        context.beginPath();
        context.arc(x * k, y * k, 15, 0, 2 * Math.PI);
        context.stroke();
      }
    }

    // 흰 점 = 사진 별, 노란 점 = 배치한 별(같은 크기), 빨간 선 = 어긋남.
    // 선을 길이로 색칠하면 짧은 선이 안 보여서 한 색으로 두고, 길이 자체로 어긋남을 읽는다.
    // 선 → 사진 별 → 배치한 별 순으로 그려, 잘 맞으면 노란 점이 흰 점을 덮는다.
    context.lineWidth = 3;
    context.strokeStyle = "#f87171";

    for (const { photo, at } of errors) {
      if (!at) continue;

      context.beginPath();
      context.moveTo(photo[0] * k, photo[1] * k);
      context.lineTo(at[0] * k, at[1] * k);
      context.stroke();
    }

    context.fillStyle = "#ffffff";
    context.strokeStyle = "rgba(0,0,0,0.6)";
    context.lineWidth = 1.5;

    for (const { photo } of errors) {
      context.beginPath();
      context.arc(photo[0] * k, photo[1] * k, 6, 0, 2 * Math.PI);
      context.fill();
      context.stroke();
    }

    context.fillStyle = "#fde047";

    for (const { at } of errors) {
      if (!at) continue;

      context.beginPath();
      context.arc(at[0] * k, at[1] * k, 6, 0, 2 * Math.PI);
      context.fill();
      context.stroke();
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
            <span className="text-white">●</span> 사진의 별
          </li>
          <li>
            <span className="text-blue-300">▦</span> 하늘의 같은 간격 격자
            (반듯하면 닮음, 사다리꼴이면 원근)
          </li>
          <li>
            <span className="text-yellow-300">●</span> 변환으로 배치한 지도 별
          </li>
          <li>
            <span className="text-red-400">━</span> 어긋남 (길수록 크게 어긋남)
          </li>
          {stage === "seed" && (
            <li>
              <span className="text-green-400">◯</span> 매칭한 별 (짝)
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
