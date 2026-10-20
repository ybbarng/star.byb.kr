import type { Metadata } from "next";
import SiteShell from "@/ui/SiteShell";

export const metadata: Metadata = {
  title: { default: "찾는 원리", template: "%s · 찾는 원리 · star.byb.kr" },
  description:
    "컴퓨터가 밤하늘 사진 속 하늘을 찾는 방법(플레이트 솔빙): 별 지도 준비, 별 찾기, 모양 맞추기, 확인하기",
};

export default function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SiteShell>{children}</SiteShell>;
}
