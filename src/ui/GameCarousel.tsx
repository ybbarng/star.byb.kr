"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { type GameEntry, KIND_LABELS } from "@/game/hub";
import { cn } from "@/utils/cn";

// 첫 화면의 별 놀이터 카드 줄: 카드를 한 줄로 놓고 몇 초마다 다음 카드로 넘긴다 (끝에 닿으면 처음으로).
// 사람이 만지거나(손가락·마우스를 올림·초점) 탭이 숨으면 멈추고, 움직임 줄이기 설정이면 넘기지 않는다.
const INTERVAL_MS = 3500;

export default function GameCarousel({ games }: { games: GameEntry[] }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [index, setIndex] = useState(0);

  // 손으로 넘겨도 지금 몇 번째인지 따라간다
  useEffect(() => {
    const row = rowRef.current;

    if (!row) {
      return;
    }

    const onScroll = () => {
      const card = row.firstElementChild as HTMLElement | null;

      if (card) {
        setIndex(Math.round(row.scrollLeft / (card.offsetWidth + gapOf(row))));
      }
    };

    row.addEventListener("scroll", onScroll, { passive: true });

    return () => row.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (
      paused ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      const row = rowRef.current;
      const card = row?.firstElementChild as HTMLElement | null;

      if (!row || !card || document.hidden) {
        return;
      }

      const step = card.offsetWidth + gapOf(row);
      const atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4;
      row.scrollTo({
        left: atEnd ? 0 : row.scrollLeft + step,
        behavior: "smooth",
      });
    }, INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [paused]);

  return (
    <div
      className="flex flex-col gap-2"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        ref={rowRef}
        className="flex snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden"
      >
        {games.map((g) => (
          <Link
            key={g.href}
            href={g.href}
            className={cn(
              "rounded-box fx-card w-[82%] shrink-0 snap-start bg-gradient-to-br p-[1.5px] sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]",
              g.accent,
            )}
          >
            <span className="bg-base-200/90 rounded-box flex h-full flex-col gap-2 p-5 backdrop-blur">
              <span className="flex items-start justify-between">
                <span className="text-4xl">{g.icon}</span>
                <span className="badge badge-sm badge-ghost">
                  {KIND_LABELS[g.kind].title}
                </span>
              </span>
              <span className="text-lg font-bold">{g.title}</span>
              <span className="line-clamp-3 text-sm opacity-80">
                {g.summary}
              </span>
              <span className="text-primary mt-auto text-sm font-bold">
                {g.kind === "game" ? "플레이 →" : "둘러보기 →"}
              </span>
            </span>
          </Link>
        ))}
      </div>
      <div className="text-center text-xs tabular-nums opacity-50">
        {Math.min(index + 1, games.length)} / {games.length}
      </div>
    </div>
  );
}

const gapOf = (row: HTMLElement) =>
  parseFloat(getComputedStyle(row).columnGap) || 0;
