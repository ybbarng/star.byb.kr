"use client";

import type {
  WanderDifficulty,
  WanderProblem,
} from "@/game/wanderers/wanderers";
import type { Point2D } from "@/scripts/hash/types";
import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { drawField } from "@/game/wanderers/drawWanderers";
import {
  angleDeg,
  BONUS_POINTS,
  dateLabel,
  HINT_COST,
  isHit,
  makeWanderGame,
  maxScore,
  projectField,
  ROUND_POINTS,
  ROUNDS,
  scoreRound,
  WRONG_COST,
} from "@/game/wanderers/wanderers";
import { constellationAt } from "@/search/utils/constellationBounds";
import { cn } from "@/utils/cn";

// 떠돌이별 찾기 (docs/game-plans.md "행성 찾기 + 혜성 찾기"): 며칠·몇 주 간격으로 그린 같은 하늘의 별 지도를 넘겨 보며
// 별 사이를 옮겨 다니는 점을 찾는다. 다섯 라운드, 라운드마다 1,000점(+ 보너스 300점).

const DIFFICULTIES: { value: WanderDifficulty; title: string; note: string }[] =
  [
    { value: "intro", title: "입문", note: "밝은 행성, 넓은 간격" },
    { value: "easy", title: "쉬움", note: "밝은 행성, 별이 조금 더" },
    { value: "normal", title: "보통", note: "어두운 행성, 별이 가득" },
    { value: "hard", title: "어려움", note: "역행하는 행성·역사 속 혜성" },
  ];

const bestKey = (d: WanderDifficulty) => `wanderers-${d}`;
const BLINK_MS = 650;

interface RoundResult {
  name: string;
  kind: WanderProblem["kind"];
  date: Date;
  points: number;
  found: boolean;
}

export default function WanderersGame() {
  const [phase, setPhase] = useState<"intro" | "play" | "over">("intro");
  const [difficulty, setDifficulty] = useState<WanderDifficulty>("intro");
  const [seed, setSeed] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [newBest, setNewBest] = useState(false);
  const [best, setBest] = useState<number | null>(null);
  const problems = useMemo(
    () => (phase === "intro" ? [] : makeWanderGame(seed, difficulty)),
    [phase, seed, difficulty],
  );
  const total = results.reduce((s, r) => s + r.points, 0);

  const start = () => {
    setSeed(Math.floor(Math.random() * 1e9));
    setResults([]);
    setPhase("play");
  };

  if (phase === "intro") {
    return (
      <GameIntro
        title="떠돌이별 찾기"
        tagline="별들은 서로의 자리가 늘 그대로예요. 그런데 몇몇은 밤마다 별 사이를 조금씩 옮겨 다녀요. 옛 사람들은 그걸 '떠돌이별'이라 불렀어요."
        howTo={[
          "같은 하늘을 며칠(또는 몇 주) 간격으로 그린 별 지도가 여러 장 있어요. 넘겨 보거나 '깜빡이며 넘기기'로 번갈아 봐요.",
          "다른 별은 그대로인데 혼자 자리를 바꾸는 점이 떠돌이별(행성)이에요. 찾으면 그 점을 눌러요.",
          `틀리게 누르면 −${WRONG_COST}점, 둘레 힌트는 −${HINT_COST}점. 어려움에서는 역행하는 행성과 역사 속 실제 혜성이 나오고, 보너스 문제(+${BONUS_POINTS}점)도 있어요.`,
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
    const max = maxScore(problems);
    const stars =
      total >= max * 0.75 ? 3 : total >= max * 0.45 ? 2 : total > 0 ? 1 : 0;

    return (
      <ResultCard
        title="떠돌이별 찾기 끝!"
        score={total}
        stars={stars}
        best={best}
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
              {i + 1}라운드 · {r.name} · {dateLabel(r.date)} ·{" "}
              {r.found ? "찾음" : "못 찾음"} ·{" "}
              <b>{r.points.toLocaleString()}점</b>
            </div>
          ))}
        </div>
        <p className="max-w-md text-xs opacity-70">
          별은 너무 멀어서 몇백 년이 지나도 서로의 자리가 거의 그대로예요.
          행성은 해를 도는 가까운 이웃이라, 며칠만 지나도 별 사이 자리가
          바뀌어요. 그리스 사람들도 행성을 &lsquo;떠돌이(planētēs)&rsquo;라고
          불렀어요. 1930년 톰보는 이렇게 두 장의 사진을 번갈아 보는 방법(깜빡이
          비교)으로 명왕성을 찾았어요.
        </p>
      </ResultCard>
    );
  }

  const round = results.length;

  return (
    <WanderRound
      key={`${seed}-${round}`}
      problem={problems[round]}
      round={round}
      total={total}
      onDone={(r) => {
        const next = [...results, r];
        setResults(next);

        if (next.length >= ROUNDS) {
          setBest(readBest(bestKey(difficulty)));
          setNewBest(
            saveBest(
              bestKey(difficulty),
              next.reduce((s, x) => s + x.points, 0),
            ),
          );
          setPhase("over");
        }
      }}
    />
  );
}

function WanderRound({
  problem,
  round,
  total,
  onDone,
}: {
  problem: WanderProblem;
  round: number;
  total: number;
  onDone: (r: RoundResult) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fx = useFx();
  const { ref: shakeRef, shake } = useShake();
  const [frame, setFrame] = useState(0);
  const [blinking, setBlinking] = useState(false);
  const [misses, setMisses] = useState<Point2D[]>([]);
  const [usedHint, setUsedHint] = useState(false);
  const [status, setStatus] = useState<"hunt" | "bonus" | "done">("hunt");
  const [found, setFound] = useState(false);
  const [bonusChoice, setBonusChoice] = useState<number | null>(null);
  const { view, frames } = problem;
  const last = frames.length - 1;

  // 힌트: 가운데 장의 자리 둘레 (정확히 가운데가 아니게 조금 비켜서)
  const hint = useMemo(() => {
    const p = projectField(view, frames[Math.floor(frames.length / 2)].target);
    const r = view.width * 0.16;
    const a = round * 2.1 + 0.7;

    return p
      ? { x: p[0] + 0.5 * r * Math.cos(a), y: p[1] + 0.5 * r * Math.sin(a), r }
      : undefined;
  }, [view, frames, round]);

  // 깜빡이며 넘기기
  useEffect(() => {
    if (!blinking) {
      return;
    }

    const id = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
      sfx.tick();
    }, BLINK_MS);

    return () => clearInterval(id);
  }, [blinking, frames.length]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");

    if (!ctx) {
      return;
    }

    const marker =
      status === "bonus" ? projectField(view, frames[frame].target) : null;

    drawField(ctx, {
      problem,
      frameIndex: frame,
      reveal: status === "done",
      hint: marker
        ? { x: marker[0], y: marker[1], r: 18 }
        : usedHint && status === "hunt"
          ? hint
          : undefined,
      misses,
    });
  }, [problem, view, frames, frame, status, usedHint, hint, misses]);

  const points = scoreRound({
    found,
    wrongTaps: misses.length,
    usedHint,
    bonusCorrect:
      problem.bonus !== undefined && bonusChoice === problem.bonus.answer,
  });

  const finishHunt = (didFind: boolean) => {
    setBlinking(false);
    setFound(didFind);

    if (problem.bonus) {
      setFrame(problem.bonus.frameIndex);
      setStatus("bonus");
    } else {
      setStatus("done");
    }
  };

  const onTap = (e: MouseEvent<HTMLCanvasElement>) => {
    if (status !== "hunt") {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const scale = view.width / rect.width;
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;
    // 손가락으로도 누르기 쉽게: 화면에서 약 22px
    const radius = Math.max(20, 22 * scale);

    if (isHit(problem, frame, [x, y], radius)) {
      sfx.hit();
      fx.burst(x / view.width, y / view.height, "#7ee0ff", 20);
      fx.popup(x / view.width, y / view.height, "찾았다!", "#7ee0ff");
      finishHunt(true);
    } else {
      sfx.miss();
      shake();
      setMisses((m) => [...m, [x, y]]);
      fx.popup(
        x / view.width,
        y / view.height,
        `−${WRONG_COST}`,
        "#ff7a7a",
        22,
      );
    }
  };

  const go = (f: number) => {
    sfx.tap();
    setBlinking(false);
    setFrame(Math.max(0, Math.min(last, f)));
  };

  return (
    <div className="flex w-full max-w-[1200px] flex-col gap-3">
      <div className="bg-base-200/80 rounded-box flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 backdrop-blur">
        <h1 className="text-xl font-bold">떠돌이별 찾기</h1>
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
          <CountUp value={total + (status === "hunt" ? 0 : points)} />
          <span className="ml-1 text-sm font-normal opacity-70">점</span>
        </div>
        <div className="grow" />
        <div className="text-sm opacity-80">
          {problem.kind === "comet"
            ? "☄️ 역사 속 혜성"
            : problem.kind === "retro"
              ? "🔄 거꾸로 가는 행성"
              : "🪐 떠돌이별"}
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative mx-auto w-full max-w-[640px] md:w-[58%]">
          <div ref={shakeRef} className="relative">
            <canvas
              ref={canvasRef}
              width={view.width}
              height={view.height}
              onClick={onTap}
              className={cn(
                "rounded-box block aspect-square w-full bg-black",
                status === "hunt" && "cursor-crosshair",
              )}
            />
            <FxLayer fx={fx} />
            <RoundBanner
              key={round}
              text={`${round + 1} / ${ROUNDS}`}
              sub="별 사이를 떠도는 점은?"
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              className="btn btn-sm"
              disabled={frame === 0}
              onClick={() => go(frame - 1)}
              aria-label="이전 장"
            >
              ◀
            </button>
            <div className="grow text-center text-sm tabular-nums">
              <b className="text-sky-200">
                {frame + 1} / {frames.length}장
              </b>{" "}
              · {dateLabel(frames[frame].date)}
            </div>
            <button
              className="btn btn-sm"
              disabled={frame === last}
              onClick={() => go(frame + 1)}
              aria-label="다음 장"
            >
              ▶
            </button>
          </div>
          <div className="mt-1 flex justify-center gap-1">
            {frames.map((f, k) => (
              <button
                key={f.date.getTime()}
                className={cn(
                  "h-2.5 w-8 rounded-full",
                  k === frame ? "bg-sky-300" : "bg-white/20",
                )}
                aria-label={`${k + 1}장`}
                onClick={() => go(k)}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 md:w-[42%]">
          {status === "hunt" && (
            <div className="bg-base-200/80 rounded-box flex flex-col gap-3 p-4 text-sm backdrop-blur">
              <div>
                {problem.intervalDays}일 간격으로 그린 같은 하늘 {frames.length}
                장이에요. 넘겨 보며 혼자 자리를 바꾸는 점을 찾아 눌러요.
              </div>
              <button
                className={cn(
                  "btn",
                  blinking ? "btn-secondary" : "btn-primary",
                )}
                onClick={() => {
                  sfx.tap();
                  setBlinking(!blinking);
                }}
              >
                {blinking ? "❚❚ 멈추기" : "▶ 깜빡이며 넘기기"}
              </button>
              <div className="flex flex-wrap gap-2">
                <button
                  className={cn(
                    "btn btn-sm",
                    usedHint ? "btn-disabled" : "btn-outline",
                  )}
                  onClick={() => {
                    sfx.twinkle(2);
                    setUsedHint(true);
                  }}
                >
                  ◌ 이 둘레에 있어요 −{HINT_COST}
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    sfx.lose();
                    finishHunt(false);
                  }}
                >
                  모르겠어요 (정답 보기)
                </button>
              </div>
              {misses.length > 0 && (
                <div className="text-xs text-rose-300">
                  틀리게 누른 곳 {misses.length}번 (−
                  {misses.length * WRONG_COST}점)
                </div>
              )}
              <div className="text-xs opacity-60">
                {problem.kind === "comet"
                  ? "혜성은 뿌옇고 꼬리가 있어요. 날마다 별 사이를 꽤 빨리 옮겨 가요."
                  : "행성은 별처럼 보이지만 장마다 자리가 달라요. 밝은 별이라고 다 행성은 아니에요!"}
              </div>
            </div>
          )}

          {status === "bonus" && problem.bonus && (
            <div className="bg-base-200/90 rounded-box fx-rise flex flex-col gap-3 p-4 text-sm backdrop-blur">
              <div className="font-bold text-sky-200">
                {found ? "찾았어요!" : "여기 있었어요."} 노란 동그라미가{" "}
                {problem.name}이에요.
              </div>
              <div>{problem.bonus.question}</div>
              <div className="grid grid-cols-2 gap-2">
                {problem.bonus.options.map((o, i) => (
                  <button
                    key={o}
                    className="btn btn-sm h-auto min-h-10 py-2"
                    onClick={() => {
                      setBonusChoice(i);

                      if (i === problem.bonus!.answer) {
                        sfx.hit();
                      } else {
                        sfx.miss();
                      }

                      setStatus("done");
                    }}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
          )}

          {status === "done" && (
            <Explain
              problem={problem}
              found={found}
              points={points}
              wrongTaps={misses.length}
              usedHint={usedHint}
              bonusChoice={bonusChoice}
              last={round + 1 >= ROUNDS}
              onNext={() =>
                onDone({
                  name: problem.name,
                  kind: problem.kind,
                  date: frames[0].date,
                  points,
                  found,
                })
              }
            />
          )}

          <details className="bg-base-200/60 rounded-box p-3 text-xs opacity-80">
            <summary className="cursor-pointer font-bold">
              얼마나 정확한가요?
            </summary>
            <div className="mt-2 flex flex-col gap-1">
              <p>
                행성 자리는 JPL의 궤도 요소(1800~2050년용)로 케플러 운동을 풀어
                계산해요. 오차는 1′(0.02°) 안팎이에요. 밝기는 천문연감의
                근사식이라 0.1~0.3등급쯤 다를 수 있어요.
              </p>
              <p>
                혜성 자리는 NASA/JPL Horizons의 궤도 요소로 계산하고, 같은 곳의
                위치와 0.02° 안쪽으로 맞는지 확인했어요(지구에 아주 가까웠던
                햐쿠타케는 0.1°). 행성이 당기는 힘은 빼서 밝던 몇 달 동안만
                맞아요. 혜성의 밝기와 꼬리 길이는 계산하지 않고 그림으로만
                그렸어요. 꼬리 방향(해 반대쪽)은 계산한 값이에요.
              </p>
              <p>
                별은 5등급까지 그렸고, 달·은하수·지평선은 그리지 않은 별
                지도예요. 별 지도는 하늘을 올려다본 모습이라 왼쪽이 동쪽이에요.
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function Explain({
  problem,
  found,
  points,
  wrongTaps,
  usedHint,
  bonusChoice,
  last,
  onNext,
}: {
  problem: WanderProblem;
  found: boolean;
  points: number;
  wrongTaps: number;
  usedHint: boolean;
  bonusChoice: number | null;
  last: boolean;
  onNext: () => void;
}) {
  const { frames } = problem;
  const first = frames[0];
  const end = frames[frames.length - 1];
  const moved = angleDeg(first.target, end.target);
  const where = useMemo(
    () => constellationAt(frames[Math.floor(frames.length / 2)].target),
    [frames],
  );
  const days = Math.round(
    (end.date.getTime() - first.date.getTime()) / 86400000,
  );
  const bonus = problem.bonus;

  return (
    <div className="bg-base-200/90 rounded-box fx-rise flex flex-col gap-2 p-4 text-sm backdrop-blur">
      <div className="flex flex-wrap items-end gap-3">
        <div className="text-4xl font-black text-amber-200">
          +<CountUp value={points} />
        </div>
        <div className="pb-1 opacity-70">
          / {(ROUND_POINTS + (bonus ? BONUS_POINTS : 0)).toLocaleString()}
        </div>
        <div className="grow" />
        <button className="btn btn-primary" onClick={onNext}>
          {last ? "결과 보기 ★" : "다음 라운드 →"}
        </button>
      </div>
      <div className="text-xs opacity-70">
        {found
          ? `찾음 ${ROUND_POINTS}${wrongTaps ? ` − 틀림 ${wrongTaps}번` : ""}${usedHint ? ` − 힌트` : ""}`
          : "못 찾음 0점"}
        {bonus &&
          ` · 보너스 ${bonusChoice === bonus.answer ? `+${BONUS_POINTS}` : "0"}`}
      </div>
      <div className="flex flex-col gap-1.5 rounded-lg bg-black/25 p-3">
        <div>
          <b className="text-sky-200">{problem.name}</b> —{" "}
          {dateLabel(first.date)}부터 {days}일 동안 별 사이를{" "}
          <b>{moved.toFixed(1)}°</b> 옮겨 갔어요
          {where ? (
            <>
              {" "}
              (<b>{where}</b> 언저리)
            </>
          ) : null}
          . 그동안 다른 별들은 서로의 자리가 그대로예요. 파란 점선이 하루 간격
          자취, 번호가 각 장의 자리예요.
        </div>
        {problem.kind !== "comet" && (
          <div>
            밝기는 약 <b>{problem.targetMag.toFixed(1)}등급</b>
            {problem.targetMag < 0
              ? " — 가장 밝은 별보다도 밝아서 맨눈에 아주 잘 보여요."
              : problem.targetMag > 5
                ? " — 맨눈으로 겨우 보일 만큼 어두워요. 천왕성은 1781년에야 망원경으로 처음 행성으로 알아봤어요. (지도에는 가장 어두운 별만큼 그렸어요)"
                : " — 밝은 별 정도예요. 모양만으론 별과 구분이 안 돼서, 며칠 지켜봐야 알 수 있어요."}
          </div>
        )}
        {problem.kind === "retro" && problem.oppositionDate && (
          <div>
            {dateLabel(problem.oppositionDate)} 무렵이 충(해의 정반대에 와서
            밤새 보이는 때)이에요. 그 앞뒤로 {problem.name}이 잠깐 멈췄다가
            거꾸로 가고, 다시 멈췄다 앞으로 가서 고리나 S자 모양 자취가 생겨요.
            옛 사람들은 이걸 설명하려고 원 위의 원(주전원)을 만들었고,
            코페르니쿠스는 지구도 해를 돈다고 하면 간단히 설명된다는 걸
            보였어요.
          </div>
        )}
        {problem.kind === "comet" && problem.comet && (
          <>
            <div>
              <b>{problem.comet.designation}</b> · {problem.comet.story}
            </div>
            <div>
              꼬리는 햇빛과 태양풍에 밀려 늘 해의 반대쪽으로 뻗어요. 혜성이 해를
              지나 멀어질 때는 꼬리가 앞장서서 가요.
            </div>
            <div className="text-xs opacity-60">
              궤도 요소 출처: NASA/JPL Horizons (근일점{" "}
              {problem.comet.perihelionDate}, 이심률{" "}
              {problem.comet.e.toFixed(4)}, 근일점 거리{" "}
              {problem.comet.q.toFixed(3)}au)
            </div>
          </>
        )}
        {problem.kind === "planet" && (
          <div className="text-xs opacity-70">
            별은 너무 멀어 몇백 년이 지나도 서로의 자리가 거의 그대로예요.
            행성은 해를 도는 가까운 이웃이라 며칠만 지나도 자리가 바뀌어요. 옛
            사람들은 이렇게 밤마다 하늘을 비교해 떠돌이별 다섯(수성·금성·
            화성·목성·토성)을 알아봤어요.
          </div>
        )}
      </div>
      {bonus && (
        <div
          className={cn(
            "rounded-lg p-3",
            bonusChoice === bonus.answer
              ? "bg-emerald-500/15 text-emerald-100"
              : "bg-rose-500/15 text-rose-100",
          )}
        >
          <b>보너스 {bonusChoice === bonus.answer ? "정답!" : "아쉬워요"}</b> —{" "}
          {bonus.explain}
        </div>
      )}
    </div>
  );
}
