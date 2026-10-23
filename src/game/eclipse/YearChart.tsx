"use client";

import type { YearSky } from "@/game/eclipse/eclipse";
import type { EclipseScore, Pick } from "@/game/eclipse/problem";
import type { MouseEvent } from "react";
import { dayOfIso, RULE, yearStartJd } from "@/game/eclipse/eclipse";
import { DAY_TOLERANCE, kindOfSyzygy } from "@/game/eclipse/problem";

// 한 해 달력 그래프: 가로는 1월~12월, 위는 달의 황위(달이 해의 길에서 북·남으로 떨어진 각),
// 아래 띠는 달이 빛나는 정도(보름이면 꽉, 삭이면 빈). 삭·망 자리(어두운 점·노란 점)를 누르거나, 어려움에서는 날짜를 누른다.

const W = 1000;
const LEFT = 40;
const RIGHT = 10;
const TOP = 26;
const PLOT_H = 230;
const LAT_MAX = 6;
const LIT_TOP = TOP + PLOT_H + 12;
const LIT_H = 40;
const H = LIT_TOP + LIT_H + 8;
const MONTHS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

export default function YearChart({
  sky,
  markers,
  band,
  picks,
  cursorDay,
  score,
  onPickSyzygy,
  onPickDay,
}: {
  sky: YearSky;
  markers: boolean;
  band: boolean;
  picks: Pick[];
  cursorDay: number | null;
  score: EclipseScore | null;
  onPickSyzygy?: (index: number) => void;
  onPickDay?: (day: number) => void;
}) {
  const x = (day: number) => LEFT + (day / sky.days) * (W - LEFT - RIGHT);
  const y = (lat: number) => TOP + PLOT_H / 2 - (lat / LAT_MAX) * (PLOT_H / 2);
  const done = score !== null;
  const start = yearStartJd(sky.year);

  const latPath = sky.samples
    .map(
      (s, i) =>
        `${i === 0 ? "M" : "L"}${x(s.day).toFixed(1)},${y(s.moonLatDeg).toFixed(1)}`,
    )
    .join("");
  const litPath =
    `M${x(0)},${LIT_TOP + LIT_H}` +
    sky.samples
      .map(
        (s) =>
          `L${x(s.day).toFixed(1)},${(LIT_TOP + LIT_H * (1 - s.lit)).toFixed(1)}`,
      )
      .join("") +
    `L${x(sky.days)},${LIT_TOP + LIT_H}Z`;

  const monthStarts = MONTHS.map(
    (_, m) => (Date.UTC(sky.year, m, 1) - Date.UTC(sky.year, 0, 1)) / 86400000,
  );

  const handleClick = (e: MouseEvent<SVGSVGElement>) => {
    if (!onPickDay || done) {
      return;
    }

    const r = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    const day = Math.round(((vx - LEFT) / (W - LEFT - RIGHT)) * sky.days);
    onPickDay(Math.max(0, Math.min(sky.days - 1, day)));
  };

  const picked = (kind: "solar" | "lunar", day: number) =>
    picks.some(
      (p) => p.kind === kind && Math.abs(p.day - day) <= DAY_TOLERANCE,
    );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full touch-manipulation select-none"
      onClick={handleClick}
      role="img"
      aria-label={`${sky.year}년 달의 황위와 밝기 그래프`}
    >
      <rect x={0} y={0} width={W} height={H} fill="#0b1026" rx={10} />

      {/* 식 철 (결과에서만) */}
      {done &&
        sky.seasons.map((s) => (
          <g key={s.startDay}>
            <rect
              x={x(s.startDay)}
              y={TOP}
              width={x(s.endDay) - x(s.startDay)}
              height={LIT_TOP + LIT_H - TOP}
              fill="#a78bfa"
              opacity={0.16}
            />
            <text
              x={(x(s.startDay) + x(s.endDay)) / 2}
              y={TOP + 14}
              textAnchor="middle"
              fontSize={13}
              fill="#c4b5fd"
            >
              식 철
            </text>
          </g>
        ))}

      {/* 달 구분선과 이름 */}
      {monthStarts.map((d, m) => (
        <g key={m}>
          <line
            x1={x(d)}
            x2={x(d)}
            y1={TOP}
            y2={LIT_TOP + LIT_H}
            stroke="#ffffff"
            opacity={0.08}
          />
          <text
            x={x(d) + (x(monthStarts[m + 1] ?? sky.days) - x(d)) / 2}
            y={17}
            textAnchor="middle"
            fontSize={14}
            fill="#cbd5e1"
          >
            {MONTHS[m]}월
          </text>
        </g>
      ))}

      {/* 식이 날 수 있는 황위 띠 (입문) */}
      {band && (
        <>
          <rect
            x={LEFT}
            y={y(RULE.maybe)}
            width={W - LEFT - RIGHT}
            height={y(-RULE.maybe) - y(RULE.maybe)}
            fill="#fbbf24"
            opacity={0.1}
          />
          <rect
            x={LEFT}
            y={y(RULE.sure)}
            width={W - LEFT - RIGHT}
            height={y(-RULE.sure) - y(RULE.sure)}
            fill="#fbbf24"
            opacity={0.18}
          />
        </>
      )}

      {/* 황위 눈금 */}
      {[-5, 0, 5].map((v) => (
        <g key={v}>
          <line
            x1={LEFT}
            x2={W - RIGHT}
            y1={y(v)}
            y2={y(v)}
            stroke={v === 0 ? "#fbbf24" : "#ffffff"}
            strokeDasharray={v === 0 ? undefined : "4 6"}
            opacity={v === 0 ? 0.7 : 0.15}
          />
          <text
            x={LEFT - 6}
            y={y(v) + 4}
            textAnchor="end"
            fontSize={12}
            fill="#94a3b8"
          >
            {v > 0 ? `+${v}°` : `${v}°`}
          </text>
        </g>
      ))}
      <text x={LEFT + 6} y={y(0) - 6} fontSize={12} fill="#fcd34d">
        해의 길(황도)
      </text>

      {/* 달의 황위 */}
      <path d={latPath} fill="none" stroke="#7dd3fc" strokeWidth={1.6} />

      {/* 달 밝기 띠 */}
      <path d={litPath} fill="#e2e8f0" opacity={0.35} />
      <text
        x={LEFT - 6}
        y={LIT_TOP + 12}
        textAnchor="end"
        fontSize={11}
        fill="#94a3b8"
      >
        밝기
      </text>

      {/* 어려움: 고르는 날 */}
      {cursorDay !== null && !done && (
        <line
          x1={x(cursorDay + 0.5)}
          x2={x(cursorDay + 0.5)}
          y1={TOP}
          y2={LIT_TOP + LIT_H}
          stroke="#fbbf24"
          strokeWidth={2}
          opacity={0.8}
        />
      )}

      {/* 삭·망 자리 */}
      {(markers || done) &&
        sky.syzygies.map((s, i) => {
          const kind = kindOfSyzygy(s);
          const isPicked = markers && picked(kind, s.day);
          const cx = x(s.jd - start);
          const cy = y(s.moonLatDeg);

          return (
            <g
              key={s.jd}
              onClick={(e) => {
                if (markers && !done && onPickSyzygy) {
                  e.stopPropagation();
                  onPickSyzygy(i);
                }
              }}
              className={markers && !done ? "cursor-pointer" : undefined}
            >
              <circle cx={cx} cy={cy} r={16} fill="transparent" />
              {isPicked && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={12}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth={3}
                />
              )}
              <circle
                cx={cx}
                cy={cy}
                r={6.5}
                fill={s.kind === "new" ? "#111827" : "#fef3c7"}
                stroke={s.kind === "new" ? "#cbd5e1" : "#fde68a"}
                strokeWidth={1.5}
              />
            </g>
          );
        })}

      {/* 결과: 실제 식, 틀린 고르기 */}
      {done &&
        score.actual.map((e) => {
          const d = dayOfIso(e.date);
          const s = sky.syzygies.find(
            (q) =>
              kindOfSyzygy(q) === e.kind &&
              Math.abs(q.day - d) <= DAY_TOLERANCE,
          );
          const cx = s ? x(s.jd - start) : x(d + 0.5);
          const cy = s ? y(s.moonLatDeg) : y(0);
          const hit = !score.missed.includes(e);

          return (
            <g key={e.date}>
              <circle
                cx={cx}
                cy={cy}
                r={13}
                fill="none"
                stroke={hit ? "#34d399" : "#f87171"}
                strokeWidth={3}
                strokeDasharray={hit ? undefined : "5 4"}
              />
              <text
                x={cx}
                y={cy < TOP + 40 ? cy + 32 : cy - 18}
                textAnchor="middle"
                fontSize={17}
              >
                {e.kind === "solar" ? "☀️" : "🌕"}
              </text>
            </g>
          );
        })}
      {done &&
        score.picks
          .filter((p) => !p.hit)
          .map((p) => (
            <text
              key={`${p.kind}-${p.day}`}
              x={x(p.day + 0.5)}
              y={LIT_TOP - 2}
              textAnchor="middle"
              fontSize={16}
              fill="#f87171"
              fontWeight={700}
            >
              ✕
            </text>
          ))}

      {/* 어려움: 내가 고른 날 */}
      {!markers &&
        !done &&
        picks.map((p) => (
          <text
            key={`${p.kind}-${p.day}`}
            x={x(p.day + 0.5)}
            y={TOP + PLOT_H - 4}
            textAnchor="middle"
            fontSize={18}
          >
            {p.kind === "solar" ? "☀️" : "🌕"}
          </text>
        ))}
    </svg>
  );
}
