"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { rankOf } from "@/game/starSchool/progress";
import { useSave } from "@/game/starSchool/useSave";
import { cn } from "@/utils/cn";

// 별자리 익히기 공용 틀: 위에 다섯 갈래 길(처음·도감·카드 연습·길잡이 수업·관계 맞히기)과 내 별빛·등급.
// 별빛이 늘면 잠깐 반짝이고, 등급이 오르면 알려 준다.

export const SCHOOL_BASE = "/games/star-school";

const TABS = [
  { href: SCHOOL_BASE, label: "처음", icon: "🏫" },
  { href: `${SCHOOL_BASE}/dex`, label: "도감", icon: "📖" },
  { href: `${SCHOOL_BASE}/practice`, label: "카드 연습", icon: "🃏" },
  { href: `${SCHOOL_BASE}/lessons`, label: "길잡이 수업", icon: "🧭" },
  { href: `${SCHOOL_BASE}/relations`, label: "관계 맞히기", icon: "🔗" },
];

export default function SchoolShell({ children }: { children: ReactNode }) {
  const path = usePathname()?.replace(/\/$/, "") ?? "";
  const save = useSave();
  const { rank, next, progress } = rankOf(save.xp);
  const lastXp = useRef(save.xp);
  const lastRank = useRef(rank.title);
  const [glow, setGlow] = useState(false);
  const [rankUp, setRankUp] = useState<string | null>(null);
  // 처음 불러온 기록으로 바뀌는 것은 반짝이지 않는다
  const ready = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => (ready.current = true), 400);

    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (ready.current && save.xp > lastXp.current) {
      setGlow(true);
      const t = setTimeout(() => setGlow(false), 700);
      lastXp.current = save.xp;

      return () => clearTimeout(t);
    }

    lastXp.current = save.xp;
  }, [save.xp]);

  useEffect(() => {
    if (ready.current && rank.title !== lastRank.current) {
      setRankUp(`${rank.icon} ${rank.title}가 되었어요!`);
      const t = setTimeout(() => setRankUp(null), 3500);
      lastRank.current = rank.title;

      return () => clearTimeout(t);
    }

    lastRank.current = rank.title;
  }, [rank, save.xp]);

  return (
    <div className="flex w-full max-w-[1100px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={SCHOOL_BASE}
          className="bg-gradient-to-b from-white to-indigo-200 bg-clip-text text-2xl font-black text-transparent"
        >
          별자리 익히기
        </Link>
        <div
          className={cn(
            "flex min-w-0 items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-sm transition",
            glow && "fx-pop ring-2 ring-amber-300",
          )}
          title={
            next ? `다음 등급 ${next.title}까지 ${next.minXp - save.xp}` : ""
          }
        >
          <span>{rank.icon}</span>
          <span className="font-bold">{rank.title}</span>
          <span className="text-amber-200">✦ {save.xp.toLocaleString()}</span>
          {next && (
            <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-white/15 sm:block">
              <span
                className="block h-full bg-amber-300"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </span>
          )}
        </div>
      </div>
      <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "btn btn-sm shrink-0",
              path === t.href ? "btn-primary" : "btn-ghost bg-base-200/50",
            )}
          >
            <span>{t.icon}</span>
            {t.label}
          </Link>
        ))}
      </nav>
      {rankUp && (
        <div className="fx-banner alert alert-warning justify-center font-bold">
          🎉 등급이 올랐어요 — {rankUp}
        </div>
      )}
      {children}
    </div>
  );
}
