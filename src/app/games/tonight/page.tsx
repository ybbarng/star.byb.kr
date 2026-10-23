import { gameMetadata } from "@/game/hub";
import TonightReport from "@/game/tonight/TonightReport";

export const metadata = gameMetadata("/games/tonight");

export default function Page() {
  return <TonightReport />;
}
