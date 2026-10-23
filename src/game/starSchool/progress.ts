import type { CardState } from "@/game/starSchool/leitner";
import { review } from "@/game/starSchool/leitner";

// 별자리 익히기의 기록: 별빛 경험치, 카드 상자, 도감에서 연 항목, 마친 수업, 오늘의 문제, 최고 기록.
// 이 브라우저(localStorage)에만 남긴다. 저장이 막혀 있어도(사생활 보호 창 등) 이번 방문 동안은 메모리로 돈다.

export const SAVE_KEY = "star-games-star-school";

export interface SchoolSave {
  v: 1;
  xp: number;
  cards: Record<string, CardState>;
  learned: string[]; // 도감에서 열린 항목 id
  lessons: Record<string, { done: boolean; quiz: number }>; // 수업 id → 마쳤나, 퀴즈 최고 맞힌 수
  daily: Record<string, boolean>; // "2026-10-23" → 맞혔나
  best: { timeAttack?: number; boss?: number; relations?: number };
  comboBest: number;
}

export const emptySave = (): SchoolSave => ({
  v: 1,
  xp: 0,
  cards: {},
  learned: [],
  lessons: {},
  daily: {},
  best: {},
  comboBest: 0,
});

// ── 별지기 등급 ────────────────────────────────────────────────

export interface Rank {
  title: string;
  icon: string;
  minXp: number;
  note: string;
}

export const RANKS: Rank[] = [
  {
    title: "맨눈 별지기",
    icon: "👀",
    minXp: 0,
    note: "밝은 별자리부터 하나씩",
  },
  {
    title: "쌍안경 별지기",
    icon: "🔍",
    minXp: 400,
    note: "길잡이 모양으로 길을 찾아요",
  },
  {
    title: "망원경 별지기",
    icon: "🔭",
    minXp: 1500,
    note: "어두운 별자리와 딥스카이까지",
  },
  {
    title: "천문대 별지기",
    icon: "🌌",
    minXp: 4000,
    note: "남쪽 하늘까지 온 하늘이 내 지도",
  },
];

export const rankOf = (xp: number) => {
  let i = 0;

  RANKS.forEach((r, k) => {
    if (xp >= r.minXp) i = k;
  });

  const next = RANKS[i + 1] ?? null;

  return {
    rank: RANKS[i],
    index: i,
    next,
    // 다음 등급까지 몇 % 왔나
    progress: next ? (xp - RANKS[i].minXp) / (next.minXp - RANKS[i].minXp) : 1,
  };
};

// ── 경험치 규칙: 점수는 배움을 따라간다 ───────────────────────────

export const XP = {
  correct: 10, // 카드 하나 맞힘
  revenge: 25, // 전에 틀린 카드를 다시 맞힘 (복수 성공)
  firstLearn: 5, // 도감에서 처음 열림
  lessonFirst: 120, // 수업 처음 마침
  lessonAgain: 20,
  quizCorrect: 10,
  relation: 15, // 관계 맞히기 한 문제
  daily: 50, // 오늘의 하늘 문제
};

// 연달아 맞히면 10%씩 더 (최대 두 배)
export const comboMultiplier = (combo: number) =>
  Math.min(2, 1 + 0.1 * Math.max(0, combo - 1));

export const cardXp = (before: CardState | undefined, combo: number) =>
  Math.round(
    (before?.missedLast ? XP.revenge : XP.correct) * comboMultiplier(combo),
  );

// ── 기록 바꾸기 (순수 함수) ─────────────────────────────────────

export const learn = (s: SchoolSave, ids: string[]): SchoolSave => {
  const fresh = ids.filter((id) => !s.learned.includes(id));

  return fresh.length
    ? {
        ...s,
        learned: [...s.learned, ...fresh],
        xp: s.xp + XP.firstLearn * fresh.length,
      }
    : s;
};

// 카드 하나에 답한 결과. 맞히면 도감에도 열린다
export const answerCard = (
  s: SchoolSave,
  id: string,
  correct: boolean,
  today: number,
  combo: number,
): { save: SchoolSave; gained: number; revenge: boolean } => {
  const before = s.cards[id];
  const gained = correct ? cardXp(before, combo) : 0;
  const next: SchoolSave = {
    ...s,
    xp: s.xp + gained,
    cards: { ...s.cards, [id]: review(before, correct, today) },
    comboBest: Math.max(s.comboBest, correct ? combo : 0),
  };

  return {
    save: correct ? learn(next, [id]) : next,
    gained,
    revenge: correct && !!before?.missedLast,
  };
};

// 다른 게임(숨은그림찾기 등)에서 놓친 것을 복습 목록에 넣는다
export const markMissed = (
  s: SchoolSave,
  id: string,
  today: number,
): SchoolSave => ({
  ...s,
  cards: { ...s.cards, [id]: review(s.cards[id], false, today) },
});

export const finishLesson = (
  s: SchoolSave,
  lessonId: string,
  quizCorrect: number,
  learnedIds: string[],
): { save: SchoolSave; gained: number } => {
  const before = s.lessons[lessonId];
  const gained =
    (before?.done ? XP.lessonAgain : XP.lessonFirst) +
    quizCorrect * XP.quizCorrect;
  const next = learn(
    {
      ...s,
      xp: s.xp + gained,
      lessons: {
        ...s.lessons,
        [lessonId]: {
          done: true,
          quiz: Math.max(before?.quiz ?? 0, quizCorrect),
        },
      },
    },
    learnedIds,
  );

  return { save: next, gained };
};

export const answerDaily = (
  s: SchoolSave,
  dateKey: string,
  correct: boolean,
): { save: SchoolSave; gained: number } => {
  if (dateKey in s.daily) {
    return { save: s, gained: 0 };
  }

  const gained = correct ? XP.daily : Math.round(XP.daily / 5);

  return {
    save: {
      ...s,
      xp: s.xp + gained,
      daily: { ...s.daily, [dateKey]: correct },
    },
    gained,
  };
};

export const addXp = (s: SchoolSave, xp: number): SchoolSave => ({
  ...s,
  xp: s.xp + xp,
});

export const saveBestRecord = (
  s: SchoolSave,
  key: keyof SchoolSave["best"],
  value: number,
): { save: SchoolSave; isNew: boolean } => {
  const old = s.best[key];

  return old !== undefined && old >= value
    ? { save: s, isNew: false }
    : { save: { ...s, best: { ...s.best, [key]: value } }, isNew: true };
};

// 오늘의 문제 열쇠 (그 지역 날짜)
export const dateKeyOf = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// 연속으로 오늘의 문제를 푼 날 수 (오늘 또는 어제에서 끝나는)
export const dailyStreak = (daily: Record<string, boolean>, today: Date) => {
  let n = 0;
  const d = new Date(today);

  if (!(dateKeyOf(d) in daily)) {
    d.setDate(d.getDate() - 1);
  }

  while (dateKeyOf(d) in daily) {
    n++;
    d.setDate(d.getDate() - 1);
  }

  return n;
};

// ── 저장 (브라우저) ─────────────────────────────────────────────

const parse = (text: string | null): SchoolSave => {
  if (!text) return emptySave();

  try {
    const v = JSON.parse(text);

    if (v && v.v === 1 && typeof v.xp === "number") {
      return { ...emptySave(), ...v };
    }
  } catch {
    // 깨진 기록은 버린다
  }

  return emptySave();
};

let memory: SchoolSave | null = null;
const listeners = new Set<() => void>();

export const loadSave = (): SchoolSave => {
  if (memory) return memory;

  try {
    memory = parse(localStorage.getItem(SAVE_KEY));
  } catch {
    memory = emptySave();
  }

  return memory;
};

export const writeSave = (s: SchoolSave) => {
  memory = s;

  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    // 저장이 막혀 있으면 이번 방문 동안만 기억한다
  }

  listeners.forEach((l) => l());
};

export const updateSave = (f: (s: SchoolSave) => SchoolSave) =>
  writeSave(f(loadSave()));

export const subscribeSave = (l: () => void) => {
  listeners.add(l);

  return () => {
    listeners.delete(l);
  };
};

const EMPTY = emptySave();
export const serverSave = () => EMPTY;
