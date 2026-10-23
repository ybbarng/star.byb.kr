import type { Metadata } from "next";
import DexBook from "@/game/starSchool/DexBook";

export const metadata: Metadata = {
  title: "별자리 도감",
  description:
    "별자리 88개, 길잡이 모양, 맨눈으로 보이는 딥스카이. 계절과 방향, 찾아가는 법, 오늘 밤 뜨는 때",
};

export default function Page() {
  return <DexBook />;
}
