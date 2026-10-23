import { gameMetadata } from "@/game/hub";
import WanderersGame from "@/game/wanderers/WanderersGame";

export const metadata = gameMetadata("/games/wanderers");

export default function Page() {
  return <WanderersGame />;
}
