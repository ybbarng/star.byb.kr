// "찾는 원리" 페이지들의 목차. 첫 화면의 세 단계 카드도 여기서 가져간다.
export interface LearnStep {
  slug: string;
  icon: string;
  title: string;
  summary: string; // 목차·카드에 쓰는 한두 문장
  core?: boolean; // 사진마다 하는 핵심 세 단계 (첫 화면에 보인다)
}

export const LEARN_STEPS: LearnStep[] = [
  {
    slug: "star-map",
    icon: "🗺",
    title: "별 지도 준비",
    summary:
      "밝은 별 1,625개의 방향과, 별 셋·넷이 이루는 모양의 색인을 만들어 둬요.",
  },
  {
    slug: "find-stars",
    icon: "✦",
    title: "별 찾기",
    summary:
      "사진에서 별처럼 보이는 점을 골라요. 나무·건물 불빛은 뒤로 미뤄요.",
    core: true,
  },
  {
    slug: "match-shapes",
    icon: "△",
    title: "모양 맞추기",
    summary: "밝은 별 몇 개가 이루는 삼각형·사각형 모양을 별 지도에서 찾아요.",
    core: true,
  },
  {
    slug: "verify",
    icon: "✓",
    title: "확인하기",
    summary:
      "나머지 별까지 맞는지 보고, 우연일 확률이 10억 분의 1보다 작을 때만 답해요.",
    core: true,
  },
  {
    slug: "hard-photos",
    icon: "🌀",
    title: "어려운 사진들",
    summary: "초광각 렌즈, 별이 열 개 남짓인 사진, 촬영 시각 거꾸로 찾기까지.",
  },
];

export const learnHref = (slug: string) => `/learn/${slug}`;

export const learnMetadata = (slug: string) => {
  const step = LEARN_STEPS.find((s) => s.slug === slug);

  return step ? { title: step.title, description: step.summary } : {};
};
