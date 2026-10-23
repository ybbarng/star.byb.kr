import type { FindTarget } from "@/game/findConstellation/targets";
import type { Difficulty } from "@/game/sky/scene";

// 최근에 낸 별자리를 덜 내기: 난이도마다 따로, 이 브라우저(localStorage)에만 기억한다.
// 기억이 막혀 있어도(사생활 보호 창 등) 게임은 그냥 무작위 순서로 돈다.

const RECENT_PREFIX = "star-games-find-recent-";

// 낼 순서: 최근에 안 낸 것들을 무작위로 먼저, 그다음 최근에 낸 것은 오래전에 낸 것부터.
// recent는 최근에 낸 순서(맨 앞이 가장 최근)인 이름 목록이다.
export const orderTargets = (
  pool: FindTarget[],
  recent: string[],
  rng: () => number,
): FindTarget[] => {
  const shuffled = pool
    .map((t) => ({ t, k: rng() }))
    .sort((a, b) => a.k - b.k)
    .map(({ t }) => t);
  const fresh = shuffled.filter((t) => !recent.includes(t.label));
  const seen = shuffled
    .filter((t) => recent.includes(t.label))
    .sort((a, b) => recent.indexOf(b.label) - recent.indexOf(a.label));

  return [...fresh, ...seen];
};

// 방금 낸 별자리를 맨 앞에 두고, 낼 수 있는 별자리 수만큼만 기억한다
export const pushRecent = (
  recent: string[],
  label: string,
  limit: number,
): string[] => [label, ...recent.filter((l) => l !== label)].slice(0, limit);

export const readRecent = (difficulty: Difficulty): string[] => {
  try {
    const v = JSON.parse(
      localStorage.getItem(RECENT_PREFIX + difficulty) ?? "[]",
    );

    return Array.isArray(v)
      ? v.filter((l): l is string => typeof l === "string")
      : [];
  } catch {
    return [];
  }
};

export const rememberTarget = (
  difficulty: Difficulty,
  label: string,
  limit: number,
) => {
  try {
    localStorage.setItem(
      RECENT_PREFIX + difficulty,
      JSON.stringify(pushRecent(readRecent(difficulty), label, limit)),
    );
  } catch {
    // 저장이 막혀 있으면 기억만 못 한다
  }
};
