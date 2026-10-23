"use client";

import type {
  Facing,
  TrailDifficulty,
  TrailExplanation,
  TrailProblem,
  TrailScore,
} from "@/game/starTrails/trails";
import type { Point2D } from "@/scripts/hash/types";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { drawTrailPhoto } from "@/game/starTrails/drawTrails";
import {
  altOfEnu,
  enuOf,
  explainTrails,
  FACING_LABELS,
  hoursLabel,
  latLabel,
  makeTrailProblem,
  pixelToEnu,
  projectEnu,
  roundMax,
  scoreTrails,
  TRAIL_SETTINGS,
} from "@/game/starTrails/trails";
import { cn } from "@/utils/cn";

// 별 궤적 풀기 (docs/game-plans.md): 장노출 별 궤적 사진만 보고 ① 궤적이 도는 중심(천구의 극)을 찍고
// ② 극의 높이로 위도 ③ 호의 각으로 노출 시간 ④ (어려움) 찍은 방향을 맞힌다. 다섯 라운드.

const ROUNDS = 5;

const DIFFICULTIES: { value: TrailDifficulty; title: string; note: string }[] =
  [
    { value: "intro", title: "입문", note: "북쪽 하늘, 높이 눈금" },
    { value: "easy", title: "쉬움", note: "극이 사진 안" },
    { value: "normal", title: "보통", note: "남반구도, 극이 밖에" },
    { value: "hard", title: "어려움", note: "적도 근처, 방향도" },
  ];

const LAT_MARKS = [
  { name: "남위 40°", lat: -40 },
  { name: "적도", lat: 0 },
  { name: "서울", lat: 37.6 },
];

const FACINGS: Facing[] = ["north", "east", "south", "west"];

interface RoundResult {
  latDeg: number;
  hours: number;
  points: number;
  max: number;
}

export default function StarTrailsGame() {
  const [phase, setPhase] = useState<"intro" | "play" | "over">("intro");
  const [difficulty, setDifficulty] = useState<TrailDifficulty>("intro");
  const [seed, setSeed] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [newBest, setNewBest] = useState(false);
  const total = results.reduce((s, r) => s + r.points, 0);
  const totalMax = results.reduce((s, r) => s + r.max, 0);

  const start = () => {
    setSeed(Math.floor(Math.random() * 1e9));
    setResults([]);
    setPhase("play");
  };

  if (phase === "intro") {
    return (
      <GameIntro
        title="별 궤적 풀기"
        tagline="카메라 셔터를 몇 시간 열어 두면 별이 하늘에 원을 그려요. 이 줄무늬만 보고 어디서, 얼마 동안 찍었는지 알아낼 수 있을까요?"
        howTo={[
          "하늘은 하루에 한 바퀴 돌아요. 그래서 모든 궤적은 한 점(천구의 극)을 중심으로 한 동심원의 조각이에요. 그 중심을 사진 위에 찍어요.",
          "극의 높이(지평선에서 몇 도 위)가 곧 위도예요. 북쪽 하늘에서 돌면 북반구, 남쪽 하늘에서 돌면 남반구예요.",
          "호가 극을 몇 도 돌았는지 보세요. 하늘은 한 시간에 15°씩 도니까, 호의 각 ÷ 15° = 노출 시간이에요.",
          "어려움에서는 동서남북도 알려 주지 않아요. 궤적 모양으로 어느 쪽을 찍었는지 맞혀요.",
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
    const ratio = totalMax ? total / totalMax : 0;
    const stars = ratio >= 0.75 ? 3 : ratio >= 0.45 ? 2 : total > 0 ? 1 : 0;

    return (
      <ResultCard
        title="궤적 풀기 끝!"
        score={total}
        stars={stars}
        best={readBest(`star-trails-${difficulty}`)}
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
              {i + 1}라운드 · {latLabel(r.latDeg)} · {hoursLabel(r.hours)} 노출
              · <b>{r.points.toLocaleString()}점</b>
            </div>
          ))}
        </div>
        <ComputerNote />
      </ResultCard>
    );
  }

  return (
    <TrailRound
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
              `star-trails-${difficulty}`,
              next.reduce((s, x) => s + x.points, 0),
            ),
          );
          setPhase("over");
        }
      }}
    />
  );
}

function ComputerNote() {
  return (
    <div className="rounded-lg bg-indigo-500/15 p-3 text-xs ring-1 ring-indigo-300/30">
      🤖 이 사이트의 자동 풀이(플레이트 솔버)는 인터넷에서 모은 별 궤적 사진
      10장을 하나도 풀지 못했어요. 컴퓨터는 별을 &lsquo;점&rsquo;으로 찾는데
      궤적은 &lsquo;선&rsquo;이거든요. 사람이 컴퓨터보다 잘하는 문제예요.
    </div>
  );
}

function TrailRound({
  round,
  total,
  problemSeed,
  difficulty,
  onDone,
}: {
  round: number;
  total: number;
  problemSeed: number;
  difficulty: TrailDifficulty;
  onDone: (r: RoundResult) => void;
}) {
  const problem = useMemo(
    () => makeTrailProblem(problemSeed, difficulty),
    [problemSeed, difficulty],
  );
  const set = TRAIL_SETTINGS[difficulty];
  const [pole, setPole] = useState<Point2D | null>(null);
  const [latDeg, setLatDeg] = useState(20);
  const [hours, setHours] = useState(2);
  const [facing, setFacing] = useState<Facing | null>(null);
  const [scored, setScored] = useState<TrailScore | null>(null);
  const explanation = useMemo(
    () => (scored ? explainTrails(problem) : null),
    [scored, problem],
  );
  const poleAlt = pole
    ? altOfEnu(pixelToEnu(problem.view, problem.width, problem.height, pole))
    : null;
  const ready =
    (!problem.askPole || pole !== null) && (!set.askFacing || facing !== null);

  const submit = () => {
    const s = scoreTrails(problem, { polePx: pole, latDeg, hours, facing });
    setScored(s);

    if (s.total >= s.max * 0.8) {
      sfx.win();
    } else if (s.total >= s.max * 0.45) {
      sfx.hit();
    } else {
      sfx.miss();
    }
  };

  return (
    <div className="flex w-full max-w-[1200px] flex-col gap-3">
      <div className="bg-base-200/80 rounded-box flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 backdrop-blur">
        <h1 className="text-xl font-bold">별 궤적 풀기</h1>
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
          <CountUp value={total + (scored?.total ?? 0)} duration={900} />
          <span className="ml-1 text-sm font-normal opacity-70">점</span>
        </div>
        <div className="grow" />
        <div className="rounded-xl bg-indigo-500/20 px-3 py-1 text-sm ring-1 ring-indigo-300/40">
          📷 가로 화각 <b>{problem.view.fovDeg}°</b>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative w-full lg:w-[62%]">
          <TrailBoard
            problem={problem}
            pole={pole}
            onPick={
              scored || !problem.askPole
                ? undefined
                : (p) => {
                    sfx.tap();
                    setPole(p);
                  }
            }
            reveal={explanation}
          />
          <RoundBanner
            key={round}
            text={`${round + 1} / ${ROUNDS}`}
            sub="이 궤적은 어디서, 얼마 동안?"
          />
          <div className="mt-1 text-xs opacity-60">
            {problem.askPole
              ? problem.marginPx > 0
                ? "궤적이 도는 중심을 눌러 찍어요 · 사진 밖 점선 칸도 누를 수 있어요"
                : "궤적이 도는 중심을 눌러 찍어요"
              : "이 사진에서는 극이 너무 멀어 찍지 않아요"}
            {set.altitudeGrid && " · 파란 점선은 지평선에서 10°마다의 높이"}
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:w-[38%]">
          {!scored && (
            <>
              <div className="bg-base-200/80 rounded-box flex flex-col gap-3 p-4 text-sm backdrop-blur">
                {problem.askPole && (
                  <div>
                    <div className="font-bold">① 궤적이 도는 중심 찍기</div>
                    <div className="opacity-80">
                      {pole
                        ? set.poleAltHint && poleAlt !== null
                          ? `찍었어요 — 그 점의 높이는 약 ${poleAlt.toFixed(0)}°예요`
                          : "찍었어요 (다시 누르면 옮겨요)"
                        : "사진에서 모든 호의 한가운데를 눌러요"}
                    </div>
                  </div>
                )}
                <Dial
                  label={`${problem.askPole ? "②" : "①"} 위도 (극의 높이)`}
                  value={latLabel(latDeg)}
                  min={-70}
                  max={70}
                  step={1}
                  current={latDeg}
                  onChange={setLatDeg}
                  marks={LAT_MARKS.map((m) => ({
                    at: (m.lat + 70) / 140,
                    text: m.name,
                  }))}
                />
                <Dial
                  label={`${problem.askPole ? "③" : "②"} 노출 시간 (호의 각 ÷ 15°)`}
                  value={`${hoursLabel(hours)} · 호 ${Math.round(hours * 15)}°`}
                  min={0.25}
                  max={7}
                  step={0.25}
                  current={hours}
                  onChange={setHours}
                  marks={[
                    { at: 0.75 / 6.75, text: "1시간" },
                    { at: 2.75 / 6.75, text: "3시간" },
                    { at: 5.75 / 6.75, text: "6시간" },
                  ]}
                />
                {set.askFacing && (
                  <div className="flex flex-col gap-1">
                    <div className="opacity-70">
                      {problem.askPole ? "④" : "③"} 어느 쪽을 보고 찍었을까요?
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {FACINGS.map((f) => (
                        <button
                          key={f}
                          className={cn(
                            "btn btn-sm",
                            facing === f ? "btn-warning" : "btn-outline",
                          )}
                          onClick={() => {
                            sfx.tap();
                            setFacing(f);
                          }}
                        >
                          {FACING_LABELS[f]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                className="btn btn-primary btn-lg"
                disabled={!ready}
                onClick={submit}
              >
                {ready
                  ? "이 하늘이에요! ✨"
                  : problem.askPole && !pole
                    ? "먼저 중심을 찍어요"
                    : "방향을 골라요"}
              </button>
            </>
          )}
          {scored && explanation && (
            <ResultPanel
              problem={problem}
              guess={{ latDeg, hours, facing }}
              score={scored}
              ex={explanation}
              last={round + 1 >= ROUNDS}
              onNext={() =>
                onDone({
                  latDeg: problem.observer.latDeg,
                  hours: problem.exposureHours,
                  points: scored.total,
                  max: roundMax(problem),
                })
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

// 사진 + (보통·어려움) 사진 밖 여백. 누른 자리를 사진 좌표로 돌려준다. 풀이 때는 극·호의 각·극 높이를 겹쳐 그린다
function TrailBoard({
  problem,
  pole,
  onPick,
  reveal,
}: {
  problem: TrailProblem;
  pole: Point2D | null;
  onPick?: (p: Point2D) => void;
  reveal: TrailExplanation | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const set = TRAIL_SETTINGS[problem.difficulty];
  const W = problem.width;
  const H = problem.height;
  const M = problem.marginPx;
  const BW = W + 2 * M;
  const BH = H + 2 * M;
  const pct = (v: number) => `${v * 100}%`;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");

    if (ctx) {
      drawTrailPhoto(ctx, problem, {
        grid: set.altitudeGrid,
        compass: set.compass,
      });
    }
  }, [problem, set.altitudeGrid, set.compass]);

  const truePole = problem.polePx;
  const poleShown =
    !!truePole &&
    truePole[0] > -M &&
    truePole[0] < W + M &&
    truePole[1] > -M &&
    truePole[1] < H + M;
  const poleFoot = useMemo(() => {
    const azDeg = problem.observer.latDeg >= 0 ? 0 : 180;

    return projectEnu(problem.view, W, H, enuOf(0, azDeg));
  }, [problem, W, H]);

  return (
    <div
      className={cn(
        "relative w-full touch-manipulation select-none",
        M > 0 &&
          "rounded-box border border-dashed border-white/25 bg-white/[0.03]",
      )}
      style={{ aspectRatio: `${BW} / ${BH}` }}
    >
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="absolute rounded-md shadow-2xl"
        style={{
          left: pct(M / BW),
          top: pct(M / BH),
          width: pct(W / BW),
          height: pct(H / BH),
        }}
      />
      <svg
        viewBox={`${-M} ${-M} ${BW} ${BH}`}
        className={cn(
          "absolute inset-0 h-full w-full",
          onPick && "cursor-crosshair",
        )}
        onClick={(e) => {
          if (!onPick) {
            return;
          }

          const r = e.currentTarget.getBoundingClientRect();
          onPick([
            ((e.clientX - r.left) / r.width) * BW - M,
            ((e.clientY - r.top) / r.height) * BH - M,
          ]);
        }}
      >
        {reveal?.sample && (
          <>
            <polyline
              points={reveal.sample.points.map((q) => q.join(",")).join(" ")}
              fill="none"
              stroke="rgba(252,211,77,0.95)"
              strokeWidth={5}
              strokeLinecap="round"
            />
            {poleShown && (
              <>
                {[reveal.sample.start, reveal.sample.end].map((q, i) => (
                  <line
                    key={i}
                    x1={truePole![0]}
                    y1={truePole![1]}
                    x2={q[0]}
                    y2={q[1]}
                    stroke="rgba(252,211,77,0.7)"
                    strokeWidth={2.5}
                    strokeDasharray="10 8"
                  />
                ))}
                <text
                  x={(reveal.sample.start[0] + reveal.sample.end[0]) / 2}
                  y={(reveal.sample.start[1] + reveal.sample.end[1]) / 2 - 14}
                  fill="#fde68a"
                  fontSize={30}
                  fontWeight="bold"
                  textAnchor="middle"
                  stroke="rgba(0,0,0,0.7)"
                  strokeWidth={5}
                  paintOrder="stroke"
                >
                  {Math.round(reveal.arcDeg)}° 돌았어요
                </text>
              </>
            )}
          </>
        )}
        {reveal && poleShown && poleFoot && (
          <>
            <line
              x1={truePole![0]}
              y1={truePole![1]}
              x2={truePole![0]}
              y2={Math.min(poleFoot[1], H)}
              stroke="rgba(110,231,183,0.8)"
              strokeWidth={2.5}
              strokeDasharray="4 6"
            />
            <text
              x={truePole![0] + 16}
              y={(truePole![1] + Math.min(poleFoot[1], H)) / 2}
              fill="#6ee7b7"
              fontSize={28}
              fontWeight="bold"
              stroke="rgba(0,0,0,0.7)"
              strokeWidth={5}
              paintOrder="stroke"
            >
              높이 {reveal.poleAltDeg.toFixed(0)}°
            </text>
          </>
        )}
        {pole && (
          <g stroke="#fbbf24" strokeWidth={3} fill="none">
            <circle cx={pole[0]} cy={pole[1]} r={16} />
            <line
              x1={pole[0] - 26}
              y1={pole[1]}
              x2={pole[0] + 26}
              y2={pole[1]}
            />
            <line
              x1={pole[0]}
              y1={pole[1] - 26}
              x2={pole[0]}
              y2={pole[1] + 26}
            />
          </g>
        )}
        {reveal && poleShown && (
          <g>
            {pole && (
              <line
                x1={pole[0]}
                y1={pole[1]}
                x2={truePole![0]}
                y2={truePole![1]}
                stroke="rgba(255,255,255,0.6)"
                strokeWidth={2}
              />
            )}
            <circle
              cx={truePole![0]}
              cy={truePole![1]}
              r={13}
              fill="rgba(110,231,183,0.35)"
              stroke="#6ee7b7"
              strokeWidth={3}
            />
            <text
              x={truePole![0]}
              y={truePole![1] - 24}
              fill="#6ee7b7"
              fontSize={28}
              fontWeight="bold"
              textAnchor="middle"
              stroke="rgba(0,0,0,0.7)"
              strokeWidth={5}
              paintOrder="stroke"
            >
              {reveal.north ? "천구의 북극" : "천구의 남극"}
            </text>
          </g>
        )}
      </svg>
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
      <div className="flex items-baseline justify-between gap-2">
        <span className="opacity-70">{label}</span>
        <b className="text-lg whitespace-nowrap text-amber-200 tabular-nums">
          {value}
        </b>
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

// 찍은 방향마다 궤적이 어떻게 보이는지
const facingStory = (p: TrailProblem, ex: TrailExplanation) => {
  const poleSide = ex.north ? "north" : "south";
  const tilt = ex.risingAngleDeg.toFixed(0);

  if (p.facing === poleSide) {
    return `극이 있는 ${FACING_LABELS[p.facing]}을 찍어서, 궤적이 극을 둘러싼 동심원 호로 보여요.`;
  }

  if (p.facing === "north" || p.facing === "south") {
    return `극의 반대편(${FACING_LABELS[p.facing]})을 찍어서, 보이지 않는 반대쪽 극을 도는 큰 호가 지평선 위로 둥글게 지나가요.`;
  }

  return `${FACING_LABELS[p.facing]}을 찍어서, 별이 지평선에서 비스듬히 ${p.facing === "east" ? "떠오르는" : "지는"} 거의 곧은 줄로 보여요. 이 줄과 지평선이 이루는 각은 90° − 위도 크기 = ${tilt}°예요 (적도에서는 수직으로 서요).`;
};

function ResultPanel({
  problem,
  guess,
  score,
  ex,
  last,
  onNext,
}: {
  problem: TrailProblem;
  guess: { latDeg: number; hours: number; facing: Facing | null };
  score: TrailScore;
  ex: TrailExplanation;
  last: boolean;
  onNext: () => void;
}) {
  const set = TRAIL_SETTINGS[problem.difficulty];
  const hemisphere = ex.north ? "북반구" : "남반구";
  const sideways = problem.facing === "east" || problem.facing === "west";

  return (
    <div className="bg-base-200/90 rounded-box fx-rise flex flex-col gap-2 p-4 text-sm backdrop-blur">
      <div className="flex flex-wrap items-end gap-3">
        <div className="text-4xl font-black text-amber-200">
          +<CountUp value={score.total} />
        </div>
        <div className="pb-1 opacity-70">/ {score.max.toLocaleString()}</div>
        <div className="grow" />
        <button className="btn btn-primary" onClick={onNext}>
          {last ? "결과 보기 ★" : "다음 라운드 →"}
        </button>
      </div>
      <div
        className={cn(
          "grid gap-2 text-center text-xs",
          problem.askPole && set.askFacing
            ? "grid-cols-2 sm:grid-cols-4"
            : problem.askPole || set.askFacing
              ? "grid-cols-3"
              : "grid-cols-2",
        )}
      >
        {problem.askPole && (
          <ScoreCell
            title="극 자리"
            answer="초록 점"
            mine={
              score.poleErrDeg === null
                ? "안 찍음"
                : `${score.poleErrDeg.toFixed(1)}° 차이`
            }
            points={score.pole}
          />
        )}
        <ScoreCell
          title="위도"
          answer={latLabel(problem.observer.latDeg)}
          mine={latLabel(guess.latDeg)}
          points={score.lat}
        />
        <ScoreCell
          title="노출"
          answer={hoursLabel(problem.exposureHours)}
          mine={hoursLabel(guess.hours)}
          points={score.hours}
        />
        {set.askFacing && (
          <ScoreCell
            title="방향"
            answer={FACING_LABELS[problem.facing]}
            mine={guess.facing ? FACING_LABELS[guess.facing] : "-"}
            points={score.facing}
          />
        )}
      </div>
      <div className="flex flex-col gap-1.5 rounded-lg bg-black/25 p-3">
        <div>
          <b>① 극</b> — 지구가 자전축을 중심으로 도니까, 하늘은 그 축이 가리키는
          점(천구의 극)을 중심으로 돌아요. 모든 궤적은 그 점을 둘러싼 동심원의
          조각이라, 호 두 개의 중심을 이어 보면 만나는 곳이 극이에요.
          {ex.north
            ? " 북극 바로 옆의 북극성은 아주 작은 호만 그려요."
            : " 남극에는 밝은 별이 없어서 텅 빈 중심을 짐작해야 해요."}
        </div>
        <div>
          <b>② 위도</b> — 극은 지평선에서 위도만큼 올라가 있어요. 극의 높이{" "}
          <b>{ex.poleAltDeg.toFixed(0)}°</b>, 극이{" "}
          <b>{ex.north ? "북쪽" : "남쪽"}</b> 하늘에 있으니 {hemisphere} →{" "}
          <b>{latLabel(problem.observer.latDeg)}</b>.
          {!problem.askPole &&
            sideways &&
            ` 극이 사진에 없으면 궤적이 지평선과 이루는 각(${ex.risingAngleDeg.toFixed(0)}°)으로 읽어요: 위도 크기 = 90° − ${ex.risingAngleDeg.toFixed(0)}°.`}
        </div>
        <div>
          <b>③ 노출 시간</b> — 노란 궤적
          {ex.sample?.name ? `(${ex.sample.name})` : ""}이 극을{" "}
          <b>{Math.round(ex.arcDeg)}°</b> 돌았어요. 하늘은 한 시간에 약 15°
          도니까 {Math.round(ex.arcDeg)}° ÷ 15° ≈{" "}
          <b>{hoursLabel(problem.exposureHours)}</b>.
        </div>
        <div>
          <b>{set.askFacing ? "④ 방향" : "※ 방향"}</b> —{" "}
          {facingStory(problem, ex)}
          {set.askFacing &&
            sideways &&
            " 다만 줄의 기울기만으로는 북반구의 동쪽과 남반구의 서쪽이 똑같아 보여요 — 그때는 별자리 모양으로 갈라요."}
        </div>
        <div className="text-xs opacity-60">
          계산의 한계: 별은 2000년 위치 그대로이고 대기 굴절·렌즈 왜곡은 넣지
          않았어요 (실제 사진에서는 지평선 가까운 극이 0.5°쯤 더 높아 보여요).
          하늘은 정확히는 한 시간에 15.04° 돌아요. 사진 가장자리에서는 원근
          때문에 사진 위 각도가 실제 회전각과 조금 달라 보여요.
        </div>
      </div>
      {last && <ComputerNote />}
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
