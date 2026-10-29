import type { Mat3 } from "@/search/utils/similarity";

// 별 궤적 사진의 별자리를 노출 시작 순간 → 끝 순간으로 궤적을 따라 움직여 보여 준다.
// 계속 움직이면 정신없어서, 시작에서 멈춤 → 이동 → 끝에서 멈춤을 되풀이하고, 끝에서 시작으로는 바로 넘어간다
// (거꾸로 움직이면 시간이 거꾸로 흐르는 것처럼 보인다).

export const TRAIL_MOTION = {
  holdStartMs: 3000,
  moveMs: 2500,
  holdEndMs: 3000,
};

const CYCLE_MS =
  TRAIL_MOTION.holdStartMs + TRAIL_MOTION.moveMs + TRAIL_MOTION.holdEndMs;

// 지난 시간 → 진행도 (0 = 노출 시작, 1 = 노출 끝). 이동은 천천히 출발해 천천히 멈춘다
export const trailProgress = (elapsedMs: number): number => {
  const t = ((elapsedMs % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;

  if (t < TRAIL_MOTION.holdStartMs) {
    return 0;
  }

  if (t >= TRAIL_MOTION.holdStartMs + TRAIL_MOTION.moveMs) {
    return 1;
  }

  const x = (t - TRAIL_MOTION.holdStartMs) / TRAIL_MOTION.moveMs;

  return x * x * (3 - 2 * x);
};

// 노출 시작 자세(solvePhoto가 돌려준 변환)에서 진행도만큼 지난 자세. 별 방향은 지구에 고정된 틀에서
// 천구 극(z축) 둘레로 −(각속도·시간)만큼 돌므로, 시작 자세 · Rz(−angle·progress)
export const trailPose = (
  start: Mat3,
  angleDeg: number,
  progress: number,
): Mat3 => {
  const a = (-angleDeg * progress * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);

  return start.map((row) => [
    row[0] * c + row[1] * s,
    -row[0] * s + row[1] * c,
    row[2],
  ]) as Mat3;
};
