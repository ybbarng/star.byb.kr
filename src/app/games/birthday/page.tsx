import BirthdayGame from "@/game/birthday/BirthdayGame";
import { gameMetadata } from "@/game/hub";

export const metadata = gameMetadata("/games/birthday");

export default function Page() {
  return <BirthdayGame />;
}
