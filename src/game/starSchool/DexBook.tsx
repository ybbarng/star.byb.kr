"use client";

import type { DexEntry, DexKind } from "@/game/starSchool/dex";
import type { Figure } from "@/game/starSchool/figure";
import Link from "next/link";
import { useMemo, useState } from "react";
import { sfx } from "@/game/fx/sound";
import { deepSkyById } from "@/game/starSchool/deepSky";
import {
  dexEntries,
  eveningBest,
  seasonOfMonth,
  tonightSky,
} from "@/game/starSchool/dex";
import {
  asterismFigure,
  constellationFigure,
  deepSkyFigure,
} from "@/game/starSchool/figure";
import { dexProgress } from "@/game/starSchool/passport";
import { SCHOOL_BASE } from "@/game/starSchool/SchoolShell";
import ShapeFigure from "@/game/starSchool/ShapeFigure";
import { SEOUL_PLACE } from "@/game/starSchool/skyMath";
import { useSave } from "@/game/starSchool/useSave";
import { nightTime } from "@/game/tonight/time";
import { cn } from "@/utils/cn";

// 도감: 별자리 88개·길잡이 모양·맨눈 딥스카이. 카드 연습에서 맞히거나 수업을 마치면 그림자가 벗겨지며 열린다.
// 계절·방향은 서울 저녁 9시의 실제 하늘로 계산하고, "오늘 밤 서울"에서 뜨고 지는 때를 보여 준다.

export const figureOf = (e: DexEntry): Figure =>
  e.kind === "constellation"
    ? constellationFigure(e.name)
    : e.kind === "asterism"
      ? asterismFigure(e.id.slice(2))
      : deepSkyFigure(e.id.slice(2));

const KIND_TABS: { value: DexKind | "all"; title: string }[] = [
  { value: "all", title: "전체" },
  { value: "asterism", title: "길잡이 모양" },
  { value: "constellation", title: "별자리" },
  { value: "deepSky", title: "딥스카이" },
];

const SEASONS = ["봄", "여름", "가을", "겨울", "일 년 내내", "남반구"] as const;
type SeasonTag = (typeof SEASONS)[number];

const KIND_WORD: Record<DexKind, string> = {
  constellation: "별자리",
  asterism: "길잡이 모양",
  deepSky: "딥스카이",
};

const seasonTagOf = (e: DexEntry): SeasonTag => {
  if (e.hemisphere === "south") return "남반구";

  const b = eveningBest(e.center);

  return b.allYear ? "일 년 내내" : (seasonOfMonth(b.month) as SeasonTag);
};

export default function DexBook() {
  const save = useSave();
  const learned = useMemo(() => new Set(save.learned), [save.learned]);
  const entries = dexEntries();
  const tags = useMemo(
    () => new Map(entries.map((e) => [e.id, seasonTagOf(e)])),
    [entries],
  );
  const [kind, setKind] = useState<DexKind | "all">("all");
  const [season, setSeason] = useState<SeasonTag | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const [open, setOpen] = useState<DexEntry | null>(null);
  const progress = dexProgress(save);
  const shown = entries.filter(
    (e) =>
      (kind === "all" || e.kind === kind) &&
      (!season || tags.get(e.id) === season) &&
      (!onlyMine || learned.has(e.id)),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-base-200/70 rounded-box flex flex-wrap gap-x-6 gap-y-2 p-4 text-sm backdrop-blur">
        <div>
          별자리 <b>{progress.constellations[0]}</b> /{" "}
          {progress.constellations[1]}
        </div>
        <div>
          길잡이 모양 <b>{progress.asterisms[0]}</b> / {progress.asterisms[1]}
        </div>
        <div>
          딥스카이 <b>{progress.deepSky[0]}</b> / {progress.deepSky[1]}
        </div>
        <div className="w-full text-xs opacity-70">
          그림자 카드는 아직 못 만난 것이에요. 카드 연습에서 맞히거나 길잡이
          수업을 마치면 열려요. 눌러서 살짝 볼 수는 있어요.
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {KIND_TABS.map((t) => (
          <button
            key={t.value}
            className={cn(
              "btn btn-sm",
              kind === t.value ? "btn-primary" : "btn-ghost bg-base-200/50",
            )}
            onClick={() => setKind(t.value)}
          >
            {t.title}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {SEASONS.map((s) => (
          <button
            key={s}
            className={cn(
              "badge badge-lg cursor-pointer",
              season === s ? "badge-warning" : "badge-ghost",
            )}
            onClick={() => setSeason(season === s ? null : s)}
          >
            {s}
          </button>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={onlyMine}
            onChange={(e) => setOnlyMine(e.target.checked)}
          />
          모은 것만
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {shown.map((e) => {
          const got = learned.has(e.id);

          return (
            <button
              key={e.id}
              className={cn(
                "rounded-box fx-card flex flex-col items-center gap-1 p-1.5 text-center",
                got ? "bg-base-200/80" : "bg-base-300/50",
              )}
              onClick={() => {
                sfx.tap();
                setOpen(e);
              }}
            >
              <ShapeFigure
                figure={figureOf(e)}
                look={got ? "lines" : "silhouette"}
                field={false}
                marker={
                  e.kind === "deepSky"
                    ? {
                        kind: deepSkyById(e.id.slice(2)).kind,
                        sizeDeg: deepSkyById(e.id.slice(2)).sizeDeg,
                      }
                    : null
                }
                title={got ? e.name : "아직 못 만난 카드"}
              />
              <div className="w-full truncate text-xs font-bold">
                {got ? e.name.replace(/ \(.*\)$/, "") : "？"}
              </div>
              <div className="text-[10px] opacity-60">{tags.get(e.id)}</div>
            </button>
          );
        })}
      </div>
      {shown.length === 0 && (
        <div className="py-10 text-center opacity-60">
          {onlyMine
            ? "아직 모은 카드가 없어요. 카드 연습이나 수업부터 해 볼까요?"
            : "해당하는 카드가 없어요"}
        </div>
      )}

      {open && (
        <DexDetail
          entry={open}
          got={learned.has(open.id)}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function DexDetail({
  entry,
  got,
  onClose,
}: {
  entry: DexEntry;
  got: boolean;
  onClose: () => void;
}) {
  const best = useMemo(() => eveningBest(entry.center), [entry]);
  const tonight = useMemo(() => {
    const now = new Date();

    // 새벽(정오 전)이면 어젯밤 기준
    if (now.getHours() < 12) now.setDate(now.getDate() - 1);

    return {
      baseDay: now.getDate(),
      sky: tonightSky(entry.center, SEOUL_PLACE, {
        y: now.getFullYear(),
        m: now.getMonth() + 1,
        d: now.getDate(),
      }),
    };
  }, [entry]);
  const deep = entry.kind === "deepSky" ? deepSkyById(entry.id.slice(2)) : null;
  const tz = SEOUL_PLACE.tz;
  const at = (d: Date) => nightTime(d.getTime(), tz, tonight.baseDay);

  return (
    <div className="modal modal-open" role="dialog" onClick={onClose}>
      <div
        className="modal-box bg-base-200 flex max-h-[90vh] w-[min(36rem,calc(100vw-1.5rem))] max-w-none flex-col gap-3 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs opacity-60">
              {KIND_WORD[entry.kind]}
              {entry.fame === 3 && " · 꼭 알아 둘 것"}
              {!got && " · 아직 못 만남"}
            </div>
            <h2 className="text-2xl font-black">{entry.name}</h2>
            {entry.extra && (
              <div className="text-sm opacity-80">{entry.extra}</div>
            )}
          </div>
          <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="mx-auto w-full max-w-72">
          <ShapeFigure
            figure={figureOf(entry)}
            look="lines"
            names
            marker={deep ? { kind: deep.kind, sizeDeg: deep.sizeDeg } : null}
            title={entry.name}
          />
          <div className="mt-1 text-center text-[11px] opacity-50">
            하늘을 올려다본 모양 (위가 북쪽, 왼쪽이 동쪽)
          </div>
        </div>

        <div className="rounded-lg bg-black/25 p-3 text-sm">
          <div className="font-bold">🗓️ {entry.season}</div>
          {best.neverRises ? (
            <div>서울에서도 시드니에서도 높이 뜨지 않아요.</div>
          ) : (
            <div>
              {best.place.name} 저녁 9시 기준, <b>{best.month}월</b>(
              {seasonOfMonth(best.month, best.place.latDeg < 0)})에 가장 높이
              떠요 · {best.direction}쪽 {Math.round(best.altDeg)}°
              {best.allYear && " · 그곳에선 일 년 내내 지지 않아요"}
            </div>
          )}
          {entry.hemisphere === "south" && (
            <div className="text-amber-200">
              🌏 남반구 하늘이에요. 우리나라에선 거의 보이지 않아요.
            </div>
          )}
        </div>

        <div className="rounded-lg bg-indigo-400/10 p-3 text-sm">
          <div className="font-bold">🌙 오늘 밤 서울에서</div>
          {tonight.sky.neverUp ? (
            <div>어두운 동안 지평선 위로 올라오지 않아요.</div>
          ) : tonight.sky.upAllNight ? (
            <div>
              밤새 떠 있어요
              {tonight.sky.highest &&
                ` · 가장 높을 때 ${at(tonight.sky.highest.date)}, ${tonight.sky.highest.direction}쪽 ${Math.round(tonight.sky.highest.altDeg)}°`}
            </div>
          ) : (
            <div className="flex flex-col">
              {tonight.sky.rise && <span>뜨는 때: {at(tonight.sky.rise)}</span>}
              {tonight.sky.highest && (
                <span>
                  가장 높을 때: {at(tonight.sky.highest.date)} ·{" "}
                  {tonight.sky.highest.direction}쪽{" "}
                  {Math.round(tonight.sky.highest.altDeg)}°
                </span>
              )}
              {tonight.sky.set && <span>지는 때: {at(tonight.sky.set)}</span>}
            </div>
          )}
        </div>

        {entry.brightStars.length > 0 && (
          <div className="text-sm">
            <span className="font-bold">밝은 별: </span>
            {entry.brightStars
              .map((s) => `${s.name} (${s.mag.toFixed(1)}등급)`)
              .join(", ")}
          </div>
        )}
        <p className="text-sm">{entry.story}</p>
        {entry.howTo && (
          <p className="rounded-lg bg-emerald-400/10 p-3 text-sm">
            <b>🧭 찾아가는 법</b> {entry.howTo}
          </p>
        )}
        {!got && (
          <div className="text-xs opacity-70">
            이 카드는{" "}
            <Link href={`${SCHOOL_BASE}/practice`} className="link">
              카드 연습
            </Link>
            에서 맞히거나{" "}
            <Link href={`${SCHOOL_BASE}/lessons`} className="link">
              길잡이 수업
            </Link>
            을 마치면 도감에 붙어요.
          </div>
        )}
      </div>
    </div>
  );
}
