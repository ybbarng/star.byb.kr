import DrawGame from "@/game/drawConstellation/DrawGame";
import { gameMetadata } from "@/game/hub";

export const metadata = gameMetadata("/games/draw-constellation");

export default function Page() {
  return <DrawGame />;
}
