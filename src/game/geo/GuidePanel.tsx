"use client";

import type { GuideStep, GuideTarget } from "@/game/geo/guide";
import type { GeoProblem } from "@/game/geo/problem";
import type { Point3D } from "@/scripts/hash/types";
import { useEffect, useMemo, useState } from "react";
import { sfx } from "@/game/fx/sound";
import { buildGuide } from "@/game/geo/guide";
import { cn } from "@/utils/cn";

// SkyGuessr 입문의 길잡이 상자: 질문을 하나씩 던지고, 고르기·하늘에서 찾기를 마치면 단서를 수첩에 모은다.
// 처음엔 접혀 있고, 핀을 못 찍은 채 시간이 지나면 "같이 찾아볼까요?"로 먼저 말을 건다.

const NUDGE_MS = 20000;

export default function GuidePanel({
  problem,
  foundTick,
  onTarget,
  onReveal,
  onLines,
}: {
  problem: GeoProblem;
  foundTick: number; // 하늘에서 찾을 때마다 늘어난다
  onTarget: (t: GuideTarget | null) => void;
  onReveal: (v: Point3D) => void;
  onLines: (label: string) => void;
}) {
  const steps = useMemo(() => buildGuide(problem), [problem]);
  const [open, setOpen] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [index, setIndex] = useState(0);
  const [reply, setReply] = useState<string | null>(null);
  const [done, setDone] = useState(false); // 지금 단계를 마쳤나
  const [clues, setClues] = useState<string[]>([]);
  const step: GuideStep | undefined = steps[index];

  useEffect(() => {
    const id = window.setTimeout(() => setNudge(true), NUDGE_MS);

    return () => window.clearTimeout(id);
  }, []);

  // 찾을 것을 하늘에 알린다
  useEffect(() => {
    onTarget(open && step?.target && !done ? step.target : null);
  }, [open, step, done, onTarget]);

  // 하늘에서 찾았다
  useEffect(() => {
    if (!foundTick || !step?.target || done) return;

    sfx.hit();
    setReply(step.found ?? "찾았어요!");
    setDone(true);

    if (step.target.lines) onLines(step.target.lines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foundTick]);

  const next = () => {
    if (step?.clue) setClues((c) => [...c, step.clue!]);

    setIndex((i) => i + 1);
    setReply(null);
    setDone(false);
  };

  if (!open) {
    return (
      <button
        className={cn(
          "btn btn-sm self-start",
          nudge ? "btn-warning fx-rise" : "btn-outline",
        )}
        onClick={() => {
          sfx.tap();
          setOpen(true);
        }}
      >
        🧭 {nudge ? "막혔나요? 길잡이와 같이 찾아볼까요" : "길잡이"}
      </button>
    );
  }

  return (
    <div className="fx-rise flex flex-col gap-2 rounded-lg bg-emerald-400/10 p-3 ring-1 ring-emerald-300/30">
      <div className="flex items-center justify-between">
        <span className="font-bold">🧭 길잡이</span>
        <span className="text-xs opacity-60">
          {Math.min(index + 1, steps.length)} / {steps.length}
        </span>
      </div>

      {step ? (
        <>
          <div>{step.say}</div>

          {step.choices && !done && (
            <div className="flex flex-wrap gap-2">
              {step.choices.map((c) => (
                <button
                  key={c.label}
                  className="btn btn-sm btn-outline"
                  onClick={() => {
                    setReply(c.reply);

                    if (c.correct) {
                      sfx.twinkle(2);
                      setDone(true);
                    } else {
                      sfx.miss();
                    }
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {step.target && !done && (
            <div className="flex flex-wrap items-center gap-2 text-xs opacity-80">
              <span>👆 하늘에서 찾아 눌러 보세요</span>
              {step.help && (
                <button
                  className="btn btn-xs btn-ghost"
                  onClick={() => {
                    setReply(step.help!);
                    onReveal(step.target!.vectors[0]);
                  }}
                >
                  못 찾겠어요
                </button>
              )}
            </div>
          )}

          {reply && (
            <div
              className={cn(
                "rounded-md p-2",
                done ? "bg-emerald-400/15" : "bg-amber-300/10",
              )}
            >
              {reply}
            </div>
          )}

          {(done || (!step.choices && !step.target)) &&
            index < steps.length - 1 && (
              <button
                className="btn btn-sm btn-primary self-end"
                onClick={next}
              >
                다음 →
              </button>
            )}
        </>
      ) : null}

      {clues.length > 0 && (
        <div className="rounded-md bg-black/25 p-2 text-xs">
          <div className="mb-1 font-bold">📒 모은 단서</div>
          <ul className="flex flex-col gap-0.5">
            {clues.map((c) => (
              <li key={c}>✔ {c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
