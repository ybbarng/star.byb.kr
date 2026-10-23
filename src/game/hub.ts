// 게임 허브("별 놀이터")에 보여 줄 목록 (docs/game-plans.md).
// 점수를 겨루는 게임과, 게임은 아니지만 하늘을 만져 보며 둘러보는 것(둘러보기)을 나눠 보여 준다
export type GameKind = "game" | "explore";

export const KIND_LABELS: Record<GameKind, { title: string; note: string }> = {
  game: { title: "게임", note: "점수를 겨루며 하늘 읽는 법을 익혀요" },
  explore: {
    title: "둘러보기",
    note: "점수 없이 하늘을 만지고 돌려 보며 신기한 걸 찾아요",
  },
};

export interface GameEntry {
  href: string;
  kind: GameKind;
  title: string;
  summary: string;
  learn: string; // 무엇을 배우나
  ready: boolean;
  icon: string; // 카드 위 큰 기호
  accent: string; // 카드 테두리·빛 색 (tailwind 그라디언트)
}

export const GAMES: GameEntry[] = [
  {
    href: "/games/sky-guessr",
    kind: "game",
    title: "SkyGuessr",
    summary:
      "밤하늘을 360°로 둘러보고, 이 사진을 지구 어디서 찍었는지 세계 지도에 핀을 찍어요. 가까울수록 높은 점수!",
    learn:
      "위도는 천구의 극 높이, 경도는 하늘 시계와 세계 시계의 차이 (옛 항해사의 경도 문제)",
    ready: true,
    icon: "🌍",
    accent: "from-violet-400/40 to-sky-500/10",
  },
  {
    href: "/games/sky-match",
    kind: "game",
    title: "하늘 맞추기",
    summary:
      "다이얼(위도·날짜·시각)을 돌려 내 하늘을 정답 사진에 겹쳐요. 같은 하늘이면 어떤 날짜든 정답!",
    learn: "위도는 하늘을 기울이고, 시각·날짜는 하늘을 돌린다",
    ready: true,
    icon: "🧭",
    accent: "from-sky-400/40 to-indigo-500/10",
  },
  {
    href: "/games/find-constellation",
    kind: "game",
    title: "별자리 숨은그림찾기",
    summary:
      "밤하늘에서 제시한 별자리를 찾아 눌러요. 찾으면 선이 그려지고 이야기가 나와요.",
    learn: "별자리의 모양과 계절",
    ready: true,
    icon: "🔭",
    accent: "from-amber-300/40 to-orange-500/10",
  },
  {
    href: "/games/birthday",
    kind: "explore",
    title: "생일 별자리",
    summary:
      "내 생일에 해가 실제로 어느 별자리에 있었는지, 점성술 별자리와 왜 다른지 천문도로 보여 줘요.",
    learn: "황도, 세차 운동, 13번째 별자리",
    ready: true,
    icon: "🎂",
    accent: "from-pink-400/40 to-fuchsia-500/10",
  },
  {
    href: "/games/draw-constellation",
    kind: "game",
    title: "점 찍어 별자리 찾기",
    summary:
      "점을 하나씩 찍으면 지금까지의 모양과 가장 닮은 진짜 별자리를 알려 줘요.",
    learn: "모양은 크기·회전과 상관없다 (플레이트 솔버의 기하 해싱)",
    ready: true,
    icon: "✍️",
    accent: "from-emerald-300/40 to-teal-500/10",
  },
  {
    href: "/games/light-time-capsule",
    kind: "explore",
    title: "빛의 타임캡슐",
    summary:
      "별을 누르면 그 빛이 언제 출발했는지, 그때 지구에서는 무슨 일이 있었는지 알려 줘요.",
    learn: "광년, 연주 시차, 하늘은 서로 다른 과거의 모음",
    ready: true,
    icon: "⏳",
    accent: "from-cyan-300/40 to-blue-500/10",
  },
  {
    href: "/games/tonight",
    kind: "explore",
    title: "오늘 밤 내 하늘",
    summary:
      "장소와 날짜를 넣으면 그날 밤 볼 만한 것을 하늘 일기장처럼 정리해 줘요. 해·달·행성·별자리·유성우까지!",
    learn: "해 지는 시각과 박명, 달의 모양과 뜨는 시각, 행성 찾기",
    ready: true,
    icon: "🌙",
    accent: "from-yellow-200/40 to-indigo-500/10",
  },
  {
    href: "/games/human-vs-computer",
    kind: "game",
    title: "사람 계산원 vs 컴퓨터",
    summary:
      "사진 속 별자리를 누가 먼저 찾을까요? 나는 눈으로, 컴퓨터는 플레이트 솔버로. 마지막 판에는 반전이 있어요!",
    learn: "플레이트 솔빙: 별 찾기 → 모양 맞추기 → 확인, 그리고 사람의 단서",
    ready: true,
    icon: "🤖",
    accent: "from-rose-300/40 to-slate-500/10",
  },
  {
    href: "/games/shadow-clock",
    kind: "game",
    title: "그림자 시계",
    summary:
      "땅에 세운 막대와 그림자만 보고 여기가 어디(위도)인지, 언제(계절·시각)인지 맞혀요.",
    learn: "정오 그림자 길이 → 해 높이 → 위도, 그림자 방향 → 시각 (해시계)",
    ready: true,
    icon: "☀️",
    accent: "from-yellow-300/40 to-amber-600/10",
  },
  {
    href: "/games/eratosthenes",
    kind: "explore",
    title: "에라토스테네스 되어 보기",
    summary:
      "같은 날 정오, 두 도시의 막대 그림자 각도를 직접 재서 지구 둘레를 구해 봐요.",
    learn: "평행한 햇빛, 그림자 각도 차이 = 지구 중심각, 비례식으로 둘레",
    ready: true,
    icon: "📐",
    accent: "from-lime-300/40 to-emerald-600/10",
  },
  {
    href: "/games/quad-fingerprint",
    kind: "game",
    title: "별 넷 지문 맞추기",
    summary:
      "컴퓨터는 별 네 개의 모양을 숫자 넷(지문)으로 기억해요. 지문을 보고 모양을 고르고, 모양을 보고 지문을 찍어요.",
    learn:
      "가장 먼 두 별을 축으로 잡은 나머지 두 별의 좌표 (플레이트 솔버의 quad 지문)",
    ready: true,
    icon: "🔍",
    accent: "from-yellow-200/40 to-indigo-500/10",
  },
];

// 게임 페이지의 제목·설명 (공유 미리보기·브라우저 탭)
export const gameMetadata = (href: string) => {
  const game = GAMES.find((g) => g.href === href);

  return game ? { title: game.title, description: game.summary } : {};
};
