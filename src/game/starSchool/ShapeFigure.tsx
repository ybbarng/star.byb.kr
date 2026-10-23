"use client";

import type { Figure } from "@/game/starSchool/figure";
import type { LineLevel } from "@/game/starSchool/leitner";
import { cn } from "@/utils/cn";

// 별자리·길잡이 모양 카드 그림 (SVG). 선 보이기: 선 → 흐린 선 → 별만, 잠긴 도감 항목은 그림자.
// 둘레의 어두운 별(field)도 흐리게 그려, 별만 남았을 때 진짜 하늘처럼 모양을 찾아야 한다.

export type FigureLook = LineLevel | "silhouette";

const radiusOf = (mag: number) => Math.max(0.6, 3.4 - mag * 0.55);

export default function ShapeFigure({
  figure,
  look = "lines",
  names = false,
  field = true,
  className,
  marker,
  title,
}: {
  figure: Figure;
  look?: FigureLook;
  names?: boolean; // 밝은 별 이름
  field?: boolean;
  className?: string;
  marker?: { sizeDeg?: number; kind: string } | null; // 딥스카이 표시 (가운데)
  title?: string;
}) {
  const S = 100; // −1~1 → 0~200
  const at = (v: number) => (v + 1.15) * S;
  const silhouette = look === "silhouette";
  const lineOpacity =
    look === "lines" ? 0.85 : look === "faint" ? 0.22 : silhouette ? 0.35 : 0;

  return (
    <svg
      viewBox={`0 0 ${2.3 * S} ${2.3 * S}`}
      className={cn("block h-auto w-full", className)}
      role="img"
      aria-label={title ?? "별자리 모양"}
    >
      <rect width="100%" height="100%" rx="14" fill="rgba(8,12,30,0.92)" />
      {field &&
        !silhouette &&
        figure.field.map((s) => (
          <circle
            key={s.key}
            cx={at(s.x)}
            cy={at(s.y)}
            r={radiusOf(s.mag) * 0.8}
            fill="rgba(200,210,235,0.45)"
          />
        ))}
      {lineOpacity > 0 &&
        figure.lines.map((line, i) => (
          <polyline
            key={i}
            points={line.map(([x, y]) => `${at(x)},${at(y)}`).join(" ")}
            fill="none"
            stroke={silhouette ? "rgb(120,130,160)" : "rgb(250,215,90)"}
            strokeOpacity={lineOpacity}
            strokeWidth={silhouette ? 3 : 2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      {marker && !silhouette && (
        <g>
          <circle
            cx={at(0)}
            cy={at(0)}
            r={Math.max(10, (marker.sizeDeg ?? 1) * 6)}
            fill={
              marker.kind === "암흑 성운"
                ? "rgba(0,0,0,0.85)"
                : "rgba(190,200,255,0.18)"
            }
            stroke="rgba(160,220,255,0.8)"
            strokeDasharray="4 4"
          />
        </g>
      )}
      {figure.stars.map((s) => (
        <g key={s.key}>
          <circle
            cx={at(s.x)}
            cy={at(s.y)}
            r={radiusOf(s.mag) + (silhouette ? 0.5 : 0)}
            fill={silhouette ? "rgb(110,120,150)" : "rgb(255,248,230)"}
          />
          {!silhouette && s.mag < 1.6 && (
            <circle
              cx={at(s.x)}
              cy={at(s.y)}
              r={radiusOf(s.mag) * 2.4}
              fill="rgba(255,240,200,0.18)"
            />
          )}
          {names && !silhouette && s.name && s.mag < 2.6 && (
            <text
              x={at(s.x) + 5}
              y={at(s.y) - 5}
              fontSize="11"
              fill="rgba(255,255,255,0.8)"
            >
              {s.name}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
