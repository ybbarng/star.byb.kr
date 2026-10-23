"use client";

import type { Figure } from "@/game/starSchool/figure";
import { useMemo, useState } from "react";
import { sfx } from "@/game/fx/sound";
import { cn } from "@/utils/cn";

// 점 잇기: 이름만 보고, 별만 보이는 하늘에서 별자리 선을 직접 잇는다. 별을 하나 누르고 다른 별을 누르면 선이 생기고,
// 같은 선을 다시 이으면 지워진다. 다 그리면 진짜 선과 비교해 맞은 선·틀린 선·빠진 선을 보여 준다.

export interface DrawGrade {
  correct: number;
  total: number;
  wrong: number;
  pass: boolean;
}

const sameEdge = (a: [string, string], b: [string, string]) =>
  (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);

// 진짜 선의 70% 이상을 잇고, 이은 선의 70% 이상이 맞으면 통과
export const gradeDrawing = (
  drawn: [string, string][],
  truth: [string, string][],
): DrawGrade => {
  const correct = drawn.filter((e) => truth.some((t) => sameEdge(e, t))).length;
  const wrong = drawn.length - correct;

  return {
    correct,
    total: truth.length,
    wrong,
    pass:
      truth.length > 0 &&
      correct / truth.length >= 0.7 &&
      (drawn.length === 0 ? 0 : correct / drawn.length) >= 0.7,
  };
};

const radiusOf = (mag: number) => Math.max(0.8, 3.6 - mag * 0.6);

export default function DrawExercise({
  figure,
  onDone,
}: {
  figure: Figure;
  onDone: (grade: DrawGrade) => void;
}) {
  const S = 100;
  const at = (v: number) => (v + 1.15) * S;
  const stars = useMemo(
    () =>
      [...figure.stars, ...figure.field].filter(
        (s) => Math.abs(s.x) <= 1.12 && Math.abs(s.y) <= 1.12,
      ),
    [figure],
  );
  const byKey = useMemo(() => new Map(stars.map((s) => [s.key, s])), [stars]);
  const [edges, setEdges] = useState<[string, string][]>([]);
  const [pick, setPick] = useState<string | null>(null);
  const [grade, setGrade] = useState<DrawGrade | null>(null);

  const tap = (key: string) => {
    if (grade) return;

    if (!pick) {
      sfx.tap();
      setPick(key);

      return;
    }

    if (pick === key) {
      setPick(null);

      return;
    }

    const e: [string, string] = [pick, key];
    sfx.twinkle(edges.length);
    setEdges((list) =>
      list.some((x) => sameEdge(x, e))
        ? list.filter((x) => !sameEdge(x, e))
        : [...list, e],
    );
    // 이어서 그리기: 방금 누른 별에서 다음 선을 시작한다
    setPick(key);
  };

  const finish = () => {
    const g = gradeDrawing(edges, figure.edges);
    setGrade(g);
    setPick(null);
    onDone(g);
  };

  const line = (
    e: [string, string],
    color: string,
    width: number,
    dash?: string,
  ) => {
    const a = byKey.get(e[0]);
    const b = byKey.get(e[1]);

    return a && b ? (
      <line
        key={`${e[0]}-${e[1]}-${color}`}
        x1={at(a.x)}
        y1={at(a.y)}
        x2={at(b.x)}
        y2={at(b.y)}
        stroke={color}
        strokeWidth={width}
        strokeDasharray={dash}
        strokeLinecap="round"
      />
    ) : null;
  };

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${2.3 * S} ${2.3 * S}`}
        className="mx-auto block h-auto w-full max-w-md touch-manipulation"
      >
        <rect width="100%" height="100%" rx="14" fill="rgba(8,12,30,0.95)" />
        {grade &&
          figure.edges
            .filter((t) => !edges.some((e) => sameEdge(e, t)))
            .map((t) => line(t, "rgba(250,215,90,0.75)", 2, "5 4"))}
        {edges.map((e) =>
          line(
            e,
            !grade
              ? "rgba(120,220,255,0.95)"
              : figure.edges.some((t) => sameEdge(e, t))
                ? "rgba(110,240,150,0.95)"
                : "rgba(255,110,110,0.95)",
            2.5,
          ),
        )}
        {stars.map((s) => (
          <g key={s.key} onClick={() => tap(s.key)} className="cursor-pointer">
            <circle cx={at(s.x)} cy={at(s.y)} r={12} fill="transparent" />
            <circle
              cx={at(s.x)}
              cy={at(s.y)}
              r={radiusOf(s.mag)}
              fill={pick === s.key ? "rgb(255,210,90)" : "rgb(255,248,230)"}
            />
            {pick === s.key && (
              <circle
                cx={at(s.x)}
                cy={at(s.y)}
                r={8}
                fill="none"
                stroke="rgb(255,210,90)"
                strokeWidth={1.5}
              />
            )}
          </g>
        ))}
      </svg>
      {!grade ? (
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="opacity-70">
            별을 차례로 눌러 선을 이어요 · 이은 선 {edges.length}개
          </span>
          <button
            className="btn btn-sm btn-ghost"
            disabled={!edges.length}
            onClick={() => {
              setEdges((l) => l.slice(0, -1));
              setPick(null);
            }}
          >
            ↶ 하나 지우기
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => setPick(null)}
          >
            펜 들기
          </button>
          <button
            className={cn("btn btn-sm btn-primary")}
            disabled={edges.length < 2}
            onClick={finish}
          >
            다 그렸어요
          </button>
        </div>
      ) : (
        <div className="text-center text-sm">
          맞은 선 {grade.correct} / {grade.total}
          {grade.wrong > 0 && ` · 틀린 선 ${grade.wrong}`} ·{" "}
          <span className="text-emerald-300">초록</span>은 맞은 선,{" "}
          <span className="text-red-300">빨강</span>은 없는 선,{" "}
          <span className="text-amber-200">노란 점선</span>은 빠진 선
        </div>
      )}
    </div>
  );
}
