import { gameMetadata } from "@/game/hub";
import TimeCapsuleGame from "@/game/timeCapsule/TimeCapsuleGame";

export const metadata = gameMetadata("/games/light-time-capsule");

export default function Page() {
  return <TimeCapsuleGame />;
}
