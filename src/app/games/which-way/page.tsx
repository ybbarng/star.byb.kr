import { gameMetadata } from "@/game/hub";
import WhichWayGame from "@/game/whichWay/WhichWayGame";

export const metadata = gameMetadata("/games/which-way");

export default function Page() {
  return <WhichWayGame />;
}
