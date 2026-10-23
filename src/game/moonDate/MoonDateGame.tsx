"use client";

import type {
  DayMoon,
  MoonDifficulty,
  MoonProblem,
  MoonShape,
} from "@/game/moonDate/moonDate";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChoiceCards,
  CountUp,
  GameIntro,
  readBest,
  ResultCard,
  RoundBanner,
  saveBest,
  useShake,
} from "@/game/fx/Fx";
import { sfx } from "@/game/fx/sound";
import MoonCalendar from "@/game/moonDate/MoonCalendar";
import {
  candidateDays,
  clockLabel,
  constellationChoices,
  dayLabel,
  explainMoonDate,
  makeMoonProblem,
  moonInPhoto,
  PHASE_HINT_COST,
  ROUND_MAX,
  scoreMoonDate,
  shapeName,
  SHAPES,
  SLOTS,
  STEP_MISS_COST,
  yearTable,
} from "@/game/moonDate/moonDate";
import MoonIcon from "@/game/moonDate/MoonIcon";
import { CONSTELLATIONS, STARS } from "@/game/sky/catalog";
import { drawSky } from "@/game/sky/drawSky";
import { cn } from "@/utils/cn";

// 달로 날짜 맞히기 (docs/game-plans.md): 어느 해·장소·시각대의 밤하늘에서 달 모양과 달이 있는 별자리를 읽어
// 날짜를 맞힌다. 다섯 라운드, 라운드마다 최고 1,000점 (날짜 차이로 매긴다).

const ROUNDS = 5;
const MAX_MISS_PENALTY = 0.3;

const DIFFICULTIES: { value: MoonDifficulty; title: string; note: string }[] = [
  {
    value: "intro",
    title: "입문",
    note: "모양 → 별자리 → 날짜, 차례로 좁혀요",
  },
  { value: "easy", title: "쉬움", note: "별자리선과 달력의 달 모양이 보여요" },
  {
    value: "normal",
    title: "보통",
    note: "별자리선 없이, 달력 모양은 힌트. 남반구도",
  },
];

interface RoundResult {
  answer: string;
  diffDays: number;
  points: number;
}

export default function MoonDateGame() {
  const [phase, setPhase] = useState<"intro" | "play" | "over">("intro");
  const [difficulty, setDifficulty] = useState<MoonDifficulty>("intro");
  const [seed, setSeed] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [newBest, setNewBest] = useState(false);
  const total = results.reduce((s, r) => s + r.points, 0);
  const bestKey = `moon-date-${difficulty}`;

  const start = () => {
    setSeed(Math.floor(Math.random() * 1e9));
    setResults([]);
    setPhase("play");
  };

  if (phase === "intro") {
    return (
      <GameIntro
        title="달로 날짜 맞히기"
        tagline="밤하늘 사진 한 장 속 달만 보고, 그해 몇 월 며칠에 찍었는지 알아낼 수 있을까요?"
        howTo={[
          "달의 모양(위상)은 29.5일마다 되풀이돼요. 초승달은 해를 따라 저녁 서쪽에, 그믐달은 해보다 먼저 새벽 동쪽에 떠요.",
          "달은 하루에 13°씩 별 사이를 동쪽으로 옮겨서, 27.3일마다 같은 별자리로 돌아와요.",
          "두 주기가 조금 어긋나 있어서, 모양과 별자리를 함께 보면 1년 안에서 날짜가 거의 하나로 정해져요.",
          "사진의 해·장소·시각대를 보고 달력에서 날짜를 골라요. 하루 차이면 819점, 사흘이면 549점이에요.",
        ]}
        onStart={start}
      >
        <ChoiceCards
          options={DIFFICULTIES}
          value={difficulty}
          onChange={setDifficulty}
        />
      </GameIntro>
    );
  }

  if (phase === "over") {
    const stars =
      total >= ROUNDS * 750 ? 3 : total >= ROUNDS * 450 ? 2 : total > 0 ? 1 : 0;

    return (
      <ResultCard
        title="달력 읽기 끝!"
        score={total}
        stars={stars}
        best={readBest(bestKey)}
        newBest={newBest}
        actions={
          <>
            <button className="btn btn-primary" onClick={start}>
              다시 하기
            </button>
            <button className="btn" onClick={() => setPhase("intro")}>
              난이도 바꾸기
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-1 text-sm">
          {results.map((r, i) => (
            <div key={i}>
              {i + 1}라운드 · {r.answer} ·{" "}
              {r.diffDays === 0 ? "딱 맞음" : `${r.diffDays}일 차이`} ·{" "}
              <b>{r.points.toLocaleString()}점</b>
            </div>
          ))}
        </div>
      </ResultCard>
    );
  }

  return (
    <MoonRound
      key={`${seed}-${results.length}`}
      round={results.length}
      total={total}
      problemSeed={seed + results.length * 7919}
      difficulty={difficulty}
      onDone={(r) => {
        const next = [...results, r];
        setResults(next);

        if (next.length >= ROUNDS) {
          setNewBest(
            saveBest(
              bestKey,
              next.reduce((s, x) => s + x.points, 0),
            ),
          );
          setPhase("over");
        }
      }}
    />
  );
}

type Step = "shape" | "constellation" | "date";

function MoonRound({
  round,
  total,
  problemSeed,
  difficulty,
  onDone,
}: {
  round: number;
  total: number;
  problemSeed: number;
  difficulty: MoonDifficulty;
  onDone: (r: RoundResult) => void;
}) {
  const problem = useMemo(
    () => makeMoonProblem(problemSeed, difficulty),
    [problemSeed, difficulty],
  );
  const table = useMemo(
    () => yearTable(problem.year, problem.place, problem.hours),
    [problem],
  );
  const choices = useMemo(
    () => constellationChoices(table, problem),
    [table, problem],
  );
  const intro = difficulty === "intro";
  const [step, setStep] = useState<Step>(intro ? "shape" : "date");
  const [misses, setMisses] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const [hint, setHint] = useState(false);
  const [guess, setGuess] = useState<number | null>(null);
  const [scored, setScored] = useState<ReturnType<typeof scoreMoonDate> | null>(
    null,
  );
  const { ref: shakeRef, shake } = useShake();
  const penalty =
    Math.min(MAX_MISS_PENALTY, misses * STEP_MISS_COST) +
    (hint ? PHASE_HINT_COST : 0);
  const showIcons = difficulty !== "normal" || hint || scored !== null;
  const south = problem.place.observer.latDeg < 0;

  // 달력의 달 모양: 북반구에서는 차오르는 달의 오른쪽이 밝다 (남반구는 거꾸로)
  const icons = useMemo(
    () =>
      table.map((d) => ({
        lit: d.lit,
        angleDeg: d.waxing !== south ? 0 : 180,
      })),
    [table, south],
  );
  const candidates = useMemo(
    () =>
      intro && step === "date"
        ? new Set(
            candidateDays(
              table,
              problem.state.shape,
              problem.state.constellation,
            ),
          )
        : null,
    [intro, step, table, problem],
  );

  const pickShape = (shape: MoonShape) => {
    if (shape === problem.state.shape) {
      sfx.hit();
      setWrong([]);
      setStep("constellation");
    } else {
      sfx.miss();
      shake();
      setMisses((m) => m + 1);
      setWrong((w) => [...w, shape]);
    }
  };

  const pickConstellation = (c: string) => {
    if (c === problem.state.constellation) {
      sfx.hit();
      setWrong([]);
      setStep("date");
    } else {
      sfx.miss();
      shake();
      setMisses((m) => m + 1);
      setWrong((w) => [...w, c]);
    }
  };

  const submit = () => {
    if (guess === null) {
      return;
    }

    const s = scoreMoonDate(problem, guess, penalty);
    setScored(s);

    if (s.points >= 800) {
      sfx.win();
    } else if (s.points >= 400) {
      sfx.hit();
    } else {
      sfx.miss();
    }
  };

  const slot = SLOTS[problem.slot];

  return (
    <div className="flex w-full max-w-[1200px] flex-col gap-3">
      <div className="bg-base-200/80 rounded-box flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 backdrop-blur">
        <h1 className="text-xl font-bold">달로 날짜 맞히기</h1>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: ROUNDS }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-3 w-3 rounded-full",
                i < round
                  ? "bg-amber-300"
                  : i === round
                    ? "bg-white/80 ring-2 ring-white/40"
                    : "bg-white/20",
              )}
            />
          ))}
        </div>
        <div className="text-2xl font-black text-amber-200 tabular-nums">
          <CountUp value={total + (scored?.points ?? 0)} duration={900} />
          <span className="ml-1 text-sm font-normal opacity-70">점</span>
        </div>
        <div className="grow" />
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-xl bg-indigo-500/20 px-3 py-1 ring-1 ring-indigo-300/40">
            📅 <b>{problem.year}년</b>
          </span>
          <span className="rounded-xl bg-indigo-500/20 px-3 py-1 ring-1 ring-indigo-300/40">
            📍 <b>{problem.place.name}</b>
            {south && " (남반구)"}
          </span>
          <span className="rounded-xl bg-indigo-500/20 px-3 py-1 ring-1 ring-indigo-300/40">
            🕗 <b>{slot.label}</b>{" "}
            <span className="opacity-70">({slot.note})</span>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative w-full lg:w-[58%]">
          <MoonSky
            problem={problem}
            lines={difficulty !== "normal" || scored !== null}
            dimStars={!intro}
          />
          <RoundBanner
            key={round}
            text={`${round + 1} / ${ROUNDS}`}
            sub="이 달은 몇 월 며칠?"
          />
          <div className="mt-1 text-xs opacity-60">
            오른쪽 위는 사진 속 달을 크게 본 것 · 밝은 쪽이 해가 있는 쪽
            {difficulty !== "normal" &&
              " · 노란 선은 별자리선 (달이 든 구역은 IAU 경계로 정해요)"}
          </div>
        </div>

        <div ref={shakeRef} className="flex flex-col gap-2 lg:w-[42%]">
          {!scored && intro && step === "shape" && (
            <StepBox
              title="① 달 모양은?"
              note="사진 오른쪽 위의 확대한 달을 보세요"
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SHAPES.map((s) => {
                  const mid = (s.lo + s.hi) / 2;
                  const lit = (1 - Math.cos((mid * Math.PI) / 180)) / 2;

                  return (
                    <button
                      key={s.key}
                      disabled={wrong.includes(s.key)}
                      className="btn btn-sm h-auto flex-col gap-1 py-2"
                      onClick={() => pickShape(s.key)}
                    >
                      <MoonIcon
                        lit={lit}
                        angleDeg={mid < 180 !== south ? 0 : 180}
                        size={30}
                      />
                      <span>{s.name}</span>
                    </button>
                  );
                })}
              </div>
              {wrong.length > 0 && (
                <div className="text-xs text-amber-200">
                  밝은 부분의 크기와, 밝은 쪽이 해(지평선 아래 해 진 쪽·뜰 쪽)를
                  향하는지 다시 보세요.
                </div>
              )}
            </StepBox>
          )}

          {!scored && intro && step === "constellation" && (
            <StepBox
              title={`② ${shapeName(problem.state.shape)}이 있는 별자리는?`}
              note="노란 별자리선과 이름을 보고 달이 든 별자리를 골라요"
            >
              <div className="grid grid-cols-2 gap-2">
                {choices.map((c) => (
                  <button
                    key={c}
                    disabled={wrong.includes(c)}
                    className="btn"
                    onClick={() => pickConstellation(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </StepBox>
          )}

          {!scored && step === "date" && (
            <StepBox
              title={intro ? "③ 날짜 고르기" : "날짜는?"}
              note={
                intro
                  ? `${shapeName(problem.state.shape)}이 ${problem.state.constellation}에 있는 날을 초록으로 표시했어요`
                  : difficulty === "easy"
                    ? "달력의 달 모양으로 같은 모양인 날을 찾고, 별자리로 그중 하나를 골라요"
                    : "달이 해에서 얼마나 떨어졌는지로 해의 별자리를 짐작해 보세요"
              }
            >
              <MoonCalendar
                year={problem.year}
                selected={guess}
                onSelect={setGuess}
                icons={showIcons ? icons : null}
                candidates={candidates}
              />
              {showIcons && (
                <div className="text-[11px] opacity-60">
                  달력의 달은 그날 {clockLabel(problem.hours)}{" "}
                  {problem.place.name}에서 본 모양이에요 (
                  {south ? "남반구라 좌우가 거꾸로" : "북반구 기준"})
                </div>
              )}
            </StepBox>
          )}

          {!scored && step === "date" && (
            <>
              {difficulty === "normal" && (
                <button
                  className={cn(
                    "btn btn-sm self-start",
                    hint ? "btn-disabled" : "btn-outline",
                  )}
                  onClick={() => {
                    sfx.twinkle(2);
                    setHint(true);
                  }}
                >
                  🌙 달력에 달 모양 보기 −{Math.round(PHASE_HINT_COST * 100)}%
                </button>
              )}
              <button
                className="btn btn-primary btn-lg"
                disabled={guess === null}
                onClick={submit}
              >
                {guess === null
                  ? "달력에서 날짜를 골라요"
                  : `${dayLabel(problem.year, guess)}에 찍었어요! 🌙`}
              </button>
              {penalty > 0 && (
                <div className="text-xs opacity-60">
                  {misses > 0 && `단계에서 ${misses}번 틀림 `}
                  {hint && "힌트 사용 "}→ 점수 −{Math.round(penalty * 100)}%
                </div>
              )}
            </>
          )}

          {scored && guess !== null && (
            <ResultPanel
              problem={problem}
              table={table}
              guess={guess}
              score={scored}
              icons={icons}
              last={round + 1 >= ROUNDS}
              onNext={() =>
                onDone({
                  answer: dayLabel(problem.year, problem.day),
                  diffDays: scored.diffDays,
                  points: scored.points,
                })
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StepBox({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-base-200/80 rounded-box fx-rise flex flex-col gap-3 p-4 text-sm backdrop-blur">
      <div>
        <div className="text-base font-bold">{title}</div>
        <div className="text-xs opacity-70">{note}</div>
      </div>
      {children}
    </div>
  );
}

// 밤하늘 (drawSky) + 오른쪽 위에 달 확대
function MoonSky({
  problem,
  lines,
  dimStars,
}: {
  problem: MoonProblem;
  lines: boolean;
  dimStars: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const moon = useMemo(() => moonInPhoto(problem), [problem]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");

    if (!ctx) {
      return;
    }

    drawSky(ctx, {
      width: problem.width,
      height: problem.height,
      TP: problem.TP,
      date: problem.date,
      observer: problem.place.observer,
      azimuthDeg: problem.view.azimuthDeg,
      magLimit: problem.magLimit,
      lightPollution: problem.lightPollution,
      groundSeed: problem.groundSeed,
      stars: STARS,
      constellations: lines ? CONSTELLATIONS : undefined,
      compass: true,
      moonlightDimsStars: dimStars,
    });

    // 사진 속 달 자리에 작은 고리 (확대 그림과 이어 보이게)
    if (moon) {
      ctx.strokeStyle = "rgba(253,230,138,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(moon.at[0], moon.at[1], 22, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [problem, lines, dimStars, moon]);

  return (
    <div className="relative">
      <canvas
        ref={canvas}
        width={problem.width}
        height={problem.height}
        className="rounded-box block w-full bg-black"
      />
      {moon && (
        <div className="rounded-box absolute top-2 right-2 flex flex-col items-center gap-1 bg-black/55 p-2 text-[10px] backdrop-blur-sm sm:p-3">
          <MoonIcon
            lit={problem.state.lit}
            angleDeg={(moon.sunAngle * 180) / Math.PI}
            size={64}
            className="h-12 w-12 sm:h-16 sm:w-16"
          />
          <span className="opacity-70">확대한 달</span>
        </div>
      )}
    </div>
  );
}

function ResultPanel({
  problem,
  table,
  guess,
  score,
  icons,
  last,
  onNext,
}: {
  problem: MoonProblem;
  table: DayMoon[];
  guess: number;
  score: ReturnType<typeof scoreMoonDate>;
  icons: { lit: number; angleDeg: number }[];
  last: boolean;
  onNext: () => void;
}) {
  const ex = useMemo(() => explainMoonDate(problem, table), [problem, table]);
  const s = problem.state;
  const shape = SHAPES.find((x) => x.key === s.shape);
  const east = s.waxing;
  const answerMonth = new Date(
    Date.UTC(problem.year, 0, 1 + problem.day),
  ).getUTCMonth();

  return (
    <div className="bg-base-200/90 rounded-box fx-rise flex flex-col gap-3 p-4 text-sm backdrop-blur">
      <div className="flex flex-wrap items-end gap-3">
        <div className="text-4xl font-black text-amber-200">
          +<CountUp value={score.points} />
        </div>
        <div className="pb-1 opacity-70">/ {ROUND_MAX.toLocaleString()}</div>
        <div className="grow" />
        <button className="btn btn-primary" onClick={onNext}>
          {last ? "결과 보기 ★" : "다음 라운드 →"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center text-xs">
        <div className="rounded-lg bg-black/25 p-2">
          <div className="font-bold">정답</div>
          <div className="text-base text-emerald-300">
            {dayLabel(problem.year, problem.day)} {clockLabel(problem.hours)}
          </div>
        </div>
        <div className="rounded-lg bg-black/25 p-2">
          <div className="font-bold">내 답</div>
          <div className="text-base text-amber-200">
            {dayLabel(problem.year, guess)}{" "}
            <span className="text-xs opacity-70">
              ({score.diffDays === 0 ? "딱 맞음!" : `${score.diffDays}일 차이`})
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg bg-black/25 p-3">
        <div>
          <b>① 모양</b> — <b>{shapeName(s.shape)}</b>, 빛나는 부분{" "}
          {Math.round(s.lit * 100)}%. 해에서 <b>{ex.elongDeg.toFixed(0)}°</b>{" "}
          {east ? "동쪽" : "서쪽"}에 있는 달이에요 (삭에서 약{" "}
          {s.ageDays.toFixed(1)}일, 음력 {Math.floor(s.ageDays) + 1}일 무렵).
          {shape && ` ${shape.name}은 ${shape.note} 보여요.`}
        </div>
        <div>
          <b>② 자리</b> — 달은 <b>{s.constellation}</b> 구역에 있어요. 달은
          하루에 13°씩 동쪽으로 옮겨 27.3일마다 이 구역에 돌아와요.{" "}
          {problem.year}년에는 <b>{ex.passes.length}번</b> 지나갔지만, 이
          모양으로 지난 건 <b>{ex.sameShapePasses}번</b>뿐이에요.
        </div>
        <div>
          <b>③ 해의 자리로 달 고르기</b> — 해는 달에서 {east ? "서쪽" : "동쪽"}
          으로 {ex.elongDeg.toFixed(0)}° 떨어진 <b>{ex.sunConstellation}</b>{" "}
          쪽에 있어요. 해가 {ex.sunConstellation}에 있는 때는{" "}
          <b>
            {ex.sunRanges
              .map(
                ([a, b]) =>
                  `${dayLabel(problem.year, a)} ~ ${dayLabel(problem.year, b)}`,
              )
              .join(", ")}
          </b>{" "}
          — 그 무렵 달이 {s.constellation}를 지난 때가 정답이에요.
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="text-xs font-bold opacity-80">
          {problem.year}년 달이 {s.constellation}를 지난 때 (
          {clockLabel(problem.hours)} 기준, 가운데 날의 모양)
        </div>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {ex.passes.map((p, i) => {
            const isAnswer = i === ex.answerPass;
            const isMine = p.from <= guess && guess <= p.to;

            return (
              <div
                key={p.from}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-0.5 text-xs",
                  isAnswer
                    ? "bg-emerald-400/20 outline outline-2 outline-emerald-400"
                    : isMine
                      ? "bg-amber-300/15 outline outline-1 outline-amber-300"
                      : "bg-white/5",
                )}
              >
                <MoonIcon
                  lit={p.mid.lit}
                  angleDeg={icons[p.mid.day].angleDeg}
                  size={16}
                />
                <span className="font-bold tabular-nums">
                  {dayLabel(problem.year, p.from)}
                  {p.to > p.from && ` ~ ${dayLabel(problem.year, p.to)}`}
                </span>
                <span
                  className={cn(
                    "ml-auto",
                    p.mid.shape === s.shape ? "font-bold" : "opacity-50",
                  )}
                >
                  {shapeName(p.mid.shape)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <MoonCalendar
        key="answer"
        year={problem.year}
        selected={guess}
        answer={problem.day}
        icons={icons}
        initialMonth={answerMonth}
      />

      <div className="rounded-lg bg-indigo-500/15 p-3 text-xs ring-1 ring-indigo-300/30">
        🏔️ 발표의 화악산 사진도 이렇게 풀었어요. 2026년 달은 사진 속 자리를 14번
        지나갔지만, 해 뜨기 전 어두운 하늘에 가는 그믐달로 떠 있던 때는 10월 9일
        새벽 한 번뿐이었어요.
      </div>
      <div className="text-[11px] opacity-55">
        계산의 한계: 달 위치는 약 0.3° 안쪽으로 맞아서, 별자리 경계 가까이에
        있으면 하루쯤 어긋날 수 있어요. 시각은 그 지역 표준시(일광 절약 시간
        없이)이고, 모양 이름은 위상각을 일곱 칸으로 나눈 것이에요.
      </div>
    </div>
  );
}
