"use client";

import type { ShapeMatch } from "@/game/drawConstellation/shapeMatch";
import type { Point2D } from "@/scripts/hash/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { likelihoods, matchShape } from "@/game/drawConstellation/shapeMatch";
import { canvasPoint } from "@/game/sky/ItemInfo";
import { cn } from "@/utils/cn";

// 점 찍어 별자리 찾기 (docs/game-plans.md 4): 점을 찍을 때마다 지금까지의 모양과 가장 닮은 진짜 별자리를
// 알려 준다. "기억으로 그리기"에서는 제시한 별자리를 그리고 얼마나 닮았는지 점수를 받는다.

const W = 960;
const H = 600;
const QUIZ = [
  "오리온자리",
  "카시오페이아자리",
  "백조자리",
  "사자자리",
  "전갈자리",
  "페가수스자리",
  "거문고자리",
  "쌍둥이자리",
  "남십자자리",
  "작은곰자리",
];

type Mode = "free" | "quiz";

export default function DrawGame() {
  const [mode, setMode] = useState<Mode>("free");
  const [points, setPoints] = useState<Point2D[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [graded, setGraded] = useState<{
    rank: number;
    match: ShapeMatch | null;
    score: number;
  } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const matches = useMemo(() => matchShape(points, 3), [points]);
  const probs = likelihoods(matches);
  const quizTarget = QUIZ[quizIndex % QUIZ.length];
  // 겹쳐 그릴 모양: 자유 모드는 1위, 채점 뒤에는 정답 별자리
  const overlay =
    mode === "quiz" ? (graded?.match ?? null) : (matches[0] ?? null);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");

    if (!ctx) {
      return;
    }

    ctx.fillStyle = "#070b18";
    ctx.fillRect(0, 0, W, H);

    if (overlay) {
      ctx.strokeStyle = "rgba(250,210,80,0.55)";
      ctx.lineWidth = 2;

      for (const line of overlay.template.lines) {
        ctx.beginPath();
        line
          .map(overlay.toScreen)
          .forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(250,210,80,0.5)";

      for (const p of overlay.template.points.map(overlay.toScreen)) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 내가 찍은 점 (별처럼)
    for (const [x, y] of points) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 14);
      glow.addColorStop(0, "rgba(255,255,255,0.8)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - 14, y - 14, 28, 28);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.fill();
    }
  }, [points, overlay]);

  const add = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (graded) {
      return;
    }

    const p = canvasPoint(e);
    setPoints((ps) => [...ps, [p.x, p.y]]);
  };

  const reset = () => {
    setPoints([]);
    setGraded(null);
  };

  const grade = () => {
    const all = matchShape(points, 200);
    const rank = all.findIndex((m) => m.label === quizTarget);
    const match = rank >= 0 ? all[rank] : null;
    const score = match
      ? Math.round(
          Math.max(0, 1 - match.score / 0.4) * 1000 * (rank === 0 ? 1 : 0.6),
        )
      : 0;
    setGraded({ rank, match, score });
  };

  return (
    <div className="flex w-full max-w-[1280px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">점 찍어 별자리 찾기</h1>
        <div className="join">
          {(
            [
              ["free", "자유롭게"],
              ["quiz", "기억으로 그리기"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              className={cn(
                "join-item btn btn-sm",
                mode === m && "btn-primary",
              )}
              onClick={() => {
                setMode(m);
                reset();
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grow" />
        <button
          className="btn btn-sm"
          onClick={() => setPoints((ps) => ps.slice(0, -1))}
          disabled={points.length === 0 || graded !== null}
        >
          하나 지우기
        </button>
        <button className="btn btn-sm" onClick={reset}>
          모두 지우기
        </button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <canvas
          ref={canvas}
          width={W}
          height={H}
          className="rounded-box w-full cursor-crosshair md:w-auto md:max-w-[960px] md:grow"
          onClick={add}
        />
        <div className="bg-base-200 rounded-box flex w-full shrink-0 flex-col gap-3 p-4 md:w-72">
          {mode === "free" ? (
            <>
              <div className="text-sm opacity-70">
                빈 하늘에 점을 하나씩 찍어 보세요. 3개부터 닮은 별자리를 찾아요.
              </div>
              {matches.length === 0 && (
                <div className="text-sm">점 {points.length}개 · 조금만 더!</div>
              )}
              {matches.map((m, i) => (
                <div key={m.label} className="flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className={cn(i === 0 && "text-lg font-bold")}>
                      {i + 1}. {m.label}
                    </span>
                    <span className="text-sm">
                      {Math.round(probs[i] * 100)}%
                    </span>
                  </div>
                  <progress
                    className="progress progress-warning"
                    value={probs[i]}
                    max={1}
                  />
                </div>
              ))}
              {matches.length > 0 && (
                <div className="text-xs opacity-60">
                  금색 선은 1위 별자리를 내 점에 맞춰 겹친 모양이에요. 모양은
                  크기·회전과 상관없이 같아요 — 플레이트 솔버가 사진 속 별
                  무리를 알아보는 방법과 같아요.
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-sm opacity-70">기억으로 그려 보세요</div>
              <div className="text-2xl font-bold">{quizTarget}</div>
              <div className="text-xs opacity-60">
                별 하나에 점 하나씩 찍고 &quot;다 그렸어요&quot;를 누르세요.
              </div>
              {!graded ? (
                <button
                  className="btn btn-primary btn-sm"
                  disabled={points.length < 3}
                  onClick={grade}
                >
                  다 그렸어요 (점 {points.length}개)
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="text-3xl font-bold">{graded.score}점</div>
                  <div className="text-sm">
                    {graded.rank === 0
                      ? `내 그림과 가장 닮은 별자리가 ${quizTarget}예요!`
                      : graded.rank > 0
                        ? `${quizTarget}는 ${graded.rank + 1}번째로 닮았어요. 금색이 실제 모양이에요.`
                        : `점이 ${quizTarget}의 별 수보다 많아요. 별 하나에 점 하나씩 찍어 보세요.`}
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setQuizIndex((q) => q + 1);
                      reset();
                    }}
                  >
                    다음 별자리
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
