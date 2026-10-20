"use client";

import type { SkyItem } from "@/game/sky/drawSky";
import type { Difficulty } from "@/game/sky/scene";
import { useEffect, useMemo, useRef, useState } from "react";
import { CONSTELLATIONS, pickItem, STARS } from "@/game/sky/catalog";
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

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "쉬움 (방위 표시, 별 많음)",
  normal: "보통",
  hard: "어려움 (광해, 별 적음)",
};

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
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
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
      constellations: hint || solved ? CONSTELLATIONS : undefined,
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
  };

  const setDial = (patch: Partial<typeof dials>) => {
    setDials((d) => ({ ...d, ...patch }));
    setMoves((m) => m + 1);
    setInfo(null);
  };

  return (
    <div className="flex w-full max-w-[1280px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">하늘 맞추기</h1>
        <span className="text-sm opacity-70">
          다이얼을 돌려 내 하늘의 별을 고리 안에 넣어 보세요. 별을 누르면
          무엇인지 알려 줘요.
        </span>
        <div className="grow" />
        <select
          className="select select-sm w-auto"
          value={difficulty}
          onChange={(e) => {
            setDifficulty(e.target.value as Difficulty);
            newRound(seed);
          }}
        >
          {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABEL[d]}
            </option>
          ))}
        </select>
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
          className="rounded-box w-full cursor-help bg-black"
          onClick={(e) => {
            const p = canvasPoint(e);
            setInfo({
              item: pickItem(items.current, p.x, p.y),
              fx: p.fx,
              fy: p.fy,
            });
          }}
        />
        {info && (
          <ItemInfo
            item={info.item}
            left={info.fx}
            top={info.fy}
            onClose={() => setInfo(null)}
          />
        )}
        <div className="absolute top-3 left-3 flex items-center gap-2 rounded bg-black/50 px-3 py-1 text-sm">
          <span>일치도</span>
          <progress
            className={cn(
              "progress w-32",
              solved ? "progress-success" : "progress-info",
            )}
            value={ratio}
            max={1}
          />
          <span>{Math.round(ratio * 100)}%</span>
        </div>
      </div>

      {!solved ? (
        <div className="bg-base-200 rounded-box grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
          <Dial
            label={`위도: ${latLabel(dials.latDeg)}`}
            note="돌리면 하늘이 기울어요"
            min={-60}
            max={70}
            step={1}
            value={dials.latDeg}
            onChange={(v) => setDial({ latDeg: v })}
          />
          <Dial
            label={`날짜: ${dayLabel(dials.dayOfYear)}`}
            note="하루에 하늘이 4분씩 일찍 와요"
            min={0}
            max={364}
            step={1}
            value={dials.dayOfYear}
            onChange={(v) => setDial({ dayOfYear: v })}
          />
          <Dial
            label={`현지 시각: ${pad(Math.floor(dials.minutes / 60))}:${pad(dials.minutes % 60)}`}
            note="돌리면 하늘이 돌아요"
            min={0}
            max={1435}
            step={5}
            value={dials.minutes}
            onChange={(v) => setDial({ minutes: v })}
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
}: {
  label: string;
  note: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const nudge = (d: number) =>
    onChange(Math.min(max, Math.max(min, value + d)));

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
        className="range range-sm w-full"
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
  onNext,
}: {
  scene: ReturnType<typeof makeSkyScene>;
  dials: { latDeg: number; dayOfYear: number; minutes: number };
  moves: number;
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
      <div className="bg-base-200 rounded-box flex flex-wrap items-center gap-6 p-4">
        <div className="text-success text-2xl font-bold">맞췄어요!</div>
        <div className="text-sm">
          다이얼 {moves}번 만에 · 내 답 {latLabel(dials.latDeg)},{" "}
          {dayLabel(dials.dayOfYear)} {pad(Math.floor(dials.minutes / 60))}:
          {pad(dials.minutes % 60)}
        </div>
        <div className="text-sm opacity-80">
          실제로 찍은 곳·때: {latLabel(Math.round(answer.latDeg))},{" "}
          {fmt(truthLocal)}
        </div>
        <div className="grow" />
        <button className="btn btn-primary" onClick={onNext}>
          다음 문제
        </button>
      </div>
      <div className="bg-base-200 rounded-box flex flex-col gap-2 p-4 text-sm">
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
