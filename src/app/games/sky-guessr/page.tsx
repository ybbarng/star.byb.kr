import GeoGame from "@/game/geo/GeoGame";
import { gameMetadata } from "@/game/hub";

export const metadata = gameMetadata("/games/sky-guessr");

export default function Page() {
  return <GeoGame />;
}
