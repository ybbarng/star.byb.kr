"use client";

import type { DrawConstellation, DrawStar } from "@/game/starGuessr/drawSky";
import type { Difficulty, GuessrScene } from "@/game/starGuessr/scene";
import type { GuessrAnswer, GuessrScore } from "@/game/starGuessr/score";
import type { Point3D } from "@/scripts/hash/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { drawSky } from "@/game/starGuessr/drawSky";
import {
  dailySeed,
  localMeanTime,
  makeGuessrScene,
} from "@/game/starGuessr/scene";
import { answerDate, scoreGuess } from "@/game/starGuessr/score";
import { horizonCameraTP } from "@/search/horizonSolve";
import { estimateShotTimes } from "@/search/shotTimeEstimate";
import { julianDay, localSiderealDeg } from "@/search/utils/ephemeris";
import { cn } from "@/utils/cn";
import constellationData from "@build/database/vectors-constellations.json";
import catalogData from "@build/database/vectors-database.json";

// 별하늘 지오게서: 지평선이 보이는 밤하늘을 보고 위도·날짜·현지 시각을 맞힌다 (docs/game-plans.md 1).

interface VectorStar {
  V: string;
  K?: string;
  x: number;
  y: number;
  z: number;
}

const STARS: DrawStar[] = (catalogData as VectorStar[]).map((s) => ({
  vector: [s.x, s.y, s.z],
  mag: parseFloat(s.V),
  kelvin: s.K ? parseFloat(s.K) : 6000,
}));

const CONSTELLATIONS: DrawConstellation[] = (
  constellationData as { label: string; stars: number[][] }[]
).map((c) => ({ label: c.label, stars: c.stars as Point3D[] }));

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "쉬움 (방위 표시, 별 많음)",
  normal: "보통",
  hard: "어려움 (광해, 별 적음)",
};

const pad = (n: number) => String(n).padStart(2, "0");

export default function StarGuessrGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [seed, setSeed] = useState(() => dailySeed());
  const [answer, setAnswer] = useState<GuessrAnswer>({
    latDeg: 35,
    month: 6,
    day: 15,
    hour: 22,
    minute: 0,
  });
  const [result, setResult] = useState<GuessrScore | null>(null);
  const [total, setTotal] = useState({ rounds: 0, points: 0 });
  const scene = useMemo(
    () => makeGuessrScene(seed, difficulty),
    [seed, difficulty],
  );

  const newRound = (nextSeed: number) => {
    setSeed(nextSeed);
    setResult(null);
  };

  const submit = () => {
    const score = scoreGuess(scene, answer);
    setResult(score);
    setTotal((t) => ({
      rounds: t.rounds + 1,
      points: t.points + score.points.total,
    }));
  };

  return (
    <div className="flex w-full max-w-[1280px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">별하늘 지오게서</h1>
        <span className="text-sm opacity-70">
          어디서, 언제 본 하늘일까요? 위도·날짜·현지 시각을 맞혀 보세요.
        </span>
        <div className="grow" />
        <select
          className="select select-sm w-auto"
          value={difficulty}
          onChange={(e) => {
            setDifficulty(e.target.value as Difficulty);
            setResult(null);
          }}
        >
          {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABEL[d]}
            </option>
          ))}
        </select>
        <button
          className="btn btn-sm"
          onClick={() => newRound(dailySeed())}
          title="오늘은 누구에게나 같은 문제입니다"
        >
          오늘의 문제
        </button>
        <button
          className="btn btn-sm btn-primary"
          onClick={() => newRound(Math.floor(Math.random() * 1e9))}
        >
          새 문제
        </button>
        {total.rounds > 0 && (
          <span className="text-sm">
            {total.rounds}판 · 평균 {Math.round(total.points / total.rounds)}점
          </span>
        )}
      </div>

      <SkyCanvas scene={scene} solved={result !== null} />

      {!result ? (
        <AnswerForm answer={answer} onChange={setAnswer} onSubmit={submit} />
      ) : (
        <ResultPanel
          scene={scene}
          answer={answer}
          score={result}
          onNext={() => newRound(Math.floor(Math.random() * 1e9))}
        />
      )}
    </div>
  );
}

// 문제 사진. 풀이 화면에서는 별자리선을 겹쳐 그린다.
function SkyCanvas({
  scene,
  solved,
  override,
  className,
}: {
  scene: GuessrScene;
  solved: boolean;
  override?: { date: Date; latDeg: number }; // 내 답의 하늘
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");

    if (!ctx) {
      return;
    }

    const date = override?.date ?? scene.date;
    const observer = override
      ? { latDeg: override.latDeg, lonDeg: scene.observer.lonDeg }
      : scene.observer;
    drawSky(ctx, {
      width: scene.width,
      height: scene.height,
      TP: override
        ? horizonCameraTP(date, observer, scene.view, scene.width, scene.height)
        : scene.TP,
      date,
      observer,
      azimuthDeg: scene.view.azimuthDeg,
      magLimit: scene.magLimit,
      lightPollution: scene.lightPollution,
      groundSeed: scene.seed,
      stars: STARS,
      constellations: solved ? CONSTELLATIONS : undefined,
      compass: solved || scene.difficulty === "easy",
    });
  }, [scene, solved, override]);

  return (
    <canvas
      ref={ref}
      width={scene.width}
      height={scene.height}
      className={cn("rounded-box w-full bg-black", className)}
    />
  );
}

function AnswerForm({
  answer,
  onChange,
  onSubmit,
}: {
  answer: GuessrAnswer;
  onChange: (a: GuessrAnswer) => void;
  onSubmit: () => void;
}) {
  const set = (patch: Partial<GuessrAnswer>) =>
    onChange({ ...answer, ...patch });
  const latLabel =
    answer.latDeg === 0
      ? "적도"
      : `${answer.latDeg > 0 ? "북위" : "남위"} ${Math.abs(answer.latDeg)}°`;

  return (
    <div className="bg-base-200 rounded-box flex flex-wrap items-end gap-6 p-4">
      <label className="flex min-w-72 grow flex-col gap-1">
        <span className="text-sm">위도: {latLabel}</span>
        <input
          type="range"
          min={-60}
          max={70}
          value={answer.latDeg}
          className="range range-sm w-full"
          onChange={(e) => set({ latDeg: Number(e.target.value) })}
        />
        <span className="flex justify-between text-xs opacity-60">
          <span>남위 60°</span>
          <span>적도</span>
          <span>북위 70°</span>
        </span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">날짜</span>
        <div className="flex gap-1">
          <select
            className="select select-sm w-20"
            value={answer.month}
            onChange={(e) => set({ month: Number(e.target.value) })}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1}월
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={31}
            className="input input-sm w-16"
            value={answer.day}
            onChange={(e) => set({ day: Number(e.target.value) })}
          />
          <span className="self-center text-sm">일</span>
        </div>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">현지 시각</span>
        <input
          type="time"
          className="input input-sm w-32"
          value={`${pad(answer.hour)}:${pad(answer.minute)}`}
          onChange={(e) => {
            const [h, m] = e.target.value.split(":").map(Number);
            set({ hour: h || 0, minute: m || 0 });
          }}
        />
      </label>
      <button className="btn btn-primary" onClick={onSubmit}>
        제출
      </button>
    </div>
  );
}

function ResultPanel({
  scene,
  answer,
  score,
  onNext,
}: {
  scene: GuessrScene;
  answer: GuessrAnswer;
  score: GuessrScore;
  onNext: () => void;
}) {
  const truthLocal = localMeanTime(scene.date, scene.observer.lonDeg);
  const lat = scene.observer.latDeg;
  const lon = scene.observer.lonDeg;
  const lst = localSiderealDeg(julianDay(scene.date), scene.observer);
  const year = truthLocal.getUTCFullYear();
  const guessMs = answerDate(scene, answer).getTime();
  const override = useMemo(
    () => ({ date: new Date(guessMs), latDeg: answer.latDeg }),
    [guessMs, answer.latDeg],
  );

  // 같은 하늘이 되는 다른 날짜들 (매달 1일, 밤인 것만)
  const sameSky = useMemo(
    () =>
      estimateShotTimes(
        { latDeg: lat, lstDeg: lst },
        {
          lonDeg: lon,
          from: new Date(Date.UTC(year, 0, 1) - (lon / 15) * 3600000),
          days: 366,
        },
      )
        .map((c) => localMeanTime(c.date, lon))
        .filter((d) => d.getUTCDate() === 1)
        // 1년을 넘으면 같은 달이 다시 나온다
        .filter(
          (d, i, all) =>
            all.findIndex((e) => e.getUTCMonth() === d.getUTCMonth()) === i,
        ),
    [lat, lst, lon, year],
  );

  const fmt = (d: Date) =>
    `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-base-200 rounded-box flex flex-wrap items-center gap-6 p-4">
        <div className="text-3xl font-bold">{score.points.total}점</div>
        <ScoreItem
          label="위도"
          points={score.points.lat}
          detail={`정답 ${lat >= 0 ? "북위" : "남위"} ${Math.abs(lat).toFixed(0)}° · ${score.latErrorDeg.toFixed(0)}° 차이`}
        />
        <ScoreItem
          label="하늘 시각"
          points={score.points.sky}
          detail={`${(score.skyErrorHours * 60).toFixed(0)}분 차이`}
        />
        <ScoreItem
          label="날짜"
          points={score.points.date}
          detail={`정답 ${fmt(truthLocal)} · ${score.dateErrorDays.toFixed(0)}일 차이`}
        />
        <div className="grow" />
        <button className="btn btn-primary" onClick={onNext}>
          다음 문제
        </button>
      </div>

      <div className="bg-base-200 rounded-box flex flex-col gap-2 p-4 text-sm">
        <div className="font-bold">풀이</div>
        <div>
          <b>위도</b>: 천구의{" "}
          {lat >= 0 ? "북극(북극성 근처)" : "남극(남십자 아래)"}은 지평선에서
          위도만큼 높이 떠 있어요. 이 하늘에서는 {Math.abs(lat).toFixed(0)}°
          높이였어요.
          {lat < 0 &&
            " 남쪽 하늘의 별자리(남십자·센타우루스)가 보이면 남반구예요."}
        </div>
        <div>
          <b>시각</b>: 같은 하늘은 하루 4분, 한 달 2시간씩 일찍 와요. 그래서
          사진만으로는 날짜와 시각의 짝만 알 수 있어요. 이 하늘은{" "}
          {sameSky.slice(0, 6).map(fmt).join(", ")}
          {sameSky.length > 6 && " …"}에도 똑같이 보여요. 이 중 하나를 맞히면
          하늘 시각 점수는 만점이에요.
        </div>
        <div>
          <b>날짜</b>: 해가 지평선 아래여야 밤이라 계절이 좁혀지고, 달이 있으면
          달의 모양과 위치로 날짜를 더 좁힐 수 있어요.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <div className="text-sm font-bold">정답의 하늘 (별자리선)</div>
          <SkyCanvas scene={scene} solved />
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-sm font-bold">
            내 답의 하늘 ({answer.latDeg >= 0 ? "북위" : "남위"}{" "}
            {Math.abs(answer.latDeg)}°, {answer.month}월 {answer.day}일{" "}
            {pad(answer.hour)}:{pad(answer.minute)}, 같은 방향)
          </div>
          <SkyCanvas scene={scene} solved override={override} />
        </div>
      </div>
    </div>
  );
}

function ScoreItem({
  label,
  points,
  detail,
}: {
  label: string;
  points: number;
  detail: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-sm opacity-70">{label}</span>
      <span className="text-xl font-bold">{points}</span>
      <span className="text-xs opacity-60">{detail}</span>
    </div>
  );
}
