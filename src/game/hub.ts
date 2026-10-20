// 게임 허브("별 놀이터")에 보여 줄 게임 목록 (docs/game-plans.md)
export interface GameEntry {
  href: string;
  title: string;
  summary: string;
  learn: string; // 무엇을 배우나
  ready: boolean;
}

export const GAMES: GameEntry[] = [
  {
    href: "/games/sky-match",
    title: "하늘 맞추기",
    summary:
      "다이얼(위도·날짜·시각)을 돌려 내 하늘을 정답 사진에 겹쳐요. 같은 하늘이면 어떤 날짜든 정답!",
    learn: "위도는 하늘을 기울이고, 시각·날짜는 하늘을 돌린다",
    ready: true,
  },
  {
    href: "/games/find-constellation",
    title: "별자리 숨은그림찾기",
    summary:
      "밤하늘에서 제시한 별자리를 찾아 눌러요. 찾으면 선이 그려지고 이야기가 나와요.",
    learn: "별자리의 모양과 계절",
    ready: true,
  },
  {
    href: "/games/birthday",
    title: "생일 별자리",
    summary:
      "내 생일에 해가 실제로 어느 별자리에 있었는지, 점성술 별자리와 왜 다른지 천문도로 보여 줘요.",
    learn: "황도, 세차 운동, 13번째 별자리",
    ready: true,
  },
  {
    href: "/games/draw-constellation",
    title: "점 찍어 별자리 찾기",
    summary:
      "점을 하나씩 찍으면 지금까지의 모양과 가장 닮은 진짜 별자리를 알려 줘요.",
    learn: "모양은 크기·회전과 상관없다 (플레이트 솔버의 기하 해싱)",
    ready: true,
  },
  {
    href: "/games/light-time-capsule",
    title: "빛의 타임캡슐",
    summary:
      "별을 누르면 그 빛이 언제 출발했는지, 그때 지구에서는 무슨 일이 있었는지 알려 줘요.",
    learn: "광년, 연주 시차, 하늘은 서로 다른 과거의 모음",
    ready: true,
  },
  {
    href: "/plate-solver",
    title: "사람 계산원 vs 컴퓨터",
    summary:
      "사람이 별자리를 찾는 동안 컴퓨터는 1초 만에 풀어요. 컴퓨터가 어떻게 푸는지 단계별로 따라 해 봐요. (발표용, 준비 중)",
    learn: "플레이트 솔빙: 별 패턴 → 해시 → 데이터베이스 → 검증",
    ready: false,
  },
];
