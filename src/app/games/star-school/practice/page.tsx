import type { Metadata } from "next";
import CardPractice from "@/game/starSchool/CardPractice";

export const metadata: Metadata = {
  title: "별자리 카드 연습",
  description:
    "모양을 보고 이름을, 이름을 보고 모양을 골라요. 익숙해질수록 선이 사라지고, 끝에는 직접 선을 이어요",
};

export default function Page() {
  return <CardPractice />;
}
