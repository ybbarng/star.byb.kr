"use client";

import type { RelationQuestion } from "@/game/starSchool/quiz";
import type { SkyRing } from "@/game/starSchool/SchoolSky";
import { useMemo, useState } from "react";
import { sfx } from "@/game/fx/sound";
import { asterismById } from "@/game/starSchool/asterisms";
import { tapVector } from "@/game/starSchool/lessonGeometry";
import { relationVectors } from "@/game/starSchool/quiz";
import SchoolSky from "@/game/starSchool/SchoolSky";
import { dateAt, hrVector, timeLabel } from "@/game/starSchool/skyMath";
import { cn } from "@/utils/cn";
import { createRng } from "@/utils/rng";

// 관계 맞히기 문제 하나: 하늘에서 꼭짓점 누르기 · 한 자리 찾아 누르기 · 하늘 보고 고르기 · 순서대로 누르기.
// 끝나면 onDone(맞았나)을 한 번 부르고, 풀이(정답 표시·설명)를 보여 준다.

const MAX_MISSES = { vertices: 3, tap: 2 };
const GREEN = "rgba(110,240,150,0.95)";
const AMBER = "rgba(255,210,90,0.95)";

export default function RelationQuestionView({
  q,
  onDone,
}: {
  q: RelationQuestion;
  onDone: (correct: boolean) => void;
}) {
  const [done, setDone] = useState<boolean | null>(null);
  const [misses, setMisses] = useState(0);
  const [foundIdx, setFoundIdx] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [sequence, setSequence] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const end = (correct: boolean) => {
    setDone(correct);

    if (correct) sfx.hit();
    else sfx.lose();

    onDone(correct);
  };

  // 순서 문제의 보기 (문제마다 같은 순서로 섞는다)
  const shuffled = useMemo(() => {
    if (q.kind !== "order") return [];

    const rng = createRng(
      q.items.join("").length * 7919 + q.items[0].charCodeAt(0),
    );

    return q.items
      .map((x) => ({ x, k: rng() }))
      .sort((a, b) => a.k - b.k)
      .map(({ x }) => x);
  }, [q]);

  if (q.kind === "order") {
    return (
      <div className="flex flex-col gap-3">
        <div className="text-lg font-bold">{q.prompt}</div>
        <div className="text-sm opacity-70">
          해는 1년 동안 별자리 사이를 서쪽에서 동쪽으로 지나요. 먼저 지나는
          것부터 차례로 누르세요.
        </div>
        <div className="grid grid-cols-2 gap-2">
          {shuffled.map((label) => {
            const at = sequence.indexOf(label);

            return (
              <button
                key={label}
                className={cn(
                  "btn h-auto min-h-12 py-2",
                  at >= 0 && "btn-primary",
                  done === false && "btn-disabled",
                )}
                disabled={at >= 0 || done !== null}
                onClick={() => {
                  const want = q.items[sequence.length];

                  if (label !== want) {
                    sfx.miss();
                    setNote(`정답 순서: ${q.items.join(" → ")}`);
                    end(false);

                    return;
                  }

                  sfx.twinkle(sequence.length * 2);
                  const next = [...sequence, label];
                  setSequence(next);

                  if (next.length === q.items.length) end(true);
                }}
              >
                {at >= 0 && <span className="badge badge-sm">{at + 1}</span>}
                {label}
              </button>
            );
          })}
        </div>
        {done !== null && (
          <div
            className={cn(
              "fx-rise rounded-lg p-3 text-sm",
              done ? "bg-emerald-400/15" : "bg-red-400/10",
            )}
          >
            {note && <div className="font-bold">{note}</div>}
            {q.explain}
          </div>
        )}
      </div>
    );
  }

  const date = dateAt(q.scene.place, q.scene.time);
  // 카메라: 문제가 다루는 것(정답 자리까지) 전부가 들어오게
  const aim = relationVectors(q);
  const south = q.scene.place.latDeg < 0;

  // 하늘에 그릴 것: 끝나면 풀이 표시까지
  const marks =
    q.kind === "vertices"
      ? done !== null
        ? [{ kind: "asterism" as const, id: q.asterism }]
        : q.marks
      : done !== null
        ? [...q.marks, ...q.reveal]
        : q.marks;

  const vertexVectors =
    q.kind === "vertices"
      ? asterismById(q.asterism).vertices.map(hrVector)
      : [];
  const targetVectors =
    q.kind === "vertices"
      ? vertexVectors.filter((_, i) => !foundIdx.includes(i))
      : q.kind === "tap"
        ? q.targets.map(tapVector)
        : [];
  const rings: SkyRing[] =
    q.kind === "vertices"
      ? [
          ...foundIdx.map((i) => ({ vector: vertexVectors[i], color: GREEN })),
          ...(done === false
            ? vertexVectors
                .filter((_, i) => !foundIdx.includes(i))
                .map((v) => ({ vector: v, color: AMBER }))
            : []),
        ]
      : q.kind === "tap" && done !== null
        ? [{ vector: tapVector(q.targets[0]), color: done ? GREEN : AMBER }]
        : [];

  const onTap = (hit: number) => {
    if (done !== null || q.kind === "choice") return;

    if (q.kind === "vertices") {
      if (hit >= 0) {
        const remaining = vertexVectors
          .map((_, i) => i)
          .filter((i) => !foundIdx.includes(i));
        const found = [...foundIdx, remaining[hit]];
        sfx.twinkle(found.length * 2);
        setFoundIdx(found);
        setNote(`${found.length} / ${vertexVectors.length}`);

        if (found.length === vertexVectors.length) end(true);
      } else {
        sfx.miss();
        const m = misses + 1;
        setMisses(m);
        setNote(`거기는 아니에요 (기회 ${MAX_MISSES.vertices - m}번 남음)`);

        if (m >= MAX_MISSES.vertices) end(false);
      }

      return;
    }

    if (hit >= 0) {
      end(true);
    } else {
      sfx.miss();
      const m = misses + 1;
      setMisses(m);
      setNote(m >= MAX_MISSES.tap ? null : "거기는 아니에요. 한 번 더!");

      if (m >= MAX_MISSES.tap) end(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-lg font-bold">{q.prompt}</div>
        <div className="text-xs opacity-60">
          📍 {q.scene.place.name} · {timeLabel(q.scene.time)}
          {south && " · 남반구"}
        </div>
      </div>
      <SchoolSky
        place={q.scene.place}
        date={date}
        magLimit={4.6}
        lightPollution={south ? 0.15 : 0.25}
        marks={marks}
        aim={aim}
        aimKey={q.key}
        targets={
          q.kind === "vertices"
            ? { vectors: targetVectors, tolDeg: 2.5 }
            : q.kind === "tap"
              ? { vectors: targetVectors, tolDeg: q.tolDeg }
              : null
        }
        onTap={onTap}
        rings={rings}
        quiet={done === null}
      />
      {q.kind === "choice" && (
        <div className="grid grid-cols-2 gap-2">
          {q.choices.map((c, i) => (
            <button
              key={c}
              className={cn(
                "btn h-auto min-h-12 py-2 whitespace-normal",
                done !== null && i === q.answer && "btn-success",
                picked === i && i !== q.answer && "btn-error",
              )}
              disabled={done !== null}
              onClick={() => {
                setPicked(i);
                end(i === q.answer);
              }}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      {note && done === null && (
        <div className="text-sm opacity-80">{note}</div>
      )}
      {done !== null && q.kind !== "choice" && q.kind !== "vertices" && (
        <div
          className={cn(
            "fx-rise rounded-lg p-3 text-sm",
            done ? "bg-emerald-400/15" : "bg-red-400/10",
          )}
        >
          {done ? "맞아요! " : "정답 자리는 노란 고리예요. "}
          {q.explain}
        </div>
      )}
      {done !== null && q.kind === "choice" && (
        <div
          className={cn(
            "fx-rise rounded-lg p-3 text-sm",
            done ? "bg-emerald-400/15" : "bg-red-400/10",
          )}
        >
          {q.explain}
        </div>
      )}
      {done !== null && q.kind === "vertices" && (
        <div
          className={cn(
            "fx-rise rounded-lg p-3 text-sm",
            done ? "bg-emerald-400/15" : "bg-red-400/10",
          )}
        >
          {done ? "모두 찾았어요! " : "못 찾은 별은 노란 고리예요. "}
          {asterismById(q.asterism).howTo}
        </div>
      )}
    </div>
  );
}
