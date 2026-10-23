"use client";

import type { ComputerRun } from "@/game/humanVsComputer/computerRun";
import type { StageView } from "@/game/humanVsComputer/drawStage";
import type { Point2D } from "@/scripts/hash/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { sfx } from "@/game/fx/sound";
import {
  exampleTriangle,
  formatSeconds,
  overlapOf,
  skyTriangle,
} from "@/game/humanVsComputer/rounds";
import { constellationParts, projectLines } from "@/game/sky/catalog";
import { learnHref } from "@/learn/steps";
import { cn } from "@/utils/cn";

// 컴퓨터가 푼 과정을 세 단계로: 별 찾기 → 모양 맞추기 → 확인하기. 단계마다 사진 위 그림이 바뀌고,
// 찾는 원리(/learn)의 해당 페이지로 이어진다. 처음에는 저절로 한 단계씩 넘어간다.

const STEP_MS = 2600;
// 확인 단계에서 비교하는 사진 별 수 (VerifyOverlayDemo와 같다)
const VERIFY_PHOTO_STARS = 60;

export const REVEAL_COLOR = "rgba(250,210,80,0.95)";

export const answerLines = (run: ComputerRun, answer: string): Point2D[][] =>
  run.result.transform
    ? projectLines(run.result.transform, constellationParts(answer))
    : [];

export default function SolveSteps({
  image,
  run,
  answer,
  onView,
  onReveal,
}: {
  image: HTMLImageElement;
  run: ComputerRun;
  answer: string;
  onView: (v: StageView) => void;
  onReveal: (r: { lines: Point2D[][]; color: string } | null) => void;
}) {
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  const TP = run.result.transform;
  const W = image.width;
  const H = image.height;
  const overlap = useMemo(
    () =>
      TP ? overlapOf(TP, run.stars.slice(0, VERIFY_PHOTO_STARS), W, H) : null,
    [TP, run.stars, W, H],
  );
  const triangle = useMemo(
    () => (overlap ? exampleTriangle(overlap.pairs, W, H) : null),
    [overlap, W, H],
  );

  // 처음에는 저절로 다음 단계로
  useEffect(() => {
    if (!auto || step >= 2) {
      return;
    }

    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);

    return () => clearTimeout(t);
  }, [auto, step]);

  useEffect(() => {
    sfx.twinkle(step * 2);

    if (step === 0 || !TP || !overlap) {
      onView({ kind: "detect", stars: run.stars.slice(0, VERIFY_PHOTO_STARS) });
      onReveal(null);
    } else if (step === 1 && triangle) {
      onView({ kind: "triangle", stars: run.stars, triangle });
      onReveal(null);
    } else {
      onView({ kind: "verify", TP, map: overlap.map, pairs: overlap.pairs });
      onReveal({ lines: answerLines(run, answer), color: REVEAL_COLOR });
    }
  }, [step, TP, overlap, triangle, run, answer, onView, onReveal]);

  const solved = run.result.found && !!TP;
  const steps = [
    {
      title: "① 별 찾기",
      slug: "find-stars",
      body: `사진에서 별처럼 보이는 점 ${run.stars.length}개를 골랐어요 (${formatSeconds(run.detectMs)}). 진한 원 15개가 먼저 쓰는 별이에요 — 별다운 것, 그다음 밝은 순.`,
    },
    {
      title: "② 모양 맞추기",
      slug: "match-shapes",
      body: triangle
        ? `밝은 별 셋이 이루는 삼각형의 모양(각도 비율)은 사진을 돌리거나 키워도 그대로예요. 이 모양을 별 지도에 미리 만들어 둔 삼각형 약 113만 개의 색인에서 찾아요.`
        : "밝은 별 몇 개가 이루는 삼각형·사각형 모양을 별 지도의 색인에서 찾아요.",
    },
    {
      title: "③ 확인하기",
      slug: "verify",
      body:
        solved && overlap ? (
          <>
            찾은 자리대로 별 지도(보라 원)를 겹치니 사진 별{" "}
            {overlap.pairs.length}개가 들어맞았어요(초록 원). 우연히 이만큼 맞을
            확률은 10
            <sup>-{Math.min(99, run.result.confidence).toFixed(0)}</sup> — 10억
            분의 1보다 작아서 확신했어요.
          </>
        ) : (
          "후보 자리마다 별 지도를 겹쳐 맞는 별을 세요. 우연일 확률이 10억 분의 1보다 작아야 답해요."
        ),
    },
  ];

  if (!solved) {
    return (
      <div className="text-sm opacity-80">
        컴퓨터가 시간 안에 확신할 답을 찾지 못했어요. 이런 사진은 플레이트
        솔버에서 사람이 별을 고쳐 주면 풀려요.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-bold">컴퓨터는 이렇게 풀었어요</div>
      <div className="join w-full">
        {steps.map((s, i) => (
          <button
            key={s.slug}
            className={cn(
              "btn btn-xs join-item grow",
              i === step ? "btn-primary" : "btn-ghost bg-base-300/60",
            )}
            onClick={() => {
              setAuto(false);
              setStep(i);
            }}
          >
            {s.title}
          </button>
        ))}
      </div>
      <div key={step} className="fx-rise flex flex-col gap-2 text-sm">
        <p>{steps[step].body}</p>
        {step === 1 && triangle && <TrianglePair triangle={triangle} />}
        <Link
          href={learnHref(steps[step].slug)}
          className="link link-primary text-xs"
          target="_blank"
        >
          찾는 원리: {steps[step].title.slice(2)} 자세히 보기 →
        </Link>
      </div>
    </div>
  );
}

// 사진 속 삼각형과 별 지도 속 같은 삼각형을 나란히 (돌아가 있어도 모양은 같다)
function TrianglePair({
  triangle,
}: {
  triangle: NonNullable<ReturnType<typeof exampleTriangle>>;
}) {
  const photo = triangle.map((m) => m.photo);
  const sky = skyTriangle(triangle.map((m) => m.vector));
  const names = triangle.map((m) => m.name ?? "이름 없는 별");

  return (
    <div className="grid grid-cols-2 gap-2 text-center text-xs">
      <div>
        <MiniTriangle points={photo} color="#fde047" />
        사진 속 삼각형
      </div>
      <div>
        <MiniTriangle points={sky} color="#c4b5fd" labels={names} />별 지도 속
        삼각형 (북쪽이 위)
      </div>
    </div>
  );
}

function MiniTriangle({
  points,
  color,
  labels,
}: {
  points: Point2D[];
  color: string;
  labels?: string[];
}) {
  const S = 120;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1;
  const k = (S * 0.62) / span;
  const ox = (S - (Math.max(...xs) - minX) * k) / 2;
  const oy = (S - (Math.max(...ys) - minY) * k) / 2;
  const map = points.map(
    ([x, y]): Point2D => [ox + (x - minX) * k, oy + (y - minY) * k],
  );

  return (
    <svg
      viewBox={`0 0 ${S} ${S}`}
      className="rounded-box mb-1 w-full bg-[#0b1020]"
    >
      <polygon
        points={map.map((p) => p.join(",")).join(" ")}
        fill={`${color}22`}
        stroke={color}
        strokeWidth={1.5}
      />
      {map.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={2.6} fill="white" />
          {labels && (
            <text
              x={x}
              y={y - 5}
              fontSize={8}
              fill="white"
              textAnchor="middle"
              opacity={0.85}
            >
              {labels[i]}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
