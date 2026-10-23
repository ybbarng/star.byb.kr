// 카드 연습의 복습 일정: 라이트너 상자 다섯 칸. 맞히면 다음 칸으로 가서 더 오래 뒤에 다시 나오고,
// 틀리면 첫 칸으로 돌아와 오늘 다시 나온다. 날짜는 "몇째 날"(1970-01-01부터 센 그 지역의 날짜)로 센다.

export const BOX_COUNT = 5;
// 칸마다 다음 복습까지 며칠 (1칸: 오늘 다시, 2칸: 하루 뒤 …)
export const BOX_DAYS = [0, 1, 3, 7, 16];

export interface CardState {
  box: number; // 1~5
  due: number; // 다시 낼 날 (몇째 날)
  right: number;
  misses: number;
  missedLast: boolean; // 마지막에 틀렸나 (다시 맞히면 복수 성공)
}

export const dayNumber = (date: Date) =>
  Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000,
  );

export const newCard = (today: number): CardState => ({
  box: 1,
  due: today,
  right: 0,
  misses: 0,
  missedLast: false,
});

export const review = (
  card: CardState | undefined,
  correct: boolean,
  today: number,
): CardState => {
  const c = card ?? newCard(today);

  if (!correct) {
    return {
      ...c,
      box: 1,
      due: today,
      misses: c.misses + 1,
      missedLast: true,
    };
  }

  const box = Math.min(BOX_COUNT, c.box + 1);

  return {
    ...c,
    box,
    due: today + BOX_DAYS[box - 1],
    right: c.right + 1,
    missedLast: false,
  };
};

export const isDue = (card: CardState | undefined, today: number) =>
  !card || card.due <= today;

// 오늘 낼 카드: 날짜가 된 카드(낮은 칸, 오래 밀린 것 먼저) → 아직 안 본 카드(목록 순서) → 모자라면 곧 올 카드
export const pickCards = (
  ids: string[],
  cards: Record<string, CardState | undefined>,
  today: number,
  count: number,
): string[] => {
  const seen = ids.filter((id) => cards[id]);
  const due = seen
    .filter((id) => isDue(cards[id], today))
    .sort(
      (a, b) => cards[a]!.box - cards[b]!.box || cards[a]!.due - cards[b]!.due,
    );
  const fresh = ids.filter((id) => !cards[id]);
  const later = seen
    .filter((id) => !isDue(cards[id], today))
    .sort((a, b) => cards[a]!.due - cards[b]!.due);

  return [...due, ...fresh, ...later].slice(0, count);
};

// 선 보이기: 처음엔 선을 다 보이고, 익숙해지면 흐리게, 잘 알면 별만
export type LineLevel = "lines" | "faint" | "stars";

export const lineLevel = (card: CardState | undefined): LineLevel => {
  const box = card?.box ?? 1;

  return box <= 2 ? "lines" : box === 3 ? "faint" : "stars";
};

// 복수전: 틀린 적 있고 아직 낮은 칸에 있는 카드
export const revengeIds = (cards: Record<string, CardState | undefined>) =>
  Object.entries(cards)
    .filter(([, c]) => c && c.misses > 0 && (c.missedLast || c.box <= 2))
    .sort((a, b) => b[1]!.misses - a[1]!.misses)
    .map(([id]) => id);
