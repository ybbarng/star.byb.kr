"use client";

import type { FindScene } from "@/game/findConstellation/scene";
import type { SkyItem } from "@/game/sky/drawSky";
import type { Difficulty } from "@/game/sky/scene";
import { useEffect, useMemo, useRef, useState } from "react";
import { isHit, makeFindScene } from "@/game/findConstellation/scene";
import { FIND_TARGETS } from "@/game/findConstellation/targets";
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
import LineReveal from "@/game/fx/LineReveal";
import { sfx } from "@/game/fx/sound";
import { pickItem, projectLines, STARS } from "@/game/sky/catalog";
import { drawSky } from "@/game/sky/drawSky";
import ItemInfo, { canvasPoint } from "@/game/sky/ItemInfo";
import { projectVecToPhoto } from "@/search/utils/wcs";
import { cn } from "@/utils/cn";
import { createRng } from "@/utils/rng";

// 별자리 숨은그림찾기 (docs/game-plans.md): 밤하늘에서 제시한 별자리를 찾아 누른다.
// 찾으면 별자리선이 이어지며 그려지고 짧은 이야기가 나온다. 빨리 찾을수록, 연달아 한 번에 찾을수록 점수가 높다.

const ROUNDS = 5;
const MAX_MISSES = 3;
const BASE_POINTS = 1000;
const POINTS_PER_SECOND = 25;
const MISS_PENALTY = 150;
const MIN_POINTS = 100;
// 한 번에 연달아 찾으면 판마다 25%씩 더
const COMBO_BONUS = 0.25;
// 라운드 배너가 떠 있는 동안은 시간을 재지 않는다
const BANNER_MS = 1200;

const DIFFICULTIES: { value: Difficulty; title: string; note: string }[] = [
  { value: "easy", title: "쉬움", note: "모양 카드 그대로" },
  { value: "normal", title: "보통", note: "모양 카드가 돌아가 있어요" },
  { value: "hard", title: "어려움", note: "이름만 보고 찾아요" },
];

type Phase = "intro" | "play" | "over";
type Status = "playing" | "found" | "revealed";
// 한 판의 결과: clean은 한 번도 안 틀리고 찾았는지 (콤보)
interface RoundResult {
  points: number;
  found: boolean;
  clean: boolean;
}

const pointsFor = (seconds: number, misses: number) =>
  Math.max(
    MIN_POINTS,
    Math.round(
      BASE_POINTS -
        Math.max(0, seconds) * POINTS_PER_SECOND -
        misses * MISS_PENALTY,
    ),
  );

export default function FindGame() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [gameSeed, setGameSeed] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [newBest, setNewBest] = useState(false);
  const total = results.reduce((a, r) => a + r.points, 0);

  if (phase === "intro") {
    return (
      <GameIntro
        title="별자리 숨은그림찾기"
        tagline="밤하늘 어딘가에 숨은 별자리를 찾아라!"
        howTo={[
          `별자리 ${ROUNDS}개가 차례로 나와요. 사진에서 그 별자리가 있는 곳을 누르세요.`,
          "빨리 찾을수록 점수가 높아요. 한 번에 연달아 찾으면 콤보 보너스!",
          `한 문제에 틀릴 수 있는 기회는 ${MAX_MISSES}번이에요.`,
        ]}
        onStart={() => {
          // 시작할 때마다 새 문제 (시작 화면을 거친 뒤라 서버·브라우저 화면이 어긋나지 않는다)
          setGameSeed(Math.floor(Math.random() * 1e9));
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
    const best = readBest(`find-${difficulty}`);
    const stars = total >= 3800 ? 3 : total >= 2500 ? 2 : total > 0 ? 1 : 0;

    return (
      <ResultCard
        title={`별자리 ${ROUNDS}개 탐험 끝!`}
        score={total}
        stars={stars}
        best={best}
        newBest={newBest}
        actions={
          <>
            <button
              className="btn btn-primary"
              onClick={() => {
                setGameSeed(Math.floor(Math.random() * 1e9));
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
        <div className="text-sm opacity-80">
          찾은 별자리 {results.filter((r) => r.found).length}/{ROUNDS}
        </div>
      </ResultCard>
    );
  }

  return (
    <FindPlay
      difficulty={difficulty}
      gameSeed={gameSeed}
      results={results}
      onResult={(r) => setResults((rs) => [...rs, r])}
      onFinish={(finalTotal) => {
        setNewBest(saveBest(`find-${difficulty}`, finalTotal));
        setPhase("over");
      }}
    />
  );
}

function FindPlay({
  difficulty,
  gameSeed,
  results,
  onResult,
  onFinish,
}: {
  difficulty: Difficulty;
  gameSeed: number;
  results: RoundResult[];
  onResult: (r: RoundResult) => void;
  onFinish: (total: number) => void;
}) {
  const [round, setRound] = useState(0);
  const [status, setStatus] = useState<Status>("playing");
  const [misses, setMisses] = useState<{ x: number; y: number }[]>([]);
  const [startedAt, setStartedAt] = useState(() => Date.now() + BANNER_MS);
  const [now, setNow] = useState(() => Date.now());
  const [info, setInfo] = useState<{
    item: SkyItem | null;
    fx: number;
    fy: number;
  } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const items = useRef<SkyItem[]>([]);
  const fx = useFx();
  const shake = useShake();

  // 이번 판에 낼 별자리 순서
  const order = useMemo(() => {
    const rng = createRng(gameSeed);

    return [...FIND_TARGETS]
      .map((t) => ({ t, k: rng() }))
      .sort((a, b) => a.k - b.k)
      .map(({ t }) => t);
  }, [gameSeed]);
  const target = order[round % order.length];
  const scene = useMemo(
    () => makeFindScene(target.label, gameSeed + round, difficulty),
    [target, gameSeed, round, difficulty],
  );
  const lines = useMemo(
    () => (scene ? projectLines(scene.TP, scene.target) : []),
    [scene],
  );
  const total = results.reduce((a, r) => a + r.points, 0);
  // 지금까지 한 번에 연달아 찾은 판 수
  let combo = 0;

  for (let i = results.length - 1; i >= 0 && results[i].clean; i--) {
    combo++;
  }

  // 남은 점수가 줄어드는 게 보이게 (0.1초마다)
  useEffect(() => {
    if (status !== "playing") {
      return;
    }

    const t = setInterval(() => setNow(Date.now()), 100);

    return () => clearInterval(t);
  }, [status]);

  const live = pointsFor((now - startedAt) / 1000, misses.length);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");

    if (!ctx || !scene) {
      return;
    }

    items.current = drawSky(ctx, {
      width: scene.width,
      height: scene.height,
      TP: scene.TP,
      date: scene.date,
      observer: scene.observer,
      azimuthDeg: scene.view.azimuthDeg,
      magLimit: scene.magLimit,
      lightPollution: scene.lightPollution,
      groundSeed: scene.seed,
      stars: STARS,
      compass: true,
    });

    // 틀린 자리 표시
    ctx.strokeStyle = "rgba(255,90,90,0.9)";
    ctx.lineWidth = 3;

    for (const m of misses) {
      ctx.beginPath();
      ctx.moveTo(m.x - 10, m.y - 10);
      ctx.lineTo(m.x + 10, m.y + 10);
      ctx.moveTo(m.x + 10, m.y - 10);
      ctx.lineTo(m.x - 10, m.y + 10);
      ctx.stroke();
    }
  }, [scene, misses]);

  const next = () => {
    sfx.tap();

    if (round + 1 >= ROUNDS) {
      onFinish(total);

      return;
    }

    setRound((r) => r + 1);
    setStatus("playing");
    setMisses([]);
    setInfo(null);
    setStartedAt(Date.now() + BANNER_MS);
    setNow(Date.now());
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!scene) {
      return;
    }

    const p = canvasPoint(e);

    if (status !== "playing") {
      setInfo({ item: pickItem(items.current, p.x, p.y), fx: p.fx, fy: p.fy });

      return;
    }

    if (isHit(scene, p.x, p.y)) {
      const seconds = (Date.now() - startedAt) / 1000;
      const clean = misses.length === 0;
      const nextCombo = clean ? combo + 1 : 0;
      const bonus = nextCombo >= 2 ? 1 + COMBO_BONUS * (nextCombo - 1) : 1;
      const points = Math.round(pointsFor(seconds, misses.length) * bonus);
      onResult({ points, found: true, clean });
      setStatus("found");
      sfx.hit();
      fx.burst(p.fx, p.fy, "#ffe27a", 22);
      fx.ring(p.fx, p.fy, "#ffe27a");
      fx.popup(p.fx, p.fy, `+${points}`);

      if (nextCombo >= 2) {
        setTimeout(
          () =>
            fx.popup(0.5, 0.35, `${nextCombo}연속! ×${bonus}`, "#ff9de2", 44),
          250,
        );
      }

      return;
    }

    const nextMisses = [...misses, { x: p.x, y: p.y }];
    setMisses(nextMisses);
    shake.shake();
    fx.ring(p.fx, p.fy, "#ff6b6b");

    if (nextMisses.length >= MAX_MISSES) {
      onResult({ points: 0, found: false, clean: false });
      setStatus("revealed");
      sfx.lose();
      fx.popup(0.5, 0.4, "여기 있었어요!", "#ffb4b4", 36);
    } else {
      sfx.miss();
      fx.popup(p.fx, p.fy, "✕", "#ff6b6b", 34);
    }
  };

  return (
    <div className="flex w-full max-w-[1280px] flex-col gap-3">
      {/* 상단 표시: 판 진행, 점수, 콤보, 남은 기회 */}
      <div className="bg-base-200/80 rounded-box flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: ROUNDS }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-3 w-3 rounded-full transition",
                i < results.length
                  ? results[i].points > 0
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
          <CountUp value={total} duration={700} />
          <span className="ml-1 text-sm font-normal opacity-70">점</span>
        </div>
        {combo >= 2 && (
          <div key={combo} className="fx-pop badge badge-secondary font-bold">
            {combo}연속!
          </div>
        )}
        <div className="grow" />
        <div className="flex gap-1 text-xl" aria-label="남은 기회">
          {Array.from({ length: MAX_MISSES }, (_, i) => (
            <span
              key={i}
              className={cn(
                "transition",
                i < MAX_MISSES - misses.length
                  ? "text-red-400"
                  : "scale-75 opacity-20",
              )}
            >
              ♥
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <div
          className={cn(
            "bg-base-200/80 rounded-box flex w-full shrink-0 flex-col gap-3 p-4 backdrop-blur md:w-64 md:self-start",
            status === "found" && "fx-glow",
          )}
        >
          <div className="text-sm opacity-70">
            {round + 1}번째 별자리를 찾아보세요
          </div>
          <div key={round} className="fx-pop text-2xl font-bold">
            {target.label}
          </div>
          {scene && difficulty !== "hard" && (
            <ShapeCard
              scene={scene}
              rotate={
                difficulty === "normal" ? (gameSeed % 360) + round * 77 : 0
              }
            />
          )}
          {status === "playing" ? (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs opacity-70">
                <span>지금 찾으면</span>
                <span className="tabular-nums">{live}점</span>
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
                value={live}
                max={BASE_POINTS}
              />
            </div>
          ) : (
            <div className="fx-rise flex flex-col gap-2">
              <div
                className={cn(
                  "text-lg font-bold",
                  status === "found" ? "text-success" : "text-red-300",
                )}
              >
                {status === "found"
                  ? `찾았어요! +${results[results.length - 1]?.points ?? 0}점`
                  : "아쉬워요, 여기 있었어요"}
              </div>
              <div className="text-sm">
                <b>{target.season}</b> · {target.story}
              </div>
              <div className="text-xs opacity-60">
                이제 별을 누르면 이름을 알려 줘요.
              </div>
              <button className="btn btn-primary" onClick={next}>
                {round + 1 < ROUNDS ? "다음 별자리 →" : "결과 보기 ★"}
              </button>
            </div>
          )}
        </div>
        <div ref={shake.ref} className="relative grow">
          {scene ? (
            <>
              <canvas
                ref={canvas}
                width={scene.width}
                height={scene.height}
                className="rounded-box block w-full cursor-crosshair bg-black"
                onClick={handleClick}
              />
              {status !== "playing" && (
                <LineReveal
                  width={scene.width}
                  height={scene.height}
                  lines={lines}
                  color={
                    status === "found"
                      ? "rgba(250,210,80,0.95)"
                      : "rgba(255,170,170,0.95)"
                  }
                />
              )}
              <RoundBanner
                key={round}
                text={`${round + 1} / ${ROUNDS}`}
                sub={target.label}
              />
            </>
          ) : (
            <div className="rounded-box bg-base-200 p-8">
              이 별자리가 잘 보이는 하늘을 만들지 못했어요.{" "}
              <button className="btn btn-sm" onClick={next}>
                건너뛰기
              </button>
            </div>
          )}
          <FxLayer fx={fx} />
          {info && (
            <ItemInfo
              item={info.item}
              left={info.fx}
              top={info.fy}
              onClose={() => setInfo(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// 찾을 별자리의 모양 카드: 사진에 보이는 모양 그대로(쉬움) 또는 돌려서(보통)
function ShapeCard({ scene, rotate }: { scene: FindScene; rotate: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");

    if (!ctx) {
      return;
    }

    const W = 220;
    const H = 160;
    const t = (rotate * Math.PI) / 180;
    const parts = scene.target.map((c) =>
      c.stars
        .map((v) => projectVecToPhoto(scene.TP, v))
        .filter((p): p is [number, number] => p !== null)
        .map(([x, y]): [number, number] => [
          x * Math.cos(t) - y * Math.sin(t),
          x * Math.sin(t) + y * Math.cos(t),
        ]),
    );
    const all = parts.flat();
    const xs = all.map((p) => p[0]);
    const ys = all.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const k =
      0.8 *
      Math.min(
        W / (Math.max(...xs) - minX || 1),
        H / (Math.max(...ys) - minY || 1),
      );
    const ox = (W - (Math.max(...xs) - minX) * k) / 2;
    const oy = (H - (Math.max(...ys) - minY) * k) / 2;
    const map = ([x, y]: [number, number]): [number, number] => [
      ox + (x - minX) * k,
      oy + (y - minY) * k,
    ];

    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(250,220,80,0.9)";
    ctx.fillStyle = "white";
    ctx.lineWidth = 2;

    for (const part of parts) {
      ctx.beginPath();
      part
        .map(map)
        .forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();

      for (const p of part.map(map)) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [scene, rotate]);

  return (
    <canvas ref={ref} width={220} height={160} className="rounded-box w-full" />
  );
}
