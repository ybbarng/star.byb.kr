"use client";

import type { FindScene } from "@/game/findConstellation/scene";
import type { SkyItem } from "@/game/sky/drawSky";
import type { Difficulty } from "@/game/sky/scene";
import { useEffect, useMemo, useRef, useState } from "react";
import { isHit, makeFindScene } from "@/game/findConstellation/scene";
import { FIND_TARGETS } from "@/game/findConstellation/targets";
import { pickItem, STARS } from "@/game/sky/catalog";
import { drawSky } from "@/game/sky/drawSky";
import ItemInfo, { canvasPoint } from "@/game/sky/ItemInfo";
import { dailySeed } from "@/game/sky/scene";
import { projectVecToPhoto } from "@/search/utils/wcs";
import { createRng } from "@/utils/rng";

// 별자리 숨은그림찾기 (docs/game-plans.md): 밤하늘에서 제시한 별자리를 찾아 누른다.
// 찾으면 별자리선이 그려지고 짧은 이야기가 나온다. 빨리 찾을수록 점수가 높다.

const ROUNDS = 5;
const MAX_MISSES = 3;
const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "쉬움 (모양 카드 그대로)",
  normal: "보통 (모양 카드가 돌아가 있음)",
  hard: "어려움 (이름만)",
};

type Status = "playing" | "found" | "revealed";

export default function FindGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  // 첫 판은 날짜로 정한다 (서버에서 미리 그린 화면과 브라우저 화면이 같아야 한다)
  const [gameSeed, setGameSeed] = useState(() => dailySeed());
  const [round, setRound] = useState(0);
  const [status, setStatus] = useState<Status>("playing");
  const [misses, setMisses] = useState<{ x: number; y: number }[]>([]);
  const [points, setPoints] = useState<number[]>([]);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [info, setInfo] = useState<{
    item: SkyItem | null;
    fx: number;
    fy: number;
  } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const items = useRef<SkyItem[]>([]);

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
  const finished = round >= ROUNDS;

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
      constellations: status === "playing" ? undefined : scene.target,
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
  }, [scene, status, misses]);

  const next = () => {
    setRound((r) => r + 1);
    setStatus("playing");
    setMisses([]);
    setInfo(null);
    setStartedAt(Date.now());
  };

  const restart = () => {
    setGameSeed(Math.floor(Math.random() * 1e9));
    setRound(0);
    setPoints([]);
    setStatus("playing");
    setMisses([]);
    setInfo(null);
    setStartedAt(Date.now());
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
      setPoints((ps) => [
        ...ps,
        Math.max(100, Math.round(1000 - seconds * 25 - misses.length * 150)),
      ]);
      setStatus("found");

      return;
    }

    const nextMisses = [...misses, { x: p.x, y: p.y }];
    setMisses(nextMisses);

    if (nextMisses.length >= MAX_MISSES) {
      setPoints((ps) => [...ps, 0]);
      setStatus("revealed");
    }
  };

  const total = points.reduce((a, b) => a + b, 0);

  if (finished) {
    return (
      <div className="bg-base-200 rounded-box flex w-full max-w-[1280px] flex-col items-center gap-4 p-8">
        <h1 className="text-2xl font-bold">별자리 {ROUNDS}개를 다 봤어요!</h1>
        <div className="text-4xl font-bold">{total}점</div>
        <div className="text-sm opacity-70">
          {points.map((p, i) => `${order[i].label} ${p}`).join(" · ")}
        </div>
        <button className="btn btn-primary" onClick={restart}>
          다시 하기
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-[1280px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">별자리 숨은그림찾기</h1>
        <span className="text-sm opacity-70">
          {round + 1}/{ROUNDS} · {total}점
        </span>
        <div className="grow" />
        <select
          className="select select-sm w-auto"
          value={difficulty}
          onChange={(e) => {
            setDifficulty(e.target.value as Difficulty);
            restart();
          }}
        >
          {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABEL[d]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="bg-base-200 rounded-box flex w-full shrink-0 flex-col gap-3 p-4 md:w-64">
          <div className="text-sm opacity-70">찾아보세요</div>
          <div className="text-2xl font-bold">{target.label}</div>
          {scene && difficulty !== "hard" && (
            <ShapeCard
              scene={scene}
              rotate={
                difficulty === "normal" ? (gameSeed % 360) + round * 77 : 0
              }
            />
          )}
          <div className="text-xs opacity-60">
            사진에서 이 별자리가 있는 곳을 누르세요. 틀린 기회{" "}
            {MAX_MISSES - misses.length}번 남음.
          </div>
          {status !== "playing" && (
            <div className="flex flex-col gap-2">
              <div
                className={
                  status === "found" ? "text-success font-bold" : "font-bold"
                }
              >
                {status === "found"
                  ? `찾았어요! +${points[points.length - 1]}점`
                  : "여기 있었어요"}
              </div>
              <div className="text-sm">
                <b>{target.season}</b> · {target.story}
              </div>
              <div className="text-xs opacity-60">
                이제 별을 누르면 이름을 알려 줘요.
              </div>
              <button className="btn btn-primary btn-sm" onClick={next}>
                {round + 1 < ROUNDS ? "다음 별자리" : "결과 보기"}
              </button>
            </div>
          )}
        </div>
        <div className="relative grow">
          {scene ? (
            <canvas
              ref={canvas}
              width={scene.width}
              height={scene.height}
              className="rounded-box w-full cursor-crosshair bg-black"
              onClick={handleClick}
            />
          ) : (
            <div className="rounded-box bg-base-200 p-8">
              이 별자리가 잘 보이는 하늘을 만들지 못했어요.{" "}
              <button className="btn btn-sm" onClick={next}>
                건너뛰기
              </button>
            </div>
          )}
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
