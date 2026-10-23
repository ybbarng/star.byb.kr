"use client";

import type { Syzygy } from "@/game/eclipse/eclipse";
import type {
  EclipseDifficulty,
  EclipseKind,
  EclipseScore,
  Pick,
} from "@/game/eclipse/problem";
import type { EclipseDetail } from "@/game/eclipse/summary";
import { useMemo, useState } from "react";
import {
  chanceOf,
  dayLabel,
  isoLabel,
  RULE,
  SEASON_HALF_WIDTH_DEG,
  yearSky,
} from "@/game/eclipse/eclipse";
import { typeLabel } from "@/game/eclipse/eclipseList";
import {
  bestKey,
  ECLIPSE_SETTINGS,
  kindOfSyzygy,
  pickYears,
  ROUND_MAX,
  ROUNDS,
  scoreYear,
  starsOf,
  togglePick,
} from "@/game/eclipse/problem";
import { nextInKorea, yearDetails } from "@/game/eclipse/summary";
import YearChart from "@/game/eclipse/YearChart";
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
import { cn } from "@/utils/cn";

// 식 예측하기 (src/game/eclipse): 한 해 달력에서 삭·망과 달의 황위 그래프를 보고 식이 일어날 날을 고른다.
// 정답은 NASA 일식·월식 목록(Espenak), 그래프는 우리 계산(ephemeris.ts). 세 해를 풀고 해마다 최고 1,000점.

const DIFFICULTIES: {
  value: EclipseDifficulty;
  title: string;
  note: string;
}[] = [
  { value: "intro", title: "입문", note: "삭·망 표시 + 식이 나는 띠" },
  { value: "normal", title: "보통", note: "삭·망 표시만" },
  { value: "hard", title: "어려움", note: "달 밝기만 보고 날짜를 직접" },
];

const SOURCE =
  "정답: NASA 일식·월식 목록(Fred Espenak, Five Millennium Canon, 퍼블릭 도메인)";

const ACCURACY =
  "그래프는 이 사이트의 달 계산이에요. 달 위치가 0.3~0.5°쯤 틀릴 수 있어서 황위 1~1.6° 언저리의 아슬아슬한 식은 그래프만으로 가를 수 없어요. 그래서 점수는 실제 목록으로 매기고, 식이 어디서 보이는지(경로·식분)도 계산하지 않아요.";

interface RoundResult {
  year: number;
  points: number;
  hits: number;
  total: number;
}

export default function EclipseGame() {
  const [phase, setPhase] = useState<"intro" | "play" | "over">("intro");
  const [difficulty, setDifficulty] = useState<EclipseDifficulty>("intro");
  const [years, setYears] = useState<number[]>([]);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [newBest, setNewBest] = useState(false);
  const total = results.reduce((s, r) => s + r.points, 0);

  const start = () => {
    setYears(pickYears(Math.floor(Math.random() * 1e9)));
    setResults([]);
    setPhase("play");
  };

  if (phase === "intro") {
    return (
      <GameIntro
        title="식 예측하기"
        tagline="일식·월식은 아무 때나 오지 않아요. 두 가지가 맞아떨어질 때만 와요. 그 날을 미리 찾아볼까요?"
        howTo={[
          "① 해·달·지구가 한 줄: 일식은 삭(달이 해 쪽에 있어 안 보이는 날), 월식은 망(보름)에만 일어나요.",
          "② 그런데 달이 다니는 길은 해의 길(황도)에서 5°쯤 기울어 있어요. 그래서 삭·망이어도 보통은 달이 해 위·아래로 비껴가요.",
          "달이 해의 길과 만나는 자리(교점) 근처, 그래프에서 황위가 0° 가까울 때 삭·망이 오면 식이 일어나요.",
          "한 해 그래프에서 식이 일어날 날을 고르세요. ●(삭)은 일식, ○(망)은 월식이에요. 세 해를 풀어요.",
        ]}
        onStart={start}
      >
        <OrbitFigure />
        <ChoiceCards
          options={DIFFICULTIES}
          value={difficulty}
          onChange={setDifficulty}
        />
        <div className="text-xs opacity-60">{SOURCE}</div>
      </GameIntro>
    );
  }

  if (phase === "over") {
    return (
      <ResultCard
        title="식 예측 끝!"
        score={total}
        stars={starsOf(total)}
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
        <div className="flex w-full flex-col gap-3 text-left text-sm">
          <div className="flex flex-col gap-1">
            {results.map((r) => (
              <div key={r.year}>
                {r.year}년 · 식 {r.total}번 중 {r.hits}번 맞힘 ·{" "}
                <b>{r.points.toLocaleString()}점</b>
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-black/25 p-3 leading-relaxed">
            <b>식은 식 철에 몰려요.</b> 해가 교점 근처를 지나는 한 달 남짓(식
            철)이 한 해에 두 번쯤 와요. 그 사이 삭·망이 한두 번씩 들어 있어서,
            식은 대개 일식과 월식이 2주 간격으로 짝지어 와요. 교점이 조금씩 뒤로
            돌아서 식 철은 해마다 19일쯤 앞당겨져요 (식의 해 346.6일).
          </div>
          <NextInKorea />
          <div className="text-xs opacity-60">{SOURCE}</div>
        </div>
      </ResultCard>
    );
  }

  return (
    <EclipseRound
      key={results.length}
      year={years[results.length]}
      round={results.length}
      total={total}
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

// 해·지구·달을 옆에서 본 그림: 달의 길이 기울어 있어 삭·망에도 보통은 비껴간다
function OrbitFigure() {
  return (
    <svg
      viewBox="0 0 360 150"
      className="bg-base-200/60 rounded-box w-full"
      role="img"
      aria-label="달의 길은 해의 길에서 기울어 있어요"
    >
      <circle cx={34} cy={75} r={22} fill="#fbbf24" />
      <text x={34} y={118} textAnchor="middle" fontSize={11} fill="#fde68a">
        해
      </text>
      <line
        x1={56}
        y1={75}
        x2={350}
        y2={75}
        stroke="#fbbf24"
        strokeDasharray="4 4"
        opacity={0.7}
      />
      <text x={350} y={68} textAnchor="end" fontSize={10} fill="#fcd34d">
        해의 길(황도)
      </text>
      <ellipse
        cx={240}
        cy={75}
        rx={80}
        ry={16}
        fill="none"
        stroke="#7dd3fc"
        transform="rotate(-12 240 75)"
      />
      <text x={292} y={40} fontSize={10} fill="#7dd3fc">
        달의 길 (5° 기울어짐)
      </text>
      <circle cx={240} cy={75} r={10} fill="#3b82f6" />
      <text x={240} y={104} textAnchor="middle" fontSize={11} fill="#bfdbfe">
        지구
      </text>
      {/* 교점 */}
      <circle cx={161} cy={75} r={3.5} fill="#f472b6" />
      <circle cx={319} cy={75} r={3.5} fill="#f472b6" />
      <text x={161} y={95} textAnchor="middle" fontSize={10} fill="#f9a8d4">
        교점
      </text>
      <text x={319} y={95} textAnchor="middle" fontSize={10} fill="#f9a8d4">
        교점
      </text>
      {/* 삭인데 비껴가는 달 */}
      <circle cx={170} cy={92} r={6} fill="#e5e7eb" />
      <text x={150} y={135} fontSize={10} fill="#e5e7eb">
        교점에서 먼 삭: 해 아래로 비껴가요
      </text>
    </svg>
  );
}

function EclipseRound({
  year,
  round,
  total,
  difficulty,
  onDone,
}: {
  year: number;
  round: number;
  total: number;
  difficulty: EclipseDifficulty;
  onDone: (r: RoundResult) => void;
}) {
  const set = ECLIPSE_SETTINGS[difficulty];
  const sky = useMemo(() => yearSky(year), [year]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [cursorDay, setCursorDay] = useState(Math.floor(sky.days / 2));
  const [score, setScore] = useState<EclipseScore | null>(null);

  const toggle = (p: Pick) => {
    sfx.tap();
    setPicks((list) => togglePick(list, p));
  };

  const pickSyzygy = (i: number) => {
    const s = sky.syzygies[i];
    toggle({ kind: kindOfSyzygy(s), day: s.day });
  };

  const submit = () => {
    const s = scoreYear(year, picks);
    setScore(s);

    if (s.points >= 800) {
      sfx.win();
    } else if (s.points >= 400) {
      sfx.hit();
    } else {
      sfx.miss();
    }
  };

  return (
    <div className="flex w-full max-w-[1200px] flex-col gap-3">
      <div className="bg-base-200/80 rounded-box flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 backdrop-blur">
        <h1 className="text-xl font-bold">식 예측하기</h1>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: ROUNDS }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-3 w-3 rounded-full",
                i < round
                  ? "bg-amber-300"
                  : i === round
                    ? "bg-white/80 ring-2 ring-white/40"
                    : "bg-white/20",
              )}
            />
          ))}
        </div>
        <div className="text-2xl font-black text-amber-200 tabular-nums">
          <CountUp value={total + (score?.points ?? 0)} duration={900} />
          <span className="ml-1 text-sm font-normal opacity-70">점</span>
        </div>
        <div className="grow" />
        <div className="rounded-xl bg-indigo-500/20 px-3 py-1 text-sm ring-1 ring-indigo-300/40">
          📅 <b>{year}년</b>
        </div>
      </div>

      <div className="relative">
        <div className="rounded-box overflow-x-auto bg-black/30 p-2">
          <div className="min-w-[640px]">
            <YearChart
              sky={sky}
              markers={set.markers}
              band={set.band}
              picks={picks}
              cursorDay={set.markers ? null : cursorDay}
              score={score}
              onPickSyzygy={pickSyzygy}
              onPickDay={
                set.markers
                  ? undefined
                  : (d) => {
                      sfx.tap();
                      setCursorDay(d);
                    }
              }
            />
          </div>
        </div>
        <RoundBanner key={round} text={`${year}년`} sub="이 해에 식은 언제?" />
        <div className="mt-1 text-xs opacity-60">
          파란 선: 달의 황위(해의 길에서 북·남으로 떨어진 각) · 아래 띠: 달이
          빛나는 정도
          {set.markers && " · 🌑 어두운 점: 삭(새 달) · 🌕 노란 점: 망(보름)"}
          {set.band &&
            ` · 진한 띠 ±${RULE.sure}°: 거의 틀림없이 식 · 옅은 띠 ±${RULE.maybe}°: 아슬아슬`}
          {" · 날짜는 세계시(UT) 기준이라 한국 날짜와 하루 다를 수 있어요"}
        </div>
      </div>

      {!score && (
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="bg-base-200/80 rounded-box flex flex-col gap-3 p-4 text-sm backdrop-blur md:w-[60%]">
            {set.markers ? (
              <SyzygyChips
                year={year}
                syzygies={sky.syzygies}
                picks={picks}
                onPick={pickSyzygy}
              />
            ) : (
              <DayPicker
                year={year}
                days={sky.days}
                day={cursorDay}
                onDay={setCursorDay}
                picks={picks}
                onPick={toggle}
              />
            )}
          </div>
          <div className="flex flex-col gap-2 md:w-[40%]">
            <div className="bg-base-200/60 rounded-box p-3 text-xs leading-relaxed opacity-80">
              <b>힌트</b> — 달은 한 달에 두 번 해의 길을 건너요(교점). 해가 그
              교점 근처에 오는 한 달 남짓 동안만 삭·망이 해의 길 위에서
              일어나요. 그래프에서 파란 선이 0° 근처를 지날 때 삭·망이 겹치는
              곳을 찾아요.
            </div>
            <div className="text-sm opacity-80">
              고른 식: 일식 {picks.filter((p) => p.kind === "solar").length}번 ·
              월식 {picks.filter((p) => p.kind === "lunar").length}번
            </div>
            <button
              className="btn btn-primary btn-lg"
              onClick={submit}
              disabled={picks.length === 0}
            >
              이날들이에요! 🌘
            </button>
          </div>
        </div>
      )}

      {score && (
        <RoundResultPanel
          year={year}
          syzygies={sky.syzygies}
          seasons={sky.seasons}
          score={score}
          last={round + 1 >= ROUNDS}
          onNext={() =>
            onDone({
              year,
              points: score.points,
              hits: score.hits,
              total: score.actual.length,
            })
          }
        />
      )}
    </div>
  );
}

function SyzygyChips({
  year,
  syzygies,
  picks,
  onPick,
}: {
  year: number;
  syzygies: Syzygy[];
  picks: Pick[];
  onPick: (i: number) => void;
}) {
  const isPicked = (s: Syzygy) =>
    picks.some((p) => p.kind === kindOfSyzygy(s) && p.day === s.day);

  return (
    <>
      <div className="font-bold">
        식이 일어날 삭·망을 눌러요 (그래프의 점을 눌러도 돼요)
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-5">
        {syzygies.map((s, i) => {
          const on = isPicked(s);

          return (
            <button
              key={s.jd}
              className={cn(
                "rounded-lg border px-2 py-1.5 text-left text-xs transition",
                on
                  ? "border-amber-300 bg-amber-300/15"
                  : "border-white/10 bg-black/20 hover:border-white/30",
              )}
              onClick={() => onPick(i)}
            >
              <div className="font-bold">
                {s.kind === "new" ? "🌑 삭" : "🌕 망"} {dayLabel(year, s.day)}
              </div>
              <div className="opacity-70">
                {on ? (s.kind === "new" ? "☀️ 일식!" : "🌕 월식!") : "\u00a0"}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function DayPicker({
  year,
  days,
  day,
  onDay,
  picks,
  onPick,
}: {
  year: number;
  days: number;
  day: number;
  onDay: (d: number) => void;
  picks: Pick[];
  onPick: (p: Pick) => void;
}) {
  const add = (kind: EclipseKind) => onPick({ kind, day });

  return (
    <>
      <div className="font-bold">
        그래프를 누르거나 막대를 밀어 날짜를 고르고, 일식인지 월식인지 정해요
      </div>
      <div className="text-xs opacity-70">
        삭·망 표시가 없어요. 아래 밝기 띠가 바닥이면 삭, 꼭대기면 망이에요.
      </div>
      <label className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <span className="opacity-70">날짜</span>
          <b className="text-lg text-amber-200 tabular-nums">
            {dayLabel(year, day)}
          </b>
        </div>
        <input
          type="range"
          className="range range-primary range-sm w-full"
          min={0}
          max={days - 1}
          value={day}
          onChange={(e) => onDay(Number(e.target.value))}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          className="btn btn-sm"
          onClick={() => onDay(Math.max(0, day - 1))}
        >
          ◀ 하루
        </button>
        <button
          className="btn btn-sm"
          onClick={() => onDay(Math.min(days - 1, day + 1))}
        >
          하루 ▶
        </button>
        <div className="grow" />
        <button className="btn btn-sm btn-warning" onClick={() => add("solar")}>
          ☀️ 이날 일식
        </button>
        <button className="btn btn-sm btn-info" onClick={() => add("lunar")}>
          🌕 이날 월식
        </button>
      </div>
      {picks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {[...picks]
            .sort((a, b) => a.day - b.day)
            .map((p) => (
              <button
                key={`${p.kind}-${p.day}`}
                className="badge badge-lg gap-1 border-amber-300/50 bg-amber-300/10"
                onClick={() => onPick(p)}
                title="지우기"
              >
                {p.kind === "solar" ? "☀️" : "🌕"} {dayLabel(year, p.day)} ✕
              </button>
            ))}
        </div>
      )}
    </>
  );
}

const latText = (b: number) =>
  `${b >= 0 ? "+" : "−"}${Math.abs(b).toFixed(1)}°`;

// 고른 날 가까운 삭·망 (그 종류, 하루 안쪽)
const syzygyNear = (syzygies: Syzygy[], p: Pick) =>
  syzygies.find(
    (s) => kindOfSyzygy(s) === p.kind && Math.abs(s.day - p.day) <= 1,
  ) ?? null;

function RoundResultPanel({
  year,
  syzygies,
  seasons,
  score,
  last,
  onNext,
}: {
  year: number;
  syzygies: Syzygy[];
  seasons: { startDay: number; endDay: number }[];
  score: EclipseScore;
  last: boolean;
  onNext: () => void;
}) {
  const details = useMemo(() => yearDetails(year, syzygies), [year, syzygies]);
  const falses = score.picks.filter((p) => !p.hit);
  const seasonText = seasons
    .map((s) => `${dayLabel(year, s.startDay)} ~ ${dayLabel(year, s.endDay)}`)
    .join(", ");

  return (
    <div className="bg-base-200/90 rounded-box fx-rise flex flex-col gap-3 p-4 text-sm backdrop-blur">
      <div className="flex flex-wrap items-end gap-3">
        <div className="text-4xl font-black text-amber-200">
          +<CountUp value={score.points} />
        </div>
        <div className="pb-1 opacity-70">/ {ROUND_MAX.toLocaleString()}</div>
        <div className="pb-1">
          식 {score.actual.length}번 중 <b>{score.hits}번</b> 맞힘
          {score.falses > 0 && ` · 없는 식 ${score.falses}번 (−절반씩)`}
        </div>
        <div className="grow" />
        <button className="btn btn-primary" onClick={onNext}>
          {last ? "결과 보기 ★" : "다음 해 →"}
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="font-bold">{year}년 실제 식 (NASA 목록)</div>
        {details.map((d) => (
          <DetailRow
            key={d.record.date}
            detail={d}
            hit={!score.missed.includes(d.record)}
          />
        ))}
      </div>

      {falses.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg bg-black/25 p-3">
          <div className="font-bold text-rose-300">식이 없었던 날</div>
          {falses.map((p) => {
            const s = syzygyNear(syzygies, p);

            return (
              <div key={`${p.kind}-${p.day}`}>
                ✕ {dayLabel(year, p.day)} {p.kind === "solar" ? "일식" : "월식"}{" "}
                —{" "}
                {s
                  ? `${s.kind === "new" ? "삭" : "망"}은 맞지만 달의 황위가 ${latText(s.moonLatDeg)}라 달이 ${
                      p.kind === "solar" ? "해" : "지구 그림자"
                    } ${s.moonLatDeg > 0 ? "위(북쪽)" : "아래(남쪽)"}로 비껴갔어요.${
                      chanceOf(s.moonLatDeg) === "maybe"
                        ? " 아슬아슬한 거리라 계산 오차 안쪽이에요."
                        : ""
                    }`
                  : `이날은 ${p.kind === "solar" ? "삭" : "망"}이 아니에요. ${
                      p.kind === "solar"
                        ? "일식은 달이 해 쪽에 있는 삭에만"
                        : "월식은 달이 해 반대쪽에 있는 망에만"
                    } 일어나요.`}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-1.5 rounded-lg bg-black/25 p-3 leading-relaxed">
        <div>
          <b>식 철</b> — 그래프의 보라색 띠는 해가 교점에서{" "}
          {SEASON_HALF_WIDTH_DEG}° 안에 있는 때예요: <b>{seasonText}</b>. {year}
          년의 식은 모두 이 안에 있어요. 이때는 삭·망 때 달이 해의 길 가까이에
          있어서 해와 달(또는 지구 그림자)이 겹쳐요.
        </div>
        <div>
          <b>황위로 가르기</b> — 삭·망 때 달의 황위가 ±{RULE.sure}° 안이면 거의
          틀림없이 식이 일어나요. ±{RULE.sure}~{RULE.maybe}°면 아슬아슬해서
          일식은 대개 부분일식, 월식은 지구의 옅은 그림자만 스치는 반영월식이
          되거나 아예 없어요. 그보다 멀면 식이 없어요.
        </div>
        <div className="text-xs opacity-60">{ACCURACY}</div>
      </div>
    </div>
  );
}

function DetailRow({ detail, hit }: { detail: EclipseDetail; hit: boolean }) {
  const { record, syzygy, where, korea } = detail;

  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline gap-x-2 rounded-lg px-3 py-1.5",
        hit ? "bg-emerald-400/10" : "bg-rose-400/10",
      )}
    >
      <span className={hit ? "text-emerald-300" : "text-rose-300"}>
        {hit ? "○ 맞힘" : "△ 놓침"}
      </span>
      <b>
        {record.kind === "solar" ? "☀️" : "🌕"} {isoLabel(record.date)}
      </b>
      <span>{typeLabel(record)}</span>
      {syzygy && (
        <span className="opacity-70">
          달의 황위 {latText(syzygy.moonLatDeg)}
        </span>
      )}
      {where && <span className="opacity-70">· {where}</span>}
      {korea && <span className="text-amber-200">· {korea}</span>}
    </div>
  );
}

function NextInKorea() {
  const list = useMemo(
    () => nextInKorea(new Date().toISOString().slice(0, 10), 5),
    [],
  );

  if (list.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 rounded-lg bg-black/25 p-3">
      <div className="font-bold">다음에 한국에서 볼 수 있는 식</div>
      {list.map((d) => (
        <div key={d.record.date}>
          {d.record.kind === "solar" ? "☀️" : "🌕"}{" "}
          <b>{isoLabel(d.record.date)}</b> {typeLabel(d.record)}
          {d.record.kind === "solar" && d.where && (
            <span className="opacity-70"> · 중심 경로: {d.where}</span>
          )}
        </div>
      ))}
      <div className="text-xs opacity-60">
        일식은 NASA 목록에서 한국에서 부분식으로 보이는 것만, 월식은 그 순간
        서울에서 달이 떠 있는지 계산했어요 (식이 길어 앞뒤 일부만 보일 수도
        있어요). {`목록은 2035년까지예요.`}
      </div>
    </div>
  );
}
