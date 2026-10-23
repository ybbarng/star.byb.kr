import type { Metadata } from "next";
import LessonRoom from "@/game/starSchool/LessonRoom";

export const metadata: Metadata = {
  title: "하늘 길잡이 수업",
  description:
    "실제 밤하늘에서 밝은 별을 징검다리 삼아 길을 찾아요. 북극성, 사계절 하늘, 은하수, 황도, 남십자까지",
};

export default function Page() {
  return <LessonRoom />;
}
