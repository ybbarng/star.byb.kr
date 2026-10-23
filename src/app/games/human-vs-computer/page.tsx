import { gameMetadata } from "@/game/hub";
import VersusGame from "@/game/humanVsComputer/VersusGame";

export const metadata = gameMetadata("/games/human-vs-computer");

export default function Page() {
  return <VersusGame />;
}
