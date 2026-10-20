"use client";

import type { SkyItem } from "@/game/sky/drawSky";
import type { Difficulty } from "@/game/sky/scene";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChoiceCards,
  Confetti,
  FxLayer,
  GameIntro,
  readBest,
  saveBest,
  StarRating,
  useFx,
} from "@/game/fx/Fx";
import LineReveal from "@/game/fx/LineReveal";
import { sfx } from "@/game/fx/sound";
import {
  CONSTELLATIONS,
  pickItem,
  projectLines,
  STARS,
} from "@/game/sky/catalog";
import { drawSky } from "@/game/sky/drawSky";
import ItemInfo, { canvasPoint } from "@/game/sky/ItemInfo";
import { dailySeed, localMeanTime, makeSkyScene } from "@/game/sky/scene";
import {
  answerDials,
  dialDate,
  matchedFlags,
  SOLVED_RATIO,
  targetStars,
} from "@/game/skyMatch/match";
import { horizonCameraTP } from "@/search/horizonSolve";
import { estimateShotTimes } from "@/search/shotTimeEstimate";
import { julianDay, localSiderealDeg } from "@/search/utils/ephemeris";
import { cn } from "@/utils/cn";

// 하늘 맞추기 퍼즐 (docs/game-plans.md 1): 정답 사진의 밝은 별 자리(유령 고리)에 내 하늘을 겹친다.
// 위도를 돌리면 하늘이 기울고, 시각·날짜를 돌리면 하늘이 돈다. 지식이 없어도 만지작거리다 보면 맞고,
// 그 과정에서 하늘의 움직임을 몸으로 익힌다. 같은 하늘이면 어느 날짜·시각 조합이든 정답이다.

const DIFFICULTIES: { value: Difficulty; title: string; note: string }[] = [
  { value: "easy", title: "쉬움", note: "방위 표시, 별이 많아요" },
  { value: "normal", title: "보통", note: "방위 없이" },
  { value: "hard", title: "어려움", note: "도시 불빛, 별이 적어요" },
];

// 다이얼을 적게 잡을수록 별이 많다
const starsFor = (moves: number) => (moves <= 8 ? 3 : moves <= 16 ? 2 : 1);

const pad = (n: number) => String(n).padStart(2, "0");
const MONTH_STARTS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

const dayLabel = (day: number) => {
  const m = MONTH_STARTS.findLastIndex((s) => s <= day);

  return `${m + 1}월 ${day - MONTH_STARTS[m] + 1}일`;
};

const latLabel = (lat: number) =>
  lat === 0 ? "적도" : `${lat > 0 ? "북위" : "남위"} ${Math.abs(lat)}°`;

// 처음 다이얼: 오늘 날짜 밤 9시, 북위 37° (서울쯤)
const startDials = () => {
  const now = new Date();
  const day = Math.floor(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(now.getFullYear(), 0, 1)) /
      86400000,
  );

  return { latDeg: 37, dayOfYear: day, minutes: 21 * 60 };
};

export default function SkyMatchGame() {
  const [started, setStarted] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");

  if (!started) {
    return (
      <GameIntro
        title="하늘 맞추기"
        tagline="다이얼을 돌려 사진 속 하늘을 똑같이 만들어라!"
        howTo={[
          "파란 고리는 정답 사진에서 별이 있던 자리예요.",
          "위도·날짜·시각 다이얼을 돌려 내 하늘의 별을 고리 안에 넣으세요. 위도는 하늘을 기울이고, 시각은 하늘을 돌려요.",
          `고리 ${Math.round(SOLVED_RATIO * 100)}%가 초록이 되면 성공! 다이얼을 적게 움직일수록 별을 많이 받아요.`,
        ]}
        onStart={() => setStarted(true)}
      >
        <ChoiceCards
          options={DIFFICULTIES}
          value={difficulty}
          onChange={setDifficulty}
        />
      </GameIntro>
    );
  }

  return <SkyMatchPlay difficulty={difficulty} />;
}

function SkyMatchPlay({ difficulty }: { difficulty: Difficulty }) {
  const [seed, setSeed] = useState(() => dailySeed());
  const [dials, setDials] = useState(startDials);
  const [hint, setHint] = useState(false);
  const [moves, setMoves] = useState(0);
  const [info, setInfo] = useState<{
    item: SkyItem | null;
    fx: number;
    fy: number;
  } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const items = useRef<SkyItem[]>([]);
  const fx = useFx();
  const [fire, setFire] = useState(0);
  const [result, setResult] = useState<{
    newBest: boolean;
    best: number | null;
  } | null>(null);
  const prevFlags = useRef<boolean[]>([]);

  const scene = useMemo(
    () => makeSkyScene(seed, difficulty),
    [seed, difficulty],
  );
  const targets = useMemo(() => targetStars(scene, STARS), [scene]);
  // 다이얼로 정한 내 하늘 (같은 카메라 방향, 내 위도·날짜·시각)
  const player = useMemo(() => {
    const date = dialDate(scene, dials.dayOfYear, dials.minutes);
    const observer = { latDeg: dials.latDeg, lonDeg: scene.observer.lonDeg };

    return {
      date,
      observer,
      TP: horizonCameraTP(
        date,
        observer,
        scene.view,
        scene.width,
        scene.height,
      ),
    };
  }, [scene, dials]);
  const flags = useMemo(
    () => matchedFlags(targets, player.TP, scene),
    [targets, player, scene],
  );
  const ratio = flags.filter(Boolean).length / Math.max(1, flags.length);
  const solved = ratio >= SOLVED_RATIO;
  // 다 맞춘 하늘에 이어 그릴 별자리선 (사진 안에 걸친 것만)
  const solvedLines = useMemo(
    () =>
      solved
        ? projectLines(player.TP, CONSTELLATIONS).filter((l) =>
            l.some(
              ([x, y]) => x > 0 && x < scene.width && y > 0 && y < scene.height,
            ),
          )
        : [],
    [solved, player, scene],
  );

  // 새로 고리에 들어간 별: 초록 고리가 퍼지고, 맞은 수가 늘수록 높은 음
  useEffect(() => {
    const fresh = flags.flatMap((f, i) =>
      f && !prevFlags.current[i] && prevFlags.current.length ? [i] : [],
    );
    prevFlags.current = flags;

    if (fresh.length === 0) {
      return;
    }

    for (const i of fresh) {
      fx.ring(
        targets[i].at[0] / scene.width,
        targets[i].at[1] / scene.height,
        "#5ae678",
      );
    }

    sfx.twinkle(flags.filter(Boolean).length);
  }, [flags, targets, scene, fx]);

  // 다 맞췄을 때 한 번: 팡파르, 색종이, 최고 기록
  useEffect(() => {
    if (!solved || result) {
      return;
    }

    const key = `sky-match-${difficulty}`;
    const best = readBest(key);
    setResult({ newBest: saveBest(key, moves, true), best });
    setFire(Date.now());
    sfx.win();
    fx.popup(0.5, 0.45, "맞췄어요!", "#7dffa0", 56);
  }, [solved, result, difficulty, moves, fx]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");

    if (!ctx) {
      return;
    }

    items.current = drawSky(ctx, {
      width: scene.width,
      height: scene.height,
      TP: player.TP,
      date: player.date,
      observer: player.observer,
      azimuthDeg: scene.view.azimuthDeg,
      magLimit: scene.magLimit,
      lightPollution: scene.lightPollution,
      groundSeed: scene.seed,
      stars: STARS,
      constellations: hint && !solved ? CONSTELLATIONS : undefined,
      compass: scene.difficulty === "easy" || solved,
    });

    // 정답 사진의 별 자리: 맞으면 초록, 아직이면 하늘색 고리
    targets.forEach((t, i) => {
      const r = 7 + Math.max(0, 3.5 - t.mag) * 2;
      ctx.beginPath();
      ctx.arc(t.at[0], t.at[1], r, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = flags[i]
        ? "rgba(90,230,120,0.9)"
        : "rgba(120,200,255,0.7)";
      ctx.stroke();
    });
  }, [scene, player, hint, solved, targets, flags]);

  const newRound = (next: number) => {
    setSeed(next);
    setDials(startDials());
    setHint(false);
    setMoves(0);
    setInfo(null);
    setResult(null);
    prevFlags.current = [];
    sfx.whoosh();
  };

  const setDial = (patch: Partial<typeof dials>) => {
    setDials((d) => ({ ...d, ...patch }));
    setInfo(null);
  };

  // 다이얼을 한 번 잡을 때마다 한 수
  const countMove = () => setMoves((m) => m + 1);

  return (
    <div className="flex w-full max-w-[1280px] flex-col gap-4">
      <Confetti fire={fire} />
      <div className="bg-base-200/80 rounded-box flex flex-wrap items-center gap-3 px-4 py-2 backdrop-blur">
        <h1 className="text-xl font-bold">하늘 맞추기</h1>
        <span className="badge badge-ghost tabular-nums">다이얼 {moves}번</span>
        <div className="grow" />
        <button className="btn btn-sm" onClick={() => newRound(dailySeed())}>
          오늘의 문제
        </button>
        <button
          className="btn btn-sm btn-primary"
          onClick={() => newRound(Math.floor(Math.random() * 1e9))}
        >
          새 문제
        </button>
      </div>

      <div className="relative">
        <canvas
          ref={canvas}
          width={scene.width}
          height={scene.height}
          className="rounded-box block w-full cursor-help bg-black"
          onClick={(e) => {
            const p = canvasPoint(e);
            setInfo({
              item: pickItem(items.current, p.x, p.y),
              fx: p.fx,
              fy: p.fy,
            });
          }}
        />
        {solved && (
          <LineReveal
            width={scene.width}
            height={scene.height}
            lines={solvedLines}
            color="rgba(140,230,170,0.85)"
            duration={2200}
            lineWidth={1.5}
          />
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
        <div
          className={cn(
            "absolute top-3 left-3 flex items-center gap-2 rounded-full bg-black/60 px-4 py-1.5 text-sm backdrop-blur transition",
            solved && "fx-glow",
          )}
        >
          <span>일치도</span>
          <progress
            className={cn(
              "progress w-24 md:w-40",
              solved ? "progress-success" : "progress-info",
            )}
            value={ratio}
            max={1}
          />
          <span className="w-10 text-right font-bold tabular-nums">
            {Math.round(ratio * 100)}%
          </span>
        </div>
      </div>

      {!solved ? (
        <div className="bg-base-200/80 rounded-box grid grid-cols-1 gap-4 p-4 backdrop-blur md:grid-cols-3">
          <Dial
            label={`위도: ${latLabel(dials.latDeg)}`}
            note="돌리면 하늘이 기울어요"
            min={-60}
            max={70}
            step={1}
            value={dials.latDeg}
            onChange={(v) => setDial({ latDeg: v })}
            onGrab={countMove}
          />
          <Dial
            label={`날짜: ${dayLabel(dials.dayOfYear)}`}
            note="하루에 하늘이 4분씩 일찍 와요"
            min={0}
            max={364}
            step={1}
            value={dials.dayOfYear}
            onChange={(v) => setDial({ dayOfYear: v })}
            onGrab={countMove}
          />
          <Dial
            label={`현지 시각: ${pad(Math.floor(dials.minutes / 60))}:${pad(dials.minutes % 60)}`}
            note="돌리면 하늘이 돌아요"
            min={0}
            max={1435}
            step={5}
            value={dials.minutes}
            onChange={(v) => setDial({ minutes: v })}
            onGrab={countMove}
          />
          <div className="flex items-center gap-2 md:col-span-3">
            <button className="btn btn-sm" onClick={() => setHint((h) => !h)}>
              {hint ? "별자리선 끄기" : "힌트: 별자리선 보기"}
            </button>
            <span className="text-xs opacity-60">
              고리 {targets.length}개 중 {flags.filter(Boolean).length}개 맞음 ·{" "}
              {Math.round(SOLVED_RATIO * 100)}% 넘으면 성공
            </span>
          </div>
        </div>
      ) : (
        <Solved
          scene={scene}
          dials={dials}
          moves={moves}
          result={result}
          onNext={() => newRound(Math.floor(Math.random() * 1e9))}
        />
      )}
    </div>
  );
}

function Dial({
  label,
  note,
  min,
  max,
  step,
  value,
  onChange,
  onGrab,
}: {
  label: string;
  note: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  onGrab: () => void;
}) {
  const nudge = (d: number) => {
    onGrab();
    sfx.tick();
    onChange(Math.min(max, Math.max(min, value + d)));
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="flex gap-1">
          <button className="btn btn-xs" onClick={() => nudge(-step)}>
            −
          </button>
          <button className="btn btn-xs" onClick={() => nudge(step)}>
            +
          </button>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        className="range range-sm range-primary w-full"
        onPointerDown={onGrab}
        onKeyDown={onGrab}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="text-xs opacity-60">{note}</span>
    </div>
  );
}

function Solved({
  scene,
  dials,
  moves,
  result,
  onNext,
}: {
  scene: ReturnType<typeof makeSkyScene>;
  dials: { latDeg: number; dayOfYear: number; minutes: number };
  moves: number;
  result: { newBest: boolean; best: number | null } | null;
  onNext: () => void;
}) {
  const answer = answerDials(scene);
  const lat = scene.observer.latDeg;
  const lon = scene.observer.lonDeg;
  const lst = localSiderealDeg(julianDay(scene.date), scene.observer);
  const truthLocal = localMeanTime(scene.date, lon);
  const year = truthLocal.getUTCFullYear();
  const fmt = (d: Date) =>
    `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;

  // 같은 하늘이 되는 다른 날짜들 (매달 1일, 밤인 것만)
  const sameSky = useMemo(
    () =>
      estimateShotTimes(
        { latDeg: lat, lstDeg: lst },
        {
          lonDeg: lon,
          from: new Date(Date.UTC(year, 0, 1) - (lon / 15) * 3600000),
          days: 365,
        },
      )
        .map((c) => localMeanTime(c.date, lon))
        .filter((d) => d.getUTCDate() === 1),
    [lat, lst, lon, year],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-base-200/80 rounded-box fx-rise flex flex-wrap items-center gap-6 p-4 backdrop-blur">
        <StarRating stars={starsFor(moves)} />
        <div className="flex flex-col">
          <div className="text-success text-2xl font-bold">맞췄어요!</div>
          <div className="text-sm">
            다이얼 {moves}번 만에
            {result?.newBest ? (
              <span className="badge badge-warning fx-pop ml-2 font-bold">
                최소 기록!
              </span>
            ) : (
              result?.best != null && (
                <span className="ml-2 opacity-60">
                  (최소 기록 {result.best}번)
                </span>
              )
            )}
          </div>
        </div>
        <div className="text-sm">
          내 답 {latLabel(dials.latDeg)}, {dayLabel(dials.dayOfYear)}{" "}
          {pad(Math.floor(dials.minutes / 60))}:{pad(dials.minutes % 60)}
        </div>
        <div className="text-sm opacity-80">
          실제로 찍은 곳·때: {latLabel(Math.round(answer.latDeg))},{" "}
          {fmt(truthLocal)}
        </div>
        <div className="grow" />
        <button className="btn btn-primary btn-lg" onClick={onNext}>
          다음 문제 →
        </button>
      </div>
      <div
        className="bg-base-200/80 rounded-box fx-rise flex flex-col gap-2 p-4 text-sm backdrop-blur"
        style={{ animationDelay: "200ms" }}
      >
        <div className="font-bold">알고 보면</div>
        <div>
          <b>위도</b>: 천구의{" "}
          {lat >= 0 ? "북극(북극성 근처)" : "남극(남십자 아래)"}은 지평선에서
          위도만큼 높이 떠 있어요. 위도 다이얼을 돌리면 하늘이 기울던 게 그
          때문이에요.
        </div>
        <div>
          <b>날짜와 시각</b>: 같은 하늘은 하루 4분, 한 달 2시간씩 일찍 와요.
          그래서 이 하늘은 {sameSky.slice(0, 6).map(fmt).join(", ")}
          {sameSky.length > 6 && " …"}에도 똑같이 보여요. 내가 고른 날짜가
          실제와 달라도 정답인 이유예요.
        </div>
      </div>
    </div>
  );
}
