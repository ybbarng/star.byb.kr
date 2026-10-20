"use client";

import type { MapPin } from "@/game/geo/drawMap";
import type { GeoDifficulty, GeoProblem, HintKey } from "@/game/geo/problem";
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
  clockLabel,
  distanceKm,
  explain,
  GEO_SETTINGS,
  HINT_COSTS,
  localMinutes,
  makeGeoProblem,
  MAX_ROUND_POINTS,
  pointsFor,
  SEASON_CARD,
} from "@/game/geo/problem";
import SkyViewer from "@/game/geo/SkyViewer";
import WorldMap from "@/game/geo/WorldMap";
import { cn } from "@/utils/cn";

// 별하늘 지오게서 (docs/game-plans.md): 밤하늘을 360°로 둘러보고, 세계 공통 시각(UTC)과 낮밤 지도를 시계 삼아
// 찍은 곳을 세계 지도에 핀으로 찍는다. 위도는 천구의 극 높이(또는 남쪽 별의 높이), 경도는 하늘에서 읽은 현지 시각과
// 지도의 현지 시각이 같은 곳. 다섯 라운드, 라운드마다 최고 5,000점.

const ROUNDS = 5;

const DIFFICULTIES: { value: GeoDifficulty; title: string; note: string }[] = [
  { value: "easy", title: "쉬움", note: "방위·지도 시각 띠·계절 카드" },
  { value: "normal", title: "보통", note: "산과 구름이 조금, 시각 띠 없이" },
  { value: "hard", title: "어려움", note: "방위 없음, 산·구름·도시 불빛" },
];

const HINT_LABELS: Record<HintKey, { title: string; note: string }> = {
  timelapse: {
    title: "⏱ 타임랩스",
    note: "지난 한 시간 별이 지나온 궤적. 궤적이 도는 중심이 천구의 극이에요",
  },
  seasonCard: {
    title: "🗓 계절 별자리 카드",
    note: "달마다 자정에 남쪽 하늘 한가운데 오는 별자리",
  },
  compass: { title: "🧭 방위 표시", note: "하늘에 동서남북" },
  localClock: {
    title: "🕰 현지 시계",
    note: "그곳 시계가 대략 몇 시였는지 (경도 범위가 확 좁아져요)",
  },
};

const MONTH_DAY = (d: Date) => `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
const UTC_CLOCK = (d: Date) =>
  clockLabel(d.getUTCHours() * 60 + d.getUTCMinutes());

interface RoundResult {
  guess: { latDeg: number; lonDeg: number };
  km: number;
  points: number;
}

export default function GeoGame() {
  const [phase, setPhase] = useState<"intro" | "play" | "over">("intro");
  const [difficulty, setDifficulty] = useState<GeoDifficulty>("easy");
  const [seed, setSeed] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [newBest, setNewBest] = useState(false);
  const total = results.reduce((s, r) => s + r.points, 0);

  if (phase === "intro") {
    return (
      <GameIntro
        title="별하늘 지오게서"
        tagline="밤하늘 사진 한 장, 이 사진은 지구 어디서 찍었을까?"
        howTo={[
          "하늘을 끌어서 사방을 둘러보세요. 찍은 날짜와 세계 공통 시각(UTC)을 알려 줘요.",
          "위도: 천구의 북극(북극성 곁)이나 남극이 지평선에서 뜬 높이가 곧 위도예요.",
          "경도: 노을·새벽빛, 남쪽 하늘의 별자리, 북두칠성 시계로 그곳의 현지 시각을 읽고, 낮밤 지도에서 그 시각인 곳을 찾으세요.",
          `지도에 핀을 찍으면 끝! 가까울수록 높은 점수 (라운드마다 최고 ${MAX_ROUND_POINTS.toLocaleString()}점, ${ROUNDS}라운드).`,
        ]}
        onStart={() => {
          setSeed(Math.floor(Math.random() * 1e9));
          setResults([]);
          setPhase("play");
        }}
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
      total >= ROUNDS * 3600
        ? 3
        : total >= ROUNDS * 2000
          ? 2
          : total > 0
            ? 1
            : 0;

    return (
      <ResultCard
        title="별하늘 탐험 끝!"
        score={total}
        stars={stars}
        best={readBest(`geo-${difficulty}`)}
        newBest={newBest}
        actions={
          <>
            <button
              className="btn btn-primary"
              onClick={() => {
                setSeed(Math.floor(Math.random() * 1e9));
                setResults([]);
                setPhase("play");
              }}
            >
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
              {i + 1}라운드 · {Math.round(r.km).toLocaleString()}km ·{" "}
              <b>{r.points.toLocaleString()}점</b>
            </div>
          ))}
        </div>
      </ResultCard>
    );
  }

  return (
    <GeoRound
      key={`${seed}-${results.length}`}
      round={results.length}
      total={total}
      results={results}
      problemSeed={seed + results.length * 7919}
      difficulty={difficulty}
      onDone={(r) => {
        const next = [...results, r];
        setResults(next);

        if (next.length >= ROUNDS) {
          setNewBest(
            saveBest(
              `geo-${difficulty}`,
              next.reduce((s, x) => s + x.points, 0),
            ),
          );
          setPhase("over");
        }
      }}
    />
  );
}

function GeoRound({
  round,
  total,
  results,
  problemSeed,
  difficulty,
  onDone,
}: {
  round: number;
  total: number;
  results: RoundResult[];
  problemSeed: number;
  difficulty: GeoDifficulty;
  onDone: (r: RoundResult) => void;
}) {
  const problem = useMemo(
    () => makeGeoProblem(problemSeed, difficulty),
    [problemSeed, difficulty],
  );
  const set = GEO_SETTINGS[problem.difficulty];
  const [guess, setGuess] = useState<{ latDeg: number; lonDeg: number } | null>(
    null,
  );
  const [hints, setHints] = useState<Set<HintKey>>(new Set());
  const [result, setResult] = useState<RoundResult | null>(null);
  const [showLines, setShowLines] = useState(false);
  const penalty = [...hints].reduce((s, h) => s + HINT_COSTS[h], 0);
  const seasonCard = set.seasonCard || hints.has("seasonCard");
  const compass = set.compass || hints.has("compass");
  const ex = useMemo(() => explain(problem), [problem]);
  const truth = problem.observer;
  const available: HintKey[] = [
    "timelapse",
    ...(!set.seasonCard ? (["seasonCard"] as const) : []),
    ...(!set.compass ? (["compass"] as const) : []),
    "localClock",
  ];
  const kst = new Date(problem.date.getTime() + 9 * 3600000);

  const pins: MapPin[] = [
    ...(guess ? [{ ...guess, color: "#ffd166", label: "내 답" }] : []),
    ...(result ? [{ ...truth, color: "#06d6a0", label: "정답" }] : []),
  ];

  const submit = () => {
    if (!guess) {
      return;
    }

    const km = distanceKm(guess, truth);
    const points = pointsFor(km, penalty);
    setResult({ guess, km, points });

    if (points >= 4000) {
      sfx.win();
    } else if (points >= 1500) {
      sfx.hit();
    } else {
      sfx.miss();
    }
  };

  return (
    <div className="flex w-full max-w-[1400px] flex-col gap-3">
      {/* 상단: 라운드, 점수, 문제 정보 */}
      <div className="bg-base-200/80 rounded-box flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 backdrop-blur">
        <h1 className="text-xl font-bold">별하늘 지오게서</h1>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: ROUNDS }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-3 w-3 rounded-full",
                i < results.length
                  ? "bg-amber-300"
                  : i === round
                    ? "bg-white/80 ring-2 ring-white/40"
                    : "bg-white/20",
              )}
            />
          ))}
        </div>
        <div className="text-2xl font-black text-amber-200 tabular-nums">
          <CountUp value={total + (result?.points ?? 0)} duration={900} />
          <span className="ml-1 text-sm font-normal opacity-70">점</span>
        </div>
        <div className="grow" />
        <div className="rounded-xl bg-indigo-500/20 px-3 py-1 text-sm ring-1 ring-indigo-300/40">
          📅 <b>{MONTH_DAY(problem.date)}</b> · 🌐 세계 공통 시각(UTC){" "}
          <b>{UTC_CLOCK(problem.date)}</b>
          <span className="ml-2 opacity-60">
            (한국 시간 {MONTH_DAY(kst)} {UTC_CLOCK(kst)})
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row">
        <div className="relative xl:w-[58%]">
          <SkyViewer
            problem={problem}
            compass={compass || result !== null}
            timelapse={hints.has("timelapse")}
            constellations={showLines}
          />
          <RoundBanner
            key={round}
            text={`${round + 1} / ${ROUNDS}`}
            sub="이 하늘은 어디일까?"
          />
          <div className="mt-1 text-xs opacity-60">
            끌어서 사방을 둘러보세요 · 휠로 확대·축소
          </div>
        </div>

        <div className="flex flex-col gap-2 xl:w-[42%]">
          <WorldMap
            utc={problem.date}
            timeBands={set.timeBands || result !== null}
            hoverTime={set.hoverTime || result !== null}
            pins={pins}
            line={
              result && guess
                ? [
                    { ...guess, color: "" },
                    { ...truth, color: "" },
                  ]
                : undefined
            }
            onPick={
              result
                ? undefined
                : (latDeg, lonDeg) => {
                    sfx.tap();
                    setGuess({ latDeg, lonDeg });
                  }
            }
            focus={result ? truth : undefined}
          />
          {!result ? (
            <button
              className="btn btn-primary btn-lg"
              disabled={!guess}
              onClick={submit}
            >
              {guess ? "여기서 찍었어요! 📍" : "지도에 핀을 찍으세요"}
            </button>
          ) : (
            <RoundResultPanel
              result={result}
              problem={problem}
              ex={ex}
              showLines={showLines}
              onToggleLines={() => setShowLines((v) => !v)}
              onNext={() => onDone(result)}
              last={round + 1 >= ROUNDS}
            />
          )}

          {!result && (
            <div className="bg-base-200/80 rounded-box flex flex-col gap-2 p-3 text-sm backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="font-bold">힌트</span>
                <span className="text-xs opacity-60">
                  쓴 만큼 이번 라운드 점수가 줄어요
                  {penalty > 0 && ` (−${Math.round(penalty * 100)}%)`}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {available.map((h) => (
                  <button
                    key={h}
                    className={cn(
                      "btn btn-sm",
                      hints.has(h) ? "btn-disabled" : "btn-outline",
                    )}
                    title={HINT_LABELS[h].note}
                    onClick={() => {
                      sfx.twinkle(2);
                      setHints((s) => new Set([...s, h]));
                    }}
                  >
                    {HINT_LABELS[h].title} −{Math.round(HINT_COSTS[h] * 100)}%
                  </button>
                ))}
              </div>
              {hints.has("localClock") && (
                <div className="fx-rise rounded-lg bg-amber-300/15 p-2">
                  🕰 그곳 시계는 대략{" "}
                  <b>
                    {Math.round(
                      localMinutes(problem.date, problem.observer.lonDeg) / 60,
                    ) % 24}
                    시
                  </b>{" "}
                  무렵이었어요.
                </div>
              )}
              {seasonCard && <SeasonCard />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SeasonCard() {
  return (
    <div className="rounded-lg bg-indigo-500/10 p-2 text-xs ring-1 ring-indigo-300/30">
      <div className="mb-1 font-bold">
        🗓 계절 별자리 카드 — 매달 15일 자정, 하늘 한가운데(정남, 남반구는 정북)
      </div>
      <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 sm:grid-cols-4">
        {SEASON_CARD.map((c) => (
          <span key={c.month}>
            {c.month}월 <b>{c.label}</b>
          </span>
        ))}
      </div>
      <div className="mt-1 opacity-70">
        같은 별자리는 하루 4분, 한 달 2시간씩 일찍 와요. 동쪽에서 막 뜨는
        별자리는 6시간 뒤, 서쪽으로 지는 별자리는 6시간 전에 한가운데였어요.
      </div>
    </div>
  );
}

function RoundResultPanel({
  result,
  problem,
  ex,
  showLines,
  onToggleLines,
  onNext,
  last,
}: {
  result: RoundResult;
  problem: GeoProblem;
  ex: ReturnType<typeof explain>;
  showLines: boolean;
  onToggleLines: () => void;
  onNext: () => void;
  last: boolean;
}) {
  const { latDeg, lonDeg } = problem.observer;
  const latText = `${latDeg >= 0 ? "북위" : "남위"} ${Math.abs(latDeg).toFixed(1)}°`;
  const lonText = `${lonDeg >= 0 ? "동경" : "서경"} ${Math.abs(lonDeg).toFixed(1)}°`;
  const offset = ex.hourOffset;
  const skyClue =
    ex.skyTime === "dusk"
      ? "서쪽 지평선에 노을이 남아 있었어요 → 해 진 지 얼마 안 된 저녁"
      : ex.skyTime === "dawn"
        ? "동쪽 지평선이 밝아 오고 있었어요 → 동트기 전 새벽"
        : `하늘 한가운데(${latDeg >= 0 ? "정남" : "정북"} 쪽)에 ${ex.meridian}이(가) 있었어요 → 계절 별자리 카드로 ${MONTH_DAY(problem.date)}의 시각을 읽어요`;

  return (
    <div className="bg-base-200/90 rounded-box fx-rise flex flex-col gap-2 p-4 text-sm backdrop-blur">
      <div className="flex flex-wrap items-end gap-3">
        <div className="text-4xl font-black text-amber-200">
          +<CountUp value={result.points} />
        </div>
        <div className="pb-1">
          정답까지 <b>{Math.round(result.km).toLocaleString()}km</b>
        </div>
        <div className="grow" />
        <button className="btn btn-primary" onClick={onNext}>
          {last ? "결과 보기 ★" : "다음 라운드 →"}
        </button>
      </div>
      <div className="text-xs opacity-80">
        정답: {latText}, {lonText} · 현지 시각 약 {ex.localClock}
      </div>
      <div className="flex flex-col gap-1.5 rounded-lg bg-black/25 p-3">
        <div>
          <b>위도</b> — {ex.poleName}이 지평선에서{" "}
          <b>{ex.poleAltitudeDeg.toFixed(0)}°</b> 높이 → {latText}
        </div>
        <div>
          <b>현지 시각</b> — {skyClue}. 그곳 현지 시각은 약{" "}
          <b>{ex.localClock}</b>
        </div>
        <div>
          <b>경도</b> — 현지 {ex.localClock} − 세계 공통 시각 {ex.utcClock} ={" "}
          {offset >= 0 ? "+" : "−"}
          {Math.abs(offset).toFixed(1)}시간 → 1시간에 15°씩 → <b>{lonText}</b>
        </div>
        <div className="text-xs opacity-60">
          고수 팁: 달은 별 사이를 한 시간에 약 0.5°씩 움직여서, 별에 대한 달의
          자리를 정밀하게 재면 시계 없이도 경도를 알 수 있어요 (옛 항해사의 달
          거리법).
        </div>
      </div>
      <button
        className="btn btn-sm btn-ghost self-start"
        onClick={onToggleLines}
      >
        {showLines ? "별자리선 끄기" : "하늘에 별자리선 보기"}
      </button>
    </div>
  );
}
