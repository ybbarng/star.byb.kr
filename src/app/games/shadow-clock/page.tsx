import { gameMetadata } from "@/game/hub";
import ShadowClockGame from "@/game/shadow/ShadowClockGame";

export const metadata = gameMetadata("/games/shadow-clock");

export default function Page() {
  return <ShadowClockGame />;
}
