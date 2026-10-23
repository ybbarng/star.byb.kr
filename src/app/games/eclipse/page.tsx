import EclipseGame from "@/game/eclipse/EclipseGame";
import { gameMetadata } from "@/game/hub";

export const metadata = {
  title: "식 예측하기",
  description:
    "삭·망과 달의 황위 그래프를 보고 한 해의 일식·월식 날짜를 맞혀요. 정답은 NASA 일식·월식 목록.",
  ...gameMetadata("/games/eclipse"),
};

export default function Page() {
  return <EclipseGame />;
}
