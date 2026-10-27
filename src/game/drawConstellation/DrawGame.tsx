"use client";

import type { ShapeMatch } from "@/game/drawConstellation/shapeMatch";
import type { Point2D } from "@/scripts/hash/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { likelihoods, matchShape } from "@/game/drawConstellation/shapeMatch";
import {
  ChoiceCards,
  CountUp,
  FxLayer,
  GameIntro,
  readBest,
  ResultCard,
  RoundBanner,
  saveBest,
  useFx,
} from "@/game/fx/Fx";
import LineReveal from "@/game/fx/LineReveal";
import { sfx } from "@/game/fx/sound";
import { canvasPoint } from "@/game/sky/ItemInfo";
import { cn } from "@/utils/cn";
import { createRng } from "@/utils/rng";

// 점 찍어 별자리 찾기 (docs/game-plans.md 4): 점을 찍을 때마다 지금까지의 모양과 가장 닮은 진짜 별자리를
// 알려 준다. "기억으로 그리기"는 별자리 다섯 개를 차례로 그리고, 얼마나 닮았는지 점수를 받는 게임이다.

// 점을 찍는 빈 하늘. 휴대폰(좁은 화면)에서는 세로로 길게 (가로로 긴 하늘은 폭에 맞추면 너무 낮았다)
const LANDSCAPE = { width: 960, height: 600 };
const PORTRAIT = { width: 600, height: 840 };
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
const QUIZ_ROUNDS = 5;
const MAX_POINTS = 1000;

type Mode = "free" | "quiz";
type Phase = "intro" | "play" | "over";

interface Graded {
  rank: number;
  match: ShapeMatch | null;
  score: number;
}

// 채점: 내 그림과 닮은 순위에서 정답 별자리가 몇 번째인지, 얼마나 가까운지
const gradeDrawing = (points: Point2D[], target: string): Graded => {
  const all = matchShape(points, 200);
  const rank = all.findIndex((m) => m.label === target);
  const match = rank >= 0 ? all[rank] : null;
  const score = match
    ? Math.round(
        Math.max(0, 1 - match.score / 0.4) *
          MAX_POINTS *
          (rank === 0 ? 1 : 0.6),
      )
    : 0;

  return { rank, match, score };
};

export default function DrawGame() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<Mode>("free");
  const [seed, setSeed] = useState(1);
  const [scores, setScores] = useState<number[]>([]);
  const [newBest, setNewBest] = useState(false);

  if (phase === "intro") {
    return (
      <GameIntro
        title="점 찍어 별자리 찾기"
        tagline="밤하늘에 점을 찍으면, 닮은 별자리가 나타나요!"
        howTo={
          mode === "free"
            ? [
                "빈 하늘에 점을 하나씩 찍어요.",
                "점이 3개를 넘으면 지금 모양과 가장 닮은 진짜 별자리를 알려 줘요.",
                "크기나 방향은 상관없어요. 비뚤어지게 그려도 찾아내요!",
              ]
            : [
                `별자리 이름이 ${QUIZ_ROUNDS}번 나와요. 기억을 더듬어 별 하나에 점 하나씩 찍어요.`,
                "다 그렸으면 채점! 실제 모양과 닮을수록 점수가 높아요.",
                "크기나 방향은 상관없어요. 별의 배치만 닮으면 돼요.",
              ]
        }
        onStart={() => {
          setSeed(Math.floor(Math.random() * 1e9));
          setScores([]);
          setPhase("play");
        }}
      >
        <ChoiceCards
          options={[
            {
              value: "free",
              title: "자유롭게",
              note: "그리는 대로 알아맞혀요",
            },
            {
              value: "quiz",
              title: "기억으로 그리기",
              note: `${QUIZ_ROUNDS}문제 점수 도전`,
            },
          ]}
          value={mode}
          onChange={setMode}
        />
      </GameIntro>
    );
  }

  if (phase === "over") {
    const total = scores.reduce((a, b) => a + b, 0);
    const stars = total >= 3500 ? 3 : total >= 2200 ? 2 : total > 0 ? 1 : 0;

    return (
      <ResultCard
        title="별자리 화가 결과"
        score={total}
        stars={stars}
        best={readBest("draw-quiz")}
        newBest={newBest}
        actions={
          <>
            <button
              className="btn btn-primary"
              onClick={() => {
                setSeed(Math.floor(Math.random() * 1e9));
                setScores([]);
                setPhase("play");
              }}
            >
              다시 하기
            </button>
            <button className="btn" onClick={() => setPhase("intro")}>
              처음으로
            </button>
          </>
        }
      />
    );
  }

  return (
    <DrawPlay
      mode={mode}
      seed={seed}
      scores={scores}
      onScore={(s) => setScores((ss) => [...ss, s])}
      onFinish={(total) => {
        setNewBest(saveBest("draw-quiz", total));
        setPhase("over");
      }}
      onBack={() => setPhase("intro")}
    />
  );
}

function DrawPlay({
  mode,
  seed,
  scores,
  onScore,
  onFinish,
  onBack,
}: {
  mode: Mode;
  seed: number;
  scores: number[];
  onScore: (s: number) => void;
  onFinish: (total: number) => void;
  onBack: () => void;
}) {
  const [{ width: W, height: H }] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches
      ? PORTRAIT
      : LANDSCAPE,
  );
  const [points, setPoints] = useState<Point2D[]>([]);
  const [round, setRound] = useState(0);
  const [graded, setGraded] = useState<Graded | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const fx = useFx();
  const lastTop = useRef<string | null>(null);
  const matches = useMemo(() => matchShape(points, 3), [points]);
  const probs = likelihoods(matches);
  // 이번 판의 문제 순서
  const quiz = useMemo(() => {
    const rng = createRng(seed);

    return [...QUIZ]
      .map((label) => ({ label, k: rng() }))
      .sort((a, b) => a.k - b.k)
      .map(({ label }) => label);
  }, [seed]);
  const quizTarget = quiz[round % quiz.length];
  const total = scores.reduce((a, b) => a + b, 0);
  // 자유 모드는 1위 모양을 흐리게 겹쳐 둔다 (채점 뒤에는 정답 모양이 그려진다)
  const overlay = mode === "free" ? (matches[0] ?? null) : null;
  const revealLines = useMemo(
    () =>
      graded?.match
        ? graded.match.template.lines.map((l) => l.map(graded.match!.toScreen))
        : [],
    [graded],
  );

  // 자유 모드: 1위가 바뀌면 이름이 떠오른다
  useEffect(() => {
    const top = mode === "free" ? (matches[0]?.label ?? null) : null;

    if (top && top !== lastTop.current) {
      fx.popup(0.5, 0.12, `${top}?`, "#ffe27a", 34);
      sfx.whoosh();
    }

    lastTop.current = top;
  }, [matches, mode, fx]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");

    if (!ctx) {
      return;
    }

    ctx.fillStyle = "#070b18";
    ctx.fillRect(0, 0, W, H);

    if (overlay) {
      ctx.strokeStyle = "rgba(250,210,80,0.5)";
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
  }, [points, overlay, W, H]);

  const add = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (graded) {
      return;
    }

    const p = canvasPoint(e);
    setPoints((ps) => [...ps, [p.x, p.y]]);
    sfx.twinkle(points.length);
    fx.burst(p.fx, p.fy, "#ffffff", 8);
  };

  const reset = () => {
    setPoints([]);
    setGraded(null);
  };

  const grade = () => {
    const g = gradeDrawing(points, quizTarget);
    setGraded(g);
    onScore(g.score);

    if (g.rank === 0) {
      sfx.hit();
      fx.popup(0.5, 0.4, "똑같아요!", "#7dffa0", 48);
    } else if (g.rank > 0 && g.rank < 3) {
      sfx.twinkle(4);
      fx.popup(0.5, 0.4, "비슷해요!", "#ffe27a", 40);
    } else if (g.score > 0) {
      sfx.twinkle(0);
      fx.popup(0.5, 0.4, "조금 닮았어요", "#ffe27a", 36);
    } else {
      sfx.miss();
      fx.popup(0.5, 0.4, "아쉬워요", "#ffb4b4", 40);
    }
  };

  const nextRound = () => {
    if (round + 1 >= QUIZ_ROUNDS) {
      onFinish(total);

      return;
    }

    setRound((r) => r + 1);
    reset();
  };

  return (
    <div className="flex w-full max-w-[1280px] flex-col gap-3">
      <div className="bg-base-200/80 rounded-box flex flex-wrap items-center gap-3 px-4 py-2 backdrop-blur">
        <h1 className="text-xl font-bold">점 찍어 별자리 찾기</h1>
        {mode === "quiz" && (
          <>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: QUIZ_ROUNDS }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-3 w-3 rounded-full",
                    i < scores.length
                      ? scores[i] > 0
                        ? "bg-amber-300 shadow-[0_0_8px_rgba(255,210,80,0.8)]"
                        : "bg-red-400"
                      : i === round
                        ? "bg-white/80 ring-2 ring-white/40"
                        : "bg-white/20",
                  )}
                />
              ))}
            </div>
            <div className="text-2xl font-black text-amber-200 tabular-nums">
              <CountUp value={total} duration={900} />
              <span className="ml-1 text-sm font-normal opacity-70">점</span>
            </div>
          </>
        )}
        <div className="grow" />
        <button
          className="btn btn-sm"
          onClick={() => setPoints((ps) => ps.slice(0, -1))}
          disabled={points.length === 0 || graded !== null}
        >
          하나 지우기
        </button>
        <button
          className="btn btn-sm"
          onClick={reset}
          disabled={graded !== null}
        >
          모두 지우기
        </button>
        <button className="btn btn-sm btn-ghost" onClick={onBack}>
          모드 바꾸기
        </button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative w-full md:w-auto md:max-w-[960px] md:grow">
          <canvas
            ref={canvas}
            width={W}
            height={H}
            className="rounded-box block w-full cursor-crosshair"
            onClick={add}
          />
          {graded && (
            <LineReveal
              width={W}
              height={H}
              lines={revealLines}
              color={
                graded.rank === 0
                  ? "rgba(125,255,160,0.9)"
                  : "rgba(250,210,80,0.9)"
              }
              duration={1400}
            />
          )}
          {mode === "quiz" && (
            <RoundBanner
              key={round}
              text={`${round + 1} / ${QUIZ_ROUNDS}`}
              sub={`${quizTarget}를 그려요`}
            />
          )}
          <FxLayer fx={fx} />
        </div>
        <div className="bg-base-200/80 rounded-box flex w-full shrink-0 flex-col gap-3 p-4 backdrop-blur md:w-72 md:self-start">
          {mode === "free" ? (
            <>
              <div className="text-sm opacity-70">
                빈 하늘에 점을 하나씩 찍어 보세요. 3개부터 닮은 별자리를 찾아요.
              </div>
              {matches.length === 0 && (
                <div className="text-sm">점 {points.length}개 · 조금만 더!</div>
              )}
              {matches.map((m, i) => (
                <div
                  key={m.label}
                  className={cn("flex flex-col", i === 0 && "fx-pop")}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn(i === 0 && "text-lg font-bold")}>
                      {i === 0 ? "👑 " : `${i + 1}. `}
                      {m.label}
                    </span>
                    <span className="text-sm tabular-nums">
                      {Math.round(probs[i] * 100)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-amber-300 transition-all duration-500"
                      style={{ width: `${probs[i] * 100}%` }}
                    />
                  </div>
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
              <div key={round} className="fx-pop text-2xl font-bold">
                {quizTarget}
              </div>
              <div className="text-xs opacity-60">
                별 하나에 점 하나씩 찍고 &quot;다 그렸어요&quot;를 누르세요.
              </div>
              {!graded ? (
                <button
                  className="btn btn-primary"
                  disabled={points.length < 3}
                  onClick={grade}
                >
                  다 그렸어요 (점 {points.length}개)
                </button>
              ) : (
                <div className="fx-rise flex flex-col gap-2">
                  <div className="text-4xl font-black text-amber-200">
                    +<CountUp value={graded.score} />점
                  </div>
                  <div className="text-sm">
                    {graded.rank === 0
                      ? `내 그림과 가장 닮은 별자리가 ${quizTarget}예요!`
                      : graded.rank > 0
                        ? `${quizTarget}는 ${graded.rank + 1}번째로 닮았어요. 금색이 실제 모양이에요.`
                        : `점이 ${quizTarget}의 별 수보다 많아요. 별 하나에 점 하나씩 찍어 보세요.`}
                  </div>
                  <button className="btn btn-primary" onClick={nextRound}>
                    {round + 1 < QUIZ_ROUNDS ? "다음 별자리 →" : "결과 보기 ★"}
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
