import type { Metadata } from "next";
import PlateSolverPage from "@/plate-solver/PlateSolverPage";
import SiteShell from "@/ui/SiteShell";

export const metadata: Metadata = {
  title: "사진 속 별자리 찾기",
  description:
    "밤하늘 사진을 올리면 별의 배치만 보고 어느 하늘인지 찾아 별자리를 그려 줘요. 사진은 서버로 보내지 않아요.",
};

export default function Page() {
  return (
    <SiteShell>
      <PlateSolverPage />
    </SiteShell>
  );
}
