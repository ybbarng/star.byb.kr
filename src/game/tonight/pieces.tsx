"use client";

import type { Sketch, TimelineSlot, Window } from "@/game/tonight/report";
import { localParts } from "@/game/tonight/time";

// 오늘 밤 내 하늘: 직접 그린 작은 그림들 (낙서 별·달, 달 모양, 행성 스티커, 시간 막대, 별자리 그림)

export function DoodleStar({
  size = 24,
  color = "#ffe08a",
  className,
  style,
}: {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={style}
      aria-hidden
    >
      <path
        d="M12 2.5 L14.6 9 L21.5 9.4 L16.1 13.7 L18 20.6 L12 16.7 L6 20.6 L7.9 13.7 L2.5 9.4 L9.4 9 Z"
        fill={color}
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DoodleSparkle({
  size = 18,
  color = "#ffffff",
  className,
  style,
}: {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      className={className}
      style={style}
      aria-hidden
    >
      <path
        d="M10 1 Q11 9 19 10 Q11 11 10 19 Q9 11 1 10 Q9 9 10 1 Z"
        fill={color}
      />
    </svg>
  );
}

// 달 모양: lit 빛나는 비율, waxing 차오르는 달. 북반구에서 본 모양(차오르면 오른쪽이 밝다), 남반구는 뒤집는다
export function MoonFace({
  lit,
  waxing,
  south = false,
  size = 120,
}: {
  lit: number;
  waxing: boolean;
  south?: boolean;
  size?: number;
}) {
  const r = 46;
  const rx = Math.abs(1 - 2 * lit) * r;
  // 오른쪽 반원 + 경계 타원 (초승·그믐은 같은 쪽으로, 볼록하면 반대쪽으로 휜다)
  const d = `M0 ${-r} A${r} ${r} 0 0 1 0 ${r} A${rx} ${r} 0 0 ${lit < 0.5 ? 0 : 1} 0 ${-r} Z`;
  const flip = waxing !== south ? 1 : -1;

  return (
    <svg width={size} height={size} viewBox="-60 -60 120 120" aria-hidden>
      <defs>
        <radialGradient id="tn-moon-glow">
          <stop offset="55%" stopColor="rgba(255,236,170,0.35)" />
          <stop offset="100%" stopColor="rgba(255,236,170,0)" />
        </radialGradient>
      </defs>
      <circle r={58} fill="url(#tn-moon-glow)" opacity={0.3 + lit * 0.7} />
      <circle
        r={r}
        fill="#2c3157"
        stroke="rgba(255,224,138,0.35)"
        strokeWidth={1.5}
      />
      <path d={d} fill="#fff1c2" transform={`scale(${flip},1)`} />
      {/* 바다 무늬 (빛나는 쪽만 보이게 살짝) */}
      <g fill="rgba(200,180,120,0.25)" transform={`scale(${flip},1)`}>
        <circle cx={14} cy={-14} r={9} />
        <circle cx={22} cy={12} r={6} />
        <circle cx={-12} cy={8} r={8} />
      </g>
    </svg>
  );
}

const PLANET_LOOK: Record<
  string,
  { body: string; band?: string; ring?: boolean }
> = {
  수성: { body: "#bdb6aa" },
  금성: { body: "#fff0bf", band: "#f3dc9a" },
  화성: { body: "#ff7a4d", band: "#d95a33" },
  목성: { body: "#f2cf9e", band: "#c48a5a" },
  토성: { body: "#f3d48c", band: "#d6b06a", ring: true },
};

export function PlanetBadge({
  name,
  size = 56,
}: {
  name: string;
  size?: number;
}) {
  const look = PLANET_LOOK[name] ?? { body: "#ddd" };

  return (
    <svg width={size} height={size} viewBox="-30 -30 60 60" aria-hidden>
      {look.ring && (
        <ellipse
          rx={28}
          ry={8}
          fill="none"
          stroke="#e8cf95"
          strokeWidth={3}
          transform="rotate(-18)"
        />
      )}
      <circle r={17} fill={look.body} />
      {look.band && (
        <g
          stroke={look.band}
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.8}
        >
          <path d="M-14 -5 Q0 -8 14 -5" fill="none" />
          <path d="M-15 4 Q0 1 15 4" fill="none" />
        </g>
      )}
      <circle
        r={17}
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={1.5}
      />
      {look.ring && (
        <path
          d="M-27 6 A28 8 0 0 0 27 -12"
          fill="none"
          stroke="#e8cf95"
          strokeWidth={3}
          transform="rotate(-8)"
        />
      )}
    </svg>
  );
}

// 시간 막대 색: 낮 → 시민 박명 → 항해 박명 → 천문 박명 → 깜깜한 밤
export const LEVEL_COLOR = [
  "#ffd79a",
  "#f39b7f",
  "#8a6fd0",
  "#3d3f92",
  "#121738",
];
export const LEVEL_NAME = [
  "낮",
  "노을빛",
  "푸른 박명",
  "옅은 박명",
  "깜깜한 밤",
];

export function NightBar({
  slots,
  tz,
  good,
  now,
}: {
  slots: TimelineSlot[];
  tz: string;
  good: Window | null;
  now: number;
}) {
  if (slots.length < 2) {
    return null;
  }

  const t0 = slots[0].t;
  const t1 = slots[slots.length - 1].t;
  const pos = (t: number) => `${((t - t0) / (t1 - t0)) * 100}%`;
  const ticks = slots.filter((s) => {
    const p = localParts(s.t, tz);

    return p.minute < 10 && p.hour % 3 === 0;
  });

  return (
    <div className="flex flex-col gap-1">
      {/* 달이 떠 있는 동안 (밝을수록 진하게) */}
      <div className="flex h-2.5 overflow-hidden rounded-full bg-white/5">
        {slots.map((s, i) => (
          <div
            key={i}
            className="h-full grow"
            style={{
              background:
                s.moon > 0
                  ? `rgba(255,224,138,${0.25 + 0.75 * s.moon})`
                  : "transparent",
            }}
          />
        ))}
      </div>
      <div className="relative h-10 overflow-visible rounded-full">
        <div className="absolute inset-0 flex overflow-hidden rounded-full">
          {slots.map((s, i) => (
            <div
              key={i}
              className="h-full grow"
              style={{ background: LEVEL_COLOR[s.level] }}
            />
          ))}
        </div>
        {good && (
          <div
            className="tn-good absolute top-0 h-full rounded-full"
            style={{
              left: pos(good.from),
              width: `calc(${pos(good.to)} - ${pos(good.from)})`,
            }}
            title="별 보기 좋은 때"
          />
        )}
        {now > t0 && now < t1 && (
          <div
            className="absolute -top-1 h-12 w-0.5 bg-white"
            style={{ left: pos(now) }}
          >
            <span className="absolute -top-4 -translate-x-1/2 text-[10px] font-bold">
              지금
            </span>
          </div>
        )}
      </div>
      <div className="relative h-4 text-[11px] opacity-70">
        {ticks.map((s) => (
          <span
            key={s.t}
            className="absolute -translate-x-1/2"
            style={{ left: pos(s.t) }}
          >
            {localParts(s.t, tz).hour}시
          </span>
        ))}
      </div>
    </div>
  );
}

// 별자리 그림 (올려다본 모양 그대로, 위가 하늘 꼭대기 쪽)
export function SketchSvg({
  sketch,
  color,
}: {
  sketch: Sketch;
  color: string;
}) {
  const s = 44;

  return (
    <svg viewBox="-56 -56 112 112" className="h-36 w-36" aria-hidden>
      <circle
        r={54}
        fill="rgba(10,14,40,0.6)"
        stroke="rgba(255,255,255,0.1)"
        strokeDasharray="3 5"
      />
      {sketch.lines.map((line, i) => (
        <polyline
          key={i}
          points={line.map(([x, y]) => `${x * s},${-y * s}`).join(" ")}
          fill="none"
          stroke={color}
          strokeOpacity={0.75}
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {sketch.stars.map((p, i) => (
        <circle
          key={i}
          cx={p.x * s}
          cy={-p.y * s}
          r={Math.max(1.2, Math.min(4.2, 3.6 - 0.6 * p.mag))}
          fill="#fffaf0"
        />
      ))}
    </svg>
  );
}

// 별점 (1~5)
export function StarScore({ score }: { score: number }) {
  return (
    <span
      className="inline-flex gap-0.5"
      aria-label={`별 보기 좋은 정도 5점 중 ${score}점`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="tn-star-pop"
          style={{ animationDelay: `${300 + i * 120}ms` }}
        >
          <DoodleStar
            size={26}
            color={i <= score ? "#ffe08a" : "rgba(255,255,255,0.18)"}
          />
        </span>
      ))}
    </span>
  );
}
