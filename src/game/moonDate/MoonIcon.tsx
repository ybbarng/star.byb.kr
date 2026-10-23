import { cn } from "@/utils/cn";

// 위상이 있는 작은 달 그림 (SVG). lit은 빛나는 비율(0 그믐 ~ 1 보름), angleDeg는 밝은 쪽 방향
// (화면 기준, 오른쪽 0°, 아래로 +). drawSky의 달과 같은 방법: 해 쪽 반원에 경계 타원을 깎거나 더한다.
export default function MoonIcon({
  lit,
  angleDeg,
  size = 24,
  className,
}: {
  lit: number;
  angleDeg: number;
  size?: number;
  className?: string;
}) {
  const tx = Math.abs(1 - 2 * lit);
  // 초승·그믐(lit < 0.5)은 경계가 밝은 쪽으로 휘고, 볼록한 달은 반대쪽으로 휜다
  const sweep = lit < 0.5 ? 0 : 1;

  return (
    <svg
      width={size}
      height={size}
      viewBox="-1.1 -1.1 2.2 2.2"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <circle r="1" fill="rgba(70,72,84,0.75)" />
      <path
        d={`M 0 -1 A 1 1 0 0 1 0 1 A ${tx} 1 0 0 ${sweep} 0 -1 Z`}
        fill="rgb(245,240,222)"
        transform={`rotate(${angleDeg})`}
      />
    </svg>
  );
}
