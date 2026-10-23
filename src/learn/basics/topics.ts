// "하늘 읽기 기초" 페이지들의 목차. 찾는 원리(steps.ts)와 나란한 두 번째 갈래다.
// 각 페이지가 사이트의 어디와 이어지는지 표시(mark)를 단다:
//   solver     🔭 플레이트 솔버가 쓰는 개념
//   games      🌍 놀이터에서 쓰는 개념
//   background ✨ 배경 지식
export type BasicsMark = "solver" | "games" | "background";

export const MARKS: Record<
  BasicsMark,
  { icon: string; label: string; tone: string }
> = {
  solver: {
    icon: "🔭",
    label: "플레이트 솔버가 쓰는 개념",
    tone: "border-indigo-300/50 bg-indigo-300/10 text-indigo-100",
  },
  games: {
    icon: "🌍",
    label: "놀이터에서 쓰는 개념",
    tone: "border-emerald-300/50 bg-emerald-300/10 text-emerald-100",
  },
  background: {
    icon: "✨",
    label: "배경 지식",
    tone: "border-amber-300/50 bg-amber-300/10 text-amber-100",
  },
};

export interface BasicsLink {
  mark: Exclude<BasicsMark, "background">;
  label: string;
  href: string;
}

export interface BasicsTopic {
  slug: string;
  icon: string;
  title: string;
  summary: string;
  marks: BasicsMark[];
  links: BasicsLink[]; // 이 개념을 쓰는 곳
}

export const BASICS_TOPICS: BasicsTopic[] = [
  {
    slug: "earth-coords",
    icon: "🌐",
    title: "지구 위의 좌표",
    summary:
      "위도와 경도: 적도에서 몇 도 올라왔나, 그리니치에서 몇 도 돌아왔나.",
    marks: ["solver", "games"],
    links: [
      {
        mark: "solver",
        label: "어디서 찍었을까? (사진으로 찾기의 결과 카드)",
        href: "/plate-solver",
      },
      {
        mark: "solver",
        label: "시각·장소·지평선으로 풀기",
        href: "/learn/hard-photos#horizon-solve",
      },
      { mark: "games", label: "SkyGuessr", href: "/games/sky-guessr" },
      {
        mark: "games",
        label: "극지방·적도 하늘 여행",
        href: "/games/latitude-trip",
      },
      {
        mark: "games",
        label: "에라토스테네스 되어 보기",
        href: "/games/eratosthenes",
      },
    ],
  },
  {
    slug: "sky-coords",
    icon: "🧭",
    title: "하늘의 좌표",
    summary:
      "별마다 정해진 주소(적경·적위)와, 지금 여기서 보이는 자리(고도·방위). 둘을 잇는 것이 항성시예요.",
    marks: ["solver", "games"],
    links: [
      {
        mark: "solver",
        label: "별 지도 준비: 별의 위치를 화살표로",
        href: "/learn/star-map",
      },
      {
        mark: "solver",
        label: "찍은 시각을 거꾸로 찾기 (천정의 적경 = 항성시)",
        href: "/learn/hard-photos#shot-time",
      },
      { mark: "games", label: "어느 쪽을 찍었을까", href: "/games/which-way" },
      { mark: "games", label: "하늘 맞추기", href: "/games/sky-match" },
      { mark: "games", label: "오늘 밤 내 하늘", href: "/games/tonight" },
      {
        mark: "games",
        label: "극지방·적도 하늘 여행",
        href: "/games/latitude-trip",
      },
      { mark: "games", label: "별 궤적 풀기", href: "/games/star-trails" },
      {
        mark: "games",
        label: "나만의 별자리 (언제 어디 뜨나)",
        href: "/games/my-constellation",
      },
    ],
  },
  {
    slug: "sidereal-day",
    icon: "⏱",
    title: "하루는 왜 4분씩 어긋날까",
    summary:
      "별 기준 하루는 23시간 56분 4초. 그래서 별은 매일 4분 일찍 뜨고, 계절마다 다른 별자리가 보여요.",
    marks: ["solver", "games"],
    links: [
      {
        mark: "solver",
        label: "찍은 시각을 거꾸로 찾기 (날짜마다 시각)",
        href: "/learn/hard-photos#shot-time",
      },
      { mark: "games", label: "하늘 맞추기", href: "/games/sky-match" },
      { mark: "games", label: "별 궤적 풀기", href: "/games/star-trails" },
      {
        mark: "games",
        label: "별자리 숨은그림찾기",
        href: "/games/find-constellation",
      },
      {
        mark: "games",
        label: "달로 날짜 맞히기 (달도 27.3일과 29.5일)",
        href: "/games/moon-date",
      },
    ],
  },
  {
    slug: "earth-tilt",
    icon: "🌗",
    title: "지구의 기울기 23.4°",
    summary:
      "해가 지나는 길(황도)이 적도와 23.4° 기울어 계절이 생기고, 그 축이 2만 6천 년에 한 바퀴 돌아요.",
    marks: ["solver", "games", "background"],
    links: [
      {
        mark: "solver",
        label: "해·달·행성 그리기",
        href: "/learn/hard-photos#sun-moon",
      },
      { mark: "games", label: "그림자 시계", href: "/games/shadow-clock" },
      { mark: "games", label: "생일 별자리", href: "/games/birthday" },
      { mark: "games", label: "세차운동 타임머신", href: "/games/precession" },
      { mark: "games", label: "식 예측하기", href: "/games/eclipse" },
      { mark: "games", label: "떠돌이별 찾기", href: "/games/wanderers" },
      { mark: "games", label: "달로 날짜 맞히기", href: "/games/moon-date" },
      {
        mark: "games",
        label: "에라토스테네스 되어 보기 (회귀선)",
        href: "/games/eratosthenes",
      },
      {
        mark: "games",
        label: "별자리 익히기: 해의 길, 황도 별자리 13개",
        href: "/games/star-school/lessons",
      },
    ],
  },
  {
    slug: "star-hopping",
    icon: "✋",
    title: "손으로 재고, 별을 건너뛰기",
    summary:
      "팔을 뻗은 손으로 하늘의 각도를 재고, 아는 별에서 출발해 모르는 별을 찾아가는 방법(스타 호핑).",
    marks: ["games", "background"],
    links: [
      {
        mark: "games",
        label: "나만의 별자리 (주먹 몇 개 높이)",
        href: "/games/my-constellation",
      },
      {
        mark: "games",
        label: "별자리 익히기: 하늘 길잡이 수업",
        href: "/games/star-school/lessons",
      },
      {
        mark: "games",
        label: "별자리 숨은그림찾기",
        href: "/games/find-constellation",
      },
      { mark: "games", label: "오늘 밤 내 하늘", href: "/games/tonight" },
    ],
  },
  {
    slug: "brightness-distance",
    icon: "💡",
    title: "별의 밝기와 거리",
    summary:
      "등급은 5등급 차이가 100배인 눈금이에요. 낮은 별은 공기에 가려 어두워지고, 거리는 연주 시차로 재요.",
    marks: ["solver", "games", "background"],
    links: [
      {
        mark: "solver",
        label: "별 지도 준비: 5등급까지 담는 이유",
        href: "/learn/star-map",
      },
      {
        mark: "solver",
        label: "별 찾기: 밝은 별부터",
        href: "/learn/find-stars",
      },
      {
        mark: "games",
        label: "빛의 타임캡슐",
        href: "/games/light-time-capsule",
      },
      { mark: "games", label: "오늘 밤 내 하늘", href: "/games/tonight" },
    ],
  },
  {
    slug: "milky-way",
    icon: "🌌",
    title: "은하도 기울어 있다",
    summary:
      "은하수는 천구 적도와 약 63° 기울어 하늘을 둘러요. 여름엔 은하 중심을, 겨울엔 그 반대쪽을 봐요.",
    marks: ["games", "background"],
    links: [
      {
        mark: "games",
        label: "별자리 숨은그림찾기 (궁수·백조자리)",
        href: "/games/find-constellation",
      },
      {
        mark: "games",
        label: "별자리 익히기: 은하수 찾기",
        href: "/games/star-school/lessons",
      },
    ],
  },
  {
    slug: "winter-stars",
    icon: "❄️",
    title: "겨울 별은 정말 더 밝을까?",
    summary:
      "별 지도로 직접 세어 봤어요. 저녁에 뜬 1등성 수, 밝은 별이 몰린 자리, 그리고 공기의 몫까지.",
    marks: ["games", "background"],
    links: [
      {
        mark: "games",
        label: "별자리 숨은그림찾기",
        href: "/games/find-constellation",
      },
      { mark: "games", label: "오늘 밤 내 하늘", href: "/games/tonight" },
    ],
  },
  {
    slug: "navigation",
    icon: "⛵",
    title: "선원들은 어떻게 위치를 찾았나",
    summary:
      "위도는 북극성과 한낮의 해로, 경도는 정확한 시계로. 이 사이트의 '어디서 찍었을까?'와 같은 생각이에요.",
    marks: ["solver", "games", "background"],
    links: [
      {
        mark: "solver",
        label: "어디서 찍었을까? (사진으로 찾기의 결과 카드)",
        href: "/plate-solver",
      },
      {
        mark: "solver",
        label: "시각·장소·지평선으로 풀기",
        href: "/learn/hard-photos#horizon-solve",
      },
      { mark: "games", label: "SkyGuessr", href: "/games/sky-guessr" },
      { mark: "games", label: "그림자 시계", href: "/games/shadow-clock" },
      { mark: "games", label: "별 궤적 풀기", href: "/games/star-trails" },
    ],
  },
];

export const basicsHref = (slug: string) => `/learn/basics/${slug}`;

export const basicsTopic = (slug: string) =>
  BASICS_TOPICS.find((t) => t.slug === slug);

export const basicsMetadata = (slug: string) => {
  const topic = BASICS_TOPICS.find((t) => t.slug === slug);

  return topic ? { title: topic.title, description: topic.summary } : {};
};
