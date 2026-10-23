import { gameMetadata } from "@/game/hub";
import MoonDateGame from "@/game/moonDate/MoonDateGame";

export const metadata = gameMetadata("/games/moon-date");

export default function Page() {
  return <MoonDateGame />;
}
