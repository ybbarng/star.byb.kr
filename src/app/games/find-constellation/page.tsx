import FindGame from "@/game/findConstellation/FindGame";
import { gameMetadata } from "@/game/hub";

export const metadata = gameMetadata("/games/find-constellation");

export default function Page() {
  return <FindGame />;
}
