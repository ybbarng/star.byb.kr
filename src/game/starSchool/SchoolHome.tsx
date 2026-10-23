"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Confetti } from "@/game/fx/Fx";
import { dayNumber, revengeIds } from "@/game/starSchool/leitner";
import { LESSONS } from "@/game/starSchool/lessons";
import {
  dexProgress,
  hasStamp,
  isSouthOpen,
  savePassport,
  stampProgress,
  STAMPS,
} from "@/game/starSchool/passport";
import {
  answerDaily,
  dailyStreak,
  dateKeyOf,
  loadSave,
  rankOf,
  RANKS,
  writeSave,
} from "@/game/starSchool/progress";
import { dailyQuestion } from "@/game/starSchool/quiz";
import RelationQuestionView from "@/game/starSchool/RelationQuestionView";
import { SCHOOL_BASE } from "@/game/starSchool/SchoolShell";
import { useSave } from "@/game/starSchool/useSave";
import { cn } from "@/utils/cn";

// 별자리 익히기 첫 화면: 내 등급과 별빛, 오늘의 하늘 문제, 별자리 여권(도장·도감), 네 갈래 배움터, 도전.

const PARTS = [
  {
    href: `${SCHOOL_BASE}/dex`,
    icon: "📖",
    title: "도감",
    note: "별자리 88개·길잡이 모양·맨눈 딥스카이. 만나면 그림자가 벗겨져요",
  },
  {
    href: `${SCHOOL_BASE}/practice`,
    icon: "🃏",
    title: "카드 연습",
    note: "모양 ↔ 이름, 점 잇기. 익숙해질수록 선이 사라져요",
  },
  {
    href: `${SCHOOL_BASE}/lessons`,
    icon: "🧭",
    title: "하늘 길잡이 수업",
    note: "실제 하늘에서 별 징검다리를 건너요. 북극성부터 남십자까지",
  },
  {
    href: `${SCHOOL_BASE}/relations`,
    icon: "🔗",
    title: "관계 맞히기",
    note: "꼭짓점 누르기, 사이 별자리, 징검다리, 해의 길 순서",
  },
];

export default function SchoolHome() {
  const save = useSave();
  const [today, setToday] = useState<Date | null>(null);
  const [dailyGain, setDailyGain] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const { rank, next, progress, index: rankIndex } = rankOf(save.xp);
  const dex = dexProgress(save);
  const southOpen = isSouthOpen(save);

  // 날짜는 브라우저에서 (서버에서 그린 날짜와 어긋나지 않게)
  useEffect(() => setToday(new Date()), []);

  const dateKey = today ? dateKeyOf(today) : null;
  const daily = useMemo(
    () => (dateKey ? dailyQuestion(dateKey) : null),
    [dateKey],
  );
  const dailyDone = dateKey ? dateKey in save.daily : false;
  const streak = today ? dailyStreak(save.daily, today) : 0;
  const dueCount = today
    ? Object.values(save.cards).filter((c) => c.due <= dayNumber(today)).length
    : 0;
  const revenge = revengeIds(save.cards).length;
  const nextLesson = LESSONS.find(
    (l) => !save.lessons[l.id]?.done && (l.hemisphere === "north" || southOpen),
  );

  return (
    <div className="flex flex-col gap-6">
      <Confetti fire={dailyGain && dailyGain > 20 ? 1 : 0} />
      <div className="fx-rise grid grid-cols-1 gap-4 md:grid-cols-[1.2fr_1fr]">
        <div className="bg-base-200/80 rounded-box flex flex-col gap-3 p-5 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="text-5xl">{rank.icon}</span>
            <div>
              <div className="text-xs opacity-60">별지기 등급</div>
              <div className="text-2xl font-black">{rank.title}</div>
              <div className="text-sm opacity-70">{rank.note}</div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-amber-200">
                ✦ 별빛 {save.xp.toLocaleString()}
              </span>
              {next && (
                <span className="opacity-60">
                  {next.icon} {next.title}까지{" "}
                  {(next.minXp - save.xp).toLocaleString()}
                </span>
              )}
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-300 to-pink-300 transition-all"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-lg">
              {RANKS.map((r, i) => (
                <span
                  key={r.title}
                  title={r.title}
                  className={cn(i > rankIndex && "opacity-25 grayscale")}
                >
                  {r.icon}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {nextLesson && (
              <Link
                href={`${SCHOOL_BASE}/lessons#${nextLesson.id}`}
                className="btn btn-sm btn-primary"
              >
                {nextLesson.icon} 다음 수업: {nextLesson.title}
              </Link>
            )}
            <Link href={`${SCHOOL_BASE}/practice`} className="btn btn-sm">
              🃏 카드 복습{dueCount ? ` (${dueCount}장 대기)` : ""}
            </Link>
          </div>
          <div className="text-xs opacity-50">
            별빛은 배운 만큼 쌓여요. 처음 맞히면 10, 전에 틀린 카드를 다시
            맞히면 25, 수업을 마치면 120. 기록은 이 브라우저에만 남아요.
          </div>
        </div>

        <div className="rounded-box flex flex-col gap-2 bg-gradient-to-br from-indigo-500/25 to-fuchsia-500/10 p-5 ring-1 ring-indigo-300/30">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">🌟 오늘의 하늘 문제</h2>
            {streak > 0 && (
              <span className="badge badge-warning">🔥 {streak}일 연속</span>
            )}
          </div>
          {!daily || !dateKey ? (
            <div className="opacity-60">불러오는 중…</div>
          ) : dailyDone && dailyGain === null ? (
            <div className="flex flex-col gap-1 text-sm">
              <div>
                오늘 문제는 {save.daily[dateKey] ? "맞혔어요 ✔" : "풀었어요"}.
                내일 새 문제가 나와요!
              </div>
              <div className="opacity-60">
                같은 날이면 누구에게나 같은 문제예요. 친구와 겨뤄 보세요.
              </div>
            </div>
          ) : (
            <>
              <div className="text-xs opacity-60">
                하루 한 번, 맞히면 별빛 50
              </div>
              <RelationQuestionView
                q={daily}
                onDone={(correct) => {
                  const r = answerDaily(loadSave(), dateKey, correct);
                  writeSave(r.save);
                  setDailyGain(r.gained);
                }}
              />
              {dailyGain !== null && (
                <div className="fx-pop text-center font-bold text-amber-200">
                  ✦ 별빛 +{dailyGain}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-bold">🛂 별자리 여권</h2>
          <button
            className="btn btn-sm btn-outline"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await savePassport(loadSave());
              setSaving(false);
            }}
          >
            {saving ? "그리는 중…" : "여권 그림으로 저장"}
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {STAMPS.map((s, i) => {
            const got = hasStamp(save, s.id);
            const p = stampProgress(save, s.id);
            const locked = s.id === "south" && !southOpen;

            return (
              <Link
                key={s.id}
                href={`${SCHOOL_BASE}/lessons`}
                className="flex flex-col items-center gap-1 text-center"
              >
                <span
                  className={cn(
                    "flex aspect-square w-full max-w-20 items-center justify-center rounded-full border-4 text-3xl",
                    got ? "fx-pop" : "border-dashed opacity-35 grayscale",
                  )}
                  style={{
                    borderColor: got ? s.color : "rgba(255,255,255,0.3)",
                    transform: got
                      ? `rotate(${((i % 3) - 1) * 8}deg)`
                      : undefined,
                  }}
                >
                  {locked ? "🔒" : s.icon}
                </span>
                <span className="text-[11px] leading-tight">
                  {s.title}
                  <br />
                  <span className="opacity-50">
                    {p.done}/{p.total}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          {(
            [
              ["별자리", dex.constellations],
              ["길잡이 모양", dex.asterisms],
              ["맨눈 딥스카이", dex.deepSky],
            ] as const
          ).map(([name, [n, total]]) => (
            <Link
              key={name}
              href={`${SCHOOL_BASE}/dex`}
              className="bg-base-200/60 rounded-box p-3"
            >
              <div className="flex justify-between">
                <span>📖 {name}</span>
                <b>
                  {n} / {total}
                </b>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-amber-300"
                  style={{ width: `${(n / total) * 100}%` }}
                />
              </div>
            </Link>
          ))}
        </div>
        {!southOpen && (
          <div className="text-xs opacity-60">
            🔒 봄·여름·가을·겨울 수업 도장을 모두 받으면 남반구
            하늘(남십자·마젤란 구름)이 열려요.
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PARTS.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="fx-card bg-base-200/80 rounded-box flex gap-3 p-4"
          >
            <span className="text-4xl">{p.icon}</span>
            <span className="flex flex-col">
              <span className="text-lg font-bold">{p.title}</span>
              <span className="text-sm opacity-80">{p.note}</span>
            </span>
          </Link>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">⚔️ 도전</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Link
            href={`${SCHOOL_BASE}/practice#time`}
            className="fx-card bg-base-200/70 rounded-box p-3"
          >
            <div className="font-bold">⏱ 60초 도전</div>
            <div className="text-xs opacity-70">
              최고 {save.best.timeAttack ?? 0}장
            </div>
          </Link>
          <Link
            href={`${SCHOOL_BASE}/practice#boss`}
            className="fx-card bg-base-200/70 rounded-box p-3"
          >
            <div className="font-bold">👑 88 보스전</div>
            <div className="text-xs opacity-70">
              최고 {save.best.boss ?? 0} / 88
            </div>
          </Link>
          <Link
            href={`${SCHOOL_BASE}/practice#revenge`}
            className="fx-card bg-base-200/70 rounded-box p-3"
          >
            <div className="font-bold">🥊 복수전</div>
            <div className="text-xs opacity-70">
              {revenge
                ? `틀렸던 카드 ${revenge}장 · 다시 맞히면 별빛 25`
                : "아직 틀린 카드가 없어요"}
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
