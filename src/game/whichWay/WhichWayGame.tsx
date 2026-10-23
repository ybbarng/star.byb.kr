"use client";

import type {
  AltAz,
  PhotoScore,
  WhichWayDifficulty,
  WhichWayRound,
} from "@/game/whichWay/problem";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { dateLabel, friendlyTime } from "@/game/tonight/time";
import Panorama from "@/game/whichWay/Panorama";
import {
  aimLabel,
  heightLabel,
  makeWhichWayRound,
  PHOTO_POINTS,
  photoAim,
  scoreRound,
  WHICH_WAY_SETTINGS,
} from "@/game/whichWay/problem";
import { renderPhoto } from "@/game/whichWay/renderPhoto";
import SkyMapBoard, { PHOTO_COLORS } from "@/game/whichWay/SkyMapBoard";
import { cn } from "@/utils/cn";

// 어느 쪽을 찍었을까: 같은 밤·같은 곳에서 찍은 하늘 사진 몇 장이 어느 쪽 하늘인지 전천 지도에 찍는다.
// 세 판, 사진 한 장에 최고 1,000점. 최고 기록 키는 `which-way-<난이도>`.

const ROUNDS = 3;

const DIFFICULTIES: {
  value: WhichWayDifficulty;
  title: string;
  note: string;
}[] = [
  { value: "intro", title: "입문", note: "사진 2장, 방위·별자리선 흐리게" },
  { value: "easy", title: "쉬움", note: "사진 3장, 넓은 화각" },
  { value: "normal", title: "보통", note: "4장, 기운 사진·좁은 화각·구름" },
  { value: "hard", title: "어려움", note: "4장, 마구 기울고 더 좁고 흐림" },
];

export const bestKey = (d: WhichWayDifficulty) => `which-way-${d}`;

interface RoundResult {
  place: string;
  points: number;
  max: number;
}

export default function WhichWayGame() {
  const [phase, setPhase] = useState<"intro" | "play" | "over">("intro");
  const [difficulty, setDifficulty] = useState<WhichWayDifficulty>("intro");
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
        title="어느 쪽을 찍었을까"
        tagline="같은 밤, 같은 곳에서 휴대폰으로 하늘 사진을 여러 장 찍었어요. 사진마다 어느 쪽 하늘을 찍었는지 맞혀 볼까요?"
        howTo={[
          "사진 위에 장소와 시각이 나와요. 오른쪽(휴대폰은 아래쪽) 둥근 지도는 그 순간의 하늘 전체예요. 가운데가 머리 꼭대기, 가장자리가 지평선이에요.",
          "지도는 하늘을 머리 위로 들어 올린 모습이라 북쪽이 위, 동쪽이 왼쪽이에요 (땅 지도와 동서가 반대!).",
          "사진에서 아는 별자리나 밝은 별을 찾아 지도에서 같은 모양을 찾고, 사진 가운데가 가리키는 자리를 눌러요.",
          "지평선이 보이면 낮은 하늘이에요. 사진이 기울어 있으면 지평선을 바로 세워 생각해요.",
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
    const max = results.reduce((s, r) => s + r.max, 0);
    const ratio = max ? total / max : 0;
    const stars = ratio >= 0.75 ? 3 : ratio >= 0.45 ? 2 : total > 0 ? 1 : 0;

    return (
      <ResultCard
        title="하늘 방향 읽기 끝!"
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
              난이도 바꾸기
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-1 text-sm">
          {results.map((r, i) => (
            <div key={i}>
              {i + 1}판 · {r.place} · <b>{r.points.toLocaleString()}점</b>{" "}
              <span className="opacity-60">/ {r.max.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <p className="text-sm opacity-80">
          컴퓨터는 플레이트 솔빙으로 사진마다 하늘 좌표를 찾아요.{" "}
          <Link href="/learn" className="link link-primary">
            찾는 원리 보기
          </Link>
        </p>
      </ResultCard>
    );
  }

  return (
    <WhichWayRoundView
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

function WhichWayRoundView({
  round: roundIndex,
  total,
  problemSeed,
  difficulty,
  onDone,
}: {
  round: number;
  total: number;
  problemSeed: number;
  difficulty: WhichWayDifficulty;
  onDone: (r: RoundResult) => void;
}) {
  const round = useMemo(
    () => makeWhichWayRound(problemSeed, difficulty),
    [problemSeed, difficulty],
  );
  const set = WHICH_WAY_SETTINGS[difficulty];
  const [photos, setPhotos] = useState<HTMLCanvasElement[] | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);
  const [guesses, setGuesses] = useState<(AltAz | null)[]>(() =>
    round.photos.map(() => null),
  );
  const [scored, setScored] = useState<ReturnType<typeof scoreRound> | null>(
    null,
  );
  const [panorama, setPanorama] = useState(false);
  const highlights = useMemo(
    () =>
      set.mapNames
        ? [...new Set(round.photos.flatMap((p) => p.constellations))]
        : [],
    [round, set.mapNames],
  );
  const t = round.date.getTime();
  const max = round.photos.length * PHOTO_POINTS;
  const allPlaced = guesses.every((g) => g !== null);

  // 사진은 브라우저에서 그린다 (캔버스)
  useEffect(() => {
    const canvases = round.photos.map((_, i) => renderPhoto(round, i));
    setPhotos(canvases);
    setUrls(canvases.map((c) => c.toDataURL("image/jpeg", 0.88)));
  }, [round]);

  const place = (aim: AltAz) => {
    sfx.tap();
    const next = guesses.map((g, i) => (i === selected ? aim : g));
    setGuesses(next);
    // 아직 안 찍은 다음 사진으로
    const after = next.findIndex((g, i) => g === null && i > selected);
    const any = next.findIndex((g) => g === null);
    const to = after >= 0 ? after : any;

    if (to >= 0) {
      setSelected(to);
    }
  };

  const submit = () => {
    const s = scoreRound(round, guesses);
    setScored(s);

    if (s.total >= max * 0.75) {
      sfx.win();
    } else if (s.total >= max * 0.4) {
      sfx.hit();
    } else {
      sfx.miss();
    }
  };

  return (
    <div className="flex w-full max-w-[1200px] flex-col gap-3">
      <div className="bg-base-200/80 rounded-box flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 backdrop-blur">
        <h1 className="text-xl font-bold">어느 쪽을 찍었을까</h1>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: ROUNDS }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-3 w-3 rounded-full",
                i < roundIndex
                  ? "bg-amber-300"
                  : i === roundIndex
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
          📍 <b>{round.place.name}</b> · {dateLabel(t, round.place.tz)}{" "}
          {friendlyTime(t, round.place.tz)}
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        {/* 사진 */}
        <div className="flex flex-col gap-2 md:w-1/2">
          <div className="relative">
            {urls[selected] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={urls[selected]}
                alt={`사진 ${selected + 1}`}
                className="rounded-box block aspect-[4/3] w-full bg-black"
              />
            ) : (
              <div className="rounded-box flex aspect-[4/3] w-full items-center justify-center bg-black/60 text-sm opacity-60">
                사진 그리는 중…
              </div>
            )}
            <div
              className="absolute top-2 left-2 rounded-full px-3 py-1 text-sm font-black text-black"
              style={{ background: PHOTO_COLORS[selected] }}
            >
              사진 {selected + 1}
            </div>
            <RoundBanner
              key={roundIndex}
              text={`${roundIndex + 1} / ${ROUNDS}`}
              sub={`${round.place.name}의 밤하늘 ${round.photos.length}장`}
            />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {round.photos.map((_, i) => (
              <button
                key={i}
                className={cn(
                  "relative overflow-hidden rounded-lg border-2 transition",
                  i === selected
                    ? "border-white"
                    : "border-transparent opacity-75 hover:opacity-100",
                )}
                onClick={() => {
                  sfx.tap();
                  setSelected(i);
                }}
              >
                {urls[i] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={urls[i]}
                    alt={`사진 ${i + 1} 작게`}
                    className="block aspect-[4/3] w-full"
                  />
                )}
                <span
                  className="absolute top-1 left-1 rounded-full px-1.5 text-xs font-black text-black"
                  style={{ background: PHOTO_COLORS[i] }}
                >
                  {i + 1}
                  {guesses[i] && " ✓"}
                </span>
              </button>
            ))}
          </div>
          <div className="text-xs opacity-60">
            사진 짧은 변이 하늘에서 약{" "}
            {Math.round(round.photos[selected].view.fovDeg)}° (팔 뻗은 주먹
            하나가 약 10°)
            {set.rollMaxDeg > 5 && " · 휴대폰을 기울여 찍은 사진도 있어요"}
          </div>
        </div>

        {/* 전천 지도와 답 */}
        <div className="flex flex-col gap-2 md:w-1/2">
          <div className="rounded-box bg-black/30 p-1">
            <SkyMapBoard
              round={round}
              guesses={guesses}
              selected={selected}
              revealed={scored !== null}
              photos={photos}
              highlights={highlights}
              onPlace={place}
            />
          </div>
          {!scored && (
            <>
              <div className="text-xs opacity-70">
                지금 고른 사진: <b>사진 {selected + 1}</b> — 사진 가운데가
                가리키는 자리를 지도에서 눌러요. 다시 누르면 옮겨져요.
                {set.mapNames && " 금색은 사진들에 나온 별자리예요."}
              </div>
              <button
                className="btn btn-primary btn-lg"
                disabled={!allPlaced}
                onClick={submit}
              >
                {allPlaced
                  ? "여기를 찍었어요! 📸"
                  : `사진 ${guesses.filter((g) => g === null).length}장 남았어요`}
              </button>
            </>
          )}
        </div>
      </div>

      {scored && (
        <ResultPanel
          round={round}
          guesses={guesses}
          scores={scored.photos}
          total={scored.total}
          max={max}
          last={roundIndex + 1 >= ROUNDS}
          panorama={panorama}
          onPanorama={() => setPanorama((v) => !v)}
          photos={photos}
          onNext={() =>
            onDone({ place: round.place.name, points: scored.total, max })
          }
        />
      )}
    </div>
  );
}

function ResultPanel({
  round,
  guesses,
  scores,
  total,
  max,
  last,
  panorama,
  onPanorama,
  photos,
  onNext,
}: {
  round: WhichWayRound;
  guesses: (AltAz | null)[];
  scores: PhotoScore[];
  total: number;
  max: number;
  last: boolean;
  panorama: boolean;
  onPanorama: () => void;
  photos: HTMLCanvasElement[] | null;
  onNext: () => void;
}) {
  return (
    <div className="bg-base-200/90 rounded-box fx-rise flex flex-col gap-3 p-4 text-sm backdrop-blur">
      <div className="flex flex-wrap items-end gap-3">
        <div className="text-4xl font-black text-amber-200">
          +<CountUp value={total} />
        </div>
        <div className="pb-1 opacity-70">/ {max.toLocaleString()}</div>
        <div className="grow" />
        <button className="btn btn-outline btn-sm" onClick={onPanorama}>
          {panorama ? "파노라마 접기" : "🖼 사진 이어 파노라마로 보기"}
        </button>
        <button className="btn btn-primary" onClick={onNext}>
          {last ? "결과 보기 ★" : "다음 판 →"}
        </button>
      </div>

      {panorama && photos && <Panorama round={round} photos={photos} />}

      <div className="grid gap-2 sm:grid-cols-2">
        {round.photos.map((p, i) => {
          const aim = photoAim(p);
          const s = scores[i];
          const g = guesses[i];

          return (
            <div
              key={i}
              className="rounded-lg border-l-4 bg-black/25 p-3"
              style={{ borderColor: PHOTO_COLORS[i] }}
            >
              <div className="flex items-baseline gap-2">
                <b>사진 {i + 1}</b>
                <span className="grow" />
                <b className="text-base text-amber-200">+{s.points}</b>
              </div>
              <div className="text-emerald-300">
                정답 {aimLabel(aim)} — {heightLabel(aim.altDeg)}
              </div>
              {g && (
                <div className="text-amber-200">
                  내 답 {aimLabel(g)} · <b>{s.errDeg?.toFixed(0)}°</b> 차이
                </div>
              )}
              <div className="mt-1 opacity-80">
                {p.constellations.length
                  ? `보이는 별자리: ${p.constellations.slice(0, 3).join(" · ")}`
                  : "이름난 별자리선은 거의 안 들어왔어요 — 밝은 별 몇 개의 모양으로 찾아야 해요"}
                {Math.abs(p.view.rollDeg) > 8 &&
                  ` · 휴대폰을 ${Math.round(Math.abs(p.view.rollDeg))}° 기울여 찍었어요`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg bg-black/25 p-3">
        <div>
          <b>읽는 법</b> — ① 사진의 별자리를 지도에서 찾으면 그 별자리가 있는
          쪽이 곧 사진의 방향이에요. ② 지평선이 보이면 사진 아래쪽이 땅이라
          고도가 낮고, 지평선이 사진 아래 끝에 가까울수록 더 높이 든 거예요. ③
          지도는 하늘을 올려다본 모습이라 동쪽이 왼쪽이에요. 땅 지도처럼
          생각하면 동서가 뒤바뀌어요.
        </div>
        <div>
          지도 위 색 테두리가 사진이 실제로 담은 하늘이에요. 지평선 가까이 찍은
          사진일수록 지도 가장자리에서 넓게 늘어나 보여요 (둥근 하늘을 평평하게
          펴서 생기는 일이에요).
        </div>
        <div>
          컴퓨터는 플레이트 솔빙으로 사진마다 하늘 좌표를 찾아요 —{" "}
          <Link href="/learn" className="link link-primary">
            찾는 원리 보기
          </Link>
        </div>
        <div className="text-xs opacity-60">
          계산의 한계: 별·달·행성 자리는 근사 계산이라 0.1° 안팎 어긋날 수 있고,
          지평선 근처에서 별이 0.5°쯤 떠 보이는 대기 굴절은 넣지 않았어요.
          채점은 사진 가운데 방향만 보고, 기울기는 보지 않아요.
        </div>
      </div>
    </div>
  );
}
