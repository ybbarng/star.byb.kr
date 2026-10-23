import type { Metadata } from "next";
import RelationsGame from "@/game/starSchool/RelationsGame";

export const metadata: Metadata = {
  title: "별자리 관계 맞히기",
  description:
    "길잡이 모양의 꼭짓점, 두 별자리 사이의 별자리, 별 징검다리, 해가 지나는 순서를 실제 하늘에서 맞혀요",
};

export default function Page() {
  return <RelationsGame />;
}
