import { gameMetadata } from "@/game/hub";
import SchoolHome from "@/game/starSchool/SchoolHome";

export const metadata = gameMetadata("/games/star-school");

export default function Page() {
  return <SchoolHome />;
}
