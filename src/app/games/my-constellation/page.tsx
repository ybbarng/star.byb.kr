import { gameMetadata } from "@/game/hub";
import MyConstellationGame from "@/game/myConstellation/MyConstellationGame";

export const metadata = gameMetadata("/games/my-constellation");

export default function Page() {
  return <MyConstellationGame />;
}
