"use client";

import type { DrawGrade } from "@/game/starSchool/DrawExercise";
import type { Deck, CardQuestion } from "@/game/starSchool/quiz";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChoiceCards,
  Confetti,
  CountUp,
  FxLayer,
  useFx,
  useShake,
} from "@/game/fx/Fx";
import { sfx } from "@/game/fx/sound";
import { dexEntry } from "@/game/starSchool/dex";
import { figureOf } from "@/game/starSchool/DexBook";
import DrawExercise from "@/game/starSchool/DrawExercise";
import { dayNumber, pickCards, revengeIds } from "@/game/starSchool/leitner";
import {
  answerCard,
  loadSave,
  saveBestRecord,
  writeSave,
} from "@/game/starSchool/progress";
import { cardQuestion, DECKS, deckIds } from "@/game/starSchool/quiz";
import ShapeFigure from "@/game/starSchool/ShapeFigure";
import { josa } from "@/game/starSchool/skyMath";
import { useSave } from "@/game/starSchool/useSave";
import { cn } from "@/utils/cn";
import { createRng } from "@/utils/rng";

// 카드 연습: 모양 ↔ 이름, 점 잇기. 라이트너 상자로 오늘 복습할 카드를 고르고, 익숙해질수록 선이 흐려진다.
// 도전: 60초 시간 도전, 88개 보스전(목숨 셋), 틀렸던 카드 복수전 (다시 맞히면 별빛을 더 받는다).

type Mode = "review" | "time" | "boss" | "revenge";

const MODES: { value: Mode; title: string; note: string }[] = [
  { value: "review", title: "오늘의 복습", note: "10장 · 상자 순서대로" },
  { value: "time", title: "60초 도전", note: "몇 장 맞힐까" },
  { value: "boss", title: "88 보스전", note: "목숨 셋, 88개 전부" },
  { value: "revenge", title: "복수전", note: "틀렸던 카드만, 별빛 2.5배" },
];

const SESSION = 10;
const TIME_LIMIT = 60;
const BOSS_LIVES = 3;

const ALL_CARDS = [...deckIds("all"), ...deckIds("asterisms")];

const nameOf = (id: string) =>
  (dexEntry(id)?.name ?? id).replace(/ \(.*\)$/, "");

export default function CardPractice() {
  const save = useSave();
  const [mode, setMode] = useState<Mode>("review");
  const [deck, setDeck] = useState<Deck>("famous");
  const [phase, setPhase] = useState<"menu" | "play" | "over">("menu");
  const [queue, setQueue] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [question, setQuestion] = useState<CardQuestion | null>(null);
  const [answered, setAnswered] = useState<{
    correct: boolean;
    picked?: string;
  } | null>(null);
  const [stats, setStats] = useState({ right: 0, wrong: 0, xp: 0, revenge: 0 });
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(BOSS_LIVES);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [record, setRecord] = useState<{
    isNew: boolean;
    value: number;
  } | null>(null);
  const [fire, setFire] = useState(0);
  const fx = useFx();
  const { ref: shakeRef, shake } = useShake();
  const requeued = useRef(new Set<string>());
  // 새 판을 시작하면 지난 판의 "다음 장" 예약을 무시한다
  const session = useRef(0);
  const rng = useRef(createRng(Date.now() % 2147483647));
  const revengeCount = useMemo(
    () => revengeIds(save.cards).length,
    [save.cards],
  );

  // 홈의 "도전" 링크 (#time, #boss, #revenge)
  useEffect(() => {
    const h = window.location.hash.slice(1);

    if (h === "time" || h === "boss" || h === "revenge") setMode(h);
  }, []);

  const pool = useMemo(
    () => deckIds(mode === "boss" ? "all" : deck),
    [mode, deck],
  );

  const makeQuestion = (id: string, ids: string[]) => {
    const card = loadSave().cards[id];
    // 시간 도전·보스전은 빠르게 모양 → 이름만
    const known = card?.box ?? 1;
    const box =
      mode === "time" || mode === "boss" ? (known >= 3 ? 3 : 1) : known;
    const q = cardQuestion(id, box, ids, rng.current);

    return mode === "time" || mode === "boss"
      ? q.kind === "shapeToName"
        ? q
        : cardQuestion(id, 1, ids, rng.current)
      : q;
  };

  const start = () => {
    const today = dayNumber(new Date());
    const cards = loadSave().cards;
    const ids =
      mode === "review"
        ? pickCards(pool, cards, today, SESSION)
        : mode === "revenge"
          ? revengeIds(cards).slice(0, SESSION)
          : [...pool]
              .map((id) => ({ id, k: rng.current() }))
              .sort((a, b) => a.k - b.k)
              .map((x) => x.id);

    if (!ids.length) return;

    sfx.whoosh();
    session.current += 1;
    requeued.current = new Set();
    setQueue(ids);
    setIndex(0);
    setQuestion(makeQuestion(ids[0], mode === "revenge" ? ALL_CARDS : pool));
    setAnswered(null);
    setStats({ right: 0, wrong: 0, xp: 0, revenge: 0 });
    setCombo(0);
    setLives(BOSS_LIVES);
    setTimeLeft(TIME_LIMIT);
    setRecord(null);
    setPhase("play");
  };

  // 60초 도전 시계
  useEffect(() => {
    if (phase !== "play" || mode !== "time") return;

    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          setPhase("over");

          return 0;
        }

        if (s <= 6) sfx.tick();

        return s - 1;
      });
    }, 1000);

    return () => clearInterval(t);
  }, [phase, mode]);

  // 끝나면 최고 기록
  useEffect(() => {
    if (phase !== "over") return;

    if (mode === "time" || mode === "boss") {
      const key = mode === "time" ? "timeAttack" : "boss";
      const r = saveBestRecord(loadSave(), key, stats.right);
      writeSave(r.save);
      setRecord({
        isNew: r.isNew && stats.right > 0,
        value: r.save.best[key] ?? 0,
      });
    }

    if (stats.right >= Math.max(3, stats.wrong * 2)) {
      sfx.win();
      setFire(Date.now());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const answer = (correct: boolean, picked?: string) => {
    if (!question || answered) return;

    const nextCombo = correct ? combo + 1 : 0;
    const result = answerCard(
      loadSave(),
      question.id,
      correct,
      dayNumber(new Date()),
      nextCombo,
    );
    writeSave(result.save);
    setCombo(nextCombo);
    setAnswered({ correct, picked });
    setStats((s) => ({
      right: s.right + (correct ? 1 : 0),
      wrong: s.wrong + (correct ? 0 : 1),
      xp: s.xp + result.gained,
      revenge: s.revenge + (result.revenge ? 1 : 0),
    }));

    if (correct) {
      sfx.hit();
      fx.popup(
        0.5,
        0.3,
        result.revenge ? `복수 성공! +${result.gained}` : `+${result.gained}`,
        result.revenge ? "#ff9ad5" : "#ffe27a",
      );
      fx.burst(0.5, 0.35, result.revenge ? "#ff9ad5" : "#ffe27a");
    } else {
      sfx.miss();
      shake();

      if (mode === "boss") setLives((l) => l - 1);

      // 오늘의 복습에서 틀린 카드는 끝에 한 번 더
      if (mode === "review" && !requeued.current.has(question.id)) {
        requeued.current.add(question.id);
        setQueue((q) => [...q, question.id]);
      }
    }

    // 시간 도전은 바로 다음 장
    if (mode === "time") {
      const s = session.current;
      setTimeout(
        () => s === session.current && next(correct),
        correct ? 350 : 900,
      );
    }
  };

  const next = (lastCorrect?: boolean) => {
    const nextIndex = index + 1;
    const out =
      (mode === "boss" && lastCorrect === false && lives <= 0) ||
      (mode !== "time" && nextIndex >= queue.length);

    if (out) {
      setPhase("over");

      return;
    }

    const i = nextIndex % queue.length;
    setIndex(nextIndex);
    setQuestion(makeQuestion(queue[i], mode === "revenge" ? ALL_CARDS : pool));
    setAnswered(null);
  };

  if (phase === "menu") {
    const today = dayNumber(new Date());
    const due = pickCards(pool, save.cards, today, 999).filter(
      (id) => !save.cards[id] || save.cards[id].due <= today,
    ).length;

    return (
      <div className="fx-rise mx-auto flex w-full max-w-xl flex-col gap-4">
        <p className="text-sm opacity-80">
          모양을 보고 이름을, 이름을 보고 모양을 골라요. 맞힌 카드는 상자 다음
          칸으로 가서 며칠 뒤 다시 나오고, 틀린 카드는 첫 칸으로 돌아와요.
          익숙해질수록 선이 흐려지다가 별만 남고, 끝에는 직접 선을 이어요.
        </p>
        <ChoiceCards
          options={MODES}
          value={mode}
          onChange={setMode}
          label="연습 방법"
        />
        {mode !== "boss" && mode !== "revenge" && (
          <ChoiceCards
            options={DECKS}
            value={deck}
            onChange={setDeck}
            label="카드 묶음"
          />
        )}
        <div className="bg-base-200/60 rounded-box p-3 text-sm">
          {mode === "review" &&
            `오늘 복습할 카드 ${Math.min(SESSION, due)}장 (새 카드와 날짜가 된 카드 ${due}장)`}
          {mode === "time" &&
            `60초 동안 모양 → 이름. 최고 기록 ${save.best.timeAttack ?? 0}장`}
          {mode === "boss" &&
            `별자리 88개를 섞어 하나씩. 세 번 틀리면 끝. 최고 기록 ${save.best.boss ?? 0}개`}
          {mode === "revenge" &&
            (revengeCount
              ? `틀렸던 카드 ${revengeCount}장이 기다려요. 다시 맞히면 별빛 ${25}!`
              : "아직 틀린 카드가 없어요. 별자리 숨은그림찾기에서 놓친 별자리도 여기로 와요.")}
        </div>
        <button
          className="btn btn-primary btn-lg"
          disabled={mode === "revenge" && !revengeCount}
          onClick={start}
        >
          시작
        </button>
      </div>
    );
  }

  if (phase === "over") {
    return (
      <div className="bg-base-200/80 rounded-box fx-rise mx-auto flex w-full max-w-xl flex-col items-center gap-3 p-6 text-center">
        <Confetti fire={fire} />
        <h2 className="text-2xl font-bold">
          {mode === "time"
            ? "시간 끝!"
            : mode === "boss"
              ? "보스전 끝"
              : "연습 끝"}
        </h2>
        <div className="text-5xl font-black text-amber-200">
          <CountUp value={stats.right} />
          <span className="ml-1 text-xl">장 맞힘</span>
        </div>
        <div className="text-sm opacity-80">
          틀린 카드 {stats.wrong}장 · 별빛 +{stats.xp}
          {stats.revenge > 0 && ` · 복수 성공 ${stats.revenge}장`}
        </div>
        {record && (
          <div
            className={cn(
              "badge p-3",
              record.isNew ? "badge-warning fx-pop" : "badge-ghost",
            )}
          >
            {record.isNew ? "새 최고 기록!" : `최고 기록 ${record.value}`}
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn btn-primary" onClick={start}>
            한 번 더
          </button>
          <button className="btn" onClick={() => setPhase("menu")}>
            다른 연습
          </button>
        </div>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div
      ref={shakeRef}
      className="relative mx-auto flex w-full max-w-xl flex-col gap-3"
    >
      <FxLayer fx={fx} />
      <div className="flex items-center justify-between text-sm">
        <span>
          {mode === "time"
            ? `⏱ ${timeLeft}초`
            : mode === "boss"
              ? `${"❤️".repeat(lives)}${"🖤".repeat(BOSS_LIVES - lives)} · ${index + 1} / ${queue.length}`
              : `${index + 1} / ${queue.length}`}
        </span>
        <span
          className={cn(combo >= 2 && "fx-pop font-bold text-amber-300")}
          key={combo}
        >
          {combo >= 2 ? `🔥 ${combo}연속` : ""}
        </span>
        <span className="text-amber-200">✦ +{stats.xp}</span>
      </div>
      <QuestionView
        key={`${index}-${question.id}`}
        q={question}
        answered={answered}
        onAnswer={answer}
      />
      {answered && mode !== "time" && (
        <div
          className={cn(
            "fx-rise rounded-lg p-3 text-sm",
            answered.correct ? "bg-emerald-400/15" : "bg-red-400/15",
          )}
        >
          <div className="font-bold">
            {answered.correct
              ? "맞아요!"
              : `아쉬워요. 정답은 ${nameOf(question.id)}`}
          </div>
          <div className="opacity-80">
            {dexEntry(question.id)?.howTo ?? dexEntry(question.id)?.story}
          </div>
          <button
            className="btn btn-sm btn-primary mt-2"
            onClick={() => next(answered.correct)}
          >
            다음 →
          </button>
        </div>
      )}
    </div>
  );
}

function QuestionView({
  q,
  answered,
  onAnswer,
}: {
  q: CardQuestion;
  answered: { correct: boolean; picked?: string } | null;
  onAnswer: (correct: boolean, picked?: string) => void;
}) {
  const entry = dexEntry(q.id)!;

  if (q.kind === "draw") {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-center text-lg">
          <b>{entry.name}</b>의 선을 직접 이어 보세요
        </div>
        <DrawExercise
          figure={figureOf(entry)}
          onDone={(g: DrawGrade) => onAnswer(g.pass)}
        />
      </div>
    );
  }

  if (q.kind === "shapeToName") {
    return (
      <div className="flex flex-col gap-3">
        <div className="text-center">이 모양은 무엇일까요?</div>
        <div className="mx-auto w-full max-w-80">
          <ShapeFigure
            figure={figureOf(entry)}
            look={answered ? "lines" : q.level}
            names={!!answered}
          />
          <div className="mt-1 text-center text-[11px] opacity-50">
            {q.level === "lines"
              ? "선을 보고"
              : q.level === "faint"
                ? "흐린 선을 보고"
                : "별만 보고"}{" "}
            · 위가 북쪽
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {q.choices.map((c) => (
            <button
              key={c}
              className={cn(
                "btn h-auto min-h-12 py-2 whitespace-normal",
                answered && c === q.id && "btn-success",
                answered && answered.picked === c && c !== q.id && "btn-error",
              )}
              // disabled로 막으면 회색이 정답·오답 색을 덮어서, 누르기만 막는다
              aria-disabled={!!answered}
              onClick={() => !answered && onAnswer(c === q.id, c)}
            >
              {nameOf(c)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-center text-lg">
        <b>{entry.name}</b>
        {josa(entry.name.replace(/ \(.*\)$/, ""), "은", "는").slice(-1)} 어느
        모양일까요?
      </div>
      <div className="grid grid-cols-2 gap-2">
        {q.choices.map((c) => {
          const e = dexEntry(c)!;

          return (
            <button
              key={c}
              className={cn(
                "rounded-box border-2 p-1 transition",
                !answered && "border-transparent hover:border-amber-300/60",
                answered && c === q.id && "border-emerald-400",
                answered &&
                  answered.picked === c &&
                  c !== q.id &&
                  "border-red-400",
                answered &&
                  c !== q.id &&
                  answered.picked !== c &&
                  "border-transparent opacity-60",
              )}
              disabled={!!answered}
              onClick={() => onAnswer(c === q.id, c)}
            >
              <ShapeFigure
                figure={figureOf(e)}
                look={answered ? "lines" : q.level}
                field={false}
              />
              {answered && <div className="text-xs">{nameOf(c)}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
