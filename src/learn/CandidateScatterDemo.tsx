"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ACCEPT } from "@/search/solvers/candidates";
import { poissonTailNegLog10 } from "@/search/utils/stats";

// 후보 전부를 한 그래프에: 서울 누각 사진 한 장을 풀며 실제로 검증한 후보 1만여 개를
// 가로 = 우연히 겹칠 기대치(로그 눈금), 세로 = 겹친 별 수로 찍는다. 노랑이 진짜 답, 나머지가 가짜다.
//   ① 몇 배로 고르기: 겹친 수 ÷ 기대치 ≥ 5 (옛 기준). 기대치가 아주 작은 가짜가 위로 솟는다
//   ② 짝지은 별 빼기: 답을 만들 때 쓴 별은 당연히 겹치니 세지 않는다
//   ③ 우연일 확률로: 기대치가 λ일 때 우연히 k개 넘게 겹칠 확률이 10억 분의 1보다 작아야 한다
// 자료: public/learn/candidates-seoul.json (scripts/learn/buildDemoData.ts)

// 겹친 수, 짝 수(3 삼각형, 4 quad), 기대치, 우연일 확률(-log10), 진짜, 넣은 사진 별 수
type Point = [number, number, number, number, number, number];

interface Data {
  points: Point[];
}

type Step = "ratio" | "noSeeds" | "chance";

const STEPS: { key: Step; label: string }[] = [
  { key: "ratio", label: "① 몇 배로 고르기" },
  { key: "noSeeds", label: "② 짝지은 별 빼기" },
  { key: "chance", label: "③ 우연일 확률로" },
];

const PLOT_W = 760;
const PLOT_H = 480;
const PAD = { left: 52, right: 16, top: 16, bottom: 40 };
const X_MIN = -1.5; // log10 기대치
const X_MAX = 1.15;
const Y_MAX = 32;

const toX = (expected: number) =>
  PAD.left +
  ((Math.log10(Math.max(10 ** X_MIN, expected)) - X_MIN) / (X_MAX - X_MIN)) *
    (PLOT_W - PAD.left - PAD.right);
const toY = (count: number) =>
  PLOT_H - PAD.bottom - (count / Y_MAX) * (PLOT_H - PAD.top - PAD.bottom);

// 겹친 수가 같은 점이 한 줄로 포개지지 않게 조금씩 흩는다 (늘 같은 자리에)
const jitter = (i: number) => (((i * 2654435761) % 1000) / 1000 - 0.5) * 0.7;

export default function CandidateScatterDemo() {
  const [data, setData] = useState<Data | null>(null);
  const [step, setStep] = useState<Step>("ratio");
  const [picked, setPicked] = useState<number | null>(null);
  // 후보 1만 개가 어디서 왔는지 (풀이 방식 × 넣은 사진 별 수)
  const [origin, setOrigin] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;

    fetch("/learn/candidates-seoul.json")
      .then((r) => r.json())
      .then((d: Data) => alive && setData(d));

    return () => {
      alive = false;
    };
  }, []);

  // 단계마다 세로값(센 별 수)과 "찾았다" 판정, 그리고 1등
  const view = useMemo(() => {
    if (!data) return null;

    const counted = data.points.map(([n, seeds]) =>
      step === "ratio" ? n : n - seeds,
    );
    const pass = data.points.map(([n, , e, logOdds], i) =>
      step === "chance"
        ? logOdds >= ACCEPT.minLogOdds
        : n >= ACCEPT.minInlier && counted[i] / e >= ACCEPT.minSignificance,
    );
    const rank = (i: number) =>
      step === "chance" ? data.points[i][3] : counted[i] / data.points[i][2];
    const order = data.points
      .map((_, i) => i)
      .filter((i) => pass[i])
      .sort((a, b) => rank(b) - rank(a));
    const firstReal = order.findIndex((i) => data.points[i][4] === 1);

    return { counted, pass, order, firstReal, rank };
  }, [data, step]);

  useEffect(() => {
    const el = canvas.current;
    const context = el?.getContext("2d");

    if (!el || !context || !data || !view) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = PLOT_W * dpr;
    el.height = PLOT_H * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = "#0b0f22";
    context.fillRect(0, 0, PLOT_W, PLOT_H);

    // 축과 눈금
    context.strokeStyle = "rgba(255,255,255,0.15)";
    context.fillStyle = "rgba(255,255,255,0.6)";
    context.font = "12px sans-serif";
    context.lineWidth = 1;

    for (const e of [0.1, 1, 10]) {
      context.beginPath();
      context.moveTo(toX(e), PAD.top);
      context.lineTo(toX(e), PLOT_H - PAD.bottom);
      context.stroke();
      context.fillText(`${e}개`, toX(e) - 12, PLOT_H - PAD.bottom + 16);
    }

    for (let c = 0; c <= 30; c += 5) {
      context.beginPath();
      context.moveTo(PAD.left, toY(c));
      context.lineTo(PLOT_W - PAD.right, toY(c));
      context.stroke();
      context.fillText(`${c}`, PAD.left - 22, toY(c) + 4);
    }

    context.fillText(
      "우연히 겹칠 기대치 (로그 눈금) →",
      PLOT_W - 230,
      PLOT_H - 6,
    );
    context.save();
    context.translate(14, PLOT_H / 2 + 60);
    context.rotate(-Math.PI / 2);
    context.fillText(
      step === "ratio" ? "겹친 별 수 →" : "더 겹친 별 수 →",
      0,
      0,
    );
    context.restore();

    // "찾았다" 경계: 몇 배 기준은 세로 = 5 × 기대치, 확률 기준은 우연일 확률이 10⁻⁹이 되는 겹친 수
    context.beginPath();

    for (let lx = X_MIN; lx <= X_MAX; lx += 0.01) {
      const e = 10 ** lx;
      let k: number;

      if (step === "chance") {
        k = 0;

        while (poissonTailNegLog10(k, e) < ACCEPT.minLogOdds && k < 60) k++;
      } else {
        k = Math.max(
          ACCEPT.minSignificance * e,
          step === "ratio" ? ACCEPT.minInlier : 0,
        );
      }

      const y = toY(Math.min(Y_MAX, k));

      if (lx === X_MIN) context.moveTo(toX(e), y);
      else context.lineTo(toX(e), y);
    }

    context.lineTo(PLOT_W - PAD.right, PAD.top);
    context.lineTo(PAD.left, PAD.top);
    context.closePath();
    context.fillStyle = "rgba(74,222,128,0.07)";
    context.fill();
    context.strokeStyle = "#4ade80";
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = "#4ade80";
    context.fillText('이 위면 "찾았다"', PAD.left + 8, PAD.top + 16);

    // 후보들: 가짜 먼저, 진짜는 위에
    for (const real of [0, 1]) {
      data.points.forEach((p, i) => {
        if (p[4] !== real) return;

        const x = toX(p[2]);
        const y = toY(view.counted[i] + jitter(i));
        context.fillStyle = real
          ? "#fde68a"
          : view.pass[i]
            ? "rgba(248,113,113,0.9)"
            : "rgba(165,180,252,0.35)";
        const r = real ? 3.5 : view.pass[i] ? 2.2 : 1.4;
        context.beginPath();
        context.arc(x, y, r, 0, 2 * Math.PI);
        context.fill();
      });
    }

    // 1등과 고른 점
    const mark = (i: number, color: string, label: string) => {
      const x = toX(data.points[i][2]);
      const y = toY(view.counted[i] + jitter(i));
      context.strokeStyle = color;
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(x, y, 10, 0, 2 * Math.PI);
      context.stroke();
      context.fillStyle = color;
      context.font = "bold 13px sans-serif";
      context.fillText(label, x + 13, y - 8);
      context.font = "12px sans-serif";
    };

    if (view.order.length > 0) {
      const top = view.order[0];
      mark(top, "#ffffff", data.points[top][4] ? "1등 (진짜)" : "1등 (가짜)");
    }

    if (picked !== null && picked !== view.order[0]) {
      mark(picked, "#93c5fd", "");
    }
  }, [data, view, step, picked]);

  if (!data || !view) {
    return <div className="text-sm opacity-60">자료를 불러오는 중…</div>;
  }

  const realCount = data.points.filter((p) => p[4] === 1).length;
  const passed = view.order.length;
  const passedReal = view.order.filter((i) => data.points[i][4] === 1).length;
  const show = picked ?? view.order[0];
  const groups = (["삼각형", "quad"] as const).map((method) => {
    const seeds = method === "삼각형" ? 3 : 4;
    const sizes = [
      ...new Set(data.points.filter((p) => p[1] === seeds).map((p) => p[5])),
    ].sort((a, b) => a - b);

    return {
      method,
      rows: sizes.map((size) => ({
        size,
        count: data.points.filter((p) => p[1] === seeds && p[5] === size)
          .length,
      })),
    };
  });
  const most = Math.max(...groups.flatMap((g) => g.rows.map((r) => r.count)));
  const info = show !== undefined ? data.points[show] : null;

  // 그래프를 누르면 가장 가까운 후보를 고른다
  const pick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * PLOT_W;
    const y = ((e.clientY - rect.top) / rect.height) * PLOT_H;
    let best = -1;
    let bestD = 12;

    data.points.forEach((p, i) => {
      const d = Math.hypot(toX(p[2]) - x, toY(view.counted[i] + jitter(i)) - y);

      if (d < bestD || (d === bestD && p[4] === 1)) {
        bestD = d;
        best = i;
      }
    });

    setPicked(best >= 0 ? best : null);
  };

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_17rem]">
      <canvas
        ref={canvas}
        className="rounded-box h-auto w-full cursor-crosshair"
        style={{ maxHeight: "80vh" }}
        onClick={pick}
      />
      <div className="flex flex-col gap-3 text-base">
        <div className="flex flex-col gap-2">
          {STEPS.map((s) => (
            <button
              key={s.key}
              className={`btn btn-sm justify-start ${step === s.key ? "btn-primary" : ""}`}
              onClick={() => {
                setStep(s.key);
                setPicked(null);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="text-sm opacity-70">
          사진 한 장에서 확인한 후보{" "}
          <b>{data.points.length.toLocaleString("ko-KR")}개</b>
          <br />
          <span className="text-amber-200">●</span> 정답 자리 후보 {realCount}개
          · <span className="text-red-400">●</span> &ldquo;찾았다&rdquo;에 든
          가짜
        </div>
        <div className="bg-base-300/60 rounded-box p-3">
          &ldquo;찾았다&rdquo; <b>{passed.toLocaleString("ko-KR")}개</b> 중 진짜{" "}
          {passedReal}개
          <br />
          {view.firstReal >= 0 ? (
            <span className="text-sm opacity-80">
              진짜 답의 순위: <b>{view.firstReal + 1}등</b>
            </span>
          ) : (
            <span className="text-sm opacity-80">진짜 답이 들지 못했다</span>
          )}
        </div>
        <button
          className={`btn btn-sm ${origin ? "btn-secondary" : ""}`}
          onClick={() => setOrigin((o) => !o)}
        >
          후보는 어디서 왔나?
        </button>
        {origin && (
          <div className="bg-base-300/60 rounded-box flex flex-col gap-2 p-3 text-sm">
            <div>
              사진 별 앞쪽 n개로 묶음을 만들고, 묶음마다 화각 9가지 × 모양이
              가까운 8개를 확인한다
            </div>
            {groups.map((g) => (
              <div key={g.method} className="flex flex-col gap-1">
                <div className="font-bold">{g.method}</div>
                {g.rows.map((r) => (
                  <div key={r.size} className="flex items-center gap-2">
                    <span className="w-14 shrink-0">별 {r.size}개</span>
                    <span className="h-3 flex-1 rounded bg-black/40">
                      <span
                        className="block h-3 rounded bg-indigo-300"
                        style={{ width: `${(r.count / most) * 100}%` }}
                      />
                    </span>
                    <span className="w-12 text-right font-mono">
                      {r.count.toLocaleString("ko-KR")}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {info && !origin && (
          <div className="bg-base-300/60 rounded-box flex flex-col gap-1 p-3 text-sm">
            <div className="text-sm font-bold">
              {picked === null ? "1등 후보" : "고른 후보"} —{" "}
              {info[4] ? (
                <span className="text-amber-200">진짜</span>
              ) : (
                <span className="text-red-400">가짜</span>
              )}
            </div>
            <div>
              겹친 별 {info[0]}개 = 짝지은 별 {info[1]} + 더 겹친 별{" "}
              {info[0] - info[1]}
            </div>
            <div>
              {info[1] === 3 ? "삼각형" : "quad"}, 사진 별 {info[5]}개 묶음에서
            </div>
            <div>우연히 겹칠 기대치 {info[2]}개</div>
            <div>
              몇 배: {(info[0] / info[2]).toFixed(0)}배
              {step !== "ratio" &&
                ` → 짝 빼면 ${((info[0] - info[1]) / info[2]).toFixed(0)}배`}
            </div>
            <div>
              우연일 확률: 10<sup>-{info[3].toFixed(1)}</sup>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
