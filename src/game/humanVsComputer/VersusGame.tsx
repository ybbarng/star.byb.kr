"use client";

import type { ComputerRun } from "@/game/humanVsComputer/computerRun";
import type { StageView } from "@/game/humanVsComputer/drawStage";
import type { Point2D } from "@/scripts/hash/types";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CountUp,
  FxLayer,
  GameIntro,
  readBest,
  ResultCard,
  RoundBanner,
  saveBest,
  useFx,
  useShake,
} from "@/game/fx/Fx";
import LineReveal from "@/game/fx/LineReveal";
import { sfx } from "@/game/fx/sound";
import { runComputer } from "@/game/humanVsComputer/computerRun";
import { drawStage } from "@/game/humanVsComputer/drawStage";
import {
  BASE_POINTS,
  formatSeconds,
  planGame,
  pointsFor,
  speedRatio,
  TEAM_BONUS,
} from "@/game/humanVsComputer/rounds";
import ShapeCard from "@/game/humanVsComputer/ShapeCard";
import SolveSteps from "@/game/humanVsComputer/SolveSteps";
import TeamUp from "@/game/humanVsComputer/TeamUp";
import { SampleCreditLine } from "@/plate-solver/SampleCredits";
import { preloadSolver } from "@/search/solverClient";
import { getSampleCredit } from "@/services/samples";
import { cn } from "@/utils/cn";

// 사람 계산원 vs 컴퓨터 (docs/game-plans.md 3절). 사진 한 장마다 사람은 찍힌 별자리를 보기에서 고르고,
// 같은 순간 컴퓨터는 앱과 같은 풀이를 Worker에서 돌린다. 컴퓨터의 답은 사람이 답한 뒤에 공개한다.
// 마지막 반전 판(직접 만든 바닷가 장면)에서는 컴퓨터가 별만으로 확신하지 못하고, 사람이 단서를 주면 함께 푼다.

const BEST_KEY = "human-vs-computer";
const MAX_MISSES = 3;
// 라운드 배너가 떠 있는 동안은 사람도 컴퓨터도 출발하지 않는다
const BANNER_MS = 1200;

type Phase = "intro" | "play" | "over";

export interface RoundResult {
  title: string;
  answer: string;
  humanMs: number;
  computerMs: number | null; // 컴퓨터가 확신해 답한 시간 (못 풀었으면 null)
  points: number;
  found: boolean; // 사람이 맞혔는지
  reversal: boolean;
  team: boolean; // 반전 판에서 함께 풀었는지
}

export default function VersusGame() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [gameSeed, setGameSeed] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [newBest, setNewBest] = useState(false);
  const [ready, setReady] = useState(false);
  const total = results.reduce((a, r) => a + r.points, 0);

  // 컴퓨터의 별 지도·색인은 시작 화면에서 미리 만든다 (시간에 넣지 않는다)
  useEffect(() => {
    let alive = true;
    preloadSolver()
      .then(() => alive && setReady(true))
      .catch(() => alive && setReady(true));

    return () => {
      alive = false;
    };
  }, []);

  const start = () => {
    setGameSeed(Math.floor(Math.random() * 1e9));
    setResults([]);
    setPhase("play");
  };

  if (phase === "intro") {
    return (
      <GameIntro
        title="사람 계산원 vs 컴퓨터"
        tagline="100년 전 하버드의 사람 계산원들은 사진 건판의 별을 눈으로 셌어요. 이제 컴퓨터와 겨뤄 볼까요?"
        howTo={[
          "밤하늘 사진이 나오면, 사진에 찍힌 별자리를 보기 넷 중에서 골라요. 보기 그림은 북쪽이 위라서 사진 속 모양은 돌아가 있을 수 있어요.",
          "같은 순간 컴퓨터도 이 사이트의 플레이트 솔버로 같은 사진을 풀어요. 컴퓨터의 답은 내가 답한 뒤에 공개돼요.",
          "답하고 나면 컴퓨터가 어떻게 풀었는지 단계별로 보여 줘요. 마지막 판에는 반전이 있어요!",
        ]}
        onStart={start}
        startLabel="대결 시작"
      >
        <div className="text-sm opacity-70">
          {ready ? (
            "🤖 컴퓨터 준비 완료 — 별 지도를 다 펼쳤어요"
          ) : (
            <span className="flex items-center gap-2">
              <span className="loading loading-spinner loading-xs" />
              컴퓨터가 별 지도를 펼치는 중…
            </span>
          )}
        </div>
      </GameIntro>
    );
  }

  if (phase === "over") {
    const best = readBest(BEST_KEY);
    const stars = total >= 4000 ? 3 : total >= 2800 ? 2 : total > 0 ? 1 : 0;
    const normal = results.filter(
      (r) => !r.reversal && r.found && r.computerMs !== null,
    );
    const humanSum = normal.reduce((a, r) => a + r.humanMs, 0);
    const computerSum = normal.reduce((a, r) => a + (r.computerMs ?? 0), 0);

    return (
      <ResultCard
        title="대결 끝!"
        score={total}
        stars={stars}
        best={best}
        newBest={newBest}
        actions={
          <>
            <button className="btn btn-primary" onClick={start}>
              다시 하기
            </button>
            <Link href="/learn" className="btn">
              찾는 원리 더 보기
            </Link>
          </>
        }
      >
        <ScoreTable results={results} />
        {normal.length > 0 && (
          <p className="text-sm opacity-80">
            내가 맞힌 판({normal.length}개)에서 컴퓨터는 모두{" "}
            {formatSeconds(computerSum)}, 나는 {formatSeconds(humanSum)}{" "}
            걸렸어요. 그래도 별이 적은 사진에서는 사람의 단서가 있어야 풀려요 —
            사람과 컴퓨터가 함께일 때 가장 강해요.
          </p>
        )}
      </ResultCard>
    );
  }

  return (
    <VersusPlay
      key={gameSeed}
      gameSeed={gameSeed}
      results={results}
      onResult={(r) => setResults((rs) => [...rs, r])}
      onFinish={(finalTotal) => {
        setNewBest(saveBest(BEST_KEY, finalTotal));
        setPhase("over");
      }}
    />
  );
}

function ScoreTable({ results }: { results: RoundResult[] }) {
  return (
    <table className="table-sm table w-full text-left">
      <thead>
        <tr>
          <th>사진</th>
          <th className="text-right">나</th>
          <th className="text-right">컴퓨터</th>
          <th className="text-right">점수</th>
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => (
          <tr key={i}>
            <td>
              {r.title}
              <div className="text-xs opacity-60">{r.answer}</div>
            </td>
            <td className="text-right tabular-nums">
              {r.found ? formatSeconds(r.humanMs) : "✕"}
            </td>
            <td className="text-right tabular-nums">
              {r.computerMs !== null
                ? formatSeconds(r.computerMs)
                : r.team
                  ? "🤝 함께"
                  : "모르겠다"}
            </td>
            <td className="text-right font-bold tabular-nums">{r.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type Status = "loading" | "playing" | "answered";

function VersusPlay({
  gameSeed,
  results,
  onResult,
  onFinish,
}: {
  gameSeed: number;
  results: RoundResult[];
  onResult: (r: RoundResult) => void;
  onFinish: (total: number) => void;
}) {
  const rounds = useMemo(() => planGame(gameSeed), [gameSeed]);
  const [round, setRound] = useState(0);
  const target = rounds[round];
  // 바깥에서 가져온 샘플은 사진 아래에 출처를 밝힌다 (CC BY)
  const credit = getSampleCredit(`/samples/${target.file}`);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [humanMs, setHumanMs] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const [found, setFound] = useState(false);
  const [run, setRun] = useState<ComputerRun | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [view, setView] = useState<StageView>({ kind: "photo" });
  const [reveal, setReveal] = useState<{
    lines: Point2D[][];
    color: string;
  } | null>(null);
  const [team, setTeam] = useState(false);
  // 반전 판에서 사람이 수평선을 찍는 중이면, 사진을 누를 때 이 함수가 받는다
  const [picker, setPicker] = useState<((p: Point2D) => void) | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const fx = useFx();
  const shake = useShake();
  const total = results.reduce((a, r) => a + r.points, 0);

  // 사진을 불러오고, 배너가 사라지면 사람의 시계와 컴퓨터가 함께 출발한다
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const img = new Image();

    img.onload = () => {
      if (!alive) {
        return;
      }

      setImage(img);
      timer = setTimeout(() => {
        if (!alive) {
          return;
        }

        const t0 = performance.now();
        setStartedAt(t0);
        setNow(t0);
        setStatus("playing");
        runComputer(img)
          .then((r) => alive && setRun(r))
          .catch((e: Error) => alive && setRunError(e.message));
      }, BANNER_MS);
    };

    img.src = `/samples/${target.file}`;

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [target]);

  // 내 시계 (0.1초마다)
  useEffect(() => {
    if (status !== "playing") {
      return;
    }

    const t = setInterval(() => setNow(performance.now()), 100);

    return () => clearInterval(t);
  }, [status]);

  // 사진과 겹친 그림
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");

    if (ctx && image) {
      drawStage(ctx, image, view);
    }
  }, [image, view]);

  const elapsed = status === "playing" ? now - startedAt : humanMs;
  const live = pointsFor(elapsed / 1000, wrong.length);
  const computerDone = run !== null || runError !== null;
  const computerSolved = !!run?.result.found && !!run.result.transform;

  const answer = (label: string) => {
    if (status !== "playing" || wrong.includes(label)) {
      return;
    }

    if (label === target.answer) {
      const ms = performance.now() - startedAt;
      setHumanMs(ms);
      setFound(true);
      setStatus("answered");
      sfx.hit();
      fx.burst(0.5, 0.5, "#ffe27a", 22);
      fx.popup(0.5, 0.45, `+${pointsFor(ms / 1000, wrong.length)}`);

      return;
    }

    const next = [...wrong, label];
    setWrong(next);
    shake.shake();

    if (next.length >= MAX_MISSES) {
      setHumanMs(performance.now() - startedAt);
      setFound(false);
      setStatus("answered");
      sfx.lose();
    } else {
      sfx.miss();
      fx.popup(0.5, 0.5, "✕", "#ff6b6b", 40);
    }
  };

  const next = () => {
    sfx.tap();
    const points =
      (found ? pointsFor(humanMs / 1000, wrong.length) : 0) +
      (team ? TEAM_BONUS : 0);
    const result: RoundResult = {
      title: target.title,
      answer: target.answer,
      humanMs,
      computerMs:
        computerSolved && !target.reversal ? (run?.totalMs ?? null) : null,
      points,
      found,
      reversal: !!target.reversal,
      team,
    };
    onResult(result);

    if (round + 1 >= rounds.length) {
      onFinish(total + points);

      return;
    }

    setRound((r) => r + 1);
    setImage(null);
    setStatus("loading");
    setWrong([]);
    setFound(false);
    setRun(null);
    setRunError(null);
    setView({ kind: "photo" });
    setReveal(null);
    setTeam(false);
    setPicker(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!picker || !image) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    picker([
      ((e.clientX - rect.left) / rect.width) * image.width,
      ((e.clientY - rect.top) / rect.height) * image.height,
    ]);
  };

  return (
    <div className="flex w-full max-w-[1280px] flex-col gap-3">
      {/* 상단: 판 진행, 점수, 컴퓨터 상태 */}
      <div className="bg-base-200/80 rounded-box flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-1.5">
          {rounds.map((r, i) => (
            <span
              key={i}
              title={r.reversal ? "반전 판" : undefined}
              className={cn(
                "h-3 w-3 rounded-full transition",
                i < results.length
                  ? results[i].points > 0
                    ? "bg-amber-300 shadow-[0_0_8px_rgba(255,210,80,0.8)]"
                    : "bg-red-400"
                  : i === round
                    ? "bg-white/80 ring-2 ring-white/40"
                    : r.reversal
                      ? "bg-fuchsia-400/40"
                      : "bg-white/20",
              )}
            />
          ))}
        </div>
        <div className="text-2xl font-black text-amber-200 tabular-nums">
          <CountUp value={total} duration={700} />
          <span className="ml-1 text-sm font-normal opacity-70">점</span>
        </div>
        <div className="grow" />
        <ComputerBadge
          status={status}
          done={computerDone}
          error={runError}
          reversal={!!target.reversal}
        />
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        {/* 왼쪽(모바일은 위): 문제와 보기, 답한 뒤에는 결과와 풀이 단계 */}
        <div className="bg-base-200/80 rounded-box flex w-full shrink-0 flex-col gap-3 p-4 backdrop-blur md:w-80 md:self-start">
          {status !== "answered" ? (
            <>
              <div className="text-sm opacity-70">
                {/* 사진 이름(오리온·북두칠성…)은 답을 알려 주니 답한 뒤에만 */}
                {round + 1}번째 사진
              </div>
              <div className="text-lg font-bold">이 사진에 찍힌 별자리는?</div>
              <div className="grid grid-cols-2 gap-2">
                {target.choices.map((label) => (
                  <button
                    key={label}
                    disabled={status !== "playing" || wrong.includes(label)}
                    className={cn(
                      "rounded-box flex flex-col gap-1 border-2 p-1.5 text-sm transition",
                      wrong.includes(label)
                        ? "border-red-400/60 opacity-40"
                        : "bg-base-300/60 border-transparent hover:border-amber-300",
                    )}
                    onClick={() => answer(label)}
                  >
                    <ShapeCard label={label} />
                    <span className="font-bold">{label}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs opacity-70">
                  <span className="tabular-nums">
                    내 시간{" "}
                    {status === "playing" ? formatSeconds(elapsed) : "—"}
                  </span>
                  <span className="tabular-nums">지금 맞히면 {live}점</span>
                </div>
                <progress
                  className={cn(
                    "progress",
                    live > 600
                      ? "progress-success"
                      : live > 300
                        ? "progress-warning"
                        : "progress-error",
                  )}
                  value={status === "playing" ? live : BASE_POINTS}
                  max={BASE_POINTS}
                />
              </div>
            </>
          ) : (
            <div className="fx-rise flex flex-col gap-3">
              <div
                className={cn(
                  "text-lg font-bold",
                  found ? "text-success" : "text-red-300",
                )}
              >
                {found
                  ? `정답! ${target.answer}`
                  : `아쉬워요, 정답은 ${target.answer}`}
              </div>
              <div className="text-sm opacity-80">{target.hint}</div>
              <Versus
                humanMs={humanMs}
                found={found}
                run={run}
                error={runError}
                reversal={!!target.reversal}
              />
              {image && run && !target.reversal && (
                <SolveSteps
                  image={image}
                  run={run}
                  answer={target.answer}
                  onView={setView}
                  onReveal={setReveal}
                />
              )}
              {image && run && target.clues && (
                <TeamUp
                  image={image}
                  run={run}
                  answer={target.answer}
                  clues={target.clues}
                  onView={setView}
                  onReveal={setReveal}
                  // 함수를 상태로 담으므로 setPicker(fn)이 fn을 갱신 함수로 부르지 않게 감싼다
                  onPicker={(fn) => setPicker(() => fn)}
                  onSolved={() => {
                    setTeam(true);
                    sfx.hit();
                    fx.burst(0.5, 0.4, "#86efac", 26);
                    fx.popup(
                      0.5,
                      0.35,
                      `함께 풀었어요! +${TEAM_BONUS}`,
                      "#86efac",
                      34,
                    );
                  }}
                />
              )}
              <button
                className="btn btn-primary"
                disabled={!computerDone}
                onClick={next}
              >
                {round + 1 < rounds.length
                  ? rounds[round + 1].reversal
                    ? "마지막 판 →"
                    : "다음 사진 →"
                  : "결과 보기 ★"}
              </button>
            </div>
          )}
        </div>

        <div ref={shake.ref} className="relative grow">
          {image ? (
            <div className="relative mx-auto w-fit">
              <canvas
                ref={canvas}
                width={image.width}
                height={image.height}
                className={cn(
                  "rounded-box block h-auto max-h-[75vh] w-auto max-w-full bg-black",
                  picker && "cursor-crosshair",
                )}
                onClick={handleClick}
              />
              {reveal && (
                <LineReveal
                  key={reveal.lines.length + reveal.color}
                  width={image.width}
                  height={image.height}
                  lines={reveal.lines}
                  color={reveal.color}
                  lineWidth={Math.hypot(image.width, image.height) / 400}
                />
              )}
              {status === "loading" && (
                <RoundBanner
                  key={round}
                  text={
                    target.reversal
                      ? "마지막 판"
                      : `${round + 1} / ${rounds.length}`
                  }
                  sub={
                    target.reversal
                      ? "별이 아주 적은 사진"
                      : "어떤 별자리일까요?"
                  }
                />
              )}
              {credit && (
                <div className="mt-1">
                  <SampleCreditLine credit={credit} />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-box bg-base-200/60 grid aspect-[4/3] place-items-center">
              <span className="loading loading-spinner" />
            </div>
          )}
          <FxLayer fx={fx} />
        </div>
      </div>
    </div>
  );
}

// 상단의 컴퓨터 상태: 답을 냈어도 사람이 답하기 전에는 비밀
function ComputerBadge({
  status,
  done,
  error,
  reversal,
}: {
  status: Status;
  done: boolean;
  error: string | null;
  reversal: boolean;
}) {
  if (status === "loading") {
    return <span className="text-sm opacity-60">🤖 준비</span>;
  }

  if (error) {
    return <span className="text-sm text-red-300">🤖 오류: {error}</span>;
  }

  if (!done) {
    return (
      <span className="flex items-center gap-2 text-sm">
        <span className="loading loading-dots loading-xs" />
        🤖 컴퓨터가 푸는 중…
      </span>
    );
  }

  return (
    <span
      className={cn(
        "badge gap-1 p-3 font-bold",
        status === "playing" ? "badge-warning fx-pop" : "badge-ghost",
      )}
    >
      🤖{" "}
      {status === "playing"
        ? reversal
          ? "컴퓨터는 답을 냈어요 (비밀)"
          : "컴퓨터는 벌써 답을 냈어요! (비밀)"
        : "컴퓨터 답 공개"}
    </span>
  );
}

// "컴퓨터 0.4초 vs 나 12초"
function Versus({
  humanMs,
  found,
  run,
  error,
  reversal,
}: {
  humanMs: number;
  found: boolean;
  run: ComputerRun | null;
  error: string | null;
  reversal: boolean;
}) {
  if (error) {
    return <div className="text-sm text-red-300">컴퓨터 오류: {error}</div>;
  }

  if (!run) {
    return (
      <div className="rounded-box bg-base-300/60 flex items-center gap-2 p-3 text-sm">
        <span className="loading loading-dots loading-sm" />
        {found
          ? "사람이 먼저 답했어요! 컴퓨터는 아직 푸는 중…"
          : "컴퓨터는 아직 푸는 중…"}
      </div>
    );
  }

  const solved = run.result.found && !!run.result.transform;
  const ratio = speedRatio(humanMs, run.totalMs);

  return (
    <div className="rounded-box bg-base-300/60 flex flex-col gap-2 p-3">
      <div className="grid grid-cols-2 gap-2 text-center">
        <div>
          <div className="text-xs opacity-60">🤖 컴퓨터</div>
          <div
            className={cn(
              "text-2xl font-black tabular-nums",
              solved ? "text-sky-300" : "text-red-300",
            )}
          >
            {solved ? formatSeconds(run.totalMs) : "모르겠다"}
          </div>
        </div>
        <div>
          <div className="text-xs opacity-60">🙋 나</div>
          <div
            className={cn(
              "text-2xl font-black tabular-nums",
              found ? "text-amber-200" : "text-red-300",
            )}
          >
            {found ? formatSeconds(humanMs) : "✕"}
          </div>
        </div>
      </div>
      <div className="text-center text-sm">
        {solved
          ? found && humanMs < run.totalMs
            ? "와, 컴퓨터보다 빨랐어요!"
            : ratio >= 2
              ? `컴퓨터가 ${Math.round(ratio)}배 빨랐어요.`
              : "컴퓨터가 조금 더 빨랐어요."
          : reversal
            ? `컴퓨터는 ${formatSeconds(run.totalMs)} 동안 찾았지만 확신하지 못했어요.${found ? " 이번엔 사람이 이겼어요!" : ""}`
            : "이번엔 컴퓨터도 확신하지 못했어요."}
      </div>
      {solved && (
        <div className="text-center text-xs opacity-60">
          별 찾기 {formatSeconds(run.detectMs)} + 모양 맞추기·확인{" "}
          {formatSeconds(run.solveMs)}
        </div>
      )}
    </div>
  );
}
