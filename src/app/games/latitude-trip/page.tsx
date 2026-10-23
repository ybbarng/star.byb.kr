import { gameMetadata } from "@/game/hub";
import LatitudeTripGame from "@/game/latitudeTrip/LatitudeTripGame";

export const metadata = gameMetadata("/games/latitude-trip");

export default function Page() {
  return <LatitudeTripGame />;
}
