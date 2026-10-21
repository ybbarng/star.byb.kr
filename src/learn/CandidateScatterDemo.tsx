"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ACCEPT } from "@/search/solvers/candidates";
import { poissonTailNegLog10 } from "@/search/utils/stats";

// 후보 전부를 한 그래프에: 서울 누각 사진 한 장을 풀며 실제로 검증한 후보 1만여 개를
// 가로 = 우연히 겹칠 기대치(로그 눈금), 세로 = 겹친 별 수로 찍는다. 녹색이 별을 맞게 식별한 진짜 답, 나머지가 가짜다.
//   ① 규칙 ①(필연): 겹친 수 ÷ 기대치 ≥ 5
//   ② 식별에 쓴 별 빼기: 답을 만들 때 쓴 별은 당연히 겹치니 세지 않는다
//   ③ 우연일 확률로: 기대치가 λ일 때 우연히 k개 넘게 겹칠 확률이 10억 분의 1보다 작아야 한다
// "라운드 진행"은 풀이처럼 사진 별 15·25·40·60개 라운드를 차례로 돈다.
//   ①②(옛 풀이): 라운드마다 필연 중 겹친 별이 가장 많은 답을 고르고, 네 라운드를 다 돈 뒤 배수가 가장 높은 답을 낸다
//   ③(지금 풀이): 통과한 답이 나오면 그 라운드에서 멈춘다
// 자료: public/learn/candidates-seoul.json (scripts/learn/buildDemoData.ts)

// 겹친 수, 짝 수(3 삼각형, 4 quad), 기대치, 우연일 확률(-log10), 진짜, 넣은 사진 별 수
type Point = [number, number, number, number, number, number];

interface Data {
  points: Point[];
}

type Step = "ratio" | "noSeeds" | "chance";

const STEPS: { key: Step; label: string }[] = [
  { key: "ratio", label: "① 우연의 5배를 넘으면 필연" },
  { key: "noSeeds", label: "② 식별에 쓴 별 빼기" },
  { key: "chance", label: "③ 우연일 확률로 (10억 분의 1)" },
];
const ROUNDS = [15, 25, 40, 60];
const ROUND_MS = 1100;
// 배수 순위대로 노란 원의 진하기 (1위가 가장 진하다)
const RANK_ALPHA = [1, 0.7, 0.45, 0.28];

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

interface RoundResult {
  size: number;
  passed: number;
  pick: number | null; // 그 라운드에서 고른 답 (점 번호)
  ratio: number; // 고른 답의 배수 (①②)
  rank: number; // 고른 답들 사이의 배수 순위 (0이 1위, ①②)
}

export default function CandidateScatterDemo() {
  const [data, setData] = useState<Data | null>(null);
  const [step, setStep] = useState<Step>("ratio");
  const [picked, setPicked] = useState<number | null>(null);
  // 후보 1만 개가 어디서 왔는지 (풀이 방식 × 넣은 사진 별 수)
  const [origin, setOrigin] = useState(false);
  // 진행한 라운드 (-1이면 라운드 없이 전체를 본다)
  const [round, setRound] = useState(-1);
  const timer = useRef<number | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;

    fetch("/learn/candidates-seoul.json")
      .then((r) => r.json())
      .then((d: Data) => alive && setData(d));

    return () => {
      alive = false;

      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  const stopPlaying = () => {
    if (timer.current) window.clearInterval(timer.current);

    timer.current = null;
  };

  // 단계마다 세로값(센 별 수)·판정·라운드별 답·최종 답
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
    const ratioOf = (i: number) => counted[i] / data.points[i][2];

    const rounds: RoundResult[] = ROUNDS.map((size) => {
      const inRound = data.points
        .map((_, i) => i)
        .filter((i) => data.points[i][5] === size && pass[i]);
      const pick =
        inRound.sort((a, b) =>
          step === "chance"
            ? data.points[b][3] - data.points[a][3]
            : counted[b] - counted[a] || ratioOf(b) - ratioOf(a),
        )[0] ?? null;

      return {
        size,
        passed: inRound.length,
        pick,
        ratio: pick === null ? 0 : ratioOf(pick),
        rank: 0,
      };
    });

    // 배수 순위 (①②: 이 순위 1위가 최종 답)
    [...rounds]
      .filter((r) => r.pick !== null)
      .sort((a, b) => b.ratio - a.ratio)
      .forEach((r, k) => (r.rank = k));

    // ③은 통과한 답이 처음 나온 라운드에서 멈춘다
    const stopAt =
      step === "chance"
        ? rounds.findIndex((r) => r.pick !== null)
        : ROUNDS.length - 1;
    const lastRound = stopAt < 0 ? ROUNDS.length - 1 : stopAt;
    const final =
      step === "chance"
        ? stopAt < 0
          ? null
          : rounds[stopAt].pick
        : (rounds.find((r) => r.pick !== null && r.rank === 0)?.pick ?? null);

    return { counted, pass, rounds, lastRound, final };
  }, [data, step]);

  // 라운드를 처음부터 차례로 진행한다
  const play = () => {
    if (!view) return;

    stopPlaying();
    setPicked(null);
    setRound(0);
    let r = 0;
    timer.current = window.setInterval(() => {
      r += 1;

      if (r > view.lastRound) {
        stopPlaying();

        return;
      }

      setRound(r);
    }, ROUND_MS);
  };

  const shownRounds = round < 0 ? -1 : Math.min(round, view?.lastRound ?? 0);
  const done = view !== null && round >= view.lastRound;

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

    // 판정 경계 (하늘색): 몇 배 기준은 세로 = 5 × 기대치, 확률 기준은 우연일 확률이 10⁻⁹이 되는 겹친 수
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
    context.fillStyle = "rgba(103,232,249,0.06)";
    context.fill();
    context.strokeStyle = "#67e8f9";
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = "#67e8f9";
    context.fillText(
      step === "chance" ? '이 위면 "찾았다" (10억 분의 1)' : '이 위면 "필연"',
      PAD.left + 8,
      PAD.top + 16,
    );

    // 후보들: 진행한 라운드의 것만 (라운드 없이 보면 전부). 가짜 먼저, 진짜(녹색)는 위에
    const visible = (i: number) =>
      shownRounds < 0 || ROUNDS.indexOf(data.points[i][5]) <= shownRounds;

    for (const real of [0, 1]) {
      data.points.forEach((p, i) => {
        if (p[4] !== real || !visible(i)) return;

        const x = toX(p[2]);
        const y = toY(view.counted[i] + jitter(i));
        context.fillStyle = real
          ? "#22c55e"
          : view.pass[i]
            ? "rgba(248,113,113,0.9)"
            : "rgba(165,180,252,0.35)";
        const r = real ? 4.5 : view.pass[i] ? 2.2 : 1.4;
        context.beginPath();
        context.arc(x, y, r, 0, 2 * Math.PI);
        context.fill();
      });
    }

    const at = (i: number): [number, number] => [
      toX(data.points[i][2]),
      toY(view.counted[i] + jitter(i)),
    ];

    // 라운드마다 고른 답 (노란 원, ①②는 배수 순위대로 진하게)
    if (shownRounds >= 0) {
      context.font = "bold 12px sans-serif";

      view.rounds.slice(0, shownRounds + 1).forEach((r) => {
        if (r.pick === null) return;

        const [x, y] = at(r.pick);
        const alpha = step === "chance" ? 1 : RANK_ALPHA[r.rank];
        context.strokeStyle = `rgba(253,224,71,${alpha})`;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(x, y, 10, 0, 2 * Math.PI);
        context.stroke();
        context.fillStyle = `rgba(253,224,71,${Math.max(0.6, alpha)})`;
        context.fillText(
          step === "chance"
            ? `${r.size}개`
            : `${r.size}개 · ${r.ratio.toFixed(0)}배 · ${r.rank + 1}위`,
          x + 13,
          y - 6,
        );
      });

      // 최종 답 (흰 원)
      if (done && view.final !== null) {
        const [x, y] = at(view.final);
        context.strokeStyle = "#ffffff";
        context.lineWidth = 3;
        context.beginPath();
        context.arc(x, y, 16, 0, 2 * Math.PI);
        context.stroke();
        context.fillStyle = "#ffffff";
        context.font = "bold 14px sans-serif";
        context.fillText(
          `최종 답 (${data.points[view.final][4] ? "진짜" : "가짜"})`,
          x + 13,
          y + 14,
        );
      }

      context.font = "12px sans-serif";
    }

    if (picked !== null) {
      const [x, y] = at(picked);
      context.strokeStyle = "#93c5fd";
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(x, y, 12, 0, 2 * Math.PI);
      context.stroke();
    }
  }, [data, view, step, picked, shownRounds, done]);

  if (!data || !view) {
    return <div className="text-sm opacity-60">자료를 불러오는 중…</div>;
  }

  const realCount = data.points.filter((p) => p[4] === 1).length;
  const passed = view.pass.filter(Boolean).length;
  const passedReal = data.points.filter(
    (p, i) => view.pass[i] && p[4] === 1,
  ).length;
  const verdict = step === "chance" ? "찾았다" : "필연";
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
  const info = picked !== null ? data.points[picked] : null;
  const kind = (i: number) =>
    data.points[i][4] ? (
      <span className="text-green-400">진짜</span>
    ) : (
      <span className="text-red-400">가짜</span>
    );

  // 그래프를 누르면 가장 가까운 후보를 고른다
  const pick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * PLOT_W;
    const y = ((e.clientY - rect.top) / rect.height) * PLOT_H;
    let best = -1;
    let bestD = 12;

    data.points.forEach((p, i) => {
      if (shownRounds >= 0 && ROUNDS.indexOf(p[5]) > shownRounds) return;

      const d = Math.hypot(toX(p[2]) - x, toY(view.counted[i] + jitter(i)) - y);

      if (d < bestD || (d === bestD && p[4] === 1)) {
        bestD = d;
        best = i;
      }
    });

    setPicked(best >= 0 ? best : null);
  };

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_18rem]">
      <canvas
        ref={canvas}
        className="rounded-box h-auto w-full cursor-crosshair"
        style={{ maxHeight: "80vh" }}
        onClick={pick}
      />
      <div className="flex flex-col gap-2 text-base">
        <div className="flex flex-col gap-1">
          {STEPS.map((s) => (
            <button
              key={s.key}
              className={`btn btn-sm justify-start ${step === s.key ? "btn-primary" : ""}`}
              onClick={() => {
                stopPlaying();
                setStep(s.key);
                setPicked(null);
                setRound(-1);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="text-sm opacity-70">
          확인한 후보 <b>{data.points.length.toLocaleString("ko-KR")}개</b> ·{" "}
          <span className="text-green-400">●</span> 맞게 식별한 후보 {realCount}
          개 · <span className="text-red-400">●</span> {verdict}에 든 가짜
        </div>
        <div className="text-sm">
          전체에서 {verdict} <b>{passed.toLocaleString("ko-KR")}개</b> 중 진짜{" "}
          <b className="text-green-400">{passedReal}개</b>
        </div>

        {/* 라운드: 진행한 라운드에 불이 들어온다 */}
        <div className="flex items-center gap-1">
          {ROUNDS.map((size, k) => {
            const lit = shownRounds >= k;
            const skipped = round >= 0 && done && k > view.lastRound;

            return (
              <span
                key={size}
                className={`rounded-box flex-1 py-1 text-center text-sm ${
                  lit
                    ? "bg-yellow-300 font-bold text-black"
                    : skipped
                      ? "bg-base-300/40 line-through opacity-40"
                      : "bg-base-300/60 opacity-60"
                }`}
              >
                {size}개
              </span>
            );
          })}
          <button className="btn btn-sm btn-secondary" onClick={play}>
            ▶
          </button>
        </div>

        {round >= 0 && (
          <div className="bg-base-300/60 rounded-box flex flex-col gap-1 p-2 text-sm">
            {view.rounds.slice(0, shownRounds + 1).map((r) => (
              <div key={r.size}>
                <b>{r.size}개</b>: {verdict} {r.passed}개
                {r.pick === null ? (
                  step === "chance" ? (
                    " → 모르겠다, 다음"
                  ) : (
                    " → 답 없음"
                  )
                ) : step === "chance" ? (
                  <> → 찾았다, 멈춤 ({kind(r.pick)})</>
                ) : (
                  <>
                    {" "}
                    → 답 {view.counted[r.pick]}개·{r.ratio.toFixed(0)}배 (
                    {kind(r.pick)})
                  </>
                )}
              </div>
            ))}
            {done && (
              <div className="border-base-content/10 mt-1 border-t pt-1 font-bold">
                {view.final === null ? (
                  "최종: 모르겠다"
                ) : step === "chance" ? (
                  <>최종 답: {kind(view.final)}</>
                ) : (
                  <>최종 답 = 배수 1위: {kind(view.final)}</>
                )}
              </div>
            )}
          </div>
        )}

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
        {info && !origin && picked !== null && (
          <div className="bg-base-300/60 rounded-box flex flex-col gap-1 p-3 text-sm">
            <div className="text-sm font-bold">누른 후보 — {kind(picked)}</div>
            <div>
              겹친 별 {info[0]}개 = 식별에 쓴 별 {info[1]} + 그 밖에{" "}
              {info[0] - info[1]}
            </div>
            <div>
              {info[1] === 3 ? "삼각형" : "quad"}, 사진 별 {info[5]}개 라운드
            </div>
            <div>우연히 겹칠 기대치 {info[2]}개</div>
            <div>
              몇 배: {(info[0] / info[2]).toFixed(0)}배
              {step !== "ratio" &&
                ` → 식별에 쓴 별 빼면 ${((info[0] - info[1]) / info[2]).toFixed(0)}배`}
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
