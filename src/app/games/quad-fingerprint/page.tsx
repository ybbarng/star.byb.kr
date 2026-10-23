import { gameMetadata } from "@/game/hub";
import QuadFingerprintGame from "@/game/quadFingerprint/QuadFingerprintGame";

export const metadata = gameMetadata("/games/quad-fingerprint");

export default function Page() {
  return <QuadFingerprintGame />;
}
