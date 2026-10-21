"use client";

import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { useEffect, useMemo, useRef, useState } from "react";
import { STARS } from "@/game/sky/catalog";
import { projectVecToPhoto } from "@/search/utils/wcs";

// 판정 규칙 ① 데모: "겹친 별 수 ÷ 우연 기대치 ≥ 5배면 우연이 아니다(찾았다)".
// 서울 누각 사진의 진짜 답으로, 답대로 놓은 지도 별이 사진 별과 몇 개 겹치는지 보이고,
// 같은 수의 지도 별을 사진 위에 아무 데나 뿌려 우연히 몇 개 겹치는지 센다. 그 평균이 우연 기대치다.
// 기대치 = 사진 별 수 × 화면 안 지도 별 수 × (허용 반경 원 넓이 ÷ 사진 넓이) — solveCore와 같은 식.
// 자료: public/learn/candidates-seoul.json (scripts/learn/buildDemoData.ts)

const SRC = "/samples/20220607-berry-seoul.jpg";
const RATIO = 5;

interface Answer {
  TP: Mat3;
  photo: Point2D[];
  matched: number[];
  count: number;
  expected: number;
  inView: number;
}

interface Data {
  W: number;
  H: number;
  tol: number;
  real: Answer;
}

type Mode = "answer" | "random";

// 사진 별마다 허용 반경 안에 지도 별이 있으면 겹친 것으로 센다
const overlapsOf = (photo: Point2D[], map: Point2D[], tol: number) =>
  photo
    .map((q, i) =>
      map.some((m) => Math.hypot(m[0] - q[0], m[1] - q[1]) <= tol) ? i : -1,
    )
    .filter((i) => i >= 0);

export default function ChanceRatioDemo() {
  const [data, setData] = useState<Data | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [mode, setMode] = useState<Mode>("answer");
  const [scatter, setScatter] = useState<Point2D[]>([]);
  const [hits, setHits] = useState<number[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;

    fetch("/learn/candidates-seoul.json")
      .then((r) => r.json())
      .then((d: Data) => alive && setData(d));
    const img = new Image();
    img.onload = () => alive && setImage(img);
    img.src = SRC;

    return () => {
      alive = false;
    };
  }, []);

  // 화면 안 지도 별과 같은 수를 사진 위에 고르게 아무 데나 뿌린다 (n번, 마지막 것을 그린다)
  const throwStars = (n: number) => {
    if (!data) return;

    const { W, H, tol, real } = data;
    let last: Point2D[] = [];
    const counts = Array.from({ length: n }, () => {
      last = Array.from(
        { length: real.inView },
        () => [Math.random() * W, Math.random() * H] as Point2D,
      );

      return overlapsOf(real.photo, last, tol).length;
    });

    setScatter(last);
    setHits((h) => [...h, ...counts]);
    setMode("random");
  };

  const { map, matched } = useMemo(() => {
    if (!data) return { map: [] as Point2D[], matched: [] as number[] };

    if (mode === "random") {
      return {
        map: scatter,
        matched: overlapsOf(data.real.photo, scatter, data.tol),
      };
    }

    return {
      map: STARS.map((s) =>
        projectVecToPhoto(data.real.TP, s.vector as Point3D),
      ).filter(
        (p): p is Point2D =>
          p !== null &&
          p[0] >= 0 &&
          p[0] < data.W &&
          p[1] >= 0 &&
          p[1] < data.H,
      ),
      matched: data.real.matched,
    };
  }, [data, mode, scatter]);

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
    context.fillStyle = "rgba(5,8,20,0.55)";
    context.fillRect(0, 0, W, H);

    // 사진 별의 허용 반경 (이 원 안에 지도 별이 오면 겹친 것)
    context.fillStyle = "rgba(255,255,255,0.14)";
    context.strokeStyle = "rgba(255,255,255,0.55)";
    context.lineWidth = 1.5;

    for (const [x, y] of data.real.photo) {
      context.beginPath();
      context.arc(x * k, y * k, data.tol * k, 0, 2 * Math.PI);
      context.fill();
      context.stroke();
    }

    // 지도 별 (파란 점)
    context.fillStyle = "#60a5fa";

    for (const [x, y] of map) {
      context.beginPath();
      context.arc(x * k, y * k, 3, 0, 2 * Math.PI);
      context.fill();
    }

    // 사진 별 (노란 점)
    context.fillStyle = "#fde047";

    for (const [x, y] of data.real.photo) {
      context.beginPath();
      context.arc(x * k, y * k, 4, 0, 2 * Math.PI);
      context.fill();
    }

    // 겹친 별 (초록 원)
    context.lineWidth = 4;
    context.strokeStyle = "#4ade80";

    for (const i of matched) {
      const [x, y] = data.real.photo[i];
      context.beginPath();
      context.arc(x * k, y * k, 17, 0, 2 * Math.PI);
      context.stroke();
    }
  }, [data, image, map, matched]);

  if (!data) {
    return <div className="text-sm opacity-60">자료를 불러오는 중…</div>;
  }

  const { real, tol, W, H } = data;
  const average =
    hits.length > 0 ? hits.reduce((a, b) => a + b, 0) / hits.length : null;
  // 지금 그린 배치(답대로 또는 이번에 뿌린 것)를 같은 규칙으로 판정한다
  const shown = mode === "answer" ? real.count : (hits.at(-1) ?? 0);
  const ratio = shown / real.expected;
  const meant = ratio >= RATIO;
  const how = mode === "answer" ? "답대로 놓으니" : "아무 데나 뿌리니";

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_19rem]">
      <canvas
        ref={canvas}
        style={{ maxHeight: "80vh" }}
        className="rounded-box h-auto w-full"
      />
      <div className="flex flex-col gap-3 text-base">
        <ul className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
          <li>
            <span className="text-yellow-300">●</span> 사진에서 찾은 별
          </li>
          <li>
            <span className="text-blue-400">●</span> 지도 별
          </li>
          <li>
            <span className="opacity-50">◯</span> 겹쳤다고 보는 범위
          </li>
          <li>
            <span className="text-green-400">◯</span> 겹친 별
          </li>
        </ul>
        {/* 세 버튼이 칸 폭을 글자 길이대로 나눠 가져 줄이 맞는다. "100번 더"는 뿌린 뒤에만 누를 수 있다 */}
        <div className="flex gap-2">
          <button
            className={`btn btn-sm flex-auto px-2 whitespace-nowrap ${mode === "answer" ? "btn-primary" : ""}`}
            onClick={() => setMode("answer")}
          >
            답대로 놓기
          </button>
          <button
            className={`btn btn-sm flex-auto px-2 whitespace-nowrap ${mode === "random" ? "btn-primary" : ""}`}
            onClick={() => throwStars(1)}
          >
            아무 데나 뿌리기
          </button>
          <button
            className="btn btn-sm flex-auto px-2 whitespace-nowrap"
            disabled={mode !== "random"}
            onClick={() => throwStars(100)}
          >
            100번 더
          </button>
        </div>

        {mode === "answer" ? (
          <div className="bg-base-300/60 rounded-box p-3">
            답대로 놓으면 겹친 별{" "}
            <b className="text-lg text-green-400">{real.count}개</b>
          </div>
        ) : (
          <div className="bg-base-300/60 rounded-box flex flex-col gap-1 p-3">
            <div>
              우연히 겹친 별{" "}
              <b className="text-lg text-green-400">{hits.at(-1) ?? 0}개</b>
            </div>
            <div className="text-sm opacity-80">
              {hits.length}번 뿌린 평균 <b>{average?.toFixed(2)}개</b>
            </div>
          </div>
        )}

        <div className="bg-base-300/60 rounded-box flex flex-col gap-1 p-3 text-sm">
          <div className="opacity-70">
            우연 기대치 = 아무 데나 놓아도 겹칠 개수
          </div>
          <div>
            사진 별 {real.photo.length} × 지도 별 {real.inView} ×{" "}
            <span className="whitespace-nowrap">(원 넓이 ÷ 사진 넓이)</span>
          </div>
          <div className="opacity-70">
            = {real.photo.length} × {real.inView} × (π·{tol.toFixed(0)}² ÷ {W}×
            {H})
          </div>
          <div>
            = <b className="text-base">{real.expected.toFixed(1)}개</b>
          </div>
        </div>

        <div className="bg-base-300/60 rounded-box flex flex-col gap-1 p-3">
          <div className="text-sm opacity-70">
            판정 규칙 ①: 겹친 별 ÷ 우연 기대치
          </div>
          <div>
            <span className="text-green-400">{shown}개</span> ÷{" "}
            {real.expected.toFixed(1)}개 ={" "}
            <b className="text-lg">{ratio.toFixed(ratio < 10 ? 1 : 0)}배</b>{" "}
            {meant ? "≥" : "<"} {RATIO}배
          </div>
          <div className="text-xs opacity-60">
            우연이라면 {real.expected.toFixed(1)}개쯤 겹칠 텐데, {how} {shown}
            개가 겹쳤다
          </div>
          <div
            className={`text-lg font-bold ${meant ? "text-green-400" : "opacity-70"}`}
          >
            {meant ? "→ 필연!" : "→ 우연"}
          </div>
        </div>
      </div>
    </div>
  );
}
