import { gameMetadata } from "@/game/hub";
import StarTrailsGame from "@/game/starTrails/StarTrailsGame";

export const metadata = gameMetadata("/games/star-trails");

export default function Page() {
  return <StarTrailsGame />;
}
