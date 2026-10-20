// 시드 기반 난수는 게임에서도 쓰므로 src/utils/rng.ts로 옮겼다. 테스트의 기존 import를 위해 다시 내보낸다.
export { createRng, gaussian } from "@/utils/rng";
