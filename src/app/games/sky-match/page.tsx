import { gameMetadata } from "@/game/hub";
import SkyMatchGame from "@/game/skyMatch/SkyMatchGame";

export const metadata = gameMetadata("/games/sky-match");

export default function Page() {
  return <SkyMatchGame />;
}
