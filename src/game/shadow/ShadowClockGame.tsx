"use client";

import type { ShadowDifficulty, ShadowProblem } from "@/game/shadow/problem";
import { useMemo, useState } from "react";
import {
  ChoiceCards,
  CountUp,
  GameIntro,
  readBest,
  ResultCard,
  RoundBanner,
  saveBest,
} from "@/game/fx/Fx";
import { sfx } from "@/game/fx/sound";
import {
  CURVE_HINT_COST,
  explainShadow,
  latLabel,
  makeShadowProblem,
  ROUND_POINTS,
  scoreShadow,
  SHADOW_SETTINGS,
} from "@/game/shadow/problem";
import {
  dayLabel,
  shadowOf,
  solarClock,
  sunAt,
  twinDay,
} from "@/game/shadow/shadow";
import ShadowBoard from "@/game/shadow/ShadowBoard";
import { cn } from "@/utils/cn";

// 그림자 시계 (docs/game-plans.md): 막대 하나와 그림자만 보고 위도·날짜·해시계 시각을 맞힌다.
// ① 정오 그림자 길이·방향과 낮 길이로 위도·계절 ② 지금 그림자 방향으로 시각. 다섯 라운드, 라운드마다 최고 1,000점.

const ROUNDS = 5;
const ROUND_MAX = ROUND_POINTS.lat + ROUND_POINTS.season + ROUND_POINTS.time;

const DIFFICULTIES: { value: ShadowDifficulty; title: string; note: string }[] =
  [
    { value: "intro", title: "입문", note: "날짜를 알려 줘요. 위도·시각만" },
    { value: "easy", title: "쉬움", note: "동서남북·눈금·그림자 곡선" },
    { value: "normal", title: "보통", note: "북쪽만, 눈금 없이, 곡선은 힌트" },
  ];

const LAT_MARKS = [
  { name: "적도", lat: 0 },
  { name: "서울", lat: 37.6 },
  { name: "시드니", lat: -33.9 },
  { name: "헬싱키", lat: 60.2 },
];

interface RoundResult {
  latDeg: number;
  day: number;
  solarHours: number;
  points: number;
}

export default function ShadowClockGame() {
  const [phase, setPhase] = useState<"intro" | "play" | "over">("intro");
  const [difficulty, setDifficulty] = useState<ShadowDifficulty>("intro");
  const [seed, setSeed] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [newBest, setNewBest] = useState(false);
  const total = results.reduce((s, r) => s + r.points, 0);

  const start = () => {
    setSeed(Math.floor(Math.random() * 1e9));
    setResults([]);
    setPhase("play");
  };

  if (phase === "intro") {
    return (
      <GameIntro
        title="그림자 시계"
        tagline="막대 하나와 그 그림자만으로, 여기가 어디고 지금이 언제인지 알아낼 수 있을까요?"
        howTo={[
          "땅에 세운 막대를 위에서 내려다봐요. 진한 선은 지금 그림자, 점선은 같은 날 정오(해가 가장 높을 때)의 그림자 자국이에요.",
          "정오 그림자가 짧을수록 해가 높아요. 해 높이와 그림자 방향(북·남)으로 위도와 계절을 좁혀요.",
          "파란 그림자 끝 곡선의 점은 한 시간마다 그림자 끝이 있던 자리예요. 점 개수가 낮 길이, 낮이 길면 그 반구의 여름이에요.",
          "지금 그림자가 정오 그림자에서 얼마나 돌아가 있는지로 시각을 읽어요 (해가 가장 높을 때가 12시인 해시계 시각).",
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
        title="그림자 읽기 끝!"
        score={total}
        stars={stars}
        best={readBest(`shadow-clock-${difficulty}`)}
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
              {i + 1}라운드 · {latLabel(r.latDeg)} · {dayLabel(r.day)} ·{" "}
              {solarClock(r.solarHours)} · <b>{r.points.toLocaleString()}점</b>
            </div>
          ))}
        </div>
      </ResultCard>
    );
  }

  return (
    <ShadowRound
      key={`${seed}-${results.length}`}
      round={results.length}
      total={total}
      done={results.length}
      problemSeed={seed + results.length * 7919}
      difficulty={difficulty}
      onDone={(r) => {
        const next = [...results, r];
        setResults(next);

        if (next.length >= ROUNDS) {
          setNewBest(
            saveBest(
              `shadow-clock-${difficulty}`,
              next.reduce((s, x) => s + x.points, 0),
            ),
          );
          setPhase("over");
        }
      }}
    />
  );
}

function ShadowRound({
  round,
  total,
  done,
  problemSeed,
  difficulty,
  onDone,
}: {
  round: number;
  total: number;
  done: number;
  problemSeed: number;
  difficulty: ShadowDifficulty;
  onDone: (r: RoundResult) => void;
}) {
  const problem = useMemo(
    () => makeShadowProblem(problemSeed, difficulty),
    [problemSeed, difficulty],
  );
  const set = SHADOW_SETTINGS[difficulty];
  const [latDeg, setLatDeg] = useState(20);
  const [day, setDay] = useState(set.dateGiven ? problem.day : 79);
  const [hours, setHours] = useState(12);
  const [curveHint, setCurveHint] = useState(false);
  const [scored, setScored] = useState<ReturnType<typeof scoreShadow> | null>(
    null,
  );
  const penalty = curveHint && !set.curveFree ? CURVE_HINT_COST : 0;
  const showCurve = set.curveFree || curveHint || scored !== null;
  const guessShadows = useMemo(
    () =>
      scored
        ? {
            shadow: shadowOf(sunAt(latDeg, day, hours)),
            noonShadow: shadowOf(sunAt(latDeg, day, 12)),
          }
        : null,
    [scored, latDeg, day, hours],
  );

  const submit = () => {
    const s = scoreShadow(problem, { latDeg, day, solarHours: hours }, penalty);
    setScored(s);

    if (s.total >= 800) {
      sfx.win();
    } else if (s.total >= 450) {
      sfx.hit();
    } else {
      sfx.miss();
    }
  };

  return (
    <div className="flex w-full max-w-[1200px] flex-col gap-3">
      <div className="bg-base-200/80 rounded-box flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 backdrop-blur">
        <h1 className="text-xl font-bold">그림자 시계</h1>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: ROUNDS }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-3 w-3 rounded-full",
                i < done
                  ? "bg-amber-300"
                  : i === round
                    ? "bg-white/80 ring-2 ring-white/40"
                    : "bg-white/20",
              )}
            />
          ))}
        </div>
        <div className="text-2xl font-black text-amber-200 tabular-nums">
          <CountUp value={total + (scored?.total ?? 0)} duration={900} />
          <span className="ml-1 text-sm font-normal opacity-70">점</span>
        </div>
        <div className="grow" />
        {set.dateGiven && (
          <div className="rounded-xl bg-indigo-500/20 px-3 py-1 text-sm ring-1 ring-indigo-300/40">
            📅 오늘은 <b>{dayLabel(problem.day)}</b>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative mx-auto w-full max-w-[560px] md:w-[52%]">
          <div className="rounded-box bg-black/30 p-2">
            <ShadowBoard
              latDeg={problem.latDeg}
              day={problem.day}
              shadow={problem.shadow}
              noonShadow={problem.noonShadow}
              compass={set.compass}
              rings={set.rings || scored !== null}
              curve={showCurve}
              guess={guessShadows}
            />
          </div>
          <RoundBanner
            key={round}
            text={`${round + 1} / ${ROUNDS}`}
            sub="이 그림자는 어디, 언제?"
          />
          <div className="mt-1 text-xs opacity-60">
            위에서 내려다본 마당 · 막대 높이가 눈금 한 칸
            {scored && " · 노란 선은 내 답의 그림자"}
          </div>
        </div>

        <div className="flex flex-col gap-2 md:w-[48%]">
          {!scored && (
            <>
              <div className="bg-base-200/80 rounded-box flex flex-col gap-3 p-4 text-sm backdrop-blur">
                <div className="font-bold">
                  ① 정오 그림자로 {set.dateGiven ? "위도" : "위도·계절"}
                </div>
                <Dial
                  label="위도"
                  value={latLabel(latDeg)}
                  min={-60}
                  max={70}
                  step={1}
                  current={latDeg}
                  onChange={setLatDeg}
                  marks={LAT_MARKS.map((m) => ({
                    at: (m.lat + 60) / 130,
                    text: m.name,
                  }))}
                />
                {!set.dateGiven && (
                  <Dial
                    label="날짜"
                    value={dayLabel(day)}
                    min={0}
                    max={364}
                    step={1}
                    current={day}
                    onChange={setDay}
                    marks={[
                      { at: 79 / 364, text: "춘분" },
                      { at: 171 / 364, text: "하지" },
                      { at: 265 / 364, text: "추분" },
                      { at: 354 / 364, text: "동지" },
                    ]}
                  />
                )}
                <div className="font-bold">② 지금 그림자 방향으로 시각</div>
                <Dial
                  label="해시계 시각"
                  value={solarClock(hours)}
                  min={5}
                  max={19}
                  step={1 / 6}
                  current={hours}
                  onChange={setHours}
                  marks={[
                    { at: 1 / 14, text: "6시" },
                    { at: 7 / 14, text: "정오" },
                    { at: 13 / 14, text: "18시" },
                  ]}
                />
              </div>
              {!set.curveFree && (
                <button
                  className={cn(
                    "btn btn-sm self-start",
                    curveHint ? "btn-disabled" : "btn-outline",
                  )}
                  onClick={() => {
                    sfx.twinkle(2);
                    setCurveHint(true);
                  }}
                >
                  〰 그림자 끝 곡선 보기 −{Math.round(CURVE_HINT_COST * 100)}%
                </button>
              )}
              <button className="btn btn-primary btn-lg" onClick={submit}>
                이 그림자예요! ☀️
              </button>
            </>
          )}
          {scored && (
            <ResultPanel
              problem={problem}
              guess={{ latDeg, day, hours }}
              score={scored}
              dateGiven={set.dateGiven}
              last={round + 1 >= ROUNDS}
              onNext={() =>
                onDone({
                  latDeg: problem.latDeg,
                  day: problem.day,
                  solarHours: problem.solarHours,
                  points: scored.total,
                })
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Dial({
  label,
  value,
  min,
  max,
  step,
  current,
  onChange,
  marks,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  current: number;
  onChange: (v: number) => void;
  marks: { at: number; text: string }[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="opacity-70">{label}</span>
        <b className="text-lg text-amber-200 tabular-nums">{value}</b>
      </div>
      <input
        type="range"
        className="range range-primary range-sm w-full"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="relative h-4 text-[10px] opacity-60">
        {marks.map((m) => (
          <span
            key={m.text}
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${m.at * 100}%` }}
          >
            {m.text}
          </span>
        ))}
      </div>
    </label>
  );
}

function ResultPanel({
  problem,
  guess,
  score,
  dateGiven,
  last,
  onNext,
}: {
  problem: ShadowProblem;
  guess: { latDeg: number; day: number; hours: number };
  score: ReturnType<typeof scoreShadow>;
  dateGiven: boolean;
  last: boolean;
  onNext: () => void;
}) {
  const ex = useMemo(() => explainShadow(problem), [problem]);
  const twin = useMemo(() => twinDay(problem.day), [problem.day]);
  const north = ex.noonPointsNorth;
  const dec = problem.decDeg;
  const decText = `${dec >= 0 ? "+" : "−"}${Math.abs(dec).toFixed(0)}°`;
  const longDay = ex.dayHours > 12.15;
  const shortDay = ex.dayHours < 11.85;
  const clockwise = ex.turnDeg > 0;

  return (
    <div className="bg-base-200/90 rounded-box fx-rise flex flex-col gap-2 p-4 text-sm backdrop-blur">
      <div className="flex flex-wrap items-end gap-3">
        <div className="text-4xl font-black text-amber-200">
          +<CountUp value={score.total} />
        </div>
        <div className="pb-1 opacity-70">/ {ROUND_MAX.toLocaleString()}</div>
        <div className="grow" />
        <button className="btn btn-primary" onClick={onNext}>
          {last ? "결과 보기 ★" : "다음 라운드 →"}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <ScoreCell
          title="위도"
          answer={latLabel(problem.latDeg)}
          mine={latLabel(guess.latDeg)}
          points={score.lat}
        />
        <ScoreCell
          title="계절"
          answer={dayLabel(problem.day)}
          mine={dateGiven ? "알려 줌" : dayLabel(guess.day)}
          points={score.season}
        />
        <ScoreCell
          title="시각"
          answer={solarClock(problem.solarHours)}
          mine={solarClock(guess.hours)}
          points={score.time}
        />
      </div>
      <div className="flex flex-col gap-1.5 rounded-lg bg-black/25 p-3">
        <div>
          <b>① 해 높이</b> — 정오 그림자는 막대의{" "}
          <b>{ex.noonLength.toFixed(2)}배</b> → 높이 1, 밑변{" "}
          {ex.noonLength.toFixed(2)}인 직각삼각형의 각 = 해 높이{" "}
          <b>{ex.noonAltDeg.toFixed(0)}°</b> → 해는 머리 꼭대기(천정)에서{" "}
          <b>{ex.zenithGapDeg.toFixed(0)}°</b> 떨어져 있어요. 이 각이 곧 위도와
          해의 적위(해가 적도에서 북·남으로 떨어진 각)의 차이예요.
        </div>
        <div>
          <b>② 방향</b> — 정오 그림자가 <b>{north ? "북쪽" : "남쪽"}</b>을
          가리켜요 → 해는 {north ? "남쪽" : "북쪽"} 하늘 → 위도가 해의 적위보다{" "}
          {north ? "북쪽" : "남쪽"}이에요: 위도 = 적위 {north ? "+" : "−"}{" "}
          {ex.zenithGapDeg.toFixed(0)}°.
        </div>
        <div>
          <b>③ 계절</b> — 그림자 끝 점으로 센 낮 길이{" "}
          <b>{ex.dayHours.toFixed(1)}시간</b>.{" "}
          {longDay
            ? "12시간보다 길면 해가 내 반구 쪽에 있는 여름 쪽이에요."
            : shortDay
              ? "12시간보다 짧으면 해가 반대 반구 쪽에 있는 겨울 쪽이에요."
              : "거의 12시간이면 해가 적도 위, 춘분·추분 무렵이에요."}{" "}
          이날 해의 적위는 <b>{decText}</b> ({dayLabel(problem.day)}
          {twin !== null && ` 또는 그림자가 같은 ${dayLabel(twin)}`}) → 위도 ={" "}
          {decText} {north ? "+" : "−"} {ex.zenithGapDeg.toFixed(0)}° ={" "}
          <b>{latLabel(problem.latDeg)}</b>
        </div>
        <div>
          <b>④ 시각</b> — 지금 그림자는 정오 그림자에서{" "}
          <b>{Math.abs(ex.turnDeg).toFixed(0)}°</b>{" "}
          {clockwise ? "시계 방향" : "시계 반대 방향"}으로 돌아가 있어요.
          그림자는 해의 반대쪽이라 해는 {ex.morning ? "동쪽" : "서쪽"} →{" "}
          {ex.morning ? "오전" : "오후"}. 곡선의 정각 점에 맞춰 보면{" "}
          <b>{solarClock(problem.solarHours)}</b>. (해는 한 시간에 15°씩 돌지만
          그림자 방향은 정오 가까이에서 더 빨리 돌아요.)
        </div>
        {!dateGiven && twin !== null && (
          <div className="text-xs opacity-60">
            봄과 가을의 같은 적위인 날은 그림자가 똑같아서, 계절 점수는 날짜가
            아니라 해의 적위 차이로 매겨요.
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreCell({
  title,
  answer,
  mine,
  points,
}: {
  title: string;
  answer: string;
  mine: string;
  points: number;
}) {
  return (
    <div className="rounded-lg bg-black/25 p-2">
      <div className="font-bold">{title}</div>
      <div className="text-emerald-300">정답 {answer}</div>
      <div className="text-amber-200">내 답 {mine}</div>
      <div className="mt-1 text-base font-black">+{points}</div>
    </div>
  );
}
