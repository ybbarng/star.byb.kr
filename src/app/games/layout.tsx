import type { Metadata } from "next";
import SiteShell from "@/ui/SiteShell";

export const metadata: Metadata = {
  title: { default: "별 놀이터", template: "%s · 별 놀이터 · star.byb.kr" },
  description:
    "놀다 보면 별자리와 하늘의 움직임, 그리고 컴퓨터가 사진 속 하늘을 찾는 방법을 알게 되는 별 게임 모음",
};

// 게임 공용 틀: 사이트 공용 틀(별밭 배경, 길잡이, 게임에서는 소리 켜고 끄기)
export default function GamesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SiteShell>{children}</SiteShell>;
}
