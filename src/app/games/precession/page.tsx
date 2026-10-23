import { gameMetadata } from "@/game/hub";
import PrecessionGame from "@/game/precession/PrecessionGame";

export const metadata = gameMetadata("/games/precession");

export default function Page() {
  return <PrecessionGame />;
}
