"use client";

import { useState } from "react";
import { sfx } from "@/game/fx/sound";
import { dayOfYear } from "@/game/moonDate/moonDate";
import MoonIcon from "@/game/moonDate/MoonIcon";
import { cn } from "@/utils/cn";

// 그해 달력: 한 달씩 넘기며 날짜를 고른다. 날마다 달 모양(힌트)·후보 표시·정답을 얹을 수 있다.

export interface CalendarMark {
  lit: number;
  angleDeg: number;
}

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

export default function MoonCalendar({
  year,
  selected,
  onSelect,
  icons,
  candidates,
  answer,
  initialMonth = 0,
}: {
  year: number;
  selected: number | null;
  onSelect?: (day: number) => void; // 없으면 고를 수 없다 (채점 뒤)
  icons?: CalendarMark[] | null; // 날마다 달 모양
  candidates?: Set<number> | null; // 모양·별자리가 맞는 날
  answer?: number | null;
  initialMonth?: number;
}) {
  const [month, setMonth] = useState(initialMonth);
  const first = dayOfYear(year, month, 1);
  const days = dayOfYear(year, month + 1, 1) - first;
  const lead = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const candidateMonths = candidates
    ? new Set(
        [...candidates].map((d) =>
          new Date(Date.UTC(year, 0, 1 + d)).getUTCMonth(),
        ),
      )
    : null;

  const go = (m: number) => {
    sfx.tap();
    setMonth((m + 12) % 12);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => go(month - 1)}
          aria-label="이전 달"
        >
          ◀
        </button>
        <div className="grow text-center text-lg font-bold">
          {year}년 {month + 1}월
        </div>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => go(month + 1)}
          aria-label="다음 달"
        >
          ▶
        </button>
      </div>
      <div className="flex flex-wrap justify-center gap-1">
        {Array.from({ length: 12 }, (_, m) => (
          <button
            key={m}
            className={cn(
              "h-6 min-w-7 rounded px-1 text-[11px]",
              m === month
                ? "bg-primary text-primary-content font-bold"
                : candidateMonths?.has(m)
                  ? "bg-emerald-400/25 text-emerald-200"
                  : "bg-white/5 opacity-70 hover:opacity-100",
            )}
            onClick={() => go(m)}
          >
            {m + 1}월
          </button>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {WEEK.map((w, i) => (
          <div
            key={w}
            className={cn(
              "opacity-60",
              i === 0 && "text-rose-300",
              i === 6 && "text-sky-300",
            )}
          >
            {w}
          </div>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead-${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = first + i;
          const icon = icons?.[day];
          const isCandidate = candidates?.has(day);
          const isAnswer = answer === day;
          const isPicked = selected === day;

          return (
            <button
              key={day}
              disabled={!onSelect}
              className={cn(
                "flex h-12 flex-col items-center justify-center gap-0.5 rounded-md text-sm tabular-nums transition sm:h-14",
                isAnswer
                  ? "bg-emerald-500/40 font-bold ring-2 ring-emerald-300"
                  : isPicked
                    ? "bg-amber-300/30 font-bold ring-2 ring-amber-300"
                    : isCandidate
                      ? "bg-emerald-400/15 ring-1 ring-emerald-300/70"
                      : "bg-white/5",
                onSelect && "hover:bg-white/15",
              )}
              onClick={() => {
                sfx.tap();
                onSelect?.(day);
              }}
            >
              <span>{i + 1}</span>
              {icon && (
                <MoonIcon lit={icon.lit} angleDeg={icon.angleDeg} size={14} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
