import EratosthenesGame from "@/game/eratosthenes/EratosthenesGame";
import { gameMetadata } from "@/game/hub";

export const metadata = gameMetadata("/games/eratosthenes");

export default function Page() {
  return <EratosthenesGame />;
}
