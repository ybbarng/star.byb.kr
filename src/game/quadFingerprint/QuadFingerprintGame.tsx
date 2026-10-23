"use client";

import type { Reading } from "@/game/quadFingerprint/fingerprint";
import type {
  Difficulty,
  PickRound,
  PlaceRound,
  QuadShape,
} from "@/game/quadFingerprint/problems";
import type { Point2D } from "@/scripts/hash/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  useShake,
} from "@/game/fx/Fx";
import { sfx } from "@/game/fx/sound";
import {
  equivalentFingerprints,
  isCanonical,
  matchError,
} from "@/game/quadFingerprint/fingerprint";
import {
  AXIS_TOLERANCE,
  gradePlace,
  isSameShape,
  makeRounds,
  MAX_POINTS,
  ROUNDS,
} from "@/game/quadFingerprint/problems";
import {
  FingerprintBoard,
  formatPoint,
  ShapeView,
} from "@/game/quadFingerprint/QuadViews";
import { cn } from "@/utils/cn";

// 별 넷 지문 맞추기 (docs/game-plans.md 5): 플레이트 솔버가 별 네 개 모양을 숫자 넷(quad 지문)으로 바꾸는 법을 익힌다.
// 지문 → 모양 고르기(pick)와 모양 → 지문 찍기(place)를 번갈아 여섯 판.

type Phase = "intro" | "play" | "over";

const DIFFICULTIES: { value: Difficulty; title: string; note: string }[] = [
  { value: "intro", title: "입문", note: "축을 그려 주고 눈금도" },
  { value: "easy", title: "쉬움", note: "축은 내가 찾기" },
  { value: "normal", title: "보통", note: "크기도 달라요, 닮은 가짜" },
  { value: "hard", title: "어려움", note: "숫자만, 거울 가짜" },
];

const bestKey = (d: Difficulty) => `quad-fingerprint-${d}`;

const GUIDE: Record<Difficulty, { pick: string; place: string }> = {
  intro: {
    pick: "노란 점선이 가장 먼 두 별 A·B를 이은 축이에요. 좌표판에서 A는 (0,0), B는 (1,1). 나머지 두 별(C·D)이 축의 어느 쪽, 어디쯤에 있는지 보고 같은 배치를 골라요.",
    place:
      "노란 축 A→B를 좌표판의 대각선 A→B에 겹친다고 생각하고, 나머지 두 별 자리를 좌표판에 찍어요.",
  },
  easy: {
    pick: "눈대중으로 가장 긴 쪽을 축으로 잡고, 나머지 두 별의 상대 위치를 보세요. 돌려 놓아도 같은 모양이에요.",
    place:
      "가장 먼 두 별을 찾아 A·B로 잡고, 나머지 두 별이 축 왼쪽 위인지 오른쪽 아래인지, 축의 어디쯤인지 찍어요.",
  },
  normal: {
    pick: "돌리고 크기도 바꿨어요. 지문이 가까운 닮은 가짜에 주의!",
    place: "크기가 달라도 지문은 같아요. 가장 먼 두 별부터 찾아요.",
  },
  hard: {
    pick: "숫자만 보고 골라요. 거울에 비친 가짜도 섞여 있어요.",
    place: "눈금이 없어요. 축의 가운데가 (0.5, 0.5)예요.",
  },
};

// 읽기 하나 → points[i]의 역할 (A·B·C·D = 0~3)
const rolesOf = (r: Reading) => {
  const roles = [0, 0, 0, 0];
  [...r.axis, ...r.rest].forEach((i, role) => (roles[i] = role));

  return roles;
};

const starNames = (q: QuadShape) =>
  `${q.names.map((n) => n ?? "이름 없는 별").join(" · ")}${q.constellation ? ` (${q.constellation} 근처)` : ""}`;

export default function QuadFingerprintGame() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [seed, setSeed] = useState(1);
  const [total, setTotal] = useState(0);
  const [newBest, setNewBest] = useState(false);

  // 처음 온 사람은 입문부터
  useEffect(() => {
    if (DIFFICULTIES.every((d) => readBest(bestKey(d.value)) === null)) {
      setDifficulty("intro");
    }
  }, []);

  const start = () => {
    setSeed(Math.floor(Math.random() * 1e9));
    setPhase("play");
  };

  if (phase === "intro") {
    return (
      <GameIntro
        title="별 넷 지문 맞추기"
        tagline="컴퓨터는 별 네 개의 모양을 숫자 넷으로 바꿔 기억해요. 그 지문을 읽어 봐요!"
        howTo={[
          "가장 먼 두 별 A·B를 축으로 잡아 A를 (0,0), B를 (1,1)에 놓아요.",
          "나머지 두 별 C·D의 좌표 넷이 그 모양의 지문이에요. 돌리고 키워도 그대로예요.",
          `지문을 보고 모양 고르기, 모양을 보고 지문 찍기를 번갈아 ${ROUNDS}판 해요.`,
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
    const max = ROUNDS * MAX_POINTS;
    const stars =
      total >= max * 0.8 ? 3 : total >= max * 0.55 ? 2 : total > 0 ? 1 : 0;

    return (
      <ResultCard
        title="지문 감식 결과"
        score={total}
        stars={stars}
        best={readBest(bestKey(difficulty))}
        newBest={newBest}
        actions={
          <>
            <button className="btn btn-primary" onClick={start}>
              다시 하기
            </button>
            <button className="btn" onClick={() => setPhase("intro")}>
              처음으로
            </button>
          </>
        }
      >
        <p className="text-sm opacity-80">
          컴퓨터는 별 지도의 지문 8만 3천 개 중 가까운 것을 찾고, 나머지 별로
          확인해요.
        </p>
        <Link href="/learn/match-shapes" className="link link-primary text-sm">
          찾는 원리: 모양 맞추기 →
        </Link>
      </ResultCard>
    );
  }

  return (
    <Play
      key={seed}
      difficulty={difficulty}
      seed={seed}
      onFinish={(score) => {
        setTotal(score);
        setNewBest(saveBest(bestKey(difficulty), score));
        setPhase("over");
      }}
      onBack={() => setPhase("intro")}
    />
  );
}

function Play({
  difficulty,
  seed,
  onFinish,
  onBack,
}: {
  difficulty: Difficulty;
  seed: number;
  onFinish: (total: number) => void;
  onBack: () => void;
}) {
  const rounds = useMemo(
    () => makeRounds(difficulty, seed),
    [difficulty, seed],
  );
  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [answered, setAnswered] = useState(false);
  const fx = useFx();
  const round = rounds[index];
  const total = scores.reduce((a, b) => a + b, 0);

  const onScore = (score: number) => {
    setScores((s) => [...s, score]);
    setAnswered(true);

    if (score >= MAX_POINTS * 0.9) {
      sfx.hit();
      fx.burst(0.5, 0.3, "#7dffa0", 18);
      fx.popup(0.5, 0.3, `+${score}`, "#7dffa0", 40);
    } else if (score > 0) {
      sfx.twinkle(2);
      fx.popup(0.5, 0.3, `+${score}`, "#ffe27a", 34);
    } else {
      sfx.miss();
      fx.popup(0.5, 0.3, "아쉬워요", "#ffb4b4", 34);
    }
  };

  const next = () => {
    if (index + 1 >= rounds.length) {
      onFinish(total);

      return;
    }

    sfx.tap();
    setIndex((i) => i + 1);
    setAnswered(false);
  };

  return (
    <div className="flex w-full max-w-3xl flex-col gap-3">
      <div className="bg-base-200/80 rounded-box flex flex-wrap items-center gap-3 px-4 py-2 backdrop-blur">
        <h1 className="text-xl font-bold">별 넷 지문 맞추기</h1>
        <div className="flex items-center gap-1.5">
          {rounds.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-3 w-3 rounded-full",
                i < scores.length
                  ? scores[i] >= MAX_POINTS * 0.9
                    ? "bg-amber-300 shadow-[0_0_8px_rgba(255,210,80,0.8)]"
                    : scores[i] > 0
                      ? "bg-amber-300/50"
                      : "bg-red-400"
                  : i === index
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
        <div className="grow" />
        <button className="btn btn-sm btn-ghost" onClick={onBack}>
          난이도 바꾸기
        </button>
      </div>

      <div className="relative">
        <RoundBanner
          key={`banner-${index}`}
          text={`${index + 1} / ${rounds.length}`}
          sub={round.kind === "pick" ? "지문의 모양 고르기" : "지문 찍기"}
        />
        <FxLayer fx={fx} />
        <div className="bg-base-200/60 rounded-box mb-3 p-3 text-sm backdrop-blur">
          {GUIDE[difficulty][round.kind]}
        </div>
        {round.kind === "pick" ? (
          <PickView
            key={`round-${index}`}
            round={round}
            difficulty={difficulty}
            onScore={onScore}
          />
        ) : (
          <PlaceView
            key={`round-${index}`}
            round={round}
            difficulty={difficulty}
            onScore={onScore}
          />
        )}
      </div>

      {answered && (
        <button className="btn btn-primary fx-rise self-center" onClick={next}>
          {index + 1 < rounds.length ? "다음 문제 →" : "결과 보기 ★"}
        </button>
      )}
    </div>
  );
}

// 지문 → 모양 고르기
function PickView({
  round,
  difficulty,
  onScore,
}: {
  round: PickRound;
  difficulty: Difficulty;
  onScore: (score: number) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const { ref, shake } = useShake();
  const f = round.fingerprint;
  const [c, d]: Point2D[] = [
    [f[0], f[1]],
    [f[2], f[3]],
  ];
  const hideBoard = difficulty === "hard" && picked === null;

  return (
    <div className="flex flex-col gap-3 md:flex-row">
      <div className="bg-base-200/80 rounded-box flex flex-col gap-2 p-3 backdrop-blur md:w-64 md:shrink-0">
        <div className="text-sm font-bold">이 지문의 모양은?</div>
        {hideBoard ? (
          <div className="rounded-box flex aspect-square items-center justify-center bg-[#0b0f22] p-4 text-center text-sm opacity-70">
            어려움에서는 좌표판 없이 숫자만 봐요
          </div>
        ) : (
          <FingerprintBoard
            grid={difficulty === "intro" || difficulty === "easy"}
            marks={[
              { p: c, color: "#a5b4fc", label: "C" },
              { p: d, color: "#a5b4fc", label: "D" },
            ]}
          />
        )}
        <div className="font-mono text-sm">
          <span className="text-indigo-300">C</span> {formatPoint(c)}{" "}
          <span className="text-indigo-300">D</span> {formatPoint(d)}
        </div>
        <div className="font-mono text-xs opacity-60">
          지문 ({f.map((v) => v.toFixed(2)).join(", ")})
        </div>
      </div>
      <div className="flex grow flex-col gap-3">
        <div ref={ref} className="grid grid-cols-2 gap-2">
          {round.options.map((o, i) => {
            const reading =
              difficulty === "intro"
                ? readingFor(o.points, round.fingerprint)
                : null;
            const correct = i === round.correct;

            return (
              <button
                key={i}
                disabled={picked !== null}
                className={cn(
                  "rounded-box border-2 p-1 transition",
                  picked === null
                    ? "border-transparent hover:border-amber-300/60"
                    : correct
                      ? "border-green-400"
                      : picked === i
                        ? "border-red-400"
                        : "border-transparent opacity-50",
                )}
                onClick={() => {
                  setPicked(i);
                  const ok = isSameShape(o.points, round.fingerprint);

                  if (!ok) {
                    shake();
                  }

                  onScore(ok ? MAX_POINTS : 0);
                }}
              >
                <ShapeView
                  points={o.points}
                  size={o.size}
                  mags={o.shape.mags}
                  roles={reading ? rolesOf(reading) : undefined}
                  showRest={false}
                />
                {picked !== null && o.mirrored && (
                  <div className="text-xs text-red-200">거울에 비친 가짜</div>
                )}
              </button>
            );
          })}
        </div>
        {picked !== null && (
          <Explain
            points={round.options[round.correct].points}
            size={round.options[round.correct].size}
            shape={round.answer}
            reading={readingFor(
              round.options[round.correct].points,
              round.fingerprint,
            )}
            note={
              picked === round.correct
                ? "맞아요! 돌리고 키워도 지문은 그대로예요."
                : round.options[picked].mirrored
                  ? "거울에 비친 모양이었어요. 돌리고 키우는 건 괜찮지만, 뒤집으면 지문이 달라져요."
                  : "닮았지만 다른 모양이었어요. 정답은 초록 테두리예요."
            }
          />
        )}
      </div>
    </div>
  );
}

// 지문에 가장 잘 맞는 읽기 (보기의 A·B·C·D 이름표)
const readingFor = (points: Point2D[], f: PickRound["fingerprint"]) =>
  matchError(points, f, AXIS_TOLERANCE).reading;

// 모양 → 지문 찍기
function PlaceView({
  round,
  difficulty,
  onScore,
}: {
  round: PlaceRound;
  difficulty: Difficulty;
  onScore: (score: number) => void;
}) {
  const [marks, setMarks] = useState<Point2D[]>([]);
  const [graded, setGraded] = useState<ReturnType<typeof gradePlace> | null>(
    null,
  );
  const shown = round.shown;
  const introReading = useMemo(
    () =>
      difficulty === "intro"
        ? matchError(shown.points, round.answer.fingerprint).reading
        : null,
    [difficulty, shown, round],
  );

  const tap = (p: Point2D) => {
    if (graded) {
      return;
    }

    sfx.twinkle(marks.length);
    setMarks((ms) => {
      if (ms.length < 2) {
        return [...ms, p];
      }

      // 둘 다 찍었으면 가까운 점을 옮긴다
      const near =
        Math.hypot(ms[0][0] - p[0], ms[0][1] - p[1]) <
        Math.hypot(ms[1][0] - p[0], ms[1][1] - p[1])
          ? 0
          : 1;

      return ms.map((m, i) => (i === near ? p : m));
    });
  };

  const answer = graded
    ? ([
        [graded.reading.hash[0], graded.reading.hash[1]],
        [graded.reading.hash[2], graded.reading.hash[3]],
      ] as Point2D[])
    : [];
  // 내가 찍은 점마다 가까운 정답 점과 잇는다
  const pairs: [Point2D, Point2D][] =
    graded && marks.length === 2
      ? Math.hypot(marks[0][0] - answer[0][0], marks[0][1] - answer[0][1]) +
          Math.hypot(marks[1][0] - answer[1][0], marks[1][1] - answer[1][1]) <=
        Math.hypot(marks[0][0] - answer[1][0], marks[0][1] - answer[1][1]) +
          Math.hypot(marks[1][0] - answer[0][0], marks[1][1] - answer[0][1])
        ? [
            [marks[0], answer[0]],
            [marks[1], answer[1]],
          ]
        : [
            [marks[0], answer[1]],
            [marks[1], answer[0]],
          ]
      : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="bg-base-200/80 rounded-box flex flex-col gap-2 p-3 backdrop-blur">
          <div className="text-sm font-bold">이 별 넷의 지문은?</div>
          <ShapeView
            points={shown.points}
            size={shown.size}
            mags={shown.shape.mags}
            roles={introReading ? rolesOf(introReading) : undefined}
          />
        </div>
        <div className="bg-base-200/80 rounded-box flex flex-col gap-2 p-3 backdrop-blur">
          <div className="text-sm font-bold">
            좌표판에 C·D 두 점을 찍어요 ({marks.length}/2)
          </div>
          <FingerprintBoard
            grid={difficulty !== "hard"}
            onTap={graded ? undefined : tap}
            lines={pairs}
            marks={[
              ...marks.map((p) => ({ p, color: "#ffffff" })),
              ...answer.map((p, i) => ({
                p,
                color: "#7dffa0",
                label: i ? "D" : "C",
              })),
            ]}
          />
          {!graded && (
            <div className="flex gap-2">
              <button
                className="btn btn-sm"
                disabled={marks.length === 0}
                onClick={() => setMarks([])}
              >
                다시 찍기
              </button>
              <button
                className="btn btn-primary btn-sm grow"
                disabled={marks.length < 2}
                onClick={() => {
                  const g = gradePlace(shown.points, marks[0], marks[1]);
                  setGraded(g);
                  onScore(g.score);
                }}
              >
                확인
              </button>
            </div>
          )}
        </div>
      </div>
      {graded && (
        <Explain
          points={shown.points}
          size={shown.size}
          shape={round.answer}
          reading={graded.reading}
          note={
            (graded.score >= MAX_POINTS * 0.9
              ? "거의 정확해요!"
              : graded.score > 0
                ? `조금 어긋났어요 (평균 ${graded.error.toFixed(2)}만큼). 흰 점이 내가 찍은 곳, 초록 점이 정답이에요.`
                : "많이 어긋났어요. 초록 점이 정답이에요.") +
            (isCanonical(graded.reading)
              ? ""
              : " A·B를 거꾸로 잡았네요 — 같은 모양이라 정답으로 쳐요. 컴퓨터는 C·D의 x 합이 1 이하가 되는 쪽으로 정해요.")
          }
        />
      )}
    </div>
  );
}

// 정답 풀이: 축 A·B와 C·D 좌표, 지문이 둘인 모양이면 둘 다, 별 이름
function Explain({
  points,
  size,
  shape,
  reading,
  note,
}: {
  points: Point2D[];
  size: number;
  shape: QuadShape;
  reading: Reading;
  note: string;
}) {
  const twins = equivalentFingerprints(points, AXIS_TOLERANCE);
  const [c, d]: Point2D[] = [
    [reading.hash[0], reading.hash[1]],
    [reading.hash[2], reading.hash[3]],
  ];

  return (
    <div className="bg-base-200/80 rounded-box fx-rise flex flex-col gap-3 p-4 backdrop-blur">
      <div className="font-bold">{note}</div>
      <div className="grid grid-cols-2 gap-3">
        <ShapeView
          points={points}
          size={size}
          mags={shape.mags}
          roles={rolesOf(reading)}
        />
        <FingerprintBoard
          grid
          marks={[
            { p: c, color: "#a5b4fc", label: "C" },
            { p: d, color: "#a5b4fc", label: "D" },
          ]}
        />
      </div>
      <div className="text-sm">
        가장 먼 두 별 <b className="text-amber-200">A·B</b>를 (0,0)·(1,1)에
        놓으면 <b className="text-indigo-300">C</b>는 {formatPoint(c)},{" "}
        <b className="text-indigo-300">D</b>는 {formatPoint(d)}. 지문은 (
        {reading.hash.map((v) => v.toFixed(2)).join(", ")})예요.
      </div>
      {twins.length > 1 && (
        <div className="rounded-box bg-amber-300/10 p-2 text-sm text-amber-100">
          이 모양은 가장 먼 쌍이 거의 같은 길이라 축을 두 가지로 잡을 수 있어요.
          그래서 지문도{" "}
          {twins
            .map((t) => `(${t.map((v) => v.toFixed(2)).join(", ")})`)
            .join(", ")}{" "}
          {twins.length}개 — 모두 정답이에요. 별 위치가 조금만 달라져도 컴퓨터가
          고르는 축이 바뀌어요.
        </div>
      )}
      <div className="text-xs opacity-70">별: {starNames(shape)}</div>
    </div>
  );
}
