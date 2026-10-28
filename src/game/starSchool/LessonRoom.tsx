"use client";

import type { Lesson, Mark, TapTarget } from "@/game/starSchool/lessons";
import type { SkyRing } from "@/game/starSchool/SchoolSky";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Confetti, FxLayer, useFx, useShake } from "@/game/fx/Fx";
import { sfx } from "@/game/fx/sound";
import { dexEntry } from "@/game/starSchool/dex";
import {
  aimFallback,
  stepDate,
  stepVectors,
  tapVector,
} from "@/game/starSchool/lessonGeometry";
import {
  lessonById,
  SEASON_LESSONS,
  stepBasics,
} from "@/game/starSchool/lessons";
import { hasStamp, isSouthOpen, STAMPS } from "@/game/starSchool/passport";
import { finishLesson, loadSave, writeSave } from "@/game/starSchool/progress";
import SchoolSky from "@/game/starSchool/SchoolSky";
import { timeLabel } from "@/game/starSchool/skyMath";
import { useSave } from "@/game/starSchool/useSave";
import BasicsLinks from "@/learn/basics/BasicsLinks";
import { track } from "@/ui/track";
import { cn } from "@/utils/cn";

// 하늘 길잡이 수업: 목록에서 고르면, 실제 하늘에서 한 걸음씩 별 징검다리를 건너고, 끝에 짧은 퀴즈를 푼다.
// 마치면 여권 도장과 별빛을 받고, 다룬 별자리·길잡이 모양이 도감에 붙는다.

const GROUPS: { title: string; note: string; ids: string[] }[] = [
  {
    title: "북극성 둘레",
    note: "어느 계절이든 먼저",
    ids: ["polaris", "dipper-clock"],
  },
  {
    title: "사계절 하늘 (북반구)",
    note: "넷을 마치면 남반구가 열려요",
    ids: SEASON_LESSONS,
  },
  { title: "은하수와 해의 길", note: "", ids: ["milky-way", "ecliptic"] },
  { title: "남반구 하늘", note: "", ids: ["south-cross", "south-clouds"] },
];

export default function LessonRoom() {
  const save = useSave();
  const [current, setCurrent] = useState<Lesson | null>(null);
  const southOpen = isSouthOpen(save);

  useEffect(() => {
    const id = window.location.hash.slice(1);
    const l = lessonById(id);

    if (l && (l.hemisphere === "north" || isSouthOpen(loadSave()))) {
      setCurrent(l);
    }
  }, []);

  if (current) {
    return (
      <LessonPlayer
        key={current.id}
        lesson={current}
        onExit={() => {
          history.replaceState(null, "", window.location.pathname);
          setCurrent(null);
        }}
      />
    );
  }

  const seasonsDone = SEASON_LESSONS.filter(
    (id) => save.lessons[id]?.done,
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm opacity-80">
        실제 밤하늘(그 장소·시각에 정말 떠 있는 하늘)에서 밝은 별을 징검다리
        삼아 길을 찾아요. 수업을 마치면 별자리 여권에 도장을 받아요.
      </p>
      {GROUPS.map((g) => {
        const locked = g.title === "남반구 하늘" && !southOpen;

        return (
          <section key={g.title} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-xl font-bold">{g.title}</h2>
              <span className="text-xs opacity-60">
                {locked
                  ? `🔒 북반구 사계절 수업을 마치면 열려요 (${seasonsDone} / 4)`
                  : g.note}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {g.ids.map((id) => {
                const l = lessonById(id)!;
                const done = !!save.lessons[id]?.done;

                return (
                  <button
                    key={id}
                    disabled={locked}
                    className={cn(
                      "rounded-box fx-card bg-base-200/80 flex gap-3 p-4 text-left",
                      locked && "opacity-40",
                    )}
                    onClick={() => {
                      sfx.whoosh();
                      history.replaceState(null, "", `#${id}`);
                      setCurrent(l);
                    }}
                  >
                    <span className="text-3xl">{locked ? "🔒" : l.icon}</span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-bold">
                        {l.title}{" "}
                        {done && (
                          <span className="badge badge-success badge-sm">
                            마침
                          </span>
                        )}
                      </span>
                      <span className="text-sm opacity-80">{l.summary}</span>
                      <span className="text-xs opacity-50">
                        {l.place.name} · {timeLabel(l.time)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// 찾기 문제를 푸는 동안 정답 자리를 바로 알려 주는 표시는 숨긴다
const revealsTarget = (m: Mark, t: TapTarget) =>
  (m.kind === "star" && "hr" in t && t.hr === m.hr) ||
  (m.kind === "deepSky" && "deepSky" in t && t.deepSky === m.id) ||
  (m.kind === "pole" && "pole" in t);

function LessonPlayer({
  lesson,
  onExit,
}: {
  lesson: Lesson;
  onExit: () => void;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const [found, setFound] = useState(false);
  const [misses, setMisses] = useState(0);
  const [help, setHelp] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [phase, setPhase] = useState<"steps" | "quiz" | "done">("steps");
  const [quizIdx, setQuizIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [quizRight, setQuizRight] = useState(0);
  const [result, setResult] = useState<{
    gained: number;
    newStamp: boolean;
    newLearned: string[];
  } | null>(null);
  const fx = useFx();
  const { ref: shakeRef, shake } = useShake();
  const step = lesson.steps[stepIdx];
  const tap = step.tap;
  const pending = !!tap && !found;
  const date = useMemo(() => stepDate(lesson, step), [lesson, step]);
  const marks = useMemo(
    () =>
      pending
        ? step.marks.filter((m) => !revealsTarget(m, tap!.target))
        : step.marks,
    [pending, step, tap],
  );
  const rings: SkyRing[] = useMemo(() => {
    if (!tap) return [];

    if (found)
      return [
        { vector: tapVector(tap.target), color: "rgba(110,240,150,0.95)" },
      ];

    return help
      ? [{ vector: tapVector(tap.target), color: "rgba(255,210,90,0.95)" }]
      : [];
  }, [tap, found, help]);

  const goStep = (i: number) => {
    sfx.whoosh();
    setStepIdx(i);
    setFound(false);
    setMisses(0);
    setHelp(false);
    setMessage(null);
  };

  const onTap = (hit: number) => {
    if (!tap || found) return;

    if (hit >= 0) {
      sfx.hit();
      fx.burst(0.5, 0.4);
      fx.popup(0.5, 0.35, "찾았어요!");
      setFound(true);
      setMessage(tap.found);
    } else {
      sfx.miss();
      setMisses((m) => m + 1);
      setMessage(
        misses + 1 >= 2
          ? "조금 어렵죠? '여기 있어요'를 누르면 자리를 알려 줘요."
          : "거기는 아니에요. 화살표와 설명을 따라 다시 찾아보세요.",
      );
    }
  };

  const finish = (right: number) => {
    const before = loadSave();
    const hadStamp = hasStamp(before, lesson.stamp);
    const r = finishLesson(before, lesson.id, right, lesson.learns);
    writeSave(r.save);
    track("lesson-finish", {
      lesson: lesson.id,
      first: !before.lessons[lesson.id]?.done,
    });
    setResult({
      gained: r.gained,
      newStamp: !hadStamp && hasStamp(r.save, lesson.stamp),
      newLearned: lesson.learns.filter((id) => !before.learned.includes(id)),
    });
    setPhase("done");
  };

  if (phase === "done" && result) {
    const stamp = STAMPS.find((s) => s.id === lesson.stamp)!;

    return (
      <div className="bg-base-200/85 rounded-box fx-rise mx-auto flex w-full max-w-xl flex-col items-center gap-4 p-6 text-center">
        <Confetti fire={1} />
        <div className="text-5xl">{lesson.icon}</div>
        <h2 className="text-2xl font-black">{lesson.title} 마침!</h2>
        <div className="text-lg text-amber-200">✦ 별빛 +{result.gained}</div>
        {result.newStamp && (
          <div
            className="fx-pop flex h-28 w-28 flex-col items-center justify-center rounded-full border-4 text-sm font-bold"
            style={{
              borderColor: stamp.color,
              color: stamp.color,
              transform: "rotate(-8deg)",
            }}
          >
            <span className="text-4xl">{stamp.icon}</span>
            {stamp.title}
          </div>
        )}
        <p className="rounded-lg bg-indigo-400/15 p-3 text-sm">
          💡 {lesson.fact}
        </p>
        {result.newLearned.length > 0 && (
          <div className="text-sm">
            📖 도감에 새로 붙은 카드:{" "}
            {result.newLearned
              .map((id) => dexEntry(id)?.name.replace(/ \(.*\)$/, ""))
              .join(", ")}
          </div>
        )}
        {lesson.links && (
          <div className="flex flex-wrap justify-center gap-2">
            {lesson.links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="btn btn-sm btn-outline"
              >
                {l.label} →
              </Link>
            ))}
          </div>
        )}
        <BasicsLinks slugs={lesson.basics} className="justify-center" />
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn btn-primary" onClick={onExit}>
            수업 목록
          </button>
          <button
            className="btn"
            onClick={() => {
              setPhase("steps");
              goStep(0);
              setQuizIdx(0);
              setQuizRight(0);
              setPicked(null);
            }}
          >
            다시 보기
          </button>
        </div>
      </div>
    );
  }

  if (phase === "quiz") {
    const q = lesson.quiz[quizIdx];

    return (
      <div
        ref={shakeRef}
        className="fx-rise mx-auto flex w-full max-w-xl flex-col gap-3"
      >
        <div className="flex items-center justify-between text-sm opacity-70">
          <span>
            📝 마무리 퀴즈 {quizIdx + 1} / {lesson.quiz.length}
          </span>
          <button className="btn btn-xs btn-ghost" onClick={onExit}>
            나가기
          </button>
        </div>
        <div className="text-lg font-bold">{q.q}</div>
        <div className="flex flex-col gap-2">
          {q.choices.map((c, i) => (
            <button
              key={c}
              className={cn(
                "btn h-auto min-h-12 justify-start py-2 text-left whitespace-normal",
                picked !== null && i === q.answer && "btn-success",
                picked === i && i !== q.answer && "btn-error",
              )}
              // disabled로 막으면 회색이 정답·오답 색을 덮어서, 누르기만 막는다
              aria-disabled={picked !== null}
              onClick={() => {
                if (picked !== null) {
                  return;
                }

                setPicked(i);

                if (i === q.answer) {
                  sfx.hit();
                  setQuizRight((r) => r + 1);
                } else {
                  sfx.miss();
                  shake();
                }
              }}
            >
              {c}
            </button>
          ))}
        </div>
        {picked !== null && (
          <div className="fx-rise flex flex-col gap-2 rounded-lg bg-black/25 p-3 text-sm">
            <div>{q.why}</div>
            <button
              className="btn btn-sm btn-primary self-end"
              onClick={() => {
                if (quizIdx + 1 < lesson.quiz.length) {
                  setQuizIdx(quizIdx + 1);
                  setPicked(null);
                } else {
                  finish(quizRight);
                }
              }}
            >
              {quizIdx + 1 < lesson.quiz.length ? "다음 문제 →" : "수업 마치기"}
            </button>
          </div>
        )}
      </div>
    );
  }

  const last = stepIdx === lesson.steps.length - 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{lesson.icon}</span>
          <h2 className="text-xl font-bold">{lesson.title}</h2>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={onExit}>
          ← 수업 목록
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_340px]">
        <div className="relative min-w-0">
          <FxLayer fx={fx} />
          <SchoolSky
            place={lesson.place}
            date={date}
            magLimit={step.sky?.magLimit ?? lesson.magLimit}
            lightPollution={step.sky?.lightPollution ?? lesson.lightPollution}
            marks={marks}
            // 찾기 문제 동안 정답 표시를 숨겨도 카메라는 단계 전체(숨긴 표시·찾을 자리 포함)를 본다.
            // 숨긴 표시로만 이루어진 단계(머리 위 직녀성)가 기본 방향(남쪽)을 보지 않게
            aim={aimFallback(lesson, stepIdx) ?? stepVectors(step)}
            look={step.view}
            aimKey={`${lesson.id}-${stepIdx}`}
            targets={
              tap
                ? { vectors: [tapVector(tap.target)], tolDeg: tap.tolDeg }
                : null
            }
            onTap={onTap}
            rings={rings}
            quiet={pending}
          />
        </div>
        <div className="bg-base-200/80 rounded-box flex flex-col gap-3 p-4">
          <div className="flex gap-1">
            {lesson.steps.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  i < stepIdx
                    ? "bg-amber-300"
                    : i === stepIdx
                      ? "fx-glow bg-amber-200"
                      : "bg-white/15",
                )}
              />
            ))}
          </div>
          <div className="text-xs opacity-60">
            📍 {lesson.place.name} · {timeLabel(step.time ?? lesson.time)}
          </div>
          <p className="leading-relaxed">{step.say}</p>
          <BasicsLinks slugs={stepBasics(step)} />
          {tap && !found && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-300/10 p-2 text-sm">
              <span>👆 {tap.prompt}</span>
              <button
                className="btn btn-xs btn-ghost"
                onClick={() => setHelp(true)}
              >
                여기 있어요
              </button>
              <button
                className="btn btn-xs btn-ghost opacity-60"
                onClick={() => {
                  setFound(true);
                  setMessage(tap.found);
                }}
              >
                건너뛰기
              </button>
            </div>
          )}
          {message && (
            <div
              className={cn(
                "fx-rise rounded-lg p-2 text-sm",
                found ? "bg-emerald-400/15" : "bg-red-400/10",
              )}
            >
              {message}
            </div>
          )}
          <div className="mt-auto flex justify-between gap-2">
            <button
              className="btn btn-sm"
              disabled={stepIdx === 0}
              onClick={() => goStep(stepIdx - 1)}
            >
              ← 이전
            </button>
            <button
              className="btn btn-sm btn-primary"
              disabled={pending}
              onClick={() => {
                if (last) {
                  sfx.whoosh();
                  setPhase("quiz");
                } else {
                  goStep(stepIdx + 1);
                }
              }}
            >
              {last ? "퀴즈 풀기 →" : "다음 →"}
            </button>
          </div>
          <div className="text-[11px] opacity-50">
            하늘을 끌어 둘러보고, +/−로 확대해요. 이 하늘은 그 시각 그 장소에서
            실제로 보이는 하늘이에요.
          </div>
        </div>
      </div>
    </div>
  );
}
