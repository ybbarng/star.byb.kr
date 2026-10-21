"use client";

import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { useEffect, useMemo, useRef, useState } from "react";
import { STARS } from "@/game/sky/catalog";
import { ACCEPT } from "@/search/solvers/candidates";
import { poissonTailNegLog10 } from "@/search/utils/stats";
import { projectVecToPhoto } from "@/search/utils/wcs";

// 우연과 필연 데모: 서울 누각 사진의 진짜 답으로, 답대로 놓은 지도 별이 사진 별과 몇 개 겹치는지 보이고,
// 같은 수의 지도 별을 사진 위에 아무 데나 뿌려 우연히 몇 개 겹치는지 센다. 그 평균이 우연 기대치다.
// 기대치 = 사진 별 수 × 화면 안 지도 별 수 × (허용 반경 원 넓이 ÷ 사진 넓이) — solveCore와 같은 식.
// 판정: 식별에 쓴 별(답을 만들 때 쓴 별, 당연히 겹친다)을 뺀 겹친 별이 우연으로 나올 확률(푸아송 꼬리)이
// 기준(10억 분의 1)보다 작으면 필연이다 — solveCore·candidates.ts와 같은 판정.
// 풀이(solveCore)는 원근 변환으로 다듬은 답이면 변환을 정하는 대응 4쌍만큼 빼서(식별에 쓴 별이 3개여도 4개)
// 이 답을 10⁻¹⁶·⁸로 기록한다. 데모는 화면에 보이는 "식별에 쓴 별 3 + 그 밖에 26"과 맞춰 3개를 빼고 10⁻¹⁷·⁸로 보인다.
// 어느 쪽이든 기준 10⁻⁹보다 한참 작아 판정은 같다.
// 자료: public/learn/candidates-seoul.json (scripts/learn/buildDemoData.ts)

const SRC = "/samples/20220607-berry-seoul.jpg";

interface Answer {
  TP: Mat3;
  photo: Point2D[];
  seeds: number[]; // 식별에 쓴 별 (사진 별 번호)
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

    // 답대로 놓았을 때 식별에 쓴 별: 빨간 원과 점선 외곽선 (아무 데나 뿌릴 때는 없다)
    const seeds = mode === "answer" ? data.real.seeds : [];

    if (seeds.length >= 3) {
      context.lineWidth = 1.5;
      context.strokeStyle = "#ef4444";
      context.setLineDash([5, 5]);
      context.beginPath();
      seeds.forEach((i, n) => {
        const [x, y] = data.real.photo[i];

        if (n) context.lineTo(x * k, y * k);
        else context.moveTo(x * k, y * k);
      });
      context.closePath();
      context.stroke();
      context.setLineDash([]);
    }

    // 겹친 별: 그 밖에 겹친 별은 초록 원, 식별에 쓴 별은 빨간 원
    context.lineWidth = 4;

    for (const i of matched) {
      const [x, y] = data.real.photo[i];
      context.strokeStyle = seeds.includes(i) ? "#ef4444" : "#4ade80";
      context.beginPath();
      context.arc(x * k, y * k, 17, 0, 2 * Math.PI);
      context.stroke();
    }
  }, [data, image, map, matched, mode]);

  if (!data) {
    return <div className="text-sm opacity-60">자료를 불러오는 중…</div>;
  }

  const { real, tol, W, H } = data;
  const average =
    hits.length > 0 ? hits.reduce((a, b) => a + b, 0) / hits.length : null;
  // 지금 그린 배치(답대로 또는 이번에 뿌린 것)를 같은 기준으로 판정한다. 답대로 놓을 때는 식별에 쓴 별을 뺀다
  const seedCount = mode === "answer" ? real.seeds.length : 0;
  const shown =
    (mode === "answer" ? real.count : (hits.at(-1) ?? 0)) - seedCount;
  const logOdds = poissonTailNegLog10(shown, real.expected);
  const meant = logOdds >= ACCEPT.minLogOdds;
  const chance =
    logOdds < 2 ? (
      <>{Math.round(100 * 10 ** -logOdds)}%</>
    ) : (
      <>
        10<sup>-{logOdds.toFixed(1)}</sup>
      </>
    );

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
            <span className="text-red-500">◯</span> 식별에 쓴 별
          </li>
          <li>
            <span className="text-green-400">◯</span> 그 밖에 겹친 별
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
          <div className="bg-base-300/60 rounded-box flex flex-col gap-1 p-3">
            <div>
              답대로 놓으면 겹친 별 <b className="text-lg">{real.count}개</b>
            </div>
            <div className="text-sm opacity-80">
              = 식별에 쓴 별{" "}
              <span className="text-red-400">{real.seeds.length}</span> + 그
              밖에 <b className="text-green-400">{shown}</b>
            </div>
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
            우연이라면 {real.expected.toFixed(1)}개쯤 겹칠 텐데{" "}
            <span className="text-green-400">{shown}개</span> 이상 겹칠 확률
          </div>
          <div>
            <b className="text-lg">{chance}</b> {meant ? "<" : ">"} 기준 10
            <sup>-{ACCEPT.minLogOdds}</sup>
            <span className="text-xs opacity-60"> (10억 분의 1)</span>
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
