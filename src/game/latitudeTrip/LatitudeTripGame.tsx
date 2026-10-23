"use client";

import type { TripView } from "@/game/latitudeTrip/drawTrip";
import type { QuizPlace } from "@/game/latitudeTrip/trip";
import { useEffect, useMemo, useRef, useState } from "react";
import { GameIntro } from "@/game/fx/Fx";
import { sfx } from "@/game/fx/sound";
import {
  drawTrip,
  TRIP_HEIGHT,
  TRIP_WIDTH,
  tripCatalog,
} from "@/game/latitudeTrip/drawTrip";
import {
  latitudeNote,
  makeQuiz,
  QUIZ_PLACES,
  risingAngleDeg,
  skyShare,
} from "@/game/latitudeTrip/trip";
import { cn } from "@/utils/cn";

// 극지방·적도 하늘 여행 (docs/game-plans.md 둘러보기): 위도를 북극에서 남극까지 옮기며 그 자리의 하늘이
// 어떻게 도는지 본다. 시간을 빠르게 흘리고, 궤적(장노출)을 남기고, 지평선·천구의 극·적도를 겹쳐 본다.

const VIEWS: { view: TripView; label: string }[] = [
  { view: "dome", label: "둥근 하늘" },
  { view: 0, label: "북" },
  { view: 90, label: "동" },
  { view: 180, label: "남" },
  { view: 270, label: "서" },
];

// 1초에 흐르는 하늘 시간 (시간)
const SPEEDS = [1, 3, 6];

// 처음 하늘 시각: 오리온이 남쪽 하늘 가운데 오는 겨울밤 (지방 항성시 6시)
const START_LST = 90;

export default function LatitudeTripGame() {
  const [started, setStarted] = useState(false);

  return started ? (
    <TripPlay />
  ) : (
    <GameIntro
      title="극지방·적도 하늘 여행"
      tagline="북극에서 남극까지, 하늘이 도는 모습이 어떻게 바뀔까요?"
      howTo={[
        "위도 막대를 끌어 북극에서 적도, 남극까지 여행해요.",
        "시간을 빠르게 흘리면 별이 돌아요. 궤적을 켜면 장노출 사진처럼 길을 남겨요.",
        "둥근 하늘(올려다보기)과 동·서·남·북 보기를 바꿔 가며 별이 뜨고 지는 기울기를 비교해 보세요.",
      ]}
      startLabel="여행 떠나기"
      onStart={() => setStarted(true)}
    />
  );
}

interface Quiz {
  answer: QuizPlace;
  choices: QuizPlace[];
  picked: QuizPlace | null;
}

function TripPlay() {
  const [lat, setLat] = useState(37.6);
  const [lst, setLst] = useState(START_LST);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(SPEEDS[1]);
  const [trailFrom, setTrailFrom] = useState<number | null>(null);
  const [view, setView] = useState<TripView>("dome");
  const [guides, setGuides] = useState(true);
  const [lines, setLines] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  // 시간 흐르기
  useEffect(() => {
    if (!playing) {
      return;
    }

    let last = performance.now();
    let id = 0;

    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setLst((l) => l + dt * speed * 15);
      id = requestAnimationFrame(step);
    };

    id = requestAnimationFrame(step);

    return () => cancelAnimationFrame(id);
  }, [playing, speed]);

  const quizHidesAnswer = quiz !== null && quiz.picked === null;
  const shownLat = quiz ? quiz.answer.latDeg : lat;

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");

    if (ctx) {
      drawTrip(ctx, {
        latDeg: shownLat,
        lstDeg: lst,
        trailFromLstDeg: trailFrom,
        view,
        // 퀴즈 중에는 극 표시가 정답을 알려 주므로 끈다
        guides: guides && !quizHidesAnswer,
        lines,
      });
    }
  }, [shownLat, lst, trailFrom, view, guides, lines, quizHidesAnswer]);

  const decs = useMemo(() => tripCatalog().stars.map((s) => s.dec), []);
  const share = useMemo(() => skyShare(decs, shownLat), [decs, shownLat]);
  const note = latitudeNote(shownLat);
  const trailHours =
    trailFrom === null ? 0 : Math.min(24, (lst - trailFrom) / 15);

  const startQuiz = () => {
    sfx.whoosh();
    const q = makeQuiz(Math.random);
    setQuiz({ ...q, picked: null });
    setView("dome");
    setPlaying(true);
    // 반나절 궤적을 미리 남겨 둔다
    setTrailFrom(lst - 180);
  };

  const pickPlace = (p: QuizPlace) => {
    if (!quiz || quiz.picked) {
      return;
    }

    if (p.id === quiz.answer.id) {
      sfx.hit();
    } else {
      sfx.miss();
    }

    setQuiz({ ...quiz, picked: p });
  };

  return (
    <div className="flex w-full max-w-[1280px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">극지방·적도 하늘 여행</h1>
        <span className="text-sm opacity-70">
          위도를 옮기면 하늘이 기울어요. 별이 어떻게 도는지 보세요.
        </span>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex w-full flex-col gap-3 md:w-auto md:max-w-[880px] md:grow">
          <canvas
            ref={canvas}
            width={TRIP_WIDTH}
            height={TRIP_HEIGHT}
            className="rounded-box block w-full bg-black"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn btn-sm btn-primary w-20"
              onClick={() => {
                sfx.tap();
                setPlaying(!playing);
              }}
            >
              {playing ? "❚❚ 멈춤" : "▶ 재생"}
            </button>
            <div className="join">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  className={cn(
                    "join-item btn btn-sm",
                    speed === s && "btn-active",
                  )}
                  onClick={() => {
                    sfx.tap();
                    setSpeed(s);
                  }}
                >
                  1초에 {s}시간
                </button>
              ))}
            </div>
            <div className="join">
              {VIEWS.map((v) => (
                <button
                  key={v.label}
                  className={cn(
                    "join-item btn btn-sm",
                    view === v.view && "btn-primary",
                  )}
                  onClick={() => {
                    sfx.tap();
                    setView(v.view);
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-info"
                checked={trailFrom !== null}
                onChange={(e) => {
                  sfx.tap();
                  setTrailFrom(e.target.checked ? lst : null);
                }}
              />
              궤적 남기기 (장노출)
              {trailFrom !== null && (
                <span className="tabular-nums opacity-60">
                  {trailHours.toFixed(1)}시간
                </span>
              )}
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-warning"
                checked={guides}
                onChange={(e) => setGuides(e.target.checked)}
              />
              지평선·천구의 극·천구의 적도
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={lines}
                onChange={(e) => setLines(e.target.checked)}
              />
              별자리선
            </label>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-4 md:w-80">
          {quiz ? (
            <QuizPanel
              quiz={quiz}
              onPick={pickPlace}
              onNext={startQuiz}
              onQuit={() => {
                sfx.tap();
                setLat(quiz.answer.latDeg);
                setQuiz(null);
              }}
            />
          ) : (
            <div className="bg-base-200/80 rounded-box flex flex-col gap-3 p-4 text-sm backdrop-blur">
              <div className="flex items-center gap-3">
                <Globe latDeg={lat} />
                <div className="flex flex-col">
                  <span className="text-xs opacity-60">지금 있는 곳</span>
                  <span className="text-lg font-bold tabular-nums">
                    {Math.abs(lat) < 0.5
                      ? "적도 0°"
                      : `${lat > 0 ? "북위" : "남위"} ${Math.abs(lat).toFixed(1)}°`}
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={-90}
                max={90}
                step={0.5}
                value={lat}
                className="range range-primary range-sm"
                onChange={(e) => setLat(Number(e.target.value))}
                aria-label="위도"
              />
              <div className="flex justify-between text-xs opacity-60">
                <span>남극</span>
                <span>적도</span>
                <span>북극</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUIZ_PLACES.map((p) => (
                  <button
                    key={p.id}
                    className={cn(
                      "btn btn-xs",
                      Math.abs(lat - p.latDeg) < 0.5 && "btn-primary",
                    )}
                    onClick={() => {
                      sfx.tap();
                      setLat(p.latDeg);
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!quizHidesAnswer && (
            <div
              key={note.title}
              className="bg-base-200/80 rounded-box fx-rise flex flex-col gap-2 p-4 text-sm backdrop-blur"
            >
              <div className="text-xs opacity-60">{note.place}</div>
              <div className="text-lg font-bold text-sky-200">{note.title}</div>
              <div>{note.text}</div>
            </div>
          )}

          {!quizHidesAnswer && (
            <div className="bg-base-200/80 rounded-box flex flex-col gap-2 p-4 text-sm backdrop-blur">
              <div className="font-bold">이 위도에서 본 별 (4.6등급까지)</div>
              <div className="flex h-3 w-full overflow-hidden rounded-full">
                <div
                  className="bg-amber-300"
                  style={{ width: `${share.always * 100}%` }}
                />
                <div
                  className="bg-sky-400"
                  style={{ width: `${share.riseSet * 100}%` }}
                />
                <div
                  className="bg-slate-600"
                  style={{ width: `${share.never * 100}%` }}
                />
              </div>
              <div className="flex flex-col gap-0.5 text-xs tabular-nums">
                <span>
                  <span className="text-amber-300">■</span> 밤새 지지 않는 별{" "}
                  {Math.round(share.always * 100)}%
                </span>
                <span>
                  <span className="text-sky-400">■</span> 뜨고 지는 별{" "}
                  {Math.round(share.riseSet * 100)}%
                </span>
                <span>
                  <span className="text-slate-500">■</span> 아예 볼 수 없는 별{" "}
                  {Math.round(share.never * 100)}%
                </span>
              </div>
              <div className="text-xs opacity-70">
                별이 지평선을 지나는 기울기:{" "}
                <b>{Math.round(risingAngleDeg(shownLat))}°</b>{" "}
                {Math.abs(shownLat) < 5
                  ? "(거의 수직)"
                  : Math.abs(shownLat) > 80
                    ? "(거의 나란히)"
                    : "(비스듬히)"}
              </div>
            </div>
          )}

          {!quiz && (
            <button className="btn btn-outline btn-info" onClick={startQuiz}>
              🧭 이 하늘은 어디? (퀴즈)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function QuizPanel({
  quiz,
  onPick,
  onNext,
  onQuit,
}: {
  quiz: Quiz;
  onPick: (p: QuizPlace) => void;
  onNext: () => void;
  onQuit: () => void;
}) {
  const right = quiz.picked?.id === quiz.answer.id;

  return (
    <div className="bg-base-200/80 rounded-box flex flex-col gap-3 p-4 text-sm backdrop-blur">
      <div className="text-lg font-bold">이 하늘은 어디일까요?</div>
      <div className="opacity-70">
        궤적이 도는 가운데(천구의 극)가 얼마나 높은지, 별이 어느 쪽으로 도는지
        보세요. 점수는 없어요.
      </div>
      <div className="grid grid-cols-2 gap-2">
        {quiz.choices.map((p) => (
          <button
            key={p.id}
            className={cn(
              "btn btn-sm h-auto py-2",
              quiz.picked &&
                (p.id === quiz.answer.id
                  ? "btn-success"
                  : p.id === quiz.picked.id
                    ? "btn-error"
                    : "btn-ghost opacity-50"),
            )}
            onClick={() => onPick(p)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {quiz.picked && (
        <div className="fx-pop flex flex-col gap-2">
          <div
            className={cn("font-bold", right ? "text-success" : "text-error")}
          >
            {right ? "맞았어요!" : `아쉬워요. 정답은 ${quiz.answer.label}`}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-sm btn-primary grow" onClick={onNext}>
              다음 문제
            </button>
            <button className="btn btn-sm" onClick={onQuit}>
              그만하고 여기 둘러보기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 작은 지구: 내가 선 자리와 그 자리의 지평선(지구에 닿는 접선). 위도만큼 지평선이 기운다
function Globe({ latDeg }: { latDeg: number }) {
  const r = 26;
  const a = (latDeg * Math.PI) / 180;
  const x = 32 + r * Math.cos(a);
  const y = 32 - r * Math.sin(a);
  // 접선 방향
  const tx = Math.sin(a) * 16;
  const ty = Math.cos(a) * 16;

  return (
    <svg width={64} height={64} viewBox="0 0 64 64" className="shrink-0">
      <circle cx={32} cy={32} r={r} fill="#1e3a8a" stroke="#93c5fd" />
      <line
        x1={6}
        y1={32}
        x2={58}
        y2={32}
        stroke="#93c5fd"
        strokeDasharray="2 2"
      />
      <line x1={32} y1={2} x2={32} y2={62} stroke="#fcd34d" strokeWidth={1} />
      <line
        x1={x - tx}
        y1={y - ty}
        x2={x + tx}
        y2={y + ty}
        stroke="#86efac"
        strokeWidth={2}
      />
      <circle cx={x} cy={y} r={3.5} fill="#f472b6" />
    </svg>
  );
}
